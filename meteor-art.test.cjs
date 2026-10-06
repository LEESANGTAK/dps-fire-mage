/* 실제 운석 렌더 경로의 궤적·잔상·입자·충돌·모달 정지를 검증합니다. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {getMeteorPose,drawComicMeteor,emitMeteorTrail}=require('./meteor-art.js');
const m={startX:100,startY:60,targetX:400,targetY:320,radius:51,progress:0,duration:.96,scale:1};
const start=getMeteorPose(m,0),end=getMeteorPose(m,1);
assert.equal(start.x,100);assert.equal(start.y,60);assert.equal(end.x,400);assert.equal(end.y,320);
assert.ok(getMeteorPose(m,.9).x-getMeteorPose(m,.8).x>getMeteorPose(m,.2).x-getMeteorPose(m,.1).x);
for(const p of [0,.1,.5,.9,1]) {const pose=getMeteorPose(m,p);assert.ok(pose.angle>0&&pose.angle<Math.PI/2);assert.ok(pose.radius>0);}
let drawCount=0,pathCount=0;
const painter=new Proxy({drawImage(){drawCount++;},beginPath(){pathCount++;}}, {get:(o,k)=>k in o?o[k]:()=>{}});
drawComicMeteor(painter,m,getMeteorPose(m,.5),{complete:true,naturalWidth:1536});assert.equal(drawCount,1);
drawComicMeteor(painter,m,getMeteorPose(m,.5),null);assert.ok(pathCount>0);
for(const fps of [30,60,144]) {
 const pool=[],meteor={...m};for(let frame=0;frame<fps;frame++)emitMeteorTrail(meteor,getMeteorPose(m,.8),1/fps,pool);
 assert.ok(pool.length<=350);
}
const pool=[];emitMeteorTrail(m,getMeteorPose(m,.5),.1,pool,true);assert.equal(pool.length,0);
emitMeteorTrail(m,getMeteorPose(m,.5),0,pool);assert.equal(pool.length,0);
const full=Array.from({length:450},()=>({}));emitMeteorTrail(m,getMeteorPose(m,.5),.1,full);assert.equal(full.length,450);
const game=fs.readFileSync('game.js','utf8');
const debrisCode=game.slice(game.indexOf('const rockDebris = [];'),game.indexOf('const monsterShards = [];'));
const debrisContext=vm.createContext({});vm.runInContext(debrisCode,debrisContext);
vm.runInContext('for(let i=0;i<30;i++)spawnMeteorRockDebris(100,200);',debrisContext);
assert.equal(vm.runInContext('rockDebris.length',debrisContext),48);
const begin=game.indexOf('  for (let i = meteors.length - 1;');
const loop=game.slice(begin,game.indexOf('  // 메테오 충돌 시 사방으로',begin));
for(const reduced of [false,true]) {
 let impacts=0,debris=0,shake=0,burst=0;
 const state={isPaused:true,soundOn:false},meteors=[{...m,progress:.9,onImpact:()=>impacts++}],shockwaves=[];
 const c=vm.createContext({state,meteors,shockwaves,particles:[],performance:{now:()=>1000},lastMeteorShakeTime:-Infinity,getMeteorPose,emitMeteorTrail,drawComicMeteor(){},ctx:{},spawnParticles:(x,y,count)=>burst=count,spawnMeteorRockDebris:()=>debris++,triggerArenaShake:()=>shake++,playSound(){}});
 vm.runInContext(`function tick(dt){const meteorDt=state.isPaused?0:dt;const reducedMeteor=${reduced};${loop}}`,c);
 vm.runInContext('tick(.2)',c);assert.equal(meteors[0].progress,.9);assert.equal(impacts,0);
 state.isPaused=false;vm.runInContext('tick(.2);tick(.2)',c);assert.equal(impacts,1);assert.equal(meteors.length,0);
 assert.equal(debris,reduced?0:1);assert.equal(shake,reduced?0:1);assert.equal(shockwaves.length,reduced?0:2);assert.equal(burst,reduced?6:30);
}
console.log('운석 방향·가속·꼬리 잔상·입자 상한·정확한 충돌·모달 정지·모션 감소 검증 통과');
