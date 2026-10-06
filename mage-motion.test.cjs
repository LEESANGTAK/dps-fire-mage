const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const { selectMagePose, mageFrames, getMagePlacement } = require('./mage-motion.js');
const combat = { castingSkill: null, castRemaining: 0, castTotal: 1.5, combustionRem: 0 };
const rest = { kind: '', remaining: 0, total: 0 };
assert.equal(selectMagePose(combat, rest), 'idle');
for (const duration of [.35, .4, 1.5, 2.5]) {
  assert.equal(selectMagePose({ ...combat, castingSkill: 'fireball', castTotal: duration, castRemaining: duration * .9 }, rest), 'anticipation');
  assert.equal(selectMagePose({ ...combat, castingSkill: 'meteor', castTotal: duration, castRemaining: duration * .2 }, rest), 'charge');
}
assert.equal(selectMagePose({ ...combat, combustionRem: 1 }, rest), 'hot');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: .14, total: .14 }), 'release');
assert.equal(selectMagePose(combat, { kind: 'fireball', remaining: .05, total: .14 }), 'recoil');
assert.equal(selectMagePose({ ...combat, combustionRem: 1 }, { kind: 'fireball', remaining: .14, total: .14 }), 'release');
assert.equal(selectMagePose(combat, { kind: 'meteor', remaining: .15, total: .42 }), 'recoil');
// 실제 종이 원화의 경계와 접지점, 지팡이 끝의 일치를 검증합니다.
const png = fs.readFileSync('assets/art/paper-mage-poses.png');
for (const [pose, frame] of Object.entries(mageFrames)) {
  const [x, y, w, h] = frame.box;
  assert.ok(x >= 0 && y >= 0 && x + w <= png.readUInt32BE(16) && y + h <= png.readUInt32BE(20));
  assert.ok(frame.foot[0] >= x && frame.foot[0] <= x + w && frame.foot[1] >= y && frame.foot[1] <= y + h);
  const placement = getMagePlacement(pose);
  assert.deepEqual(placement.foot, [294, 638]);
  assert.deepEqual(placement.muzzle, [294 + frame.tip[0] - frame.foot[0], 638 + frame.tip[1] - frame.foot[1]]);
}
const art = { dataset: {}, classList: { toggle() {} }, style: { setProperty() {} } };
const context = vm.createContext({ state: { combat }, document: { getElementById: () => art } });
vm.runInContext(fs.readFileSync('./paper-art.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('./mage-motion.js', 'utf8'), context);
vm.runInContext("beginMageGesture('meteor'); updateMageMotion(.2, true)", context);
assert.equal(art.dataset.pose, 'release');
assert.equal(vm.runInContext('mageGesture.remaining', context), .42);
assert.equal(vm.runInContext('mageMotion.time', context), 0);
vm.runInContext('updateMageMotion(.2, false)', context);
assert.equal(art.dataset.pose, 'recoil');
vm.runInContext('updateMageMotion(.5, false)', context);
assert.equal(art.dataset.pose, 'idle');
vm.runInContext("beginMageGesture('fireball'); mageGesture.hitStop = .03; updateMageMotion(.02, false)", context);
assert.equal(vm.runInContext('mageGesture.remaining', context), .14);
vm.runInContext("beginMageGesture('fireblast')", context);
assert.equal(art.dataset.pose, 'release', '시각적 멈춤 중 즉시 발사도 지팡이 끝을 즉시 갱신해야 합니다.');
vm.runInContext('updateMageMotion(.02, false); updateMageMotion(.08, false)', context);
assert.equal(art.dataset.pose, 'recoil');
const { getPaperSlimePose } = require('./paper-art.js');
assert.equal(getPaperSlimePose({ time: 0, hit: .25, stage: 1 }), 'hit');
assert.equal(getPaperSlimePose({ time: 0, hit: .1, stage: 1 }), 'recover');
assert.equal(getPaperSlimePose({ time: 3.25, hit: 0, stage: 1 }), 'rest');
assert.equal(getPaperSlimePose({ time: 3.25, hit: 0, stage: 1 }, true), 'idle');
console.log('종이 마법사·슬라임의 시전 포즈·실제 원화 좌표·발사점·정지 검증 통과');

// 캔버스를 만들 수 없는 환경에서는 화염구 텍스처 생성을 건너뛰고 오류 없이 넘어가야 합니다.
let imageCalls = 0;
const projectileContext = vm.createContext({ console, Map, document: { createElement() { throw Error('캔버스 생성 불가'); } } });
vm.runInContext(fs.readFileSync('./combat-art.js', 'utf8'), projectileContext);
projectileContext.painter = { save(){}, restore(){}, translate(){}, rotate(){}, scale(){}, drawImage(){ imageCalls++; } };
vm.runInContext("drawComicProjectile(painter, {type:'fireball', radius:10, startX:0, startY:0, targetX:100, targetY:0, colorCore:'#fde047', colorMid:'#f97316', ringRgb:'251, 146, 60'}, 50, 0, 0.5)", projectileContext);
assert.equal(imageCalls, 0);

const trailPool = [];
projectileContext.trailPool = trailPool;
vm.runInContext("const trailShot = {type:'fireball', radius:10}; for(let i=0;i<500;i++) emitComicTrail(trailShot, i, 50, 1/60, trailPool, false)", projectileContext);
assert.equal(trailPool.length, 150, '고속 연사의 꼬리 불꽃 수를 제한해야 합니다.');
assert.ok(trailPool.every(p => p.fireTrail && p.maxLife <= 0.3));
vm.runInContext("emitComicTrail(trailShot, 0, 0, 1, trailPool, true)", projectileContext);
assert.equal(trailPool.length, 150);

const slimePool = [];
projectileContext.slimePool = slimePool;
vm.runInContext('for(let i=0;i<100;i++) spawnSlimeSplash(slimePool,100,100,160,false,true,i*0.1,false)', projectileContext);
assert.equal(slimePool.length, 48);
assert.ok(slimePool.every(p => p.vy < 0 && p.maxLife <= 0.63));
vm.runInContext('spawnSlimeSplash(slimePool,100,100,160,false,true,100,true)', projectileContext);
assert.equal(slimePool.length, 48);

const { livingMageMotion } = require('./mage-motion.js');
assert.equal(livingMageMotion(10, true, false).breathY, 1);
assert.equal(livingMageMotion(10, true, false).breathX, 1);
assert.equal(livingMageMotion(10, true, false).lean, 0);
assert.notDeepEqual(livingMageMotion(1, false, false), livingMageMotion(2, false, false));
for(let i=0;i<1000;i++) {
  const idle = livingMageMotion(i/10,false,false);
  assert.ok(Math.abs(idle.breathY - 1) <= 0.02 && Math.abs(idle.breathX - 1) <= 0.01);
  assert.ok(Math.abs(idle.lean) <= 0.01);
}

const edgePool = [];
projectileContext.edgePool = edgePool;
vm.runInContext('spawnSlimeSplash(edgePool,110,100,190,false,true,101,false,{x:0,y:0,width:220})', projectileContext);
assert.ok(edgePool.every(p => p.x < 80 || p.x > 140), '몸 중앙에는 점액을 생성하지 않습니다.');
assert.ok(edgePool.filter(p => p.x < 80).every(p => p.vx < 0));
assert.ok(edgePool.filter(p => p.x > 140).every(p => p.vx > 0));
