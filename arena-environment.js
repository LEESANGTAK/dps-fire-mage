/* 페이즈별 정적 원화와 배경 전환만 렌더링합니다. */
const ARENA_THEMES = [
  {id:'meadow',name:'황혼의 초원'},
  {id:'mine',name:'잿빛 폐광'},
  {id:'ruins',name:'화산 유적'},
  {id:'citadel',name:'화염 성채'},
  {id:'void',name:'공허의 경계'}
];
function getArenaTheme(stage) {
  const index=Math.max(0,Math.ceil(Math.max(1,Number(stage)||1)/5)-1);
  return ARENA_THEMES[Math.min(4,index)];
}
function createArenaEnvironment(canvas,arena,ImageType=Image) {
  const ctx=canvas.getContext('2d'),images={};
  let theme=null,previous=null,fade=1,dirty=true,reducedLast=false;
  function load(id) {
    if(images[id])return images[id];
    const image=new ImageType();images[id]=image;
    image.onload=()=>{dirty=true;};image.onerror=()=>{dirty=true;};
    image.src=id==='meadow'?'assets/art/paper-arena.png':`assets/art/arena-${id}.png`;return image;
  }
  function setStage(stage) {
    const next=getArenaTheme(stage);
    if(next===theme)return;
    previous=theme;theme=next;load(theme.id);fade=previous?0:1;dirty=true;
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
    ctx.restore();
  }
  function update(dt,paused=false,reduced=false) {
    if(!theme)return;
    resize();
    if(reduced!==reducedLast){reducedLast=reduced;dirty=true;}
    if(!paused&&!reduced&&fade<1&&images[theme.id].complete) {
      const step=Math.max(0,Math.min(.1,dt));fade=Math.min(1,fade+step/.9);dirty=true;
    }
    if(reduced) {fade=1;}
    if(!dirty)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const ready=images[theme.id].complete&&images[theme.id].naturalWidth;
    if(previous&&(!ready||fade<1))layer(previous,1);
    const eased=.5-.5*Math.cos(Math.PI*fade);
    if(!previous||ready)layer(theme,previous?eased:1);
    dirty=false;
  }
  return {setStage,resize,update,snapshot:()=>({theme:theme&&theme.id,fade,images:Object.keys(images).length})};
}
let arenaEnvironment=null;
if(typeof module!=='undefined')module.exports={ARENA_THEMES,getArenaTheme,createArenaEnvironment};
