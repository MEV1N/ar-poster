/**
 * Loading & Camera Permission Component
 * Guides the user through camera access with clear prompts and instructions.
 */

export class LoadingScreen {
  constructor({ onStart }) {
    this.onStart = onStart;
    this.container = null;
    this.createDOM();
  }

  createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'loadingScreen';
    this.container.innerHTML = `
      <div class="ls-backdrop"></div>
      <div class="ls-modal">
        <div class="ls-logo-badge">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>

        <h2 class="ls-title">CYBERPUNK 2088 EXPO</h2>
        <p class="ls-tagline">Interactive WebAR Poster Experience</p>

        <div class="ls-instruction-card">
          <div class="ls-radar-icon">
            <div class="ls-radar-ring"></div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div class="ls-inst-text">
            <strong>Point your camera at the event poster.</strong>
            <span>Watch the physical poster come alive with holographic video and audio animations.</span>
          </div>
        </div>

        <div class="ls-status" id="lsStatus">
          <div class="ls-spinner"></div>
          <span>Ready to initialize camera...</span>
        </div>

        <button class="ls-start-btn" id="lsStartBtn">
          <span>ENTER AR EXPERIENCE</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 13h11.86l-5.43 5.43 1.42 1.42L21.14 12l-8.29-8.29-1.42 1.42L16.86 11H5v2z"/>
          </svg>
        </button>

        <div class="ls-privacy-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          <span>Camera feed is processed 100% locally on your device for image tracking. No video is recorded or stored.</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    const startBtn = this.container.querySelector('#lsStartBtn');
    startBtn.addEventListener('click', () => {
      this.updateStatus('Requesting camera permission...', true);
      startBtn.disabled = true;
      if (this.onStart) {
        this.onStart();
      }
    });
  }

  updateStatus(message, showSpinner = true) {
    const statusEl = this.container.querySelector('#lsStatus');
    if (statusEl) {
      statusEl.innerHTML = `
        ${showSpinner ? '<div class="ls-spinner"></div>' : ''}
        <span>${message}</span>
      `;
    }
  }

  showError(message) {
    const statusEl = this.container.querySelector('#lsStatus');
    const startBtn = this.container.querySelector('#lsStartBtn');
    if (statusEl) {
      statusEl.className = 'ls-status ls-status-error';
      statusEl.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff4d4f"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        <span>${message}</span>
      `;
    }
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.querySelector('span').textContent = 'RETRY CAMERA ACCESS';
    }
  }

  hide() {
    this.container.classList.add('ls-fade-out');
    setTimeout(() => {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    }, 450);
  }
}
