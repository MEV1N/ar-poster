import './debug-hud.css';

/**
 * Developer Tracking Debug HUD
 * Real-time floating telemetry overlay showing target name, 5-tier tracking state,
 * confidence score bar, inlier count, quadrant distribution, prediction status, and FPS.
 */
export class DebugHUD {
  constructor({ onOpenCalibration } = {}) {
    this.onOpenCalibration = onOpenCalibration;
    this.container = null;
    this.isVisible = false;
    this.isMinimized = false;

    // FPS calculation
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 60;

    // Elements
    this.elTarget = null;
    this.elState = null;
    this.elConfText = null;
    this.elConfBar = null;
    this.elInliers = null;
    this.elQuadrants = null;
    this.elSpan = null;
    this.elDelta = null;
    this.elPrediction = null;
    this.elFps = null;

    this.createDOM();
  }

  createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'debugHUD';
    this.container.className = 'debug-hud hidden';
    this.container.innerHTML = `
      <div class="debug-hud-header" id="hudHeader">
        <div class="debug-hud-title">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <span>Tracking Telemetry</span>
        </div>
        <div class="debug-hud-controls">
          <button class="debug-hud-btn" id="hudMinimizeBtn" title="Minimize">−</button>
          <button class="debug-hud-btn" id="hudCloseBtn" title="Close HUD">✕</button>
        </div>
      </div>

      <div class="debug-hud-body">
        <div class="hud-row">
          <span class="hud-label">Active Target</span>
          <span class="hud-val" id="hudTarget">None</span>
        </div>

        <div class="hud-row">
          <span class="hud-label">Tracking State</span>
          <span class="hud-state-badge hud-state-LOST" id="hudState">LOST</span>
        </div>

        <div class="hud-confidence-wrap">
          <div class="hud-row" style="border-bottom: none; padding: 0;">
            <span class="hud-label">Tracking Confidence</span>
            <span class="hud-val" id="hudConfText">0%</span>
          </div>
          <div class="hud-bar-outer">
            <div class="hud-bar-inner" id="hudConfBar"></div>
          </div>
        </div>

        <div class="hud-row">
          <span class="hud-label">Visual Inliers</span>
          <span class="hud-val" id="hudInliers">0 / 26</span>
        </div>

        <div class="hud-row">
          <span class="hud-label">Quadrant Spread</span>
          <span class="hud-val" id="hudQuadrants">0/4 quadrants</span>
        </div>

        <div class="hud-row">
          <span class="hud-label">Coverage Span (X/Y)</span>
          <span class="hud-val" id="hudSpan">0.00 × 0.00</span>
        </div>

        <div class="hud-row">
          <span class="hud-label">Pose Delta</span>
          <span class="hud-val" id="hudDelta">0.000m</span>
        </div>

        <div class="hud-row">
          <span class="hud-label">Prediction Status</span>
          <span class="hud-val" id="hudPrediction">Idle</span>
        </div>

        <div class="hud-row">
          <span class="hud-label">Render Performance</span>
          <span class="hud-val" id="hudFps">60 FPS</span>
        </div>

        <div class="hud-footer-actions">
          <button class="hud-btn-action" id="hudCalibBtn">Calibration Studio</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.container);

    // Cache elements
    this.elTarget = this.container.querySelector('#hudTarget');
    this.elState = this.container.querySelector('#hudState');
    this.elConfText = this.container.querySelector('#hudConfText');
    this.elConfBar = this.container.querySelector('#hudConfBar');
    this.elInliers = this.container.querySelector('#hudInliers');
    this.elQuadrants = this.container.querySelector('#hudQuadrants');
    this.elSpan = this.container.querySelector('#hudSpan');
    this.elDelta = this.container.querySelector('#hudDelta');
    this.elPrediction = this.container.querySelector('#hudPrediction');
    this.elFps = this.container.querySelector('#hudFps');

    // Controls
    const closeBtn = this.container.querySelector('#hudCloseBtn');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    const minBtn = this.container.querySelector('#hudMinimizeBtn');
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });

    const header = this.container.querySelector('#hudHeader');
    header.addEventListener('click', () => {
      if (this.isMinimized) this.toggleMinimize();
    });

    const calibBtn = this.container.querySelector('#hudCalibBtn');
    calibBtn.addEventListener('click', () => {
      if (this.onOpenCalibration) this.onOpenCalibration();
    });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.container.classList.toggle('minimized', this.isMinimized);
    const minBtn = this.container.querySelector('#hudMinimizeBtn');
    if (minBtn) minBtn.textContent = this.isMinimized ? '+' : '−';
  }

  show() {
    this.isVisible = true;
    this.container.classList.remove('hidden');
  }

  hide() {
    this.isVisible = false;
    this.container.classList.add('hidden');
  }

  toggle() {
    if (this.isVisible) this.hide();
    else this.show();
  }

  /**
   * Update telemetry values called from ARManager render loop
   */
  updateTelemetry(targetDef, stats = {}, confidence = 0) {
    if (!this.isVisible) return;

    // Measure FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      if (this.elFps) this.elFps.textContent = `${this.currentFps} FPS`;
    }

    if (this.elTarget && targetDef) {
      this.elTarget.textContent = targetDef.name || targetDef.id;
    }

    const state = stats.state || (confidence > 60 ? 'GOOD' : confidence > 0 ? 'DEGRADED' : 'LOST');

    if (this.elState) {
      this.elState.textContent = state;
      this.elState.className = `hud-state-badge hud-state-${state}`;
    }

    if (this.elConfText) {
      this.elConfText.textContent = `${confidence}%`;
    }
    if (this.elConfBar) {
      this.elConfBar.style.width = `${confidence}%`;
    }

    if (this.elInliers) {
      this.elInliers.textContent = `${stats.inliers || 0} / 26 inliers`;
    }

    if (this.elQuadrants) {
      const cov = stats.quadrantCoverage || 0;
      this.elQuadrants.textContent = `${cov}/4 quadrants`;
    }

    if (this.elSpan) {
      this.elSpan.textContent = `${stats.spanX || 0} × ${stats.spanY || 0}`;
    }

    if (this.elDelta) {
      this.elDelta.textContent = `${stats.poseDelta || 0}m`;
    }

    if (this.elPrediction) {
      if (stats.predicted) {
        this.elPrediction.textContent = `Active (${stats.missedMs || 0}ms)`;
        this.elPrediction.style.color = '#ff0077';
      } else {
        this.elPrediction.textContent = 'Idle (Visual Lock)';
        this.elPrediction.style.color = '#00ffaa';
      }
    }
  }
}
