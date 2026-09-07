import './main.css';
import { APP_CONFIG, getSavedCalibration } from './config/app-config.js';
import { ARManager } from './ar/ar-manager.js';

class SimpleWebARApp {
  constructor() {
    this.arContainer = document.getElementById('arContainer');
    this.arManager = null;
    this.debugHUD = null;
    this.promptEl = null;
    this.startOverlay = null;
    this.isMuted = true;
    this.isTracking = false;

    this.init();
  }

  async init() {
    this.createUI();

    // Dev HUD is completely hidden from public view.
    // Only loaded if explicitly requested via URL parameter (?debug=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === 'true') {
      const { DebugHUD } = await import('./components/debug-hud.js');
      this.debugHUD = new DebugHUD();
      this.debugHUD.show();
    }

    await this.initAR();
  }

  createUI() {
    // Minimalist Guidance Text
    const overlay = document.createElement('div');
    overlay.className = 'prompt-overlay';
    overlay.innerHTML = `
      <div class="prompt-badge" id="promptBadge">Point the camera to the poster</div>
    `;
    document.body.appendChild(overlay);
    this.promptEl = overlay.querySelector('#promptBadge');

    // Start Overlay for Mobile Browsers Requiring Initial Tap
    this.startOverlay = document.createElement('div');
    this.startOverlay.className = 'start-overlay';
    this.startOverlay.innerHTML = `
      <div class="start-text">Tap to Start Camera</div>
    `;
    document.body.appendChild(this.startOverlay);

    this.startOverlay.addEventListener('click', () => {
      this.startOverlay.classList.add('hidden');
      this.startCamera();
    });

    // Tap anywhere on screen to unmute / toggle audio and request motion sensor permission
    window.addEventListener('click', (e) => {
      // Ignore clicks on debug HUD if active
      if (e.target.closest('#debugHUD')) {
        return;
      }

      if (this.arManager?.trackingCoordinator?.motionFusion) {
        this.arManager.trackingCoordinator.motionFusion.requestPermission().catch(() => {});
      }

      // Audio toggle
      if (this.arManager) {
        this.isMuted = !this.isMuted;
        this.arManager.setAudioMuted(this.isMuted);
      }
    });

    // Auto-attempt start
    setTimeout(() => {
      this.startCamera();
    }, 200);
  }

  async initAR() {
    try {
      const calibration = getSavedCalibration();

      this.arManager = new ARManager({
        container: this.arContainer,
        imageTargetSrc: APP_CONFIG.mindSrc || './targets/targets.mind',
        targets: APP_CONFIG.targets || [APP_CONFIG.target],
        calibration,
        onTrackingStateChange: (state) => {
          if (state === 'tracking') {
            this.isTracking = true;
            if (this.promptEl) this.promptEl.classList.add('hidden');
          } else if (state === 'predicting') {
            // Keep prompt hidden during temporary occlusion hold
            if (this.promptEl) this.promptEl.classList.add('hidden');
          } else if (state === 'lost') {
            this.isTracking = false;
            if (this.promptEl) this.promptEl.classList.remove('hidden');
          }
        },
        onFirstTrack: () => {
          if (this.arManager) {
            this.arManager.setAudioMuted(false);
            this.isMuted = false;
          }
        },
        onTelemetryUpdate: (targetDef, stats, confidence) => {
          if (this.debugHUD) {
            this.debugHUD.updateTelemetry(targetDef, stats, confidence);
          }
        }
      });

      await this.arManager.initialize();
    } catch (err) {
      console.warn('AR initialize notice:', err);
    }
  }

  async startCamera() {
    if (!this.arManager) return;
    try {
      await this.arManager.start();
      if (this.startOverlay) {
        this.startOverlay.classList.add('hidden');
      }
      if (this.promptEl) {
        this.promptEl.classList.remove('hidden');
      }
    } catch (err) {
      console.warn('Camera auto-start notice (user tap required):', err.message);
      if (this.startOverlay) {
        this.startOverlay.classList.remove('hidden');
      }
    }
  }
}

// Bootstrap on DOM loaded
window.addEventListener('DOMContentLoaded', () => {
  new SimpleWebARApp();
});
