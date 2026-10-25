import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Global state
let scene, camera, renderer, controls;
let logoRootGroup = null;
let keyLight, fillLight, rimLight, spherePointLight, ambientLight;
let pmremEnvMap = null;
let textures = {};

const container = document.getElementById('canvas-container');

// Camera preset positions (Logo is centered at 0, 0, 0, width ~8 units)
const CAMERA_PRESETS = {
  front: { pos: new THREE.Vector3(0, 0, 11.5), target: new THREE.Vector3(0, 0, 0) },
  perspective: { pos: new THREE.Vector3(5.8, 3.2, 10.2), target: new THREE.Vector3(0, 0, 0) },
  closeup: { pos: new THREE.Vector3(1.2, 0.4, 4.2), target: new THREE.Vector3(0, 0.2, 0.2) }
};

let isAutoRotating = true;
let rotateSpeedVal = 0.8;
let currentBg = 'studio';

async function init() {
  try {
    scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.copy(CAMERA_PRESETS.front.pos);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.70;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = rotateSpeedVal;
    controls.maxDistance = 50;
    controls.minDistance = 2;

    setupLights();
    await loadTextures();
    await loadLogoGLB();
    setupEventListeners();
    animate();
  } catch (err) {
    console.error("Studio initialization error:", err);
  }
}

function setupLights() {
  // Key Light (Warm Champagne Gold)
  keyLight = new THREE.DirectionalLight(0xfff5e4, 4.2);
  keyLight.position.set(-5, 7, 10);
  keyLight.castShadow = true;
  keyLight.shadow.bias = -0.0001;
  scene.add(keyLight);

  // Front Specular Fill Light (Direct gleam on brushed face)
  const frontLight = new THREE.DirectionalLight(0xfffaee, 3.5);
  frontLight.position.set(0, 2, 10);
  scene.add(frontLight);

  // Rim Light (Brilliant Specular Edge Highlights along apex and crest)
  rimLight = new THREE.DirectionalLight(0xffffff, 5.2);
  rimLight.position.set(0, 9, -6);
  scene.add(rimLight);

  // Bottom Bounce Light (Warm Gold underside illumination)
  const bottomLight = new THREE.DirectionalLight(0xe8ba60, 2.4);
  bottomLight.position.set(0, -6, 6);
  scene.add(bottomLight);

  // Fill Light (Side depth)
  fillLight = new THREE.DirectionalLight(0xd4af37, 2.0);
  fillLight.position.set(7, -2, 8);
  scene.add(fillLight);

  // Sphere Core Light (Glowing point inside the orb)
  spherePointLight = new THREE.PointLight(0xffbe40, 6.0, 12.0, 1.0);
  spherePointLight.position.set(0, -0.42, 0.45);
  scene.add(spherePointLight);

  // Ambient Light
  ambientLight = new THREE.AmbientLight(0x48361e, 1.2);
  scene.add(ambientLight);

  // High-Luminance Procedural Studio Reflection Environment Map
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x221a12);

  // Overhead Softbox
  const p1 = new THREE.PointLight(0xfffaec, 48, 60);
  p1.position.set(-12, 18, 16);
  envScene.add(p1);

  // Rear Rim Softbox
  const p2 = new THREE.PointLight(0xffeed4, 42, 60);
  p2.position.set(16, 14, -12);
  envScene.add(p2);

  // Top Bank
  const p3 = new THREE.PointLight(0xffffff, 50, 60);
  p3.position.set(0, 22, 8);
  envScene.add(p3);

  // Golden Side Bounces
  const p4 = new THREE.PointLight(0xdaa520, 32, 60);
  p4.position.set(-16, -6, 12);
  envScene.add(p4);
  const p5 = new THREE.PointLight(0xdaa520, 32, 60);
  p5.position.set(16, -6, 12);
  envScene.add(p5);

  pmremEnvMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  scene.environment = pmremEnvMap;
}

async function loadTextures() {
  const loader = new THREE.TextureLoader();
  const loadTex = (url) => new Promise((resolve) => {
    loader.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    }, undefined, () => resolve(null));
  });

  const corona = await loadTex('/sphere_corona.png');
  textures = { corona };
}

function loadLogoGLB() {
  if (logoRootGroup) {
    scene.remove(logoRootGroup);
    logoRootGroup = null;
  }
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      '/AccuMedic_Logo_3D.glb',
      (gltf) => {
        logoRootGroup = gltf.scene;

        // Tune materials for ultra-smooth polished metallic mirror sheen
        logoRootGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.envMapIntensity = 3.5;
              child.material.metalness = 0.88;
              child.material.roughness = 0.04;
              child.material.normalMap = null; // Mirror-smooth surface without grain or bumpiness
              child.material.needsUpdate = true;
            }
          }
        });

        // Add Glowing Corona Halo behind sphere
        if (textures.corona) {
          const coronaGeom = new THREE.PlaneGeometry(0.585 * 4.6, 0.585 * 4.6);
          const coronaMat = new THREE.MeshBasicMaterial({
            map: textures.corona,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            opacity: 0.95
          });
          const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
          coronaMesh.position.set(0, -0.42, 0.12);
          coronaMesh.name = 'Sphere_Corona_Halo';
          logoRootGroup.add(coronaMesh);
        }

        scene.add(logoRootGroup);
        console.log("AccuMedic shining 3D logo loaded in center!");
        resolve();
      },
      undefined,
      (err) => {
        console.error("Failed to load GLB:", err);
        reject(err);
      }
    );
  });
}

function setupEventListeners() {
  window.addEventListener('resize', onWindowResize);

  // Rotation Toggle
  const btnRotate = document.getElementById('btn-toggle-rotate');
  btnRotate.addEventListener('click', () => {
    isAutoRotating = !isAutoRotating;
    controls.autoRotate = isAutoRotating;
    btnRotate.classList.toggle('active', isAutoRotating);
    btnRotate.querySelector('span').textContent = isAutoRotating ? 'Rotating' : 'Paused';
  });

  // Rotation Speed Slider
  const speedSlider = document.getElementById('rotate-speed');
  speedSlider.addEventListener('input', (e) => {
    rotateSpeedVal = parseFloat(e.target.value);
    controls.autoRotateSpeed = rotateSpeedVal;
  });

  // Camera Presets
  document.getElementById('btn-view-front').addEventListener('click', () => {
    setCameraPreset(CAMERA_PRESETS.front);
  });
  document.getElementById('btn-view-perspective').addEventListener('click', () => {
    setCameraPreset(CAMERA_PRESETS.perspective);
  });
  document.getElementById('btn-view-closeup').addEventListener('click', () => {
    setCameraPreset(CAMERA_PRESETS.closeup);
  });

  // Light Warmth
  document.getElementById('light-warmth').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    keyLight.color.setHSL(0.1 + val * 0.05, 0.6 + val * 0.4, 0.9);
  });

  // Light Shine (Environment Reflection & Exposure)
  document.getElementById('light-shine').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    renderer.toneMappingExposure = 1.0 + val * 0.45;
    if (logoRootGroup) {
      logoRootGroup.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.envMapIntensity = val * 1.8;
          child.material.needsUpdate = true;
        }
      });
    }
  });

  // Sphere Glow
  document.getElementById('sphere-glow').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    spherePointLight.intensity = val * 2.5;
    const halo = scene.getObjectByName('Sphere_Corona_Halo');
    if (halo) halo.material.opacity = val * 0.5;
  });

  // Background Toggles
  document.getElementById('btn-bg-studio').addEventListener('click', () => {
    setBgMode('studio');
  });
  document.getElementById('btn-bg-trans').addEventListener('click', () => {
    setBgMode('trans');
  });
  document.getElementById('btn-bg-white').addEventListener('click', () => {
    setBgMode('white');
  });

  // Export Buttons
  document.getElementById('btn-export-glb').addEventListener('click', exportGLB);
  document.getElementById('btn-export-png').addEventListener('click', exportPNG);
}

function setCameraPreset(preset) {
  controls.target.copy(preset.target);
  camera.position.copy(preset.pos);
  controls.update();
}

function setBgMode(mode) {
  currentBg = mode;
  ['btn-bg-studio', 'btn-bg-trans', 'btn-bg-white'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  document.getElementById(`btn-bg-${mode}`).classList.add('active');

  const viewport = document.getElementById('viewport-container');
  if (mode === 'studio') {
    viewport.style.background = 'radial-gradient(circle at 50% 45%, #181d28 0%, #090c12 70%, #040508 100%)';
    scene.background = null;
  } else if (mode === 'trans') {
    viewport.style.background = 'repeating-conic-gradient(#141720 0% 25%, #0d1017 0% 50%) 50% / 20px 20px';
    scene.background = null;
  } else if (mode === 'white') {
    viewport.style.background = '#ffffff';
    scene.background = new THREE.Color(0xffffff);
  }
}

function onWindowResize() {
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function exportGLB() {
  if (!logoRootGroup) return;
  const exporter = new GLTFExporter();
  exporter.parse(
    logoRootGroup,
    (glb) => {
      const blob = new Blob([glb], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'AccuMedic_Logo_3D.glb';
      a.click();
      URL.revokeObjectURL(url);
    },
    (err) => console.error("Export error:", err),
    { binary: true }
  );
}

function exportPNG() {
  const currentSceneBg = scene.background;
  scene.background = null; // Transparent background

  renderer.render(scene, camera);
  const dataURL = renderer.domElement.toDataURL('image/png');

  scene.background = currentSceneBg;

  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'AccuMedic_3D_Logo.png';
  a.click();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
