// Geometri tabrakan & navigasi murni — tanpa DOM, dapat diuji dengan node:test.
import { LEVEL } from './level.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const MAX_STEP = 4; // sub-langkah perpindahan agar dash cepat tidak menembus dinding

export function circleIntersectsBox(x, y, r, box) {
  const cx = clamp(x, box.x, box.x + box.w);
  const cy = clamp(y, box.y, box.y + box.h);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

// Dorong keluar lingkaran yang menumpuk kotak: titik terdekat untuk kontak
// normal, wajah terdekat bila pusat berada di dalam kotak.
function resolveOverlap(body, box) {
  const r = body.radius;
  const cx = clamp(body.x, box.x, box.x + box.w);
  const cy = clamp(body.y, box.y, box.y + box.h);
  const dx = body.x - cx;
  const dy = body.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0) {
    const left = body.x - box.x;
    const right = box.x + box.w - body.x;
    const top = body.y - box.y;
    const bottom = box.y + box.h - body.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) body.x = box.x - r;
    else if (m === right) body.x = box.x + box.w + r;
    else if (m === top) body.y = box.y - r;
    else body.y = box.y + box.h + r;
  } else if (d2 < r * r) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    body.x += dx * push;
    body.y += dy * push;
  }
}

// Geser lingkaran dengan slide sumbu-terpisah; memutasi body.x/y dan
// mengembalikan titik akhir aktual. bounds = {width,height} logis.
export function moveCircle(body, dx, dy, bounds, obstacles) {
  const len = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(len / MAX_STEP));
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i += 1) {
    // Fase X — slide vertikal alami saat wajah menahan.
    body.x = clamp(body.x + sx, body.radius, bounds.width - body.radius);
    for (let p = 0; p < 2; p += 1) {
      for (const o of obstacles) {
        if (circleIntersectsBox(body.x, body.y, body.radius, o)) resolveOverlap(body, o);
      }
    }
    // Fase Y.
    body.y = clamp(body.y + sy, body.radius, bounds.height - body.radius);
    for (let p = 0; p < 2; p += 1) {
      for (const o of obstacles) {
        if (circleIntersectsBox(body.x, body.y, body.radius, o)) resolveOverlap(body, o);
      }
    }
  }
  body.x = clamp(body.x, body.radius, bounds.width - body.radius);
  body.y = clamp(body.y, body.radius, bounds.height - body.radius);
  return { x: body.x, y: body.y };
}

// Parameter masuk t pertama segmen -> AABB (slab). null bila tidak kena.
export function segmentBoxT(x1, y1, x2, y2, box, padding = 0) {
  const minX = box.x - padding;
  const maxX = box.x + box.w + padding;
  const minY = box.y - padding;
  const maxY = box.y + box.h + padding;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-12) {
    if (x1 < minX || x1 > maxX) return null;
  } else {
    let ta = (minX - x1) / dx;
    let tb = (maxX - x1) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  if (Math.abs(dy) < 1e-12) {
    if (y1 < minY || y1 > maxY) return null;
  } else {
    let ta = (minY - y1) / dy;
    let tb = (maxY - y1) / dy;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return null;
  }
  return t0;
}

// Parameter t pertama segmen menyentuh lingkaran. null bila tidak kena.
export function segmentCircleT(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return fx * fx + fy * fy <= r * r ? 0 : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0; // mulai di dalam
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function hasLineOfSight(a, b, obstacles, padding = 0) {
  for (const o of obstacles) {
    if (segmentBoxT(a.x, a.y, b.x, b.y, o, padding) !== null) return false;
  }
  return true;
}

// ---------- Navigasi grid A* ----------
const GRID = 40;
const GRID_OFF = 20;

function navGrid(obstacles, radius, width, height) {
  const cols = Math.floor((width - GRID_OFF * 2) / GRID) + 1;
  const rows = Math.floor((height - GRID_OFF * 2) / GRID) + 1;
  const walk = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = GRID_OFF + i * GRID;
      const y = GRID_OFF + j * GRID;
      walk[j * cols + i] = obstacles.every((o) => !circleIntersectsBox(x, y, radius, o)) ? 1 : 0;
    }
  }
  return { cols, rows, walk, width, height };
}

function nodeAt(grid, i, j) {
  return { x: GRID_OFF + i * GRID, y: GRID_OFF + j * GRID, i, j };
}

function nearestWalkable(grid, x, y) {
  const ci = clamp(Math.round((x - GRID_OFF) / GRID), 0, grid.cols - 1);
  const cj = clamp(Math.round((y - GRID_OFF) / GRID), 0, grid.rows - 1);
  let best = null;
  let bestD = Infinity;
  for (let j = 0; j < grid.rows; j += 1) {
    for (let i = 0; i < grid.cols; i += 1) {
      if (!grid.walk[j * grid.cols + i]) continue;
      const d = Math.abs(i - ci) + Math.abs(j - cj);
      if (d < bestD) {
        bestD = d;
        best = { i, j };
      }
    }
  }
  return best;
}

// A* 8-arah tanpa memotong sudut; hasil dihaluskan greedy via LOS ber-radius.
// obstacles boleh array kotak atau objek level. Mengembalikan array waypoint
// (mungkin kosong bila start==target sudah clear).
export function findPath(start, target, radius, level = LEVEL) {
  const obstacles = Array.isArray(level) ? level : level.obstacles;
  const width = Array.isArray(level) ? LEVEL.width : level.width;
  const height = Array.isArray(level) ? LEVEL.height : level.height;
  const grid = navGrid(obstacles, radius, width, height);
  const from = nearestWalkable(grid, start.x, start.y);
  const to = nearestWalkable(grid, target.x, target.y);
  if (!from || !to) return [];

  const { cols, rows, walk } = grid;
  const idx = (i, j) => j * cols + i;
  const g = new Float64Array(cols * rows).fill(Infinity);
  const parent = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const h = (i, j) => Math.hypot(i - to.i, j - to.j);
  const open = [{ i: from.i, j: from.j, f: h(from.i, from.j) }];
  g[idx(from.i, from.j)] = 0;
  const DIRS = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k += 1) if (open[k].f < open[bi].f) bi = k;
    const cur = open.splice(bi, 1)[0];
    const ci = idx(cur.i, cur.j);
    if (closed[ci]) continue;
    closed[ci] = 1;
    if (cur.i === to.i && cur.j === to.j) break;
    for (const [di, dj, cost] of DIRS) {
      const ni = cur.i + di;
      const nj = cur.j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      if (!walk[idx(ni, nj)] || closed[idx(ni, nj)]) continue;
      // Tanpa potong sudut: diagonal butuh kedua tetangga ortogonal bebas.
      if (di !== 0 && dj !== 0 && (!walk[idx(cur.i + di, cur.j)] || !walk[idx(cur.i, cur.j + dj)])) continue;
      const ng = g[ci] + cost;
      if (ng < g[idx(ni, nj)]) {
        g[idx(ni, nj)] = ng;
        parent[idx(ni, nj)] = ci;
        open.push({ i: ni, j: nj, f: ng + h(ni, nj) });
      }
    }
  }
  if (parent[idx(to.i, to.j)] === -1 && !(from.i === to.i && from.j === to.j)) {
    // Target tak terjangkau — kembalikan jalur sebagian ke node terdekat target.
    let bi = -1;
    let bh = Infinity;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        if (closed[idx(i, j)] && h(i, j) < bh) {
          bh = h(i, j);
          bi = idx(i, j);
        }
      }
    }
    if (bi < 0) return [];
    parent[idx(to.i, to.j)] = parent[bi]; // tidak dipakai; rekonstruksi via bi
    const chain = [];
    let c = bi;
    while (c !== -1) {
      chain.unshift(nodeAt(grid, c % cols, Math.floor(c / cols)));
      c = parent[c];
    }
    return chain;
  }
  const chain = [];
  let c = idx(to.i, to.j);
  while (c !== -1) {
    chain.unshift(nodeAt(grid, c % cols, Math.floor(c / cols)));
    c = parent[c];
  }
  // Penghalusan greedy: lompat ke node terjauh dengan LOS bebas radius.
  const smooth = [];
  let anchor = { x: start.x, y: start.y };
  let k = 0;
  while (k < chain.length) {
    let far = k;
    for (let m = chain.length - 1; m > k; m -= 1) {
      if (hasLineOfSight(anchor, chain[m], obstacles, radius)) {
        far = m;
        break;
      }
    }
    smooth.push(chain[far]);
    anchor = chain[far];
    k = far + 1;
  }
  // Segmen akhir menuju target hanya bila segmennya bebas.
  const last = smooth.length ? smooth[smooth.length - 1] : { x: start.x, y: start.y };
  if (hasLineOfSight(last, target, obstacles, radius)) {
    smooth.push({ x: target.x, y: target.y });
  }
  return smooth;
}
