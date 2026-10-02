import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, triggerAttack, triggerSkill, normalizeConfig } from '../js/game-engine.js';
import { getCharacter, getPhase } from '../js/data.js';

// RNG deterministik: mengembalikan nilai tetap agar posisi spawn konsisten.
const fixedRandom = (value = 0.4) => () => value;
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

function makeGame(overrides = {}, random = fixedRandom(0.4)) {
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
    attackCooldown: 0,
    projectileSpeed: 370,
    alive: true,
    ...overrides,
  };
  state.enemies.push(enemy);
  return enemy;
}

test('konfigurasi karakter dan fase diterapkan ke state', () => {
  const state = makeGame({ characterId: 'charizard', phaseId: 'infiltrasi' });
  const character = getCharacter('charizard');
  const phase = getPhase('infiltrasi');
  assert.equal(state.player.maxHp, character.hp);
  assert.equal(state.player.speed, character.speed);
  assert.equal(state.enemies.filter((e) => e.alive).length, phase.enemies);
  assert.equal(state.captureTarget, Math.min(phase.captureTarget, 180 * 0.5));
  assert.equal(state.status, 'running');
  assert.equal(state.width, 1000);
  assert.equal(state.height, 650);
});

test('negara/kota dinormalisasi dan negara lawan selalu berbeda', () => {
  const cfg = normalizeConfig({ countryId: 'indonesia', city: 'Atlantis', opposingId: 'indonesia' });
  assert.equal(cfg.countryId, 'indonesia');
  assert.equal(cfg.city, 'Jakarta');
  assert.notEqual(cfg.opposingId, 'indonesia');

  const cfg2 = normalizeConfig({ countryId: 'thailand', opposingId: 'thailand' });
  assert.notEqual(cfg2.opposingId, 'thailand');

  const state = makeGame({ countryId: 'jepang', city: 'Kyoto', opposingId: 'brasil' });
  assert.equal(state.config.city, 'Kyoto');
  assert.equal(state.config.opposingId, 'brasil');
});

test('gerakan diagonal dinormalisasi dan posisi dibatasi arena', () => {
  const state = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  state.player.x = 400;
  state.player.y = 300;
  state.player.hp = 10000;
  const start = { x: state.player.x, y: state.player.y };
  // 20 langkah 0.05 = 1 detik gerakan diagonal.
  for (let i = 0; i < 20; i += 1) stepGame(state, 0.05, { moveX: 1, moveY: 1 });
  const moved = Math.hypot(state.player.x - start.x, state.player.y - start.y);
  assert.ok(Math.abs(moved - state.player.speed) < 1.5, `moved ${moved} ~ speed ${state.player.speed}`);

  // Dorong ke pojok — tidak boleh keluar arena.
  for (let i = 0; i < 40; i += 1) stepGame(state, 0.05, { moveX: 1, moveY: -1 });
  assert.ok(state.player.x <= state.width - state.player.radius);
  assert.ok(state.player.y >= state.player.radius);
  for (let i = 0; i < 60; i += 1) stepGame(state, 0.05, { moveX: -1, moveY: 1 });
  assert.ok(state.player.x >= state.player.radius);
  assert.ok(state.player.y <= state.height - state.player.radius);
});

test('status paused/finished membekukan timer, gerakan, dan kerusakan', () => {
  const state = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  const enemy = state.enemies[0];
  enemy.x = state.player.x + 100;
  enemy.y = state.player.y;
  enemy.attackCooldown = 0;
  const snapshot = JSON.parse(JSON.stringify({ e: state.elapsed, r: state.remaining, p: state.player, en: state.enemies }));

  state.status = 'paused';
  stepGame(state, 0.05, { moveX: 1, attack: true, skill: true });
  assert.equal(state.elapsed, snapshot.e);
  assert.equal(state.remaining, snapshot.r);
  assert.equal(state.player.x, snapshot.p.x);
  assert.equal(state.player.hp, snapshot.p.hp);
  assert.equal(state.projectiles.length, 0);

  state.status = 'won';
  stepGame(state, 0.05, { moveX: -1 });
  assert.equal(state.player.x, snapshot.p.x);
  assert.equal(state.elapsed, snapshot.e);
});

test('musuh mendekati pemain dan menyerang dengan cooldown', () => {
  const state = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  const enemy = addEnemy(state, state.player.x + 400, state.player.y);
  const startDist = 400;
  for (let i = 0; i < 10; i += 1) stepGame(state, 0.05, {});
  const midDist = Math.abs(enemy.x - state.player.x);
  assert.ok(midDist < startDist, 'musuh maju mendekat');

  // Tempatkan dalam jangkauan, biarkan menembak, proyektil mengenai pemain.
  enemy.x = state.player.x + 150;
  enemy.y = state.player.y;
  enemy.attackCooldown = 0;
  const hpBefore = state.player.hp;
  for (let i = 0; i < 20 && state.player.hp === hpBefore; i += 1) stepGame(state, 0.05, {});
  assert.ok(state.player.hp < hpBefore, 'pemain terkena serangan musuh');
  assert.ok(enemy.attackCooldown > 0, 'cooldown serangan musuh aktif setelah menembak');
});

test('serangan biasa melukai target dan cooldown mencegah spam', () => {
  const state = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  const enemy = addEnemy(state, state.player.x + 150, state.player.y);
  assert.equal(triggerAttack(state), true);
  assert.equal(triggerAttack(state), false, 'serangan kedua ditahan cooldown');
  assert.equal(state.projectiles.length, 1);
  const hpBefore = enemy.hp;
  for (let i = 0; i < 15 && enemy.hp === hpBefore; i += 1) stepGame(state, 0.05, {});
  assert.ok(enemy.hp < hpBefore, 'target terkena proyektil');
});

test('skill Pikachu: kerusakan area dalam radius saja + cooldown', () => {
  const state = makeGame({ characterId: 'pikachu' }, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  const near = addEnemy(state, state.player.x + 100, state.player.y);
  const far = addEnemy(state, state.player.x + 400, state.player.y);
  const skill = getCharacter('pikachu').skill;
  assert.equal(triggerSkill(state), true);
  assert.equal(near.hp, near.maxHp - skill.damage);
  assert.equal(far.hp, far.maxHp);
  assert.equal(triggerSkill(state), false, 'skill cooldown mencegah pakai ulang');
  assert.ok(state.player.skillCooldown > 0);
});

test('skill Lucario: dash ke depan + kerusakan lintasan', () => {
  const state = makeGame({ characterId: 'lucario' }, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  state.player.x = 400;
  state.player.y = 400;
  state.player.facing = { x: 1, y: 0 };
  const enemy = addEnemy(state, 500, 400);
  const xBefore = state.player.x;
  const skill = getCharacter('lucario').skill;
  assert.equal(triggerSkill(state), true);
  assert.ok(state.player.x > xBefore + 100, 'pemain melesat ke depan');
  assert.ok(enemy.hp <= enemy.maxHp - skill.damage, 'musuh di lintasan terluka');
});

test('skill Charizard: kerucut api melukai depan, bukan belakang', () => {
  const state = makeGame({ characterId: 'charizard' }, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  state.player.facing = { x: 1, y: 0 };
  const front = addEnemy(state, state.player.x + 200, state.player.y);
  const behind = addEnemy(state, state.player.x - 200, state.player.y);
  const skill = getCharacter('charizard').skill;
  assert.equal(triggerSkill(state), true);
  assert.ok(front.hp <= front.maxHp - skill.damage);
  assert.equal(behind.hp, behind.maxHp);
});

test('skill Gengar: kerusakan area + memulihkan HP per musuh', () => {
  const state = makeGame({ characterId: 'gengar' }, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  state.player.hp = 100;
  const a = addEnemy(state, state.player.x + 80, state.player.y);
  const b = addEnemy(state, state.player.x, state.player.y - 80);
  const skill = getCharacter('gengar').skill;
  assert.equal(triggerSkill(state), true);
  assert.ok(a.hp <= a.maxHp - skill.damage);
  assert.ok(b.hp <= b.maxHp - skill.damage);
  assert.equal(state.player.hp, 100 + skill.healPerHit * 2);
});

test('kemajuan zona: tanpa saingan maju, diperebutkan/di luar diam', () => {
  const state = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  state.player.x = state.zone.x;
  state.player.y = state.zone.y;
  for (let i = 0; i < 20; i += 1) stepGame(state, 0.05, {});
  assert.ok(state.captured > 0.9, 'capture naik di zona tanpa saingan');

  const contested = addEnemy(state, state.zone.x + 40, state.zone.y);
  const before = state.captured;
  for (let i = 0; i < 10; i += 1) stepGame(state, 0.05, {});
  assert.equal(state.captured, before, 'tidak maju saat diperebutkan');
  assert.equal(state.contested, true);
  contested.alive = false;

  state.player.x = 100;
  state.player.y = 100;
  for (let i = 0; i < 10; i += 1) stepGame(state, 0.05, {});
  assert.equal(state.captured, before, 'tidak maju di luar zona');
  assert.equal(state.playerInZone, false);
});

test('mencapai target capture menghasilkan kemenangan awal', () => {
  const state = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  state.captured = state.captureTarget - 0.1;
  state.player.x = state.zone.x;
  state.player.y = state.zone.y;
  stepGame(state, 0.1, {});
  assert.equal(state.status, 'won');
});

test('HP pemain nol menghasilkan kekalahan', () => {
  const state = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(state);
  addEnemy(state, state.player.x + 100, state.player.y, { attackCooldown: 0 });
  state.player.hp = 10;
  for (let i = 0; i < 30 && state.status === 'running'; i += 1) stepGame(state, 0.05, {});
  assert.equal(state.player.hp, 0);
  assert.equal(state.status, 'lost');
});

test('waktu habis: capture >=50% menang, di bawah kalah', () => {
  const win = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(win);
  win.captured = win.captureTarget * 0.6;
  win.elapsed = win.duration - 0.02;
  stepGame(win, 0.05, {});
  assert.equal(win.remaining, 0);
  assert.equal(win.status, 'won');

  const lose = makeGame({}, seqRandom(0.1, 0.2, 0.3, 0.9));
  clearEnemies(lose);
  lose.captured = lose.captureTarget * 0.4;
  lose.elapsed = lose.duration - 0.02;
  stepGame(lose, 0.05, {});
  assert.equal(lose.status, 'lost');
});

test('replay: createGame ulang menghasilkan state segar dengan config sama', () => {
  const first = makeGame({ characterId: 'gengar', phaseId: 'pertahanan', durationSeconds: 300 }, fixedRandom(0.3));
  stepGame(first, 1, { moveX: 1 });
  first.player.hp = 5;
  const second = makeGame({ characterId: 'gengar', phaseId: 'pertahanan', durationSeconds: 300 }, fixedRandom(0.3));
  assert.deepEqual(second.config, first.config);
  assert.equal(second.status, 'running');
  assert.equal(second.elapsed, 0);
  assert.equal(second.player.hp, second.player.maxHp);
  assert.equal(second.captured, 0);
  assert.equal(second.enemies.length, getPhase('pertahanan').enemies);
});

test('durasi 1 menit membatasi target capture ke 30 detik', () => {
  const state = makeGame({ durationSeconds: 60 });
  assert.equal(state.captureTarget, 30);
  const infil = makeGame({ durationSeconds: 60, phaseId: 'infiltrasi' });
  assert.equal(infil.captureTarget, 30);
});

test('musuh respawn setelah cooldown, dibatasi jumlah fase', () => {
  const state = makeGame({ phaseId: 'infiltrasi' }, fixedRandom(0.25));
  assert.equal(state.enemies.length, 2);
  clearEnemies(state);
  for (let i = 0; i < 80; i += 1) stepGame(state, 0.05, {});
  const alive = state.enemies.filter((e) => e.alive).length;
  assert.ok(alive <= 2, `maks ${2} musuh aktif, dapat ${alive}`);
  assert.ok(alive >= 1, 'musuh respawn setelah cooldown');
});

test('kill nyata -> jumlah musuh berkurang hingga cooldown 3 detik', () => {
  const state = makeGame({ phaseId: 'infiltrasi', characterId: 'pikachu' }, fixedRandom(0.25));
  const victim = state.enemies[0];
  victim.x = state.player.x + 50;
  victim.y = state.player.y;
  victim.hp = 10;
  assert.equal(triggerSkill(state), true);
  assert.equal(victim.alive, false, 'skill benar-benar membunuh');
  for (let i = 0; i < 40; i += 1) stepGame(state, 0.05, {});
  assert.equal(
    state.enemies.filter((e) => e.alive).length,
    1,
    'tidak ada respawn sebelum 3 detik',
  );
  for (let i = 0; i < 30; i += 1) stepGame(state, 0.05, {});
  assert.equal(
    state.enemies.filter((e) => e.alive).length,
    2,
    'respawn muncul setelah ~3 detik',
  );
});

test('fallback spawn: semua titik terlalu dekat -> sudut terjauh >=260', () => {
  // RNG selalu memilih tengah atas (500,40) — 200px dari pemain di (500,240).
  const rand = seqRandom(0.1, 0.5);
  const state = makeGame({ phaseId: 'infiltrasi' }, rand);
  state.player.x = 500;
  state.player.y = 240;
  clearEnemies(state);
  for (let i = 0; i < 70; i += 1) stepGame(state, 0.05, {});
  const spawned = state.enemies.filter((e) => e.alive);
  assert.ok(spawned.length >= 1, 'respawn terjadi');
  for (const e of spawned) {
    assert.ok(Math.hypot(e.x - 500, e.y - 240) >= 260, `spawn ${e.x},${e.y} terlalu dekat`);
  }
});

test('kekalahan mematikan tidak tertimpa capture di frame yang sama', () => {
  const state = makeGame({}, seqRandom(0.1, 0.5));
  clearEnemies(state);
  state.player.x = state.zone.x;
  state.player.y = state.zone.y;
  state.captured = state.captureTarget - 0.01;
  state.player.hp = 1;
  state.projectiles.push({
    x: state.player.x + 15,
    y: state.player.y,
    vx: -400,
    vy: 0,
    radius: 6,
    damage: 50,
    team: 'enemy',
    life: 1,
  });
  const before = state.captured;
  stepGame(state, 0.05, {});
  assert.equal(state.player.hp, 0);
  assert.equal(state.status, 'lost');
  assert.equal(state.captured, before, 'capture tidak bertambah setelah kalah');
});

test('dt dipotong ke sisa durasi: timeout kalah dan elapsed tepat', () => {
  const state = makeGame({}, seqRandom(0.1, 0.5));
  clearEnemies(state);
  state.player.x = state.zone.x;
  state.player.y = state.zone.y;
  state.captured = state.captureTarget / 2 - 0.02;
  state.elapsed = state.duration - 0.01;
  stepGame(state, 0.05, {});
  assert.equal(state.status, 'lost');
  assert.equal(state.remaining, 0);
  assert.ok(Math.abs(state.elapsed - state.duration) < 1e-6, `elapsed=${state.elapsed}`);
});
