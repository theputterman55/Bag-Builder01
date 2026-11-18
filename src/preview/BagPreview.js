import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { weaveBump } from '../editor/samples.js';

const HOME_DIR = new THREE.Vector3(0, 7.2, 5.0).normalize();
const HOME = HOME_DIR.clone().multiplyScalar(9.6);
const ss = (t) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

// Live 3D bag. Drag to orbit, wheel/pinch to zoom. The two panels use the flat
// fabric canvases from the editor as their textures.
export class BagPreview {
  constructor(container, shape, flatCanvases) {
    this.container = container;
    this.shape = shape;
    this.flat = flatCanvases;
    this.flipT = -1;
    this.flipFrom = 0;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.domElement.style.display = 'block';
    r.domElement.style.width = '100%';
    r.domElement.style.height = '100%';
    r.domElement.style.touchAction = 'none';
    container.appendChild(r.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x0b0f14);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.copy(HOME);

    scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x2a2622, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-4, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db6d6, 0.8);
    rim.position.set(5, 3, -6);
    scene.add(rim);
    const under = new THREE.DirectionalLight(0xffffff, 1.3);
    under.position.set(2, -6, 5);
    scene.add(under);

    this.bag = new THREE.Group();
    scene.add(this.bag);
    this.bump = new THREE.CanvasTexture(weaveBump());
    this.bump.wrapS = this.bump.wrapT = THREE.RepeatWrapping;
    this.bump.repeat.set(26, 26);
    this.fabricFeel = true;

    this.panels = {};
    [
      ['top', 1],
      ['bottom', -1]
    ].forEach(([name, side]) => {
      const d = shape.buildSide(side);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
      g.setIndex(new THREE.BufferAttribute(d.index, 1));
      g.computeVertexNormals();
      const tex = new THREE.CanvasTexture(this.flat[name]);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = r.capabilities.getMaxAnisotropy();
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.92,
        metalness: 0,
        side: THREE.DoubleSide,
        bumpMap: this.bump,
        bumpScale: 0.25
      });
      const mesh = new THREE.Mesh(g, mat);
      this.bag.add(mesh);
      this.panels[name] = { mesh, tex, mat };
    });

    // dark inside, seen through the thin seam crease
    const ring = shape.outline(shape.A - 0.03, 240).map((p) => new THREE.Vector2(p[0], -p[1]));
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(ring)), new THREE.MeshBasicMaterial({ color: 0x05070a, side: THREE.DoubleSide }));
    inner.rotation.x = -Math.PI / 2;
    this.bag.add(inner);

    // black zigzag stitch inside the front divot, top and bottom
    [1, -1].forEach((side) => {
      const pts = shape.zigzag(side).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0), 1200, 0.0045, 4, false),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      this.bag.add(tube);
    });

    // wireframe overlay
    this.wire = new THREE.Group();
    Object.values(this.panels).forEach((p) => {
      this.wire.add(new THREE.Mesh(p.mesh.geometry, new THREE.MeshBasicMaterial({ color: 0xf3e6c4, wireframe: true, transparent: true, opacity: 0.55 })));
    });
    this.wire.visible = false;
    this.bag.add(this.wire);

    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 1.2;
    c.maxDistance = 30;
    c.addEventListener('start', () => (this._moved = true));
    c.update();

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(container);
    this.resize();
    r.setAnimationLoop(() => this._tick());
    this._last = performance.now();
  }

  // call after the flat fabric canvas changed
  refresh(name) {
    if (name) this.panels[name].tex.needsUpdate = true;
    else Object.values(this.panels).forEach((p) => (p.tex.needsUpdate = true));
  }

  resize() {
    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // how far back the camera must sit for the whole bag to fit this box
    const t = 2 * Math.tan((this.camera.fov * Math.PI) / 360);
    this.fitDist = Math.max(8.4 / (t * this.camera.aspect), 6.4 / t);
    if (!this._moved) this._home();
  }

  _home() {
    this.camera.position.copy(HOME_DIR).multiplyScalar(this.fitDist || 9.6);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _tick() {
    const now = performance.now();
    const dt = (now - this._last) / 1000;
    this._last = now;
    if (this.flipT >= 0) {
      this.flipT = Math.min(1, this.flipT + dt / 0.9);
      this.bag.rotation.x = this.flipFrom + Math.PI * ss(this.flipT);
      if (this.flipT >= 1) this.flipT = -1;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  flip() {
    this.flipT = 0;
    this.flipFrom = this.bag.rotation.x;
  }
  setSpin(on) {
    this.controls.autoRotate = on;
    this.controls.autoRotateSpeed = 2.5;
  }
  setWireframe(on) {
    this.wire.visible = on;
  }
  setFabricFeel(on) {
    this.fabricFeel = on;
    Object.values(this.panels).forEach((p) => {
      p.mat.bumpMap = on ? this.bump : null;
      p.mat.needsUpdate = true;
    });
  }
  view(name) {
    if (name === 'home') {
      this.bag.rotation.set(0, 0, 0);
      this._moved = false;
      this._home();
      return;
    }
    const v = {
      under: [new THREE.Vector3(0, -5.2, 8.2), [0, 0, 0]],
      pinch: [new THREE.Vector3(0, 1.4, 5.4), [0, 0, 2.7]],
      seam: [new THREE.Vector3(-1.2, 0.4, 5.2), [-1.0, 0, 2.9]]
    }[name];
    if (!v) return;
    this.camera.position.copy(v[0]);
    this.controls.target.set(...v[1]);
    this.controls.update();
  }

  dispose() {
    this._ro.disconnect();
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
