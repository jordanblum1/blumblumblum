/*
 * The triple-blum secret: the flat logo morphs into 3D clay in place.
 * The extrusion is built from the same SVG paths as the on-page mark and the
 * canvas overlays it exactly, so "inflating" the depth reads as the flat
 * logo puffing up. Loaded on demand (three.js from the CDN via the import
 * map in index.html) only when the egg is triggered.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const springTo = (state, target, dt, stiffness, damping) => {
  state.velocity += (stiffness * (target - state.value) - damping * state.velocity) * dt;
  state.value += state.velocity * dt;
};

export function mountClayMark(panel, markSvg, { onTap }) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = 'clay-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  panel.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 14);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1.5);
  const key = new THREE.DirectionalLight(0xfff6e8, 2.3);
  key.position.set(4, 6, 9);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-6, -3, 5);
  scene.add(hemi, key, fill);

  const material = new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide });

  // Tokens shift when darkroom mode toggles, so re-read them on every morph.
  const applyTokens = () => {
    material.color.set(token('--accent') || '#9c4037');
    hemi.color.set(token('--paper-raised') || '#fcfaf6');
    hemi.groundColor.set(token('--ink') || '#2b2521');
    fill.color.set(token('--accent') || '#9c4037');
  };

  const svg = new SVGLoader().parse(markSvg.outerHTML);
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
  const meshes = [];
  const pieces = geometries.map((geometry, index) => {
    const piece = new THREE.Group();
    const mesh = new THREE.Mesh(geometry, material);
    piece.add(mesh);
    meshes.push(mesh);
    group.add(piece);
    return { piece, phase: index * 1.7 };
  });
  scene.add(group);

  // Match the flat SVG exactly: same projected width, centered on its center.
  let baseScale = 0.01;
  const fit = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const svgRect = markSvg.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const viewHeight = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const worldPerPx = (viewHeight * camera.aspect) / canvasRect.width;
    baseScale = (svgRect.width * worldPerPx) / size.x;
    group.position.set(
      (svgRect.left + svgRect.width / 2 - (canvasRect.left + canvasRect.width / 2)) * worldPerPx,
      -(svgRect.top + svgRect.height / 2 - (canvasRect.top + canvasRect.height / 2)) * worldPerPx,
      0,
    );
  };
  new ResizeObserver(fit).observe(canvas);

  const depth = { value: 0, velocity: 0 };
  let depthTarget = 0;
  const yaw = { value: 0, velocity: 0 };
  let yawFree = 0;
  let yawVelocity = 0;
  const pitch = { value: 0, velocity: 0 };
  let pitchVelocity = 0;

  let active = false;
  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;
  let settleResolve = null;

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const hitsClay = (event) => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    pointerNdc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
    );
    raycaster.setFromCamera(pointerNdc, camera);
    return raycaster.intersectObjects(meshes).length > 0;
  };

  // The canvas keeps pointer-events: none so the links stay clickable around
  // it; grabbing is decided by raycasting the clay silhouette instead.
  const onPointerDown = (event) => {
    if (!event.isPrimary || !hitsClay(event)) return;
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const onPointerMove = (event) => {
    if (dragging) {
      if (Math.hypot(event.clientX - lastX, event.clientY - lastY) > 2) moved = true;
      yawVelocity = (event.clientX - lastX) * 0.14;
      pitchVelocity = (event.clientY - lastY) * 0.1;
      lastX = event.clientX;
      lastY = event.clientY;
      document.body.style.cursor = 'grabbing';
    } else {
      document.body.style.cursor = hitsClay(event) ? 'grab' : '';
    }
  };
  const onPointerUp = (event) => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = hitsClay(event) ? 'grab' : '';
    if (!moved) onTap?.(event);
  };

  const listen = (add) => {
    const method = add ? 'addEventListener' : 'removeEventListener';
    window[method]('pointerdown', onPointerDown, true);
    window[method]('pointermove', onPointerMove, true);
    window[method]('pointerup', onPointerUp, true);
    window[method]('pointercancel', onPointerUp, true);
    if (!add) document.body.style.cursor = '';
  };

  let raf = 0;
  let motionTime = 0;
  let last = 0;

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    motionTime += dt;

    springTo(depth, depthTarget, dt, 42, depthTarget === 0 ? 12 : 8);
    const body = Math.max(0, Math.min(1, depth.value));

    yawFree += yawVelocity * dt * 6;
    pitchVelocity *= 1 - Math.min(1, dt * (dragging ? 8 : 1.6));
    yawVelocity *= 1 - Math.min(1, dt * (dragging ? 8 : 1.6));
    pitch.value += pitchVelocity * dt * 6;
    pitch.value += (0 - pitch.value) * Math.min(1, dt * 3);
    // heading home: damp the free spin back to face forward
    if (depthTarget === 0) yawFree *= 1 - Math.min(1, dt * 6);

    // sway only exists once there is a body to sway
    group.rotation.y = (Math.sin(motionTime * 0.32) * 0.12) * body + yawFree;
    group.rotation.x = (Math.sin(motionTime * 0.45) * 0.06) * body + pitch.value;
    group.rotation.z = (Math.sin(motionTime * 0.27) * 0.03 - 0.035) * body;
    group.scale.set(baseScale, baseScale, baseScale * Math.max(0.002, body));

    pieces.forEach(({ piece, phase }) => {
      piece.position.y = Math.sin(motionTime * 0.9 + phase) * 0.045 * body;
      piece.position.z = Math.sin(motionTime * 0.7 + phase * 2.1) * 0.05 * body;
    });

    renderer.render(scene, camera);

    const settled =
      depthTarget === 0 &&
      Math.abs(depth.value) < 0.01 &&
      Math.abs(depth.velocity) < 0.05 &&
      Math.abs(yawFree) < 0.02;
    if (settled) {
      raf = 0;
      settleResolve?.();
      settleResolve = null;
      return;
    }
    raf = window.requestAnimationFrame(frame);
  };

  const startLoop = () => {
    if (raf) return;
    last = performance.now();
    raf = window.requestAnimationFrame(frame);
  };

  return {
    /**
     * Flat → clay. Interruptible: calling mid-deflate just retargets the
     * springs, so rapid toggling never gets stuck.
     */
    morphIn() {
      active = true;
      applyTokens();
      fit();
      if (depth.value < 0.05) {
        motionTime = 0;
        yawFree = 0;
        yawVelocity = 0;
        pitch.value = 0;
        pitchVelocity = 0;
      }
      depthTarget = 1;
      settleResolve = null;
      listen(true);
      startLoop();
    },
    /** Clay → flat; the loop stops on its own once the deflate settles. */
    morphOut() {
      active = false;
      depthTarget = 0;
      // unwind whole turns so the face returns forward, not mid-spin
      yawFree = ((((yawFree + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      listen(false);
      dragging = false;
      startLoop();
    },
    isActive: () => active,
  };
}
