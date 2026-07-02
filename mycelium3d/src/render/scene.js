// =============================================================================
// Scene — three.js renderer, camera, lights, fog and the bloom composer.
// Pure view concern; never touches simulation state.
// =============================================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createScene(config, canvas) {
  const r = config.render;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(new THREE.Color(r.clearColor), 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color(r.fogColor), r.fogDensity);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 6000);

  // Lighting: a dim cool hemisphere (twilight filtering through the soil) plus
  // a soft warm headlamp on the camera so the fly-through stays readable.
  scene.add(new THREE.AmbientLight(new THREE.Color(r.ambient), 1.2));
  const hemi = new THREE.HemisphereLight(new THREE.Color(r.hemiSky), new THREE.Color(r.hemiGround), r.hemiIntensity * 1.6);
  scene.add(hemi);
  const headlamp = new THREE.PointLight(0xcfe3d8, 4200, 750, 2);
  camera.add(headlamp);
  scene.add(camera);

  // Bloom: the luminous network / food / beacons glow into the dark earth.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    r.bloomStrength, r.bloomRadius, r.bloomThreshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, composer, bloom, resize };
}

// A soft radial-gradient sprite texture (shared by glows, clouds, motes).
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}
