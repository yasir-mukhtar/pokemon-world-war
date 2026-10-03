// Uji build allowlist dist/ untuk Cloudflare Workers Static Assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_FILES, MAX_ASSET_BYTES, buildStaticAssets } from '../scripts/build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(populate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pww-build-'));
  for (const rel of PUBLIC_FILES) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `// ${rel}`);
  }
  populate?.(dir);
  return dir;
}

const listOut = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(path.join(dir, 'dist'), p));
    }
  };
  walk(path.join(dir, 'dist'));
  return out.sort();
};

test('build menyalin tepat 24 file allowlist, mengabaikan yang lain', () => {
  const dir = fixture((d) => {
    fs.mkdirSync(path.join(d, '.git'), { recursive: true });
    fs.writeFileSync(path.join(d, '.git', 'x'), 'x');
    fs.mkdirSync(path.join(d, 'node_modules', 'junk'), { recursive: true });
    fs.writeFileSync(path.join(d, 'node_modules', 'junk', 'x.js'), 'x');
    fs.mkdirSync(path.join(d, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', 'source.jpg'), 'x');
    fs.writeFileSync(path.join(d, 'oversized-ignore.bin'), 'x');
  });
  const r = buildStaticAssets({ rootDir: dir });
  assert.equal(r.files.length, 24);
  assert.deepEqual(listOut(dir), [...PUBLIC_FILES].sort());
});

test('sumber allowlist hilang -> throw SEBELUM output ditulis', () => {
  const dir = fixture((d) => fs.rmSync(path.join(d, 'js', 'main.js')));
  assert.throws(() => buildStaticAssets({ rootDir: dir }), /js\/main\.js|js.main\.js/);
  assert.equal(fs.existsSync(path.join(dir, 'dist')), false);
});

test('aset allowlist >25MiB ditolak; tepat 25MiB diterima', () => {
  const dir = fixture((d) => fs.truncateSync(path.join(d, 'index.html'), MAX_ASSET_BYTES + 1));
  assert.throws(() => buildStaticAssets({ rootDir: dir }), /index\.html.*25|25.*index\.html|melebihi/);

  const dir2 = fixture((d) => fs.truncateSync(path.join(d, 'index.html'), MAX_ASSET_BYTES));
  const r = buildStaticAssets({ rootDir: dir2 });
  assert.equal(r.files.length, 24);
});

test('file non-allowlist >25MiB diabaikan (tidak pernah terupload)', () => {
  const dir = fixture((d) => {
    fs.writeFileSync(path.join(d, 'big-secret.bin'), 'x');
    fs.truncateSync(path.join(d, 'big-secret.bin'), MAX_ASSET_BYTES + 10);
  });
  const r = buildStaticAssets({ rootDir: dir });
  assert.equal(r.files.length, 24);
  assert.equal(fs.existsSync(path.join(dir, 'dist', 'big-secret.bin')), false);
});

test('rebuild berhasil; file asing di dist -> throw, bukan hapus', () => {
  const dir = fixture();
  buildStaticAssets({ rootDir: dir });
  const r2 = buildStaticAssets({ rootDir: dir });
  assert.equal(r2.files.length, 24);
  fs.writeFileSync(path.join(dir, 'dist', 'extra.html'), 'x');
  assert.throws(() => buildStaticAssets({ rootDir: dir }), /tak terduga|Unexpected/);
});

test('outDir = root sumber atau folder sumber -> throw', () => {
  const dir = fixture();
  assert.throws(() => buildStaticAssets({ rootDir: dir, outDir: dir }), /root/);
  assert.throws(
    () => buildStaticAssets({ rootDir: dir, outDir: path.join(dir, 'js') }),
    /bertabrakan|sumber/,
  );
  assert.throws(
    () => buildStaticAssets({ rootDir: dir, outDir: '/tmp/pww-outside-x' }),
    /dalam root/,
  );
});

test('symlink sumber yang meloloskan root -> ditolak', { skip: process.platform === 'win32' }, () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pww-out-'));
  fs.writeFileSync(path.join(outside, 'secret.js'), 'x');
  const dir = fixture((d) => {
    fs.rmSync(path.join(d, 'js', 'data.js'));
    fs.symlinkSync(path.join(outside, 'secret.js'), path.join(d, 'js', 'data.js'));
  });
  assert.throws(() => buildStaticAssets({ rootDir: dir }), /symlink/);
});

test('symlink di dalam dist -> ditolak', { skip: process.platform === 'win32' }, () => {
  const dir = fixture();
  buildStaticAssets({ rootDir: dir });
  fs.symlinkSync('/etc/passwd', path.join(dir, 'dist', 'evil'));
  assert.throws(() => buildStaticAssets({ rootDir: dir }), /symlink|tak terduga/);
});

// ---------- Proyek nyata ----------
test('build proyek nyata: entry, css, semua js, vendor, ikon hadir di dist', () => {
  const r = buildStaticAssets();
  const names = r.files.map((f) => f.path);
  for (const need of PUBLIC_FILES) assert.ok(names.includes(need), need);
  assert.ok(fs.statSync(path.join(r.outDir, 'index.html')).isFile());
  assert.ok(r.largest.bytes <= MAX_ASSET_BYTES);
});

test('manifest: ikon yang dideklarasikan ada di allowlist', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  for (const ic of m.icons) assert.ok(PUBLIC_FILES.includes(ic.src), ic.src);
});

test('data.js: semua portrait karakter ada di allowlist', () => {
  const data = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
  for (const m of data.matchAll(/portrait:\s*'([^']+)'/g)) {
    assert.ok(PUBLIC_FILES.includes(m[1]), m[1]);
  }
});

test('import modul JS resolve ke file allowlist (bukan URL/literal palsu)', () => {
  const jsFiles = PUBLIC_FILES.filter((f) => f.startsWith('js/'));
  for (const f of jsFiles) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const line of src.split('\n')) {
      const m = line.match(/^\s*(?:import|export)\b[^'"]*from\s*['"]([^'"]+)['"]/)
        ?? line.match(/^\s*import\s*['"]([^'"]+)['"]/);
      if (!m) continue;
      const spec = m[1];
      assert.ok(!spec.startsWith('http'), `${f}: import absolut ${spec}`);
      const resolved = path.normalize(path.join(path.dirname(f), spec));
      assert.ok(PUBLIC_FILES.includes(resolved), `${f}: import keluar allowlist -> ${resolved}`);
    }
  }
});

// ---------- Kontrak deploy ----------
test('wrangler.jsonc + package.json: kontrak Static Assets & skrip deploy', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8'));
  assert.equal(cfg.compatibility_date, '2026-09-04');
  assert.equal(cfg.assets.directory, './dist');
  assert.equal(cfg.assets.html_handling, 'auto-trailing-slash');
  assert.equal(cfg.assets.not_found_handling, 'none');
  assert.equal(cfg.main, undefined);
  assert.equal(cfg.assets.binding, undefined);

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.build, 'node scripts/build.mjs');
  assert.ok(pkg.scripts.deploy.startsWith('npm run build &&'));
  assert.equal(pkg.devDependencies.wrangler, '4.127.1');
  assert.match(pkg.engines.node, />=\s*22/);
});
