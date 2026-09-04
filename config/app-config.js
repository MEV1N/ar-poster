/**
 * Application Configuration & Target Settings
 * Allows administrator to easily configure targets, video source, and default AR parameters.
 */
import defaultCalibration from './default-calibration.json';

export const APP_CONFIG = {
  // Target poster configuration
  target: {
    name: 'CYBERPUNK 2088 EXPO Poster Target',
    imageSrc: './assets/event-poster.jpg',
    mindSrc: './targets/event-poster.mind',
    // Physical aspect ratio of the poster (width / height)
    aspectRatio: 896 / 1200, // 0.74667
    originalWidth: 896,
    originalHeight: 1200
  },

  // Primary AR Video asset configuration
  video: {
    src: './videos/event-promo.mp4',
    loop: true,
    preload: 'auto',
    playsInline: true
  },

  // Audio configuration (browser autoplay policy compliant)
  audio: {
    initialMuted: true,
    volume: 0.85
  },

  // Camera settings
  camera: {
    facingMode: 'environment'
  },

  // Persistence keys
  storageKey: 'ar_poster_calibration_v1',

  // Default calibration settings
  defaultCalibration
};

/**
 * Loads calibrated settings from browser localStorage or returns defaults
 */
export function getSavedCalibration() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.storageKey);
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
    console.warn('Failed to load saved calibration, falling back to defaults:', err);
  }
  return JSON.parse(JSON.stringify(APP_CONFIG.defaultCalibration));
}

/**
 * Persists calibrated settings to browser localStorage
 */
export function saveCalibration(calibrationData) {
  try {
    localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(calibrationData));
    return true;
  } catch (err) {
    console.error('Failed to save calibration:', err);
    return false;
  }
}

/**
 * Clears calibration from localStorage
 */
export function resetSavedCalibration() {
  try {
    localStorage.removeItem(APP_CONFIG.storageKey);
    return true;
  } catch (err) {
    console.error('Failed to reset calibration:', err);
    return false;
  }
}
