// Pokemon World War — orkestrasi UI: setup bertahap + arena + input.
import {
  CHARACTERS,
  COUNTRIES,
  ROLES,
  PHASES,
  DURATIONS,
  DEFAULTS,
  getCharacter,
  getCountry,
  getPhase,
} from './data.js';
import { createGame, stepGame } from './game-engine.js';
import { render, createScenery } from './render.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const STORE_KEY = 'pww-selection';

function loadSelection() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') return { ...saved };
  } catch {
    /* abaikan */
  }
  return {};
}

const selection = {
  characterId: DEFAULTS.characterId,
  countryId: DEFAULTS.countryId,
  city: getCountry(DEFAULTS.countryId).cities[0],
  role: DEFAULTS.role,
  opposingId: DEFAULTS.opposingId,
  phaseId: DEFAULTS.phaseId,
  durationSeconds: DEFAULTS.durationSeconds,
  ...loadSelection(),
};

function sanitizeSelection() {
  if (!getCharacter(selection.characterId)) selection.characterId = DEFAULTS.characterId;
  if (!getCountry(selection.countryId)) selection.countryId = DEFAULTS.countryId;
  if (!ROLES.some((r) => r.id === selection.role)) selection.role = DEFAULTS.role;
  if (!getPhase(selection.phaseId)) selection.phaseId = DEFAULTS.phaseId;
  if (!DURATIONS.some((d) => d.seconds === selection.durationSeconds)) {
    selection.durationSeconds = DEFAULTS.durationSeconds;
  }
  if (!getCountry(selection.opposingId) || selection.opposingId === selection.countryId) {
    selection.opposingId =
      COUNTRIES.find((c) => c.id === DEFAULTS.opposingId && c.id !== selection.countryId)?.id ??
      COUNTRIES.find((c) => c.id !== selection.countryId).id;
  }
}
sanitizeSelection();

function saveSelection() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(selection));
  } catch {
    /* abaikan */
  }
}

// ---------- Util ----------
function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function effectiveCaptureTarget() {
  const phase = getPhase(selection.phaseId);
  return Math.min(phase.captureTarget, selection.durationSeconds * 0.5);
}

// ---------- Grup radio: roving tabindex + navigasi panah/Home/End ----------
function markRadio(container, btn) {
  [...container.querySelectorAll('[role="radio"]')].forEach((el) => {
    const on = el === btn;
    el.setAttribute('aria-checked', String(on));
    el.tabIndex = on ? 0 : -1;
  });
}

function enableRadioNav(container) {
  container.addEventListener('keydown', (e) => {
    if (e.target.getAttribute('role') !== 'radio') return;
    const items = [...container.querySelectorAll('[role="radio"]')];
    const cur = items.indexOf(e.target);
    if (cur < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next].click();
    items[next].focus();
  });
}

// ---------- Navigasi langkah ----------
const railBtns = $$('.rail-btn');
const panels = $$('.step-panel');

function gotoStep(n) {
  railBtns.forEach((b) => b.classList.toggle('is-active', b.dataset.goto === String(n)));
  panels.forEach((p) => {
    const active = p.id === `step-${n}`;
    p.classList.toggle('is-active', active);
    p.hidden = !active;
  });
}

railBtns.forEach((b) => b.addEventListener('click', () => gotoStep(b.dataset.goto)));
$$('.step-actions [data-goto]').forEach((b) =>
  b.addEventListener('click', () => gotoStep(b.dataset.goto)),
);

// ---------- Langkah 1: karakter ----------
const charGrid = $('#character-grid');

function buildCharacterGrid() {
  charGrid.innerHTML = '';
  for (const c of CHARACTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'char-card';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(c.id === selection.characterId));
    btn.dataset.id = c.id;
    btn.innerHTML = `
      <img src="${c.portrait}" alt="Ilustrasi ${c.name}" width="200" height="200" />
      <div class="char-name">${c.name}</div>
      <div class="char-title">${c.title}</div>
      <p class="char-meta">${c.role} · <b>HP ${c.hp}</b></p>
      <p class="char-skill"><b>${c.skill.name}:</b> ${c.skill.desc}</p>
      <span class="fan-tag">Fan-made</span>`;
    btn.addEventListener('click', () => {
      selection.characterId = c.id;
      saveSelection();
      markRadio(charGrid, btn);
      updateBriefing();
    });
    btn.tabIndex = c.id === selection.characterId ? 0 : -1;
    charGrid.appendChild(btn);
  }
}

// ---------- Langkah 2: medan ----------
const countrySel = $('#select-country');
const citySel = $('#select-city');
const opposingSel = $('#select-opposing');
const opposingLabel = $('#opposing-label');
const roleSegment = $('#role-segment');

function fillSelect(sel, options, current) {
  sel.innerHTML = '';
  for (const { value, label } of options) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  }
  sel.value = current;
}

function buildRoleSegment() {
  roleSegment.innerHTML = '';
  for (const r of ROLES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `seg-btn role-${r.id}`;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(r.id === selection.role));
    btn.dataset.id = r.id;
    btn.textContent = r.name;
    btn.tabIndex = r.id === selection.role ? 0 : -1;
    btn.addEventListener('click', () => {
      selection.role = r.id;
      saveSelection();
      syncRoleUI();
      updateRules();
      updateBriefing();
    });
    roleSegment.appendChild(btn);
  }
}

function syncRoleUI() {
  const role = ROLES.find((r) => r.id === selection.role) ?? ROLES[0];
  opposingLabel.textContent = role.opposingLabel;
  const active = [...roleSegment.querySelectorAll('[role="radio"]')].find(
    (el) => el.dataset.id === selection.role,
  );
  if (active) markRadio(roleSegment, active);
}

function syncBattlefield(changedCountry = false) {
  const country = getCountry(selection.countryId) ?? getCountry(DEFAULTS.countryId);
  if (changedCountry || !country.cities.includes(selection.city)) {
    selection.city = country.cities[0];
  }
  fillSelect(citySel, country.cities.map((c) => ({ value: c, label: c })), selection.city);

  if (selection.opposingId === country.id || !getCountry(selection.opposingId)) {
    selection.opposingId =
      COUNTRIES.find((c) => c.id === DEFAULTS.opposingId && c.id !== country.id)?.id ??
      COUNTRIES.find((c) => c.id !== country.id).id;
  }
  fillSelect(
    opposingSel,
    COUNTRIES.filter((c) => c.id !== country.id).map((c) => ({ value: c.id, label: c.name })),
    selection.opposingId,
  );
  countrySel.value = country.id;
}

function buildBattlefield() {
  fillSelect(
    countrySel,
    COUNTRIES.map((c) => ({ value: c.id, label: c.name })),
    selection.countryId,
  );
  buildRoleSegment();
  syncBattlefield(false);
  syncRoleUI();

  countrySel.addEventListener('change', () => {
    selection.countryId = countrySel.value;
    syncBattlefield(true);
    saveSelection();
    updateBriefing();
  });
  citySel.addEventListener('change', () => {
    selection.city = citySel.value;
    saveSelection();
    updateBriefing();
  });
  opposingSel.addEventListener('change', () => {
    selection.opposingId = opposingSel.value;
    saveSelection();
    updateBriefing();
  });
}

// ---------- Langkah 3: fase + waktu ----------
const phaseGrid = $('#phase-grid');
const timerSegment = $('#timer-segment');
const rulesBox = $('#rules-box');

function buildPhaseGrid() {
  phaseGrid.innerHTML = '';
  for (const p of PHASES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'phase-card';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(p.id === selection.phaseId));
    btn.dataset.id = p.id;
    btn.innerHTML = `
      <div class="phase-name">${p.name}</div>
      <div class="phase-meta"></div>
      <p class="phase-desc">${p.desc}</p>`;
    btn.tabIndex = p.id === selection.phaseId ? 0 : -1;
    btn.addEventListener('click', () => {
      selection.phaseId = p.id;
      saveSelection();
      markRadio(phaseGrid, btn);
      updateRules();
      updateBriefing();
    });
    phaseGrid.appendChild(btn);
  }
  updatePhaseMeta();
}

// Target efektif tergantung durasi — selalu tampilkan angka yang dipakai mesin.
function updatePhaseMeta() {
  [...phaseGrid.querySelectorAll('.phase-card')].forEach((el) => {
    const p = getPhase(el.dataset.id);
    const effective = Math.min(p.captureTarget, selection.durationSeconds * 0.5);
    el.querySelector('.phase-meta').textContent =
      `${p.enemies} musuh · target ${effective} dtk`;
  });
}

function buildTimerSegment() {
  timerSegment.innerHTML = '';
  for (const d of DURATIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seg-btn';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(d.seconds === selection.durationSeconds));
    btn.dataset.seconds = d.seconds;
    btn.textContent = d.label;
    btn.tabIndex = d.seconds === selection.durationSeconds ? 0 : -1;
    btn.addEventListener('click', () => {
      selection.durationSeconds = d.seconds;
      saveSelection();
      markRadio(timerSegment, btn);
      updatePhaseMeta();
      updateRules();
      updateBriefing();
    });
    timerSegment.appendChild(btn);
  }
}

function updateRules() {
  const phase = getPhase(selection.phaseId);
  const target = effectiveCaptureTarget();
  const roleWord = selection.role === 'menyerang' ? 'merebut' : 'mempertahankan';
  rulesBox.innerHTML = `
    <b>Aturan ${phase.name}:</b> ${phase.enemies} musuh aktif sekaligus; yang jatuh muncul kembali
    setelah jeda. Berdiri di dalam cincin zona tanpa musuh di sekitarnya untuk ${roleWord} kendali —
    target penuh <b>${target} detik</b> kendali. Kendali tidak berkurang saat kamu keluar.
    Menang lebih awal saat kendali penuh; saat waktu habis, menang jika kendali
    <b>&ge; 50% target (${Math.floor(target / 2)} dtk)</b>. Kalah jika HP-mu habis.`;
}

// ---------- Briefing ----------
const briefingMeta = $('#briefing-meta');
const objectiveLine = $('#objective-line');
const mapCanvas = $('#briefing-map');

function drawBriefingMap() {
  const ctx = mapCanvas.getContext('2d');
  const w = mapCanvas.width;
  const h = mapCanvas.height;
  const country = getCountry(selection.countryId);
  const opposing = getCountry(selection.opposingId);
  const attacking = selection.role === 'menyerang';
  ctx.clearRect(0, 0, w, h);
  // Dasar peta.
  ctx.fillStyle = '#efe6cd';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(31,26,16,0.08)';
  for (let x = 0; x <= w; x += 24) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  // Blok kota (kota terpilih = tengah, lebih besar).
  const blocks = [
    { x: 60, y: 60, w: 44, h: 32 }, { x: 70, y: 104, w: 36, h: 28 },
    { x: 116, y: 74, w: 30, h: 40 }, { x: 210, y: 58, w: 48, h: 30 },
    { x: 224, y: 100, w: 34, h: 34 }, { x: 264, y: 78, w: 30, h: 46 },
    { x: 118, y: 140, w: 56, h: 40 }, { x: 196, y: 146, w: 40, h: 30 },
    { x: 150, y: 96, w: 46, h: 40, main: true },
  ];
  for (const b of blocks) {
    ctx.fillStyle = b.main ? 'rgba(22,115,107,0.35)' : 'rgba(201,180,134,0.8)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.main ? '#16736b' : 'rgba(31,26,16,0.45)';
    ctx.lineWidth = b.main ? 2 : 1.2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Zona perebutan.
  ctx.beginPath();
  ctx.arc(173, 116, 30, 0, Math.PI * 2);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = '#1f1a10';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.setLineDash([]);
  // Panah taktis: menyerang = kita menuju lawan; bertahan = lawan menuju kita.
  const friendly = { x: 40, y: 176 };
  const enemy = { x: 286, y: 34 };
  const from = attacking ? friendly : enemy;
  const to = attacking ? { x: 210, y: 80 } : { x: 140, y: 140 };
  const color = attacking ? '#16736b' : '#c0392b';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo((from.x + to.x) / 2, from.y - 40, to.x, to.y);
  ctx.stroke();
  const ang = Math.atan2(to.y - (from.y - 40), to.x - (from.x + to.x) / 2);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - 10 * Math.cos(ang - 0.4), to.y - 10 * Math.sin(ang - 0.4));
  ctx.lineTo(to.x - 10 * Math.cos(ang + 0.4), to.y - 10 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  // Label negara.
  ctx.font = '700 9px "Avenir Next", sans-serif';
  ctx.fillStyle = '#16736b';
  ctx.fillText(country.name.toUpperCase(), 30, 194);
  ctx.fillStyle = '#c0392b';
  const label = opposing.name.toUpperCase();
  ctx.fillText(label, w - ctx.measureText(label).width - 12, 20);
}

function updateBriefing() {
  const c = getCharacter(selection.characterId);
  const country = getCountry(selection.countryId);
  const opposing = getCountry(selection.opposingId);
  const phase = getPhase(selection.phaseId);
  const role = ROLES.find((r) => r.id === selection.role) ?? ROLES[0];
  const target = effectiveCaptureTarget();
  briefingMeta.innerHTML = `
    <dt>Karakter</dt><dd>${c.name} — ${c.title}</dd>
    <dt>Medan</dt><dd>${country.name} / ${selection.city}</dd>
    <dt>Peran</dt><dd class="team-friendly">${role.name}</dd>
    <dt>${role.opposingLabel}</dt><dd class="team-enemy">${opposing.name}</dd>
    <dt>Fase</dt><dd>${phase.name} · ${phase.enemies} musuh</dd>
    <dt>Waktu</dt><dd>${fmtTime(selection.durationSeconds)}</dd>`;
  const verb = selection.role === 'menyerang' ? 'Rebut' : 'Pertahankan';
  objectiveLine.innerHTML = `<b>${verb} zona pusat ${selection.city}.</b>
    Kendali penuh ${target} detik = menang langsung; saat waktu habis butuh &ge; ${Math.floor(target / 2)} detik kendali.`;
  drawBriefingMap();
}

// ---------- Arena ----------
const setupShell = $('#setup-shell');
const arena = $('#arena');
const canvas = $('#game-canvas');
const canvasWrap = $('#canvas-wrap');
const touchControls = $('#touch-controls');
const pauseModal = $('#pause-modal');
const resultModal = $('#result-modal');

const hud = {
  context: $('#hud-context'),
  charName: $('#hud-char-name'),
  hpFill: $('#hud-hp-fill'),
  timer: $('#hud-timer'),
  objLabel: $('#hud-objective-label'),
  objFill: $('#hud-objective-fill'),
  objText: $('#hud-objective-text'),
  enemyCount: $('#hud-enemy-count'),
  csKeys: $('#cs-keys'),
  csHp: $('#cs-hp'),
  csSkill: $('#cs-skill'),
};

let match = null;
let lastFocused = null;

function isCoarse() {
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 720;
}

function showTouchControls() {
  touchControls.hidden = !isCoarse();
  updateControlsStrip();
}

function updateControlsStrip() {
  if (!match) return;
  const skill = match.state.player.character.skill;
  hud.csKeys.textContent = isCoarse()
    ? `Joystick — Gerak · \u2694 merah — Serang · Q — ${skill.name}`
    : `WASD / panah — Gerak · Spasi — Serang · Q — ${skill.name} · P / Esc — Jeda`;
}

function openModal(modal) {
  lastFocused = document.activeElement;
  modal.hidden = false;
  const first = modal.querySelector('.btn-primary');
  if (first) first.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

function resizeCanvas() {
  if (!match) return;
  const dpr = window.devicePixelRatio || 1;
  const s = match.state;
  const aspect = s.width / s.height;
  // Batasi lebar canvas agar HUD + strip kontrol + canvas muat di viewport.
  const padV = (parseFloat(getComputedStyle(arena).paddingTop) || 0) * 2;
  // Ukur chrome aktual (HUD + strip + celah) = tinggi frame dikurangi canvas saat ini.
  const frame = arena.querySelector('.arena-frame');
  const chrome = frame.scrollHeight - canvasWrap.offsetHeight;
  const availH = Math.max(160, arena.clientHeight - padV - chrome);
  const availW = Math.min(arena.clientWidth - padV, 1080);
  const cssW = Math.max(220, Math.floor(Math.min(availW, availH * aspect)));
  const cssH = Math.round(cssW / aspect);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvasWrap.style.width = `${cssW}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}

function buildInput() {
  const keys = match.keys;
  let moveX = 0;
  let moveY = 0;
  if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
  if (keys.has('d') || keys.has('arrowright')) moveX += 1;
  if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
  if (keys.has('s') || keys.has('arrowdown')) moveY += 1;
  moveX += match.joy.x;
  moveY += match.joy.y;
  const input = {
    moveX,
    moveY,
    attack: keys.has(' ') || match.touchAttack,
    skill: match.pressSkill,
  };
  match.pressSkill = false;
  return input;
}

function updateHUD() {
  const s = match.state;
  const p = s.player;
  hud.hpFill.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  hud.hpFill.style.background = p.hp / p.maxHp < 0.3 ? '#c0392b' : '#16736b';
  hud.timer.textContent = fmtTime(s.remaining);
  const pct = s.captureTarget > 0 ? (s.captured / s.captureTarget) * 100 : 0;
  hud.objFill.style.width = `${pct}%`;
  hud.objText.textContent = `${Math.floor(pct)}% · ${Math.floor(s.captured)}/${s.captureTarget} dtk${s.contested ? ' · DIPEREBUTKAN' : ''}`;
  hud.enemyCount.textContent = String(s.enemies.filter((e) => e.alive).length);
  hud.csHp.textContent = `HP ${Math.max(0, Math.round(p.hp))}/${p.maxHp}`;
  const cd = p.skillCooldown;
  hud.csSkill.textContent = cd > 0 ? `Q ${p.character.skill.name} ${cd.toFixed(1)}dtk` : `Q ${p.character.skill.name} siap`;
  hud.csSkill.className = cd > 0 ? 'cooling' : 'ready';
}

function setHudContext() {
  const s = match.state;
  const country = getCountry(s.config.countryId);
  const opposing = getCountry(s.config.opposingId);
  const phase = getPhase(s.config.phaseId);
  const role = ROLES.find((r) => r.id === s.config.role) ?? ROLES[0];
  hud.context.textContent = `${country.name} · ${s.config.city} — ${role.opposingLabel} ${opposing.name} · ${phase.name}`;
  hud.charName.textContent = s.player.character.name;
  hud.objLabel.textContent = s.config.role === 'menyerang' ? 'Rebut zona' : 'Pertahankan zona';
  updateControlsStrip();
}

function showResult() {
  const s = match.state;
  const won = s.status === 'won';
  const title = $('#result-title');
  title.className = won ? 'won' : 'lost';
  if (won) {
    title.textContent = 'Kemenangan';
    $('#result-desc').textContent =
      s.config.role === 'menyerang'
        ? `${s.config.city} berhasil direbut. Zona berada dalam kendalimu, komandan.`
        : `${s.config.city} berhasil dipertahankan. Garis pertahanan tidak tembus.`;
  } else {
    title.textContent = s.config.role === 'menyerang' ? 'Serangan gagal' : 'Pertahanan runtuh';
    $('#result-desc').textContent =
      s.player.hp <= 0
        ? `${s.player.character.name} tumbang di medan perang.`
        : `Waktu habis — kendali zona belum mencapai 50% target.`;
  }
  const pct = s.captureTarget > 0 ? Math.floor((s.captured / s.captureTarget) * 100) : 0;
  $('#result-stats').innerHTML = `
    <div><dt>Kendali zona</dt><dd>${pct}%</dd></div>
    <div><dt>Waktu berjalan</dt><dd>${fmtTime(s.elapsed)}</dd></div>
    <div><dt>Musuh dikalahkan</dt><dd>${s.kills}</dd></div>
    <div><dt>HP tersisa</dt><dd>${Math.max(0, Math.round(s.player.hp))}</dd></div>`;
  openModal(resultModal);
}

function clearInputs() {
  if (!match) return;
  match.keys.clear();
  match.joy = { x: 0, y: 0 };
  match.touchAttack = false;
  match.pressSkill = false;
  if (joyPointerId !== null) {
    try {
      joystick.releasePointerCapture(joyPointerId);
    } catch {
      /* tidak ada capture aktif */
    }
    joyPointerId = null;
  }
  setKnob(0, 0);
}

function newMatch(config) {
  return {
    state: createGame(config),
    scenery: createScenery(11),
    keys: new Set(),
    joy: { x: 0, y: 0 },
    pressSkill: false,
    touchAttack: false,
    rafId: 0,
    resultTimer: null,
    lastTime: 0,
    resultShown: false,
  };
}

function startMatch() {
  stopMatch();
  match = newMatch(selection);
  setupShell.hidden = true;
  arena.hidden = false;
  pauseModal.hidden = true;
  resultModal.hidden = true;
  setHudContext();
  showTouchControls();
  resizeCanvas();
  updateHUD();
  match.lastTime = performance.now();
  match.rafId = requestAnimationFrame(tick);
  $('#btn-pause').focus();
}

function restartMatch() {
  if (!match) return;
  const cfg = { ...match.state.config };
  stopMatch();
  match = newMatch(cfg);
  pauseModal.hidden = true;
  resultModal.hidden = true;
  setHudContext();
  showTouchControls();
  resizeCanvas();
  updateHUD();
  match.lastTime = performance.now();
  match.rafId = requestAnimationFrame(tick);
  $('#btn-pause').focus();
}

function stopMatch() {
  if (!match) return;
  clearInputs();
  if (match.rafId) cancelAnimationFrame(match.rafId);
  if (match.resultTimer) clearTimeout(match.resultTimer);
  match = null;
}

function tick(now) {
  if (!match) return;
  const dt = Math.min((now - match.lastTime) / 1000, 0.1);
  match.lastTime = now;
  const s = match.state;
  if (s.status === 'running') {
    stepGame(s, dt, buildInput());
  }
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / s.width;
  const sy = canvas.height / s.height;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  render(ctx, s, match.scenery, now / 1000);
  updateHUD();
  if ((s.status === 'won' || s.status === 'lost') && !match.resultShown) {
    match.resultShown = true;
    const m = match;
    m.resultTimer = setTimeout(() => {
      if (
        match === m &&
        (m.state.status === 'won' || m.state.status === 'lost')
      ) {
        showResult();
      }
    }, 450);
  }
  match.rafId = requestAnimationFrame(tick);
}

function pauseMatch() {
  if (!match || match.state.status !== 'running') return;
  match.state.status = 'paused';
  clearInputs();
  openModal(pauseModal);
}

function resumeMatch() {
  if (!match || match.state.status !== 'paused') return;
  match.state.status = 'running';
  match.lastTime = performance.now();
  closeModal(pauseModal);
}

function backToBriefing() {
  stopMatch();
  arena.hidden = true;
  setupShell.hidden = false;
  pauseModal.hidden = true;
  resultModal.hidden = true;
  $('#btn-start').focus();
}

// ---------- Input keyboard ----------
const GAME_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'q']);
const FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'OPTION']);

window.addEventListener('keydown', (e) => {
  if (!match || arena.hidden) return;
  const key = e.key.toLowerCase();
  const modalOpen = !pauseModal.hidden || !resultModal.hidden;
  if (modalOpen) {
    const modal = !pauseModal.hidden ? pauseModal : resultModal;
    if (key === 'tab') {
      // Jebak fokus di dalam modal yang terlihat.
      const btns = [...modal.querySelectorAll('button')].filter((b) => !b.disabled);
      if (btns.length > 0) {
        e.preventDefault();
        const i = btns.indexOf(document.activeElement);
        const next = e.shiftKey
          ? (i <= 0 ? btns.length - 1 : i - 1)
          : (i + 1) % btns.length;
        btns[next].focus();
      }
      return;
    }
    if ((key === 'escape' || key === 'p') && match.state.status === 'paused') {
      e.preventDefault();
      resumeMatch();
    }
    return;
  }
  if (FORM_TAGS.has(e.target.tagName)) return;
  if (GAME_KEYS.has(key)) {
    e.preventDefault();
    if (e.repeat) return;
    if (key === 'q') match.pressSkill = true;
    else match.keys.add(key);
  } else if (key === 'p' || key === 'escape') {
    e.preventDefault();
    if (match.state.status === 'running') pauseMatch();
    else if (match.state.status === 'paused' && pauseModal.hidden === false) resumeMatch();
  }
});

window.addEventListener('keyup', (e) => {
  if (!match) return;
  match.keys.delete(e.key.toLowerCase());
});

window.addEventListener('blur', () => {
  if (!match) return;
  clearInputs();
  if (match.state.status === 'running') pauseMatch();
});

// ---------- Input sentuh ----------
const joystick = $('#joystick');
const knob = $('#joystick-knob');

function setKnob(dx, dy) {
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

let joyPointerId = null;
joystick.addEventListener('pointerdown', (e) => {
  joyPointerId = e.pointerId;
  try {
    joystick.setPointerCapture(e.pointerId);
  } catch {
    /* pointer sintetis */
  }
  handleJoy(e);
});
joystick.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyPointerId) handleJoy(e);
});
function endJoy(e) {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  try {
    if (joystick.hasPointerCapture(e.pointerId)) joystick.releasePointerCapture(e.pointerId);
  } catch {
    /* pointer sintetis */
  }
  if (match) match.joy = { x: 0, y: 0 };
  setKnob(0, 0);
}
joystick.addEventListener('pointerup', endJoy);
joystick.addEventListener('pointercancel', endJoy);
joystick.addEventListener('lostpointercapture', (e) => {
  if (e.pointerId !== joyPointerId) return;
  joyPointerId = null;
  if (match) match.joy = { x: 0, y: 0 };
  setKnob(0, 0);
});

function handleJoy(e) {
  if (!match) return;
  const rect = joystick.getBoundingClientRect();
  if (rect.width < 10) return; // joystick tersembunyi (pointer halus) — abaikan
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = rect.width / 2 - 12;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  match.joy = { x: dx / max, y: dy / max };
  setKnob(dx, dy);
}

const touchAttack = $('#touch-attack');
const touchSkill = $('#touch-skill');
touchAttack.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try {
    touchAttack.setPointerCapture(e.pointerId);
  } catch {
    /* pointer sintetis */
  }
  if (match) match.touchAttack = true;
});
for (const ev of ['pointerup', 'pointercancel']) {
  touchAttack.addEventListener(ev, () => {
    if (match) match.touchAttack = false;
  });
}
touchSkill.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (match) match.pressSkill = true;
});

// ---------- Tombol arena ----------
$('#btn-start').addEventListener('click', startMatch);
$('#btn-pause').addEventListener('click', pauseMatch);
$('#btn-resume').addEventListener('click', resumeMatch);
$('#btn-restart').addEventListener('click', restartMatch);
$('#btn-to-briefing').addEventListener('click', backToBriefing);
$('#btn-replay').addEventListener('click', () => {
  resultModal.hidden = true;
  restartMatch();
});
$('#btn-result-briefing').addEventListener('click', backToBriefing);

window.addEventListener('resize', () => {
  if (!match) return;
  resizeCanvas();
  showTouchControls();
});

// Hook debug ringan untuk verifikasi otomatis (bukan bagian UI).
Object.defineProperty(window, '__pww', {
  get: () => match?.state ?? null,
});

// ---------- Init ----------
buildCharacterGrid();
buildBattlefield();
buildPhaseGrid();
buildTimerSegment();
for (const group of [charGrid, roleSegment, phaseGrid, timerSegment]) enableRadioNav(group);
updateRules();
updateBriefing();
gotoStep(1);
