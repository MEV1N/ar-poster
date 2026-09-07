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

    // Multi-target items array
    this.targetItems = [];
    this.activeTrackingIndices = new Set();

    // Initialize Tracking Coordinator
    this.trackingCoordinator = new TrackingCoordinator({
      minInliers: this.calibration.minInliers || 6,
      idealInliers: this.calibration.idealInliers || 24,
      confidenceThreshold: Math.round((this.calibration.confidenceThreshold || 0.55) * 100),
      predictionDuration: this.calibration.predictionDuration || 800,
      lostTargetTimeout: this.calibration.lostTargetTimeout || 1200,
      recoveryBlendDuration: this.calibration.recoveryBlendDuration || 250,
      filterBeta: this.calibration.filterBeta || 80.0,
      enableDeviceMotion: this.calibration.enableDeviceMotion !== false,
      enableMotionFusion: this.calibration.enableMotionFusion !== false,
      maxPoseCorrection: this.calibration.maxPoseCorrection || 0.8,
      maxAngleCorrection: this.calibration.maxAngleCorrection || 1.05
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
      filterMinCF: this.calibration.filterMinCF || 0.0001,
      filterBeta: this.calibration.filterBeta || 0.001,
      warmupTolerance: this.calibration.warmupTolerance || 2,
      missTolerance: this.calibration.missTolerance || 8,
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

      // Attach contentAnchor directly to anchor.group so Three.js coordinates match physical poster perfectly
      anchor.group.add(contentAnchor.rootGroup);

      // Tracking state callbacks for target i
      anchor.onTargetFound = () => {
        // Mutual exclusion: pause any other active target's video to prevent audio clash
        if (this.primaryActiveIndex !== i) {
          this.primaryActiveIndex = i;
          this.targetItems.forEach((otherItem, otherIdx) => {
            if (otherIdx !== i) {
              otherItem.contentAnchor.videoPlane.pause();
            }
          });
        }

        contentAnchor.onTargetFound();
        this.activeTrackingIndices.add(i);

        if (this.onTrackingStateChange) {
          this.onTrackingStateChange('tracking', targetDef);
        }

        if (!this.hasTrackedOnce) {
          this.hasTrackedOnce = true;
          if (this.onFirstTrack) {
            this.onFirstTrack(targetDef);
          }
        }
      };

      anchor.onTargetLost = () => {
        contentAnchor.onTargetLost(() => {
          this.activeTrackingIndices.delete(i);
          if (this.primaryActiveIndex === i) {
            this.primaryActiveIndex = -1;
          }
          if (this.activeTrackingIndices.size === 0 && this.onTrackingStateChange) {
            this.onTrackingStateChange('lost', targetDef);
          }
        });
      };

      this.targetItems.push({
        index: i,
        def: targetDef,
        anchor,
        contentAnchor,
        lastValidMatrix: new THREE.Matrix4(),
        lastSeenTime: 0,
        lastState: 'LOST'
      });
    }

    // Default reference for backward compatibility
    if (this.targetItems[0]) {
      this.anchor = this.targetItems[0].anchor;
      this.contentAnchor = this.targetItems[0].contentAnchor;
    }
  }

  async start() {
    if (this.isRunning) return;

    // Request motion sensor permission (iOS 13+ / Web gesture)
    if (this.trackingCoordinator?.motionFusion) {
      this.trackingCoordinator.motionFusion.requestPermission().catch(() => {});
    }

    await this.mindarThree.start();
    this.isRunning = true;

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

    // Start render loop with TrackingCoordinator & occlusion hold
    this.renderer.setAnimationLoop(() => {
      const delta = this.clock.getDelta();
      const time = this.clock.getElapsedTime();
      const nowMs = performance.now();

      for (let i = 0; i < this.targetItems.length; i++) {
        const item = this.targetItems[i];
        const group = item.anchor.group;
        const targetDef = item.def;

        // Check if MindAR actively tracks this frame
        // (MindAR's inactive invisibleMatrix has elements[0, 5, 10] = 0)
        const isVisuallyTracked = group.visible && group.matrix && (
          group.matrix.elements[0] !== 0 ||
          group.matrix.elements[5] !== 0 ||
          group.matrix.elements[10] !== 0
        );

        if (isVisuallyTracked) {
          item.lastValidMatrix.copy(group.matrix);
          item.lastSeenTime = nowMs;
        }

        // Process frame with pose fusion through TrackingCoordinator
        const telemetry = {
          isTracking: isVisuallyTracked,
          inliers: isVisuallyTracked ? 24 : 0
        };

        const result = this.trackingCoordinator.processFrame(
          i,
          isVisuallyTracked ? group.matrix : null,
          telemetry,
          delta,
          nowMs
        );

        if (isVisuallyTracked) {
          // Apply fused matrix (includes smooth reacquisition blend)
          group.matrix.copy(result.fusedMatrix);
          group.matrixWorldNeedsUpdate = true;
        } else if (result.isHoldingPose && item.contentAnchor.isTracking) {
          // OCCLUSION RESISTANCE: Keep anchor.group visible and apply motion-fused predicted matrix
          group.visible = true;
          group.matrix.copy(result.fusedMatrix);
          group.matrixWorldNeedsUpdate = true;
        }

        // Update content anchor (handles video and animations)
        item.contentAnchor.update(time, delta);

        // State change notification
        if (result.state !== item.lastState) {
          item.lastState = result.state;
          if (result.state === 'PREDICTING' && this.onTrackingStateChange) {
            this.onTrackingStateChange('predicting', targetDef, result.stats);
          }
        }

        // Telemetry update callback for Debug HUD
        if (this.onTelemetryUpdate && (result.state !== 'LOST' || i === 0)) {
          this.onTelemetryUpdate(targetDef, result.stats, result.confidence);
        }
      }

      this.renderer.render(this.scene, this.camera);
    });
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
      confidenceThreshold: Math.round((this.calibration.confidenceThreshold || 0.55) * 100),
      predictionDuration: this.calibration.predictionDuration,
      lostTargetTimeout: this.calibration.lostTargetTimeout,
      recoveryBlendDuration: this.calibration.recoveryBlendDuration,
      filterBeta: this.calibration.filterBeta,
      enableDeviceMotion: this.calibration.enableDeviceMotion !== false,
      enableMotionFusion: this.calibration.enableMotionFusion !== false,
      maxPoseCorrection: this.calibration.maxPoseCorrection || 0.8,
      maxAngleCorrection: this.calibration.maxAngleCorrection || 1.05
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
