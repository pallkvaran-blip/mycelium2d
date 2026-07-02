// =============================================================================
// TerrainRenderer — the underground volume: the surface seen from below, rock
// voxels, the lake bowl, glowing food caches, beacons, dust motes and bounds.
//
// Static geometry is built once per map; only the FOOD instancing refreshes
// after actions (piles shrink as they're eaten / digested / harvested).
// =============================================================================

import * as THREE from 'three';
import { glowTexture } from './scene.js';

// Small deterministic hash noise for craggy vertex displacement.
function hashf(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class TerrainRenderer {
  constructor(substrate, config, scene) {
    this.sub = substrate;
    this.config = config;
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildBounds();
    this._buildCeiling();
    this._buildRocks();
    this._buildLakes();
    this._buildFood();
    this._buildBeacons();
    this._buildMotes();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }
    });
  }

  // --- the world box: dark cave walls + bedrock floor -------------------------
  _buildBounds() {
    const { worldWidth: W, worldDepth: D, worldBreadth: B } = this.sub;
    const geo = new THREE.BoxGeometry(W, D, B);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.config.render.fogColor).multiplyScalar(1.6), side: THREE.BackSide });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(W / 2, -D / 2, B / 2);
    this.group.add(box);
  }

  // --- the surface plane, seen from below (the "ceiling" of the world) -------
  // Vertex-coloured by the surface descriptor: dark concrete, cold rock caps,
  // lake basin blue, and the sunlit (bloom-bright) goal soil in the east.
  _buildCeiling() {
    const sub = this.sub, r = this.config.render;
    const cols = sub.cols, rows = sub.rows, cs = sub.cellSize;
    const geo = new THREE.PlaneGeometry(sub.worldWidth, sub.worldBreadth, cols, rows);
    geo.rotateX(Math.PI / 2);   // face downward (-y): visible from below
    // PlaneGeometry(w,h) after rotateX(+90deg): local x -> world x, local y -> world z.
    geo.translate(sub.worldWidth / 2, 0, sub.worldBreadth / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cConcrete = new THREE.Color(r.ceiling);
    const cGoal = new THREE.Color(r.ceilingGoal);
    const cShade = new THREE.Color(r.ceilingShade);
    const cRock = new THREE.Color(r.rock);
    const cLake = new THREE.Color(r.water);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const cx = Math.max(0, Math.min(cols - 1, Math.floor(x / cs)));
      const cz = Math.max(0, Math.min(rows - 1, Math.floor(z / cs)));
      const surf = sub.surfaceAt(cx, cz);
      if (surf && surf.soil) tmp.copy(surf.shade ? cShade : cGoal);
      else if (surf && surf.barrier === 'lake') tmp.copy(cLake);
      else if (surf && surf.barrier === 'rock') tmp.copy(cRock);
      else tmp.copy(cConcrete);
      // organic mottling + slight downward bumps
      const n = hashf(cx * 3.7, cz * 5.1);
      tmp.multiplyScalar(0.82 + n * 0.36);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      pos.setY(i, -0.5 - n * 7);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.group.add(new THREE.Mesh(geo, mat));
  }

  // --- rock voxels: one instanced craggy cube per rock cell -------------------
  // Voxel-accurate: what blocks growth is exactly what you see (including the
  // eroded portholes through curtains). Slightly oversized + randomly rotated
  // so the mass reads as tumbled boulders, not a grid.
  _buildRocks() {
    const sub = this.sub, r = this.config.render, cs = this.sub.cellSize;
    const cells = [];
    sub.forEachCell((cell, cx, cy, cz) => {
      if (cell.rock && !cell.water) cells.push({ cx, cy, cz, curtain: cell.curtain, formation: cell.formation });
    });
    if (!cells.length) return;
    // Craggy shared geometry: a low-poly deformed cube.
    const geo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = hashf(p.getX(i) * 12.9 + i, p.getY(i) * 7.3 - i) - 0.5;
      p.setXYZ(i, p.getX(i) * (1 + n * 0.3), p.getY(i) * (1 + n * 0.25), p.getZ(i) * (1 + n * 0.3));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(r.rock), flatShading: true, roughness: 0.95, metalness: 0.05,
      emissive: new THREE.Color(r.rockEmissive), emissiveIntensity: 0.5,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      const ctr = sub.cellCenter(c.cx, c.cy, c.cz);
      const h1 = hashf(c.cx * 7.1 + c.cy * 3.3, c.cz * 11.7);
      const h2 = hashf(c.cx * 2.9, c.cy * 9.1 + c.cz * 4.3);
      v.set(ctr.x + (h1 - 0.5) * cs * 0.25, ctr.y + (h2 - 0.5) * cs * 0.25, ctr.z + (hashf(h1, h2) - 0.5) * cs * 0.25);
      e.set(h1 * Math.PI, h2 * Math.PI, (h1 + h2) * Math.PI);
      q.setFromEuler(e);
      const s = cs * (1.3 + h2 * 0.45);
      sv.set(s, s * (0.8 + h1 * 0.4), s);
      m.compose(v, q, sv);
      mesh.setMatrixAt(i, m);
      // curtains cold slate, formations slightly warmer, boulders varied
      const base = c.curtain ? 0.85 : c.formation ? 1.1 : 1.0;
      col.set(r.rock).multiplyScalar(base * (0.8 + h1 * 0.5));
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
  }

  // --- the lake: a translucent water ellipsoid hanging from the surface ------
  _buildLakes() {
    const sub = this.sub, r = this.config.render, cs = sub.cellSize;
    for (const lk of sub.features.lakes) {
      const rx = (lk.lw * cs) / 2, rz = (lk.lb * cs) / 2, ry = lk.maxDepth * cs;
      const cx = (lk.cx0 + lk.lw / 2) * cs, cz = (lk.cz0 + lk.lb / 2) * cs;
      const geo = new THREE.SphereGeometry(1, 28, 20);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(r.water), transparent: true, opacity: 0.62,
        roughness: 0.15, metalness: 0.1, emissive: new THREE.Color(r.waterDeep), emissiveIntensity: 0.7,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, 0, cz);
      mesh.scale.set(rx, ry, rz);
      this.group.add(mesh);
      // faint glinting waterline ring at the rim
      const ringGeo = new THREE.TorusGeometry(1, 0.015, 6, 48);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x9fd4e8, transparent: true, opacity: 0.35 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cx, -2, cz);
      ring.scale.set(rx, rz, 1);
      this.group.add(ring);
    }
  }

  // --- food: one glowing shard per nutrient voxel (shrinks as it's eaten) ----
  _buildFood() {
    const sub = this.sub, r = this.config.render;
    // Capacity: every voxel that starts with food, plus headroom for Add Substrate.
    let start = 0;
    sub.forEachCell((c) => { if (c.maxNutrient > 0) start++; });
    this.foodCapacity = start + 1024;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(r.food) });
    this.foodMesh = new THREE.InstancedMesh(geo, mat, this.foodCapacity);
    this.foodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.foodMesh);
    // soft halo sprites per cache cluster
    const tex = glowTexture();
    this.clusterHalos = [];
    for (const c of sub.features.foodClusters) {
      const sprMat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(r.foodCore), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false });
      const spr = new THREE.Sprite(sprMat);
      spr.position.set(c.x, c.y, c.z);
      spr.scale.setScalar(this.sub.cellSize * 4.5);
      this.group.add(spr);
      this.clusterHalos.push({ spr, c });
    }
    this.refreshFood();
  }

  // Refresh food instances from live nutrient values (called after each action).
  refreshFood() {
    const sub = this.sub, cs = sub.cellSize;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3();
    let i = 0;
    sub.forEachCell((cell, cx, cy, cz) => {
      if (cell.nutrient <= 0 || i >= this.foodCapacity) return;
      const frac = Math.min(1, cell.nutrient / (cell.maxNutrient || 50));
      const ctr = sub.cellCenter(cx, cy, cz);
      const h1 = hashf(cx * 5.3 + cy * 7.7, cz * 3.1);
      const h2 = hashf(cx * 1.7, cy * 2.9 + cz * 8.3);
      v.set(ctr.x + (h1 - 0.5) * cs * 0.4, ctr.y + (h2 - 0.5) * cs * 0.4, ctr.z + (hashf(h2, h1) - 0.5) * cs * 0.4);
      e.set(h1 * 6.28, h2 * 6.28, 0);
      q.setFromEuler(e);
      const s = cs * 0.16 + cs * 0.22 * frac;
      sv.set(s, s * (0.7 + h1 * 0.6), s);
      m.compose(v, q, sv);
      this.foodMesh.setMatrixAt(i, m);
      i++;
    });
    this.foodMesh.count = i;
    this.foodMesh.instanceMatrix.needsUpdate = true;
    // halos fade out as their cache is consumed
    for (const h of this.clusterHalos) {
      let total = 0, max = 0;
      sub.cellsInRadius(h.c.x, h.c.y, h.c.z, cs * 2.2, (cell) => { total += cell.nutrient; max += cell.maxNutrient; });
      const f = max > 0 ? total / max : 0;
      h.spr.material.opacity = 0.28 * f;
      h.spr.visible = f > 0.02;
    }
  }

  // --- goal / start beacons: light shafts falling from the surface ------------
  _buildBeacons() {
    const sub = this.sub, r = this.config.render, cs = sub.cellSize;
    // Shafts run the FULL depth (no floating rim mid-air) and ignore fog so
    // they read as wayfinding lights from across the volume.
    const makeShaft = (x, z, colorHex, radius, opacity) => {
      const len = sub.worldDepth;
      const geo = new THREE.CylinderGeometry(radius * 0.45, radius, len, 18, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex), transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, -len / 2, z);
      this.group.add(mesh);
      return mesh;
    };
    // Goal: centre of the goal soil zone (sunlight breaking through).
    let gx = 0, gz = 0, gn = 0;
    for (let cz = 0; cz < sub.rows; cz++) for (let cx = 0; cx < sub.cols; cx++) {
      const s = sub.surfaceAt(cx, cz);
      if (s && s.goal && s.soil) { const c = sub.surfaceCenter(cx, cz); gx += c.x; gz += c.z; gn++; }
    }
    if (gn > 0) {
      gx /= gn; gz /= gn;
      this.goalPos = new THREE.Vector3(gx, -10, gz);
      makeShaft(gx, gz, r.goalBeacon, cs * 2.6, 0.035);
      makeShaft(gx, gz, r.goalBeacon, cs * 1.1, 0.05);
    }
    // Start: a faint cool shaft marking home.
    const root = { x: cs * 1.5, z: (sub.pathZ ? sub.pathZ[1] : sub.rows / 2) * cs + cs / 2 };
    makeShaft(root.x, root.z, r.startBeacon, cs * 0.9, 0.03);
  }

  // --- drifting dust motes: depth perception in the dark ----------------------
  _buildMotes() {
    const sub = this.sub, r = this.config.render;
    const count = r.moteCount || 600;
    const pos = new Float32Array(count * 3);
    this._moteBase = new Float32Array(count * 3);
    this._motePhase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * sub.worldWidth;
      const y = -Math.random() * sub.worldDepth;
      const z = Math.random() * sub.worldBreadth;
      pos[i * 3] = this._moteBase[i * 3] = x;
      pos[i * 3 + 1] = this._moteBase[i * 3 + 1] = y;
      pos[i * 3 + 2] = this._moteBase[i * 3 + 2] = z;
      this._motePhase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(r.mote), size: 2.6, sizeAttenuation: true,
      map: glowTexture(), transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.motes = new THREE.Points(geo, mat);
    this.group.add(this.motes);
  }

  update(time) {
    // slow mote drift
    if (this.motes) {
      const pos = this.motes.geometry.attributes.position;
      const t = time * 0.00022;
      for (let i = 0; i < pos.count; i++) {
        const ph = this._motePhase[i];
        pos.array[i * 3] = this._moteBase[i * 3] + Math.sin(t * 40 + ph) * 6;
        pos.array[i * 3 + 1] = this._moteBase[i * 3 + 1] + Math.sin(t * 26 + ph * 1.7) * 8;
        pos.array[i * 3 + 2] = this._moteBase[i * 3 + 2] + Math.cos(t * 33 + ph) * 6;
      }
      pos.needsUpdate = true;
    }
  }
}
