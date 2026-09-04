/**
 * Public AR Tracking HUD Component
 * Displays mobile-friendly guidance states, recenter button, and developer mode toggle.
 */

export class TrackingHUD {
  constructor({ onRecenter, onToggleMode, onToggleAudio }) {
    this.onRecenter = onRecenter;
    this.onToggleMode = onToggleMode;
    this.onToggleAudio = onToggleAudio;

    this.state = 'initial'; // 'initial' | 'searching' | 'tracking' | 'lost'
    this.isMuted = true;
    this.isCalibrationMode = false;
    this.container = null;

    this.createDOM();
  }

  createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'trackingHUD';
    this.container.className = 'hud-container state-initial';
    this.container.innerHTML = `
      <!-- Top Navigation & Status Bar -->
      <header class="hud-header">
        <div class="hud-brand-pill">
          <span class="hud-brand-dot"></span>
          <span class="hud-brand-title">CYBERPUNK 2088</span>
        </div>

        <div class="hud-actions">
          <!-- Audio Toggle Button -->
          <button class="hud-icon-btn hud-audio-btn is-muted" id="hudAudioBtn" aria-label="Toggle Sound" title="Toggle Sound">
            <svg class="icon-muted" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
            <svg class="icon-unmuted" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </svg>
          </button>

          <!-- Mode Switcher Toggle: Normal | Calibration -->
          <div class="hud-mode-toggle" id="hudModeToggle">
            <button class="hud-mode-pill active" id="btnModeNormal">Normal</button>
            <button class="hud-mode-pill" id="btnModeCalibrate">Calibrate</button>
          </div>
        </div>
      </header>

      <!-- Center Dynamic Status Banner -->
      <div class="hud-status-banner" id="hudStatusBanner">
        <div class="hud-status-icon"></div>
        <div class="hud-status-content">
          <div class="hud-status-title" id="hudStatusTitle">Scan complete</div>
          <div class="hud-status-sub" id="hudStatusSub">Point your camera at the poster</div>
        </div>
      </div>

      <!-- Center Optical Guidance Reticle -->
      <div class="hud-reticle" id="hudReticle">
        <div class="hud-corner top-left"></div>
        <div class="hud-corner top-right"></div>
        <div class="hud-corner bottom-left"></div>
        <div class="hud-corner bottom-right"></div>
        <div class="hud-reticle-scanner"></div>
        <div class="hud-reticle-crosshair"></div>
      </div>

      <!-- Bottom Floating Controls -->
      <footer class="hud-footer">
        <div class="hud-footer-left">
          <a href="poster.html" target="_blank" class="hud-text-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
            </svg>
            <span>Target Poster</span>
          </a>
        </div>

        <!-- Recenter Button -->
        <button class="hud-recenter-btn" id="hudRecenterBtn" aria-label="Recenter AR tracking">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
          </svg>
          <span>Recenter</span>
        </button>
      </footer>
    `;

    document.body.appendChild(this.container);

    // Event Bindings
    const audioBtn = this.container.querySelector('#hudAudioBtn');
    audioBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      this.updateAudioState(this.isMuted);
      if (this.onToggleAudio) {
        this.onToggleAudio(this.isMuted);
      }
    });

    const recenterBtn = this.container.querySelector('#hudRecenterBtn');
    recenterBtn.addEventListener('click', () => {
      // Haptic feedback if supported on mobile
      if (navigator.vibrate) navigator.vibrate(40);
      recenterBtn.classList.add('pulse');
      setTimeout(() => recenterBtn.classList.remove('pulse'), 300);
      if (this.onRecenter) {
        this.onRecenter();
      }
    });

    const btnNormal = this.container.querySelector('#btnModeNormal');
    const btnCalibrate = this.container.querySelector('#btnModeCalibrate');

    btnNormal.addEventListener('click', () => this.setMode(false));
    btnCalibrate.addEventListener('click', () => this.setMode(true));
  }

  setTrackingState(state) {
    if (this.state === state) return;
    this.state = state;

    this.container.classList.remove('state-initial', 'state-searching', 'state-tracking', 'state-lost');
    this.container.classList.add(`state-${state}`);

    const titleEl = this.container.querySelector('#hudStatusTitle');
    const subEl = this.container.querySelector('#hudStatusSub');

    switch (state) {
      case 'initial':
      case 'searching':
        titleEl.textContent = 'Scan complete';
        subEl.textContent = 'Point your camera at the poster';
        break;

      case 'tracking':
        titleEl.textContent = 'Poster Tracked';
        subEl.textContent = 'CYBERPUNK 2088 EXPO';
        break;

      case 'lost':
        titleEl.textContent = 'Poster not detected';
        subEl.textContent = 'Move your camera back toward the poster';
        break;
    }
  }

  updateAudioState(isMuted) {
    this.isMuted = isMuted;
    const btn = this.container.querySelector('#hudAudioBtn');
    if (btn) {
      if (isMuted) {
        btn.classList.add('is-muted');
      } else {
        btn.classList.remove('is-muted');
      }
    }
  }

  setMode(isCalibration) {
    this.isCalibrationMode = isCalibration;
    const btnNormal = this.container.querySelector('#btnModeNormal');
    const btnCalibrate = this.container.querySelector('#btnModeCalibrate');

    if (isCalibration) {
      btnNormal.classList.remove('active');
      btnCalibrate.classList.add('active');
    } else {
      btnNormal.classList.add('active');
      btnCalibrate.classList.remove('active');
    }

    if (this.onToggleMode) {
      this.onToggleMode(isCalibration);
    }
  }
}
