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
    // 1. 대기권 돌입 압축 마그마 림 라이팅 (과도한 백색 타버림 억제 및 부드러운 호박색 마그마 톤)
    if (pose.progress > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flareAlpha = Math.min(0.28, (pose.progress - 0.3) * 0.6);
      ctx.globalAlpha = flareAlpha;
      const glowR = pose.radius * 1.35;
      const grad = ctx.createRadialGradient(0, 0, glowR * 0.15, 0, 0, glowR);
      grad.addColorStop(0, 'rgba(254, 215, 170, 0.55)');
      grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.3)');
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

let meteorTextures = null;

function initMeteorTextures() {
  if (meteorTextures || typeof document === 'undefined') return meteorTextures;

  // 1. 화염 퍼프 텍스처 (Flame Puff, 128x128) - 진한 오렌지/호박색 및 마그마 레드 결
  const flameCanvas = document.createElement('canvas');
  flameCanvas.width = 128;
  flameCanvas.height = 128;
  const fCtx = flameCanvas.getContext('2d');

  const fGrad = fCtx.createRadialGradient(64, 64, 0, 64, 64, 58);
  fGrad.addColorStop(0, 'rgba(255, 237, 213, 0.95)'); // 따뜻한 온백색 코어 (순백 플래시 억제)
  fGrad.addColorStop(0.22, 'rgba(253, 186, 116, 0.9)'); // 호박색
  fGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.85)');  // 선명한 주황
  fGrad.addColorStop(0.78, 'rgba(220, 38, 38, 0.65)'); // 깊은 마그마 레드
  fGrad.addColorStop(1, 'rgba(153, 27, 27, 0)');
  fCtx.fillStyle = fGrad;
  fCtx.beginPath();
  fCtx.arc(64, 64, 58, 0, Math.PI * 2);
  fCtx.fill();

  const flameLobes = [
    { x: 54, y: 54, r: 36, alpha: 0.55 },
    { x: 74, y: 56, r: 34, alpha: 0.5 },
    { x: 60, y: 74, r: 35, alpha: 0.45 },
    { x: 70, y: 72, r: 32, alpha: 0.4 }
  ];
  for (const l of flameLobes) {
    const lGrad = fCtx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
    lGrad.addColorStop(0, `rgba(254, 215, 170, ${l.alpha})`);
    lGrad.addColorStop(0.55, `rgba(234, 88, 12, ${l.alpha * 0.7})`);
    lGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
    fCtx.fillStyle = lGrad;
    fCtx.beginPath();
    fCtx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    fCtx.fill();
  }

  // 2. 만화풍 다층 연기 퍼프 텍스처 (Smoke Puff, 128x128) - 묵직하고 리얼한 뭉게구름 볼륨
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const sCtx = smokeCanvas.getContext('2d');

  const smokeLobes = [
    { x: 64, y: 64, r: 48, col: 'rgba(28, 25, 23, 0.92)' },
    { x: 48, y: 50, r: 36, col: 'rgba(42, 38, 36, 0.85)' },
    { x: 80, y: 52, r: 35, col: 'rgba(38, 35, 33, 0.82)' },
    { x: 52, y: 78, r: 35, col: 'rgba(52, 48, 45, 0.78)' },
    { x: 76, y: 76, r: 33, col: 'rgba(35, 32, 30, 0.8)' },
    { x: 64, y: 40, r: 32, col: 'rgba(65, 60, 56, 0.75)' }
  ];
  for (const sl of smokeLobes) {
    const sGrad = sCtx.createRadialGradient(sl.x, sl.y, sl.r * 0.15, sl.x, sl.y, sl.r);
    sGrad.addColorStop(0, sl.col);
    sGrad.addColorStop(0.7, 'rgba(78, 73, 70, 0.45)');
    sGrad.addColorStop(1, 'rgba(100, 95, 92, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.beginPath();
    sCtx.arc(sl.x, sl.y, sl.r, 0, Math.PI * 2);
    sCtx.fill();
  }

  // 3. 고열 스파크/불똥 텍스처 (Spark, 48x48) - 십자 섬광
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 48;
  sparkCanvas.height = 48;
  const spCtx = sparkCanvas.getContext('2d');

  const spGrad = spCtx.createRadialGradient(24, 24, 1, 24, 24, 20);
  spGrad.addColorStop(0, 'rgba(255, 237, 213, 0.95)');
  spGrad.addColorStop(0.35, 'rgba(251, 191, 36, 0.8)');
  spGrad.addColorStop(0.75, 'rgba(234, 88, 12, 0.4)');
  spGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
  spCtx.fillStyle = spGrad;
  spCtx.beginPath();
  spCtx.arc(24, 24, 20, 0, Math.PI * 2);
  spCtx.fill();

  spCtx.fillStyle = '#ffedd5';
  spCtx.beginPath();
  spCtx.moveTo(24, 14);
  spCtx.lineTo(26, 24);
  spCtx.lineTo(34, 24);
  spCtx.lineTo(26, 26);
  spCtx.lineTo(24, 34);
  spCtx.lineTo(22, 26);
  spCtx.lineTo(14, 24);
  spCtx.lineTo(22, 24);
  spCtx.closePath();
  spCtx.fill();

  meteorTextures = {
    flame: flameCanvas,
    smoke: smokeCanvas,
    spark: sparkCanvas
  };
  return meteorTextures;
}

function drawMeteorParticle(ctx, pt, dt) {
  const textures = initMeteorTextures();
  if (!textures) return;

  const progress = pt.life / pt.maxLife;
  if (progress >= 1) return;

  // 감속 및 연기 열기 부력
  if (pt.kind === 'smoke') {
    pt.vx *= Math.pow(0.92, dt * 60);
    pt.vy -= 16 * dt; // 서서히 위로 피어오르는 열기 부력
  } else if (pt.kind === 'flame') {
    pt.vx *= Math.pow(0.88, dt * 60);
    pt.vy *= Math.pow(0.88, dt * 60);
  } else if (pt.kind === 'spark') {
    pt.vy += 120 * dt;
    pt.vx *= Math.pow(0.92, dt * 60);
  }

  ctx.save();
  ctx.translate(pt.x, pt.y);

  if (pt.kind === 'smoke') {
    // 꼬리 끝부분의 리얼한 만화풍 뭉게구름 연기:
    // 초반에는 형태를 유지하며 적당히 팽창(1.0 -> 1.45)하여 묵직한 볼륨을 보여주고,
    // 꼬리 끝점에서 자연스럽게 페이드아웃
    pt.rot = (pt.rot || 0) + (pt.vRot || 0) * dt;
    ctx.rotate(pt.rot);
    const scale = progress < 0.4 ? 1.0 + progress * 1.1 : Math.max(0.3, 1.44 - (progress - 0.4) * 0.7);
    const currentSize = pt.baseSize * scale;
    const alpha = Math.pow(1 - progress, 1.2) * 0.85;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(
      textures.smoke,
      -currentSize * 0.5,
      -currentSize * 0.5,
      currentSize,
      currentSize
    );
  } else if (pt.kind === 'flame') {
    // 화염: 운석 암석 폭 전체를 감싸며 시작하고, 뒤로 갈수록 유선형 콘으로 수렴
    pt.rot = (pt.rot || 0) + (pt.vRot || 0) * dt;
    ctx.rotate(pt.rot);
    const scale = Math.max(0.2, (1 - progress * 0.65));
    const currentSize = pt.baseSize * scale;

    const alpha = Math.pow(1 - progress, 0.95) * 0.9;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(
      textures.flame,
      -currentSize * 0.5,
      -currentSize * 0.5,
      currentSize,
      currentSize
    );

    // 운석 바로 뒤(progress < 0.25)에서만 은은한 코어 발광 살짝 가미
    if (progress < 0.25) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.25 - progress) * 0.75;
      ctx.drawImage(
        textures.flame,
        -currentSize * 0.4,
        -currentSize * 0.4,
        currentSize * 0.8,
        currentSize * 0.8
      );
    }
  } else if (pt.kind === 'spark') {
    const alpha = Math.pow(1 - progress, 1.2) * 0.8;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'lighter';
    const sz = pt.baseSize * Math.max(0.2, 1 - progress * 0.7);
    ctx.drawImage(
      textures.spark,
      -sz * 0.5,
      -sz * 0.5,
      sz,
      sz
    );
  }

  ctx.restore();
}

function emitMeteorTrail(m, pose, dt, pool, reduced = false) {
  if (reduced || dt <= 0) return;
  m.trailClock = (m.trailClock || 0) + Math.min(0.08, dt);
  
  // 60FPS 기준 틱당 8~10개 파티클 방출 (두껍고 풍성한 꼬리 바디 유지)
  const spawnInterval = 0.0020;
  const count = Math.min(26, Math.floor(m.trailClock / spawnInterval));
  m.trailClock %= spawnInterval;
  if (count <= 0) return;

  // 파티클 풀 검사
  let meteorCount = 0;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].meteorTrail) meteorCount++;
  }
  const maxMeteorParticles = 260;
  const maxTotalParticles = 450;
  const available = Math.min(maxMeteorParticles - meteorCount, maxTotalParticles - pool.length);
  if (available <= 0) return;

  const actualCount = Math.min(count, available);
  const dx = Math.cos(pose.angle);
  const dy = Math.sin(pose.angle);
  const perpX = -dy;
  const perpY = dx;

  for (let i = 0; i < actualCount; i++) {
    const roll = Math.random();

    if (roll < 0.48) {
      // 1. 화염 퍼프 (Flame Puff)
      // 운석 암석의 외곽 전체(너비 2.0 radius)를 감싸안으며 시작하는 웅장한 볼륨감!
      const dist = pose.radius * (0.1 + Math.random() * 0.8);
      // 유선형 콘 테이퍼: 운석 바로 뒤는 운석 직경 전체(너비 1.9), 뒤로 갈수록 완만하게 좁아짐
      const taper = Math.max(0.3, 1 - dist / (pose.radius * 2.2));
      const side = (Math.random() - 0.5) * (pose.radius * 2.0) * taper;
      const speed = 45 + Math.random() * 50;
      const inwardSpeed = -side * 0.7; // 완만하게 꼬리 끝으로 모아지는 수렴 벡터
      pool.push({
        meteorTrail: true,
        kind: 'flame',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: -dx * speed + perpX * inwardSpeed,
        vy: -dy * speed + perpY * inwardSpeed,
        // 운석 지름에 필적하는 큼직한 덩어리감 (낱개 구슬 현상 완전 제거)
        baseSize: pose.radius * (1.6 + Math.random() * 0.6) * taper,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3.0,
        life: 0,
        // 운석 높이의 약 1.5배 구간까지 도달하는 수명
        maxLife: 0.20 + Math.random() * 0.08
      });
    } else if (roll < 0.88) {
      // 2. 만화풍 연기 퍼프 (Smoke Puff) - 꼬리 끝부분을 웅장하게 장식하는 리얼한 다층 연기 구름!
      // 화염의 뒤쪽(운석 뒤 0.6 ~ 1.8 radius)에서 집중 생성되어 스케치의 꼬리 끝점(운석 뒤 220~280px)까지 이어짐
      const dist = pose.radius * (0.6 + Math.random() * 1.4);
      const taper = Math.max(0.2, 1 - (dist - pose.radius * 0.6) / (pose.radius * 2.0));
      const side = (Math.random() - 0.5) * (pose.radius * 1.8) * taper;
      const speed = 35 + Math.random() * 45;
      const inwardSpeed = -side * 0.9;
      pool.push({
        meteorTrail: true,
        kind: 'smoke',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: -dx * speed + perpX * inwardSpeed,
        vy: -dy * speed + perpY * inwardSpeed - 10,
        baseSize: pose.radius * (1.4 + Math.random() * 0.5) * taper,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 2.0,
        life: 0,
        // 파란색 스케치의 상단 꼬리 끝부분까지 도달하고 자연스럽게 흩어지는 수명
        maxLife: 0.38 + Math.random() * 0.14
      });
    } else {
      // 3. 고열 스파크 (Spark/Ember)
      const dist = pose.radius * (Math.random() * 0.6);
      const side = (Math.random() - 0.5) * pose.radius * 1.2;
      const speed = 80 + Math.random() * 100;
      const spreadAngle = pose.angle + Math.PI + (Math.random() - 0.5) * 1.2;
      pool.push({
        meteorTrail: true,
        kind: 'spark',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed - 15,
        baseSize: 8 + Math.random() * 12,
        life: 0,
        maxLife: 0.12 + Math.random() * 0.08
      });
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    COMIC_METEOR_FRAME,
    getMeteorPose,
    drawComicMeteor,
    emitMeteorTrail,
    drawMeteorParticle,
    initMeteorTextures
  };
}
