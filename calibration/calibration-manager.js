import { APP_CONFIG, getSavedCalibration, saveCalibration, resetSavedCalibration } from '../config/app-config.js';

/**
 * Calibration State Manager
 * Handles data persistence, export, import, and change listeners for AR tracking parameters.
 */
export class CalibrationManager {
  constructor(onUpdate) {
    this.onUpdate = onUpdate;
    this.state = getSavedCalibration();
  }

  get() {
    return { ...this.state };
  }

  update(partialState, notify = true) {
    this.state = {
      ...this.state,
      ...partialState,
      position: { ...this.state.position, ...(partialState.position || {}) },
      rotation: { ...this.state.rotation, ...(partialState.rotation || {}) }
    };

    if (notify && this.onUpdate) {
      this.onUpdate(this.state);
    }
  }

  save() {
    const success = saveCalibration(this.state);
    return success;
  }

  load() {
    this.state = getSavedCalibration();
    if (this.onUpdate) {
      this.onUpdate(this.state);
    }
    return this.state;
  }

  reset() {
    resetSavedCalibration();
    this.state = JSON.parse(JSON.stringify(APP_CONFIG.defaultCalibration));
    if (this.onUpdate) {
      this.onUpdate(this.state);
    }
    return this.state;
  }

  exportJSON() {
    const dataStr = JSON.stringify(this.state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ar-poster-calibration-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          this.update(parsed, true);
          this.save();
          resolve(this.state);
        } catch (err) {
          reject(new Error('Invalid JSON file format.'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read configuration file.'));
      reader.readAsText(file);
    });
  }
}
