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

// 불장판: 몬스터 발밑 바닥에 눕힌 붉은 균열(프랙탈 가지). 사진풍 원화를 쓰지 않고 호출자의 소멸 알파를 넘지 않습니다.
const paint={globalAlpha:.4,globalCompositeOperation:'source-over',filter:'none',strokes:[],stack:[],pts:[],
 beginPath(){},closePath(){},moveTo(x,y){this.pts.push([x,y]);},lineTo(x,y){this.pts.push([x,y]);},arc(){},fill(){},translate(){},scale(){},
 createRadialGradient(){return {addColorStop(){}};},
 save(){this.stack.push([this.globalAlpha,this.globalCompositeOperation,this.filter]);},
 restore(){[this.globalAlpha,this.globalCompositeOperation,this.filter]=this.stack.pop();},
 stroke(){this.strokes.push({style:this.strokeStyle,alpha:this.globalAlpha,width:this.lineWidth});},
 drawImage(...args){this.draws=(this.draws||[]);this.draws.push({args,alpha:this.globalAlpha});}};
context.paint=paint;
assert.ok(!vm.runInContext("'flame-patch' in comicAbilityImages",context),'불장판은 사진풍 원화를 불러오지 않아야 합니다');
const cracks=vm.runInContext('getFlamePatchCracks()',context);
assert.ok(cracks.length>60 && cracks.some((c)=>c.gen>=2),'중심에서 갈라져 여러 세대로 가지 치는 균열이어야 합니다');
assert.ok(cracks.every((c)=>Math.hypot(c.x2,c.y2)<=1),'균열은 바닥 원판 밖으로 나가지 않아야 합니다');
assert.equal(JSON.stringify(vm.runInContext('buildFlamePatchCracks()',context)),JSON.stringify(cracks),'고정 시드라 프레임마다 무늬가 떨리지 않아야 합니다');
vm.runInContext('drawFlamePatchCracks(paint,100,200,230,0,99)',context);
const full=paint.strokes.length;
assert.ok(full>=cracks.length*3,'바깥 열기·붉은 몸통·노란 심지 3겹으로 그려야 합니다');
assert.ok(paint.strokes.every((s)=>s.alpha<=.4+1e-9),'호출자의 소멸 알파를 넘지 않아야 합니다');
// 원근: 세로 폭은 가로의 0.32배(바닥에 눕힘), 앞쪽(화면 아래) 균열이 뒤쪽보다 굵습니다.
const ys=paint.pts.map((p)=>p[1]-200), xs=paint.pts.map((p)=>p[0]-100);
assert.ok(Math.max(...ys.map(Math.abs))<=115*.32+1e-6 && Math.max(...xs.map(Math.abs))>100,'바닥 원근대로 가로로 넓고 세로로 납작해야 합니다');
assert.equal(paint.globalAlpha,.4);assert.equal(paint.globalCompositeOperation,'source-over');
// 시전 직후에는 중심 근처만 갈라지고, 0.35초 뒤 끝까지 번집니다.
paint.strokes.length=0;
vm.runInContext('drawFlamePatchCracks(paint,100,200,230,0,0.05)',context);
assert.ok(paint.strokes.length>0 && paint.strokes.length<full/2,'시전 직후에는 균열이 중심에서 번져 나가는 중이어야 합니다');
const ember=vm.runInContext('flamePatchEmberPoint(100,200,230,0.5)',context);
assert.ok(Math.abs(ember.y-200)<=115*.32,'불티는 바닥 균열 위에서 피어올라야 합니다');
vm.runInContext("comicAbilityImages['fire-elemental']={complete:true,naturalWidth:1536};drawComicAbility(paint,'fire-elemental',100,200,48)",context);
assert.equal(paint.draws[0].alpha,.4,'다른 소환수의 불투명도는 변경하지 않아야 합니다');
