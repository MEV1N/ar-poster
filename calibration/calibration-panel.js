import './calibration-panel.css';

/**
 * Interactive Calibration Studio UI Component
 * Provides live fine-tuning controls, numeric inputs, visual bounds toggle,
 * advanced predictive tracking parameters, and JSON save/export.
 */
export class CalibrationPanel {
  constructor({ manager, onClose, onToggleDebugHUD }) {
    this.manager = manager;
    this.onClose = onClose;
    this.onToggleDebugHUD = onToggleDebugHUD;
    this.container = null;
    this.toast = null;
    this.inputs = {};

    this.createDOM();
    this.syncFromState();
  }

  createDOM() {
    this.container = document.createElement('div');
    this.container.id = 'calibrationPanel';
    this.container.className = 'calib-panel hidden';
    this.container.innerHTML = `
      <div class="calib-header" id="calibHeader">
        <div class="calib-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
          </svg>
          <span>AR Calibration Studio</span>
          <span class="calib-badge">Dev Mode</span>
        </div>
        <button class="calib-close-btn" id="calibCloseBtn" title="Close Panel">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="calib-body">
        <!-- Visual Bounding Box & HUD Switches -->
        <div class="calib-section">
          <div class="calib-toggle-row">
            <span>Visual 3D Bounding Box</span>
            <label class="calib-switch">
              <input type="checkbox" id="field_showVisualBounds">
              <span class="calib-slider-round"></span>
            </label>
          </div>
          <div class="calib-toggle-row" style="margin-top: 8px;">
            <span>Show Developer Debug HUD</span>
            <label class="calib-switch">
              <input type="checkbox" id="field_showDebugHUD">
              <span class="calib-slider-round"></span>
            </label>
          </div>
          <div class="calib-toggle-row" style="margin-top: 8px;">
            <span>Device Motion Assist (Gyro)</span>
            <label class="calib-switch">
              <input type="checkbox" id="field_enableDeviceMotion">
              <span class="calib-slider-round"></span>
            </label>
          </div>
        </div>

        <!-- 1. Position & Depth -->
        <div class="calib-section">
          <div class="calib-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>
            Position & Depth Offset
          </div>
          ${this.createSliderRow('X Position', 'posX', -1.0, 1.0, 0.005, 'm')}
          ${this.createSliderRow('Y Position', 'posY', -1.0, 1.0, 0.005, 'm')}
          ${this.createSliderRow('Depth (Z)', 'posZ', -0.5, 0.5, 0.002, 'm')}
        </div>

        <!-- 2. Scale & Proportions -->
        <div class="calib-section">
          <div class="calib-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>
            Scale & Proportions
          </div>
          ${this.createSliderRow('Uniform Scale', 'scale', 0.2, 2.5, 0.01, 'x')}
          ${this.createSliderRow('Width Ratio (X)', 'scaleX', 0.5, 2.0, 0.01, 'x')}
          ${this.createSliderRow('Height Ratio (Y)', 'scaleY', 0.5, 2.0, 0.01, 'x')}
        </div>

        <!-- 3. Rotation Angles -->
        <div class="calib-section">
          <div class="calib-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z"/></svg>
            Rotation (Degrees)
          </div>
          ${this.createSliderRow('Roll (Z Angle)', 'rotZ', -180, 180, 0.5, '°')}
          ${this.createSliderRow('Pitch (X Angle)', 'rotX', -45, 45, 0.5, '°')}
          ${this.createSliderRow('Yaw (Y Angle)', 'rotY', -45, 45, 0.5, '°')}
        </div>

        <!-- 4. Media & Visual Controls -->
        <div class="calib-section">
          <div class="calib-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM8 15c0-1.66 1.34-3 3-3 .35 0 .69.07 1 .18V6h5v3h-3v6.18A3.001 3.001 0 0 1 11 18c-1.66 0-3-1.34-3-3z"/></svg>
            Media & Overlay
          </div>
          ${this.createSliderRow('Video Opacity', 'opacity', 0.0, 1.0, 0.05, '')}
          ${this.createSliderRow('Video Start Offset', 'videoStartOffset', 0, 30, 0.2, 's')}
        </div>

        <!-- 5. Advanced Tracking & Occlusion Recovery -->
        <div class="calib-section">
          <div class="calib-section-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            Tracking & Occlusion Recovery
          </div>
          ${this.createSliderRow('Prediction Duration', 'predictionDuration', 100, 2000, 50, 'ms')}
          ${this.createSliderRow('Lost Target Debounce', 'lostTargetTimeout', 200, 3000, 50, 'ms')}
          ${this.createSliderRow('Recovery Blend', 'recoveryBlendDuration', 50, 800, 25, 'ms')}
          ${this.createSliderRow('Confidence Cutoff', 'confidenceThreshold', 0.1, 0.95, 0.05, '')}
          ${this.createSliderRow('Min Inliers Required', 'minInliers', 3, 15, 1, '')}
          ${this.createSliderRow('Adaptive Filter Beta', 'filterBeta', 1, 200, 5, '')}
        </div>

        <!-- Action Buttons -->
        <div class="calib-section">
          <div class="calib-btn-grid">
            <button class="calib-btn" id="btnOptimizeTracking" style="grid-column: span 2; background: linear-gradient(135deg, #00ffaa, #00f0ff); color: #02120d; font-weight: 700; border: none; box-shadow: 0 4px 12px rgba(0, 255, 170, 0.35);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              Optimize for Universal Tracking
            </button>

            <button class="calib-btn calib-btn-primary" id="btnSaveCalib">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>
              Save Calibration
            </button>

            <button class="calib-btn" id="btnExportJSON">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Export JSON
            </button>

            <button class="calib-btn" id="btnImportJSON">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
              Import JSON
            </button>

            <button class="calib-btn calib-btn-danger" id="btnResetCalib">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
              Reset Default
            </button>

            <button class="calib-btn" id="btnReloadCalib">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
              Reload Saved
            </button>
          </div>
        </div>
      </div>

      <input type="file" id="calibFileInput" accept=".json" style="display: none;">
    `;

    document.body.appendChild(this.container);

    // Toast notification element
    this.toast = document.createElement('div');
    this.toast.className = 'calib-toast';
    document.body.appendChild(this.toast);

    // Event Bindings
    this.bindControls();
  }

  createSliderRow(label, key, min, max, step, unit) {
    return `
      <div class="calib-row">
        <div class="calib-label-wrap">
          <span>${label}</span>
          <span id="label_val_${key}">0${unit}</span>
        </div>
        <div class="calib-inputs-wrap">
          <input type="range" class="calib-slider" id="slider_${key}" min="${min}" max="${max}" step="${step}">
          <input type="number" class="calib-num-input" id="num_${key}" min="${min}" max="${max}" step="${step}">
        </div>
      </div>
    `;
  }

  bindControls() {
    const keys = [
      'posX', 'posY', 'posZ',
      'scale', 'scaleX', 'scaleY',
      'rotZ', 'rotX', 'rotY',
      'opacity', 'videoStartOffset',
      'confidenceThreshold', 'lostTargetTimeout',
      'predictionDuration', 'recoveryBlendDuration',
      'minInliers', 'filterBeta'
    ];

    keys.forEach((key) => {
      const slider = this.container.querySelector(`#slider_${key}`);
      const num = this.container.querySelector(`#num_${key}`);
      const labelVal = this.container.querySelector(`#label_val_${key}`);

      if (!slider || !num) return;

      const onValueChange = (val) => {
        val = parseFloat(val);
        slider.value = val;
        num.value = val;
        if (labelVal) {
          const unit = key.startsWith('pos') ? 'm' : key.startsWith('rot') ? '°' : key.endsWith('Timeout') || key.endsWith('Duration') ? 'ms' : key === 'videoStartOffset' ? 's' : key.startsWith('scale') ? 'x' : '';
          labelVal.textContent = `${val}${unit}`;
        }
        this.emitChange(key, val);
      };

      slider.addEventListener('input', (e) => onValueChange(e.target.value));
      num.addEventListener('input', (e) => onValueChange(e.target.value));

      this.inputs[key] = { slider, num, labelVal, onValueChange };
    });

    // Visual bounds toggle
    const boundsToggle = this.container.querySelector('#field_showVisualBounds');
    boundsToggle.addEventListener('change', (e) => {
      this.manager.update({ showVisualBounds: e.target.checked });
    });

    // Debug HUD toggle
    const hudToggle = this.container.querySelector('#field_showDebugHUD');
    hudToggle.addEventListener('change', (e) => {
      this.manager.update({ showDebugHUD: e.target.checked });
      if (this.onToggleDebugHUD) {
        this.onToggleDebugHUD(e.target.checked);
      }
    });

    // Device motion assist toggle
    const motionToggle = this.container.querySelector('#field_enableDeviceMotion');
    motionToggle.addEventListener('change', (e) => {
      this.manager.update({ enableDeviceMotion: e.target.checked });
    });

    // Close button
    const closeBtn = this.container.querySelector('#calibCloseBtn');
    closeBtn.addEventListener('click', () => {
      this.hide();
      if (this.onClose) this.onClose();
    });

    // Optimize for Universal Tracking
    this.container.querySelector('#btnOptimizeTracking').addEventListener('click', () => {
      this.manager.update({
        smoothing: 0.84,
        confidenceThreshold: 0.55,
        lostTargetTimeout: 1200,
        predictionDuration: 800,
        recoveryBlendDuration: 250,
        minInliers: 6,
        idealInliers: 26,
        filterMinCF: 0.001,
        filterBeta: 80.0,
        enableDeviceMotion: true,
        position: { x: 0, y: 0, z: 0 },
        scale: 1.0,
        scaleX: 1.0,
        scaleY: 1.0,
        rotation: { x: 0, y: 0, z: 0 }
      });
      this.manager.save();
      this.syncFromState();
      this.showToast('Universal Tracking Optimization Applied & Saved!');
    });

    // Save
    this.container.querySelector('#btnSaveCalib').addEventListener('click', () => {
      this.manager.save();
      this.showToast('Calibration saved to browser storage!');
    });

    // Reset
    this.container.querySelector('#btnResetCalib').addEventListener('click', () => {
      if (confirm('Reset all calibration values to factory defaults?')) {
        this.manager.reset();
        this.syncFromState();
        this.showToast('Reset to default calibration.');
      }
    });

    // Reload
    this.container.querySelector('#btnReloadCalib').addEventListener('click', () => {
      this.manager.load();
      this.syncFromState();
      this.showToast('Reloaded calibration settings.');
    });

    // Export JSON
    this.container.querySelector('#btnExportJSON').addEventListener('click', () => {
      this.manager.exportJSON();
      this.showToast('Configuration exported as JSON.');
    });

    // Import JSON
    const fileInput = this.container.querySelector('#calibFileInput');
    this.container.querySelector('#btnImportJSON').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        try {
          await this.manager.importJSON(e.target.files[0]);
          this.syncFromState();
          this.showToast('Calibration successfully imported!');
        } catch (err) {
          alert(`Failed to import JSON: ${err.message}`);
        }
      }
    });
  }

  emitChange(key, val) {
    const patch = {};
    if (key === 'posX') patch.position = { x: val };
    else if (key === 'posY') patch.position = { y: val };
    else if (key === 'posZ') patch.position = { z: val };
    else if (key === 'rotX') patch.rotation = { x: val };
    else if (key === 'rotY') patch.rotation = { y: val };
    else if (key === 'rotZ') patch.rotation = { z: val };
    else patch[key] = val;

    this.manager.update(patch);
  }

  syncFromState() {
    const s = this.manager.get();

    const valMap = {
      posX: s.position?.x ?? 0,
      posY: s.position?.y ?? 0,
      posZ: s.position?.z ?? 0,
      scale: s.scale ?? 1.0,
      scaleX: s.scaleX ?? 1.0,
      scaleY: s.scaleY ?? 1.0,
      rotX: s.rotation?.x ?? 0,
      rotY: s.rotation?.y ?? 0,
      rotZ: s.rotation?.z ?? 0,
      opacity: s.opacity ?? 1.0,
      videoStartOffset: s.videoStartOffset ?? 0,
      confidenceThreshold: s.confidenceThreshold ?? 0.55,
      lostTargetTimeout: s.lostTargetTimeout ?? 1200,
      predictionDuration: s.predictionDuration ?? 800,
      recoveryBlendDuration: s.recoveryBlendDuration ?? 250,
      minInliers: s.minInliers ?? 6,
      filterBeta: s.filterBeta ?? 80.0
    };

    Object.entries(valMap).forEach(([k, v]) => {
      if (this.inputs[k]) {
        this.inputs[k].slider.value = v;
        this.inputs[k].num.value = v;
        const unit = k.startsWith('pos') ? 'm' : k.startsWith('rot') ? '°' : k.endsWith('Timeout') || k.endsWith('Duration') ? 'ms' : k === 'videoStartOffset' ? 's' : k.startsWith('scale') ? 'x' : '';
        if (this.inputs[k].labelVal) {
          this.inputs[k].labelVal.textContent = `${v}${unit}`;
        }
      }
    });

    const boundsToggle = this.container.querySelector('#field_showVisualBounds');
    if (boundsToggle) {
      boundsToggle.checked = !!s.showVisualBounds;
    }

    const hudToggle = this.container.querySelector('#field_showDebugHUD');
    if (hudToggle) {
      hudToggle.checked = !!s.showDebugHUD;
    }

    const motionToggle = this.container.querySelector('#field_enableDeviceMotion');
    if (motionToggle) {
      motionToggle.checked = s.enableDeviceMotion !== false;
    }
  }

  show() {
    this.container.classList.remove('hidden');
    this.syncFromState();
  }

  hide() {
    this.container.classList.add('hidden');
  }

  showToast(msg) {
    if (!this.toast) return;
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    setTimeout(() => this.toast.classList.remove('show'), 2500);
  }
}
