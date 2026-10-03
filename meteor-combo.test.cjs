/* 몰열 연계·일반 시전·기존 투자 이전의 실제 실행 경로를 검증합니다. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
const skillCode=source.slice(source.indexOf('function triggerSkill('),source.indexOf('function runSmartAutoCast('));
const combat={castingSkill:'fireball',castRemaining:1,castTotal:1.5,gcdRemaining:.8,critStreak:2,streakTimer:12,meteorCdRem:9};
let impacts=0,syncs=0,streakFlag;
const state={combat,grimoires:{meteor:true},skillTree:{}};
const ctx=vm.createContext({state,getPlayerStats:()=>({sp:100,crit:100,critDmg:2,speedMult:1,cdr:0}),beginMageGesture(){},updateCastingLoopSound(){},launchMeteorVfx:fn=>{impacts++;fn();},dealDamage:(key,dmg,crit,streak)=>{assert.equal(key,'meteor');assert.equal(dmg,640);assert.ok(crit);streakFlag=streak;},triggerAllSummonsSyncAttack:()=>syncs++});
vm.runInContext(skillCode,ctx);
assert.ok(vm.runInContext("triggerSkill('meteor')",ctx));
assert.equal(impacts,1);assert.equal(syncs,1);assert.equal(streakFlag,false);
assert.equal(combat.critStreak,0);assert.equal(combat.streakTimer,0);
assert.equal(combat.meteorCdRem,9);assert.equal(combat.castingSkill,'fireball');assert.equal(combat.castRemaining,1);
assert.equal(vm.runInContext("triggerSkill('meteor')",ctx),false);
combat.castingSkill=null;combat.gcdRemaining=0;combat.meteorCdRem=0;
assert.ok(vm.runInContext("triggerSkill('meteor')",ctx));
assert.equal(combat.castingSkill,'meteor');assert.equal(combat.castTotal,2.5);assert.equal(impacts,1);
assert.equal(vm.runInContext("triggerSkill('meteor')",ctx),false);
vm.runInContext("finishCast('meteor')",ctx);
assert.equal(impacts,2);assert.equal(combat.meteorCdRem,18);assert.equal(combat.meteorBurnRem,6);
state.grimoires.meteor=false;combat.critStreak=2;
assert.equal(vm.runInContext("triggerSkill('meteor')",ctx),false);assert.equal(combat.critStreak,2);
const migration=source.slice(source.indexOf('function migrateMeteorSave('),source.indexOf('function loadGame('));
for(const oldLevel of [0,1,6,10,100]) {
 const saved={grimoires:{pyroblast:true,meteor:false},skillMastery:{pyroblast:oldLevel,meteor:3},skillAuto:{pyroblast:false,meteor:true}};
 const c=vm.createContext({state:saved});vm.runInContext(migration+'migrateMeteorSave();',c);
 assert.ok(saved.grimoires.meteor);assert.ok((saved.skillMastery.meteor-3)*.12+1e-9>=oldLevel*.1);
 assert.equal(saved.skillAuto.meteor,false);assert.equal(saved.skillMastery.pyroblast,undefined);
 const first=JSON.stringify(saved);vm.runInContext('migrateMeteorSave();',c);assert.equal(JSON.stringify(saved),first);
}
console.log('몰열 즉시 메테오·시전 보존·쿨타임·반복 소비·투자 이전 검증 통과');
