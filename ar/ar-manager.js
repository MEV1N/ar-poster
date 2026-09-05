import * as THREE from 'three';
import { ContentAnchor } from './content-anchor.js';

/**
 * Core WebAR Image Tracking Manager
 * Bridges MindAR with Three.js rendering and coordinates tracking lifecycle.
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
    onFirstTrack
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
    this.calibration = calibration;
    this.onTrackingStateChange = onTrackingStateChange;
    this.onFirstTrack = onFirstTrack;

    this.mindarThree = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Multi-target items array: { index, def, anchor, contentAnchor }
    this.targetItems = [];
    this.activeTrackingIndices = new Set();

    // Compatibility references
    this.anchor = null;
    this.contentAnchor = null;

    this.clock = new THREE.Clock();
    this.hasTrackedOnce = false;
    this.isRunning = false;
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

    // Initialize MindAR Three instance with universal tracking optimizations
    this.mindarThree = new MindARThreeClass({
      container: this.container,
      imageTargetSrc: this.imageTargetSrc,
      filterMinCF: this.calibration.filterMinCF || 0.0001,
      filterBeta: this.calibration.filterBeta || 0.001,
      warmupTolerance: this.calibration.warmupTolerance || 3,
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

      anchor.group.add(contentAnchor.rootGroup);

      // Tracking state callbacks for target i
      anchor.onTargetFound = () => {
        // Pause other active videos so sound/video does not overlap
        this.targetItems.forEach((item, idx) => {
          if (idx !== i) {
            item.contentAnchor.videoPlane.pause();
          }
        });

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
          if (this.activeTrackingIndices.size === 0 && this.onTrackingStateChange) {
            this.onTrackingStateChange('lost');
          }
        });
      };

      this.targetItems.push({
        index: i,
        def: targetDef,
        anchor,
        contentAnchor
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

    // Start render loop
    this.renderer.setAnimationLoop(() => {
      const delta = this.clock.getDelta();
      const time = this.clock.getElapsedTime();

      for (const item of this.targetItems) {
        item.contentAnchor.update(time, delta);
      }

      this.renderer.render(this.scene, this.camera);
    });
  }

  stop() {
    if (!this.isRunning) return;
    this.mindarThree.stop();
    this.renderer.setAnimationLoop(null);
    this.isRunning = false;
  }

  recenter() {
    // Smoothly recenter all targets
    this.targetItems.forEach((item) => {
      if (item.anchor && item.anchor.group) {
        item.anchor.group.matrixAutoUpdate = true;
      }
      if (item.contentAnchor) {
        item.contentAnchor.videoPlane.restart();
      }
    });
  }

  applyCalibration(calibration) {
    this.calibration = calibration;
    this.targetItems.forEach((item) => {
      item.contentAnchor.applyCalibration(calibration);
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
