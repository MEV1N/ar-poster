/**
 * Application Configuration & Target Settings
 */
import defaultCalibration from './default-calibration.json';

export const APP_CONFIG = {
  // Target poster configuration
  target: {
    name: 'Event Poster Target',
    imageSrc: './poster.png',
    mindSrc: './targets/poster.mind',
    // Physical aspect ratio of poster.png (941 / 1672)
    aspectRatio: 941 / 1672,
    originalWidth: 941,
    originalHeight: 1672
  },

  // Primary AR Video asset configuration
  video: {
    src: './video.mp4',
    loop: true,
    preload: 'auto',
    playsInline: true
  },

  // Audio configuration
  audio: {
    initialMuted: false,
    volume: 1.0
  },

  // Camera settings
  camera: {
    facingMode: 'environment'
  },

  defaultCalibration
};

export function getSavedCalibration() {
  try {
    const raw = localStorage.getItem('ar_poster_calibration_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...APP_CONFIG.defaultCalibration,
        ...parsed,
        position: { ...APP_CONFIG.defaultCalibration.position, ...(parsed.position || {}) },
        rotation: { ...APP_CONFIG.defaultCalibration.rotation, ...(parsed.rotation || {}) }
      };
    }
  } catch (err) {
    console.warn('Failed to load calibration:', err);
  }
  return JSON.parse(JSON.stringify(APP_CONFIG.defaultCalibration));
}

export function saveCalibration(calibrationData) {
  try {
    localStorage.setItem('ar_poster_calibration_v1', JSON.stringify(calibrationData));
    return true;
  } catch (err) {
    console.error('Failed to save calibration:', err);
    return false;
  }
}

export function resetSavedCalibration() {
  try {
    localStorage.removeItem('ar_poster_calibration_v1');
    return true;
  } catch (err) {
    console.error('Failed to reset calibration:', err);
    return false;
  }
}
