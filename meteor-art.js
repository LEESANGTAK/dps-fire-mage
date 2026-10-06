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

  // 1. 화염 퍼프 텍스처 (Flame Puff, 128x128) - 과도한 순백색 떡짐 방지, 농밀한 오렌지/호박색 및 마그마 레드 결 강조
  const flameCanvas = document.createElement('canvas');
  flameCanvas.width = 128;
  flameCanvas.height = 128;
  const fCtx = flameCanvas.getContext('2d');

  const fGrad = fCtx.createRadialGradient(64, 64, 0, 64, 64, 58);
  fGrad.addColorStop(0, 'rgba(255, 237, 213, 0.95)'); // 부드러운 온백색 코어 (순백 플래시 억제)
  fGrad.addColorStop(0.2, 'rgba(253, 186, 116, 0.9)'); // 호박색
  fGrad.addColorStop(0.45, 'rgba(249, 115, 22, 0.85)'); // 선명한 주황
  fGrad.addColorStop(0.75, 'rgba(220, 38, 38, 0.6)');  // 깊은 마그마 레드
  fGrad.addColorStop(1, 'rgba(153, 27, 27, 0)');        // 외곽 투명
  fCtx.fillStyle = fGrad;
  fCtx.beginPath();
  fCtx.arc(64, 64, 58, 0, Math.PI * 2);
  fCtx.fill();

  // 만화풍 화염 덩어리감을 위한 보조 볼륨 퍼프 (주황/적색 톤)
  const flameLobes = [
    { x: 55, y: 54, r: 35, alpha: 0.5 },
    { x: 73, y: 56, r: 33, alpha: 0.45 },
    { x: 60, y: 72, r: 34, alpha: 0.4 },
    { x: 70, y: 70, r: 30, alpha: 0.35 }
  ];
  for (const l of flameLobes) {
    const lGrad = fCtx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
    lGrad.addColorStop(0, `rgba(254, 215, 170, ${l.alpha})`);
    lGrad.addColorStop(0.5, `rgba(234, 88, 12, ${l.alpha * 0.7})`);
    lGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
    fCtx.fillStyle = lGrad;
    fCtx.beginPath();
    fCtx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    fCtx.fill();
  }

  // 2. 연기 퍼프 텍스처 (Smoke Puff, 128x128) - 화염 꼬리 외곽을 잡아주는 웜 차콜 톤
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const sCtx = smokeCanvas.getContext('2d');

  const smokeLobes = [
    { x: 64, y: 64, r: 46, col: 'rgba(41, 37, 36, 0.75)' },
    { x: 50, y: 52, r: 34, col: 'rgba(55, 48, 45, 0.65)' },
    { x: 78, y: 54, r: 32, col: 'rgba(50, 44, 42, 0.65)' },
    { x: 54, y: 76, r: 32, col: 'rgba(68, 64, 60, 0.55)' },
    { x: 74, y: 74, r: 30, col: 'rgba(45, 40, 38, 0.6)' }
  ];
  for (const sl of smokeLobes) {
    const sGrad = sCtx.createRadialGradient(sl.x, sl.y, sl.r * 0.15, sl.x, sl.y, sl.r);
    sGrad.addColorStop(0, sl.col);
    sGrad.addColorStop(0.7, 'rgba(87, 83, 78, 0.3)');
    sGrad.addColorStop(1, 'rgba(120, 113, 108, 0)');
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

  // 세부 물리 감속 및 중심축 수렴
  if (pt.kind === 'smoke') {
    pt.vx *= Math.pow(0.90, dt * 60);
    pt.vy *= Math.pow(0.90, dt * 60);
  } else if (pt.kind === 'flame') {
    pt.vx *= Math.pow(0.86, dt * 60);
    pt.vy *= Math.pow(0.86, dt * 60);
  } else if (pt.kind === 'spark') {
    pt.vy += 120 * dt;
    pt.vx *= Math.pow(0.92, dt * 60);
  }

  ctx.save();
  ctx.translate(pt.x, pt.y);

  if (pt.kind === 'smoke') {
    // 연기는 뒤로 갈수록 수축하며 소멸 (유선형 테이퍼드 실루엣 유지)
    pt.rot = (pt.rot || 0) + (pt.vRot || 0) * dt;
    ctx.rotate(pt.rot);
    const scale = Math.max(0.18, 0.95 - progress * 0.75);
    const currentSize = pt.baseSize * scale;
    const alpha = Math.pow(1 - progress, 1.4) * 0.55;
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
    // 화염: 뒤로 갈수록 좁아지는 테이퍼드 콘 형태 (Scale down)
    pt.rot = (pt.rot || 0) + (pt.vRot || 0) * dt;
    ctx.rotate(pt.rot);
    const scale = Math.max(0.15, (1 - progress * 0.82) * (1 - progress * 0.25));
    const currentSize = pt.baseSize * scale;

    // 과도하게 하얗게 타지 않도록 source-over 기본 적용 (진한 오렌지/마그마 레드 불꽃 유지)
    const alpha = Math.pow(1 - progress, 1.1) * 0.85;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(
      textures.flame,
      -currentSize * 0.5,
      -currentSize * 0.5,
      currentSize,
      currentSize
    );

    // 초반 생성 순간(progress < 0.25)에만 은은한 호박색 코어 발광 살짝 가미 (화이트 클리핑 방지)
    if (progress < 0.25) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (0.25 - progress) * 0.8;
      ctx.drawImage(
        textures.flame,
        -currentSize * 0.35,
        -currentSize * 0.35,
        currentSize * 0.7,
        currentSize * 0.7
      );
    }
  } else if (pt.kind === 'spark') {
    // 날카로운 불똥
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
  
  // 60FPS 기준 틱당 6~8개 파티클 방출 (밀도 높은 화염 바디 유지)
  const spawnInterval = 0.0022;
  const count = Math.min(24, Math.floor(m.trailClock / spawnInterval));
  m.trailClock %= spawnInterval;
  if (count <= 0) return;

  // 파티클 풀 검사
  let meteorCount = 0;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].meteorTrail) meteorCount++;
  }
  const maxMeteorParticles = 200;
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

    if (roll < 0.55) {
      // 1. 화염 퍼프 (Flame Puff) - 운석 바로 뒤편에 밀착되어 유선형 콘을 형성하는 진한 주황/적색 화염
      const dist = pose.radius * (0.12 + Math.random() * 0.65);
      // 테이퍼드 콘: 운석 접촉면(Base)은 넓고, 뒤로 갈수록 중심축으로 좁아짐
      const taper = Math.max(0.2, 1 - dist / (pose.radius * 1.5));
      const side = (Math.random() - 0.5) * pose.radius * 0.85 * taper;
      const speed = 40 + Math.random() * 45;
      const inwardSpeed = -side * 2.8; // 중심축을 향해 모아지는 수렴 벡터
      pool.push({
        meteorTrail: true,
        kind: 'flame',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: -dx * speed + perpX * inwardSpeed,
        vy: -dy * speed + perpY * inwardSpeed,
        baseSize: pose.radius * (0.95 + Math.random() * 0.45) * taper,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3.0,
        life: 0,
        // 사용자 스케치 영역(약 1.5~2.0배 radius)에 맞춘 컴팩트한 수명 (0.11s ~ 0.18s)
        maxLife: 0.11 + Math.random() * 0.07
      });
    } else if (roll < 0.85) {
      // 2. 연기/음영 퍼프 (Smoke Puff) - 화염 꼬리 끝부분의 실루엣을 정돈하는 웜 차콜 톤
      const dist = pose.radius * (0.35 + Math.random() * 0.85);
      const taper = Math.max(0.15, 1 - dist / (pose.radius * 1.8));
      const side = (Math.random() - 0.5) * pose.radius * 0.75 * taper;
      const speed = 30 + Math.random() * 35;
      const inwardSpeed = -side * 2.2;
      pool.push({
        meteorTrail: true,
        kind: 'smoke',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: -dx * speed + perpX * inwardSpeed,
        vy: -dy * speed + perpY * inwardSpeed,
        baseSize: pose.radius * (0.8 + Math.random() * 0.4) * taper,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 2.0,
        life: 0,
        maxLife: 0.16 + Math.random() * 0.08
      });
    } else {
      // 3. 고열 스파크 (Spark/Ember) - 미세 불똥
      const dist = pose.radius * (Math.random() * 0.5);
      const side = (Math.random() - 0.5) * pose.radius * 0.6;
      const speed = 90 + Math.random() * 110;
      const spreadAngle = pose.angle + Math.PI + (Math.random() - 0.5) * 1.2;
      pool.push({
        meteorTrail: true,
        kind: 'spark',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed - 15,
        baseSize: 6 + Math.random() * 10,
        life: 0,
        maxLife: 0.08 + Math.random() * 0.05
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
