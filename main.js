import './main.css';
import { APP_CONFIG } from './config/app-config.js';
import { ARManager } from './ar/ar-manager.js';

class SimpleWebARApp {
  constructor() {
    this.arContainer = document.getElementById('arContainer');
    this.arManager = null;
    this.promptEl = null;
    this.startOverlay = null;
    this.isMuted = true;
    this.isTracking = false;

    this.createUI();
    this.initAR();
  }

  createUI() {
    // 1. Single minimal text overlay: "Point the camera to the poster"
    const overlay = document.createElement('div');
    overlay.className = 'prompt-overlay';
    overlay.innerHTML = `
      <div class="prompt-badge" id="promptBadge">Point the camera to the poster</div>
    `;
    document.body.appendChild(overlay);
    this.promptEl = overlay.querySelector('#promptBadge');

    // 2. Start overlay for mobile browsers that require user gesture for camera
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
    window.addEventListener('click', () => {
      if (this.arManager) {
        this.isMuted = !this.isMuted;
        this.arManager.setAudioMuted(this.isMuted);
      }
    });

    // Auto-attempt start immediately (works on desktop and browsers without strict gesture locks)
    setTimeout(() => {
      this.startCamera();
    }, 200);
  }

  async initAR() {
    try {
      this.arManager = new ARManager({
        container: this.arContainer,
        imageTargetSrc: APP_CONFIG.target.mindSrc,
        targetWidth: 1.0,
        targetHeight: 1.0 / APP_CONFIG.target.aspectRatio,
        videoSrc: APP_CONFIG.video.src,
        calibration: APP_CONFIG.defaultCalibration,
        onTrackingStateChange: (state) => {
          if (state === 'tracking') {
            this.isTracking = true;
            if (this.promptEl) this.promptEl.classList.add('hidden');
          } else if (state === 'lost') {
            this.isTracking = false;
            if (this.promptEl) this.promptEl.classList.remove('hidden');
          }
        },
        onFirstTrack: () => {
          // Play with audio on first track
          if (this.arManager) {
            this.arManager.setAudioMuted(false);
            this.isMuted = false;
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
