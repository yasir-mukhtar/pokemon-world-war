# Pokemon World War

Prototipe browser **fan-made dan tidak resmi** yang terinspirasi Pokemon Unite: satu kota, satu pertarungan, solo melawan AI. Tidak ada multiplayer daring, tidak ada afiliasi dengan Nintendo/The Pokemon Company — semua aset digambar lokal.

## Menjalankan

```bash
npm run dev        # atau: node server.mjs
# buka http://127.0.0.1:5173
```

Butuh Node.js >= 18. Port bisa diganti: `PORT=8080 npm run dev`.

## Uji

```bash
npm test           # node --test — menguji mesin permainan murni (tanpa DOM)
```

## Cara bermain

1. **Pilih karakter** — Pikachu (cepat, jarak jauh), Lucario (seimbang, jarak dekat), Charizard (kuat, jarak jauh), Gengar (licik, menyerap HP).
2. **Medan perang** — pilih negara dan kota, tentukan peranmu *Bertahan* atau *Menyerang*, serta negara lawan (contoh: Polandia / Warsawa dijajah Thailand).
3. **Fase & waktu** — Infiltrasi (2 musuh), Perebutan kota (3 musuh), atau Pertahanan terakhir (4 musuh); durasi 1/3/5 menit.
4. Tekan **Mulai perang solo**.

**Aturan:** berdiri di dalam cincin zona pusat tanpa musuh di sekitarnya untuk mengisi kendali. Kendali penuh = menang langsung. Saat waktu habis, menang jika kendali >= 50% target. HP habis = kalah. Musuh yang jatuh muncul kembali setelah jeda, dibatasi jumlah fase.

## Kontrol

| Aksi | Keyboard | Sentuh |
| --- | --- | --- |
| Gerak | WASD / panah | Joystick kiri |
| Serangan dasar (bidik otomatis) | Spasi | Tombol merah |
| Skill unik | Q | Tombol kuning |
| Jeda / lanjut | P atau Esc | Tombol Jeda |

Strip kontrol di bawah HUD selalu menampilkan daftar kontrol aktif beserta nama skill,
HP numerik, dan hitung mundur cooldown skill. Di layar sentuh, joystick kiri menggerakkan
karakter; tombol merah menyerang, tombol kuning memakai skill.

## Struktur

- `server.mjs` — server statis Node bawaan (anti path-traversal, `PORT` bisa diatur).
- `js/data.js` — data karakter, negara/kota, fase.
- `js/game-engine.js` — simulasi murni (`createGame`, `stepGame`, `triggerAttack`, `triggerSkill`).
- `js/render.js` — renderer canvas arena.
- `js/main.js` — UI setup, input, HUD, modal.
- `test/engine.test.mjs` — uji mesin dengan RNG terinjeksi.
