// Mesin permainan murni — tanpa DOM, dapat diuji dengan node:test.
import {
  CHARACTERS,
  COUNTRIES,
  PHASES,
  DURATIONS,
  DEFAULTS,
  getCharacter,
  getCountry,
  getPhase,
} from './data.js';

export const ARENA = { width: 1000, height: 650 };
const MAX_DT = 0.1;
const SUBSTEP = 0.05;
const ENEMY_RESPAWN = 3;
const ZONE = { x: 500, y: 300, radius: 105, contestRadius: 150 };
const MIN_SPAWN_DIST = 260;

const ENEMY_BASE = {
  hp: 95,
  speed: 165,
  radius: 15,
  attackRange: 235,
  attackDamage: 13,
  attackCooldown: 1.6,
  projectileSpeed: 370,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeRole(role) {
  return role === 'menyerang' ? 'menyerang' : 'bertahan';
}

export function normalizeConfig(config = {}) {
  const character = getCharacter(config.characterId) ?? getCharacter(DEFAULTS.characterId);
  const country = getCountry(config.countryId) ?? getCountry(DEFAULTS.countryId);
  const city = country.cities.includes(config.city) ? config.city : country.cities[0];
  const role = normalizeRole(config.role);
  let opposing = getCountry(config.opposingId);
  if (!opposing || opposing.id === country.id) {
    opposing =
      COUNTRIES.find((c) => c.id === DEFAULTS.opposingId && c.id !== country.id) ??
      COUNTRIES.find((c) => c.id !== country.id);
  }
  const phase = getPhase(config.phaseId) ?? getPhase(DEFAULTS.phaseId);
  const durationSeconds = DURATIONS.some((d) => d.seconds === config.durationSeconds)
    ? config.durationSeconds
    : DEFAULTS.durationSeconds;
  const captureTarget = Math.min(phase.captureTarget, durationSeconds * 0.5);
  return {
    characterId: character.id,
    countryId: country.id,
    city,
    role,
    opposingId: opposing.id,
    phaseId: phase.id,
    durationSeconds,
    captureTarget,
    enemyCount: phase.enemies,
  };
}

function spawnPoint(random, player) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const edge = Math.floor(random() * 4);
    const t = random();
    const margin = 40;
    let x;
    let y;
    if (edge === 0) {
      x = margin + t * (ARENA.width - margin * 2);
      y = margin;
    } else if (edge === 1) {
      x = ARENA.width - margin;
      y = margin + t * (ARENA.height - margin * 2);
    } else if (edge === 2) {
      x = margin + t * (ARENA.width - margin * 2);
      y = ARENA.height - margin;
    } else {
      x = margin;
      y = margin + t * (ARENA.height - margin * 2);
    }
    if (Math.hypot(x - player.x, y - player.y) >= MIN_SPAWN_DIST) return { x, y };
  }
  // Cadangan: sudut inset-40 terjauh dari pemain (selalu >= ~500 dari mana pun).
  const corners = [
    { x: 40, y: 40 },
    { x: ARENA.width - 40, y: 40 },
    { x: 40, y: ARENA.height - 40 },
    { x: ARENA.width - 40, y: ARENA.height - 40 },
  ];
  let best = corners[0];
  let bestDist = -1;
  for (const c of corners) {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function makeEnemy(state, random) {
  const p = spawnPoint(random, state.player);
  const id = state.nextId;
  state.nextId += 1;
  return {
    id,
    x: p.x,
    y: p.y,
    hp: ENEMY_BASE.hp,
    maxHp: ENEMY_BASE.hp,
    speed: ENEMY_BASE.speed,
    radius: ENEMY_BASE.radius,
    attackRange: ENEMY_BASE.attackRange,
    attackDamage: ENEMY_BASE.attackDamage,
    attackCooldown: 0.9 + random() * 0.6,
    projectileSpeed: ENEMY_BASE.projectileSpeed,
    alive: true,
  };
}

export function createGame(config = {}, random = Math.random) {
  const normalized = normalizeConfig(config);
  const character = getCharacter(normalized.characterId);
  const phase = getPhase(normalized.phaseId);
  const player = {
    x: ARENA.width / 2,
    y: ARENA.height - 90,
    hp: character.hp,
    maxHp: character.hp,
    speed: character.speed,
    radius: character.radius,
    facing: { x: 0, y: -1 },
    attackCooldown: 0,
    skillCooldown: 0,
    character,
  };
  const state = {
    status: 'running',
    width: ARENA.width,
    height: ARENA.height,
    config: normalized,
    player,
    enemies: [],
    projectiles: [],
    effects: [],
    zone: { ...ZONE },
    elapsed: 0,
    remaining: normalized.durationSeconds,
    duration: normalized.durationSeconds,
    captured: 0,
    captureTarget: normalized.captureTarget,
    contested: false,
    playerInZone: false,
    kills: 0,
    respawnTimer: null,
    nextId: 1,
    random,
  };
  for (let i = 0; i < phase.enemies; i += 1) {
    state.enemies.push(makeEnemy(state, random));
  }
  return state;
}

function aimTarget(state) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const d = dist(enemy, state.player);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best && bestDist <= state.player.character.attackRange ? best : null;
}

// Dipakai renderer untuk menampilkan garis bidik ke musuh terdekat dalam jangkauan.
export function getAimTarget(state) {
  return aimTarget(state);
}

function fireProjectile(state, from, dir, spec) {
  state.projectiles.push({
    x: from.x,
    y: from.y,
    vx: dir.x * spec.speed,
    vy: dir.y * spec.speed,
    radius: spec.radius ?? 6,
    damage: spec.damage,
    team: spec.team,
    life: spec.life ?? 1.1,
  });
}

export function triggerAttack(state) {
  if (state.status !== 'running') return false;
  const player = state.player;
  if (player.attackCooldown > 0) return false;
  const character = player.character;
  const target = aimTarget(state);
  let dir;
  if (target) {
    dir = { x: target.x - player.x, y: target.y - player.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    dir = { x: dir.x / len, y: dir.y / len };
  } else {
    dir = { ...player.facing };
  }
  player.facing = dir;
  player.attackCooldown = character.attackCooldown;
  fireProjectile(state, player, dir, {
    speed: character.projectileSpeed,
    damage: character.attackDamage,
    team: 'player',
    radius: 6,
    life: (character.attackRange * 1.15) / character.projectileSpeed,
  });
  return true;
}

function damageEnemy(state, enemy, amount) {
  enemy.hp -= amount;
  state.effects.push({ type: 'hit', x: enemy.x, y: enemy.y, radius: 26, ttl: 0.25, maxTtl: 0.25 });
  if (enemy.hp <= 0) {
    enemy.alive = false;
    state.kills += 1;
    state.effects.push({ type: 'ko', x: enemy.x, y: enemy.y, radius: 40, ttl: 0.5, maxTtl: 0.5 });
  }
}

function damagePlayer(state, amount) {
  state.player.hp -= amount;
  state.effects.push({
    type: 'hit',
    x: state.player.x,
    y: state.player.y,
    radius: 26,
    ttl: 0.25,
    maxTtl: 0.25,
  });
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    state.status = 'lost';
  }
}

function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function triggerSkill(state) {
  if (state.status !== 'running') return false;
  const player = state.player;
  if (player.skillCooldown > 0) return false;
  const skill = player.character.skill;
  player.skillCooldown = skill.cooldown;

  if (skill.id === 'kilat') {
    for (const enemy of state.enemies) {
      if (enemy.alive && dist(enemy, player) <= skill.radius) {
        damageEnemy(state, enemy, skill.damage);
      }
    }
    state.effects.push({
      type: 'ring',
      x: player.x,
      y: player.y,
      radius: skill.radius,
      ttl: 0.45,
      maxTtl: 0.45,
      color: '#f2c230',
    });
  } else if (skill.id === 'dash') {
    const from = { x: player.x, y: player.y };
    const nx = clamp(player.x + player.facing.x * skill.distance, player.radius, state.width - player.radius);
    const ny = clamp(player.y + player.facing.y * skill.distance, player.radius, state.height - player.radius);
    for (const enemy of state.enemies) {
      if (enemy.alive && pointToSegmentDistance(enemy.x, enemy.y, from.x, from.y, nx, ny) <= skill.width / 2 + enemy.radius) {
        damageEnemy(state, enemy, skill.damage);
      }
    }
    player.x = nx;
    player.y = ny;
    state.effects.push({
      type: 'dash',
      x: from.x,
      y: from.y,
      x2: nx,
      y2: ny,
      ttl: 0.35,
      maxTtl: 0.35,
      color: '#3a7bd5',
    });
  } else if (skill.id === 'api') {
    const cosHalf = Math.cos(skill.angle / 2);
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const d = Math.hypot(dx, dy);
      if (d <= skill.range && (d === 0 || (dx * player.facing.x + dy * player.facing.y) / d >= cosHalf)) {
        damageEnemy(state, enemy, skill.damage);
      }
    }
    state.effects.push({
      type: 'cone',
      x: player.x,
      y: player.y,
      dir: { ...player.facing },
      radius: skill.range,
      angle: skill.angle,
      ttl: 0.4,
      maxTtl: 0.4,
      color: '#e2703a',
    });
  } else if (skill.id === 'drain') {
    let hits = 0;
    for (const enemy of state.enemies) {
      if (enemy.alive && dist(enemy, player) <= skill.radius) {
        damageEnemy(state, enemy, skill.damage);
        hits += 1;
      }
    }
    if (hits > 0) {
      player.hp = Math.min(player.maxHp, player.hp + skill.healPerHit * hits);
    }
    state.effects.push({
      type: 'ring',
      x: player.x,
      y: player.y,
      radius: skill.radius,
      ttl: 0.45,
      maxTtl: 0.45,
      color: '#7b5ea7',
    });
  }
  return true;
}

function movePlayer(state, input, dt) {
  const player = state.player;
  let mx = Number(input?.moveX ?? 0);
  let my = Number(input?.moveY ?? 0);
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
    player.x = clamp(player.x + mx * player.speed * dt, player.radius, state.width - player.radius);
    player.y = clamp(player.y + my * player.speed * dt, player.radius, state.height - player.radius);
    player.facing = { x: mx, y: my };
  }
}

function updateEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > enemy.attackRange * 0.75) {
      enemy.x += (dx / d) * enemy.speed * dt;
      enemy.y += (dy / d) * enemy.speed * dt;
    }
    enemy.x = clamp(enemy.x, enemy.radius, state.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, state.height - enemy.radius);
    if (d <= enemy.attackRange && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = ENEMY_BASE.attackCooldown;
      fireProjectile(state, enemy, { x: dx / d, y: dy / d }, {
        speed: enemy.projectileSpeed,
        damage: enemy.attackDamage,
        team: 'enemy',
        radius: 6,
        life: 1.4,
      });
    }
  }
  // Pemisahan halus antar-musuh agar tidak bertumpuk.
  const alive = state.enemies.filter((e) => e.alive);
  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius + 4;
      if (d > 0 && d < min) {
        const push = ((min - d) / 2) * 0.6;
        a.x -= (dx / d) * push;
        a.y -= (dy / d) * push;
        b.x += (dx / d) * push;
        b.y += (dy / d) * push;
      }
    }
  }
}

function updateRespawns(state, dt) {
  const aliveCount = state.enemies.filter((e) => e.alive).length;
  if (aliveCount >= state.config.enemyCount) {
    state.respawnTimer = null;
    return;
  }
  if (state.respawnTimer == null) state.respawnTimer = ENEMY_RESPAWN;
  state.respawnTimer -= dt;
  if (state.respawnTimer <= 1e-9) {
    state.respawnTimer = ENEMY_RESPAWN;
    const enemy = makeEnemy(state, state.random);
    state.enemies.push(enemy);
    state.effects.push({ type: 'spawn', x: enemy.x, y: enemy.y, radius: 34, ttl: 0.6, maxTtl: 0.6 });
  }
}

function updateProjectiles(state, dt) {
  const player = state.player;
  for (const p of state.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.team === 'player') {
      for (const enemy of state.enemies) {
        if (enemy.alive && Math.hypot(enemy.x - p.x, enemy.y - p.y) <= enemy.radius + p.radius) {
          damageEnemy(state, enemy, p.damage);
          p.life = 0;
          break;
        }
      }
    } else if (Math.hypot(player.x - p.x, player.y - p.y) <= player.radius + p.radius) {
      damagePlayer(state, p.damage);
      p.life = 0;
      if (state.status !== 'running') return;
    }
    if (p.x < -20 || p.x > state.width + 20 || p.y < -20 || p.y > state.height + 20) {
      p.life = 0;
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.life > 0);
}

function updateCapture(state, dt) {
  if (state.status !== 'running') return;
  const player = state.player;
  const inZone = dist(player, state.zone) <= state.zone.radius;
  const contested = state.enemies.some(
    (e) => e.alive && dist(e, state.zone) <= state.zone.contestRadius,
  );
  state.contested = contested;
  state.playerInZone = inZone;
  if (inZone && !contested) {
    state.captured = Math.min(state.captureTarget, state.captured + dt);
    if (state.captured >= state.captureTarget) {
      state.status = 'won';
    }
  }
}

function updateEffects(state, dt) {
  for (const e of state.effects) e.ttl -= dt;
  state.effects = state.effects.filter((e) => e.ttl > 0);
  state.enemies = state.enemies.filter((e) => e.alive || e.hp > 0);
}

function subStep(state, input, dt) {
  if (state.status !== 'running') return;
  const player = state.player;
  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.skillCooldown = Math.max(0, player.skillCooldown - dt);
  movePlayer(state, input, dt);
  if (input?.attack) triggerAttack(state);
  if (input?.skill) triggerSkill(state);
  updateEnemies(state, dt);
  updateRespawns(state, dt);
  updateProjectiles(state, dt);
  updateEffects(state, dt);
  updateCapture(state, dt);
}

export function stepGame(state, deltaSeconds, input = {}) {
  if (!state || state.status !== 'running') return state;
  let remaining = Math.min(Math.max(deltaSeconds, 0), MAX_DT, state.duration - state.elapsed);
  while (remaining > 1e-9 && state.status === 'running') {
    const dt = Math.min(remaining, SUBSTEP);
    subStep(state, input, dt);
    remaining -= dt;
    state.elapsed += dt;
    state.remaining = Math.max(0, state.duration - state.elapsed);
  }
  if (state.status === 'running' && state.remaining <= 0) {
    state.status = state.captured >= state.captureTarget * 0.5 ? 'won' : 'lost';
  }
  return state;
}
