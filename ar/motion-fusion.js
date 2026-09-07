import * as THREE from 'three';

// Preallocated scratch objects for zero-allocation math in 60 FPS loop
const _degToRad = Math.PI / 180;
const _scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _scratchQuat = new THREE.Quaternion();
const _screenTransform = new THREE.Quaternion();
const _minusHalfAngle = new THREE.Quaternion();
const _qWorldToCam = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 deg X rotation

/**
 * Mobile Device Motion & Orientation Sensor Fusion
 * Ingests device gyroscope/accelerometer telemetry with iOS permission handling,
 * screen orientation compensation, and zero-allocation relative camera delta calculation.
 */
export class MotionFusion {
  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    this.hasPermission = false;
    this.isActive = false;

    // Current device orientation quaternion in standard camera frame
    this.currentOrientation = new THREE.Quaternion();
    this.lastOrientation = new THREE.Quaternion();
    this.angularVelocity = new THREE.Vector3(); // rad/s (pitch, yaw, roll)

    // Timestamp of last received sensor event
    this.lastEventTime = 0;
    this.sampleCount = 0;

    // Bound listeners
    this._handleOrientation = this.handleOrientation.bind(this);
    this._handleMotion = this.handleMotion.bind(this);

    // Auto-attach if permission is not gated (e.g. Android / Desktop)
    this.autoInitialize();
  }

  /**
   * Automatically initializes sensors if explicit permission prompt is not required.
   */
  autoInitialize() {
    if (!this.isSupported) return;

    // Check if iOS 13+ permission request is required
    const requiresExplicitPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function';

    if (!requiresExplicitPermission) {
      this.hasPermission = true;
      this.startListening();
    }
  }

  /**
   * Request motion sensor permission. Must be triggered from a user gesture (tap/click).
   * Safe to call on all platforms; returns Promise<boolean>.
   */
  async requestPermission() {
    if (!this.isSupported) return false;

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this.hasPermission = true;
          this.startListening();
          return true;
        } else {
          console.warn('[MotionFusion] Motion permission denied by user.');
          return false;
        }
      } catch (err) {
        console.warn('[MotionFusion] Permission request error:', err);
        return false;
      }
    } else {
      // Permission implicitly granted on Android / standard browsers
      this.hasPermission = true;
      this.startListening();
      return true;
    }
  }

  startListening() {
    if (this.isActive || typeof window === 'undefined') return;

    window.addEventListener('deviceorientation', this._handleOrientation, { passive: true });
    if ('DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', this._handleMotion, { passive: true });
    }
    this.isActive = true;
  }

  stopListening() {
    if (!this.isActive || typeof window === 'undefined') return;

    window.removeEventListener('deviceorientation', this._handleOrientation);
    window.removeEventListener('devicemotion', this._handleMotion);
    this.isActive = false;
  }

  handleOrientation(e) {
    if (e.alpha === null || e.beta === null || e.gamma === null) return;

    const now = performance.now();
    const dt = this.lastEventTime > 0 ? (now - this.lastEventTime) / 1000 : 0.016;
    this.lastEventTime = now;
    this.sampleCount++;

    // Convert degrees to radians
    const alpha = (e.alpha || 0) * _degToRad; // Z [0, 360)
    const beta = (e.beta || 0) * _degToRad;   // X [-180, 180)
    const gamma = (e.gamma || 0) * _degToRad; // Y [-90, 90)

    // Device orientation Euler representation
    _scratchEuler.set(beta, gamma, alpha, 'YXZ');
    _scratchQuat.setFromEuler(_scratchEuler);

    // Compensate for screen orientation (Portrait = 0, Landscape = 90 / -90)
    const screenAngle = this.getScreenOrientationAngle() * _degToRad;
    _minusHalfAngle.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -screenAngle);
    _scratchQuat.multiply(_minusHalfAngle);

    // Transform from phone frame into rear-facing camera frame
    _scratchQuat.multiply(_qWorldToCam);

    // Save previous orientation before updating
    this.lastOrientation.copy(this.currentOrientation);
    this.currentOrientation.copy(_scratchQuat);

    // If devicemotion isn't firing, estimate angular velocity from orientation delta
    if (dt > 0.001 && dt < 0.2) {
      // Relative delta = current * inv(last)
      const qDelta = _scratchQuat.copy(this.currentOrientation).multiply(this.lastOrientation.clone().invert());
      // Angle = 2 * acos(w)
      const angle = 2 * Math.acos(Math.min(1, Math.max(-1, qDelta.w)));
      if (angle > 0.0001) {
        const factor = angle / (dt * Math.sin(angle / 2));
        this.angularVelocity.set(qDelta.x * factor, qDelta.y * factor, qDelta.z * factor);
      }
    }
  }

  handleMotion(e) {
    if (e.rotationRate) {
      const rr = e.rotationRate;
      // Convert deg/s to rad/s
      if (rr.alpha !== null && rr.beta !== null && rr.gamma !== null) {
        this.angularVelocity.set(
          (rr.beta || 0) * _degToRad,
          (rr.gamma || 0) * _degToRad,
          (rr.alpha || 0) * _degToRad
        );
      }
    }
  }

  getScreenOrientationAngle() {
    if (typeof window === 'undefined') return 0;
    if (window.screen && window.screen.orientation && window.screen.orientation.angle !== undefined) {
      return window.screen.orientation.angle;
    }
    if (typeof window.orientation === 'number') {
      return window.orientation;
    }
    return 0;
  }

  /**
   * Computes the relative rotation delta that a point fixed in world space appears
   * to undergo in the camera frame when the camera rotates from refQuat to the current orientation.
   *
   * @param {THREE.Quaternion} refQuat - Camera orientation at reference time t0
   * @param {THREE.Quaternion} targetQuat - Output quaternion (camera delta inverse)
   * @returns {THREE.Quaternion} targetQuat
   */
  getRelativeCameraDelta(refQuat, targetQuat = new THREE.Quaternion()) {
    if (!this.isActive || this.sampleCount < 2 || !refQuat) {
      targetQuat.identity();
      return targetQuat;
    }

    // Camera rotation between t0 and now: Delta = Q_now * Q_ref^-1
    // A point fixed in world space appears in camera space to rotate by inv(Delta) = Q_ref * Q_now^-1
    targetQuat.copy(refQuat).multiply(_scratchQuat.copy(this.currentOrientation).invert());
    return targetQuat;
  }

  /**
   * Snapshot current camera orientation as reference for prediction.
   */
  getSnapshot(targetQuat = new THREE.Quaternion()) {
    targetQuat.copy(this.currentOrientation);
    return targetQuat;
  }

  destroy() {
    this.stopListening();
  }
}
