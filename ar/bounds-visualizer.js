import * as THREE from 'three';

/**
 * Bounds & Calibration Visualizer
 * Renders 3D visual bounding boxes and alignment guides in Calibration Mode.
 */
export class BoundsVisualizer {
  constructor({ targetWidth = 1.0, targetHeight = 1.34 }) {
    this.targetWidth = targetWidth;
    this.targetHeight = targetHeight;
    this.group = new THREE.Group();
    this.group.name = 'BoundsVisualizer';
    this.group.visible = false; // Hidden in normal mode

    this.targetBox = null;
    this.contentBox = null;
    this.axesHelper = null;

    this.createVisualizers();
  }

  createVisualizers() {
    const halfTW = this.targetWidth / 2;
    const halfTH = this.targetHeight / 2;

    // 1. Detected Physical Target Perimeter (Cyan / Green dashed line)
    const targetGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfTW, -halfTH, 0),
      new THREE.Vector3(halfTW, -halfTH, 0),
      new THREE.Vector3(halfTW, halfTH, 0),
      new THREE.Vector3(-halfTW, halfTH, 0),
      new THREE.Vector3(-halfTW, -halfTH, 0)
    ]);

    const targetMat = new THREE.LineDashedMaterial({
      color: 0x00ffaa,
      dashSize: 0.04,
      gapSize: 0.02,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });

    this.targetBox = new THREE.Line(targetGeom, targetMat);
    this.targetBox.computeLineDistances();
    this.group.add(this.targetBox);

    // 2. AR Content Bounding Box (Yellow outline with corner anchors)
    const contentGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-halfTW, -halfTH, 0.005),
      new THREE.Vector3(halfTW, -halfTH, 0.005),
      new THREE.Vector3(halfTW, halfTH, 0.005),
      new THREE.Vector3(-halfTW, halfTH, 0.005),
      new THREE.Vector3(-halfTW, -halfTH, 0.005)
    ]);

    const contentMat = new THREE.LineBasicMaterial({
      color: 0xffe600,
      linewidth: 2,
      transparent: true,
      opacity: 0.9
    });

    this.contentBox = new THREE.Line(contentGeom, contentMat);
    this.group.add(this.contentBox);

    // 3. Center Target Crosshair
    const crossSize = 0.06;
    const crossGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-crossSize, 0, 0.006),
      new THREE.Vector3(crossSize, 0, 0.006),
      new THREE.Vector3(0, -crossSize, 0.006),
      new THREE.Vector3(0, crossSize, 0.006)
    ]);

    const crossMat = new THREE.LineBasicMaterial({
      color: 0xff0055,
      linewidth: 2
    });
    this.crosshair = new THREE.LineSegments(crossGeom, crossMat);
    this.group.add(this.crosshair);

    // 4. 3D Coordinate Axes (X = Red, Y = Green, Z = Blue)
    this.axesHelper = new THREE.AxesHelper(0.18);
    this.axesHelper.position.z = 0.006;
    this.group.add(this.axesHelper);
  }

  updateContentBounds(x, y, z, width, height, rotZDeg = 0) {
    const halfW = width / 2;
    const halfH = height / 2;

    const pts = [
      new THREE.Vector3(-halfW, -halfH, 0.005),
      new THREE.Vector3(halfW, -halfH, 0.005),
      new THREE.Vector3(halfW, halfH, 0.005),
      new THREE.Vector3(-halfW, halfH, 0.005),
      new THREE.Vector3(-halfW, -halfH, 0.005)
    ];

    if (this.contentBox) {
      this.contentBox.geometry.dispose();
      this.contentBox.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      this.contentBox.position.set(x, y, z);
      this.contentBox.rotation.z = (rotZDeg * Math.PI) / 180;
    }

    if (this.crosshair) {
      this.crosshair.position.set(x, y, z + 0.001);
    }
    if (this.axesHelper) {
      this.axesHelper.position.set(x, y, z + 0.001);
      this.axesHelper.rotation.z = (rotZDeg * Math.PI) / 180;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
