/*
 * The triple-blum secret: the logo mark extruded into clay, first built for
 * jordanrblum.com's hero. Loaded on demand (plus three.js from the CDN via
 * the import map in index.html) only when the egg is triggered.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

// Entrance offsets per stroke, echoing the logo's ink draw-in.
const PIECE_OFFSETS = [
  { x: -0.9, y: 0.35, rotate: -0.1 },
  { x: -0.25, y: 0.85, rotate: 0.08 },
  { x: 0.2, y: -0.75, rotate: -0.08 },
  { x: 0.9, y: 0.38, rotate: 0.1 },
];

const easeOutBack = (t) => {
  const c = 1.70158;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function mountClayMark(stage, svgMarkup) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'clay-canvas';
  stage.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 14);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6e8, 2.3);
  key.position.set(4, 6, 9);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-6, -3, 5);
  scene.add(fill);

  const material = new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide });

  // Tokens shift when darkroom mode is on, so re-read them on every open.
  const applyTokens = () => {
    material.color.set(token('--accent') || '#9c4037');
    hemi.color.set(token('--paper-raised') || '#fcfaf6');
    hemi.groundColor.set(token('--ink') || '#2b2521');
    fill.color.set(token('--accent') || '#9c4037');
  };

  const svg = new SVGLoader().parse(svgMarkup);
  const geometries = svg.paths.map((path) => {
    const shapes = SVGLoader.createShapes(path);
    return new THREE.ExtrudeGeometry(shapes, {
      depth: 46,
      curveSegments: 10,
      bevelEnabled: true,
      bevelThickness: 7,
      bevelSize: 5,
      bevelSegments: 3,
    });
  });

  const bounds = new THREE.Box3();
  for (const geometry of geometries) {
    geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox);
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  for (const geometry of geometries) {
    geometry.translate(-center.x, -center.y, -center.z);
    // SVG space is y-down; mirror once (the material renders DoubleSide).
    geometry.scale(1, -1, 1);
  }

  const group = new THREE.Group();
  const pieces = geometries.map((geometry, index) => {
    const piece = new THREE.Group();
    piece.add(new THREE.Mesh(geometry, material));
    group.add(piece);
    return { piece, phase: index * 1.7 };
  });
  scene.add(group);

  const fit = () => {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const viewHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const viewWidth = viewHeight * camera.aspect;
    const targetWidth = Math.min(viewWidth * 0.8, viewHeight * 0.55 * (size.x / size.y));
    group.scale.setScalar(targetWidth / size.x);
  };
  new ResizeObserver(fit).observe(stage);

  // Drag to spin with inertia; a light spring keeps pitch near home.
  let dragging = false;
  let yaw = 0;
  let yawVelocity = 0;
  let pitch = 0;
  let pitchVelocity = 0;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yawVelocity = (event.clientX - lastX) * 0.14;
    pitchVelocity = (event.clientY - lastY) * 0.1;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  const release = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  let raf = 0;
  let motionTime = 0;
  let last = 0;

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    motionTime += dt;

    yaw += yawVelocity * dt * 6;
    pitch += pitchVelocity * dt * 6;
    yawVelocity *= 1 - Math.min(1, dt * (dragging ? 8 : 1.6));
    pitchVelocity *= 1 - Math.min(1, dt * (dragging ? 8 : 1.6));
    pitch += (0 - pitch) * Math.min(1, dt * 3);

    group.rotation.y = Math.sin(motionTime * 0.32) * 0.12 + yaw;
    group.rotation.x = Math.sin(motionTime * 0.45) * 0.06 + pitch;
    group.rotation.z = Math.sin(motionTime * 0.27) * 0.03 - 0.035;

    pieces.forEach(({ piece, phase }, index) => {
      const enter = Math.min(1, Math.max(0, (motionTime - index * 0.07) / 0.7));
      const eased = easeOutBack(enter);
      const offset = PIECE_OFFSETS[index] ?? PIECE_OFFSETS[0];
      piece.position.x = offset.x * (1 - eased);
      piece.position.y = offset.y * (1 - eased) + Math.sin(motionTime * 0.9 + phase) * 0.045;
      piece.rotation.z = offset.rotate * (1 - eased);
      piece.position.z = Math.sin(motionTime * 0.7 + phase * 2.1) * 0.05;
    });

    renderer.render(scene, camera);
    raf = window.requestAnimationFrame(frame);
  };

  return {
    // Replays the entrance and (re)starts the loop; runs only while open.
    start() {
      applyTokens();
      fit();
      motionTime = 0;
      yaw = 0;
      yawVelocity = 0;
      pitch = 0;
      pitchVelocity = 0;
      window.cancelAnimationFrame(raf);
      last = performance.now();
      raf = window.requestAnimationFrame(frame);
    },
    stop() {
      window.cancelAnimationFrame(raf);
    },
  };
}
