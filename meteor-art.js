/* 운석은 진행 방향으로 암석을 앞세우고, 화염만 뒤에 남깁니다. */
const comicMeteor=typeof Image!=='undefined'?new Image():null;
if(comicMeteor)comicMeteor.src='assets/art/comic-meteor.png';
// 생성 원화의 투명 여백과 암석 중심은 검토 후 설정합니다.
const COMIC_METEOR_FRAME={x:0,y:0,w:1536,h:1024,anchor:.78,anchorY:.57};
function getMeteorPose(m,progress=m.progress) {
  const p=Math.max(0,Math.min(1,progress));
  const travel=Math.pow(p,2.8),dx=m.targetX-m.startX,dy=m.targetY-m.startY;
  const pop=Math.min(1,p/.08),appear=.35+.65*(1-Math.pow(1-pop,3));
  const scale=(.42+.70*Math.pow(p,2.2))*appear;
  return {x:m.startX+dx*travel,y:m.startY+dy*travel-12*Math.sin(travel*Math.PI),
    angle:Math.atan2(dy-12*Math.PI*Math.cos(travel*Math.PI),dx),radius:m.radius*scale,progress:p};
}
function drawComicMeteor(ctx,m,pose,image=comicMeteor) {
  const frame=COMIC_METEOR_FRAME,width=pose.radius*5.4,height=width*frame.h/frame.w;
  ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.angle);
  if(image&&image.complete&&image.naturalWidth) {
    // 잔상은 꼬리 영역만 그려 암석이 여러 개로 보이지 않게 합니다.
    for(let i=2;i>0;i--) {
      ctx.globalAlpha=.08/i;
      ctx.drawImage(image,frame.x,frame.y,frame.w*.5,frame.h,
        -width*frame.anchor-i*width*.055,-height*frame.anchorY,width*.5,height);
    }
    ctx.globalAlpha=1;
    ctx.drawImage(image,frame.x,frame.y,frame.w,frame.h,-width*frame.anchor,-height*frame.anchorY,width,height);
  } else {
    // 이미지 로딩 중에도 암석과 균열이 있는 운석을 표시합니다.
    ctx.fillStyle='#35252a';ctx.strokeStyle='#1b1420';ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<8;i++) {const a=i*Math.PI/4,r=pose.radius*(i%2?.82:1);const x=Math.cos(a)*r,y=Math.sin(a)*r*.85;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#ffae47';ctx.lineWidth=Math.max(1,pose.radius*.045);
    ctx.beginPath();ctx.moveTo(-pose.radius*.7,-pose.radius*.4);ctx.lineTo(-pose.radius*.2,0);ctx.lineTo(pose.radius*.2,-pose.radius*.35);ctx.lineTo(pose.radius*.65,pose.radius*.3);ctx.stroke();
  }
  ctx.restore();
}
function emitMeteorTrail(m,pose,dt,pool,reduced=false) {
  if(reduced||dt<=0)return;
  m.trailClock=(m.trailClock||0)+Math.min(.1,dt);
  const count=Math.min(2,Math.floor(m.trailClock/.025));m.trailClock%=.025;
  const available=Math.min(48-pool.filter(p=>p.meteorTrail).length,220-pool.length);
  for(let i=0;i<count&&i<available;i++) {
    const distance=pose.radius*(.8+Math.random()*1.5),dx=Math.cos(pose.angle),dy=Math.sin(pose.angle);
    pool.push({meteorTrail:true,x:pose.x-dx*distance,y:pose.y-dy*distance+(Math.random()-.5)*pose.radius*.3,
      vx:-dx*45+(Math.random()-.5)*20,vy:-dy*45-18,radius:1.8+Math.random()*2.5,
      life:0,maxLife:.18+Math.random()*.08,colorCore:'#ffe4a0',colorEdge:'#f16b32'});
  }
}
if(typeof module!=='undefined')module.exports={COMIC_METEOR_FRAME,getMeteorPose,drawComicMeteor,emitMeteorTrail};
