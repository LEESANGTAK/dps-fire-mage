/* 배경 시간은 전투 시계와 함께 흐르고, 주변 소품만 작은 진폭으로 움직입니다. */
const ARENA_THEMES = [
  {id:'meadow',name:'황혼의 초원',light:'#ffd18a',accent:'#82dcb6',kind:'leaves',left:[.135,.28],right:[.94,.46]},
  {id:'mine',name:'잿빛 폐광',light:'#ffbd72',accent:'#8fc8f1',kind:'dust',left:[.115,.30],right:[.93,.43]},
  {id:'ruins',name:'화산 유적',light:'#ff9d52',accent:'#fa7246',kind:'embers',left:[.12,.44],right:[.93,.55]},
  {id:'citadel',name:'화염 성채',light:'#ffc16c',accent:'#fb8345',kind:'embers',left:[.09,.385],right:[.92,.38]},
  {id:'void',name:'공허의 경계',light:'#bca1ff',accent:'#79d9eb',kind:'motes',left:[.07,.35],right:[.945,.42]}
];
function getArenaTheme(stage) {
  const index=Math.max(0,Math.ceil(Math.max(1,Number(stage)||1)/5)-1);
  return ARENA_THEMES[Math.min(4,index)];
}
function arenaGlow(ctx,x,y,r,color,alpha) {
  ctx.save();ctx.globalAlpha*=alpha;
  const gradient=ctx.createRadialGradient(x,y,0,x,y,r);
  gradient.addColorStop(0,color);gradient.addColorStop(.25,color+'a0');gradient.addColorStop(1,color+'00');
  ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function drawArenaAmbient(ctx,width,height,theme,time,reduced=false,reaction=0) {
  const t=reduced?0:time,unit=Math.min(width,height)/600;
  const sway=Math.sin(t*.73)*.035;
  const flicker=.76+Math.sin(t*2.3)*.09+Math.sin(t*5.7+1.2)*.035;
  const left={x:width*theme.left[0],y:height*theme.left[1]},right={x:width*theme.right[0],y:height*theme.right[1]};
  arenaGlow(ctx,left.x,left.y,110*unit,theme.light,.19*flicker+reaction*.1);
  arenaGlow(ctx,right.x,right.y,95*unit,theme.accent,.12*(.9+Math.sin(t*1.2+.8)*.1));
  // 넓은 빛기둥은 가장자리에서만 드리워 중앙 시전·체력 신호를 가리지 않습니다.
  ctx.save();ctx.globalAlpha*=.055;ctx.fillStyle=theme.light;
  ctx.beginPath();ctx.moveTo(width*.075,height*.18);ctx.lineTo(width*.13,height*.18);
  ctx.lineTo(width*(.18+sway*.2),height*.72);ctx.lineTo(width*.04,height*.72);ctx.closePath();ctx.fill();ctx.restore();
  // 원화 속 광원의 위치에 반짝임을 겹칩니다. 별도 등불 몸체를 중복 배치하지 않습니다.
  ctx.save();ctx.translate(left.x,left.y);ctx.scale(unit,unit);
  ctx.globalAlpha*=.23*flicker+reaction*.15;ctx.fillStyle=theme.light;
  ctx.beginPath();ctx.ellipse(0,-2,4+Math.sin(t*3.1)*.5,8+Math.sin(t*4.7)*1.4,sway,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.translate(right.x,height*.57);ctx.scale(unit,unit);
  ctx.strokeStyle='#201722';ctx.lineWidth=3;
  if(theme.id==='meadow') {
    for(let i=0;i<4;i++) {
      const angle=Math.sin(t*.65+i*.8)*.08;
      ctx.save();ctx.translate((i-1.5)*12,12);ctx.rotate(angle);
      ctx.strokeStyle='#536a55';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(7,-16,2,-31-i%2*8);ctx.stroke();
      ctx.fillStyle=theme.accent;ctx.beginPath();ctx.ellipse(3,-32-i%2*8,6,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  } else if(theme.id==='mine') {
    // 수정는 부유시키지 않고 접지한 채 내부 조명만 호흡합니다.
    for(let i=0;i<3;i++) {
      ctx.fillStyle=i%2?'#698eac':'#96c4d4';ctx.beginPath();
      const x=(i-1)*16;ctx.moveTo(x-10,13);ctx.lineTo(x-5,-18-i%2*16);ctx.lineTo(x+4,-25-i%2*12);ctx.lineTo(x+10,13);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.save();ctx.translate(-13,-85);ctx.rotate(Math.sin(t*.38)*.08);
    ctx.strokeStyle='#85705d';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(0,19);ctx.stroke();}ctx.restore();
  } else if(theme.id==='void') {
    for(let i=0;i<3;i++) {
      ctx.save();ctx.translate((i-1)*19,-18+Math.sin(t*.7+i*1.8)*6);ctx.rotate(Math.sin(t*.5+i)*.07);
      ctx.fillStyle='#5d5179';ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(-5,-18);ctx.lineTo(8,-13);ctx.lineTo(11,4);ctx.lineTo(0,11);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
  } else {
    ctx.fillStyle='#3c2930';ctx.beginPath();ctx.ellipse(0,10,30,9,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    for(let i=0;i<3;i++) {
      const h=23+Math.sin(t*2.8+i*1.7)*5;
      ctx.fillStyle=i%2?'#fbc57a':'#ed9054';ctx.beginPath();ctx.moveTo(-19+i*13,7);
      ctx.quadraticCurveTo(-13+i*13,-h*.6,-16+i*13+Math.sin(t*2.1+i)*3,-h);
      ctx.quadraticCurveTo(-3+i*13,-h*.5,-7+i*13,7);ctx.closePath();ctx.fill();
    }
  }
  ctx.restore();
  if(reduced) return;
  // 고정 개수의 주변 입자: 프레임마다 생성하지 않아 누적·시간당 증가가 없습니다.
  const count=theme.id==='meadow'?12:18;
  for(let i=0;i<count;i++) {
    const cycle=(t*(.045+i%3*.008)+i*.137)%1;
    const ease=.5-.5*Math.cos(cycle*Math.PI);
    const x=width*(i%2? .85+Math.sin(t*.23+i)*.055 : .105+Math.sin(t*.27+i)*.055);
    const y=height*(.72-ease*.35);
    const alpha=Math.sin(cycle*Math.PI)*.32;
    ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=i%2?theme.accent:theme.light;
    if(theme.kind==='leaves') {ctx.translate(x,y);ctx.rotate(Math.sin(t*.6+i));ctx.beginPath();ctx.ellipse(0,0,3*unit,1.4*unit,0,0,Math.PI*2);ctx.fill();}
    else {ctx.beginPath();ctx.arc(x,y,(i%3+1)*.7*unit,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
}
function createArenaEnvironment(canvas,arena,ImageType=Image) {
  const ctx=canvas.getContext('2d'),images={};
  let theme=null,previous=null,time=0,fade=1,dirty=true,reducedLast=false,reaction=0;
  function load(id) {
    if(images[id])return images[id];
    const image=new ImageType();images[id]=image;
    image.onload=()=>{dirty=true;};image.onerror=()=>{dirty=true;};
    image.src=`assets/art/arena-${id}.png`;return image;
  }
  function setStage(stage) {
    const next=getArenaTheme(stage);
    if(next===theme)return;
    previous=theme;theme=next;load(theme.id);fade=previous?0:1;reaction=0;dirty=true;
    arena.dataset.environment=theme.id;
    const index=ARENA_THEMES.indexOf(theme);if(index<4)load(ARENA_THEMES[index+1].id);
  }
  function resize() {
    const width=Math.max(1,Math.round(arena.clientWidth)),height=Math.max(1,Math.round(arena.clientHeight));
    if(canvas.width===width&&canvas.height===height)return;
    canvas.width=width;canvas.height=height;dirty=true;
  }
  function layer(value,alpha) {
    if(!value)return;
    ctx.save();ctx.globalAlpha*=alpha;
    const image=images[value.id];
    if(image&&image.complete&&image.naturalWidth)ctx.drawImage(image,0,0,canvas.width,canvas.height);
    // 첫 원화가 로드되기 전에는 기존 CSS 배경이 비치도록 둡니다.
    // 원화의 넓은 중앙 공간을 유지하며 UI 영역만 어둡게 받칩니다.
    const shade=ctx.createLinearGradient(0,0,0,canvas.height);
    shade.addColorStop(0,'#090b16a0');shade.addColorStop(.32,'#090b1610');shade.addColorStop(.78,'#0d0a1630');shade.addColorStop(1,'#0d0a16b0');
    ctx.fillStyle=shade;ctx.fillRect(0,0,canvas.width,canvas.height);
    drawArenaAmbient(ctx,canvas.width,canvas.height,value,time,reducedLast,reaction);ctx.restore();
  }
  function update(dt,paused=false,reduced=false) {
    if(!theme)return;
    resize();
    if(reduced!==reducedLast){reducedLast=reduced;dirty=true;}
    if(!paused&&!reduced) {const step=Math.max(0,Math.min(.1,dt));time+=step;if(images[theme.id].complete)fade=Math.min(1,fade+step/.9);reaction=Math.max(0,reaction-step*1.8);dirty=true;}
    if(reduced) {fade=1;reaction=0;}
    if(!dirty)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const ready=images[theme.id].complete&&images[theme.id].naturalWidth;
    if(previous&&(!ready||fade<1))layer(previous,1);
    const eased=.5-.5*Math.cos(Math.PI*fade);
    if(!previous||ready)layer(theme,previous?eased:1);
    dirty=false;
  }
  function react(x,y,paused=false,reduced=false) {
    if(paused||reduced||!theme)return false;
    const distance=Math.hypot(x/canvas.width-theme.left[0],y/canvas.height-theme.left[1]);
    if(distance>.065)return false;
    reaction=1;dirty=true;return true;
  }
  return {setStage,resize,update,react,snapshot:()=>({theme:theme&&theme.id,time,fade,reaction,images:Object.keys(images).length})};
}
let arenaEnvironment=null;
if(typeof module!=='undefined')module.exports={ARENA_THEMES,getArenaTheme,drawArenaAmbient,createArenaEnvironment};
