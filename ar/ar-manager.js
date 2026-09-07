import * as THREE from 'three';
import { ContentAnchor } from './content-anchor.js';
import { TrackingCoordinator } from './tracking-coordinator.js';

/**
 * Core WebAR Image Tracking Manager
 * Bridges MindAR with Three.js rendering and coordinates tracking lifecycle
 * with multi-factor confidence scoring, predictive occlusion recovery, and adaptive smoothing.
 */
export class ARManager {
  constructor({
    container,
    imageTargetSrc,
    targets = [],
    targetWidth = 1.0,
    targetHeight = 1.776,
    videoSrc,
    calibration,
    onTrackingStateChange,
    onFirstTrack,
    onTelemetryUpdate
  }) {
    this.container = container;
    this.imageTargetSrc = imageTargetSrc;
    this.targets = Array.isArray(targets) && targets.length > 0
      ? targets
      : [{
          id: 'default-target',
          name: 'Default Target',
          videoSrc: videoSrc || './video.mp4',
          aspectRatio: targetWidth / targetHeight
        }];
    this.calibration = calibration || {};
    this.onTrackingStateChange = onTrackingStateChange;
    this.onFirstTrack = onFirstTrack;
    this.onTelemetryUpdate = onTelemetryUpdate;

    this.mindarThree = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Multi-target items array: { index, def, anchor, contentAnchor, lastState }
    this.targetItems = [];
    this.activeTrackingIndices = new Set();
    this.lastTrackerResults = {};

    // Initialize Tracking Coordinator
    this.trackingCoordinator = new TrackingCoordinator({
      minInliers: this.calibration.minInliers || 6,
      idealInliers: this.calibration.idealInliers || 26,
      confidenceThreshold: Math.round((this.calibration.confidenceThreshold || 0.6) * 100),
      predictionDuration: this.calibration.predictionDuration || 800,
      lostTargetTimeout: this.calibration.lostTargetTimeout || 1200,
      recoveryBlendDuration: this.calibration.recoveryBlendDuration || 250,
      filterMinCF: this.calibration.filterMinCF || 0.001,
      filterBeta: this.calibration.filterBeta || 80.0,
      enableDeviceMotion: this.calibration.enableDeviceMotion !== false
    });

    // Compatibility references
    this.anchor = null;
    this.contentAnchor = null;

    this.clock = new THREE.Clock();
    this.hasTrackedOnce = false;
    this.isRunning = false;
    this.primaryActiveIndex = -1;
  }

  async initialize() {
    let MindARThreeClass = window.MINDAR?.IMAGE?.MindARThree;
    if (!MindARThreeClass) {
      try {
        const mod = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js');
        MindARThreeClass = mod.MindARThree || window.MINDAR?.IMAGE?.MindARThree;
      } catch (err) {
        console.warn('Importing mindar-image-three with vite-ignore...', err);
      }
    }

    if (!MindARThreeClass) {
      throw new Error('MindAR Three.js library could not be loaded.');
    }

    // Initialize MindAR Three instance
    this.mindarThree = new MindARThreeClass({
      container: this.container,
      imageTargetSrc: this.imageTargetSrc,
      filterMinCF: 0.00001, // Low internal filter; our OneEuro handles fine adaptive smoothing
      filterBeta: 0.0001,
      warmupTolerance: this.calibration.warmupTolerance || 2,
      missTolerance: 12, // Let our TrackingCoordinator manage debouncing and predicting
      uiLoading: 'no',
      uiScanning: 'no'
    });

    const { scene, camera, renderer } = this.mindarThree;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // Enhance WebGL rendering for mobile displays
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Add ambient & directional lights for 3D elements
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.2);
    dirLight.position.set(0, 1, 2);
    this.scene.add(dirLight);

    // Create an anchor and content anchor for each configured target
    this.targetItems = [];
    this.activeTrackingIndices.clear();

    for (let i = 0; i < this.targets.length; i++) {
      const targetDef = this.targets[i];
      const anchor = this.mindarThree.addAnchor(i);
      const aspect = targetDef.aspectRatio || (targetDef.originalWidth && targetDef.originalHeight ? targetDef.originalWidth / targetDef.originalHeight : 941 / 1672);
      const height = 1.0 / aspect;

      const contentAnchor = new ContentAnchor({
        targetWidth: 1.0,
        targetHeight: height,
        videoSrc: targetDef.videoSrc || targetDef.video,
        fallbacks: targetDef.fallbackVideos || [],
        calibration: this.calibration
      });

      // Attach directly to scene so MindAR's internal zero-matrix does not collapse our visual anchor
      this.scene.add(contentAnchor.rootGroup);

      this.targetItems.push({
        index: i,
        def: targetDef,
        anchor,
        contentAnchor,
        lastState: 'LOST'
      });
    }

    // Default reference for backward compatibility
    if (this.targetItems[0]) {
      this.anchor = this.targetItems[0].anchor;
      this.contentAnchor = this.targetItems[0].contentAnchor;
    }

    // Hook MindAR controller tracker for telemetry extraction
    this.hookTrackerTelemetry();
  }

  hookTrackerTelemetry() {
    if (!this.mindarThree || !this.mindarThree.controller) return;
    const controller = this.mindarThree.controller;

    // Intercept controller.tracker.track if present
    if (controller.tracker && typeof controller.tracker.track === 'function') {
      const originalTrack = controller.tracker.track.bind(controller.tracker);
      controller.tracker.track = (inputImage, targetIndex) => {
        const result = originalTrack(inputImage, targetIndex);
        if (result && result.worldCoords) {
          const inlierCount = result.worldCoords.length / 3;
          const points = [];
          if (result.screenCoords) {
            for (let p = 0; p < result.screenCoords.length; p += 2) {
              points.push({
                x: result.screenCoords[p],
                y: result.screenCoords[p + 1],
                cx: 0.5,
                cy: 0.5
              });
            }
          }
          this.lastTrackerResults[targetIndex] = {
            inliers: inlierCount,
            points,
            timestamp: performance.now()
          };
        }
        return result;
      };
    }
  }

  async start() {
    if (this.isRunning) return;
    await this.mindarThree.start();
    this.isRunning = true;

    // Retry hooking tracker if controller was initialized asynchronously during start
    this.hookTrackerTelemetry();

    // Ensure full-screen aspect fill calculation on mobile devices
    const handleResize = () => {
      if (this.mindarThree) {
        this.mindarThree.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleResize, 150);
      setTimeout(handleResize, 500);
    });

    const video = this.mindarThree.video;
    if (video) {
      video.addEventListener('loadedmetadata', handleResize);
      video.addEventListener('playing', handleResize);
      setTimeout(handleResize, 200);
      setTimeout(handleResize, 600);
      setTimeout(handleResize, 1200);
    }

    // Start enhanced render loop with TrackingCoordinator
    this.renderer.setAnimationLoop(() => {
      const delta = this.clock.getDelta();
      const time = this.clock.getElapsedTime();
      const nowMs = performance.now();

      for (let i = 0; i < this.targetItems.length; i++) {
        const item = this.targetItems[i];
        const mindarAnchor = item.anchor;
        const group = mindarAnchor.group;

        // Check if MindAR has a valid non-zero tracking matrix this frame
        let isVisuallyTracked = false;
        let rawMatrix = null;

        if (group && group.visible && group.matrix && group.matrix.elements[15] !== 0) {
          // MindAR's invisibleMatrix sets elements[0..15] = 0
          // If elements[15] is non-zero, MindAR produced a valid pose
          isVisuallyTracked = true;
          rawMatrix = group.matrix;
        }

        // Retrieve tracker telemetry
        const trackerTelemetry = this.lastTrackerResults[i] || {};
        const isTelemetryFresh = trackerTelemetry.timestamp && (nowMs - trackerTelemetry.timestamp < 100);

        const telemetry = {
          isTracking: isVisuallyTracked,
          inliers: isTelemetryFresh ? trackerTelemetry.inliers : (isVisuallyTracked ? 18 : 0),
          points: isTelemetryFresh ? trackerTelemetry.points : []
        };

        // Run TrackingCoordinator 5-tier state machine & filter
        const result = this.trackingCoordinator.processFrame(i, isVisuallyTracked ? rawMatrix : null, telemetry, delta, nowMs);

        // Update ContentAnchor 3D pose
        item.contentAnchor.setPose(result.position, result.quaternion, result.scale);
        item.contentAnchor.updateTrackingState(result.state, result.confidence);
        item.contentAnchor.update(time, delta);

        // Notify state transitions
        if (result.state !== item.lastState) {
          item.lastState = result.state;
          this.handleStateChange(item, result.state, result.stats);
        }

        // Telemetry update callback for Debug HUD
        if (this.onTelemetryUpdate && (result.state !== 'LOST' || i === 0)) {
          this.onTelemetryUpdate(item.def, result.stats, result.confidence);
        }
      }

      this.renderer.render(this.scene, this.camera);
    });
  }

  handleStateChange(item, newState, stats) {
    const i = item.index;

    if (newState === 'LOCKED' || newState === 'GOOD' || newState === 'DEGRADED') {
      this.activeTrackingIndices.add(i);

      // Mutual exclusion: pause any other active target's video to prevent audio clash
      if (this.primaryActiveIndex !== i) {
        this.primaryActiveIndex = i;
        this.targetItems.forEach((otherItem, otherIdx) => {
          if (otherIdx !== i) {
            otherItem.contentAnchor.videoPlane.pause();
          }
        });
      }

      if (this.onTrackingStateChange) {
        this.onTrackingStateChange('tracking', item.def, stats);
      }

      if (!this.hasTrackedOnce) {
        this.hasTrackedOnce = true;
        if (this.onFirstTrack) {
          this.onFirstTrack(item.def);
        }
      }
    } else if (newState === 'PREDICTING') {
      // In predicting state, maintain current tracking status and prompt silence
      if (this.onTrackingStateChange) {
        this.onTrackingStateChange('predicting', item.def, stats);
      }
    } else if (newState === 'LOST') {
      this.activeTrackingIndices.delete(i);
      if (this.primaryActiveIndex === i) {
        this.primaryActiveIndex = -1;
      }

      if (this.activeTrackingIndices.size === 0 && this.onTrackingStateChange) {
        this.onTrackingStateChange('lost', item.def, stats);
      }
    }
  }

  stop() {
    if (!this.isRunning) return;
    this.mindarThree.stop();
    this.renderer.setAnimationLoop(null);
    this.isRunning = false;
    this.trackingCoordinator.reset();
  }

  recenter() {
    this.targetItems.forEach((item) => {
      if (item.contentAnchor) {
        item.contentAnchor.videoPlane.restart();
      }
    });
    this.trackingCoordinator.reset();
  }

  applyCalibration(calibration) {
    this.calibration = { ...this.calibration, ...calibration };

    this.targetItems.forEach((item) => {
      item.contentAnchor.applyCalibration(this.calibration);
    });

    this.trackingCoordinator.updateConfig({
      minInliers: this.calibration.minInliers,
      idealInliers: this.calibration.idealInliers,
      confidenceThreshold: Math.round((this.calibration.confidenceThreshold || 0.6) * 100),
      predictionDuration: this.calibration.predictionDuration,
      lostTargetTimeout: this.calibration.lostTargetTimeout,
      recoveryBlendDuration: this.calibration.recoveryBlendDuration,
      filterMinCF: this.calibration.filterMinCF,
      filterBeta: this.calibration.filterBeta,
      enableDeviceMotion: this.calibration.enableDeviceMotion !== false
    });
  }

  setAudioMuted(muted) {
    this.targetItems.forEach((item) => {
      item.contentAnchor.setAudioMuted(muted);
    });
  }

  setVisualBoundsVisible(visible) {
    this.targetItems.forEach((item) => {
      item.contentAnchor.setVisualBoundsVisible(visible);
    });
  }
}
