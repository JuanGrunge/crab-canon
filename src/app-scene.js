import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildMoebiusGeometry, buildCylinderGeometry } from './moebius/geometry.js';
import { buildHalfNotationTexture } from './moebius/notation-texture.js';
import { createGlowMaterial } from './moebius/glow-material.js';
import { createGlowHalo } from './moebius/glow-halo.js';
import { createMoebiusGlow } from './moebius/moebius-glow.js';
import { createChaseCamera } from './moebius/chase-camera.js';
import { transportReady } from './shared/app-transport.js';
import { DATA_URL, MOEBIUS_PX_TO_WORLD_SCALE, GLOW } from './shared/config.js';
import { computeLayout } from './shared/layout.js';

const width = 2.76;

// Techo de pixel ratio para limitar el costo de render en hardware mobile
const cappedPixelRatio = Math.min(window.devicePixelRatio, 1.5);

const moebiusResponse = await fetch(DATA_URL);
const moebiusData = await moebiusResponse.json();

const masterLayout = computeLayout(
  { voice_1: moebiusData.voice_1 },
  moebiusData.meta,
  { includeClefReserve: false, includeEndReserve: false, includeLeftMargin: false },
);
const HALF_COUNT = masterLayout.measureCount / 2;
const uniformMeasureWidth = masterLayout.totalContentWidth / masterLayout.measureCount;
const uniformLayout = {
  ...masterLayout,
  measureWidths: masterLayout.measureWidths.map(() => uniformMeasureWidth),
  measureX: masterLayout.measureWidths.map((_, i) => i * uniformMeasureWidth),
};

const halfWidth = uniformMeasureWidth * HALF_COUNT;
const radius = (halfWidth * MOEBIUS_PX_TO_WORLD_SCALE) / (2 * Math.PI);

const { texture: textureA, uvMap: uvMapA } = await buildHalfNotationTexture({
  layout: uniformLayout, meta: moebiusData.meta, measureStart: 0, measureEnd: HALF_COUNT, verticalOffset: 0,
});
const { texture: textureB, uvMap: uvMapB } = await buildHalfNotationTexture({
  layout: uniformLayout, meta: moebiusData.meta, measureStart: HALF_COUNT, measureEnd: masterLayout.measureCount, verticalOffset: 10,
});

const { geometry } = buildMoebiusGeometry({ radius, width, segments: 400, crossSegments: 16 });

const frontGlowUniforms = {
  uActiveUV: { value: new THREE.Vector2(-10, -10) },
  uGlowIntensity: { value: 0 },
  uGlowColor: { value: new THREE.Color(GLOW.colorByVoice.voice_1) },
};
const backGlowUniforms = {
  uActiveUV: { value: new THREE.Vector2(-10, -10) },
  uGlowIntensity: { value: 0 },
  uGlowColor: { value: new THREE.Color(GLOW.colorByVoice.voice_1) },
};
const voice2GlowUniformsA = {
  uActiveUV: { value: new THREE.Vector2(-10, -10) },
  uGlowIntensity: { value: 0 },
  uGlowColor: { value: new THREE.Color(GLOW.colorByVoice.voice_2) },
};
const voice2GlowUniformsB = {
  uActiveUV: { value: new THREE.Vector2(-10, -10) },
  uGlowIntensity: { value: 0 },
  uGlowColor: { value: new THREE.Color(GLOW.colorByVoice.voice_2) },
};
const textureAAspect = textureA.image.width / textureA.image.height;
const textureBAspect = textureB.image.width / textureB.image.height;

const frontMaterial = createGlowMaterial({
  map: textureA, side: THREE.FrontSide, aspect: textureAAspect, sharedUniforms: frontGlowUniforms,
});
const backMaterial = createGlowMaterial({
  map: textureB, side: THREE.BackSide, aspect: textureBAspect, sharedUniforms: backGlowUniforms,
});

const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_LAYER);

const frontHalo = createGlowHalo({ radius, width, color: GLOW.colorByVoice.voice_1 });
const backHalo = createGlowHalo({ radius, width, color: GLOW.colorByVoice.voice_1 });
frontHalo.sprite.layers.enable(BLOOM_LAYER);
backHalo.sprite.layers.enable(BLOOM_LAYER);

const voice2HaloA = createGlowHalo({ radius, width, color: GLOW.colorByVoice.voice_2 });
const voice2HaloB = createGlowHalo({ radius, width, color: GLOW.colorByVoice.voice_2 });
voice2HaloA.sprite.layers.enable(BLOOM_LAYER);
voice2HaloB.sprite.layers.enable(BLOOM_LAYER);

transportReady.then((transport) => {
  // Glow independiente por mitad de la cinta
  createMoebiusGlow({ transport, uvMap: uvMapA, sharedUniforms: frontGlowUniforms, voiceId: 'voice_1', halo: frontHalo, side: 1 });
  createMoebiusGlow({ transport, uvMap: uvMapB, sharedUniforms: backGlowUniforms, voiceId: 'voice_1', halo: backHalo, side: -1 });

  createMoebiusGlow({
    transport, uvMap: uvMapA, sharedUniforms: voice2GlowUniformsA, voiceId: 'voice_2', halo: voice2HaloA, side: 1,
    resolveUv: (note) => uvMapA.get(moebiusData.meta.total_ticks - note.tick_end),
  });
  createMoebiusGlow({
    transport, uvMap: uvMapB, sharedUniforms: voice2GlowUniformsB, voiceId: 'voice_2', halo: voice2HaloB, side: -1,
    resolveUv: (note) => uvMapB.get(moebiusData.meta.total_ticks - note.tick_end),
  });
});

// Modo Cilindro: variante sin torsión de la cinta
const CYLINDER_FIXED_TWIST = Math.PI / 2;
const fullWidth = uniformMeasureWidth * masterLayout.measureCount;
const cylRadius = (fullWidth * MOEBIUS_PX_TO_WORLD_SCALE) / (2 * Math.PI);

const { texture: cylFrontTexture, uvMap: cylFrontUvMap } = await buildHalfNotationTexture({
  layout: uniformLayout, meta: moebiusData.meta, measureStart: 0, measureEnd: masterLayout.measureCount, voiceId: 'voice_1',
});
const { texture: cylBackTexture, uvMap: cylBackUvMap } = await buildHalfNotationTexture({
  layout: uniformLayout, meta: moebiusData.meta, measureStart: 0, measureEnd: masterLayout.measureCount, voiceId: 'voice_2',
});

const { geometry: cylGeometry } = buildCylinderGeometry({ radius: cylRadius, width, segments: 400, crossSegments: 16 });

const cylFrontGlowUniforms = {
  uActiveUV: { value: new THREE.Vector2(-10, -10) },
  uGlowIntensity: { value: 0 },
  uGlowColor: { value: new THREE.Color(GLOW.colorByVoice.voice_1) },
};
const cylBackGlowUniforms = {
  uActiveUV: { value: new THREE.Vector2(-10, -10) },
  uGlowIntensity: { value: 0 },
  uGlowColor: { value: new THREE.Color(GLOW.colorByVoice.voice_2) },
};
const cylFrontTextureAspect = cylFrontTexture.image.width / cylFrontTexture.image.height;
const cylBackTextureAspect = cylBackTexture.image.width / cylBackTexture.image.height;

const cylFrontMaterial = createGlowMaterial({
  map: cylFrontTexture, side: THREE.FrontSide, aspect: cylFrontTextureAspect, sharedUniforms: cylFrontGlowUniforms, polygonOffsetFactor: 1,
});
const cylBackMaterial = createGlowMaterial({
  map: cylBackTexture, side: THREE.BackSide, aspect: cylBackTextureAspect, sharedUniforms: cylBackGlowUniforms, polygonOffsetFactor: -1,
});

const cylFrontHalo = createGlowHalo({ radius: cylRadius, width, color: GLOW.colorByVoice.voice_1, fixedTwist: CYLINDER_FIXED_TWIST });
const cylBackHalo = createGlowHalo({ radius: cylRadius, width, color: GLOW.colorByVoice.voice_2, fixedTwist: CYLINDER_FIXED_TWIST });
cylFrontHalo.sprite.layers.enable(BLOOM_LAYER);
cylBackHalo.sprite.layers.enable(BLOOM_LAYER);

transportReady.then((transport) => {
  createMoebiusGlow({ transport, uvMap: cylFrontUvMap, sharedUniforms: cylFrontGlowUniforms, voiceId: 'voice_1', halo: cylFrontHalo, side: 1 });
  createMoebiusGlow({ transport, uvMap: cylBackUvMap, sharedUniforms: cylBackGlowUniforms, voiceId: 'voice_2', halo: cylBackHalo, side: -1 });
});

const cylFrontMesh = new THREE.Mesh(cylGeometry, cylFrontMaterial);
const cylBackMesh = new THREE.Mesh(cylGeometry, cylBackMaterial);

// Modo activo: qué objetos están montados en la escena en cada momento
let activeMode = 'mobius';
const modeObjects = {
  mobius: [new THREE.Mesh(geometry, frontMaterial), new THREE.Mesh(geometry, backMaterial), frontHalo.sprite, backHalo.sprite, voice2HaloA.sprite, voice2HaloB.sprite],
  cylinder: [cylFrontMesh, cylBackMesh, cylFrontHalo.sprite, cylBackHalo.sprite],
};
const modeTitle = { mobius: 'Cinta Möbius', cylinder: 'Cilindro Palíndromo' };
const modeToggleLabel = { mobius: 'Cilindro', cylinder: 'Möbius' };

const scene = new THREE.Scene();
modeObjects[activeMode].forEach((obj) => scene.add(obj));

const moebiusApp = document.getElementById('moebius-app');
const FOV_DEG = 50;
const camera = new THREE.PerspectiveCamera(FOV_DEG, moebiusApp.clientWidth / moebiusApp.clientHeight, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(moebiusApp.clientWidth, moebiusApp.clientHeight);
renderer.setPixelRatio(cappedPixelRatio);
moebiusApp.appendChild(renderer.domElement);

const controls = new TrackballControls(camera, renderer.domElement);
controls.staticMoving = false;
controls.dynamicDampingFactor = 0.15;
controls.rotateSpeed = 3.0;
controls.noZoom = false;
controls.noPan = false;
controls.minDistance = 0.1;
controls.maxDistance = 1000;

const AUTO_ROTATE_SPEED = 0.0015;
let autoRotating = false;
const autoRotateBtn = document.getElementById('auto-rotate-btn');
autoRotateBtn.addEventListener('click', () => {
  autoRotating = !autoRotating;
  autoRotateBtn.classList.toggle('active', autoRotating);
});

const modeToggleBtn = document.getElementById('mode-toggle-btn');
const modeTitleEl = document.querySelector('[data-field="mode-title"]');

function setMode(nextMode) {
  modeObjects[activeMode].forEach((obj) => scene.remove(obj));
  activeMode = nextMode;
  modeObjects[activeMode].forEach((obj) => scene.add(obj));
  modeTitleEl.textContent = modeTitle[activeMode];
  modeToggleBtn.textContent = modeToggleLabel[activeMode];
  chase1.update();
  chase2.update();
}

modeToggleBtn.addEventListener('click', () => {
  setMode(activeMode === 'mobius' ? 'cylinder' : 'mobius');
});

geometry.computeBoundingBox();
const overviewTarget = new THREE.Vector3();
geometry.boundingBox.getCenter(overviewTarget);
const viewDirection = new THREE.Vector3(0, 0.9, 1.3).normalize();
const boundingRadius = radius + width;

const BLOOM_STRENGTH = 0.35;
const BLOOM_RADIUS = 0.4;
const BLOOM_THRESHOLD = 0.15;
const darkMaterial = new THREE.MeshBasicMaterial({ color: 'black' });
const materialCache = {};
function darkenNonBloomed(obj) {
  if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
    materialCache[obj.uuid] = obj.material;
    obj.material = darkMaterial;
  }
}
function restoreMaterial(obj) {
  if (materialCache[obj.uuid]) {
    obj.material = materialCache[obj.uuid];
    delete materialCache[obj.uuid];
  }
}

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(moebiusApp.clientWidth, moebiusApp.clientHeight), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD);
bloomComposer.addPass(bloomPass);

const mixPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) ); }`,
  }),
  'baseTexture',
);

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(new RenderPass(scene, camera));
finalComposer.addPass(mixPass);
finalComposer.addPass(new OutputPass());

function fitCameraToViewport() {
  if (moebiusApp.clientWidth === 0 || moebiusApp.clientHeight === 0) return;
  camera.aspect = moebiusApp.clientWidth / moebiusApp.clientHeight;
  const vFovRad = (camera.fov * Math.PI) / 180;
  const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * camera.aspect);
  const distV = boundingRadius / Math.sin(vFovRad / 2);
  const distH = boundingRadius / Math.sin(hFovRad / 2);
  const distance = Math.max(distV, distH) * 1.15;

  camera.position.copy(overviewTarget).addScaledVector(viewDirection, distance);
  controls.target.copy(overviewTarget);
  camera.lookAt(overviewTarget);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  const corners = [
    new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, -1, -1),
    new THREE.Vector3(-1, 1, -1), new THREE.Vector3(1, 1, -1),
    new THREE.Vector3(-1, -1, 1), new THREE.Vector3(1, -1, 1),
    new THREE.Vector3(-1, 1, 1), new THREE.Vector3(1, 1, 1),
  ].map((c) => geometry.boundingBox.min.clone().lerp(geometry.boundingBox.max, 0.5).add(
    new THREE.Vector3(
      c.x * (geometry.boundingBox.max.x - geometry.boundingBox.min.x) / 2,
      c.y * (geometry.boundingBox.max.y - geometry.boundingBox.min.y) / 2,
      c.z * (geometry.boundingBox.max.z - geometry.boundingBox.min.z) / 2,
    ),
  ));
  const projected = corners.map((c) => c.clone().project(camera));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));
  const ndcYOffset = (minY + maxY) / 2;
  const worldUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
  const shift = ndcYOffset * distance * Math.tan(vFovRad / 2);
  overviewTarget.addScaledVector(worldUp, shift);

  camera.position.copy(overviewTarget).addScaledVector(viewDirection, distance);
  controls.target.copy(overviewTarget);
  camera.lookAt(overviewTarget);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  renderer.setSize(moebiusApp.clientWidth, moebiusApp.clientHeight);
  controls.handleResize();
  bloomComposer.setSize(moebiusApp.clientWidth, moebiusApp.clientHeight);
  finalComposer.setSize(moebiusApp.clientWidth, moebiusApp.clientHeight);
}

fitCameraToViewport();

const chaseVoice1Container = document.getElementById('moebius-chase-voice1');
const chaseVoice2Container = document.getElementById('moebius-chase-voice2');

const transport = await transportReady;

// Targets de cámara según el modo activo (Moebius/Cilindro)
const chase1Targets = () => (activeMode === 'mobius'
  ? [{ uniforms: frontGlowUniforms, side: 1 }, { uniforms: backGlowUniforms, side: -1 }]
  : [{ uniforms: cylFrontGlowUniforms, side: 1 }]);
const chase2Targets = () => (activeMode === 'mobius'
  ? [{ uniforms: voice2GlowUniformsA, side: 1 }, { uniforms: voice2GlowUniformsB, side: -1 }]
  : [{ uniforms: cylBackGlowUniforms, side: -1 }]);
const getActiveTwistParams = () => (activeMode === 'mobius' ? { twistTurns: 0.5 } : { fixedTwist: CYLINDER_FIXED_TWIST });
const getActiveRadius = () => (activeMode === 'mobius' ? radius : cylRadius);

const chase1 = createChaseCamera({
  transport,
  targets: chase1Targets,
  getTwistParams: getActiveTwistParams,
  radius: getActiveRadius, width, aspect: chaseVoice1Container.clientWidth / chaseVoice1Container.clientHeight,
});
const chase2 = createChaseCamera({
  transport,
  targets: chase2Targets,
  getTwistParams: getActiveTwistParams,
  radius: getActiveRadius, width, aspect: chaseVoice2Container.clientWidth / chaseVoice2Container.clientHeight,
});

const theta1El = document.querySelector('[data-field="theta-1"]');
const twist1El = document.querySelector('[data-field="twist-1"]');
const uv1El = document.querySelector('[data-field="uv-1"]');
const theta2El = document.querySelector('[data-field="theta-2"]');
const twist2El = document.querySelector('[data-field="twist-2"]');
const uv2El = document.querySelector('[data-field="uv-2"]');

function updateMathReadout(camera, thetaEl, twistEl, uvEl) {
  const u = camera.getU();
  const v = camera.getV();
  const theta = u * 360;
  const twist = theta / 2; // torsión de la cinta
  thetaEl.textContent = `θ ${theta.toFixed(1)}°`;
  twistEl.textContent = `torsión ${twist.toFixed(1)}°`;
  uvEl.textContent = `(u, v) = (${u.toFixed(3)}, ${v.toFixed(3)})`;
}

const centralCounterEl = document.querySelector('[data-field="measure-counter"]');
const transportStateEl = document.querySelector('[data-field="transport-state"]');
const transportTickEl = document.querySelector('[data-field="transport-tick"]');
const transportBpmEl = document.querySelector('[data-field="transport-bpm"]');
const tempoSliderEl = document.getElementById('tempo-slider');
const TRANSPORT_STATE_LABELS = { playing: 'Play', paused: 'Pause', stopped: 'Stop' };

function updateCentralMeasureCounter() {
  const ticks = transport.getTicks();
  const measureIndex = Math.min(
    Math.floor(ticks / masterLayout.ticksPerMeasure) + 1,
    masterLayout.measureCount,
  );
  centralCounterEl.textContent = `Compás ${measureIndex} / ${masterLayout.measureCount}`;
  transportStateEl.textContent = `Estado ${TRANSPORT_STATE_LABELS[transport.getState()]}`;
  transportTickEl.textContent = `Tick ${ticks} / ${moebiusData.meta.total_ticks}`;
  transportBpmEl.textContent = `BPM ${tempoSliderEl.value}`;
}

function createChaseRenderPipeline(container, chaseCamera) {
  const chaseRenderer = new THREE.WebGLRenderer({ antialias: true });
  chaseRenderer.setSize(container.clientWidth, container.clientHeight);
  chaseRenderer.setPixelRatio(cappedPixelRatio);
  container.appendChild(chaseRenderer.domElement);

  function resize() {
    chaseCamera.aspect = container.clientWidth / container.clientHeight;
    chaseCamera.updateProjectionMatrix();
    chaseRenderer.setSize(container.clientWidth, container.clientHeight);
  }

  function render() {
    chaseRenderer.render(scene, chaseCamera);
  }

  return { renderer: chaseRenderer, resize, render };
}

const chase1Pipeline = createChaseRenderPipeline(chaseVoice1Container, chase1.camera);
const chase2Pipeline = createChaseRenderPipeline(chaseVoice2Container, chase2.camera);

const chase1Canvas = chaseVoice1Container.querySelector('canvas');
const chase2Canvas = chaseVoice2Container.querySelector('canvas');

function applyMirror(canvasEl, side) {
  canvasEl.style.transform = side < 0 ? 'scaleX(-1)' : 'none';
}

let lastMoebiusW = moebiusApp.clientWidth;
let lastMoebiusH = moebiusApp.clientHeight;
let lastChase1W = chaseVoice1Container.clientWidth;
let lastChase1H = chaseVoice1Container.clientHeight;
let lastChase2W = chaseVoice2Container.clientWidth;
let lastChase2H = chaseVoice2Container.clientHeight;

let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);
  frameCount++;

  if (moebiusApp.clientWidth !== lastMoebiusW || moebiusApp.clientHeight !== lastMoebiusH) {
    lastMoebiusW = moebiusApp.clientWidth;
    lastMoebiusH = moebiusApp.clientHeight;
    fitCameraToViewport();
  }
  if (chaseVoice1Container.clientWidth !== lastChase1W || chaseVoice1Container.clientHeight !== lastChase1H) {
    lastChase1W = chaseVoice1Container.clientWidth;
    lastChase1H = chaseVoice1Container.clientHeight;
    chase1Pipeline.resize();
  }
  if (chaseVoice2Container.clientWidth !== lastChase2W || chaseVoice2Container.clientHeight !== lastChase2H) {
    lastChase2W = chaseVoice2Container.clientWidth;
    lastChase2H = chaseVoice2Container.clientHeight;
    chase2Pipeline.resize();
  }

  if (autoRotating) {
    const offset = camera.position.clone().sub(controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), AUTO_ROTATE_SPEED);
    camera.position.copy(controls.target).add(offset);
  }
  controls.update();
  scene.traverse(darkenNonBloomed);
  bloomComposer.render();
  scene.traverse(restoreMaterial);
  finalComposer.render();
  if (frameCount % 2 === 0) {
    chase1Pipeline.render();
    chase2Pipeline.render();
  }
  applyMirror(chase1Canvas, chase1.getSide());
  applyMirror(chase2Canvas, chase2.getSide());
  updateMathReadout(chase1, theta1El, twist1El, uv1El);
  updateMathReadout(chase2, theta2El, twist2El, uv2El);
  updateCentralMeasureCounter();
}
animate();
