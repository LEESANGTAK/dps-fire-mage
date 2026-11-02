/* 배경 소품 확장(랜턴·광차·깃발·용암·부유물·공허 수정·반딧불·아치 속 눈)과 행운 불씨를 검증합니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DATA = require('../src/scripts/arena-props-data.js');
const { ARENA_EXTRA_RULES: R, VOID_CHIME_SCALE } = require('../src/scripts/arena-props-extra.js');
const { createArenaProps, ARENA_PROP_RULES } = require('../src/scripts/arena-props.js');

for (const name of ['mine-extra', 'ruins', 'ruins-lava-mask', 'void', 'void-crystals']) {
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'art', 'props', `${name}.png`)), `${name}.png 없음`);
}
// 움직이는 조각에는 움직일 때 드러나는 자리를 가릴 밑판이 있어야 합니다.
for (const f of [...DATA.mine, DATA.ruins.banner, ...DATA.void.floating]) {
  assert.ok(f.underSrc && f.underBox, `${f.id} 밑판 없음`);
  const [ux, uy, uw, uh] = f.underBox, [x, y, w, h] = f.box;
  assert.ok(ux <= x && uy <= y && ux + uw >= x + w && uy + uh >= y + h, `${f.id} 밑판이 조각을 덮지 못함`);
}

const gradient = { addColorStop() {} };
const ctx = new Proxy({ globalAlpha: 1, createRadialGradient: () => gradient, createLinearGradient: () => gradient }, { get: (o, k) => (k in o ? o[k] : () => {}) });
class FakeImage { constructor() { this.complete = true; this.naturalWidth = 10; } }
function make(seed = 11) {
  let s = seed;
  const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sounds = [], events = [], lucky = [];
  const canvas = { width: 768, height: 512, clientWidth: 768, clientHeight: 512, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0, width: 768, height: 512 }) };
  const props = createArenaProps(canvas, DATA, { ImageType: FakeImage, random, onSound: (t, p) => sounds.push([t, p]), onEvent: (e) => events.push(e), onLucky: (e) => lucky.push(e) });
  return { props, sounds, events, lucky };
}
const settle = (props, n = 12, reduced = false) => { for (let i = 0; i < n; i++) props.update(.1, false, reduced); };
const center = (b) => ({ x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });
const byId = (list, id) => list.find((f) => f.id === id);

// 폐광 랜턴: 연달아 치면 꺼졌다가 1.3초 뒤 다시 붙습니다(큰 반응 이벤트).
{
  const { props, events } = make();
  props.setStage(6, 'mine'); settle(props);
  const p = center(byId(DATA.mine, 'lantern').box);
  for (let i = 1; i < R.lanternHits; i++) assert.equal(props.hitArt(p), 'lantern-swing');
  assert.equal(props.hitArt(p), 'lantern-out');
  assert.equal(props.snapshot().extras.lantern.out, true);
  assert.equal(props.hitArt(p), null, '꺼진 동안은 반응 없음');
  settle(props, 15);
  assert.equal(props.snapshot().extras.lantern.out, false);
  assert.ok(events.includes('lantern-relight'));
  // 한동안 안 누르면 횟수가 처음부터입니다.
  props.hitArt(p); settle(props, Math.ceil(R.comboDecaySec * 10) + 2);
  assert.equal(props.snapshot().extras.lantern.hits, 0);
}

// 폐광 광차: 8번째에 광석이 쏟아지고(원화 조각 파편), 잠깐 반응하지 않습니다.
{
  const { props } = make();
  props.setStage(6, 'mine'); settle(props);
  const p = center(byId(DATA.mine, 'cart').box);
  for (let i = 1; i < R.cartHits; i++) assert.equal(props.hitArt(p), 'cart-jolt');
  assert.equal(props.hitArt(p), 'cart-spill');
  assert.ok(props.snapshot().particles >= 12);
  assert.equal(props.hitArt(p), null);
  for (let i = 0; i < 40; i++) props.update(.1, false, false);
  assert.ok(props.snapshot().particles <= ARENA_PROP_RULES.maxParticles);
}

// 화산 깃발: 7번째에 불이 붙고, 다 타면 그을린 채로 남았다가 다음 스테이지에 복구됩니다.
{
  const { props, events } = make();
  props.setStage(11, 'ruins'); settle(props);
  const p = center(DATA.ruins.banner.box);
  for (let i = 1; i < R.bannerHits; i++) assert.equal(props.hitArt(p), 'banner-flap');
  assert.equal(props.hitArt(p), 'banner-ignite');
  assert.equal(props.snapshot().extras.banner.burning, true);
  assert.equal(props.hitArt(p), null);
  settle(props, Math.ceil(R.bannerBurnSec * 10) + 2);
  assert.equal(props.snapshot().extras.banner.burnt, true);
  assert.ok(events.includes('banner-burnt'));
  props.setStage(12, 'ruins');
  assert.equal(props.snapshot().extras.banner.burnt, false);
}

// 공허 수정: 번갈아 칠수록 음이 올라가고, 끝까지 가면 멜로디 완성. 같은 수정을 거듭 치면 처음 음부터.
{
  const { props, sounds } = make();
  props.setStage(21, 'void'); settle(props);
  const [a, b] = DATA.void.crystals.map((f) => center(f.box));
  props.hitArt(a); props.hitArt(a);
  assert.equal(props.snapshot().extras.chime.chain, 1, '같은 수정 거듭 = 처음부터');
  let result;
  for (let i = 0; i < R.chimeChain - 1; i++) result = props.hitArt(i % 2 ? a : b);
  assert.equal(result, 'void-melody');
  const notes = sounds.filter(([t]) => t === 'prop_chime').map(([, p]) => p).slice(2);
  assert.ok(notes.length >= 4);
  assert.ok(VOID_CHIME_SCALE.length >= R.chimeChain);
}

// 초원 아치: 다섯 번째에 새끼 슬라임이 튀어나오고, 반딧불은 클릭에 반응하지 않습니다.
{
  const { props } = make();
  props.setStage(1, 'meadow'); settle(props);
  const p = center(DATA.meadow.archDark);
  for (let i = 1; i < R.archHits; i++) assert.equal(props.hitArt(p), 'arch-peek');
  assert.equal(props.hitArt(p), 'slime-pop');
  assert.equal(props.snapshot().extras.arch.slime, true);
  assert.equal(props.hitArt(p), null);
  const z = DATA.meadow.fireflyZones[0];
  assert.equal(props.hitArt({ x: z[0] + 5, y: z[1] + 5 }), null);
}

// 행운 불씨: 큰 반응에서만, 확률로 나옵니다(작은 반응에서는 절대 없음).
{
  let small = 0, big = 0, got = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { props, lucky } = make(seed * 7919);
    props.setStage(1, 'meadow'); settle(props);
    const p = center(DATA.meadow.archDark);
    for (let i = 1; i < R.archHits; i++) props.hitArt(p);
    small += lucky.length;
    props.hitArt(p); big++;
    got += lucky.length;
  }
  assert.equal(small, 0, '작은 반응은 행운 불씨 없음');
  assert.ok(got > 5 && got < 35, `행운 불씨 비율이 확률(${R.luckyChance})과 크게 다름: ${got}/${big}`);
}

// 모션 줄이기: 상태는 바뀌어도 입자는 없습니다. 일시정지: 시간이 흐르지 않습니다.
{
  const { props } = make();
  props.setStage(6, 'mine'); settle(props, 12, true);
  const p = center(byId(DATA.mine, 'cart').box);
  for (let i = 0; i < R.cartHits; i++) props.hitArt(p, true);
  props.update(.016, false, true);
  assert.equal(props.snapshot().particles, 0);
  const lp = center(byId(DATA.mine, 'lantern').box);
  props.hitArt(lp);
  const frozen = JSON.stringify(props.snapshot());
  props.update(.5, true, false);
  assert.equal(JSON.stringify(props.snapshot()), frozen);
}

console.log('배경 소품 확장: 랜턴·광차·깃발·공허 수정·아치, 행운 불씨 확률, 모션 줄이기·정지 검증 통과');
