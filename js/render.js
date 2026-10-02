// Renderer canvas — top-down arena kota dengan gaya peta taktis.
import { getAimTarget } from './game-engine.js';

// PRNG deterministik sederhana untuk tata letak pemandangan.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScenery(seed = 7) {
  const rnd = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const craters = [];
  // Blok kota di sudut-sudut, jauh dari zona pusat.
  const zones = [
    { x0: 40, y0: 40, x1: 300, y1: 180 },
    { x0: 660, y0: 40, x1: 960, y1: 180 },
    { x0: 40, y0: 430, x1: 280, y1: 610 },
    { x0: 700, y0: 430, x1: 960, y1: 610 },
  ];
  for (const z of zones) {
    const count = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i += 1) {
      const w = 34 + rnd() * 56;
      const h = 26 + rnd() * 44;
      buildings.push({
        x: z.x0 + rnd() * Math.max(1, z.x1 - z.x0 - w),
        y: z.y0 + rnd() * Math.max(1, z.y1 - z.y0 - h),
        w,
        h,
        shade: 0.75 + rnd() * 0.25,
      });
    }
  }
  for (let i = 0; i < 12; i += 1) {
    const x = 60 + rnd() * 880;
    const y = 60 + rnd() * 530;
    if (Math.hypot(x - 500, y - 300) < 190) continue;
    trees.push({ x, y, r: 9 + rnd() * 10 });
  }
  for (let i = 0; i < 6; i += 1) {
    const x = 80 + rnd() * 840;
    const y = 80 + rnd() * 490;
    if (Math.hypot(x - 500, y - 300) < 160) continue;
    craters.push({ x, y, r: 12 + rnd() * 16 });
  }
  return { buildings, trees, craters };
}

function drawTerrain(ctx, state, scenery, time) {
  const { width, height } = state;
  // Tanah dasar gading.
  ctx.fillStyle = '#efe6cd';
  ctx.fillRect(0, 0, width, height);
  // Kertas grafik halus.
  ctx.strokeStyle = 'rgba(31,26,16,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  // Jalan utama.
  ctx.fillStyle = '#e2d5b4';
  ctx.fillRect(0, 286, width, 44);
  ctx.fillRect(470, 0, 60, height);
  ctx.strokeStyle = 'rgba(31,26,16,0.22)';
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 308);
  ctx.lineTo(width, 308);
  ctx.moveTo(500, 0);
  ctx.lineTo(500, height);
  ctx.stroke();
  ctx.setLineDash([]);
  // Kawah.
  for (const c of scenery.craters) {
    ctx.fillStyle = '#d9cba7';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31,26,16,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(31,26,16,0.12)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bangunan (dekoratif, tidak menghalangi gerakan).
  for (const b of scenery.buildings) {
    ctx.fillStyle = `rgba(201, 180, 134, ${b.shade})`;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(31,26,16,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(31,26,16,0.18)';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 5);
  }
  // Pepohonan.
  for (const t of scenery.trees) {
    ctx.fillStyle = '#9aa86a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(31,26,16,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Vignette tepi.
  const grad = ctx.createRadialGradient(500, 325, 280, 500, 325, 620);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(31,26,16,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  void time;
}

function drawZone(ctx, state, time) {
  const z = state.zone;
  const pulse = 1 + Math.sin(time * 3) * 0.02;
  const contest = state.contested;
  // Radius perebutan luar.
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.contestRadius, 0, Math.PI * 2);
  ctx.strokeStyle = contest ? 'rgba(192,57,43,0.35)' : 'rgba(22,115,107,0.25)';
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  // Cincin utama.
  ctx.beginPath();
  ctx.arc(z.x, z.y, z.radius * pulse, 0, Math.PI * 2);
  ctx.fillStyle = contest ? 'rgba(192,57,43,0.10)' : 'rgba(22,115,107,0.12)';
  ctx.fill();
  ctx.strokeStyle = contest ? '#c0392b' : '#16736b';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Isi progres capture.
  const frac = state.captureTarget > 0 ? state.captured / state.captureTarget : 0;
  if (frac > 0) {
    ctx.beginPath();
    ctx.moveTo(z.x, z.y);
    ctx.arc(z.x, z.y, z.radius * 0.96, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(242,194,48,0.35)';
    ctx.fill();
  }
  // Penanda pusat.
  ctx.fillStyle = '#1f1a10';
  ctx.beginPath();
  ctx.arc(z.x, z.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayerSilhouette(ctx, p, time) {
  const c = p.character;
  const bob = Math.sin(time * 6) * 1.5;
  ctx.save();
  ctx.translate(p.x, p.y + bob);
  // Bayangan.
  ctx.fillStyle = 'rgba(31,26,16,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, p.radius * 0.9 - bob, p.radius * 0.95, p.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.color;
  ctx.strokeStyle = '#1f1a10';
  ctx.lineWidth = 2.5;
  if (c.id === 'pikachu') {
    // Telinga.
    ctx.beginPath();
    ctx.moveTo(-p.radius - 2, -p.radius - 12);
    ctx.lineTo(-p.radius + 4, -p.radius + 2);
    ctx.lineTo(-p.radius - 8, -p.radius + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.radius + 2, -p.radius - 12);
    ctx.lineTo(p.radius - 4, -p.radius + 2);
    ctx.lineTo(p.radius + 8, -p.radius + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(-p.radius * 0.55, p.radius * 0.25, 3.4, 0, Math.PI * 2);
    ctx.arc(p.radius * 0.55, p.radius * 0.25, 3.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.id === 'lucario') {
    ctx.beginPath();
    ctx.moveTo(-p.radius - 3, -p.radius - 10);
    ctx.lineTo(-p.radius + 5, -p.radius + 4);
    ctx.lineTo(-p.radius - 7, -p.radius + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.radius + 3, -p.radius - 10);
    ctx.lineTo(p.radius - 5, -p.radius + 4);
    ctx.lineTo(p.radius + 7, -p.radius + 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4e9d0';
    ctx.beginPath();
    ctx.arc(0, 3, p.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.id === 'charizard') {
    // Sayap.
    ctx.beginPath();
    ctx.moveTo(-p.radius - 16, -4);
    ctx.lineTo(-p.radius + 2, -p.radius);
    ctx.lineTo(-p.radius - 4, 6);
    ctx.closePath();
    ctx.fillStyle = '#3a7a5c';
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.radius + 16, -4);
    ctx.lineTo(p.radius - 2, -p.radius);
    ctx.lineTo(p.radius + 4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7ddae';
    ctx.beginPath();
    ctx.arc(0, 4, p.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Gengar — gumpalan berduri.
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? p.radius + 5 : p.radius;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(-5, -3, 2.6, 0, Math.PI * 2);
    ctx.arc(5, -3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Arah hadap.
  ctx.strokeStyle = 'rgba(31,26,16,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(p.facing.x * (p.radius + 8), p.facing.y * (p.radius + 8));
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  const bob = Math.sin(time * 5 + e.id) * 1.5;
  ctx.save();
  ctx.translate(e.x, e.y + bob);
  ctx.fillStyle = 'rgba(31,26,16,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, e.radius * 0.9 - bob, e.radius * 0.95, e.radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tubuh lencana merah.
  ctx.fillStyle = '#c0392b';
  ctx.strokeStyle = '#1f1a10';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -e.radius);
  ctx.lineTo(e.radius, 0);
  ctx.lineTo(0, e.radius);
  ctx.lineTo(-e.radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Mata visor.
  ctx.fillStyle = '#f7f1e2';
  ctx.fillRect(-6, -4, 12, 4);
  ctx.restore();
  // Bar HP musuh.
  const w = 34;
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(31,26,16,0.35)';
  ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * frac, 5);
}

function drawEffects(ctx, state) {
  for (const ef of state.effects) {
    const t = 1 - ef.ttl / ef.maxTtl;
    if (ef.type === 'ring') {
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius * (0.4 + 0.6 * t), 0, Math.PI * 2);
      ctx.strokeStyle = ef.color ?? '#f2c230';
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (ef.type === 'cone') {
      const half = ef.angle / 2;
      const base = Math.atan2(ef.dir.y, ef.dir.x);
      ctx.beginPath();
      ctx.moveTo(ef.x, ef.y);
      ctx.arc(ef.x, ef.y, ef.radius, base - half, base + half);
      ctx.closePath();
      ctx.globalAlpha = 0.45 * (1 - t);
      ctx.fillStyle = ef.color ?? '#e2703a';
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (ef.type === 'dash') {
      ctx.beginPath();
      ctx.moveTo(ef.x, ef.y);
      ctx.lineTo(ef.x2, ef.y2);
      ctx.strokeStyle = ef.color ?? '#3a7bd5';
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (ef.type === 'hit') {
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius * t + 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#1f1a10';
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (ef.type === 'ko') {
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius * t + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#c0392b';
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else if (ef.type === 'spawn') {
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ef.radius * (1 - t), 0, Math.PI * 2);
      ctx.strokeStyle = '#c0392b';
      ctx.globalAlpha = t < 1 ? ef.ttl / ef.maxTtl : 1;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawProjectiles(ctx, state) {
  for (const p of state.projectiles) {
    const isPlayer = p.team === 'player';
    ctx.save();
    ctx.translate(p.x, p.y);
    // Jejak.
    ctx.strokeStyle = isPlayer ? 'rgba(242,194,48,0.55)' : 'rgba(192,57,43,0.55)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-p.vx * 0.04, -p.vy * 0.04);
    ctx.stroke();
    ctx.fillStyle = isPlayer ? '#f2c230' : '#c0392b';
    ctx.strokeStyle = '#1f1a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawAimLine(ctx, state) {
  const target = getAimTarget(state);
  if (!target) return;
  const p = state.player;
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = 'rgba(31,26,16,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(target.x, target.y, target.radius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(192,57,43,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawSkillCooldown(ctx, state) {
  const p = state.player;
  const frac = p.skillCooldown > 0 ? p.skillCooldown / p.character.skill.cooldown : 0;
  if (frac <= 0) return;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.arc(p.x, p.y, p.radius + 9, -Math.PI / 2, -Math.PI / 2 + (1 - frac) * Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(31,26,16,0.25)';
  ctx.fill();
}

export function render(ctx, state, scenery, time) {
  ctx.clearRect(0, 0, state.width, state.height);
  drawTerrain(ctx, state, scenery, time);
  drawZone(ctx, state, time);
  drawAimLine(ctx, state);
  for (const e of state.enemies) {
    if (e.alive) drawEnemy(ctx, e, time);
  }
  drawPlayerSilhouette(ctx, state.player, time);
  drawSkillCooldown(ctx, state);
  drawProjectiles(ctx, state);
  drawEffects(ctx, state);
  if (state.status === 'paused') {
    ctx.fillStyle = 'rgba(23,20,16,0.35)';
    ctx.fillRect(0, 0, state.width, state.height);
  }
}
