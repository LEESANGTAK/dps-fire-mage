/* 운석은 진행 방향으로 암석을 앞세우고, 화염만 뒤에 남깁니다. */
const comicMeteor=typeof Image!=='undefined'?new Image():null;
if(comicMeteor)comicMeteor.src='assets/art/comic-meteor.png';
// 생성 원화의 투명 여백과 암석 중심은 검토 후 설정합니다.
const COMIC_METEOR_FRAME={x:0,y:0,w:1536,h:1024,anchor:.78,anchorY:.57};
function getMeteorPose(m, progress = m.progress) {
  const p = Math.max(0, Math.min(1, progress));
  // 디즈니 12원칙 가속 낙하 이징: 초반 기모으기 진입 -> 후반 지면 급속 내리꽂힘
  const travel = p < 0.25 ? p * 0.75 : Math.pow(p, 2.5);
  const dx = m.targetX - m.startX;
  const dy = m.targetY - m.startY;
  // 원근감(Perspective Depth): 저 멀리 높은 대기권(작음)에서 지면 충돌 순간 거대화(1.4배)
  const appear = Math.min(1, p / 0.08);
  const scale = (0.36 + 0.92 * Math.pow(p, 1.8)) * appear;
  const angle = Math.atan2(dy, dx);
  return {
    x: m.startX + dx * travel,
    y: m.startY + dy * travel,
    angle,
    radius: m.radius * scale,
    progress: p
  };
}

function drawComicMeteor(ctx, m, pose, image = comicMeteor) {
  const frame = COMIC_METEOR_FRAME;
  const width = pose.radius * 5.4;
  const height = (width * frame.h) / frame.w;
  const time = performance.now() / 1000;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.rotate(pose.angle);

  if (image && image.complete && image.naturalWidth) {
    // 1. 화염 꼬리 펄럭임 다이내믹스 (Flapping Sine Waves)
    // 정지화 꼬리를 고정하지 않고, 대기 마찰에 흩날리는 3겹의 너울거리는 화염 혀 렌더링
    const tailW = frame.w * 0.55;
    const tailDrawW = width * 0.55;

    for (let w = 3; w >= 1; w--) {
      const wavePhase = time * (14 + w * 5) + w * 1.6;
      const flapY = Math.sin(wavePhase) * (3.5 + w * 2.8) * (pose.radius / 25);
      const flapScaleY = 1 + Math.cos(wavePhase * 0.8) * 0.09;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.26 / w;
      ctx.translate(-width * frame.anchor, -height * frame.anchorY + flapY);
      ctx.scale(1 + w * 0.035, flapScaleY);
      ctx.drawImage(image, frame.x, frame.y, tailW, frame.h, 0, 0, tailDrawW, height);
      ctx.restore();
    }

    // 2. 대기권 돌입 압축 마그마 광원 (Re-entry Atmospheric Flare)
    if (pose.progress > 0.35) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flareAlpha = Math.min(0.75, (pose.progress - 0.35) * 1.25);
      ctx.globalAlpha = flareAlpha;
      const glowR = pose.radius * 1.35;
      const glowX = width * (1 - frame.anchor) * 0.25;
      const grad = ctx.createRadialGradient(glowX, 0, glowR * 0.15, glowX, 0, glowR);
      grad.addColorStop(0, 'rgba(255, 240, 180, 0.9)');
      grad.addColorStop(0.45, 'rgba(249, 115, 22, 0.55)');
      grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(glowX, 0, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. 본체 암석 및 화염 텍스처 (Solid Core)
    ctx.globalAlpha = 1;
    ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, -width * frame.anchor, -height * frame.anchorY, width, height);
  } else {
    // 이미지 로딩 중 대체 벡터 렌더링
    ctx.fillStyle = '#35252a';
    ctx.strokeStyle = '#1b1420';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const r = pose.radius * (i % 2 ? 0.82 : 1);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.85;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffae47';
    ctx.lineWidth = Math.max(1, pose.radius * 0.045);
    ctx.beginPath();
    ctx.moveTo(-pose.radius * 0.7, -pose.radius * 0.4);
    ctx.lineTo(-pose.radius * 0.2, 0);
    ctx.lineTo(pose.radius * 0.2, -pose.radius * 0.35);
    ctx.lineTo(pose.radius * 0.65, pose.radius * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

function emitMeteorTrail(m, pose, dt, pool, reduced = false) {
  if (reduced || dt <= 0) return;
  m.trailClock = (m.trailClock || 0) + Math.min(0.1, dt);
  const count = Math.min(3, Math.floor(m.trailClock / 0.02));
  m.trailClock %= 0.02;
  const available = Math.min(54 - pool.filter(p => p.meteorTrail).length, 220 - pool.length);
  for (let i = 0; i < count && i < available; i++) {
    const distance = pose.radius * (0.85 + Math.random() * 1.6);
    const dx = Math.cos(pose.angle);
    const dy = Math.sin(pose.angle);
    pool.push({
      meteorTrail: true,
      x: pose.x - dx * distance,
      y: pose.y - dy * distance + (Math.random() - 0.5) * pose.radius * 0.35,
      vx: -dx * 55 + (Math.random() - 0.5) * 25,
      vy: -dy * 55 - 20,
      radius: 2.0 + Math.random() * 2.8,
      life: 0,
      maxLife: 0.22 + Math.random() * 0.1,
      colorCore: '#fff7ed',
      colorEdge: '#ea580c'
    });
  }
}
if(typeof module!=='undefined')module.exports={COMIC_METEOR_FRAME,getMeteorPose,drawComicMeteor,emitMeteorTrail};
