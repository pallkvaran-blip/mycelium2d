// =============================================================================
// CreatureRenderer — the living threats and the fruiting bodies.
//
//   - Trichoderma: each roaming cloud is a cluster of additive green sprites
//     slowly swirling, fading with the cloud's strength.
//   - Ants: each nest is a dark mound under the surface with a marching trail
//     of instanced ants along its 3D path, plus a floating HP bar.
//   - Nematodes: pale segmented worms (instanced spheres) that wiggle, dart
//     toward the colony, and tint when stuck by Excrete mucus.
//   - Fruit: mushrooms — ghost previews while aiming Fruit, solid + glowing
//     once the network fruits.
//
// Positions refresh every action tick; the wiggle/swirl animates every frame.
// =============================================================================

import * as THREE from 'three';
import { glowTexture } from './scene.js';

const PUFFS_PER_CLOUD = 9;
const ANTS_PER_TRAIL = 22;
const WORM_SEGS = 4;

export class CreatureRenderer {
  constructor(state, scene) {
    this.state = state;
    this.scene = scene;
    this.config = state.config;
    this.group = new THREE.Group();
    scene.add(this.group);

    this._buildClouds();
    this._buildAnts();
    this._buildWorms();
    this._buildFruit();
    this.refresh();
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    for (const n of this.nestGroups || []) if (n.bar) n.bar.material.map.dispose();
  }

  // ---- Trichoderma clouds ----------------------------------------------------
  _buildClouds() {
    this.cloudGroups = [];   // lazily managed pool, one group per live cloud
  }

  _cloudGroup() {
    const r = this.config.render;
    const tex = glowTexture();
    const g = new THREE.Group();
    g.userData.puffs = [];
    for (let i = 0; i < PUFFS_PER_CLOUD; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, color: new THREE.Color(i % 3 === 0 ? r.trichBright : r.trich),
        transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const spr = new THREE.Sprite(mat);
      spr.userData.seed = Math.random() * Math.PI * 2;
      g.add(spr);
      g.userData.puffs.push(spr);
    }
    const light = new THREE.PointLight(new THREE.Color(r.trich), 5200, 420, 1.9);
    g.add(light);
    this.group.add(g);
    return g;
  }

  // ---- Ants -------------------------------------------------------------------
  _buildAnts() {
    const r = this.config.render;
    this.nestGroups = [];
    const antGeo = new THREE.CapsuleGeometry(2.2, 5, 3, 6);
    antGeo.rotateX(Math.PI / 2);   // long axis along z (we orient with lookAt-style quats)
    this.antGeo = antGeo;
    this.antMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(r.ant), roughness: 0.8, emissive: 0x120a04, emissiveIntensity: 0.6 });
    this.trailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(r.antTrail), transparent: true, opacity: 0.4 });
    this.moundGeo = new THREE.SphereGeometry(1, 10, 7);
    this.moundMat = new THREE.MeshStandardMaterial({ color: 0x1c1208, roughness: 1, flatShading: true });
  }

  _nestGroup(nest) {
    const cs = this.state.substrate.cellSize;
    const g = new THREE.Group();
    // the nest mound: a dark hump hanging just under the surface entrance
    const mound = new THREE.Mesh(this.moundGeo, this.moundMat);
    mound.scale.set(cs * 0.9, cs * 0.65, cs * 0.9);
    mound.position.set(nest.x, -4, nest.z);
    g.add(mound);
    // HP bar sprite (canvas texture, refreshed on damage)
    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 14;
    const tex = new THREE.CanvasTexture(canvas);
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    bar.scale.set(cs * 1.6, cs * 0.24, 1);
    bar.position.set(nest.x, -cs * 1.35, nest.z);
    g.add(bar);
    // marching ants along the trail
    const ants = new THREE.InstancedMesh(this.antGeo, this.antMat, ANTS_PER_TRAIL);
    ants.count = 0;
    ants.frustumCulled = false;   // marching every frame — stale sphere would cull them
    g.add(ants);
    this.group.add(g);
    return { g, mound, bar, barCanvas: canvas, barTex: tex, ants, curve: null, tube: null, lastHp: -1, nest };
  }

  _refreshNestBar(ng) {
    const nest = ng.nest;
    if (nest.hp === ng.lastHp) return;
    ng.lastHp = nest.hp;
    const g = ng.barCanvas.getContext('2d');
    g.clearRect(0, 0, 96, 14);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(0, 0, 96, 14);
    const f = Math.max(0, nest.hp / nest.maxHp);
    g.fillStyle = f > 0.5 ? '#5fbf52' : f > 0.25 ? '#d8b13a' : '#d85a3a';
    g.fillRect(2, 2, 92 * f, 10);
    ng.barTex.needsUpdate = true;
  }

  _refreshTrail(ng) {
    const sub = this.state.substrate;
    const nest = ng.nest;
    // rebuild the tube when the path changed (compare endpoints + length)
    const path = nest.path || [];
    const sig = path.length + ':' + (path.length ? path[path.length - 1].cx + ',' + path[path.length - 1].cy + ',' + path[path.length - 1].cz : '');
    if (ng.sig === sig) return;
    ng.sig = sig;
    if (ng.tube) { ng.g.remove(ng.tube); ng.tube.geometry.dispose(); ng.tube = null; ng.curve = null; }
    if (path.length < 2) { ng.ants.count = 0; ng.ants.instanceMatrix.needsUpdate = true; return; }
    const pts = path.map((p) => { const c = sub.cellCenter(p.cx, p.cy, p.cz); return new THREE.Vector3(c.x, c.y, c.z); });
    // anchor the start at the surface mound
    pts.unshift(new THREE.Vector3(nest.x, -6, nest.z));
    ng.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
    const tubeGeo = new THREE.TubeGeometry(ng.curve, Math.min(200, pts.length * 4), 3.2, 5, false);
    ng.tube = new THREE.Mesh(tubeGeo, this.trailMat);
    ng.g.add(ng.tube);
  }

  // ---- Nematodes ---------------------------------------------------------------
  _buildWorms() {
    const r = this.config.render;
    const cap = this.config.nematodes.maxPopulation * WORM_SEGS;
    const geo = new THREE.SphereGeometry(3.1, 8, 6);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(r.nematode), roughness: 0.55, emissive: 0x2a2620, emissiveIntensity: 0.6 });
    this.wormMesh = new THREE.InstancedMesh(geo, mat, cap);
    this.wormMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wormMesh.count = 0;
    this.wormMesh.frustumCulled = false;   // matrices rewritten every frame — stale sphere would cull them
    this.group.add(this.wormMesh);
  }

  // ---- Fruit bodies (mushrooms) ---------------------------------------------
  _buildFruit() {
    const stem = new THREE.CylinderGeometry(2.6, 3.6, 26, 8);
    stem.translate(0, 13, 0);
    const cap = new THREE.SphereGeometry(11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    cap.scale(1, 0.62, 1);
    cap.translate(0, 24, 0);
    this.mushGeo = { stem, cap };
    this.fruitGroup = new THREE.Group();
    this.previewGroup = new THREE.Group();
    this.group.add(this.fruitGroup);
    this.group.add(this.previewGroup);
    this._mushMats = {
      stem: new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.7, emissive: 0x554c3a, emissiveIntensity: 0.35 }),
      cap: new THREE.MeshStandardMaterial({ color: 0xd8b06a, roughness: 0.6, emissive: 0x6a4a1e, emissiveIntensity: 0.4 }),
      ghostStem: new THREE.MeshBasicMaterial({ color: 0x9fe6b8, transparent: true, opacity: 0.3 }),
      ghostCap: new THREE.MeshBasicMaterial({ color: 0x7fe6a3, transparent: true, opacity: 0.35 }),
    };
  }

  _mushroom(x, z, ghost, scale = 1) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(this.mushGeo.stem, ghost ? this._mushMats.ghostStem : this._mushMats.stem);
    const cap = new THREE.Mesh(this.mushGeo.cap, ghost ? this._mushMats.ghostCap : this._mushMats.cap);
    g.add(stem); g.add(cap);
    // Mushrooms rise from the surface plane: sit the base at y=-2 (they read as
    // breaking through the ceiling when seen from below).
    g.position.set(x, -30 * scale, z);
    g.scale.setScalar(scale);
    g.rotation.y = Math.random() * Math.PI * 2;
    return g;
  }

  // Show/refresh ghost mushrooms at the candidate fruit points (aiming aid).
  showFruitPreview(points) {
    this.clearFruitPreview();
    for (const p of points) {
      this.previewGroup.add(this._mushroom(p.x, p.z, true, 1.3));
    }
  }
  clearFruitPreview() {
    while (this.previewGroup.children.length) this.previewGroup.remove(this.previewGroup.children[0]);
  }

  // The run fruited: plant solid glowing mushrooms + release spore sparkles.
  showFruitBodies(points) {
    this.clearFruitPreview();
    while (this.fruitGroup.children.length) this.fruitGroup.remove(this.fruitGroup.children[0]);
    const tex = glowTexture();
    for (const p of points) {
      const scale = p.shade ? 1.7 : 1.3;
      const m = this._mushroom(p.x, p.z, false, scale);
      m.position.y = 0;   // stems rise THROUGH the ceiling; caps sit above (seen from below as glow)
      this.fruitGroup.add(m);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0xcaffd8, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.position.set(p.x, -14, p.z);
      halo.scale.setScalar(90 * scale);
      this.fruitGroup.add(halo);
    }
  }

  // ---- per-action refresh (positions/structure) --------------------------------
  refresh() {
    const state = this.state;
    // clouds: pool matches the live cloud list
    while (this.cloudGroups.length < state.clouds.length) this.cloudGroups.push(this._cloudGroup());
    for (let i = 0; i < this.cloudGroups.length; i++) {
      const g = this.cloudGroups[i];
      const cloud = state.clouds[i];
      g.visible = !!cloud;
      if (!cloud) continue;
      g.position.set(cloud.x, cloud.y, cloud.z);
      g.userData.cloud = cloud;
    }
    // ants
    while (this.nestGroups.length < state.ants.length) this.nestGroups.push(this._nestGroup(state.ants[this.nestGroups.length]));
    for (let i = 0; i < this.nestGroups.length; i++) {
      const ng = this.nestGroups[i];
      const nest = state.ants[i];
      ng.g.visible = !!nest;
      if (!nest) continue;
      if (ng.nest !== nest) { ng.sig = null; ng.lastHp = -1; }   // pool slot re-assigned — drop stale trail/bar
      ng.nest = nest;
      ng.mound.position.set(nest.x, -4, nest.z);
      ng.bar.position.set(nest.x, -this.state.substrate.cellSize * 1.35, nest.z);
      this._refreshNestBar(ng);
      this._refreshTrail(ng);
    }
  }

  // ---- per-frame animation ------------------------------------------------------
  update(time, dt) {
    const state = this.state;
    const cs = state.substrate.cellSize;

    // Trichoderma: swirling puffs, sized by radius, faded by strength.
    for (const g of this.cloudGroups) {
      if (!g.visible || !g.userData.cloud) continue;
      const cloud = g.userData.cloud;
      const R = cloud.r * cs * 1.9;
      const strength = cloud.strength == null ? 1 : cloud.strength;
      const puffs = g.userData.puffs;
      for (let i = 0; i < puffs.length; i++) {
        const spr = puffs[i];
        const ph = spr.userData.seed + time * 0.00045;
        spr.position.set(
          Math.sin(ph + i * 2.1) * R * 0.5,
          Math.cos(ph * 1.3 + i) * R * 0.4,
          Math.cos(ph + i * 1.7) * R * 0.5
        );
        spr.scale.setScalar(R * (1.1 + 0.35 * Math.sin(ph * 2 + i)));
        spr.material.opacity = (0.16 + 0.16 * ((i * 37) % 10) / 10) * strength;
      }
      const light = g.children.find((c) => c.isPointLight);
      if (light) light.intensity = 5200 * strength;
    }

    // Ants: two opposing marching lanes along each trail.
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3(1, 1, 1);
    const tangent = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
    for (const ng of this.nestGroups) {
      if (!ng.g.visible) continue;
      if (!ng.curve) { ng.ants.count = 0; ng.ants.instanceMatrix.needsUpdate = true; continue; }
      const dormant = ng.nest.dormant;
      let count = dormant ? 0 : ANTS_PER_TRAIL;
      const flow = (time * 0.00006) % 1;
      for (let i = 0; i < count; i++) {
        const lane = i % 2 ? 1 : -1;
        const j = (i * 0.6180339887) % 1;
        const u = lane > 0 ? (j + flow) % 1 : ((j - flow) % 1 + 1) % 1;
        ng.curve.getPointAt(u, v);
        ng.curve.getTangentAt(u, tangent);
        if (lane < 0) tangent.negate();
        q.setFromUnitVectors(zAxis, tangent);
        v.x += Math.sin(u * 60 + lane) * 2.5;
        v.z += Math.cos(u * 60 - lane) * 2.5;
        m.compose(v, q, sv);
        ng.ants.setMatrixAt(i, m);
      }
      ng.ants.count = count;
      ng.ants.instanceMatrix.needsUpdate = true;
    }

    // Nematodes: 4-sphere chains wiggling behind the head.
    const worms = state.nematodes || [];
    let wi = 0;
    const stuckColor = new THREE.Color(this.config.render.nematodeStuck);
    const baseColor = new THREE.Color(this.config.render.nematode);
    const capInst = this.wormMesh.instanceMatrix.count;
    for (const w of worms) {
      const h = w.heading || { x: 1, y: 0, z: 0 };
      const wig = Math.sin(time * 0.006 + (w.phase || 0));
      for (let sgm = 0; sgm < WORM_SEGS && wi < capInst; sgm++) {
        const back = sgm * 5.5;
        const side = Math.sin(time * 0.006 + (w.phase || 0) + sgm * 0.9) * 2.4;
        // simple perpendicular in the horizontal plane
        const px = -h.z, pz = h.x;
        v.set(
          w.x - h.x * back + px * side,
          w.y - h.y * back + wig * 1.2,
          w.z - h.z * back + pz * side
        );
        const s = 1 - sgm * 0.16;
        sv.set(s, s, s);
        q.identity();
        m.compose(v, q, sv);
        this.wormMesh.setMatrixAt(wi, m);
        this.wormMesh.setColorAt(wi, w.stuck > 0 ? stuckColor : baseColor);
        wi++;
      }
    }
    this.wormMesh.count = Math.min(wi, capInst);
    this.wormMesh.instanceMatrix.needsUpdate = true;
    if (this.wormMesh.instanceColor) this.wormMesh.instanceColor.needsUpdate = true;
  }
}
