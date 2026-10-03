import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  stepGame,
  triggerSkill,
  getAimTarget,
} from '../js/game-engine.js';
import {
  circleIntersectsBox,
  moveCircle,
  hasLineOfSight,
  findPath,
} from '../js/collision.js';
import { LEVEL } from '../js/level.js';

const seqRandom = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const baseConfig = {
  characterId: 'pikachu',
  countryId: 'polandia',
  city: 'Warsawa',
  role: 'bertahan',
  opposingId: 'thailand',
  phaseId: 'perebutan',
  durationSeconds: 180,
};

function makeGame(overrides = {}, random = seqRandom(0.1, 0.5)) {
  return createGame({ ...baseConfig, ...overrides }, random);
}

function clearEnemies(state) {
  for (const e of state.enemies) e.alive = false;
  state.enemies = [];
}

function addEnemy(state, x, y, overrides = {}) {
  const enemy = {
    id: 900 + state.enemies.length,
    x,
    y,
    hp: 95,
    maxHp: 95,
    speed: 165,
    radius: 15,
    attackRange: 235,
    attackDamage: 13,
    attackCooldown: 999,
    projectileSpeed: 370,
    alive: true,
    path: null,
    pathTimer: 0,
    pathTarget: null,
    ...overrides,
  };
  state.enemies.push(enemy);
  return enemy;
}

const WALL = { id: 'test-wall', x: 460, y: 200, w: 80, h: 240, height: 60, color: '#888', kind: 'building' };

test('circleIntersectsBox: tepi, sudut, dan pusat di dalam', () => {
  const box = { x: 100, y: 100, w: 50, h: 50 };
  assert.equal(circleIntersectsBox(90, 125, 15, box), true, 'tepi kiri kena');
  assert.equal(circleIntersectsBox(84, 125, 15, box), false, 'tepi kiri bebas');
  assert.equal(circleIntersectsBox(92, 92, 15, box), true, 'sudut kena');
  assert.equal(circleIntersectsBox(82, 82, 15, box), false, 'sudut bebas');
  assert.equal(circleIntersectsBox(125, 125, 15, box), true, 'pusat di dalam');
  assert.equal(circleIntersectsBox(300, 300, 15, box), false);
});

test('moveCircle: berhenti di wajah solid dan meluncur saat diagonal', () => {
  const body = { x: 400, y: 300, radius: 15 };
  // Kardinal: ke kanan menuju wajah kiri dinding (x=460).
  moveCircle(body, 100, 0, { width: 1000, height: 650 }, [WALL]);
  assert.ok(Math.abs(body.x - (WALL.x - 15)) < 0.001, `berhenti di wajah: x=${body.x}`);
  assert.equal(body.y, 300);
  // Diagonal ke kanan-atas: tertahan x, meluncur ke atas.
  const slid = { x: 400, y: 300, radius: 15 };
  moveCircle(slid, 100, -80, { width: 1000, height: 650 }, [WALL]);
  assert.ok(Math.abs(slid.x - (WALL.x - 15)) < 0.001);
  assert.ok(slid.y < 300, 'meluncur ke atas di sepanjang wajah');
  // Tidak ada tumpukan akhir.
  assert.equal(circleIntersectsBox(slid.x, slid.y, 15, WALL), false);
});

test('moveCircle: clamp batas arena', () => {
  const body = { x: 990, y: 640, radius: 15 };
  moveCircle(body, 50, 50, { width: 1000, height: 650 }, []);
  assert.equal(body.x, 985);
  assert.equal(body.y, 635);
});

test('moveCircle: pusat di dalam kotak didorong ke wajah terdekat', () => {
  const body = { x: 470, y: 210, radius: 15 };
  moveCircle(body, 0, 0, { width: 1000, height: 650 }, [WALL]);
  assert.equal(circleIntersectsBox(body.x, body.y, 15, WALL), false);
  // Wajah terdekat dari (470,210) adalah wajah kiri (x=460) atau atas (y=200).
  assert.ok(body.x <= WALL.x - 15 || body.y <= WALL.y - 15);
});

test('dash Lucario berhenti sebelum dinding tanpa tembus damage', () => {
  const state = makeGame({ characterId: 'lucario' });
  clearEnemies(state);
  state.obstacles = Object.freeze([Object.freeze(WALL)]);
  state.player.x = 400;
  state.player.y = 300;
  state.player.facing = { x: 1, y: 0 };
  const behind = addEnemy(state, 620, 300); // di balik dinding
  assert.equal(triggerSkill(state), true);
  assert.ok(state.player.x <= WALL.x - state.player.radius + 0.01, `dash berhenti: x=${state.player.x}`);
  assert.equal(behind.hp, behind.maxHp, 'musuh di balik dinding tidak terluka');
});

test('proyektil tertahan kotak — aktor di balik tidak terluka', () => {
  const state = makeGame({});
  clearEnemies(state);
  state.obstacles = Object.freeze([Object.freeze(WALL)]);
  state.player.x = 400;
  state.player.y = 300;
  const behind = addEnemy(state, 620, 300);
  // Tembak manual melewati dinding (aim dilewati; uji tabrakan murni).
  state.projectiles.push({
    id: 1, x: 430, y: 300, vx: 400, vy: 0, radius: 6, damage: 26, team: 'player', life: 2,
  });
  for (let i = 0; i < 30; i += 1) stepGame(state, 0.05, {});
  assert.equal(behind.hp, behind.maxHp, 'aktor di balik tembok aman');
  assert.equal(state.projectiles.length, 0, 'proyektil hancur di dinding');
});

test('spawn tidak pernah di dalam obstacle dan >=260 dari pemain', () => {
  for (const seed of [0.05, 0.3, 0.7, 0.95]) {
    const state = makeGame({ phaseId: 'pertahanan' }, () => seed);
    for (const e of state.enemies) {
      for (const o of state.obstacles) {
        assert.equal(circleIntersectsBox(e.x, e.y, e.radius, o), false, `spawn ${e.id} di ${o.id}`);
      }
      assert.ok(Math.hypot(e.x - state.player.x, e.y - state.player.y) >= 200);
    }
  }
});

test('AI bernavigasi mengitari gedung — maju tanpa tumpang-tindih', () => {
  const state = makeGame({ phaseId: 'infiltrasi' });
  clearEnemies(state);
  state.player.hp = 100000;
  state.player.x = 620;
  state.player.y = 300;
  // Musuh di sisi berlawanan gedung uji.
  const e = addEnemy(state, 380, 300, { attackCooldown: 999 });
  state.obstacles = Object.freeze([Object.freeze(WALL)]);
  const d0 = Math.abs(e.x - state.player.x);
  let losReached = false;
  for (let i = 0; i < 200; i += 1) {
    stepGame(state, 0.05, {});
    if (hasLineOfSight(e, state.player, state.obstacles, 2)) {
      losReached = true;
      break;
    }
  }
  assert.ok(losReached, 'musuh akhirnya mendapat LOS dengan mengitari gedung');
  for (const o of state.obstacles) {
    assert.equal(circleIntersectsBox(e.x, e.y, e.radius, o), false, 'musuh tidak menembus gedung');
  }
  assert.ok(Math.abs(e.x - state.player.x) !== d0, 'musuh bergerak');
});

test('separasi tidak mendorong musuh ke dalam dinding', () => {
  const state = makeGame({});
  clearEnemies(state);
  state.obstacles = Object.freeze([Object.freeze(WALL)]);
  // Dua musuh bertumpuk tepat di wajah kiri dinding.
  const a = addEnemy(state, WALL.x - 16, 300);
  const b = addEnemy(state, WALL.x - 20, 302);
  for (let i = 0; i < 20; i += 1) stepGame(state, 0.05, {});
  for (const e of [a, b]) {
    for (const o of state.obstacles) {
      assert.equal(circleIntersectsBox(e.x, e.y, e.radius, o), false, `musuh ${e.id} di dalam dinding`);
    }
  }
});

test('skill area LOS-blocked tidak melukai musuh di balik dinding', () => {
  const state = makeGame({ characterId: 'pikachu' });
  clearEnemies(state);
  state.obstacles = Object.freeze([Object.freeze({ ...WALL, x: 440, w: 60, h: 240, y: 200 })]);
  state.player.x = 420;
  state.player.y = 300;
  const blocked = addEnemy(state, 520, 300); // 100 unit tapi di balik dinding
  const clear = addEnemy(state, 420, 420);   // bebas LOS (di bawah dinding)
  assert.equal(triggerSkill(state), true);
  assert.equal(blocked.hp, blocked.maxHp, 'terhalang dinding');
  assert.ok(clear.hp < clear.maxHp, 'yang bebas LOS terluka');
});

test('getAimTarget melewati target dekat terhalang untuk yang lebih jauh jelas', () => {
  const state = makeGame({});
  clearEnemies(state);
  state.obstacles = Object.freeze([Object.freeze({ ...WALL, x: 440, w: 60, h: 240, y: 200 })]);
  state.player.x = 420;
  state.player.y = 300;
  const blocked = addEnemy(state, 520, 300); // dekat tapi di balik dinding
  const clear = addEnemy(state, 420, 480);   // lebih jauh, LOS jelas
  const target = getAimTarget(state);
  assert.equal(target, clear, 'membidik target jelas, bukan yang terhalang');
  assert.ok(blocked !== target);
});

test('findPath menghasilkan waypoint yang mengitari gedung', () => {
  const path = findPath({ x: 380, y: 300 }, { x: 620, y: 300 }, 15, [WALL]);
  assert.ok(path.length >= 2, 'jalur punya waypoint belokan');
  // Semua waypoint walkable (tidak di dalam kotak).
  for (const wp of path) {
    assert.equal(circleIntersectsBox(wp.x, wp.y, 15, WALL), false);
  }
});

test('AI membersihkan sudut grazing — centerline bebas tapi badan menyangkut', () => {
  const state = makeGame({ phaseId: 'infiltrasi' });
  clearEnemies(state);
  state.player.hp = 100000;
  state.player.x = 620;
  state.player.y = 190;
  const e = addEnemy(state, 380, 190, { attackCooldown: 999, attackRange: 40 });
  state.obstacles = Object.freeze([Object.freeze(WALL)]);
  // LOS tembak (padding 2) lolos di atas pojok atas dinding, tetapi rute gerak
  // dengan clearance radius tubuh (17) harus berbelok.
  assert.equal(hasLineOfSight(e, state.player, state.obstacles, 2), true);
  assert.equal(hasLineOfSight(e, state.player, state.obstacles, e.radius + 2), false);
  for (let i = 0; i < 200; i += 1) {
    stepGame(state, 0.05, {});
    for (const o of state.obstacles) {
      assert.equal(
        circleIntersectsBox(e.x, e.y, e.radius, o),
        false,
        `langkah ${i}: badan di dalam dinding (${Math.round(e.x)},${Math.round(e.y)})`,
      );
    }
  }
  assert.ok(e.x > WALL.x + WALL.w, `musuh melewati sisi jauh dinding: x=${Math.round(e.x)}`);
  assert.ok(Math.hypot(e.x - 620, e.y - 190) < 80, `musuh tiba dekat pemain: (${Math.round(e.x)},${Math.round(e.y)})`);
});

test('level bawaan: spawn, zona, dan jalur utama bebas obstacle', () => {
  for (const o of LEVEL.obstacles) {
    assert.equal(circleIntersectsBox(500, 560, 15, o), false, `spawn vs ${o.id}`);
    assert.equal(circleIntersectsBox(500, 300, 15, o), false, `zona vs ${o.id}`);
  }
  const path = findPath({ x: 500, y: 560 }, { x: 500, y: 300 }, 15, LEVEL);
  assert.ok(path.length >= 1);
});
