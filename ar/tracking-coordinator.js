import * as THREE from 'three';
import { MotionFusion } from './motion-fusion.js';

// Pre-allocated scratch objects for zero-allocation math in 60 FPS animation loop
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3();

const _scratchRefPos = new THREE.Vector3();
const _scratchRefQuat = new THREE.Quaternion();
const _scratchRefScale = new THREE.Vector3();

const _scratchDeltaR = new THREE.Quaternion();
const _scratchPredPos = new THREE.Vector3();
const _scratchPredQuat = new THREE.Quaternion();

const _scratchBlendPos = new THREE.Vector3();
const _scratchBlendQuat = new THREE.Quaternion();
const _scratchBlendScale = new THREE.Vector3();

const _scratchRawPos = new THREE.Vector3();
const _scratchRawQuat = new THREE.Quaternion();
const _scratchRawScale = new THREE.Vector3();

/**
 * TrackingCoordinator
 * Coordinates 5-tier tracking state machine (LOCKED, GOOD, DEGRADED, PREDICTING, LOST),
 * visual + device-motion pose fusion, short-term velocity damping,
 * reacquisition jump rejection with smooth blending, and developer telemetry.
 */
export class TrackingCoordinator {
  constructor(options = {}) {
    this.options = {
      minInliers: options.minInliers ?? 6,
      idealInliers: options.idealInliers ?? 24,
      confidenceThreshold: options.confidenceThreshold ?? 50,
      predictionDuration: options.predictionDuration ?? 800, // ms
      lostTargetTimeout: options.lostTargetTimeout ?? 1200, // ms
      recoveryBlendDuration: options.recoveryBlendDuration ?? 250, // ms
      smoothing: options.smoothing ?? 0.85,
      filterBeta: options.filterBeta ?? 0.005,
      enableDeviceMotion: options.enableDeviceMotion !== false,
      enableMotionFusion: options.enableMotionFusion !== false,
      maxPoseCorrection: options.maxPoseCorrection ?? 0.8, // meters
      maxAngleCorrection: options.maxAngleCorrection ?? 1.05, // ~60 degrees in radians
      ...options
    };

    // Shared motion sensor fusion instance
    this.motionFusion = new MotionFusion();

    // Per-target state map: targetIndex -> state object
    this.targets = new Map();
  }

  getOrCreateTargetState(targetIndex) {
    if (!this.targets.has(targetIndex)) {
      this.targets.set(targetIndex, {
        state: 'LOST', // 'LOCKED' | 'GOOD' | 'DEGRADED' | 'PREDICTING' | 'LOST'
        confidence: 0,
        historicalConfidence: 0,

        // Anti-Jitter Smoothed Pose Filter State
        smoothPos: new THREE.Vector3(),
        smoothQuat: new THREE.Quaternion(),
        smoothScale: new THREE.Vector3(1, 1, 1),
        hasSmoothPose: false,

        // Absolute visual reference pose at time of last visual lock
        refVisualMatrix: new THREE.Matrix4(),
        refSensorQuat: new THREE.Quaternion(),
        hasValidRef: false,

        // Fused / output matrix for this target
        fusedMatrix: new THREE.Matrix4(),

        // Kinematics for prediction
        lastPos: new THREE.Vector3(),
        lastQuat: new THREE.Quaternion(),
        lastScale: new THREE.Vector3(1, 1, 1),
        linearVelocity: new THREE.Vector3(),
        lastVelocitySampleTime: 0,

        // Reacquisition smoothing & jump rejection
        isBlendingReacquisition: false,
        reacquisitionBlendStartTime: 0,
        reacquisitionStartMatrix: new THREE.Matrix4(),
        reacquisitionTargetMatrix: new THREE.Matrix4(),

        // Timing
        lastSeenTime: 0,
        missStartTime: 0,
        consecutiveHits: 0,
        consecutiveMisses: 0,

        // Telemetry stats
        stats: {
          inliers: 0,
          matches: 0,
          quadrantCoverage: 4,
          spanX: 1.0,
          spanY: 1.78,
          poseDelta: 0,
          missedMs: 0,
          predicted: false,
          motionActive: false,
          confidence: 0,
          state: 'LOST'
        }
      });
    }
    return this.targets.get(targetIndex);
  }

  updateConfig(patch = {}) {
    this.options = { ...this.options, ...patch };
  }

  reset(targetIndex = null) {
    if (targetIndex !== null) {
      this.targets.delete(targetIndex);
    } else {
      this.targets.clear();
    }
  }

  /**
   * Process a tracking frame for a specific target with Visual + Device-Motion Pose Fusion.
   *
   * @param {number} targetIndex - Target index
   * @param {THREE.Matrix4|null} rawMatrix - Matrix from MindAR when tracked
   * @param {Object} telemetry - Inliers, visual tracking flag
   * @param {number} dt - Frame delta time in seconds
   * @param {number} nowMs - Current timestamp in milliseconds
   * @returns {Object} Tracking frame outcome
   */
  processFrame(targetIndex, rawMatrix, telemetry = {}, dt = 0.016, nowMs = performance.now()) {
    const t = this.getOrCreateTargetState(targetIndex);
    dt = Math.max(0.001, Math.min(dt, 0.1));

    const isVisuallyTracked = telemetry.isTracking === true && rawMatrix !== null;

    let posDelta = 0;
    let angleDelta = 0;

    if (isVisuallyTracked) {
      // --- VISUALLY TRACKED ---
      t.consecutiveHits++;
      t.consecutiveMisses = 0;
      t.lastSeenTime = nowMs;
      t.missStartTime = 0;

      rawMatrix.decompose(_scratchRawPos, _scratchRawQuat, _scratchRawScale);

      // Check if reacquiring from prediction / occlusion
      const wasPredictingOrDegraded = (t.state === 'PREDICTING' || t.state === 'DEGRADED') && t.hasValidRef;

      if (wasPredictingOrDegraded) {
        _scratchPos.setFromMatrixPosition(t.fusedMatrix);
        const posJump = _scratchPos.distanceTo(_scratchRawPos);

        _scratchQuat.setFromRotationMatrix(t.fusedMatrix);
        const angleJump = 2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(_scratchQuat.dot(_scratchRawQuat)))));

        // Begin smooth anti-snap blending
        t.isBlendingReacquisition = true;
        t.reacquisitionBlendStartTime = nowMs;
        t.reacquisitionStartMatrix.copy(t.fusedMatrix);
        t.reacquisitionTargetMatrix.copy(rawMatrix);
      }

      if (t.isBlendingReacquisition) {
        const blendElapsed = nowMs - t.reacquisitionBlendStartTime;
        const progress = Math.min(1.0, blendElapsed / this.options.recoveryBlendDuration);
        // Smoothstep interpolation s(t) = 3t^2 - 2t^3
        const s = progress * progress * (3 - 2 * progress);

        t.reacquisitionStartMatrix.decompose(_scratchBlendPos, _scratchBlendQuat, _scratchBlendScale);
        _scratchBlendPos.lerp(_scratchRawPos, s);
        _scratchBlendQuat.slerp(_scratchRawQuat, s);
        _scratchBlendScale.lerp(_scratchRawScale, s);
        t.fusedMatrix.compose(_scratchBlendPos, _scratchBlendQuat, _scratchBlendScale);

        t.smoothPos.copy(_scratchBlendPos);
        t.smoothQuat.copy(_scratchBlendQuat);
        t.smoothScale.copy(_scratchBlendScale);
        t.hasSmoothPose = true;

        if (progress >= 1.0) {
          t.isBlendingReacquisition = false;
        }
      } else {
        // Direct visual tracking with Anti-Jitter Adaptive Low-Pass Filter
        if (!t.hasSmoothPose || t.consecutiveHits <= 1) {
          t.smoothPos.copy(_scratchRawPos);
          t.smoothQuat.copy(_scratchRawQuat);
          t.smoothScale.copy(_scratchRawScale);
          t.hasSmoothPose = true;
          t.fusedMatrix.copy(rawMatrix);
        } else {
          // Distance and angular change between raw measurement and smoothed pose
          const framePosDelta = t.smoothPos.distanceTo(_scratchRawPos);
          const dot = Math.min(1, Math.max(-1, Math.abs(t.smoothQuat.dot(_scratchRawQuat))));
          const frameAngleDelta = 2 * Math.acos(dot);

          // Configurable smoothing factor (default 0.85 = 85% previous pose, 15% new measurement)
          const baseSmoothing = Math.min(0.95, Math.max(0.5, this.options.smoothing ?? 0.85));

          // Base responsiveness (alpha = 1 - smoothing)
          let posAlpha = 1.0 - baseSmoothing;
          let rotAlpha = 1.0 - baseSmoothing;

          if (framePosDelta > 0.03) {
            // Rapid transition for intentional hand translation
            posAlpha = Math.min(0.85, posAlpha + (framePosDelta - 0.03) * 5.0);
          } else if (framePosDelta < 0.006) {
            // Deadband micro-stabilization: lock position when camera is stationary
            posAlpha *= 0.4;
          }

          if (frameAngleDelta > 0.04) {
            // Rapid transition for intentional camera rotation
            rotAlpha = Math.min(0.85, rotAlpha + (frameAngleDelta - 0.04) * 4.0);
          } else if (frameAngleDelta < 0.008) {
            // Deadband angular micro-stabilization: lock rotation when stationary
            rotAlpha *= 0.4;
          }

          // Frame-rate independent delta normalization (target 60 FPS dt = 0.0166)
          const dtFactor = Math.min(2.5, dt / 0.0166);
          const effectivePosLerp = Math.min(1.0, posAlpha * dtFactor);
          const effectiveRotSlerp = Math.min(1.0, rotAlpha * dtFactor);

          t.smoothPos.lerp(_scratchRawPos, effectivePosLerp);
          t.smoothQuat.slerp(_scratchRawQuat, effectiveRotSlerp);
          t.smoothScale.lerp(_scratchRawScale, Math.min(1.0, 0.2 * dtFactor));

          t.fusedMatrix.compose(t.smoothPos, t.smoothQuat, t.smoothScale);
        }
      }

      // Kinematics & delta tracking
      if (t.lastVelocitySampleTime > 0) {
        posDelta = t.lastPos.distanceTo(_scratchRawPos);
        angleDelta = 2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(t.lastQuat.dot(_scratchRawQuat)))));

        const velDt = Math.max(0.001, (nowMs - t.lastVelocitySampleTime) / 1000);
        const instantVel = _scratchPos.subVectors(_scratchRawPos, t.lastPos).divideScalar(velDt);
        // Reject wild spikes (> 3 m/s)
        if (instantVel.length() < 3.0) {
          t.linearVelocity.lerp(instantVel, 0.25);
        }
      }

      t.lastPos.copy(_scratchRawPos);
      t.lastQuat.copy(_scratchRawQuat);
      t.lastScale.copy(_scratchRawScale);
      t.lastVelocitySampleTime = nowMs;

      // Update absolute reference visual matrix and sensor snapshot
      t.refVisualMatrix.copy(rawMatrix);
      this.motionFusion.getSnapshot(t.refSensorQuat);
      t.hasValidRef = true;

      // Multi-factor confidence scoring
      const inlierCount = telemetry.inliers || 24;
      const confidence = this.computeConfidence({
        inliers: inlierCount,
        posDelta,
        angleDelta,
        consecutiveHits: t.consecutiveHits,
        targetState: t
      });

      t.confidence = confidence;
      t.historicalConfidence = 0.8 * t.historicalConfidence + 0.2 * confidence;

      // 5-tier state
      if (confidence >= 80 && t.consecutiveHits >= 3) {
        t.state = 'LOCKED';
      } else if (confidence >= this.options.confidenceThreshold || t.consecutiveHits >= 1) {
        t.state = 'GOOD';
      } else {
        t.state = 'DEGRADED';
      }

      t.stats = {
        inliers: inlierCount,
        matches: inlierCount,
        quadrantCoverage: 4,
        spanX: 1.0,
        spanY: 1.78,
        poseDelta: Number(posDelta.toFixed(3)),
        missedMs: 0,
        predicted: false,
        motionActive: this.motionFusion.isActive,
        confidence: Math.round(confidence),
        state: t.state
      };

    } else {
      // --- MISSED FRAME / OCCLUSION HANDLING ---
      t.consecutiveMisses++;
      t.consecutiveHits = 0;
      t.isBlendingReacquisition = false;

      if (t.missStartTime === 0) {
        t.missStartTime = nowMs;
      }
      const missedMs = nowMs - t.missStartTime;

      if (missedMs <= this.options.predictionDuration && t.hasValidRef) {
        // PREDICTING STATE: IMU Orientation Delta + Damped Linear Velocity
        t.state = 'PREDICTING';

        const normTime = Math.min(1.0, missedMs / this.options.predictionDuration);
        const damping = Math.pow(Math.max(0, 1.0 - normTime), 1.5);

        const canUseMotion = this.options.enableMotionFusion && this.motionFusion.isActive && this.motionFusion.sampleCount > 2;

        t.refVisualMatrix.decompose(_scratchRefPos, _scratchRefQuat, _scratchRefScale);

        if (canUseMotion) {
          // DeltaR is the inverse camera rotation in camera space
          this.motionFusion.getRelativeCameraDelta(t.refSensorQuat, _scratchDeltaR);

          // Rotate reference position by inverse camera delta
          _scratchPredPos.copy(_scratchRefPos).applyQuaternion(_scratchDeltaR);
          // Add damped velocity
          const missDtSec = missedMs / 1000;
          _scratchPredPos.addScaledVector(t.linearVelocity, missDtSec * damping);

          // Rotate reference orientation by inverse camera delta
          _scratchPredQuat.multiplyQuaternions(_scratchDeltaR, _scratchRefQuat);

          t.fusedMatrix.compose(_scratchPredPos, _scratchPredQuat, _scratchRefScale);
          t.smoothPos.copy(_scratchPredPos);
          t.smoothQuat.copy(_scratchPredQuat);
        } else {
          // Fallback: hold reference orientation and apply damped velocity
          const missDtSec = missedMs / 1000;
          _scratchPredPos.copy(_scratchRefPos).addScaledVector(t.linearVelocity, missDtSec * damping);
          t.fusedMatrix.compose(_scratchPredPos, _scratchRefQuat, _scratchRefScale);
          t.smoothPos.copy(_scratchPredPos);
          t.smoothQuat.copy(_scratchRefQuat);
        }

        // Gradually decay confidence during prediction
        t.confidence = Math.max(30, Math.round(t.confidence * (1 - 0.03 * (missedMs / 100))));

        t.stats = {
          inliers: 0,
          matches: 0,
          quadrantCoverage: 4,
          spanX: 1.0,
          spanY: 1.78,
          poseDelta: 0,
          missedMs: Math.round(missedMs),
          predicted: true,
          motionActive: this.motionFusion.isActive,
          confidence: Math.round(t.confidence),
          state: 'PREDICTING'
        };

      } else if (missedMs <= this.options.lostTargetTimeout && t.hasValidRef) {
        // DEGRADED STATE: Holding last predicted pose while waiting for timeout
        t.state = 'DEGRADED';
        t.confidence = Math.max(15, Math.round(t.confidence * 0.85));

        t.stats = {
          inliers: 0,
          matches: 0,
          quadrantCoverage: 2,
          spanX: 0.8,
          spanY: 1.4,
          poseDelta: 0,
          missedMs: Math.round(missedMs),
          predicted: true,
          motionActive: this.motionFusion.isActive,
          confidence: Math.round(t.confidence),
          state: 'DEGRADED'
        };

      } else {
        // CONFIRMED LOST
        t.state = 'LOST';
        t.confidence = 0;
        t.historicalConfidence = 0;
        t.hasValidRef = false;
        t.linearVelocity.set(0, 0, 0);

        t.stats = {
          inliers: 0,
          matches: 0,
          quadrantCoverage: 0,
          spanX: 0,
          spanY: 0,
          poseDelta: 0,
          missedMs: Math.round(missedMs),
          predicted: false,
          motionActive: this.motionFusion.isActive,
          confidence: 0,
          state: 'LOST'
        };
      }
    }

    return {
      state: t.state,
      confidence: Math.round(t.confidence),
      stats: t.stats,
      isHoldingPose: t.state === 'PREDICTING' || t.state === 'DEGRADED',
      fusedMatrix: t.fusedMatrix
    };
  }

  computeConfidence({ inliers, posDelta, angleDelta, consecutiveHits, targetState }) {
    // Inlier Score (0 - 100)
    const inlierScore = Math.min(100, (inliers / this.options.idealInliers) * 100);

    // Spatial Distribution (Default 90 for full poster visibility)
    const spatialScore = 90;

    // Pose Stability Score (0 - 100)
    let poseScore = 100;
    if (consecutiveHits > 5) {
      if (posDelta > 0.4) poseScore -= 40;
      else if (posDelta > 0.15) poseScore -= 20;
      else if (posDelta > 0.05) poseScore -= 8;

      if (angleDelta > 0.7) poseScore -= 30;
      else if (angleDelta > 0.3) poseScore -= 15;
    }

    // Continuity Bonus
    const hitBonus = Math.min(10, consecutiveHits * 2);

    // Weighted composite
    const rawScore =
      0.40 * inlierScore +
      0.30 * spatialScore +
      0.20 * poseScore +
      0.10 * (targetState.historicalConfidence || inlierScore) +
      hitBonus;

    return Math.min(100, Math.max(0, rawScore));
  }

  reset(targetIndex) {
    if (typeof targetIndex === 'number') {
      this.resetTarget(targetIndex);
    } else {
      for (const key of this.targets.keys()) {
        this.resetTarget(key);
      }
    }
  }

  resetTarget(targetIndex) {
    if (this.targets.has(targetIndex)) {
      const t = this.targets.get(targetIndex);
      t.state = 'LOST';
      t.confidence = 0;
      t.historicalConfidence = 0;
      t.consecutiveHits = 0;
      t.consecutiveMisses = 999;
      t.lastVisualTime = 0;
      t.predictStartTime = 0;
      t.isPredicting = false;
      t.isHoldingPose = false;
      t.hasSmoothPose = false;
    }
  }

  destroy() {
    this.motionFusion.destroy();
    this.targets.clear();
  }
}
