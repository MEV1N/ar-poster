import * as THREE from 'three';

/**
 * AR Video Plane Component
 * Manages HTML5 video playback, Three.js video texture mapping, and animated fallback canvas.
 */
export class VideoPlane {
  constructor({
    src = './videos/event-promo.mp4',
    aspectRatio = 0.74667,
    startOffset = 0.0,
    width = 1.0
  }) {
    this.src = src;
    this.aspectRatio = aspectRatio;
    this.startOffset = startOffset;
    this.width = width;
    this.height = width / aspectRatio;

    this.video = null;
    this.texture = null;
    this.mesh = null;
    this.material = null;
    this.isDynamicCanvas = false;
    this.canvas = null;
    this.ctx = null;
    this.canvasAnimTime = 0;

    this.initVideo();
    this.createMesh();
  }

  initVideo() {
    this.video = document.createElement('video');
    this.video.src = this.src;
    this.video.crossOrigin = 'anonymous';
    this.video.playsInline = true;
    this.video.setAttribute('webkit-playsinline', 'true');
    this.video.setAttribute('playsinline', 'true');
    this.video.loop = true;
    this.video.muted = true; // Browser autoplay requirement
    this.video.preload = 'auto';

    // Check if video can play; if error or blocked, use dynamic cyberpunk visualizer
    this.video.addEventListener('error', (e) => {
      console.warn('Video failed to load, switching to dynamic cyberpunk AR visualizer canvas:', e);
      this.enableDynamicCanvas();
    });

    this.texture = new THREE.VideoTexture(this.video);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.format = THREE.RGBAFormat;
  }

  enableDynamicCanvas() {
    this.isDynamicCanvas = true;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 720;
    this.canvas.height = Math.round(720 / this.aspectRatio); // ~964px
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    if (this.material) {
      this.material.map = this.texture;
      this.material.needsUpdate = true;
    }
  }

  createMesh() {
    const geometry = new THREE.PlaneGeometry(this.width, this.height);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      toneMapped: false
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'ARVideoPlane';
    this.mesh.position.z = 0.001; // Slightly above poster plane to prevent z-fighting
  }

  play() {
    if (this.isDynamicCanvas) return;
    if (this.video) {
      if (this.startOffset > 0 && Math.abs(this.video.currentTime - this.startOffset) > 1) {
        this.video.currentTime = this.startOffset;
      }
      const p = this.video.play();
      if (p && p.catch) {
        p.catch((err) => {
          console.warn('Autoplay prevented or pending user gesture:', err.message);
        });
      }
    }
  }

  pause() {
    if (this.video && !this.video.paused) {
      this.video.pause();
    }
  }

  restart() {
    if (this.video) {
      this.video.currentTime = this.startOffset || 0;
      this.play();
    }
  }

  setMuted(muted) {
    if (this.video) {
      this.video.muted = muted;
    }
  }

  setStartOffset(offsetSeconds) {
    this.startOffset = Math.max(0, offsetSeconds);
    if (this.video && this.video.paused) {
      this.video.currentTime = this.startOffset;
    }
  }

  setOpacity(opacity) {
    if (this.material) {
      this.material.opacity = Math.max(0, Math.min(1, opacity));
    }
  }

  update(time) {
    // If fallback dynamic canvas visualizer is active, animate high-tech visuals
    if (this.isDynamicCanvas && this.ctx) {
      this.renderCyberVisualizer(time);
      if (this.texture) this.texture.needsUpdate = true;
    }
  }

  renderCyberVisualizer(time) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark cyber backdrop
    ctx.fillStyle = '#060810';
    ctx.fillRect(0, 0, w, h);

    // Glowing grid
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    const step = 40;
    const offset = (time * 30) % step;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = offset; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Audio Equalizer Visualizer Bars
    const barCount = 28;
    const barW = (w - 80) / barCount;
    for (let i = 0; i < barCount; i++) {
      const bh = Math.abs(Math.sin(time * 4 + i * 0.45) * Math.cos(time * 2 + i * 0.2)) * (h * 0.35);
      const bx = 40 + i * barW;
      const by = h * 0.65 - bh;

      const grad = ctx.createLinearGradient(0, by + bh, 0, by);
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(0.7, '#ff0077');
      grad.addColorStop(1, '#ffffff');

      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, barW - 4, bh);
    }

    // Holographic Cyber HUD Rings
    const cx = w / 2;
    const cy = h * 0.32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.8);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 1.6);
    ctx.stroke();

    ctx.rotate(-time * 1.6);
    ctx.strokeStyle = '#ff0077';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 75, 0, Math.PI * 1.2);
    ctx.stroke();
    ctx.restore();

    // Text Overlay
    ctx.font = 'bold 36px "Outfit", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillText('CYBERPUNK 2088 EXPO', w / 2, h * 0.78);

    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.fillText('LIVE AR STREAM CONNECTED', w / 2, h * 0.84);

    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('TOKYO DOME • NOV 14-16, 2026', w / 2, h * 0.90);
  }

  setDimensions(width, height) {
    this.width = width;
    this.height = height;
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.PlaneGeometry(width, height);
    }
  }
}
