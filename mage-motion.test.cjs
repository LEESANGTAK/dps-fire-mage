const assert = require('node:assert/strict');
const { selectMagePose, advanceSpring, mageFrames } = require('./mage-motion.js');
const combat = { castingSkill: null, castRemaining: 0, castTotal: 1.5, critStreak: 0, combustionRem: 0 };
const rest = { kind: '', remaining: 0, total: 0 };
assert.equal(selectMagePose(combat, rest), 'idle');
for (const duration of [0.4, 1.5, 2.5]) {
  assert.equal(selectMagePose({ ...combat, castingSkill: 'fireball', castTotal: duration, castRemaining: duration * 0.9 }, rest), 'anticipation');
  assert.equal(selectMagePose({ ...combat, castingSkill: 'pyroblast', castTotal: duration, castRemaining: duration * 0.2 }, rest), 'charge');
}
assert.equal(selectMagePose({ ...combat, critStreak: 2 }, rest), 'hot');
assert.equal(selectMagePose({ ...combat, combustionRem: 1 }, rest), 'hot');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: 0.3, total: 0.3 }), 'release');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: 0.15, total: 0.3 }), 'recoil');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: 0.01, total: 0.3 }), 'idle');
assert.equal(selectMagePose({ ...combat, critStreak: 2 }, { kind: 'pyroblast', remaining: 0.38, total: 0.38 }), 'release');
assert.equal(selectMagePose(combat, { kind: 'combustion', remaining: 0.5, total: 0.5 }), 'hot');
// 모달 중에는 자세와 발사 여운의 시간이 모두 정지해야 합니다.
const vm = require('node:vm');
const fs = require('node:fs');
const art = { dataset: {}, classList: { toggle() {} }, style: { setProperty() {} } };
const context = vm.createContext({ state: { combat }, document: { getElementById: () => art } });
vm.runInContext(fs.readFileSync('./mage-motion.js', 'utf8'), context);
vm.runInContext("beginMageGesture('pyroblast'); updateMageMotion(0.2, true)", context);
assert.equal(art.dataset.pose, 'release');
assert.equal(vm.runInContext('mageGesture.remaining', context), 0.38);
vm.runInContext('updateMageMotion(0.15, false)', context);
assert.equal(art.dataset.pose, 'recoil');
vm.runInContext('updateMageMotion(0.5, false)', context);
assert.equal(art.dataset.pose, 'idle');
vm.runInContext("beginMageGesture('fireball'); mageGesture.hitStop = 0.03; updateMageMotion(0.02, false)", context);
assert.equal(vm.runInContext('mageGesture.remaining', context), 0.3);
vm.runInContext('updateMageMotion(0.02, false); updateMageMotion(0.05, false)', context);
assert.ok(vm.runInContext('mageGesture.remaining < 0.3', context));
const spring = { x: 0, vx: 0, squash: 0, vs: 0, cloth: 0, vc: 0 };
let peak = 0;
for (let i = 0; i < 120; i++) { advanceSpring(spring, 1 / 120, 20, 0.08); peak = Math.max(peak, spring.x); }
assert.ok(peak > 20, '몸의 스프링에 작은 오버슈트가 있어야 합니다.');
assert.ok(Math.abs(spring.x - 20) < 0.1);
for (let i = 0; i < 120; i++) advanceSpring(spring, 1 / 120, 0, 0);
assert.ok(Math.abs(spring.x) < 0.1 && Math.abs(spring.cloth) < 0.2, '몸과 옷의 여운이 모두 복귀해야 합니다.');
for (const frame of Object.values(mageFrames)) {
  const [x, y, width, height] = frame.box;
  assert.ok(x >= 0 && y >= 0 && x + width <= 1536 && y + height <= 1024);
  assert.ok(frame.foot[0] >= x && frame.foot[0] <= x + width && frame.foot[1] >= y && frame.foot[1] <= y + height);
}
console.log('시전속도·몰열·발사·반동·발화 포즈 검증 통과');
