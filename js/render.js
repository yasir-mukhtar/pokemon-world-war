// Renderer 3D Three.js — arena "Alun-alun" low-poly.
// Pemetaan: x/y logis (ruang 2D mesin) -> worldX/worldZ; y dunia = vertikal.
// Gerak ground-plane adalah 3D nyata (MOBA top-down): tidak ada terbang/lompat.
import * as THREE from '../vendor/three/three.module.js';
import { LEVEL } from './level.js';
import { createCharacterModel, createEnemyModel, animateCharacterModel } from './models3d.js';
import { getAimTarget } from './game-engine.js';

const S = LEVEL.scale;
const toWorldX = (x) => (x - LEVEL.width / 2) * S;
const toWorldZ = (y) => (y - LEVEL.height / 2) * S;
const GROUND_W = LEVEL.width * S;
const GROUND_H = LEVEL.height * S;

const std = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, ...opts });

function disposeDeep(obj) {
  obj.traverse((n) => {
    if (n.geometry) n.geometry.dispose();
    if (n.material) {
      for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.dispose();
    }
  });
}

function buildLevelMesh(state) {
  const g = new THREE.Group();
  // Tanah dasar.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(GROUND_W + 4, 0.4, GROUND_H + 4),
    std('#e9dfc2'),
  );
  ground.position.y = -0.21;
  ground.receiveShadow = true;
  g.add(ground);

  // Jalan utama (bidang tipis di atas tanah).
  const roadMat = std('#d6c8a4');
  const roadEW = new THREE.Mesh(new THREE.BoxGeometry(GROUND_W, 0.04, 44 * S), roadMat);
  roadEW.position.set(0, 0.02, toWorldZ(308));
  roadEW.receiveShadow = true;
  const roadNS = new THREE.Mesh(new THREE.BoxGeometry(60 * S, 0.04, GROUND_H), roadMat);
  roadNS.position.set(toWorldX(500), 0.021, 0);
  roadNS.receiveShadow = true;
  g.add(roadEW, roadNS);

  // Alun-alun: paving melingkar di sekitar zona.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.6, 0.06, 36),
    std('#ddd0ae'),
  );
  plaza.position.set(toWorldX(500), 0.03, toWorldZ(300));
  plaza.receiveShadow = true;
  g.add(plaza);

  // Dinding pembatas rendah — jaga pandangan ke dalam arena.
  const wallMat = std('#b9a77f');
  const wh = 0.5;
  const walls = [
    [GROUND_W, 0.3, 0, -GROUND_H / 2 - 0.15],
    [GROUND_W, 0.3, 0, GROUND_H / 2 + 0.15],
    [0.3, GROUND_H, -GROUND_W / 2 - 0.15, 0],
    [0.3, GROUND_H, GROUND_W / 2 + 0.15, 0],
  ];
  for (const [w, d, x, z] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wh, d), wallMat);
    wall.position.set(x, wh / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);
  }

  // Enam obstacle solid — kotak 3D sesuai footprint logis.
  for (const o of state.obstacles) {
    const h = o.height * S;
    const box = new THREE.Mesh(new THREE.BoxGeometry(o.w * S, h, o.h * S), std(o.color));
    box.position.set(toWorldX(o.x + o.w / 2), h / 2, toWorldZ(o.y + o.h / 2));
    box.userData.obstacleId = o.id;
    box.castShadow = true;
    box.receiveShadow = true;
    g.add(box);
    if (o.kind === 'building') {
      // Atap sedikit lebih gelap agar bentuk terbaca.
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(o.w * S * 0.9, 0.12, o.h * S * 0.9),
        std('#6e6046'),
      );
      roof.position.set(box.position.x, h + 0.06, box.position.z);
      roof.castShadow = true;
      g.add(roof);
    }
  }

  // Dekorasi di LUAR batas main (pohon) — jelas tidak dapat dilewati.
  const treeMat = std('#6d8a4f');
  const trunkMat = std('#7a6248');
  const treeSpots = [
    [-GROUND_W / 2 - 1.2, -GROUND_H / 2 - 1.0],
    [GROUND_W / 2 + 1.2, -GROUND_H / 2 - 1.0],
    [-GROUND_W / 2 - 1.2, GROUND_H / 2 + 1.0],
    [GROUND_W / 2 + 1.2, GROUND_H / 2 + 1.0],
    [-GROUND_W / 2 - 1.4, 0],
    [GROUND_W / 2 + 1.4, 0],
  ];
  for (const [x, z] of treeSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.6, 6), trunkMat);
    trunk.position.set(x, 0.3, z);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), treeMat);
    crown.position.set(x, 0.95, z);
    crown.castShadow = true;
    g.add(trunk, crown);
  }
  // Zona capture: ring torus + panggung silinder (progres diisi render()).
  const zc = { x: toWorldX(state.zone.x), z: toWorldZ(state.zone.y) };
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(state.zone.radius * S, state.zone.radius * S, 0.1, 40),
    std('#cfc09a'),
  );
  platform.position.set(zc.x, 0.05, zc.z);
  platform.receiveShadow = true;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(state.zone.radius * S, 0.06, 10, 48),
    std('#16736b', { emissive: '#16736b', emissiveIntensity: 0.35 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(zc.x, 0.12, zc.z);
  const contestRing = new THREE.Mesh(
    new THREE.TorusGeometry(state.zone.contestRadius * S, 0.03, 8, 48),
    std('#1f1a10'),
  );
  contestRing.rotation.x = Math.PI / 2;
  contestRing.position.set(zc.x, 0.06, zc.z);
  contestRing.material.transparent = true;
  contestRing.material.opacity = 0.35;
  g.add(platform, ring, contestRing);
  g.userData = { ring, contestRing, zoneCenter: zc };
  return g;
}

// Pie progres zona — dibangun ulang hanya saat sudut berubah bermakna.
function makeProgressSlice(radius, frac) {
  const geo = new THREE.CircleGeometry(radius, 40, -Math.PI / 2, Math.max(0.001, frac * Math.PI * 2));
  const m = new THREE.Mesh(geo, std('#f2c230', { emissive: '#d9a50f', emissiveIntensity: 0.4 }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

function makeHpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.02), new THREE.MeshBasicMaterial({ color: '#2b2118' }));
  const fill = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.03), new THREE.MeshBasicMaterial({ color: '#c0392b' }));
  g.add(bg, fill);
  g.rotation.x = -0.55; // menghadap kamera (yaw kamera tetap)
  g.userData.fill = fill;
  return g;
}

function makeTeamRing(color) {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color }),
  );
  r.rotation.x = Math.PI / 2;
  r.position.y = 0.04;
  return r;
}

function makeProjectileMesh(team, characterId) {
  let color = team === 'player' ? '#f2c230' : '#c0392b';
  if (team === 'player' && characterId === 'charizard') color = '#e2703a';
  if (team === 'player' && characterId === 'gengar') color = '#5f4387';
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    std(color, { emissive: color, emissiveIntensity: 0.8 }),
  );
  m.castShadow = true;
  if (team === 'player' && characterId === 'charizard') {
    // Bola api: inti kuning emisif + kerucut api ke belakang.
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      std('#f2c230', { emissive: '#f2c230', emissiveIntensity: 1.1 }),
    );
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.3, 6),
      new THREE.MeshBasicMaterial({ color: '#e2703a', transparent: true, opacity: 0.7 }),
    );
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -0.22;
    m.add(core, flame);
  }
  if (team === 'player' && characterId === 'gengar') {
    // Orb bayangan: halo torus ungu emisif mengelilingi bola gelap.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.035, 8, 20),
      new THREE.MeshBasicMaterial({ color: '#7b5ea7', transparent: true, opacity: 0.75 }),
    );
    halo.rotation.x = Math.PI / 2;
    m.add(halo);
  }
  const trail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.01, 0.5, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }),
  );
  trail.rotation.x = Math.PI / 2; // sumbu silinder Y -> Z lokal (panjang ke belakang)
  trail.position.z = -0.3;
  m.add(trail);
  m.userData.trail = trail;
  return m;
}

function makeEffectMesh(ef) {
  const c = ef.color ?? '#f2c230';
  if (ef.type === 'ring' || ef.type === 'spawn' || ef.type === 'ko') {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry((ef.radius ?? 30) * S, 0.05, 8, 40),
      new THREE.MeshBasicMaterial({ color: ef.type === 'ring' ? c : '#c0392b', transparent: true }),
    );
    m.rotation.x = Math.PI / 2;
    return m;
  }
  if (ef.type === 'cone') {
    const r = (ef.radius ?? 200) * S;
    const geo = new THREE.CircleGeometry(r, 20, Math.PI / 2 - ef.angle / 2, ef.angle);
    const flat = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true }));
    flat.rotation.x = -Math.PI / 2; // bidang XY -> XZ; sektor menghadap -Z (utara)
    const m = new THREE.Group();
    m.add(flat);
    // Jilatan api 3D tersebar di sektor (arah default -Z, diputar group).
    const flameMat = new THREE.MeshBasicMaterial({ color: '#f2c230', transparent: true });
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 7 - 0.5) * (ef.angle ?? 0.8);
      const rr = r * (0.3 + 0.55 * (((i * 37) % 11) / 11));
      const puff = new THREE.Mesh(
        new THREE.ConeGeometry(0.07 + 0.03 * (i % 3), 0.3, 5),
        i % 2 ? flameMat : new THREE.MeshBasicMaterial({ color: c, transparent: true }),
      );
      puff.position.set(Math.sin(a) * rr, 0.06, -Math.cos(a) * rr);
      puff.rotation.x = 0.4;
      m.add(puff);
    }
    m.userData.flat = flat;
    return m;
  }
  if (ef.type === 'dash') {
    const len = Math.hypot((ef.x2 - ef.x) * S, (ef.y2 - ef.y) * S) || 0.1;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, len),
      new THREE.MeshBasicMaterial({ color: c, transparent: true }),
    );
    return m;
  }
  // hit
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: '#f7f1e2', transparent: true }),
  );
  return m;
}

// Efek bisa berupa Group (cone) — set opacity aman pada semua material turunan.
function setFxOpacity(obj, value) {
  obj.traverse((n) => {
    if (!n.material) return;
    for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
      m.transparent = true;
      m.opacity = value;
    }
  });
}

export function createArenaRenderer(canvas) {
  // Wajib WebGL2 — tanpa fallback 2D.
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL2 tidak tersedia di browser ini');
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8e6df');
  scene.fog = new THREE.Fog('#d8e6df', 34, 85);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 150);
  const lookTarget = new THREE.Vector3(0, 0.7, -2.5);

  const hemi = new THREE.HemisphereLight('#fdf4dd', '#6d7a68', 0.95);
  const sun = new THREE.DirectionalLight('#ffe3b3', 1.9);
  sun.position.set(14, 20, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0008;
  scene.add(hemi, sun);

  let levelGroup = null;
  let zoneSlice = null;
  let zoneSliceFrac = -1;
  let playerMesh = null;
  const enemyMeshes = new Map();
  const projMeshes = new Map();
  const fxMeshes = new Map();
  let camInit = false;

  function syncEntities(state) {
    // Pemain.
    if (!playerMesh || playerMesh.userData.charId !== state.player.character.id) {
      if (playerMesh) {
        scene.remove(playerMesh);
        disposeDeep(playerMesh);
      }
      const model = createCharacterModel(state.player.character.id);
      playerMesh = model.group;
      playerMesh.userData.charId = state.player.character.id;
      playerMesh.userData.legs = model.legs;
      playerMesh.add(makeTeamRing('#16736b'));
      scene.add(playerMesh);
    }
    // Musuh — sinkron by id.
    const aliveIds = new Set();
    for (const e of state.enemies) {
      if (!e.alive) continue;
      aliveIds.add(e.id);
      if (!enemyMeshes.has(e.id)) {
        const m = createEnemyModel().group;
        m.userData.id = e.id;
        m.add(makeTeamRing('#c0392b'));
        const hp = makeHpBar();
        hp.position.y = 1.85;
        m.add(hp);
        m.userData.hp = hp;
        scene.add(m);
        enemyMeshes.set(e.id, m);
      }
    }
    for (const [id, m] of enemyMeshes) {
      if (!aliveIds.has(id)) {
        scene.remove(m);
        disposeDeep(m);
        enemyMeshes.delete(id);
      }
    }
    // Proyektil.
    const projIds = new Set();
    for (const p of state.projectiles) {
      projIds.add(p.id);
      if (!projMeshes.has(p.id)) {
        const m = makeProjectileMesh(p.team, state.player.character.id);
        scene.add(m);
        projMeshes.set(p.id, m);
      }
    }
    for (const [id, m] of projMeshes) {
      if (!projIds.has(id)) {
        scene.remove(m);
        disposeDeep(m);
        projMeshes.delete(id);
      }
    }
    // Efek.
    const fxIds = new Set();
    for (const ef of state.effects) {
      fxIds.add(ef.id);
      if (!fxMeshes.has(ef.id)) {
        const m = makeEffectMesh(ef);
        if (ef.type === 'dash') {
          m.position.set(toWorldX((ef.x + ef.x2) / 2), 0.15, toWorldZ((ef.y + ef.y2) / 2));
          m.rotation.y = Math.atan2(ef.x2 - ef.x, ef.y2 - ef.y);
        } else if (ef.type === 'cone') {
          m.position.set(toWorldX(ef.x), 0.12, toWorldZ(ef.y));
          m.rotation.y = Math.atan2(-ef.dir.x, -ef.dir.y); // bisector default -Z -> arah world
        } else {
          m.position.set(toWorldX(ef.x), 0.1, toWorldZ(ef.y));
        }
        scene.add(m);
        fxMeshes.set(ef.id, m);
      }
    }
    for (const [id, m] of fxMeshes) {
      if (!fxIds.has(id)) {
        scene.remove(m);
        disposeDeep(m);
        fxMeshes.delete(id);
      }
    }
  }

  function animateEntities(state) {
    const t = state.elapsed;
    const p = state.player;
    playerMesh.position.set(toWorldX(p.x), 0, toWorldZ(p.y));
    playerMesh.rotation.y = Math.atan2(p.facing.x, p.facing.y);
    const moving = p.moving ? 1 : 0;
    playerMesh.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.08 : Math.sin(t * 2.2) * 0.02 + 0.02;
    const legs = playerMesh.userData.legs;
    if (legs) {
      const swing = moving ? Math.sin(t * 11) * 0.55 : Math.sin(t * 2) * 0.06;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
    }
    // Pose referensi (Charizard/Gengar) — semua berbasis state.elapsed:
    // jeda membekukan animasi; hurt/faint mengikuti HP simulasi.
    const pud = playerMesh.userData;
    if (pud.lastHp == null) pud.lastHp = p.hp;
    if (p.hp < pud.lastHp) pud.hurtUntil = t + 0.22;
    pud.lastHp = p.hp;
    animateCharacterModel(playerMesh, {
      time: t,
      moving: !!moving,
      attack: p.character.attackCooldown ? p.attackCooldown / p.character.attackCooldown : 0,
      skill: p.character.skill?.cooldown ? p.skillCooldown / p.character.skill.cooldown : 0,
      hurt: Math.max(0, (pud.hurtUntil ?? 0) - t) / 0.22,
      fainted: p.hp <= 0,
    });
    for (const [id, m] of enemyMeshes) {
      const e = state.enemies.find((en) => en.id === id);
      if (!e) continue;
      m.position.set(toWorldX(e.x), 0, toWorldZ(e.y));
      const dx = p.x - e.x;
      const dz = p.y - e.y;
      m.rotation.y = Math.atan2(dx, dz);
      m.position.y = Math.abs(Math.sin(t * 8 + id)) * 0.06;
      const bar = m.userData.hp;
      if (bar) {
        const frac = Math.max(0, e.hp / e.maxHp);
        bar.userData.fill.scale.x = frac;
        bar.userData.fill.position.x = -(1 - frac) * 0.45;
      }
    }
    for (const [id, m] of projMeshes) {
      const p2 = state.projectiles.find((pr) => pr.id === id);
      if (!p2) continue;
      m.position.set(toWorldX(p2.x), 0.45, toWorldZ(p2.y));
      m.rotation.y = Math.atan2(p2.vx, p2.vy); // trail lokal -Z mengarah ke belakang lintasan
    }
    for (const [id, m] of fxMeshes) {
      const ef = state.effects.find((f) => f.id === id);
      if (!ef) continue;
      const k = 1 - ef.ttl / ef.maxTtl;
      setFxOpacity(m, Math.max(0, 1 - k));
      if (ef.type === 'ring' || ef.type === 'ko') {
        const s = 0.4 + 0.6 * k;
        m.scale.set(s, s, s);
      } else if (ef.type === 'spawn') {
        const s = Math.max(0.05, 1 - k);
        m.scale.set(s, s, s);
      } else if (ef.type === 'hit') {
        m.scale.setScalar(0.5 + k * 1.4);
      }
    }
    // Progres zona + status perebutan.
    const frac = state.captureTarget > 0 ? state.captured / state.captureTarget : 0;
    const q = Math.floor(frac * 90) / 90; // 4° per langkah
    if (Math.abs(q - zoneSliceFrac) > 1e-9) {
      zoneSliceFrac = q;
      if (zoneSlice) {
        levelGroup.remove(zoneSlice);
        disposeDeep(zoneSlice);
      }
      zoneSlice = makeProgressSlice(state.zone.radius * S * 0.9, frac);
      zoneSlice.position.set(levelGroup.userData.zoneCenter.x, 0.11, levelGroup.userData.zoneCenter.z);
      levelGroup.add(zoneSlice);
    }
    const zr = levelGroup.userData.ring;
    zr.material.color.set(state.contested ? '#c0392b' : '#16736b');
    zr.material.emissive.set(state.contested ? '#c0392b' : '#16736b');
    zr.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
    // Garis bidik sederhana: tandai target aim dengan ring kecil.
    const target = getAimTarget(state);
    if (!levelGroup.userData.aimRing) {
      const ar = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.04, 8, 28),
        new THREE.MeshBasicMaterial({ color: '#c0392b', transparent: true, opacity: 0.8 }),
      );
      ar.rotation.x = Math.PI / 2;
      ar.position.y = 0.06;
      levelGroup.add(ar);
      levelGroup.userData.aimRing = ar;
    }
    levelGroup.userData.aimRing.visible = !!target;
    if (target) {
      levelGroup.userData.aimRing.position.set(toWorldX(target.x), 0.06, toWorldZ(target.y));
    }
  }

  function updateCamera(state, dt) {
    const px = toWorldX(state.player.x);
    const pz = toWorldZ(state.player.y);
    const want = new THREE.Vector3(px, 12, pz + 11);
    const wantLook = new THREE.Vector3(px, 0.7, pz - 2.5);
    if (!camInit) {
      camera.position.copy(want);
      lookTarget.copy(wantLook);
      camInit = true;
    } else {
      const k = 1 - Math.exp(-6 * dt);
      camera.position.lerp(want, k);
      lookTarget.lerp(wantLook, k);
    }
    camera.lookAt(lookTarget);
  }

  return {
    start(state) {
      if (levelGroup) {
        scene.remove(levelGroup);
        disposeDeep(levelGroup);
      }
      for (const m of enemyMeshes.values()) { scene.remove(m); disposeDeep(m); }
      enemyMeshes.clear();
      for (const m of projMeshes.values()) { scene.remove(m); disposeDeep(m); }
      projMeshes.clear();
      for (const m of fxMeshes.values()) { scene.remove(m); disposeDeep(m); }
      fxMeshes.clear();
      if (playerMesh) { scene.remove(playerMesh); disposeDeep(playerMesh); playerMesh = null; }
      levelGroup = buildLevelMesh(state);
      zoneSlice = null;
      zoneSliceFrac = -1;
      scene.add(levelGroup);
      camInit = false;
      syncEntities(state);
      updateCamera(state, 1);
    },
    render(state, dt) {
      if (!levelGroup) return;
      syncEntities(state);
      animateEntities(state);
      updateCamera(state, dt);
      // Jangan render ke konteks yang hilang (jendela antara lose dan event).
      if (renderer.getContext().isContextLost()) return;
      renderer.render(scene, camera);
    },
    resize(cssWidth, cssHeight) {
      camera.aspect = cssWidth / cssHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(cssWidth, cssHeight, false);
    },
    dispose() {
      if (levelGroup) { scene.remove(levelGroup); disposeDeep(levelGroup); levelGroup = null; }
      if (playerMesh) { scene.remove(playerMesh); disposeDeep(playerMesh); playerMesh = null; }
      for (const m of enemyMeshes.values()) disposeDeep(m);
      for (const m of projMeshes.values()) disposeDeep(m);
      for (const m of fxMeshes.values()) disposeDeep(m);
      enemyMeshes.clear();
      projMeshes.clear();
      fxMeshes.clear();
      renderer.dispose();
    },
    getDebugInfo() {
      let meshes = 0;
      let shadowCasters = 0;
      scene.traverse((n) => {
        if (n.isMesh) meshes += 1;
        if (n.castShadow) shadowCasters += 1;
      });
      const subtreeStats = (root) => {
        let count = 0;
        let verts = 0;
        root?.traverse((n) => {
          if (n.isMesh) {
            count += 1;
            verts += n.geometry?.attributes?.position?.count ?? 0;
          }
        });
        return { meshCount: count, vertexCount: verts };
      };
      const obstacleIds = [];
      levelGroup?.traverse((n) => {
        if (n.userData?.obstacleId) obstacleIds.push(n.userData.obstacleId);
      });
      const enemyIds = [...enemyMeshes.values()].map((m) => m.userData.modelId);
      const p = playerMesh?.position;
      const playerStats = subtreeStats(playerMesh);
      return {
        type: 'WebGL2',
        threeRevision: THREE.REVISION,
        camera: camera.isPerspectiveCamera ? 'PerspectiveCamera' : 'other',
        fov: camera.fov,
        triangles: renderer.info.render.triangles,
        drawCalls: renderer.info.render.calls,
        meshes,
        shadowCasters,
        shadowsEnabled: renderer.shadowMap.enabled,
        shadowMapType: 'PCFSoftShadowMap',
        shadowMapSize: sun.shadow.mapSize.x,
        shadowLights: scene.children.filter((l) => l.isLight && l.castShadow).length,
        cameraPosition: camera.position.toArray().map((v) => +v.toFixed(2)),
        cameraTarget: lookTarget.toArray().map((v) => +v.toFixed(2)),
        cameraAspect: +camera.aspect.toFixed(3),
        playerWorld: p ? [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] : null,
        levelId: LEVEL.id,
        levelName: LEVEL.name,
        solidObstacles: obstacleIds,
        obstacleMeshes: obstacleIds.length,
        models: {
          player: playerMesh?.userData.modelId ?? null,
          enemies: enemyIds,
          projectiles: projMeshes.size,
          effects: fxMeshes.size,
        },
        playerMeshCount: playerStats.meshCount,
        playerVertexCount: playerStats.vertexCount,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
  };
}
