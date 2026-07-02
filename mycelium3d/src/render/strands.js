// =============================================================================
// StrandRenderer — the living mycelial network as instanced luminous strands.
//
// REUSABLE per network: one instance per Network object. Each parent->child
// edge is one instanced cylinder, tapered by subtree size (thick trunks, fine
// tips) and coloured by state (cream = healthy, sickly green = infected by
// the mould). Tips carry an additive glow; nutrient pulses ride the filaments.
//
// The instance buffers rebuild only when the structure changes (grow /
// amputate / prune / infect) — every action marks it dirty.
// =============================================================================

import * as THREE from 'three';
import { glowTexture } from './scene.js';

const MAX_PULSES = 42;

export class StrandRenderer {
  constructor(network, config, scene) {
    this.network = network;
    this.config = config;
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.structureDirty = true;
    this.edges = [];   // cached for pulse animation {ax,ay,az,bx,by,bz,len,infected}

    const cap = config.growth.maxNodes + 8;
    this.capacity = cap;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    const mat = new THREE.MeshBasicMaterial({});
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.group.add(this.mesh);

    // Tip glow points.
    this.tipGeo = new THREE.BufferGeometry();
    this.tipGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    const tipMat = new THREE.PointsMaterial({
      color: new THREE.Color(config.render.tipGlow), size: 9, sizeAttenuation: true,
      map: glowTexture(), transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.tips = new THREE.Points(this.tipGeo, tipMat);
    this.tipGeo.setDrawRange(0, 0);
    this.group.add(this.tips);

    // Body glow: a faint additive halo at EVERY healthy node, so the living
    // network stays readable from across the dark volume (the 3D analogue of
    // the 2D game's light layer). Infected strands drop out of the glow.
    this.glowGeo = new THREE.BufferGeometry();
    this.glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
    const glowMat = new THREE.PointsMaterial({
      color: new THREE.Color(config.render.filament), size: 11, sizeAttenuation: true,
      map: glowTexture(), transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.glow = new THREE.Points(this.glowGeo, glowMat);
    this.glowGeo.setDrawRange(0, 0);
    this.group.add(this.glow);

    // Nutrient pulses riding the filaments.
    this.pulseGeo = new THREE.BufferGeometry();
    this.pulseGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PULSES * 3), 3));
    const pulseMat = new THREE.PointsMaterial({
      color: new THREE.Color(config.render.pulseColor), size: 7, sizeAttenuation: true,
      map: glowTexture(), transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.pulses = new THREE.Points(this.pulseGeo, pulseMat);
    this.pulseGeo.setDrawRange(0, 0);
    this.group.add(this.pulses);
    this._pulseState = [];
    for (let i = 0; i < MAX_PULSES; i++) this._pulseState.push({ edge: -1, t: Math.random() });
  }

  markStructureDirty() { this.structureDirty = true; }

  dispose() {
    this.scene.remove(this.group);
    this.mesh.geometry.dispose(); this.mesh.material.dispose();
    this.tipGeo.dispose(); this.tips.material.dispose();
    this.glowGeo.dispose(); this.glow.material.dispose();
    this.pulseGeo.dispose(); this.pulses.material.dispose();
  }

  _rebuild() {
    const net = this.network;
    const r = this.config.render;
    // Subtree sizes for organic tapering (thick trunk -> thin tips).
    const size = new Map();
    for (const n of net.nodes) size.set(n.id, 1);
    for (let i = net.nodes.length - 1; i >= 0; i--) {
      const n = net.nodes[i];
      if (n.parentId != null) {
        size.set(n.parentId, (size.get(n.parentId) || 1) + (size.get(n.id) || 1));
      }
    }

    const healthy = new THREE.Color(r.filament);
    const trunk = new THREE.Color(r.filamentTrunk);
    const infected = new THREE.Color(r.infected);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    const tmp = new THREE.Color();

    this.edges.length = 0;
    let i = 0;
    const tipPos = this.tipGeo.attributes.position;
    const glowPos = this.glowGeo.attributes.position;
    let tipCount = 0, glowCount = 0;
    const AGE_FULL = 7;

    for (const n of net.nodes) {
      if (n.children.length === 0 && !n.infected && tipCount < tipPos.count) {
        tipPos.setXYZ(tipCount++, n.x, n.y, n.z);
      }
      if (!n.infected && glowCount < glowPos.count) {
        glowPos.setXYZ(glowCount++, n.x, n.y, n.z);
      }
      if (n.parentId == null) continue;
      const p = net.byId.get(n.parentId);
      if (!p) continue;
      dir.set(n.x - p.x, n.y - p.y, n.z - p.z);
      const len = dir.length();
      if (len < 1e-3) continue;
      dir.divideScalar(len);
      q.setFromUnitVectors(up, dir);
      v.set((n.x + p.x) / 2, (n.y + p.y) / 2, (n.z + p.z) / 2);
      const s = size.get(n.id) || 1;
      const ageF = Math.min(1, n.age / AGE_FULL);
      const radius = (0.9 + Math.log1p(s) * 0.75) * (0.7 + 0.3 * ageF);
      sv.set(Math.min(5.5, radius), len, Math.min(5.5, radius));
      m.compose(v, q, sv);
      this.mesh.setMatrixAt(i, m);
      if (n.infected) tmp.copy(infected).multiplyScalar(0.8);
      else tmp.lerpColors(trunk, healthy, Math.min(1, 1.2 - Math.log1p(s) * 0.12));
      this.mesh.setColorAt(i, tmp);
      this.edges.push({ ax: p.x, ay: p.y, az: p.z, bx: n.x, by: n.y, bz: n.z, len, infected: n.infected });
      i++;
      if (i >= this.capacity) break;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    tipPos.needsUpdate = true;
    this.tipGeo.setDrawRange(0, tipCount);
    this.tipGeo.computeBoundingSphere();
    glowPos.needsUpdate = true;
    this.glowGeo.setDrawRange(0, glowCount);
    this.glowGeo.computeBoundingSphere();
    this.mesh.computeBoundingSphere?.();
    this.structureDirty = false;

    // Re-home pulses onto valid healthy edges.
    for (const ps of this._pulseState) {
      if (ps.edge < 0 || ps.edge >= this.edges.length || this.edges[ps.edge].infected) {
        ps.edge = this._pickEdge();
        ps.t = Math.random();
      }
    }
  }

  _pickEdge() {
    if (!this.edges.length) return -1;
    for (let tries = 0; tries < 6; tries++) {
      const k = (Math.random() * this.edges.length) | 0;
      if (!this.edges[k].infected) return k;
    }
    return -1;
  }

  update(time, dt) {
    if (this.structureDirty) this._rebuild();
    // animate pulses along edges
    const pos = this.pulseGeo.attributes.position;
    let count = 0;
    const speed = 60;   // world units / sec
    for (const ps of this._pulseState) {
      if (ps.edge < 0 || ps.edge >= this.edges.length) { ps.edge = this._pickEdge(); ps.t = 0; if (ps.edge < 0) continue; }
      const e = this.edges[ps.edge];
      ps.t += (speed * dt) / Math.max(1, e.len);
      if (ps.t >= 1) { ps.edge = this._pickEdge(); ps.t = 0; continue; }
      pos.setXYZ(count++,
        e.ax + (e.bx - e.ax) * ps.t,
        e.ay + (e.by - e.ay) * ps.t,
        e.az + (e.bz - e.az) * ps.t);
    }
    pos.needsUpdate = true;
    this.pulseGeo.setDrawRange(0, count);
    // gentle tip breathing
    this.tips.material.opacity = 0.65 + 0.25 * Math.sin(time * 0.0021);
  }
}
