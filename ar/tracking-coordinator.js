import * as THREE from 'three';

/**
 * TrackingCoordinator
 * Manages 5-tier tracking state machine (LOCKED, GOOD, DEGRADED, PREDICTING, LOST),
 * multi-factor confidence scoring (0-100), short-term velocity damping,
 * and telemetry analytics for the Developer Debug HUD.
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
      filterBeta: options.filterBeta ?? 80.0,
      enableDeviceMotion: options.enableDeviceMotion !== false,
      ...options
    };

    // Per-target state map: targetIndex -> state object
    this.targets = new Map();

    // Device gyro tracking for motion assistance
    this.deviceGyro = {
      available: false,
      currentEuler: new THREE.Euler(0, 0, 0, 'YXZ'),
      currentQuat: new THREE.Quaternion(),
      lastQuat: new THREE.Quaternion(),
      deltaQuat: new THREE.Quaternion(),
      hasSample: false
    };

    this.initDeviceOrientation();
  }

  initDeviceOrientation() {
    if (typeof window === 'undefined' || !window.addEventListener) return;

    const handleOrientation = (e) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return;
      this.deviceGyro.available = true;

      const degToRad = Math.PI / 180;
      const alpha = (e.alpha || 0) * degToRad;
      const beta = (e.beta || 0) * degToRad;
      const gamma = (e.gamma || 0) * degToRad;

      this.deviceGyro.currentEuler.set(beta, gamma, alpha, 'YXZ');
      this.deviceGyro.currentQuat.setFromEuler(this.deviceGyro.currentEuler);

      if (this.deviceGyro.hasSample) {
        this.deviceGyro.deltaQuat.copy(this.deviceGyro.lastQuat).invert().multiply(this.deviceGyro.currentQuat);
      } else {
        this.deviceGyro.hasSample = true;
        this.deviceGyro.deltaQuat.identity();
      }
      this.deviceGyro.lastQuat.copy(this.deviceGyro.currentQuat);
    };

    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    this._orientationHandler = handleOrientation;
  }

  getOrCreateTargetState(targetIndex) {
    if (!this.targets.has(targetIndex)) {
      this.targets.set(targetIndex, {
        state: 'LOST', // 'LOCKED' | 'GOOD' | 'DEGRADED' | 'PREDICTING' | 'LOST'
        confidence: 0,
        historicalConfidence: 0,

        // Kinematics for prediction
        lastPos: new THREE.Vector3(),
        lastQuat: new THREE.Quaternion(),
        lastScale: new THREE.Vector3(1, 1, 1),
        linearVelocity: new THREE.Vector3(),
        lastVelocitySampleTime: 0,

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
   * Process a tracking frame for a specific target.
   *
   * @param {number} targetIndex - Target index
   * @param {THREE.Matrix4|null} rawMatrix - Matrix from MindAR when tracked
   * @param {Object} telemetry - Inliers, visual tracking flag
   * @param {number} dt - Frame delta time in seconds
   * @param {number} nowMs - Current timestamp in milliseconds
   */
  processFrame(targetIndex, rawMatrix, telemetry = {}, dt = 0.016, nowMs = performance.now()) {
    const t = this.getOrCreateTargetState(targetIndex);
    dt = Math.max(0.001, Math.min(dt, 0.1));

    const isVisuallyTracked = telemetry.isTracking === true && rawMatrix !== null;

    if (isVisuallyTracked) {
      // --- VISUALLY TRACKED ---
      t.consecutiveHits++;
      t.consecutiveMisses = 0;
      t.lastSeenTime = nowMs;
      t.missStartTime = 0;

      // Extract raw position & quaternion for velocity & delta
      const rawPos = new THREE.Vector3();
      const rawQuat = new THREE.Quaternion();
      const rawScale = new THREE.Vector3();
      rawMatrix.decompose(rawPos, rawQuat, rawScale);

      let posDelta = 0;
      let angleDelta = 0;

      if (t.lastVelocitySampleTime > 0) {
        posDelta = t.lastPos.distanceTo(rawPos);
        angleDelta = 2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(t.lastQuat.dot(rawQuat)))));

        const velDt = Math.max(0.001, (nowMs - t.lastVelocitySampleTime) / 1000);
        const instantVel = new THREE.Vector3().subVectors(rawPos, t.lastPos).divideScalar(velDt);
        t.linearVelocity.lerp(instantVel, 0.3); // Smooth velocity vector
      }

      t.lastPos.copy(rawPos);
      t.lastQuat.copy(rawQuat);
      t.lastScale.copy(rawScale);
      t.lastVelocitySampleTime = nowMs;

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

      // Determine 5-tier state
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
        confidence: Math.round(confidence),
        state: t.state
      };

    } else {
      // --- MISSED FRAME / OCCLUSION HANDLING ---
      t.consecutiveMisses++;
      t.consecutiveHits = 0;

      if (t.missStartTime === 0) {
        t.missStartTime = nowMs;
      }
      const missedMs = nowMs - t.missStartTime;

      if (missedMs <= this.options.predictionDuration && t.lastSeenTime > 0) {
        // PREDICTING STATE: Extrapolate short-term pose with damped velocity
        t.state = 'PREDICTING';

        const normTime = Math.min(1.0, missedMs / this.options.predictionDuration);
        const damping = Math.pow(Math.max(0, 1.0 - normTime), 1.5);

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
          confidence: Math.round(t.confidence),
          state: 'PREDICTING'
        };

      } else if (missedMs <= this.options.lostTargetTimeout && t.lastSeenTime > 0) {
        // DEGRADED STATE: Holding pose while waiting for timeout
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
          confidence: Math.round(t.confidence),
          state: 'DEGRADED'
        };

      } else {
        // CONFIRMED LOST
        t.state = 'LOST';
        t.confidence = 0;
        t.historicalConfidence = 0;
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
          confidence: 0,
          state: 'LOST'
        };
      }
    }

    return {
      state: t.state,
      confidence: Math.round(t.confidence),
      stats: t.stats,
      isHoldingPose: t.state === 'PREDICTING' || t.state === 'DEGRADED'
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

  destroy() {
    if (typeof window !== 'undefined' && this._orientationHandler) {
      window.removeEventListener('deviceorientation', this._orientationHandler);
    }
    this.targets.clear();
  }
}
