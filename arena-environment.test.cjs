/* 실제 배경 제어기로 경계·역주행·승천·정지·이미지 지연을 검증합니다. */
const assert=require('node:assert/strict');
const {getArenaTheme,createArenaEnvironment,drawArenaAmbient,ARENA_THEMES}=require('./arena-environment.js');
for(const [stage,id] of [[1,'meadow'],[5,'meadow'],[6,'mine'],[10,'mine'],[11,'ruins'],[15,'ruins'],[16,'citadel'],[20,'citadel'],[21,'void'],[1000,'void'],[0,'meadow']])assert.equal(getArenaTheme(stage).id,id);
let drawCount=0,arcCount=0;
const gradient={addColorStop(){}};
const context=new Proxy({globalAlpha:1,createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,drawImage(){drawCount++;},arc(){arcCount++;}}, {get:(o,k)=>k in o?o[k]:()=>{}});
const images=[];
class FakeImage {constructor(){this.complete=true;this.naturalWidth=1536;images.push(this);}}
const arena={clientWidth:640,clientHeight:420,dataset:{}},canvas={width:0,height:0,getContext:()=>context};
const scene=createArenaEnvironment(canvas,arena,FakeImage);
scene.setStage(1);scene.update(.016);assert.equal(arena.dataset.environment,'meadow');assert.equal(images.length,2);
const first=scene.snapshot();scene.setStage(5);assert.equal(scene.snapshot().theme,first.theme);assert.equal(images.length,2);
scene.update(.1,true);assert.equal(scene.snapshot().time,first.time);assert.equal(scene.react(86.4,117.6,true),false);
scene.setStage(6);scene.update(.1);assert.ok(scene.snapshot().fade>0&&scene.snapshot().fade<1);
const moving=scene.snapshot();scene.update(.1,true);assert.deepEqual(scene.snapshot(),moving);
scene.update(.1,false,true);const still=scene.snapshot();assert.equal(still.fade,1);assert.equal(scene.react(73.6,126,false,true),false);
scene.update(.1,false,true);assert.deepEqual(scene.snapshot(),still);
scene.update(.1,false,false);assert.ok(scene.snapshot().time>still.time);
assert.ok(scene.react(73.6,126));assert.equal(scene.snapshot().reaction,1);assert.equal(scene.react(320,230),false);
scene.update(.1);assert.ok(scene.snapshot().reaction<1);
scene.setStage(21);scene.update(.1);scene.setStage(1);scene.update(.1);assert.equal(scene.snapshot().theme,'meadow');
for(let i=1;i<200;i++)scene.setStage(i);assert.equal(scene.snapshot().images,5);
arena.clientWidth=360;arena.clientHeight=620;scene.update(0,true);assert.equal(canvas.width,360);assert.equal(canvas.height,620);
for(const theme of ARENA_THEMES){arcCount=0;drawArenaAmbient(context,640,420,theme,100000);assert.ok(arcCount<=25);}
class DeferredImage {constructor(){this.complete=false;this.naturalWidth=0;}}
const delayed=createArenaEnvironment(canvas,arena,DeferredImage);delayed.setStage(1);delayed.update(.1);delayed.setStage(6);delayed.update(.1);assert.equal(delayed.snapshot().fade,0);
assert.ok(drawCount>0);
console.log('5종 페이즈 배경·정지·모션 감소·전환·반응·이미지 지연·개수 제한 검증 통과');
