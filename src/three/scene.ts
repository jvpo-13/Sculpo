import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SceneApi {
  setMesh(mesh: { positions: Float32Array; indices: Uint32Array } | null, colorSwapZ: number): void;
  setColors(baseHex: string, reliefHex: string): void;
  resetCamera(animate: boolean): void;
  dispose(): void;
}

const CAMERA_POS = new THREE.Vector3(0, -80, 60);
const CAMERA_TARGET = new THREE.Vector3(0, 0, 2);
const RESET_MS = 300;
const CREASE_ANGLE = (30 * Math.PI) / 180;
// Desde a r155 as luzes são fisicamente corretas; multiplicar por PI devolve o
// brilho que as intensidades do spec (0.6 / 0.8 / 0.2) tinham antes.
const LIGHT_SCALE = Math.PI;
const MIN_FPS = 30;

/**
 * Cena do viewport (Parte 7.4). Z para cima, mm como unidade.
 * Renderiza sob demanda: só quando malha, cores, tamanho ou câmera mudam.
 */
export function createScene(host: HTMLElement): SceneApi {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0f1115, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-label', 'Modelo 3D do chaveiro. Arraste para girar, role para aproximar.');
  canvas.setAttribute('role', 'img');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 2000);
  camera.up.set(0, 0, 1);
  camera.position.copy(CAMERA_POS);

  // Grade de 100 x 100 mm no plano z = 0 (o GridHelper nasce no plano XZ).
  const grid = new THREE.GridHelper(100, 10, 0x2a2f3a, 0x2a2f3a);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.6 * LIGHT_SCALE);
  hemi.position.set(0, 0, 1); // "céu" em +Z
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.2 * LIGHT_SCALE));

  const sun = new THREE.DirectionalLight(0xffffff, 0.8 * LIGHT_SCALE);
  sun.position.set(40, -50, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.radius = 4; // sombra suave
  sun.shadow.bias = -0.0005;
  const sc = sun.shadow.camera;
  sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 400;
  scene.add(sun);

  // Chão invisível que só recebe a sombra do modelo.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  floor.position.z = -0.05;
  floor.receiveShadow = true;
  scene.add(floor);

  // Duas cores por fragmento, pelo z do modelo: acima da base = cor do relevo.
  const uniforms = {
    uBaseColor: { value: new THREE.Color(0xf5f5f5) },
    uReliefColor: { value: new THREE.Color(0xe06d53) },
    uSwapZ: { value: 2 },
  };
  const material = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vSculpoZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSculpoZ = position.z;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vSculpoZ;\nuniform vec3 uBaseColor;\nuniform vec3 uReliefColor;\nuniform float uSwapZ;',
      )
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'vec4 diffuseColor = vec4( vSculpoZ > uSwapZ + 0.001 ? uReliefColor : uBaseColor, opacity );',
      );
  };

  const model = new THREE.Mesh(new THREE.BufferGeometry(), material);
  model.castShadow = true;
  model.receiveShadow = true;
  model.visible = false;
  scene.add(model);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.target.copy(CAMERA_TARGET);
  controls.minDistance = 20;
  controls.maxDistance = 600;
  controls.update();

  let disposed = false;
  let frame = 0;
  let interacting = false;
  let lastRender = 0;
  let slowFrames = 0;
  let resetFrame = 0;

  const render = () => {
    frame = 0;
    if (disposed) return;
    const now = performance.now();
    // Durante a interação os quadros são consecutivos: dá para medir o fps.
    // Se cair abaixo de 30, a primeira coisa a sair são as sombras.
    if (interacting && renderer.shadowMap.enabled && lastRender > 0 && now - lastRender < 250) {
      slowFrames = now - lastRender > 1000 / MIN_FPS ? slowFrames + 1 : 0;
      if (slowFrames >= 12) {
        renderer.shadowMap.enabled = false;
        sun.castShadow = false;
        floor.visible = false;
        material.needsUpdate = true;
      }
    }
    lastRender = now;
    renderer.render(scene, camera);
  };
  const requestRender = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(render);
  };

  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', () => { interacting = true; slowFrames = 0; });
  controls.addEventListener('end', () => { interacting = false; });

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return {
    setMesh(mesh, colorSwapZ) {
      uniforms.uSwapZ.value = colorSwapZ;
      const old = model.geometry;
      if (!mesh) {
        model.visible = false;
        model.geometry = new THREE.BufferGeometry();
      } else {
        const indexed = new THREE.BufferGeometry();
        indexed.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
        indexed.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
        // Relevo suave, paredes nítidas.
        const creased = toCreasedNormals(indexed, CREASE_ANGLE);
        indexed.dispose();
        creased.computeBoundingBox();
        const box = creased.boundingBox!;
        // A geometria mantém a origem do STL; quem centraliza é o mesh.
        model.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
        model.geometry = creased;
        model.visible = true;
      }
      old.dispose();
      requestRender();
    },

    setColors(baseHex, reliefHex) {
      uniforms.uBaseColor.value.set(baseHex);
      uniforms.uReliefColor.value.set(reliefHex);
      requestRender();
    },

    resetCamera(animate) {
      cancelAnimationFrame(resetFrame);
      if (!animate) {
        camera.position.copy(CAMERA_POS);
        controls.target.copy(CAMERA_TARGET);
        controls.update();
        requestRender();
        return;
      }
      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();
      const t0 = performance.now();
      const step = () => {
        if (disposed) return;
        const t = Math.min(1, (performance.now() - t0) / RESET_MS);
        const k = t * t * (3 - 2 * t); // suaviza início e fim
        camera.position.lerpVectors(fromPos, CAMERA_POS, k);
        controls.target.lerpVectors(fromTarget, CAMERA_TARGET, k);
        controls.update();
        requestRender();
        if (t < 1) resetFrame = requestAnimationFrame(step);
      };
      resetFrame = requestAnimationFrame(step);
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resetFrame);
      observer.disconnect();
      controls.dispose();
      model.geometry.dispose();
      material.dispose();
      floor.geometry.dispose();
      floor.material.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
