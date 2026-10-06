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
 const growth=Math.min(1.62,.76+stage*.035)+(stage%5===0?.18:0);
 assert.equal(actor.style.height,`${126*growth}px`);
 assert.equal(actor.style.bottom,'0px');
}
const abyssNormal=vm.runInContext('PAPER_MONSTER_FRAMES[18]',context);
vm.runInContext('configureComicMonster(21)',context);
const abyssScale=126*Math.min(1.62,.76+21*.035)/abyssNormal.h;
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
assert.ok(parseFloat(actor.style.height)>normalHeight,'보스는 직전 일반 몬스터보다 커야 합니다');
vm.runInContext('configureComicMonster(1000)',context);
assert.ok(parseFloat(actor.style.height)<=126*1.8,'무한 심연에서도 크기에 상한이 있어야 합니다');
console.log('몬스터 이미지·심연 선택·슬라임 복원 검증 통과');
