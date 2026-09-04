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
    targetWidth = 1.0,
    targetHeight = 1.34,
    videoSrc,
    calibration,
    onTrackingStateChange,
    onFirstTrack
  }) {
    this.container = container;
    this.imageTargetSrc = imageTargetSrc;
    this.targetWidth = targetWidth;
    this.targetHeight = targetHeight;
    this.videoSrc = videoSrc;
    this.calibration = calibration;
    this.onTrackingStateChange = onTrackingStateChange;
    this.onFirstTrack = onFirstTrack;

    this.mindarThree = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
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

    // Create Image Target Anchor (target 0 = event poster)
    this.anchor = this.mindarThree.addAnchor(0);

    // Create Content Anchor with AR video and holographic overlays
    this.contentAnchor = new ContentAnchor({
      targetWidth: this.targetWidth,
      targetHeight: this.targetHeight,
      videoSrc: this.videoSrc,
      calibration: this.calibration
    });

    this.anchor.group.add(this.contentAnchor.rootGroup);

    // Hook tracking callbacks
    this.anchor.onTargetFound = () => {
      this.contentAnchor.onTargetFound();
      if (this.onTrackingStateChange) {
        this.onTrackingStateChange('tracking');
      }
      if (!this.hasTrackedOnce) {
        this.hasTrackedOnce = true;
        if (this.onFirstTrack) {
          this.onFirstTrack();
        }
      }
    };

    this.anchor.onTargetLost = () => {
      this.contentAnchor.onTargetLost(() => {
        if (this.onTrackingStateChange) {
          this.onTrackingStateChange('lost');
        }
      });
    };
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

      if (this.contentAnchor) {
        this.contentAnchor.update(time, delta);
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
    // Smoothly recenter: re-evaluate anchor matrix and reset smoothing
    if (this.anchor && this.anchor.group) {
      this.anchor.group.matrixAutoUpdate = true;
    }
    if (this.contentAnchor) {
      this.contentAnchor.videoPlane.restart();
    }
  }

  applyCalibration(calibration) {
    this.calibration = calibration;
    if (this.contentAnchor) {
      this.contentAnchor.applyCalibration(calibration);
    }
  }

  setAudioMuted(muted) {
    if (this.contentAnchor) {
      this.contentAnchor.setAudioMuted(muted);
    }
  }

  setVisualBoundsVisible(visible) {
    if (this.contentAnchor) {
      this.contentAnchor.setVisualBoundsVisible(visible);
    }
  }
}
