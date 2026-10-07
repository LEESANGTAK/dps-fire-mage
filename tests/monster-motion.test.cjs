const assert=require('node:assert/strict');
const {getMonsterMotionProfile,monsterMotionProfiles}=require('../src/scripts/monster-motion.js');
assert.equal(monsterMotionProfiles.length,20);
for(let stage=1;stage<=20;stage++){
 const p=getMonsterMotionProfile(stage);
 assert.ok(p.period>0 && p.recoil>0);
 if(stage>2) assert.ok(p.squash<=.025,'슬라임 이외에는 심하게 압축하지 않습니다.');
}
for(const stage of [8,9,13,16,18]) assert.equal(getMonsterMotionProfile(stage).squash,0);
assert.equal(getMonsterMotionProfile(1).death,'puddle');
assert.equal(getMonsterMotionProfile(3).death,'fall');
assert.equal(getMonsterMotionProfile(13).death,'crumble');
assert.equal(getMonsterMotionProfile(17).death,'dissolve');
assert.equal(getMonsterMotionProfile(20).death,'extinguish');
assert.equal(getMonsterMotionProfile(100).kind,'spirit');
console.log('20종의 재질·피격 진폭·사망 분기 검증 통과');
