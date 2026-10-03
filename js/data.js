// Data statis Pokemon World War — prototipe fan-made, bukan produk resmi.

export const CHARACTERS = [
  {
    id: 'pikachu',
    name: 'Pikachu',
    title: 'Penyerang Kilat',
    role: 'Jarak jauh · Kecepatan',
    hp: 320,
    speed: 235,
    radius: 14,
    attackRange: 270,
    attackDamage: 26,
    attackCooldown: 0.55,
    projectileSpeed: 540,
    color: '#f2c230',
    portrait: 'assets/pikachu.svg',
    skill: {
      id: 'kilat',
      name: 'Sambaran Kilat',
      desc: 'Menyambar semua musuh di radius 150 dengan 70 kerusakan petir.',
      cooldown: 8,
      radius: 150,
      damage: 70,
    },
    desc: 'Cepat dan mematikan dari jauh. Andalkan tembakan beruntun dan kilat area.',
  },
  {
    id: 'lucario',
    name: 'Lucario',
    title: 'Ksatria Aura',
    role: 'Seimbang · Jarak dekat',
    hp: 430,
    speed: 250,
    radius: 15,
    attackRange: 130,
    attackDamage: 34,
    attackCooldown: 0.5,
    projectileSpeed: 460,
    color: '#3a7bd5',
    portrait: 'assets/lucario.svg',
    skill: {
      id: 'dash',
      name: 'Terjangan Aura',
      desc: 'Melesat 170 ke depan dan melukai musuh di sepanjang lintasan (60 kerusakan).',
      cooldown: 7,
      distance: 170,
      width: 90,
      damage: 60,
    },
    desc: 'Petarung seimbang dengan pertahanan tinggi dan terjangan aura menusuk.',
  },
  {
    id: 'charizard',
    name: 'Charizard',
    title: 'Penguasa Langit',
    role: 'Kekuatan · Jarak jauh',
    hp: 380,
    speed: 215,
    radius: 17,
    attackRange: 300,
    attackDamage: 32,
    attackCooldown: 0.7,
    projectileSpeed: 480,
    color: '#e2703a',
    portrait: 'assets/characters/charizard-portrait.png',
    referenceSheet: 'assets/reference/charizard-sheet.jpg',
    skill: {
      id: 'api',
      name: 'Semburan Api',
      desc: 'Menyemburkan kerucut api 260 ke depan, 85 kerusakan ke semua musuh yang terkena.',
      cooldown: 9,
      range: 260,
      angle: Math.PI / 3,
      damage: 85,
    },
    desc: 'Kerusakan tinggi dari jarak jauh. Semburan api membakar area depan.',
  },
  {
    id: 'gengar',
    name: 'Gengar',
    title: 'Bayangan Licik',
    role: 'Cepat · Jarak jauh',
    hp: 300,
    speed: 262,
    radius: 14,
    attackRange: 250,
    attackDamage: 24,
    attackCooldown: 0.5,
    projectileSpeed: 500,
    color: '#7b5ea7',
    portrait: 'assets/characters/gengar-portrait.png',
    referenceSheet: 'assets/reference/gengar-sheet.jpg',
    skill: {
      id: 'drain',
      name: 'Sedot Bayangan',
      desc: 'Menyerap energi: 55 kerusakan ke musuh radius 170 dan memulihkan 30 HP per musuh.',
      cooldown: 8,
      radius: 170,
      damage: 55,
      healPerHit: 30,
    },
    desc: 'Gesit dan sulit ditangkap. Sedot bayangan memulihkan HP dari musuh.',
  },
];

export const COUNTRIES = [
  { id: 'polandia', name: 'Polandia', cities: ['Warsawa', 'Krakow', 'Gdansk'] },
  { id: 'indonesia', name: 'Indonesia', cities: ['Jakarta', 'Surabaya', 'Bandung'] },
  { id: 'thailand', name: 'Thailand', cities: ['Bangkok', 'Chiang Mai', 'Phuket'] },
  { id: 'jepang', name: 'Jepang', cities: ['Tokyo', 'Osaka', 'Kyoto'] },
  { id: 'brasil', name: 'Brasil', cities: ['Brasilia', 'Rio de Janeiro', 'Sao Paulo'] },
];

export const ROLES = [
  { id: 'bertahan', name: 'Bertahan', opposingLabel: 'Dijajah oleh' },
  { id: 'menyerang', name: 'Menyerang', opposingLabel: 'Dibela oleh' },
];

export const PHASES = [
  {
    id: 'infiltrasi',
    name: 'Infiltrasi',
    enemies: 2,
    captureTarget: 70,
    desc: 'Masuk senyap. Hanya 2 musuh awal menjaga zona — rebut kendali secepat mungkin.',
  },
  {
    id: 'perebutan',
    name: 'Perebutan kota',
    enemies: 3,
    captureTarget: 90,
    desc: 'Pertarungan terbuka di pusat kota. 3 musuh aktif memperebutkan zona.',
  },
  {
    id: 'pertahanan',
    name: 'Pertahanan terakhir',
    enemies: 4,
    captureTarget: 60,
    desc: 'Gelombang penutup. 4 musuh aktif — tahan atau rebut zona di bawah tekanan.',
  },
];

export const DURATIONS = [
  { seconds: 60, label: '1 menit' },
  { seconds: 180, label: '3 menit' },
  { seconds: 300, label: '5 menit' },
];

export const DEFAULTS = {
  characterId: 'pikachu',
  countryId: 'polandia',
  role: 'bertahan',
  opposingId: 'thailand',
  phaseId: 'perebutan',
  durationSeconds: 180,
};

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}

export function getCountry(id) {
  return COUNTRIES.find((c) => c.id === id) ?? null;
}

export function getPhase(id) {
  return PHASES.find((p) => p.id === id) ?? null;
}
