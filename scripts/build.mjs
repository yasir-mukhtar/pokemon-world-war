// Build allowlist aset statis untuk Cloudflare Workers Static Assets.
// Hanya PUBLIC_FILES yang disalin ke dist/ — tanpa dependensi eksternal.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_FILES = [
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/data.js',
  'js/main.js',
  'js/game-engine.js',
  'js/collision.js',
  'js/level.js',
  'js/models3d.js',
  'js/render.js',
  'vendor/three/three.module.js',
  'vendor/three/three.core.js',
  'vendor/three/LICENSE',
  'assets/pikachu.svg',
  'assets/lucario.svg',
  'assets/characters/charizard-portrait.png',
  'assets/characters/gengar-portrait.png',
  'assets/icons/game-icon-192.png',
  'assets/icons/game-icon-512.png',
  'assets/icons/game-icon-maskable-512.png',
  'assets/icons/favicon-16.png',
  'assets/icons/favicon-32.png',
  'assets/icons/favicon.ico',
  'assets/icons/apple-touch-icon.png',
];

export const MAX_ASSET_BYTES = 25 * 1024 * 1024; // batas Cloudflare per file

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isUnder(child, parent) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Path riil untuk perbandingan containment — menelusuri symlink leluhur
// yang ada lalu menempelkan sisa path (outDir boleh belum ada).
function realPathUnder(target) {
  let p = path.resolve(target);
  const rest = [];
  while (!fs.existsSync(p)) {
    rest.unshift(path.basename(p));
    p = path.dirname(p);
  }
  return path.join(fs.realpathSync(p), ...rest);
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

export function buildStaticAssets({ rootDir = PROJECT_ROOT, outDir = path.join(rootDir, 'dist') } = {}) {
  const root = fs.realpathSync(rootDir);
  const out = path.resolve(outDir);
  const outReal = realPathUnder(out); // untuk perbandingan containment saja

  // Keamanan output: harus di dalam root (riil), bukan root, bukan folder sumber.
  if (outReal === root) {
    throw new Error(`outDir tidak boleh sama dengan root sumber: ${out}`);
  }
  if (!isUnder(outReal, root)) {
    throw new Error(`outDir harus berada di dalam root proyek: ${out}`);
  }
  const forbidden = new Set(PUBLIC_FILES.map((f) => f.split(path.sep)[0]));
  for (const seg of path.relative(root, outReal).split(path.sep)) {
    if (forbidden.has(seg)) {
      throw new Error(`outDir bertabrakan dengan folder sumber (${seg}): ${out}`);
    }
  }
  const allowed = new Set(PUBLIC_FILES);

  // Preflight: semua sumber ada, file reguler (bukan symlink), tidak lolos root.
  const entries = [];
  for (const rel of PUBLIC_FILES) {
    const src = path.join(root, rel);
    let st;
    try {
      st = fs.lstatSync(src);
    } catch {
      throw new Error(`Sumber wajib tidak ada: ${rel}`);
    }
    if (st.isSymbolicLink()) {
      throw new Error(`Sumber symlink ditolak: ${rel}`);
    }
    if (!st.isFile()) {
      throw new Error(`Sumber bukan file reguler: ${rel}`);
    }
    const real = fs.realpathSync(src);
    if (!isUnder(real, root)) {
      throw new Error(`Sumber lolos dari root via symlink: ${rel}`);
    }
    if (st.size > MAX_ASSET_BYTES) {
      throw new Error(`Aset melebihi batas ${MAX_ASSET_BYTES} B (${(st.size / 1048576).toFixed(1)} MiB): ${rel}`);
    }
    entries.push({ rel, src, size: st.size });
  }

  // Output existing: hanya boleh berisi file allowlist hasil build sebelumnya.
  if (fs.existsSync(out)) {
    const ost = fs.lstatSync(out);
    if (ost.isSymbolicLink() || !ost.isDirectory()) {
      throw new Error(`outDir bukan direktori reguler: ${out}`);
    }
    for (const p of walk(out)) {
      const relOut = path.relative(out, p);
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink() || !allowed.has(relOut)) {
        throw new Error(
          `File tak terduga di ${out}: ${relOut} — bersihkan manual (menolak menghapus file asing).`,
        );
      }
    }
  }

  // Salin.
  const files = [];
  let totalBytes = 0;
  let largest = { path: null, bytes: 0 };
  for (const { rel, src, size } of entries) {
    const dst = path.join(out, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    files.push({ path: rel, bytes: size });
    totalBytes += size;
    if (size > largest.bytes) largest = { path: rel, bytes: size };
  }

  // Validasi pasca-salin.
  for (const { path: rel, bytes } of files) {
    const dst = path.join(out, rel);
    const st = fs.lstatSync(dst);
    if (st.isSymbolicLink() || !st.isFile()) {
      throw new Error(`Output tidak valid: ${rel}`);
    }
    if (st.size > MAX_ASSET_BYTES || st.size !== bytes) {
      throw new Error(`Output ukuran salah/oversize: ${rel}`);
    }
  }
  const index = path.join(out, 'index.html');
  if (!fs.statSync(index).isFile()) {
    throw new Error('index.html tidak ada di output');
  }

  return { outDir: out, files, totalBytes, largest };
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = buildStaticAssets();
    console.log(`dist: ${r.files.length} file, ${(r.totalBytes / 1048576).toFixed(2)} MiB total`);
    console.log(`terbesar: ${r.largest.path} (${(r.largest.bytes / 1048576).toFixed(2)} MiB)`);
    for (const f of r.files) console.log(`  ${f.path} ${f.bytes}`);
  } catch (e) {
    console.error(`build gagal: ${e.message}`);
    process.exit(1);
  }
}
