import './main.css';
import { APP_CONFIG } from './config/app-config.js';
import { FallbackView } from './components/fallback-view.js';
import { LoadingScreen } from './components/loading-screen.js';
import { TrackingHUD } from './components/tracking-hud.js';
import { UnmuteOverlay } from './components/unmute-overlay.js';
import { CalibrationManager } from './calibration/calibration-manager.js';
import { CalibrationPanel } from './calibration/calibration-panel.js';
import { ARManager } from './ar/ar-manager.js';

class WebARApp {
  constructor() {
    this.arContainer = document.getElementById('arContainer');
    this.arManager = null;
    this.calibrationManager = null;
    this.calibrationPanel = null;
    this.hud = null;
    this.loadingScreen = null;
    this.unmuteOverlay = null;

    this.isCalibrationMode = false;
    this.isMuted = true;

    this.init();
  }

  async init() {
    // 1. Device and Browser Capability Check
    const support = FallbackView.checkSupport();
    if (!support.supported) {
      const reason = !support.hasMediaDevices
        ? 'Your browser does not provide Camera access (navigator.mediaDevices is unavailable).'
        : 'WebGL hardware acceleration is disabled or unsupported on this device.';
      new FallbackView({ reason });
      return;
    }

    // 2. Initialize Calibration State Store & Developer Panel
    this.calibrationManager = new CalibrationManager((updatedCalib) => {
      if (this.arManager) {
        this.arManager.applyCalibration(updatedCalib);
      }
    });

    this.calibrationPanel = new CalibrationPanel({
      manager: this.calibrationManager,
      onClose: () => {
        this.toggleMode(false);
      }
    });

    // Check if calibration mode is requested via URL: e.g. index.html?mode=calibration
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'calibration' || window.location.hash === '#calibrate') {
      this.isCalibrationMode = true;
    }

    // 3. Initialize Audio Unmute Toast
    this.unmuteOverlay = new UnmuteOverlay({
      onUnmute: () => {
        this.setAudioMuted(false);
      }
    });

    // 4. Initialize Public Tracking HUD
    this.hud = new TrackingHUD({
      onRecenter: () => {
        if (this.arManager) {
          this.arManager.recenter();
        }
      },
      onToggleMode: (isCalib) => {
        this.toggleMode(isCalib);
      },
      onToggleAudio: (muted) => {
        this.setAudioMuted(muted);
      }
    });

    // Apply URL mode to HUD and Panel
    if (this.isCalibrationMode) {
      this.hud.setMode(true);
      this.calibrationPanel.show();
      this.calibrationManager.update({ showVisualBounds: true });
    }

    // 5. Initialize Loading Screen
    this.loadingScreen = new LoadingScreen({
      onStart: () => {
        this.startAR();
      }
    });
  }

  async startAR() {
    try {
      this.loadingScreen.updateStatus('Configuring camera & neural tracker...', true);

      // Initialize Core AR Manager
      const initialCalib = this.calibrationManager.get();

      this.arManager = new ARManager({
        container: this.arContainer,
        imageTargetSrc: APP_CONFIG.target.mindSrc,
        targetWidth: 1.0,
        targetHeight: 1.0 / APP_CONFIG.target.aspectRatio,
        videoSrc: APP_CONFIG.video.src,
        calibration: initialCalib,
        onTrackingStateChange: (state) => {
          this.hud.setTrackingState(state);
        },
        onFirstTrack: () => {
          // If video is playing muted due to browser policy, display 1-tap unmute toast
          if (this.isMuted) {
            this.unmuteOverlay.show();
          }
        }
      });

      await this.arManager.initialize();

      this.loadingScreen.updateStatus('Starting camera stream...', true);
      await this.arManager.start();

      // Camera running successfully: dismiss loading screen
      this.loadingScreen.hide();
      this.hud.setTrackingState('searching');
    } catch (err) {
      console.error('AR initialization error:', err);
      let errorMsg = 'Failed to initialize camera or tracking.';
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        errorMsg = 'Camera permission denied. Please allow camera access in your browser address bar and reload.';
      } else if (err.message?.includes('MindAR') || err.message?.includes('target')) {
        errorMsg = `Target loading note: Please ensure target is compiled. ${err.message}`;
      }
      this.loadingScreen.showError(errorMsg);
    }
  }

  toggleMode(isCalibration) {
    this.isCalibrationMode = isCalibration;
    if (isCalibration) {
      this.calibrationPanel.show();
      this.calibrationManager.update({ showVisualBounds: true });
      if (this.arManager) {
        this.arManager.setVisualBoundsVisible(true);
      }
    } else {
      this.calibrationPanel.hide();
      this.calibrationManager.update({ showVisualBounds: false });
      if (this.arManager) {
        this.arManager.setVisualBoundsVisible(false);
      }
    }
  }

  setAudioMuted(muted) {
    this.isMuted = muted;
    this.hud.updateAudioState(muted);
    if (this.arManager) {
      this.arManager.setAudioMuted(muted);
    }
    if (!muted) {
      this.unmuteOverlay.hide();
    }
  }
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new WebARApp();
});
