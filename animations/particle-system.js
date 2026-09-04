import * as THREE from 'three';

/**
 * 3D Particle Vortex & Ambient Spark System
 * Projects shimmering particles around the physical poster in 3D AR space.
 */
export class ParticleSystem {
  constructor(count = 120, bounds = { width: 1.0, height: 1.34 }) {
    this.count = count;
    this.bounds = bounds;
    this.group = new THREE.Group();
    this.group.name = 'ParticleSystem';

    this.positions = new Float32Array(count * 3);
    this.velocities = [];
    this.colors = new Float32Array(count * 3);

    this.initParticles();
  }

  initParticles() {
    const halfW = this.bounds.width / 2;
    const halfH = this.bounds.height / 2;

    const cyan = new THREE.Color(0x00f0ff);
    const magenta = new THREE.Color(0xff0077);
    const green = new THREE.Color(0x00ffaa);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      // Position around poster perimeter with some Z depth
      this.positions[idx] = (Math.random() - 0.5) * this.bounds.width * 1.3;
      this.positions[idx + 1] = (Math.random() - 0.5) * this.bounds.height * 1.3;
      this.positions[idx + 2] = (Math.random() * 0.15) + 0.01; // float above poster

      // Random drift velocity
      this.velocities.push({
        vx: (Math.random() - 0.5) * 0.002,
        vy: (Math.random() - 0.5) * 0.002 + 0.001,
        vz: (Math.random() - 0.5) * 0.001,
        phase: Math.random() * Math.PI * 2
      });

      // Color variation between cyan, magenta, and green
      const t = Math.random();
      const col = t < 0.5 ? cyan.clone().lerp(magenta, t * 2) : magenta.clone().lerp(green, (t - 0.5) * 2);
      this.colors[idx] = col.r;
      this.colors[idx + 1] = col.g;
      this.colors[idx + 2] = col.b;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    // Circular particle texture using canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(0, 240, 255, 0.8)');
    grad.addColorStop(0.7, 'rgba(255, 0, 119, 0.2)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.85
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.group.add(this.points);
  }

  update(time) {
    const halfW = (this.bounds.width * 1.4) / 2;
    const halfH = (this.bounds.height * 1.4) / 2;
    const posAttr = this.geometry.attributes.position;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 3;
      const v = this.velocities[i];

      posAttr.array[idx] += v.vx + Math.sin(time * 2 + v.phase) * 0.0008;
      posAttr.array[idx + 1] += v.vy;
      posAttr.array[idx + 2] += v.vz;

      // Wrap around bounds
      if (posAttr.array[idx + 1] > halfH) {
        posAttr.array[idx + 1] = -halfH;
        posAttr.array[idx] = (Math.random() - 0.5) * this.bounds.width * 1.2;
      }
      if (posAttr.array[idx] > halfW) posAttr.array[idx] = -halfW;
      if (posAttr.array[idx] < -halfW) posAttr.array[idx] = halfW;
      if (posAttr.array[idx + 2] > 0.2) posAttr.array[idx + 2] = 0.01;
      if (posAttr.array[idx + 2] < 0.0) posAttr.array[idx + 2] = 0.15;
    }

    posAttr.needsUpdate = true;
  }

  setBounds(width, height) {
    this.bounds.width = width;
    this.bounds.height = height;
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
