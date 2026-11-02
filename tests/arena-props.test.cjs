/* 배경 소품 상호작용(폐광 수정·성채 화로): 클릭 판정·부서짐·재생·옥좌 점등·정지·모션 감소·입자 상한을 검증합니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DATA = require('../src/scripts/arena-props-data.js');
const { ARENA_PROP_RULES, createArenaProps } = require('../src/scripts/arena-props.js');

// 조각 데이터와 이미지가 실제로 있어야 합니다(빌드 스크립트 산출물).
for (const name of ['mine-crystals', 'mine-crystals-broken', 'citadel-flames']) {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'art', 'props', `${name}.png`)), `${name}.png 없음`);
}
assert.deepEqual(DATA.artSize, [1536, 1024]);
assert.ok(DATA.mineCrystals.bodies.length >= 3);
assert.equal(DATA.citadelFlames.filter((f) => f.clickable).length, 4);

const gradient = { addColorStop() {} };
const ctx = new Proxy({ globalAlpha: 1, createRadialGradient: () => gradient }, { get: (o, k) => (k in o ? o[k] : () => {}) });
class FakeImage { constructor() { this.complete = true; this.naturalWidth = 10; } }
function make(seed = 1) {
  let s = seed;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sounds = [];
  const canvas = { width: 768, height: 512, clientWidth: 768, clientHeight: 512, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 768, height: 512 }) };
  const props = createArenaProps(canvas, DATA, { ImageType: FakeImage, random, onSound: (t, p) => sounds.push([t, p]) });
  return { props, sounds };
}
const settle = (props) => { for (let i = 0; i < 12; i++) props.update(.1, false, false); };
const center = (b) => ({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });
const crystalPoint = center(DATA.mineCrystals.bodies[0]);
const flamePoints = DATA.citadelFlames.filter((f) => f.clickable).map((f) => center(f.box));

// 폐광: 네 번은 금만 가고, 다섯 번째에 부서집니다. 두드릴수록 음이 올라갑니다.
{
  const { props, sounds } = make();
  props.setStage(6, 'mine');
  assert.equal(props.hitArt(crystalPoint), null, '배경 전환이 끝나기 전에는 반응하지 않음');
  settle(props);
  for (let i = 1; i < ARENA_PROP_RULES.crystalHits; i++) assert.equal(props.hitArt(crystalPoint), 'crystal-hit');
  assert.equal(props.snapshot().crystal.cracks, (ARENA_PROP_RULES.crystalHits - 1) * 2, '두드릴 때마다 금 한 줄 + 잔금 한 줄');
  const taps = sounds.filter(([t]) => t === 'prop_crystal_tap').map(([, p]) => p);
  assert.ok(taps.every((p, i) => i === 0 || p > taps[i - 1]));
  assert.equal(props.hitArt(crystalPoint), 'crystal-break');
  assert.equal(props.snapshot().crystal.broken, true);
  assert.ok(props.snapshot().crystal.shards > 0);
  assert.equal(props.hitArt(crystalPoint), null, '부서진 뒤에는 더 반응하지 않음');
  assert.equal(props.hitArt({ x: 700, y: 600 }), null, '수정 밖 클릭은 무시');
  for (let i = 0; i < 30; i++) props.update(.1, false, false);
  assert.ok(props.snapshot().particles <= ARENA_PROP_RULES.maxParticles);
  // 같은 지역 다음 스테이지에서 다시 자랍니다.
  props.setStage(7, 'mine');
  assert.equal(props.snapshot().crystal.broken, false);
  assert.ok(props.snapshot().crystal.regrow > 0);
  assert.equal(props.hitArt(crystalPoint), null, '자라는 동안은 반응하지 않음');
  settle(props);
  assert.equal(props.hitArt(crystalPoint), 'crystal-hit');
  // 화면 좌표 입력: 일시정지 중에는 무시합니다.
  const sx = 768 / 1536, sy = 512 / 1024;
  const before = props.snapshot().crystal.hits;
  assert.equal(props.hit(crystalPoint.x * sx, crystalPoint.y * sy, true), null);
  assert.equal(props.hit(crystalPoint.x * sx, crystalPoint.y * sy, false), 'crystal-hit');
  assert.equal(props.snapshot().crystal.hits, before + 1);
  // 일시정지 중에는 시간이 흐르지 않습니다.
  const frozen = JSON.stringify(props.snapshot());
  props.update(.5, true, false);
  assert.equal(JSON.stringify(props.snapshot()), frozen);
}

// 성채: 큰 화로 4개를 모두 키우면 옥좌가 한 번 빛나고, 식은 뒤 다시 키워야 또 빛납니다.
{
  const { props, sounds } = make(3);
  props.setStage(16, 'citadel');
  settle(props);
  assert.equal(props.hitArt(center(DATA.mineCrystals.bodies[3])), null, '성채에서는 수정 판정 없음');
  flamePoints.slice(0, 3).forEach((p) => assert.equal(props.hitArt(p), 'brazier-flare'));
  assert.equal(props.hitArt(flamePoints[3]), 'citadel-sigil');
  assert.ok(props.snapshot().sigil > 0);
  assert.equal(sounds.filter(([t]) => t === 'prop_sigil').length, 1);
  assert.equal(props.hitArt(flamePoints[0]), 'brazier-flare', '이미 모두 타는 중이면 다시 빛나지 않음');
  for (let i = 0; i < 80; i++) props.update(.1, false, false);
  assert.ok(props.snapshot().flames.every((f) => f.warm === 0));
  flamePoints.forEach((p) => props.hitArt(p));
  assert.equal(sounds.filter(([t]) => t === 'prop_sigil').length, 2);
  // 다음 스테이지에서는 화로가 원래대로 돌아갑니다.
  props.setStage(17, 'citadel');
  assert.ok(props.snapshot().flames.every((f) => f.warm === 0 && f.flare === 0));
}

// 모션 줄이기: 상태는 바뀌지만 흔들림·파편·입자는 없습니다.
{
  const { props } = make(5);
  props.setStage(6, 'mine');
  props.update(.1, false, true);
  for (let i = 0; i < ARENA_PROP_RULES.crystalHits; i++) props.hitArt(crystalPoint, true);
  props.update(.016, false, true);
  const snap = props.snapshot();
  assert.equal(snap.crystal.broken, true);
  assert.equal(snap.crystal.shards, 0);
  assert.equal(snap.particles, 0);
}

// 다른 지역에서는 아무 반응도 없습니다.
{
  const { props } = make();
  props.setStage(1, 'meadow');
  settle(props);
  assert.equal(props.hitArt(crystalPoint), null);
  assert.equal(props.hitArt(flamePoints[0]), null);
}

console.log('배경 소품: 수정 금·부서짐·재생, 화로 점화·옥좌 점등, 정지·모션 감소·입자 상한 검증 통과');
