/* 실제 지역 배경 제어기를 사용하고, 비교용 배우와 화염구만 별도 겹칩니다. 저장 데이터는 사용하지 않습니다. */
const arenaPreviewSamples=[
  {stage:6,label:'잿빛 폐광',range:'6–10',monster:8},
  {stage:11,label:'화산 유적',range:'11–15',monster:15},
  {stage:16,label:'화염 성채',range:'16–20',monster:20},
  {stage:21,label:'공허의 경계',range:'21 이후',monster:25}
];
const arenaPreviewScenes=[];
const previewMageSheet=new Image();previewMageSheet.src='assets/art/paper-mage-poses.png';
const previewPause=document.querySelector('#pause'),previewReduced=document.querySelector('#reduced');
for(const sample of arenaPreviewSamples){
  const card=document.createElement('section');card.className='card';
  const label=document.createElement('div');label.className='label';label.innerHTML=`<span>${sample.label}</span><span>${sample.range}</span>`;
  const arena=document.createElement('div');arena.className='arena';arena.dataset.stage=sample.stage;
  const background=document.createElement('canvas');background.className='background';
  const mage=document.createElement('canvas');mage.width=mage.height=640;mage.className='mage';
  const monster=document.createElement('div');monster.className='monster';
  const effects=document.createElement('canvas');effects.className='effects';
  arena.append(background,mage,monster,effects);card.append(label,arena);document.querySelector('#gallery').append(card);
  const scene=createArenaEnvironment(background,arena);scene.setStage(sample.stage);
  const f=getPaperMonsterFrame(sample.monster);
  function resizeActors(){
    const scale=arena.clientHeight*.28/f.h;
    Object.assign(monster.style,{width:`${f.w*scale}px`,height:`${f.h*scale}px`,backgroundImage:`url('${f.sheet}')`,backgroundSize:`${f.size[0]*scale}px ${f.size[1]*scale}px`,backgroundPosition:`${-f.x*scale}px ${-f.y*scale}px`,clipPath:f.clip});
    effects.width=arena.clientWidth;effects.height=arena.clientHeight;
    const ctx=effects.getContext('2d');
    drawComicProjectile(ctx,{type:'fireball',radius:12,startX:0,startY:0,targetX:100,targetY:0,colorCore:'#fff0b5',colorMid:'#ff951f',ringRgb:'251, 146, 60'},effects.width*.5,effects.height*.60,.55);
  }
  function drawMage(){const f=PAPER_ART_FRAMES.mage.idle;mage.getContext('2d').drawImage(previewMageSheet,...f.box,f.box[0]-f.foot[0]+294,f.box[1]-f.foot[1]+638,f.box[2],f.box[3]);}
  previewMageSheet.addEventListener('load',drawMage);if(previewMageSheet.complete&&previewMageSheet.naturalWidth)drawMage();
  window.addEventListener('resize',resizeActors);resizeActors();arenaPreviewScenes.push({scene,arena});
}
let arenaPreviewPrevious=performance.now();
function arenaPreviewTick(now){
  const dt=Math.min(.1,(now-arenaPreviewPrevious)/1000);arenaPreviewPrevious=now;
  for(const {scene,arena} of arenaPreviewScenes){scene.update(dt,previewPause.checked||document.hidden,previewReduced.checked);arena.dataset.fade=scene.snapshot().fade.toFixed(3);}
  requestAnimationFrame(arenaPreviewTick);
}
requestAnimationFrame(arenaPreviewTick);
