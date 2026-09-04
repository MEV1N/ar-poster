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
  return JSON.parse(JSON.stringify(APP_CONFIG.defaultCalibration));
}
