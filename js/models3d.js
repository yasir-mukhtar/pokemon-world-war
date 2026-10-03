// Model karakter low-poly prosedural — volume 3D asli, bukan sprite/billboard.
// Konvensi: kaki di y=0, menghadap +Z (rotation.y = atan2(dir.x, dir.z)).
import * as THREE from '../vendor/three/three.module.js';

const M = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.05, ...opts });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function namedMesh(geo, mat, name, x = 0, y = 0, z = 0) {
  const m = mesh(geo, mat, x, y, z);
  m.name = name;
  return m;
}

// Silinder antara dua titik (untuk tulang sayap / duri panjang).
function cylBetween(a, b, r, mat) {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length() || 1e-6;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, len, 6), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

// Simpan transform dasar suatu bagian rig — animasi selalu reset ke dasar
// (tidak akumulatif) lalu menerapkan delta pose.
function rigPart(node) {
  return { node, p: node.position.clone(), r: node.rotation.clone(), s: node.scale.clone() };
}

// Telapak kaki + cakar sebagai anak mesh kaki — ikut ayunan pinggul,
// telapak tetap sejajar lantai kaki (bawah di y = hipY - legHeight).
function addFeet(leg, legHeight, footColor, clawColor) {
  const side = leg.position.x < 0 ? 'left' : 'right';
  const foot = namedMesh(new THREE.BoxGeometry(0.17, 0.07, 0.22), M(footColor), `${side}-foot`, 0, -legHeight + 0.035, 0.07);
  leg.add(foot);
  for (let i = 0; i < 3; i += 1) {
    const claw = namedMesh(
      new THREE.ConeGeometry(0.024, 0.09, 5),
      M(clawColor),
      `toe-claw-${side[0]}-${i}`,
      (i - 1) * 0.055,
      -legHeight + 0.045,
      0.2,
    );
    claw.rotation.x = Math.PI / 2;
    leg.add(claw);
  }
}

function legsPair(color, hipY = 0.28, spread = 0.16) {
  // Kaki mendarat di y>=0: panjang dibatasi tinggi pinggul, pivot di pinggul.
  const height = Math.min(0.3, hipY);
  const legGeo = new THREE.BoxGeometry(0.14, height, 0.14);
  legGeo.translate(0, -height / 2, 0); // translasi SEKALI pada geo bersama
  const left = mesh(legGeo, M(color), -spread, hipY, 0);
  const right = mesh(legGeo, M(color), spread, hipY, 0);
  return [left, right];
}

function pikachu() {
  const g = new THREE.Group();
  const yellow = M('#f2c230');
  const body = mesh(new THREE.SphereGeometry(0.42, 10, 8), yellow, 0, 0.62, 0);
  body.scale.set(1, 1.15, 0.9);
  const head = mesh(new THREE.SphereGeometry(0.36, 10, 8), yellow, 0, 1.28, 0.05);
  // Telinga dengan ujung hitam.
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.1, 0.42, 6), yellow, s * 0.24, 1.62, 0);
    ear.rotation.z = -s * 0.28;
    const tip = mesh(new THREE.ConeGeometry(0.07, 0.16, 6), M('#1f1a10'), s * 0.3, 1.82, 0);
    tip.rotation.z = -s * 0.28;
    g.add(ear, tip);
  }
  // Mata + pipi merah.
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), M('#1f1a10'), s * 0.14, 1.34, 0.34));
    g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), M('#c0392b'), s * 0.3, 1.18, 0.24));
  }
  // Ekor petir zigzag.
  const tail = mesh(new THREE.BoxGeometry(0.12, 0.5, 0.08), yellow, 0.18, 0.85, -0.42);
  tail.rotation.z = 0.5;
  const tail2 = mesh(new THREE.BoxGeometry(0.12, 0.34, 0.08), yellow, 0.34, 1.12, -0.44);
  tail2.rotation.z = -0.6;
  const legs = legsPair('#e0af1f');
  g.add(body, head, tail, tail2, ...legs);
  return { group: g, legs };
}

function lucario() {
  const g = new THREE.Group();
  const blue = M('#3a7bd5');
  const body = mesh(new THREE.CylinderGeometry(0.26, 0.36, 0.7, 8), blue, 0, 0.75, 0);
  const chest = mesh(new THREE.SphereGeometry(0.22, 8, 6), M('#f4e9d0'), 0, 0.85, 0.18);
  chest.scale.set(1, 1.2, 0.6);
  const head = mesh(new THREE.SphereGeometry(0.28, 8, 7), blue, 0, 1.32, 0);
  const muzzle = mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), M('#f4e9d0'), 0, 1.24, 0.26);
  // Telinga panjang + mata merah + tanduk dada.
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.08, 0.5, 6), M('#1f1a10'), s * 0.2, 1.66, -0.04);
    ear.rotation.z = -s * 0.2;
    g.add(ear);
    g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), M('#c0392b'), s * 0.12, 1.36, 0.24));
  }
  const spike = mesh(new THREE.ConeGeometry(0.07, 0.2, 6), M('#f4e9d0'), 0, 0.95, 0.32);
  spike.rotation.x = Math.PI / 2;
  const legs = legsPair('#2b5ea0');
  g.add(body, chest, head, muzzle, spike, ...legs);
  return { group: g, legs };
}

// Outline sayap Charizard (ruang lokal sayap, +x menjauhi tubuh).
const WING_OUTLINE = [
  [0, 0], [0.42, 0.6], [0.94, 0.44], [1.16, -0.03],
  [0.62, 0.08], [0.35, -0.23], [0.02, -0.12],
];

function charizard() {
  const g = new THREE.Group();
  const orange = M('#e2703a');
  const cream = M('#f4e0b8');
  const white = M('#f7f1e2');
  const tealWing = M('#3f7f8c', { side: THREE.DoubleSide });
  const bone = M('#c95f2a');

  // Tubuh bulat stokis + perut krem sedikit menonjol.
  const body = namedMesh(new THREE.SphereGeometry(0.42, 16, 12), orange, 'body', 0, 0.66, 0);
  body.scale.set(1.05, 1.32, 0.95);
  const belly = namedMesh(new THREE.SphereGeometry(0.3, 12, 9), cream, 'belly', 0, 0.6, 0.24);
  belly.scale.set(0.9, 1.2, 0.5);

  // Leher + kepala condong ke depan (+Z), moncong memanjang.
  const neck = namedMesh(new THREE.CylinderGeometry(0.13, 0.19, 0.42, 8), orange, 'neck', 0, 1.1, 0.14);
  neck.rotation.x = -0.5;
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0, 1.36, 0.26);
  head.add(mesh(new THREE.SphereGeometry(0.26, 12, 9), orange, 0, 0.02, 0));
  head.add(namedMesh(new THREE.BoxGeometry(0.22, 0.15, 0.35), orange, 'snout', 0, -0.05, 0.3));
  for (const s of [-1, 1]) {
    // Mata teal + pupil — volume kecil, bukan tekstur.
    head.add(namedMesh(new THREE.SphereGeometry(0.05, 8, 6), M('#2f6f7a'), `eye-${s < 0 ? 'l' : 'r'}`, s * 0.11, 0.09, 0.22));
    head.add(mesh(new THREE.SphereGeometry(0.022, 6, 5), M('#1f1a10'), s * 0.11, 0.09, 0.27));
    // Tanduk melengkung ke belakang.
    const horn = namedMesh(new THREE.ConeGeometry(0.06, 0.3, 6), orange, `horn-${s < 0 ? 'l' : 'r'}`, s * 0.12, 0.24, -0.08);
    horn.rotation.x = -0.85;
    horn.rotation.z = -s * 0.15;
    head.add(horn);
  }

  // Sayap kelelawar: webbing teal bervolume (ExtrudeGeometry) + tulang oranye.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(WING_OUTLINE[0][0], WING_OUTLINE[0][1]);
  for (let i = 1; i < WING_OUTLINE.length; i += 1) {
    wingShape.lineTo(WING_OUTLINE[i][0], WING_OUTLINE[i][1]);
  }
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });
  const makeWing = (side) => {
    const wg = new THREE.Group();
    wg.name = side > 0 ? 'right-wing' : 'left-wing';
    const web = namedMesh(wingGeo, tealWing, 'wing-web');
    wg.add(web);
    // Tulang: lengan ke ujung atas, jari ke ujung bawah, penyangga.
    const z = 0.025;
    wg.add(cylBetween([0, 0, z], [0.94, 0.44, z], 0.035, bone));
    wg.add(cylBetween([0, 0, z], [1.16, -0.03, z], 0.03, bone));
    wg.add(cylBetween([0.94, 0.44, z], [1.16, -0.03, z], 0.028, bone));
    wg.position.set(side * 0.32, 1.18, -0.22);
    wg.rotation.y = side > 0 ? -0.18 : Math.PI + 0.18;
    wg.rotation.z = side * 0.12;
    return wg;
  };
  const wingL = makeWing(-1);
  const wingR = makeWing(1);

  // Lengan + cakar putih.
  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.name = side > 0 ? 'right-arm' : 'left-arm';
    const upper = mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.3, 6), orange, 0, -0.12, 0);
    upper.rotation.z = side * 0.55;
    arm.add(upper);
    for (let i = 0; i < 3; i += 1) {
      const claw = mesh(new THREE.ConeGeometry(0.02, 0.08, 5), white, side * 0.16, -0.3, 0.04 - i * 0.045);
      claw.rotation.x = -0.6;
      arm.add(claw);
    }
    arm.position.set(side * 0.4, 1.0, 0.18);
    return arm;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // Ekor melengkung + api ujung (kerucut luar oranye + inti kuning emisif).
  const tailGroup = new THREE.Group();
  tailGroup.name = 'tail';
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.42, -0.25),
    new THREE.Vector3(0, 0.45, -0.7),
    new THREE.Vector3(0.18, 0.76, -1.13),
    new THREE.Vector3(0.32, 1.27, -1.4),
  ]);
  tailGroup.add(namedMesh(new THREE.TubeGeometry(tailCurve, 12, 0.1, 6, false), orange, 'tail-tube'));
  const flame = new THREE.Group();
  flame.name = 'tail-flame';
  flame.position.set(0.32, 1.27, -1.4);
  flame.add(mesh(new THREE.ConeGeometry(0.15, 0.36, 7), M('#e2703a', { emissive: '#c0392b', emissiveIntensity: 0.7 }), 0, 0.06, 0));
  flame.add(mesh(new THREE.ConeGeometry(0.08, 0.24, 7), M('#f2c230', { emissive: '#f2c230', emissiveIntensity: 0.9 }), 0, 0.03, 0));
  tailGroup.add(flame);

  // Kaki belakang + telapak/cakar putih.
  const hipY = 0.3;
  const legs = legsPair('#c55c28', hipY, 0.2);
  for (const leg of legs) addFeet(leg, Math.min(0.3, hipY), '#c55c28', '#f7f1e2');

  g.add(body, belly, neck, head, wingL, wingR, armL, armR, tailGroup, ...legs);
  g.userData.referenceRig = {
    body: rigPart(body),
    head: rigPart(head),
    wingL: rigPart(wingL),
    wingR: rigPart(wingR),
    armL: rigPart(armL),
    armR: rigPart(armR),
    tail: rigPart(tailGroup),
  };
  return { group: g, legs };
}

function gengar() {
  const g = new THREE.Group();
  const purple = M('#7b5ea7');
  const darkPurple = M('#5f4387');
  const red = M('#c0392b');
  const white = M('#f7f1e2');

  // Torso: tubuh + seluruh wajah/duri ikut pitch saat pose condong.
  const torso = new THREE.Group();
  torso.name = 'torso';

  // Tubuh bulat gempal — sphere lembut, bukan faset bintang.
  const body = namedMesh(new THREE.SphereGeometry(0.57, 16, 12), purple, 'body', 0, 0.71, 0);
  body.scale.set(1.05, 1.06, 0.86);
  torso.add(body);

  // Duri punggung rapat di belahan belakang tubuh (arah permukaan bola).
  const spikeDirs = [
    [0, 0.95, -0.55], [0.45, 0.8, -0.55], [-0.45, 0.8, -0.55],
    [0.8, 0.4, -0.55], [-0.8, 0.4, -0.55],
    [0, 0.25, -0.95], [0.5, -0.15, -0.8], [-0.5, -0.15, -0.8],
    [0.3, 0.6, -0.75], [-0.3, 0.6, -0.75],
  ];
  spikeDirs.forEach((d, i) => {
    const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
    const spike = namedMesh(new THREE.ConeGeometry(0.09, 0.26, 5), darkPurple, `back-spike-${i}`);
    spike.position.set(dir.x * 0.52, 0.71 + dir.y * 0.52, dir.z * 0.44);
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    torso.add(spike);
  });
  // Tanduk telinga runcing di atas.
  for (const s of [-1, 1]) {
    const ear = namedMesh(new THREE.ConeGeometry(0.09, 0.3, 5), darkPurple, `ear-horn-${s < 0 ? 'l' : 'r'}`, s * 0.3, 1.32, -0.05);
    ear.rotation.z = -s * 0.5;
    ear.rotation.x = -0.15;
    torso.add(ear);
  }

  // Mata merah menyipit + pupil hitam, alis melandai ke dalam.
  for (const s of [-1, 1]) {
    const eye = namedMesh(new THREE.SphereGeometry(0.11, 8, 6), red, s < 0 ? 'left-eye' : 'right-eye', s * 0.19, 0.95, 0.42);
    eye.scale.set(1, 0.38, 0.55);
    eye.rotation.z = s * 0.42;
    torso.add(eye);
    torso.add(namedMesh(new THREE.BoxGeometry(0.025, 0.09, 0.02), M('#1f1a10'), s < 0 ? 'left-pupil' : 'right-pupil', s * 0.19, 0.95, 0.5));
    const brow = namedMesh(new THREE.BoxGeometry(0.2, 0.05, 0.05), purple, `brow-${s < 0 ? 'l' : 'r'}`, s * 0.19, 1.05, 0.44);
    brow.rotation.z = s * -0.42;
    torso.add(brow);
  }

  // Seringai lebar bergigi: pita putih lengkung (ExtrudeGeometry) + gigi-gigi kecil.
  const grinShape = new THREE.Shape();
  grinShape.moveTo(-0.4, 0.06);
  grinShape.quadraticCurveTo(0, -0.02, 0.4, 0.06);
  grinShape.quadraticCurveTo(0.28, -0.18, 0, -0.19);
  grinShape.quadraticCurveTo(-0.28, -0.18, -0.4, 0.06);
  grinShape.closePath();
  const grin = namedMesh(
    new THREE.ExtrudeGeometry(grinShape, { depth: 0.02, bevelEnabled: false }),
    white,
    'grin',
    0,
    0.62,
    0.46,
  );
  grin.rotation.x = -0.08;
  torso.add(grin);
  // Separator gigi — batang ungu tipis membelah pita putih.
  for (let i = 0; i < 5; i += 1) {
    const tx = -0.28 + i * 0.14;
    const ty = 0.6 - Math.abs(tx) * 0.18;
    torso.add(namedMesh(new THREE.BoxGeometry(0.018, 0.12, 0.015), darkPurple, `tooth-${i}`, tx, ty, 0.475));
  }

  // Lengan pendek tebal + 3 cakar kecil; telapak kaki lebar.
  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.name = side > 0 ? 'right-arm' : 'left-arm';
    const upper = mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 6), purple, 0, -0.1, 0);
    upper.rotation.z = side * 0.6;
    arm.add(upper);
    for (let i = 0; i < 3; i += 1) {
      const claw = mesh(new THREE.ConeGeometry(0.018, 0.07, 5), darkPurple, side * 0.13, -0.26, 0.05 - i * 0.04);
      claw.rotation.x = -0.7;
      arm.add(claw);
    }
    arm.position.set(side * 0.55, 0.65, 0.1);
    return arm;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  const hipY = 0.22;
  const legs = legsPair('#684e8f', hipY, 0.2);
  for (const leg of legs) addFeet(leg, Math.min(0.3, hipY), '#684e8f', '#5f4387');

  g.add(torso, armL, armR, ...legs);
  g.userData.referenceRig = {
    torso: rigPart(torso),
    armL: rigPart(armL),
    armR: rigPart(armR),
    grin: rigPart(grin),
  };
  return { group: g, legs };
}

export function createCharacterModel(id) {
  const rid = ['lucario', 'charizard', 'gengar'].includes(id) ? id : 'pikachu';
  const model =
    rid === 'lucario' ? lucario()
    : rid === 'charizard' ? charizard()
    : rid === 'gengar' ? gengar()
    : pikachu();
  model.group.userData.modelId = rid;
  model.group.name = `char-${rid}`;
  return model;
}

// Musuh: drone/ makhluk low-poly merah.
export function createEnemyModel() {
  const g = new THREE.Group();
  const red = M('#c0392b');
  const body = mesh(new THREE.OctahedronGeometry(0.4, 0), red, 0, 0.75, 0);
  body.scale.set(1, 1.2, 0.85);
  const visor = mesh(new THREE.BoxGeometry(0.34, 0.09, 0.08), M('#f7f1e2', { emissive: '#f2c230', emissiveIntensity: 0.4 }), 0, 0.8, 0.32);
  const base = mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.24, 8), M('#5d1f16'), 0, 0.22, 0);
  const antenna = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), M('#1f1a10'), 0.14, 1.2, 0);
  const tip = mesh(new THREE.SphereGeometry(0.05, 6, 5), M('#f2c230', { emissive: '#f2c230', emissiveIntensity: 0.6 }), 0.14, 1.36, 0);
  const legs = legsPair('#7c271c', 0.3, 0.14);
  g.add(body, visor, base, antenna, tip, ...legs);
  g.userData.modelId = 'enemy-drone';
  g.name = 'enemy-drone';
  return { group: g, legs };
}

// Animasi pose untuk model referensi (Charizard/Gengar). Semua bagian direset
// ke transform dasar lalu delta pose diterapkan — tidak akumulatif antar-frame.
// pose = { time, moving, attack, skill, hurt, fainted }.
export function animateCharacterModel(group, pose = {}) {
  const rig = group.userData.referenceRig;
  if (!rig) return; // model tanpa rig: diputar renderer seperti biasa.
  const t = pose.time ?? 0;
  for (const key of Object.keys(rig)) {
    const part = rig[key];
    part.node.position.copy(part.p);
    part.node.rotation.copy(part.r);
    part.node.scale.copy(part.s);
  }
  const lean = Math.min(1, (pose.attack ?? 0) + (pose.skill ?? 0));
  const sway = pose.moving ? Math.sin(t * 9) : 0;
  const breathe = Math.sin(t * 2.4) * 0.015;
  const recoil = pose.hurt ?? 0;
  if (rig.torso) {
    rig.torso.node.scale.y *= 1 + breathe;
    rig.torso.node.rotation.x += -lean * 0.2 - recoil * 0.15;
  }
  if (rig.body) {
    rig.body.node.scale.y *= 1 + breathe;
    rig.body.node.rotation.x += -lean * 0.1;
  }
  if (rig.head) {
    rig.head.node.rotation.x += -lean * 0.35 + recoil * 0.35;
    rig.head.node.position.z += lean * 0.08;
  }
  if (rig.wingL) rig.wingL.node.rotation.z += -(0.1 + sway * 0.2 + lean * 0.35);
  if (rig.wingR) rig.wingR.node.rotation.z += 0.1 + sway * 0.2 + lean * 0.35;
  if (rig.armL) rig.armL.node.rotation.x += -lean * 1.1 + sway * 0.45;
  if (rig.armR) rig.armR.node.rotation.x += -lean * 1.1 - sway * 0.45;
  if (rig.tail) rig.tail.node.rotation.y += Math.sin(t * 1.8) * 0.06;
  // Recoil / pingsan di level grup (rotation.y tetap milik renderer).
  group.rotation.x = pose.fainted ? -0.7 : -recoil * 0.12;
}
