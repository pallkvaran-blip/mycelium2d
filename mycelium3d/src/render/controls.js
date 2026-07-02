// =============================================================================
// FlightControls — the smooth-drone fly-through camera + the targeting cursor.
//
// Click the view to capture the mouse; mouse-look with WASD to glide where
// you're looking, Space/C for up/down, Shift to boost. Gentle inertia, no
// roll, stops when you let go. The camera never leaves the underground volume
// and slides along rock instead of passing through it.
//
// Targeting: a glowing cursor floats at an adjustable distance along the view
// ray (mouse wheel). Targeted actions (Add Substrate / Amputate / Attack Ants)
// apply AT the cursor on click. Pure view/input concern — the sim is only
// touched through the onApply callback.
// =============================================================================

import * as THREE from 'three';
import { glowTexture } from './scene.js';

export class FlightControls {
  constructor(camera, canvas, substrate, config, scene) {
    this.camera = camera;
    this.canvas = canvas;
    this.sub = substrate;
    this.config = config;
    this.f = config.flight;

    this.yaw = 0; this.pitch = 0;
    this.vel = new THREE.Vector3();
    this.keys = new Set();
    this.locked = false;
    this.enabled = true;
    this.cursorDist = this.f.cursorStart;
    this.selectedAction = null;   // set by the UI; shapes the cursor
    this.onApply = null;          // cb(worldPoint) when a targeted click lands
    this.onLockChange = null;

    this._applyLook();   // main.js places the camera (goHome) right after construction

    this._buildCursor(scene);
    this._bind();
  }

  // --- the targeting cursor (a glowing orb + action-specific radius shell) ----
  _buildCursor(scene) {
    this.cursorGroup = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xbfffd0 })
    );
    this.cursorGroup.add(core);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: 0x9fe6b8, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.setScalar(26);
    this.cursorGroup.add(halo);
    // radius shell: shows the Amputate cut sphere / substrate drop footprint
    this.cursorShell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xe06a6a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })
    );
    this.cursorGroup.add(this.cursorShell);
    this.cursorGroup.visible = false;
    scene.add(this.cursorGroup);
  }

  _bind() {
    this.canvas.addEventListener('click', () => {
      if (!this.enabled) return;
      if (!this.locked) { this.canvas.requestPointerLock(); return; }
      // A locked click applies the armed targeted action at the cursor.
      if (this.selectedAction && this.onApply) this.onApply(this.cursorPoint());
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * this.f.lookSpeed;
      this.pitch -= e.movementY * this.f.lookSpeed;
      const lim = Math.PI / 2 - 0.02;
      this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
      this._applyLook();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = e.deltaY < 0 ? 1.09 : 1 / 1.09;
      this.cursorDist = Math.max(this.f.cursorMin, Math.min(this.f.cursorMax, this.cursorDist * k));
    }, { passive: false });
  }

  _applyLook() {
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  // The world point the cursor sits at (clamped inside the underground volume).
  cursorPoint() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const p = this.camera.position.clone().addScaledVector(dir, this.cursorDist);
    p.x = Math.max(4, Math.min(this.sub.worldWidth - 4, p.x));
    p.y = Math.max(-(this.sub.worldDepth - 4), Math.min(-4, p.y));
    p.z = Math.max(4, Math.min(this.sub.worldBreadth - 4, p.z));
    return p;
  }

  setSelectedAction(name) {
    this.selectedAction = name;
    const a = this.config.actions;
    if (name === 'amputate') {
      this.cursorShell.visible = true;
      this.cursorShell.scale.setScalar(a.amputate.radius);
      this.cursorShell.material.color.set(0xe06a6a);
      this.cursorShell.material.opacity = 0.16;
    } else if (name === 'addSubstrate') {
      this.cursorShell.visible = true;
      this.cursorShell.scale.setScalar((a.addSubstrate.radius + 0.5) * this.sub.cellSize);
      this.cursorShell.material.color.set(0xf2c96a);
      this.cursorShell.material.opacity = 0.12;
    } else if (name === 'attackAnts') {
      this.cursorShell.visible = true;
      this.cursorShell.scale.setScalar(a.attackAnts.pickRadius);
      this.cursorShell.material.color.set(0xe0a85a);
      this.cursorShell.material.opacity = 0.08;
    } else {
      this.cursorShell.visible = false;
    }
    this.cursorGroup.visible = !!name;
  }

  update(dt) {
    // --- flight ---
    if (this.enabled) {
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const target = new THREE.Vector3();
      if (this.locked) {
        if (this.keys.has('KeyW')) target.add(fwd);
        if (this.keys.has('KeyS')) target.addScaledVector(fwd, -1);
        if (this.keys.has('KeyA')) target.addScaledVector(right, -1);
        if (this.keys.has('KeyD')) target.add(right);
        if (this.keys.has('Space')) target.y += 1;
        if (this.keys.has('KeyC') || this.keys.has('ControlLeft')) target.y -= 1;
      }
      if (target.lengthSq() > 0) {
        target.normalize().multiplyScalar(this.f.speed * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? this.f.boost : 1));
      }
      const k = Math.min(1, this.f.accel * dt);
      this.vel.lerp(target, k);
      if (this.vel.lengthSq() > 0.01) this._move(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    }

    // --- cursor ---
    if (this.cursorGroup.visible) {
      const p = this.cursorPoint();
      this.cursorGroup.position.copy(p);
    }
  }

  // Move with axis-sliding collision against rock voxels + world bounds.
  _move(dx, dy, dz) {
    const cam = this.camera.position;
    const tryTo = (x, y, z) => {
      // world bounds (stay underground, inside the box)
      if (x < 6 || x > this.sub.worldWidth - 6) return false;
      if (y > -6 || y < -(this.sub.worldDepth - 6)) return false;
      if (z < 6 || z > this.sub.worldBreadth - 6) return false;
      const cell = this.sub.cellAtWorld(x, y, z);
      if (cell && cell.rock && !cell.water) return false;   // water is swimmable... but rock is rock
      return true;
    };
    if (tryTo(cam.x + dx, cam.y + dy, cam.z + dz)) { cam.set(cam.x + dx, cam.y + dy, cam.z + dz); return; }
    if (tryTo(cam.x + dx, cam.y, cam.z)) cam.x += dx;
    if (tryTo(cam.x, cam.y, cam.z + dz)) cam.z += dz;
    if (tryTo(cam.x, cam.y + dy, cam.z)) cam.y += dy;
  }
}
