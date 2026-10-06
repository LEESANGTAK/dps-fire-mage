/* 스테이지 전환 시 슬라임 복원과 심연 이미지 선택을 검증합니다. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const actor={dataset:{},style:{},textContent:'🐀'};
const context=vm.createContext({document:{getElementById:id=>id==='dummy-emoji'?actor:{clientHeight:126},addEventListener(){}},console});
vm.runInContext(fs.readFileSync('comic-monster-frames.js','utf8')+fs.readFileSync('paper-monster-frames.js','utf8')+fs.readFileSync('comic-assets.js','utf8'),context);
assert.match(vm.runInContext("comicIconHTML('🔹')",context),/data-sheet="essence"/,'정수는 화염 스킬 아틀라스와 다른 이미지로 표시해야 합니다');
for(let stage=3;stage<=30;stage++){
 vm.runInContext(`configureComicMonster(${stage})`,context);
 assert.equal(actor.dataset.art,'monster');assert.equal(actor.dataset.paper,'true');assert.match(actor.style.backgroundImage,/paper-monsters-/);assert.equal(actor.textContent,'');
 assert.ok(actor.style.clipPath.startsWith('polygon('));assert.ok(parseFloat(actor.style.width)>0);
 assert.ok(parseFloat(actor.style.height)>=126*.9 && parseFloat(actor.style.height)<=126*2.8);
 assert.equal(actor.style.bottom,'0px');
}
const abyssNormal=vm.runInContext('PAPER_MONSTER_FRAMES[18]',context);
vm.runInContext('configureComicMonster(21)',context);
const abyssScale=parseFloat(actor.style.height)/abyssNormal.h;
assert.equal(actor.style.backgroundPosition,`${-abyssNormal.x*abyssScale}px ${-abyssNormal.y*abyssScale}px`);
vm.runInContext('configureComicMonster(2)',context);
assert.equal(actor.dataset.art,'slime');assert.equal(actor.dataset.variant,'blue');assert.equal(actor.style.cssText,'');
vm.runInContext('configureComicMonster(1)',context);assert.equal(actor.dataset.variant,'');
const slimeSize=parseFloat(actor.style.height);
vm.runInContext('configureComicMonster(3)',context);
assert.ok(parseFloat(actor.style.height)>slimeSize*.875,'초반 일반 몬스터는 슬라임보다 높아야 합니다');
const earlyHeight=parseFloat(actor.style.height);
vm.runInContext('configureComicMonster(19)',context);
assert.ok(parseFloat(actor.style.height)>earlyHeight*1.5,'후반 몬스터는 초반보다 커야 합니다');
const normalHeight=parseFloat(actor.style.height);
vm.runInContext('configureComicMonster(20)',context);
assert.ok(parseFloat(actor.style.height)>normalHeight*1.4,'라그나로스는 직전 일반 몬스터보다 확실히 커야 합니다');
assert.ok(parseFloat(actor.style.height)>=126*2.5,'라그나로스는 마법사보다 큰 보스 실루엣을 가져야 합니다');
vm.runInContext('configureComicMonster(1000)',context);
assert.ok(parseFloat(actor.style.height)<=126*2.8,'무한 심연에서도 크기에 상한이 있어야 합니다');
// 좁은 화면에서는 비율과 접지를 유지하면서 원화를 화면 안에 제한한다.
context.document.getElementById=id=>id==='dummy-emoji'?actor:id==='combat-arena'?{clientHeight:550,clientWidth:390}:{clientHeight:100};
vm.runInContext('configureComicMonster(20)',context);
assert.ok(parseFloat(actor.style.width)<=195,'모바일 보스는 전장 폭 절반을 넘지 않아야 합니다');
assert.ok(parseFloat(actor.style.height)>150,'모바일에서도 보스 실루엣을 유지해야 합니다');
assert.equal(actor.style.bottom,'0px');
console.log('몬스터 성장·보스 크기·화면 상한·이미지·슬라임 복원 검증 통과');
