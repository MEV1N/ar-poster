/**
 * Application Configuration & Target Settings
 */
import defaultCalibration from './default-calibration.json';

/**
 * Target & Video Registry
 * 
 * TO ADD MORE POSTERS AND VIDEOS:
 * 1. Place the new poster image in public/ (e.g. 'poster 3.png')
 * 2. Place the new video file in public/ (e.g. 'video 3.mp4')
 * 3. Add a new object entry to the TARGETS array below:
 *      {
 *        id: 'poster-3',
 *        name: 'Poster 3',
 *        imageSrc: './poster 3.png',
 *        videoSrc: './video 3.mp4',
 *        aspectRatio: 941 / 1672
 *      }
 * 4. Run `npm run compile-targets` in your terminal to compile all posters into targets.mind!
 */
export const TARGETS = [
  {
    id: 'poster-2',
    name: 'Poster 2 (Save the Dates)',
    imageSrc: './poster 2.png',
    videoSrc: './video 2.mp4',
    aspectRatio: 941 / 1672,
    fallbackVideos: [
      './video-2.mp4',
      './video2.mp4',
      './videos/video 2.mp4',
      './videos/video-2.mp4'
    ]
  },
  {
    id: 'poster-1',
    name: 'Poster 1 (Coming Soon)',
    imageSrc: './poster.png',
    videoSrc: './video.mp4',
    aspectRatio: 941 / 1672,
    fallbackVideos: ['./videos/video.mp4', './video.mp4']
  }
];

export const APP_CONFIG = {
  // Multi-target tracking file containing compiled keypoints for all posters
  mindSrc: './targets/targets.mind',

  // Configured posters and their associated AR videos
  targets: TARGETS,

  // Default target fallback (Poster 2)
  target: TARGETS[0],

  // Primary video fallback (Video 2)
  video: {
    src: './video 2.mp4',
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
        rotation: { ...APP_CONFIG.defaultCalibration.rotation, ...(parsed.rotation || {}) },
        showVisualBounds: false,
        showDebugHUD: false
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
