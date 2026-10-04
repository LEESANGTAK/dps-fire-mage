/* 실제 스킬 실행과 설명 수치가 같은지 장비·숙련 조합별로 비교합니다. */
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const {buildSkillDetails}=require('./skill-tooltips.js');
const source=fs.readFileSync('game.js','utf8');
const trigger=source.slice(source.indexOf('function triggerSkill('),source.indexOf('function runSmartAutoCast('));
for(const stats of [{sp:100,speedMult:1,critDmg:1.5,cdr:0,igniteMult:1},{sp:317,speedMult:5,critDmg:2.4,cdr:.6,igniteMult:1.75}]) {
 for(const skill of ['fireball','fireblast','combustion','meteor','flame_patch']) {
  const combat={castingSkill:null,gcdRemaining:0,fbCharges:2,fbMaxCharges:2,fbRechargeRem:0,critStreak:0,combustionCdRem:0,meteorCdRem:0,flamePatchCdRem:0};
  const tree={flame_patch:3,magma_golem:2};let rawDamage=null;
  const context=vm.createContext({state:{combat,skillTree:tree,grimoires:{fireblast:true,combustion:true,meteor:true}},getPlayerStats:()=>stats,getCombustionDuration:()=>3.4,getTargetPos:()=>({x:0,y:0}),spawnParticles(){},dealDamage:(key,value)=>{rawDamage=value;},beginMageGesture(){},triggerAllSummonsSyncAttack(){},fireWithMultishot(){},updateCastingLoopSound(){},updateBurningLoopSound(){},spawnFloatingText(){},playSound(){},playFireballSfx(){},shockwaves:[],launchMeteorVfx:callback=>callback()});
  vm.runInContext(trigger,context);
  const detail=buildSkillDetails(skill,stats,combat,tree,1.3,3.4);
  assert.ok(vm.runInContext(`triggerSkill('${skill}')`,context));
  const sec=value=>`${Number(value.toFixed(2))}초`;
  if(skill==='fireball'||skill==='meteor') assert.ok(detail.cast.includes(sec(combat.castTotal)));
  if(skill==='meteor') vm.runInContext("finishCast('meteor')",context);
  const cdKey={fireblast:'fbRechargeTotal',combustion:'combustionCdTotal',meteor:'meteorCdTotal',flame_patch:'flamePatchCdTotal'}[skill];
  if(cdKey) assert.ok(detail.cooldown.includes(sec(combat[cdKey])));
  if(rawDamage!==null) assert.ok(detail.damage.includes(Math.round(rawDamage*1.3).toLocaleString('ko-KR')),'설명 피해량은 실제 피해와 숙련을 반영해야 합니다.');
 }
}
const stats={sp:10,speedMult:1,critDmg:1.5,cdr:0};
assert.ok(buildSkillDetails('meteor',stats,{critStreak:2},{},1).cast.startsWith('즉시'));
assert.match(buildSkillDetails('fireblast',stats,{fbCharges:1,fbMaxCharges:2},{},1).feature,/1\/2/);
assert.match(buildSkillDetails('combustion',stats,{},{}).damage,/없음/);
// 브라우저 접근 없이 호버·포커스·종료 및 가장자리 위치 제어를 검사합니다.
const events={}, timers=new Map(), intervals=new Map();let nextId=0;
const button={dataset:{skill:'fireblast'},attrs:{},classList:{contains:()=>false},querySelector:()=>({textContent:'불꽃 작렬'}),removeAttribute(key){delete this.attrs[key];},setAttribute(key,value){this.attrs[key]=value;},addEventListener(name,fn){events[name]=fn;},blur(){documentStub.activeElement=null;},getBoundingClientRect:()=>({left:2,top:600,width:66,bottom:666})};
const popupEvents={},windowEvents={};
const popup={hidden:true,offsetWidth:300,offsetHeight:230,style:{},innerHTML:'',addEventListener(name,fn){popupEvents[name]=fn;}};
const documentStub={activeElement:null,getElementById:()=>popup,querySelector:()=>null,querySelectorAll:()=>[button]};
const ui=vm.createContext({document:documentStub,window:{addEventListener(name,fn){windowEvents[name]=fn;}},innerWidth:390,innerHeight:700,state:{combat:{fbCharges:2,fbMaxCharges:2},skillTree:{}},getPlayerStats:()=>stats,getSkillMasteryMult:()=>1,getCombustionDuration:()=>2,setTimeout:fn=>{timers.set(++nextId,fn);return nextId;},clearTimeout:id=>timers.delete(id),setInterval:fn=>{intervals.set(++nextId,fn);return nextId;},clearInterval:id=>intervals.delete(id)});
vm.runInContext(fs.readFileSync('skill-tooltips.js','utf8')+'\ninitSkillTooltips();',ui);
const flush=()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();};
events.pointerenter({pointerType:'mouse'});assert.ok(popup.hidden);flush();
assert.equal(popup.hidden,false);assert.equal(button.attrs['aria-describedby'],'skill-tooltip');assert.equal(popup.style.left,'8px');assert.equal(popup.style.top,'360px');
// 마우스 클릭 시 툴팁 즉시 닫힘 검증
events.pointerdown();assert.ok(popup.hidden,'스킬 마우스 다운 시 툴팁이 즉시 숨겨져야 합니다.');
events.click();assert.ok(popup.hidden,'스킬 클릭 시 툴팁이 닫혀 있어야 합니다.');
events.pointerleave();popupEvents.pointerenter();flush();assert.ok(popup.hidden);
events.pointerenter({pointerType:'mouse'});flush();assert.equal(popup.hidden,false);
events.pointerleave();popupEvents.pointerenter();flush();assert.equal(popup.hidden,false);
windowEvents.keydown({key:'Escape'});assert.ok(popup.hidden);assert.equal(intervals.size,0);
events.pointerenter({pointerType:'touch'});flush();assert.ok(popup.hidden);
documentStub.activeElement=button;events.focus();events.pointerleave();flush();assert.equal(popup.hidden,false);
documentStub.activeElement=null;events.blur();flush();assert.ok(popup.hidden);
assert.equal(button.attrs['aria-describedby'],undefined);
console.log('5종 스킬 설명·실제 시전·쿨타임·피해량·충전 및 클릭 시 툴팁 닫힘 검증 통과');
