const assert = require('node:assert/strict');
const { selectMagePose } = require('./mage-motion.js');
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
console.log('시전속도·몰열·발사·반동·발화 포즈 검증 통과');
