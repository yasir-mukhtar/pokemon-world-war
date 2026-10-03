// Definisi level bersama — satu arena statis untuk prototipe 3D.
// Koordinat memakai ruang logis 2D yang sama dengan mesin (1000x650);
// renderer memetakan x -> worldX dan y -> worldZ dengan skala LEVEL.scale.
export const LEVEL = {
  id: 'plaza',
  name: 'Alun-alun',
  width: 1000,
  height: 650,
  scale: 0.025, // unit logis -> meter dunia
  // Enam footprint solid — satu-satunya penghalang di dalam arena.
  // height dalam unit logis (diskalakan sama ke dunia 3D).
  obstacles: [
    { id: 'nw-building', x: 170, y: 80, w: 150, h: 130, height: 110, color: '#8a7a5c', kind: 'building' },
    { id: 'ne-building', x: 680, y: 80, w: 150, h: 130, height: 100, color: '#94826a', kind: 'building' },
    { id: 'sw-building', x: 140, y: 430, w: 150, h: 120, height: 100, color: '#8a7a5c', kind: 'building' },
    { id: 'se-building', x: 700, y: 430, w: 150, h: 120, height: 110, color: '#94826a', kind: 'building' },
    { id: 'west-crate', x: 320, y: 280, w: 44, h: 64, height: 32, color: '#a98f5f', kind: 'crate' },
    { id: 'east-crate', x: 636, y: 250, w: 44, h: 64, height: 32, color: '#a98f5f', kind: 'crate' },
  ],
};
