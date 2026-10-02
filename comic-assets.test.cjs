/* 스테이지 전환 시 슬라임 복원과 심연 이미지 선택을 검증합니다. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const actor={dataset:{},style:{},textContent:'🐀'};
const context=vm.createContext({document:{getElementById:id=>id==='dummy-emoji'?actor:{clientHeight:126},addEventListener(){}},console});
vm.runInContext(fs.readFileSync('comic-monster-frames.js','utf8')+fs.readFileSync('comic-assets.js','utf8'),context);
for(let stage=3;stage<=30;stage++){
 vm.runInContext(`configureComicMonster(${stage})`,context);
 assert.equal(actor.dataset.art,'monster');assert.equal(actor.textContent,'');
 assert.ok(actor.style.clipPath.startsWith('polygon('));assert.ok(parseFloat(actor.style.width)>0);
 assert.equal(actor.style.height,'126px');
}
const abyssNormal=vm.runInContext('COMIC_MONSTER_FRAMES[18]',context);
vm.runInContext('configureComicMonster(21)',context);
assert.equal(actor.style.backgroundPosition,`${-abyssNormal.x*126/abyssNormal.h}px ${-abyssNormal.y*126/abyssNormal.h}px`);
vm.runInContext('configureComicMonster(2)',context);
assert.equal(actor.dataset.art,'slime');assert.equal(actor.dataset.variant,'blue');assert.equal(actor.style.cssText,'');
vm.runInContext('configureComicMonster(1)',context);assert.equal(actor.dataset.variant,'');
console.log('몬스터 이미지·심연 선택·슬라임 복원 검증 통과');
