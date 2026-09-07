import * as THREE from 'three';
import { VideoPlane } from './video-plane.js';
import { HoloBorder } from '../animations/holo-border.js';
import { ParticleSystem } from '../animations/particle-system.js';
import { BoundsVisualizer } from './bounds-visualizer.js';

/**
 * Content Anchor Container
 * Hosts all AR visual elements anchored to the physical poster and applies calibrated transforms.
 * Designed to work seamlessly inside MindAR's anchor group while supporting occlusion hold and smooth fade.
 */
export class ContentAnchor {
  constructor({ targetWidth = 1.0, targetHeight = 1.34, videoSrc, fallbacks = [], calibration }) {
    this.targetWidth = targetWidth;
    this.targetHeight = targetHeight;
    this.calibration = { ...calibration };

    // Root group attached to MindAR target anchor
    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'ContentAnchorRoot';

    // Calibrated offset container
    this.contentGroup = new THREE.Group();
    this.contentGroup.name = 'CalibratedContentGroup';
    this.contentGroup.visible = true; // Kept visible; parent anchor group controls AR visibility
    this.rootGroup.add(this.contentGroup);

    // Initialize sub-elements
    this.videoPlane = new VideoPlane({
      src: videoSrc,
      aspectRatio: targetWidth / targetHeight,
      startOffset: this.calibration.videoStartOffset || 0,
      width: targetWidth,
      fallbacks
    });
    this.contentGroup.add(this.videoPlane.mesh);

    this.holoBorder = new HoloBorder(targetWidth, targetHeight);
    this.contentGroup.add(this.holoBorder.group);

    this.particleSystem = new ParticleSystem(100, { width: targetWidth, height: targetHeight });
    this.contentGroup.add(this.particleSystem.group);

    this.boundsVisualizer = new BoundsVisualizer({
      targetWidth,
      targetHeight
    });
    this.rootGroup.add(this.boundsVisualizer.group);

    // Fade and visibility state
    this.baseOpacity = this.calibration.opacity ?? 1.0;
    this.currentFade = 1.0;
    this.targetFade = 1.0;
    this.fadeSpeed = 4.0; // ~250ms transition
    this.isTracking = false;
    this.trackingState = 'LOST';
    this.confidence = 0;
    this.lostTimeoutTimer = null;
    this.lostTargetTimeout = this.calibration.lostTargetTimeout || 1200;

    // Apply initial calibration parameters
    this.applyCalibration(this.calibration);
  }

  applyCalibration(calib) {
    this.calibration = { ...this.calibration, ...calib };

    const {
      position = { x: 0, y: 0, z: 0 },
      scale = 1.0,
      scaleX = 1.0,
      scaleY = 1.0,
      rotation = { x: 0, y: 0, z: 0 },
      opacity = 1.0,
      videoStartOffset = 0,
      lostTargetTimeout = 1200,
      showVisualBounds = false
    } = this.calibration;

    this.baseOpacity = opacity;
    this.lostTargetTimeout = lostTargetTimeout;

    // Position offset
    this.contentGroup.position.set(position.x || 0, position.y || 0, position.z || 0);

    // Scale (uniform and non-uniform)
    const sx = (scale || 1.0) * (scaleX || 1.0);
    const sy = (scale || 1.0) * (scaleY || 1.0);
    const sz = scale || 1.0;
    this.contentGroup.scale.set(sx, sy, sz);

    // Rotation (Euler degrees to radians)
    const rx = ((rotation.x || 0) * Math.PI) / 180;
    const ry = ((rotation.y || 0) * Math.PI) / 180;
    const rz = ((rotation.z || 0) * Math.PI) / 180;
    this.contentGroup.rotation.set(rx, ry, rz);

    // Opacity
    this.videoPlane.setOpacity(this.baseOpacity * this.currentFade);

    // Video start offset
    this.videoPlane.setStartOffset(videoStartOffset);

    // Visual bounds
    this.boundsVisualizer.setVisible(showVisualBounds);
    this.boundsVisualizer.updateContentBounds(
      position.x || 0,
      position.y || 0,
      position.z || 0,
      this.targetWidth * sx,
      this.targetHeight * sy,
      rotation.z || 0
    );
  }

  onTargetFound() {
    if (this.lostTimeoutTimer) {
      clearTimeout(this.lostTimeoutTimer);
      this.lostTimeoutTimer = null;
    }
    this.isTracking = true;
    this.trackingState = 'GOOD';
    this.contentGroup.visible = true;
    this.targetFade = 1.0;
    this.currentFade = 1.0;
    this.videoPlane.setOpacity(this.baseOpacity);
    this.videoPlane.play();
  }

  onTargetLost(onConfirmedLost) {
    if (this.lostTimeoutTimer) clearTimeout(this.lostTimeoutTimer);

    this.trackingState = 'PREDICTING';

    // Graceful occlusion hold before initiating fade out and pausing
    this.lostTimeoutTimer = setTimeout(() => {
      this.isTracking = false;
      this.trackingState = 'LOST';
      this.targetFade = 0.0;
      if (onConfirmedLost) {
        onConfirmedLost();
      }
    }, this.lostTargetTimeout);
  }

  update(time, delta) {
    // Smooth opacity fade handling
    if (this.currentFade !== this.targetFade) {
      const step = this.fadeSpeed * delta;
      if (this.currentFade < this.targetFade) {
        this.currentFade = Math.min(this.targetFade, this.currentFade + step);
      } else {
        this.currentFade = Math.max(this.targetFade, this.currentFade - step);
      }

      this.videoPlane.setOpacity(this.baseOpacity * this.currentFade);

      // Pause video only after complete fade out
      if (this.currentFade <= 0.01 && this.targetFade === 0.0) {
        this.contentGroup.visible = false;
        this.videoPlane.pause();
      }
    }

    if (!this.contentGroup.visible) return;

    this.videoPlane.update(time);
    this.holoBorder.update(time);
    this.particleSystem.update(time);
  }

  setAudioMuted(muted) {
    this.videoPlane.setMuted(muted);
  }

  setVisualBoundsVisible(visible) {
    this.boundsVisualizer.setVisible(visible);
  }
}
