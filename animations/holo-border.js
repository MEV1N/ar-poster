import * as THREE from 'three';

/**
 * Holographic Border & Cyber Reticle Overlay
 * Renders glowing cyber lines, corner targeting brackets, and a pulsing scanline.
 */
export class HoloBorder {
  constructor(width = 1.0, height = 1.34) {
    this.width = width;
    this.height = height;
    this.group = new THREE.Group();
    this.group.name = 'HoloBorder';

    this.scanline = null;
    this.cornerLines = [];
    this.buildMeshes();
  }

  buildMeshes() {
    const w = this.width;
    const h = this.height;
    const halfW = w / 2;
    const halfH = h / 2;

    // Outer Glowing Frame Line Loop
    const framePoints = [
      new THREE.Vector3(-halfW, -halfH, 0.002),
      new THREE.Vector3(halfW, -halfH, 0.002),
      new THREE.Vector3(halfW, halfH, 0.002),
      new THREE.Vector3(-halfW, halfH, 0.002),
      new THREE.Vector3(-halfW, -halfH, 0.002)
    ];

    const frameGeom = new THREE.BufferGeometry().setFromPoints(framePoints);
    this.frameMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.85
    });

    const frameLine = new THREE.Line(frameGeom, this.frameMaterial);
    this.group.add(frameLine);

    // Corner Reticle Brackets
    const cornerSize = Math.min(w, h) * 0.12;
    const cornerOffsets = [
      // Top Left
      [-halfW, halfH, 1, -1],
      // Top Right
      [halfW, halfH, -1, -1],
      // Bottom Left
      [-halfW, -halfH, 1, 1],
      // Bottom Right
      [halfW, -halfH, -1, 1]
    ];

    this.cornerMaterial = new THREE.LineBasicMaterial({
      color: 0xff0077,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });

    cornerOffsets.forEach(([cx, cy, dirX, dirY]) => {
      const pts = [
        new THREE.Vector3(cx, cy + dirY * cornerSize, 0.003),
        new THREE.Vector3(cx, cy, 0.003),
        new THREE.Vector3(cx + dirX * cornerSize, cy, 0.003)
      ];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(g, this.cornerMaterial);
      this.cornerLines.push(l);
      this.group.add(l);
    });

    // Vertical Scanline Sweep
    const scanGeom = new THREE.PlaneGeometry(w * 1.02, 0.02);
    this.scanMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    this.scanline = new THREE.Mesh(scanGeom, this.scanMaterial);
    this.scanline.position.z = 0.004;
    this.group.add(this.scanline);
  }

  update(time) {
    // Pulse frame glow
    const pulse = 0.7 + 0.3 * Math.sin(time * 3.5);
    if (this.frameMaterial) this.frameMaterial.opacity = pulse;
    if (this.cornerMaterial) this.cornerMaterial.opacity = 0.6 + 0.4 * Math.cos(time * 4.0);

    // Scanline vertical sweep
    if (this.scanline) {
      const halfH = this.height / 2;
      const progress = (Math.sin(time * 1.8) + 1) / 2; // 0 to 1
      this.scanline.position.y = -halfH + progress * this.height;
    }
  }

  setDimensions(width, height) {
    this.width = width;
    this.height = height;
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
    this.buildMeshes();
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
