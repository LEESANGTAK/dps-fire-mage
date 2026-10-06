const assert = require('node:assert/strict');
const C = require('./paper-preview-core.js');
const advance = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 240); i++) C.step(s, 1 / 240); };
// 화염구는 시전 완료 전 나타나지 않으며 강화 발사는 같은 순간에 반영됩니다.
const s = C.createState(); s.auto = false;
C.startCast(s); advance(s, 1.4); assert.equal(s.shots, 0); assert.equal(s.projectiles.length, 0);
advance(s, .1); assert.equal(s.shots, 1); assert.equal(C.magePose(s), 'release');
assert.equal(s.projectiles[0].age, 0);
assert.equal(C.shoot(s, true), true); assert.equal(s.shots, 2);
// 일시정지 중에는 시전·포즈·투사체·효과 모두 같은 상태를 유지합니다.
s.paused = true; const frozen = JSON.stringify(s); advance(s, 2); assert.equal(JSON.stringify(s), frozen);
assert.equal(C.shoot(s, true), false); s.paused = false;
advance(s, .4); assert.equal(s.hits, 2); assert.equal(s.hp, 968);
advance(s, 1); assert.equal(s.particles.length, 0); assert.equal(s.projectiles.length, 0);
// 고속 연사와 반복 강화 입력에서도 효과 상한을 넘지 않습니다.
const fast = C.createState(); fast.duration = .35;
for (let i = 0; i < 240 * 20; i++) { if (i % 4 === 0) C.shoot(fast, true); C.step(fast, 1 / 240);
  assert.ok(fast.projectiles.length <= C.LIMITS.projectiles); assert.ok(fast.particles.length <= C.LIMITS.particles);
}
assert.ok(fast.shots > 40);
// 모션 감소에서도 적중 판정은 유지하며 추가 조각은 생성하지 않습니다.
const reduced = C.createState(); reduced.auto = false; reduced.reduced = true;
C.shoot(reduced, true); advance(reduced, .35); assert.equal(reduced.hits, 1); assert.equal(reduced.particles.length, 0);
// 처치와 모달 사이에 1.1초의 인지 여유를 두고 모달 중 전투 시간을 고정합니다.
const dead = C.createState(); C.defeat(dead); advance(dead, 1); assert.equal(dead.modal, false);
advance(dead, .12); assert.equal(dead.modal, true); const stopped = JSON.stringify(dead);
advance(dead, 3); assert.equal(JSON.stringify(dead), stopped); assert.equal(C.startCast(dead), false);
// 원화 좌표가 실제 PNG 경계를 벗어나거나 발 원점을 잘라내면 접지와 발사점이 깨집니다.
const fs = require('node:fs');
const frames = require('./paper-art.js');
for (const actor of ['mage', 'slime']) {
  const png = fs.readFileSync(`assets/art/paper-${actor}-poses.png`);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  for (const [pose, f] of Object.entries(frames[actor])) {
    if (pose === 'cell') continue;
    const [x, y, w, h] = f.box;
    assert.ok(x >= 0 && y >= 0 && x + w <= width && y + h <= height, `${actor}/${pose} 표시 영역`);
    for (const point of [f.foot, f.tip].filter(Boolean)) {
      assert.ok(point[0] >= x && point[0] <= x + w && point[1] >= y && point[1] <= y + h, `${actor}/${pose} 발·지팡이 원점`);
    }
  }
}
console.log('페이퍼 시범: 발사 동기화·고속 상한·효과 소멸·일시정지·처치 여운 검증 통과');
