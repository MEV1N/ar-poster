/**
 * Fallback View Component
 * Displayed when WebGL, WebRTC, or camera permissions are unsupported on the device.
 */

export class FallbackView {
  static checkSupport() {
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasWebGL = (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch (e) {
        return false;
      }
    })();
    const isHttpsOrLocal = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    return {
      supported: hasMediaDevices && hasWebGL,
      hasMediaDevices,
      hasWebGL,
      isHttpsOrLocal
    };
  }

  constructor({ reason = 'Camera or WebGL is not supported on this browser.' }) {
    this.reason = reason;
    this.container = null;
    this.createDOM();
  }

  createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'fallbackView';
    this.container.className = 'fallback-container';
    this.container.innerHTML = `
      <div class="fb-card">
        <div class="fb-header">
          <div class="fb-badge">EVENT PREVIEW MODE</div>
          <h1>CYBERPUNK 2088 EXPO</h1>
          <p class="fb-subtitle">Tokyo Dome • November 14-16, 2026</p>
        </div>

        <div class="fb-notice">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffaa00">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
          </svg>
          <div>
            <strong>WebAR Camera Unavailable</strong>
            <p>${this.reason}</p>
          </div>
        </div>

        <!-- Event Promo Video Player -->
        <div class="fb-media-frame">
          <video controls autoplay muted playsinline loop poster="assets/event-poster.jpg" src="videos/event-promo.mp4" class="fb-video">
            Your browser does not support HTML5 video.
          </video>
        </div>

        <!-- Poster & Event Details -->
        <div class="fb-details">
          <div class="fb-poster-thumb">
            <img src="assets/event-poster.jpg" alt="CYBERPUNK 2088 EXPO Poster">
          </div>
          <div class="fb-info">
            <h3>Augmented Reality Highlights</h3>
            <ul>
              <li>• Real-Time Spatial Audio Stage Visuals</li>
              <li>• Cybernetic Art & Generative AI Installations</li>
              <li>• Holographic Keynotes & Future Tech Expo</li>
            </ul>
            <a href="poster.html" target="_blank" class="fb-link-btn">
              View High-Res Target Poster
            </a>
          </div>
        </div>

        <div class="fb-footer">
          <p>To experience the full Augmented Reality poster scan, please open this link in <strong>Safari (iOS 14+)</strong> or <strong>Chrome (Android)</strong> with camera permissions allowed over <strong>HTTPS</strong>.</p>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);
  }
}
