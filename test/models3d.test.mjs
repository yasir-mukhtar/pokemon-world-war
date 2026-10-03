// Uji model 3D prosedural — murni three.js, tanpa DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterModel, createEnemyModel, animateCharacterModel } from '../js/models3d.js';

const CHAR_IDS = ['pikachu', 'lucario', 'charizard', 'gengar'];
const EPS = 1e-6;

function meshStats(root) {
  let meshes = 0;
  let verts = 0;
  root.traverse((n) => {
    if (n.isMesh) {
      meshes += 1;
      verts += n.geometry?.attributes?.position?.count ?? 0;
    }
  });
  return { meshes, verts };
}

test('setiap karakter menghasilkan group mesh dengan identitas model', () => {
  for (const id of CHAR_IDS) {
    const { group, legs } = createCharacterModel(id);
    assert.equal(group.userData.modelId, id);
    assert.equal(group.name, `char-${id}`);
    const { meshes, verts } = meshStats(group);
    assert.ok(meshes >= 8, `${id}: hanya ${meshes} mesh`);
    assert.ok(verts > 100, `${id}: geometri terlalu tipis`);
    assert.equal(legs.length, 2, `${id}: sepasang kaki`);
  }
});

test('kaki semua model mendarat di tanah (y >= 0) dan simetris', () => {
  for (const id of CHAR_IDS) {
    const { legs } = createCharacterModel(id);
    const bounds = legs.map((leg) => {
      leg.geometry.computeBoundingBox();
      return leg.geometry.boundingBox;
    });
    for (const [i, leg] of legs.entries()) {
      const footY = leg.position.y + bounds[i].min.y;
      assert.ok(footY >= -EPS, `${id} kaki ${i}: telapak di ${footY.toFixed(3)} < 0`);
    }
    assert.deepEqual(
      [bounds[0].min.y, bounds[0].max.y],
      [bounds[1].min.y, bounds[1].max.y],
      `${id}: kaki kiri/kanan beda tinggi`,
    );
  }
});

test('model karakter berbeda secara geometri — bukan salinan', () => {
  const signatures = CHAR_IDS.map((id) => meshStats(createCharacterModel(id).group));
  const unique = new Set(signatures.map((s) => `${s.meshes}:${s.verts}`));
  assert.ok(unique.size >= 3, `signature terlalu mirip: ${[...unique]}`);
});

test('model musuh: identitas + mesh valid + kaki di tanah', () => {
  const { group, legs } = createEnemyModel();
  assert.equal(group.userData.modelId, 'enemy-drone');
  const { meshes } = meshStats(group);
  assert.ok(meshes >= 5);
  for (const leg of legs) {
    leg.geometry.computeBoundingBox();
    assert.ok(leg.position.y + leg.geometry.boundingBox.min.y >= -EPS);
  }
});

test('model karakter tidak menyamai drone musuh', () => {
  const enemy = meshStats(createEnemyModel().group);
  for (const id of CHAR_IDS) {
    const hero = meshStats(createCharacterModel(id).group);
    assert.notEqual(
      `${hero.meshes}:${hero.verts}`,
      `${enemy.meshes}:${enemy.verts}`,
      `${id} identik dengan drone`,
    );
  }
});

test('Pikachu/Lucario tidak berubah (signature model lama dipertahankan)', () => {
  assert.deepEqual(meshStats(createCharacterModel('pikachu').group), { meshes: 14, verts: 654 });
  assert.deepEqual(meshStats(createCharacterModel('lucario').group), { meshes: 11, verts: 466 });
});

// ---------- Model referensi Charizard ----------
test('charizard: sayap volume extruded, perut krem, ekor tabung, api emisif, cakar', () => {
  const { group } = createCharacterModel('charizard');
  const find = (n) => group.getObjectByName(n);
  for (const wingName of ['left-wing', 'right-wing']) {
    const wing = find(wingName);
    assert.ok(wing, `${wingName} tidak ada`);
    let extruded = 0;
    wing.traverse((n) => {
      if (n.geometry?.type === 'ExtrudeGeometry') {
        const depth = n.geometry.parameters?.options?.depth;
        if (depth > 0) extruded += 1;
      }
    });
    assert.ok(extruded >= 1, `${wingName} webbing bukan ExtrudeGeometry bervolume`);
    assert.ok(wing.children.length >= 3, `${wingName} kurang tulang`);
  }
  const belly = find('belly');
  assert.ok(belly?.geometry?.type === 'SphereGeometry', 'perut krem');
  const tail = find('tail');
  assert.ok(tail, 'grup ekor');
  let tube = 0;
  tail.traverse((n) => { if (n.geometry?.type === 'TubeGeometry') tube += 1; });
  assert.ok(tube >= 1, 'ekor bukan TubeGeometry');
  const flame = find('tail-flame');
  let emissive = 0;
  flame.traverse((n) => { if ((n.material?.emissiveIntensity ?? 0) > 0.3) emissive += 1; });
  assert.ok(emissive >= 1, 'api ekor tidak emisif');
  const claws = [];
  group.traverse((n) => { if (n.name.startsWith('toe-claw')) claws.push(n); });
  assert.ok(claws.length >= 6, `cakar kaki: ${claws.length}`);
  for (const n of ['left-arm', 'right-arm', 'head', 'snout', 'neck']) assert.ok(find(n), n);
});

// ---------- Model referensi Gengar ----------
test('gengar: tubuh sphere, >=8 duri beranama, mata merah, seringai + gigi', () => {
  const { group } = createCharacterModel('gengar');
  const find = (n) => group.getObjectByName(n);
  assert.equal(find('body')?.geometry?.type, 'SphereGeometry', 'tubuh harus sphere bulat');
  const spikes = [];
  group.traverse((n) => { if (n.name.startsWith('back-spike-')) spikes.push(n); });
  assert.ok(spikes.length >= 8, `duri: ${spikes.length}`);
  for (const s of spikes) assert.equal(s.geometry.type, 'ConeGeometry');
  for (const n of ['left-eye', 'right-eye', 'grin', 'left-arm', 'right-arm', 'torso']) {
    assert.ok(find(n), n);
  }
  assert.equal(find('grin').geometry.type, 'ExtrudeGeometry', 'seringai bervolume');
  const teeth = [];
  group.traverse((n) => { if (n.name.startsWith('tooth-')) teeth.push(n); });
  assert.ok(teeth.length >= 3, `gigi: ${teeth.length}`);
});

// ---------- Animasi pose ----------
test('animateCharacterModel: pose valid -> transform finite, reset tidak akumulatif', () => {
  for (const id of ['charizard', 'gengar']) {
    const { group } = createCharacterModel(id);
    const poses = [
      { time: 0, moving: false, attack: 0, skill: 0, hurt: 0, fainted: false },
      { time: 1.7, moving: true, attack: 0.5, skill: 0, hurt: 0, fainted: false },
      { time: 2.3, moving: false, attack: 0, skill: 0.6, hurt: 0.5, fainted: false },
      { time: 3.1, moving: false, attack: 0, skill: 0, hurt: 0, fainted: true },
      { time: 0, moving: false, attack: 0, skill: 0, hurt: 0, fainted: false },
    ];
    for (const pose of poses) animateCharacterModel(group, pose);
    group.updateMatrixWorld(true);
    group.traverse((n) => {
      assert.ok(
        Number.isFinite(n.position.x) && Number.isFinite(n.rotation.x) && Number.isFinite(n.scale.y),
        `${id}/${n.name} transform tidak finite`,
      );
    });
    // Pose idle diulang -> transform identik (tidak menumpuk).
    const snap = () => {
      const out = [];
      group.traverse((n) => out.push(...n.position.toArray(), n.rotation.x, n.rotation.y, n.rotation.z, ...n.scale.toArray()));
      return out;
    };
    animateCharacterModel(group, poses[0]);
    const a = snap();
    animateCharacterModel(group, poses[0]);
    const b = snap();
    assert.deepEqual(a, b, `${id}: pose idle akumulatif`);
  }
});

test('animateCharacterModel: model tanpa rig (Pikachu) aman di-skip', () => {
  const { group } = createCharacterModel('pikachu');
  assert.doesNotThrow(() => animateCharacterModel(group, { time: 1, moving: true }));
});
