/* 스테이지 전환 시 슬라임 복원과 심연 이미지 선택을 검증합니다. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const actor={dataset:{},style:{},textContent:'🐀',children:[],appendChild(c){this.children.push(c);},replaceChildren(){this.children=[];}};
const context=vm.createContext({document:{getElementById:id=>id==='dummy-emoji'?actor:{clientHeight:126},addEventListener(){},createElement:()=>({style:{},setAttribute(){}})},console});
const readScript = name => fs.readFileSync(path.join(__dirname, '../src/scripts', name), 'utf8');
vm.runInContext(readScript('comic-monster-frames.js')+readScript('paper-monster-frames.js')+readScript('comic-assets.js'),context);
assert.match(vm.runInContext("comicIconHTML('🧞')",context),/data-sheet="fire-elemental"/,'불의 정령은 화염 스킬 아틀라스와 다른 전용 이미지로 표시해야 합니다');
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
assert.ok(parseFloat(actor.style.height)>normalHeight*1.4,'최종 보스는 직전 일반 몬스터보다 확실히 커야 합니다');
assert.ok(parseFloat(actor.style.height)>=126*2.5,'최종 보스는 마법사보다 큰 보스 실루엣을 가져야 합니다');
assert.deepEqual(actor.children.map(c=>c.className),['boss-heart-core'],'최종 보스만 가슴에 불의 심장을 하나 가집니다');
assert.equal(actor.children[0].style.left,'52%');
vm.runInContext('configureComicMonster(19)',context);
assert.equal(actor.children.length,0,'일반 몬스터에는 불의 심장이 없습니다');
vm.runInContext('configureComicMonster(20)',context);
vm.runInContext('configureComicMonster(1000)',context);
assert.ok(parseFloat(actor.style.height)<=126*2.8,'무한 심연에서도 크기에 상한이 있어야 합니다');
// 좁은 화면에서는 비율과 접지를 유지하면서 원화를 화면 안에 제한한다.
context.document.getElementById=id=>id==='dummy-emoji'?actor:id==='combat-arena'?{clientHeight:550,clientWidth:390}:{clientHeight:100};
vm.runInContext('configureComicMonster(20)',context);
assert.ok(parseFloat(actor.style.width)<=195,'모바일 보스는 전장 폭 절반을 넘지 않아야 합니다');
assert.ok(parseFloat(actor.style.height)>150,'모바일에서도 보스 실루엣을 유지해야 합니다');
assert.equal(actor.style.bottom,'0px');
console.log('몬스터 성장·보스 크기·화면 상한·이미지·슬라임 복원 검증 통과');

// 불장판: 사진풍 원화 대신 종이 불꽃을 직접 그리며, 빛 번짐 합성 없이 호출자의 소멸 알파만 따릅니다.
const paint={globalAlpha:.4,globalCompositeOperation:'source-over',filter:'none',fills:[],stack:[],ys:[],
 beginPath(){},closePath(){},moveTo(x,y){this.ys.push(y);},lineTo(x,y){this.ys.push(y);},ellipse(){},stroke(){},clip(){},translate(){},transform(){},
 save(){this.stack.push([this.globalAlpha,this.globalCompositeOperation,this.filter]);},
 restore(){[this.globalAlpha,this.globalCompositeOperation,this.filter]=this.stack.pop();},
 fill(){this.fills.push({style:this.fillStyle,alpha:this.globalAlpha,blend:this.globalCompositeOperation,filter:this.filter});},
 drawImage(...args){this.draws=(this.draws||[]);this.draws.push({args,alpha:this.globalAlpha});}};
context.paint=paint;
assert.ok(!vm.runInContext("'flame-patch' in comicAbilityImages",context),'불장판은 사진풍 원화를 불러오지 않아야 합니다');
vm.runInContext('drawPaperFlamePatch(paint,100,200,230,0)',context);
assert.ok(paint.fills.length>=8*4,'바닥 위에 종이 불꽃 여러 장(테두리 그림자·주황·밑단·속불)을 세워야 합니다');
assert.ok(paint.fills.some((f)=>f.style==='#f26a1b') && paint.fills.some((f)=>f.style==='#ffd36b'),'화상 종이 불꽃과 같은 색 문법을 써야 합니다');
assert.ok(paint.fills.every((f)=>f.alpha===.4 && f.blend==='source-over' && f.filter==='none'),'블러·화면 합성 없이 호출자의 소멸 알파만 따라야 합니다');
assert.equal(paint.globalAlpha,.4);assert.equal(paint.globalCompositeOperation,'source-over');
paint.fills.length=0;
vm.runInContext('drawPaperFlamePatch(paint,100,200,230,0.6)',context);
const poseA=paint.fills.length;
assert.ok(poseA>0,'포즈가 바뀌어도 불꽃은 계속 그려져야 합니다');
vm.runInContext("comicAbilityImages['fire-elemental']={complete:true,naturalWidth:1536};drawComicAbility(paint,'fire-elemental',100,200,48)",context);
assert.equal(paint.draws[0].alpha,.4,'다른 소환수의 불투명도는 변경하지 않아야 합니다');
