import './main.css';
import { APP_CONFIG, getSavedCalibration } from './config/app-config.js';
import { ARManager } from './ar/ar-manager.js';
import { CalibrationManager } from './calibration/calibration-manager.js';
import { CalibrationPanel } from './calibration/calibration-panel.js';
import { DebugHUD } from './components/debug-hud.js';

class SimpleWebARApp {
  constructor() {
    this.arContainer = document.getElementById('arContainer');
    this.arManager = null;
    this.calibrationManager = null;
    this.calibrationPanel = null;
    this.debugHUD = null;
    this.promptEl = null;
    this.startOverlay = null;
    this.adminBtn = null;
    this.isMuted = true;
    this.isTracking = false;
    this.isAdminOpen = false;

    // Triple tap tracking
    this.tapCount = 0;
    this.tapTimer = null;

    this.init();
  }

  async init() {
    // 1. Initialize Calibration Store
    this.calibrationManager = new CalibrationManager((updatedCalib) => {
      if (this.arManager) {
        this.arManager.applyCalibration(updatedCalib);
      }
    });

    // 2. Initialize Developer Debug HUD
    this.debugHUD = new DebugHUD({
      onOpenCalibration: () => this.toggleAdmin(true)
    });

    // 3. Initialize Calibration Panel (Admin Studio)
    this.calibrationPanel = new CalibrationPanel({
      manager: this.calibrationManager,
      onClose: () => {
        this.toggleAdmin(false);
      },
      onToggleDebugHUD: (visible) => {
        if (visible) this.debugHUD.show();
        else this.debugHUD.hide();
      }
    });

    this.createUI();
    await this.initAR();

    // Check URL parameters for admin or debug modes
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;

    if (params.has('admin') || params.get('mode') === 'calibration' || hash === '#admin') {
      this.toggleAdmin(true);
    }

    const initialCalib = this.calibrationManager.get();
    if (params.has('debug') || hash === '#debug' || initialCalib.showDebugHUD) {
      this.debugHUD.show();
    }
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

    // Admin Gear Button in top-right corner
    this.adminBtn = document.createElement('button');
    this.adminBtn.className = 'admin-gear-btn';
    this.adminBtn.id = 'adminGearBtn';
    this.adminBtn.title = 'Admin Calibration Studio';
    this.adminBtn.setAttribute('aria-label', 'Admin Calibration');
    this.adminBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
    `;
    document.body.appendChild(this.adminBtn);

    this.adminBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAdmin(!this.isAdminOpen);
    });

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

    // Tap anywhere on screen to unmute / toggle audio
    window.addEventListener('click', (e) => {
      // Ignore clicks inside admin panel, HUD, or on admin button
      if (e.target.closest('#calibrationPanel') || e.target.closest('#adminGearBtn') || e.target.closest('#debugHUD')) {
        return;
      }

      // Triple-tap detection to toggle admin panel
      this.tapCount++;
      clearTimeout(this.tapTimer);
      this.tapTimer = setTimeout(() => {
        if (this.tapCount >= 3) {
          this.toggleAdmin(!this.isAdminOpen);
        }
        this.tapCount = 0;
      }, 350);

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

  toggleAdmin(open) {
    this.isAdminOpen = open;
    if (open) {
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

  async initAR() {
    try {
      const initialCalib = this.calibrationManager.get();

      this.arManager = new ARManager({
        container: this.arContainer,
        imageTargetSrc: APP_CONFIG.mindSrc || './targets/targets.mind',
        targets: APP_CONFIG.targets || [APP_CONFIG.target],
        calibration: initialCalib,
        onTrackingStateChange: (state, activeTarget, stats) => {
          if (state === 'tracking') {
            this.isTracking = true;
            if (this.promptEl) this.promptEl.classList.add('hidden');
          } else if (state === 'predicting') {
            // Keep prompt hidden during temporary occlusion / predictive hold
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
