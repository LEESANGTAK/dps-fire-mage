/* 원화 경계·심연 재사용·종이 피격의 탄성 차단·사망 윤곽 보존을 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { PAPER_MONSTER_FRAMES, getPaperMonsterFrame } = require('./paper-monster-frames.js');
assert.equal(PAPER_MONSTER_FRAMES.length, 20);
for (const f of PAPER_MONSTER_FRAMES) {
  const png = fs.readFileSync(f.sheet);
  assert.deepEqual(f.size, [png.readUInt32BE(16), png.readUInt32BE(20)]);
  assert.ok(f.x >= 0 && f.y >= 0 && f.w > 0 && f.h > 0);
  assert.ok(f.x + f.w <= f.size[0] && f.y + f.h <= f.size[1]);
  assert.match(f.clip, /^polygon\(/);
  for (const value of f.clip.matchAll(/([\d.]+)%/g)) assert.ok(Number(value[1]) <= 100);
}
assert.equal(getPaperMonsterFrame(3), PAPER_MONSTER_FRAMES[0]);
assert.equal(getPaperMonsterFrame(20), PAPER_MONSTER_FRAMES[17]);
assert.equal(getPaperMonsterFrame(21), PAPER_MONSTER_FRAMES[18]);
assert.equal(getPaperMonsterFrame(25), PAPER_MONSTER_FRAMES[19]);
assert.equal(getPaperMonsterFrame(1000), PAPER_MONSTER_FRAMES[19]);
function node() {
  return { dataset: {}, style: {setProperty(k,v){this[k]=v;}}, children: [],
    textContent: '', className: '', removeAttribute(){}, setAttribute(){},
    cloneNode(){const copy=node();copy.dataset={...this.dataset};Object.assign(copy.style,this.style);return copy;},
    appendChild(child){this.children.push(child);}, addEventListener(){}, remove(){this.isConnected=false;},
    getBoundingClientRect(){return {left:200,top:100,width:160,height:140};}
  };
}
const actor=node(), source=node(), arena=node();
actor.dataset.paper='true';source.dataset.paper='true';source.dataset.art='monster';
source.style.clipPath=PAPER_MONSTER_FRAMES[0].clip;
arena.querySelectorAll=()=>[];
const pool=[];
let clock=0,paused=false;
const timers=[];
arena.classList={contains:()=>paused};
const context=vm.createContext({ document:{getElementById:id=>({'dummy-avatar':actor,'dummy-emoji':source,'combat-arena':arena}[id]),createElement:node},
  performance:{now:()=>clock}, particles:pool, getComputedStyle:()=>({fontSize:'0px'}),setTimeout(fn){timers.push(fn);}, matchMedia:()=>({matches:false}) });
vm.runInContext(fs.readFileSync('monster-motion.js','utf8'),context);
for (const stage of [3,5,8,9,13,16,17,20,21,25]) {
  vm.runInContext(`prepareMonsterHit(${stage},true,1,false)`,context);
  assert.equal(actor.style['--hit-squash'],'0','종이 원화는 젤리처럼 늘어나지 않아야 합니다.');
  vm.runInContext(`spawnMaterialDeath(${stage},true)`,context);
  const ghost=arena.children.at(-1);
  assert.equal(ghost.style.clipPath,'none');
  assert.equal(ghost.children[0].style.clipPath,source.style.clipPath,'사망 외곽 접힘과 별도로 원화 윤곽을 보존해야 합니다.');
}
assert.ok(pool.length<=48);
const lastGhost=arena.children.at(-1),retire=timers.at(-1);
paused=true;clock=1500;retire();
assert.notEqual(lastGhost.isConnected,false,'모달 중 안전 정리 타이머로 잔상이 사라지면 안 됩니다.');
paused=false;clock=1550;retire();
assert.notEqual(lastGhost.isConnected,false,'정지 시간은 사망 잔상의 수명에 더하지 않습니다.');
clock=2700;retire();
assert.equal(lastGhost.isConnected,false);
console.log('종이 몬스터 20원화·심연 선택·피격 탄성 차단·사망 윤곽 보존 검증 통과');
