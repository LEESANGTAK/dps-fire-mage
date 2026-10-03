const assert = require('node:assert/strict');
const { selectMagePose, advanceSpring, mageFrames } = require('./mage-motion.js');
const combat = { castingSkill: null, castRemaining: 0, castTotal: 1.5, critStreak: 0, combustionRem: 0 };
const rest = { kind: '', remaining: 0, total: 0 };
assert.equal(selectMagePose(combat, rest), 'idle');
for (const duration of [0.4, 1.5, 2.5]) {
  assert.equal(selectMagePose({ ...combat, castingSkill: 'fireball', castTotal: duration, castRemaining: duration * 0.9 }, rest), 'idle');
  assert.equal(selectMagePose({ ...combat, castingSkill: 'meteor', castTotal: duration, castRemaining: duration * 0.2 }, rest), 'charge');
}
assert.equal(selectMagePose({ ...combat, critStreak: 2 }, rest), 'idle');
assert.equal(selectMagePose({ ...combat, combustionRem: 1 }, rest), 'hot');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: 0.3, total: 0.3 }), 'idle');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: 0.15, total: 0.3 }), 'idle');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: 0.01, total: 0.3 }), 'idle');
assert.equal(selectMagePose({ ...combat, critStreak: 2 }, { kind: 'meteor', remaining: 0.38, total: 0.38 }), 'release');
assert.equal(selectMagePose(combat, { kind: 'combustion', remaining: 0.5, total: 0.5 }), 'hot');
// 모달 중에는 자세와 발사 여운의 시간이 모두 정지해야 합니다.
const vm = require('node:vm');
const fs = require('node:fs');
const art = { dataset: {}, classList: { toggle() {} }, style: { setProperty() {} } };
const context = vm.createContext({ state: { combat }, document: { getElementById: () => art } });
vm.runInContext(fs.readFileSync('./mage-motion.js', 'utf8'), context);
vm.runInContext("beginMageGesture('meteor'); updateMageMotion(0.2, true)", context);
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

// 초고속 반복 시전에서도 접지 포즈와 팔 회전 범위는 유지합니다.
const { armTarget } = require('./mage-motion.js');
const { standingCastTarget } = require('./mage-motion.js');
const repeatedBody = { x:0,vx:0,squash:0,vs:0,cloth:0,vc:0 };
for (let i=0;i<2400;i++) {
  const p=(i%12)/12;
  const target=standingCastTarget(combat,{kind:'fireball',remaining:.3*(1-p),total:.3});
  advanceSpring(repeatedBody,1/120,target.lean,target.squash,2.1);
  assert.ok(Math.abs(repeatedBody.x)<13 && Math.abs(repeatedBody.squash)<.016,'연속 발사로 상체 반응이 누적되면 안 됩니다.');
}
for (let i=0;i<240;i++) advanceSpring(repeatedBody,1/120,0,0);
assert.ok(Math.abs(repeatedBody.x)<.01 && Math.abs(repeatedBody.cloth)<.01,'시전 종료 후 상체와 장식이 복귀해야 합니다.');
assert.ok(Math.abs(armTarget({...combat,castingSkill:'fireball',castTotal:.05,castRemaining:.001},rest))<.08,'초고속 시전에서는 준비 진폭을 줄여야 합니다.');
for (const duration of [.4,1.5,2.5]) {
  const raised=armTarget({...combat,castingSkill:'fireball',castTotal:duration,castRemaining:duration-.05},rest);
  assert.ok(Math.abs(raised)>=.16*Math.min(1,duration/.6)*.98,'시전 길이와 무관하게 50ms 내에 준비 자세의 98%에 도달해야 합니다.');
}
assert.ok(armTarget(combat,{kind:'fireball',remaining:.29,total:.3})>.273,'발사 10ms 내에 끝 자세에 가까워야 합니다.');
assert.equal(armTarget(combat,{kind:'fireball',remaining:.25,total:.3}),.275,'발사 끝 자세를 짧게 유지해야 합니다.');
const briskBody={x:0,vx:0,squash:0,vs:0,cloth:0,vc:0};
for(let i=0;i<6;i++) advanceSpring(briskBody,1/120,10,.01,2.1);
assert.ok(briskBody.x>6 && briskBody.cloth<briskBody.x*.4,'상체는 빠르게 반응하고 장식은 뒤따라야 합니다.');
for (const duration of [0.02, 0.05, 0.1, 1.5]) {
  for (let i = 0; i <= 10; i++) {
    const fast = { ...combat, castingSkill: 'fireball', castTotal: duration, castRemaining: duration * i / 10 };
    assert.equal(selectMagePose(fast, rest), 'idle');
    assert.ok(Math.abs(armTarget(fast, rest)) <= 0.201);
  }
}
// 픽셀 읽기가 금지된 파일 실행 환경에서도 이미지 원본을 사용해야 합니다.
let imageCalls = 0;
class TestImage { complete = true; naturalWidth = 1536; }
const projectileContext = vm.createContext({ Image: TestImage, console, document: { createElement() { throw Error('픽셀 읽기 금지'); } } });
vm.runInContext(fs.readFileSync('./combat-art.js', 'utf8'), projectileContext);
projectileContext.painter = { save(){}, restore(){}, translate(){}, rotate(){}, scale(){}, drawImage(){ imageCalls++; } };
vm.runInContext("drawComicProjectile(painter, {type:'fireball', radius:10, startX:0, startY:0, targetX:100, targetY:0}, 50, 0, 0.5)", projectileContext);
assert.equal(imageCalls, 3);

const trailPool = [];
projectileContext.trailPool = trailPool;
vm.runInContext("const trailShot = {type:'fireball', radius:10}; for(let i=0;i<500;i++) emitComicTrail(trailShot, i, 50, 1/60, trailPool, false)", projectileContext);
assert.equal(trailPool.length, 96, '고속 연사의 불씨 수를 제한해야 합니다.');
assert.ok(trailPool.every(p => p.maxLife <= 0.24));
vm.runInContext("emitComicTrail(trailShot, 0, 0, 1, trailPool, true)", projectileContext);
assert.equal(trailPool.length, 96);

assert.ok(armTarget({ ...combat, castingSkill:'fireball', castRemaining:1 }, rest) < -0.1, '시전 초반부터 팔의 준비 동작이 읽혀야 합니다.');
assert.equal(armTarget(combat, {kind:'fireball', remaining:0.3, total:0.3}), 0.24);
let previousAngle = 0.24;
for(let i=1;i<=300;i++) {
  const angle = armTarget(combat, {kind:'fireball', remaining:0.3*(1-i/300), total:0.3});
  assert.ok(Math.abs(angle - previousAngle) < 0.01, '손목 복귀가 연속이어야 합니다.');
  previousAngle = angle;
}

const slimePool = [];
projectileContext.slimePool = slimePool;
vm.runInContext('for(let i=0;i<100;i++) spawnSlimeSplash(slimePool,100,100,160,false,true,i*0.1,false)', projectileContext);
assert.equal(slimePool.length, 48);
assert.ok(slimePool.every(p => p.vy < 0 && p.maxLife <= 0.63));
vm.runInContext('spawnSlimeSplash(slimePool,100,100,160,false,true,100,true)', projectileContext);
assert.equal(slimePool.length, 48);

const { livingMageMotion } = require('./mage-motion.js');
assert.equal(livingMageMotion(10, true, false).breath, 1);
assert.equal(livingMageMotion(10, true, false).hat, 0);
assert.notDeepEqual(livingMageMotion(1, false, false), livingMageMotion(2, false, false));
for(let i=0;i<1000;i++) {
  const idle = livingMageMotion(i/10,false,false);
  assert.ok(Math.abs(idle.breath-1)<=0.0121 && Math.abs(idle.shear)<=0.0101);
  assert.ok(Math.abs(livingMageMotion(i/10,false,true).hat)<=1.401);
}

const edgePool = [];
projectileContext.edgePool = edgePool;
vm.runInContext('spawnSlimeSplash(edgePool,110,100,190,false,true,101,false,{x:0,y:0,width:220})', projectileContext);
assert.ok(edgePool.every(p => p.x < 80 || p.x > 140), '몸 중앙에는 점액을 생성하지 않습니다.');
assert.ok(edgePool.filter(p => p.x < 80).every(p => p.vx < 0));
assert.ok(edgePool.filter(p => p.x > 140).every(p => p.vx > 0));
