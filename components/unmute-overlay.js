/**
 * Unmute Audio Overlay Component
 * Handles mobile browser autoplay policies with an intuitive one-tap unmute prompt.
 */

export class UnmuteOverlay {
  constructor({ onUnmute }) {
    this.onUnmute = onUnmute;
    this.container = null;
    this.isVisible = false;
    this.createDOM();
  }

  createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'unmuteOverlay';
    this.container.className = 'unmute-toast';
    this.container.innerHTML = `
      <div class="unmute-toast-pill">
        <div class="unmute-speaker-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </div>
        <span>Tap to Unmute Audio</span>
      </div>
    `;

    this.container.addEventListener('click', () => {
      this.hide();
      if (this.onUnmute) {
        this.onUnmute();
      }
    });

    document.body.appendChild(this.container);
  }

  show() {
    if (this.isVisible) return;
    this.isVisible = true;
    this.container.classList.add('visible');
  }

  hide() {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.container.classList.remove('visible');
  }
}
