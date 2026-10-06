/* 운석은 진행 방향으로 암석을 앞세우고, 화염만 뒤에 남깁니다. */
const comicMeteor=typeof Image!=='undefined'?new Image():null;
if(comicMeteor)comicMeteor.src='assets/art/comic-meteor.png';
// 생성 원화의 투명 여백과 암석 중심은 검토 후 설정합니다. (1024x1024 정중앙 앵커)
const COMIC_METEOR_FRAME = { x: 0, y: 0, w: 1024, h: 1024, anchor: 0.5, anchorY: 0.5 };

function getMeteorPose(m, progress = m.progress) {
  const p = Math.max(0, Math.min(1, progress));
  // 디즈니 12원칙 가속 낙하 이징: 초반 기모으기 진입 -> 후반 지면 급속 내리꽂힘
  const travel = p < 0.25 ? p * 0.75 : Math.pow(p, 2.5);
  const dx = m.targetX - m.startX;
  const dy = m.targetY - m.startY;
  // 원근감(Perspective Depth): 저 멀리 높은 대기권(작음)에서 지면 충돌 순간 거대화(1.4배)
  const appear = Math.min(1, p / 0.08);
  const scale = (0.42 + 0.95 * Math.pow(p, 1.8)) * appear;
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
  const width = pose.radius * 2.8;
  const height = width;

  ctx.save();
  ctx.translate(pose.x, pose.y);
  // 낙하 각도 + 지면으로 떨어지며 서서히 회전하는 텀블(Tumble) 물리
  ctx.rotate(pose.angle + pose.progress * 0.45);

  if (image && image.complete && image.naturalWidth) {
    // 1. 대기권 돌입 압축 마그마 림 라이팅 (Atmospheric Heat Compression)
    if (pose.progress > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flareAlpha = Math.min(0.7, (pose.progress - 0.3) * 1.3);
      ctx.globalAlpha = flareAlpha;
      const glowR = pose.radius * 1.6;
      const grad = ctx.createRadialGradient(0, 0, glowR * 0.2, 0, 0, glowR);
      grad.addColorStop(0, 'rgba(255, 240, 180, 0.85)');
      grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.45)');
      grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. 순수 운석 암석 본체 (불꼬리 스프라이트 없이 파티클을 100% 노출)
    ctx.globalAlpha = 1;
    ctx.drawImage(
      image,
      0,
      0,
      image.naturalWidth,
      image.naturalHeight,
      -width * 0.5,
      -height * 0.5,
      width,
      height
    );
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
  const count = Math.min(4, Math.floor(m.trailClock / 0.016));
  m.trailClock %= 0.016;
  const available = Math.min(70 - pool.filter(p => p.meteorTrail).length, 240 - pool.length);
  for (let i = 0; i < count && i < available; i++) {
    const distance = pose.radius * (0.6 + Math.random() * 1.8);
    const dx = Math.cos(pose.angle);
    const dy = Math.sin(pose.angle);
    pool.push({
      meteorTrail: true,
      x: pose.x - dx * distance,
      y: pose.y - dy * distance + (Math.random() - 0.5) * pose.radius * 0.4,
      vx: -dx * (70 + Math.random() * 40) + (Math.random() - 0.5) * 30,
      vy: -dy * (70 + Math.random() * 40) - 25,
      radius: 2.2 + Math.random() * 3.4,
      life: 0,
      maxLife: 0.26 + Math.random() * 0.12,
      colorCore: '#fff7ed',
      colorEdge: '#ea580c'
    });
  }
}
if(typeof module!=='undefined')module.exports={COMIC_METEOR_FRAME,getMeteorPose,drawComicMeteor,emitMeteorTrail};
