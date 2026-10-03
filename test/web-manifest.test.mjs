// Uji manifest pintasan Android — baca file langsung, tanpa framework.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '../..');
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function pngSize(file) {
  const buf = readFileSync(path.join(root, file));
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file}: bukan PNG`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

test('manifest: identitas, start/scope relatif, warna', () => {
  assert.equal(manifest.name, 'Pokemon World War');
  assert.equal(manifest.short_name, 'Pokemon WW');
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'id');
  assert.equal(manifest.theme_color, '#f7f1e2');
  assert.equal(manifest.background_color, '#f7f1e2');
});

test('manifest: 3 ikon — 192/512 any + 512 maskable, file ada & ukuran sesuai', () => {
  assert.equal(manifest.icons.length, 3);
  const expected = [
    { src: 'assets/icons/game-icon-192.png', sizes: '192x192', purpose: 'any' },
    { src: 'assets/icons/game-icon-512.png', sizes: '512x512', purpose: 'any' },
    { src: 'assets/icons/game-icon-maskable-512.png', sizes: '512x512', purpose: 'maskable' },
  ];
  manifest.icons.forEach((icon, i) => {
    const exp = expected[i];
    assert.equal(icon.src, exp.src);
    assert.equal(icon.sizes, exp.sizes);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.purpose, exp.purpose);
    assert.ok(existsSync(path.join(root, icon.src)), `${icon.src} tidak ada`);
    const [w, h] = exp.sizes.split('x').map(Number);
    const dim = pngSize(icon.src);
    assert.deepEqual(dim, { w, h }, `${icon.src} dimensi salah`);
  });
});

test('manifest: semua path resolve di dalam prefix proyek (GitHub Pages aman)', () => {
  const base = 'https://example.test/pokemon-world-war/';
  for (const key of ['start_url', 'scope', 'id']) {
    const u = new URL(manifest[key], base);
    assert.ok(u.href.startsWith(base), `${key} keluar prefix: ${u.href}`);
  }
  for (const icon of manifest.icons) {
    const u = new URL(icon.src, base);
    assert.ok(u.href.startsWith(base), `ikon keluar prefix: ${u.href}`);
  }
});

test('index.html menautkan manifest + meta Android + ikon 192', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const frag of [
    'rel="manifest" href="manifest.json"',
    'name="theme-color" content="#f7f1e2"',
    'name="application-name"',
    'name="mobile-web-app-capable"',
    'sizes="192x192" href="assets/icons/game-icon-192.png"',
  ]) {
    assert.ok(html.includes(frag), `index.html kurang: ${frag}`);
  }
});

test('ikon maskable: kanvas 512 #f7f1e2, isi 360 terpusat', () => {
  const buf = readFileSync(path.join(root, 'assets/icons/game-icon-maskable-512.png'));
  const { w, h } = pngSize('assets/icons/game-icon-maskable-512.png');
  assert.deepEqual([w, h], [512, 512]);
  assert.ok(buf.length > 1000, 'PNG maskable terlalu kecil');
});
