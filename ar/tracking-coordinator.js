import * as THREE from 'three';

/**
 * 1 Euro Filter Implementation for scalar, Vector3, and Quaternion
 * Provides low jitter at low speeds and zero lag during fast motion.
 */
class OneEuroFilterScalar {
  constructor({ minCutoff = 0.001, beta = 80.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xPrev = null;
    this.dxPrev = 0;
  }

  setParams({ minCutoff, beta, dCutoff }) {
    if (minCutoff !== undefined) this.minCutoff = minCutoff;
    if (beta !== undefined) this.beta = beta;
    if (dCutoff !== undefined) this.dCutoff = dCutoff;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
  }

  filter(x, dt) {
    if (this.xPrev === null || dt <= 0) {
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }

    // Derivative estimation
    const dx = (x - this.xPrev) / dt;
    const alphaD = this.computeAlpha(this.dCutoff, dt);
    const dxHat = alphaD * dx + (1 - alphaD) * this.dxPrev;

    // Dynamic cutoff frequency
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const alpha = this.computeAlpha(cutoff, dt);
    const xHat = alpha * x + (1 - alpha) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }

  computeAlpha(cutoff, dt) {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }
}

class OneEuroFilterVector3 {
  constructor(params) {
    this.x = new OneEuroFilterScalar(params);
    this.y = new OneEuroFilterScalar(params);
    this.z = new OneEuroFilterScalar(params);
  }

  setParams(params) {
    this.x.setParams(params);
    this.y.setParams(params);
    this.z.setParams(params);
  }

  reset() {
    this.x.reset();
    this.y.reset();
    this.z.reset();
  }

  filter(v, dt) {
    return new THREE.Vector3(
      this.x.filter(v.x, dt),
      this.y.filter(v.y, dt),
      this.z.filter(v.z, dt)
    );
  }
}

class OneEuroFilterQuaternion {
  constructor(params) {
    this.x = new OneEuroFilterScalar(params);
    this.y = new OneEuroFilterScalar(params);
    this.z = new OneEuroFilterScalar(params);
    this.w = new OneEuroFilterScalar(params);
    this.lastQ = null;
  }

  setParams(params) {
    this.x.setParams(params);
    this.y.setParams(params);
    this.z.setParams(params);
    this.w.setParams(params);
  }

  reset() {
    this.x.reset();
    this.y.reset();
    this.z.reset();
    this.w.reset();
    this.lastQ = null;
  }

  filter(q, dt) {
    if (!this.lastQ) {
      this.lastQ = q.clone();
      this.x.filter(q.x, dt);
      this.y.filter(q.y, dt);
      this.z.filter(q.z, dt);
      this.w.filter(q.w, dt);
      return q.clone();
    }

    // Ensure shortest path interpolation: if dot product < 0, invert quaternion
    let target = q.clone();
    if (this.lastQ.dot(target) < 0) {
      target.x = -target.x;
      target.y = -target.y;
      target.z = -target.z;
      target.w = -target.w;
    }

    const fx = this.x.filter(target.x, dt);
    const fy = this.y.filter(target.y, dt);
    const fz = this.z.filter(target.z, dt);
    const fw = this.w.filter(target.w, dt);

    const filteredQ = new THREE.Quaternion(fx, fy, fz, fw).normalize();
    this.lastQ.copy(filteredQ);
    return filteredQ;
  }
}

/**
 * TrackingCoordinator
 * Manages 5-tier tracking state machine, multi-factor confidence scoring,
 * adaptive OneEuro filtering, short-term velocity prediction with damping,
 * anti-snap reacquisition blending, and device orientation delta assist.
 */
export class TrackingCoordinator {
  constructor(options = {}) {
    this.options = {
      minInliers: options.minInliers ?? 6,
      idealInliers: options.idealInliers ?? 26,
      confidenceThreshold: options.confidenceThreshold ?? 50,
      predictionDuration: options.predictionDuration ?? 800, // ms
      lostTargetTimeout: options.lostTargetTimeout ?? 1200, // ms
      recoveryBlendDuration: options.recoveryBlendDuration ?? 250, // ms
      filterMinCF: options.filterMinCF ?? 0.001,
      filterBeta: options.filterBeta ?? 80.0,
      filterDCutoff: options.filterDCutoff ?? 1.0,
      enableDeviceMotion: options.enableDeviceMotion ?? true,
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

      // Convert degrees to radians (alpha: z, beta: x, gamma: y)
      const degToRad = Math.PI / 180;
      const alpha = (e.alpha || 0) * degToRad;
      const beta = (e.beta || 0) * degToRad;
      const gamma = (e.gamma || 0) * degToRad;

      this.deviceGyro.currentEuler.set(beta, gamma, alpha, 'YXZ');
      this.deviceGyro.currentQuat.setFromEuler(this.deviceGyro.currentEuler);

      if (this.deviceGyro.hasSample) {
        // Delta = inv(lastQuat) * currentQuat
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
      const filterParams = {
        minCutoff: this.options.filterMinCF,
        beta: this.options.filterBeta,
        dCutoff: this.options.filterDCutoff
      };

      this.targets.set(targetIndex, {
        state: 'LOST', // 'LOCKED' | 'GOOD' | 'DEGRADED' | 'PREDICTING' | 'LOST'
        confidence: 0,
        historicalConfidence: 0,

        // Poses
        lastRawPosition: new THREE.Vector3(),
        lastRawQuaternion: new THREE.Quaternion(),
        lastRawScale: new THREE.Vector3(1, 1, 1),

        filteredPosition: new THREE.Vector3(),
        filteredQuaternion: new THREE.Quaternion(),
        filteredScale: new THREE.Vector3(1, 1, 1),

        // Kinematics for prediction
        linearVelocity: new THREE.Vector3(),
        lastVelocitySampleTime: 0,
        previousFilteredPosition: new THREE.Vector3(),

        // Reacquisition blend state
        blendActive: false,
        blendStartTime: 0,
        blendStartPosition: new THREE.Vector3(),
        blendStartQuaternion: new THREE.Quaternion(),

        // Timing
        lastSeenTime: 0,
        missStartTime: 0,
        consecutiveHits: 0,
        consecutiveMisses: 0,

        // Filters
        positionFilter: new OneEuroFilterVector3(filterParams),
        quaternionFilter: new OneEuroFilterQuaternion(filterParams),

        // Telemetry stats
        stats: {
          inliers: 0,
          matches: 0,
          quadrantCoverage: 0,
          spanX: 0,
          spanY: 0,
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

    const filterParams = {
      minCutoff: this.options.filterMinCF,
      beta: this.options.filterBeta,
      dCutoff: this.options.filterDCutoff
    };

    for (const target of this.targets.values()) {
      target.positionFilter.setParams(filterParams);
      target.quaternionFilter.setParams(filterParams);
    }
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
   * @param {THREE.Matrix4|null} rawMatrix - MindAR pose matrix if tracked, null if missed
   * @param {Object} telemetry - Inliers, screen points, tracking state from controller
   * @param {number} dt - Frame delta time in seconds
   * @param {number} nowMs - Current timestamp in milliseconds
   */
  processFrame(targetIndex, rawMatrix, telemetry = {}, dt = 0.016, nowMs = performance.now()) {
    const t = this.getOrCreateTargetState(targetIndex);
    dt = Math.max(0.001, Math.min(dt, 0.1)); // Guard clamp dt

    const hasRawDetection = rawMatrix !== null && telemetry.isTracking !== false;

    if (hasRawDetection) {
      // --- RAW DETECTION AVAILABLE ---
      t.consecutiveHits++;
      t.consecutiveMisses = 0;
      const missedMs = t.lastSeenTime > 0 ? (nowMs - t.lastSeenTime) : 0;
      t.lastSeenTime = nowMs;

      // Decompose raw matrix
      const rawPos = new THREE.Vector3();
      const rawQuat = new THREE.Quaternion();
      const rawScale = new THREE.Vector3();
      rawMatrix.decompose(rawPos, rawQuat, rawScale);

      // Analyze spatial distribution of inlier points
      const spatial = this.analyzeSpatialDistribution(telemetry.points);

      // Compute pose delta against previous filtered pose
      const posDelta = t.filteredPosition.distanceTo(rawPos);
      const angleDelta = 2 * Math.acos(Math.min(1, Math.max(-1, Math.abs(t.filteredQuaternion.dot(rawQuat)))));

      // Multi-factor confidence scoring
      const confidence = this.computeConfidence({
        inliers: telemetry.inliers ?? (telemetry.points ? telemetry.points.length : 0),
        spatial,
        posDelta,
        angleDelta,
        consecutiveHits: t.consecutiveHits,
        targetState: t
      });

      t.confidence = confidence;
      t.historicalConfidence = 0.82 * t.historicalConfidence + 0.18 * confidence;

      // Anti-snap reacquisition check: if recovering from prediction or long miss
      if (t.state === 'PREDICTING' || (missedMs > 150 && t.state !== 'LOST')) {
        t.blendActive = true;
        t.blendStartTime = nowMs;
        t.blendStartPosition.copy(t.filteredPosition);
        t.blendStartQuaternion.copy(t.filteredQuaternion);
      }

      // Apply adaptive OneEuro filter
      const newFilteredPos = t.positionFilter.filter(rawPos, dt);
      const newFilteredQuat = t.quaternionFilter.filter(rawQuat, dt);

      // Estimate linear velocity for predictive damping
      if (t.lastVelocitySampleTime > 0) {
        const velDt = Math.max(0.001, (nowMs - t.lastVelocitySampleTime) / 1000);
        const instantVel = new THREE.Vector3().subVectors(newFilteredPos, t.previousFilteredPosition).divideScalar(velDt);
        t.linearVelocity.lerp(instantVel, 0.35); // Smooth velocity vector
      }
      t.previousFilteredPosition.copy(newFilteredPos);
      t.lastVelocitySampleTime = nowMs;

      // Anti-snap blending if recovering
      if (t.blendActive) {
        const blendElapsed = nowMs - t.blendStartTime;
        const blendFactor = Math.min(1.0, blendElapsed / this.options.recoveryBlendDuration);
        const smoothT = blendFactor * blendFactor * (3 - 2 * blendFactor); // Smoothstep

        t.filteredPosition.lerpVectors(t.blendStartPosition, newFilteredPos, smoothT);
        t.filteredQuaternion.copy(t.blendStartQuaternion).slerp(newFilteredQuat, smoothT);

        if (blendFactor >= 1.0) {
          t.blendActive = false;
        }
      } else {
        t.filteredPosition.copy(newFilteredPos);
        t.filteredQuaternion.copy(newFilteredQuat);
      }

      t.filteredScale.copy(rawScale);

      // Determine active tier state
      if (confidence >= 80 && telemetry.inliers >= this.options.minInliers * 1.5 && spatial.coverage >= 3) {
        t.state = 'LOCKED';
      } else if (confidence >= this.options.confidenceThreshold) {
        t.state = 'GOOD';
      } else {
        t.state = 'DEGRADED';
      }

      t.missStartTime = 0;

      // Telemetry stats update
      t.stats = {
        inliers: telemetry.inliers ?? (telemetry.points ? telemetry.points.length : 0),
        matches: telemetry.matches ?? t.stats.inliers,
        quadrantCoverage: spatial.coverage,
        spanX: Number(spatial.spanX.toFixed(2)),
        spanY: Number(spatial.spanY.toFixed(2)),
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
        // PREDICTING STATE: Extrapolate short-term pose with polynomial damping
        t.state = 'PREDICTING';

        const normTime = Math.min(1.0, missedMs / this.options.predictionDuration);
        // Damping factor γ(t) = max(0, 1 - t/T)^1.5
        const damping = Math.pow(Math.max(0, 1.0 - normTime), 1.5);

        // Extrapolate position with damped linear velocity
        const predictedDelta = t.linearVelocity.clone().multiplyScalar(dt * damping);
        t.filteredPosition.add(predictedDelta);

        // Optional device orientation assist: rotate anchor in response to phone motion
        if (this.options.enableDeviceMotion && this.deviceGyro.available && this.deviceGyro.hasSample) {
          t.filteredQuaternion.multiply(this.deviceGyro.deltaQuat);
        }

        // Gradually decay confidence during prediction
        t.confidence = Math.max(15, Math.round(t.confidence * (1 - 0.05 * (missedMs / 100))));
        t.historicalConfidence = Math.max(10, t.historicalConfidence * 0.95);

        t.stats = {
          inliers: 0,
          matches: 0,
          quadrantCoverage: 0,
          spanX: 0,
          spanY: 0,
          poseDelta: 0,
          missedMs: Math.round(missedMs),
          predicted: true,
          confidence: Math.round(t.confidence),
          state: 'PREDICTING'
        };

      } else if (missedMs <= this.options.lostTargetTimeout) {
        // Holding stationary at last known position while waiting for final lost debounce
        t.state = 'PREDICTING';
        t.confidence = Math.max(5, Math.round(t.confidence * 0.8));

        t.stats = {
          inliers: 0,
          matches: 0,
          quadrantCoverage: 0,
          spanX: 0,
          spanY: 0,
          poseDelta: 0,
          missedMs: Math.round(missedMs),
          predicted: true,
          confidence: Math.round(t.confidence),
          state: 'PREDICTING'
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
      position: t.filteredPosition,
      quaternion: t.filteredQuaternion,
      scale: t.filteredScale,
      stats: t.stats,
      isHoldingPose: t.state === 'PREDICTING' || t.state === 'DEGRADED'
    };
  }

  /**
   * Evaluates spatial distribution across the 4 quadrants of the poster surface.
   */
  analyzeSpatialDistribution(points = []) {
    if (!points || points.length === 0) {
      return { coverage: 0, spanX: 0, spanY: 0, q1: 0, q2: 0, q3: 0, q4: 0 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = p.x ?? p[0] ?? 0;
      const y = p.y ?? p[1] ?? 0;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      // Coordinate center (0, 0) in normalized space or (width/2, height/2)
      // MindAR points are typically in pixel coordinates or normalized [0, 1]
      const cx = p.cx ?? 0.5;
      const cy = p.cy ?? 0.5;

      if (x >= cx && y >= cy) q1++;
      else if (x < cx && y >= cy) q2++;
      else if (x < cx && y < cy) q3++;
      else q4++;
    }

    const spanX = Math.max(0, maxX - minX);
    const spanY = Math.max(0, maxY - minY);

    let coverage = 0;
    if (q1 > 0) coverage++;
    if (q2 > 0) coverage++;
    if (q3 > 0) coverage++;
    if (q4 > 0) coverage++;

    return { coverage, spanX, spanY, q1, q2, q3, q4 };
  }

  /**
   * Multi-factor confidence score formulation (0 - 100)
   */
  computeConfidence({ inliers, spatial, posDelta, angleDelta, consecutiveHits, targetState }) {
    // 1. Inlier Count Score (0 - 100)
    const inlierScore = Math.min(100, (inliers / this.options.idealInliers) * 100);

    // 2. Spatial Distribution Score (0 - 100)
    let spatialScore = (spatial.coverage / 4) * 70;
    if (spatial.spanX > 0.35 && spatial.spanY > 0.35) {
      spatialScore += 30;
    } else if (spatial.spanX > 0.2 || spatial.spanY > 0.2) {
      spatialScore += 15;
    }
    spatialScore = Math.min(100, spatialScore);

    // 3. Pose Stability Score (0 - 100)
    // Penalize large teleports or erratic angular snapping
    let poseScore = 100;
    if (posDelta > 0.4) poseScore -= 50;
    else if (posDelta > 0.15) poseScore -= 25;
    else if (posDelta > 0.05) poseScore -= 10;

    if (angleDelta > 0.7) poseScore -= 40;
    else if (angleDelta > 0.3) poseScore -= 20;
    poseScore = Math.max(0, poseScore);

    // 4. Temporal Hit Bonus
    const hitBonus = Math.min(10, consecutiveHits * 2);

    // Composite formula:
    // 35% Inliers + 30% Spatial Coverage + 20% Pose Stability + 15% History
    const rawScore =
      0.35 * inlierScore +
      0.30 * spatialScore +
      0.20 * poseScore +
      0.15 * (targetState.historicalConfidence || inlierScore) +
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
