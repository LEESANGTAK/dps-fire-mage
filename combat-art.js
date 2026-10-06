/* ============================================================================
   combat-art.js - 화염구(Fireball/Pyroblast) 살아있는 불덩어리 파티클 & 전투 VFX
   - 둥근 초고열 플라즈마 코어 구체 (Core Sphere)
   - 소용돌이치며 굽이치는 화염 리본/혀 (Swirling Ribbon Tendrils)
   - 작열하는 몸통 화염 볼륨 퍼프 (Volumetric Flame Puffs)
   - 꼬리 끝 훈연 연기 (Smoky Tail Falloff) 및 십자 불씨 (Spark Embers)
   - 서브프레임 보간(Sub-frame Lerping) 방출로 고속 비행 시 끊김 없는 유체 손맛
   ============================================================================ */

let fireballTextures = null;

function initFireballTextures() {
  if (fireballTextures) return fireballTextures;
  if (typeof document === 'undefined') return null;

  // 1. 화염구 코어 구체 (Core Sphere, 128x128)
  // 초고열 백색 중심 + 황금빛 레몬 옐로우 + 타오르는 오렌지-적색 림 + 전면 초승달 림 아크
  const coreCanvas = document.createElement('canvas');
  coreCanvas.width = 128;
  coreCanvas.height = 128;
  const cCtx = coreCanvas.getContext('2d');

  // 외부 앰비언트 방사형 열기 글로우
  const cGlow = cCtx.createRadialGradient(64, 64, 8, 64, 64, 62);
  cGlow.addColorStop(0, 'rgba(255, 120, 20, 0.45)');
  cGlow.addColorStop(0.55, 'rgba(235, 60, 15, 0.22)');
  cGlow.addColorStop(0.85, 'rgba(180, 25, 10, 0.08)');
  cGlow.addColorStop(1, 'rgba(120, 15, 5, 0)');
  cCtx.fillStyle = cGlow;
  cCtx.beginPath();
  cCtx.arc(64, 64, 62, 0, Math.PI * 2);
  cCtx.fill();

  // 메인 고열 플라즈마 구체 본체
  const cGrad = cCtx.createRadialGradient(60, 64, 0, 64, 64, 46);
  cGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');      // 순백 고열 코어
  cGrad.addColorStop(0.18, 'rgba(255, 250, 185, 1.0)');   // 레몬 백황색
  cGrad.addColorStop(0.42, 'rgba(255, 185, 30, 0.98)');   // 선명한 황금빛
  cGrad.addColorStop(0.70, 'rgba(245, 95, 15, 0.88)');    // 고열 오렌지
  cGrad.addColorStop(0.90, 'rgba(220, 38, 38, 0.55)');    // 적색 화염 림
  cGrad.addColorStop(1, 'rgba(160, 20, 10, 0)');
  cCtx.fillStyle = cGrad;
  cCtx.beginPath();
  cCtx.arc(64, 64, 46, 0, Math.PI * 2);
  cCtx.fill();

  // 전면 진행 방향(+X)으로 향하는 림 라이트 / 압축 초승달 충격파 하이라이트
  // 첨부 이미지의 구체 앞쪽에 나타나는 눈부신 초승달 림 아크!
  cCtx.save();
  cCtx.globalCompositeOperation = 'lighter';
  const rimGrad = cCtx.createRadialGradient(82, 64, 2, 78, 64, 28);
  rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  rimGrad.addColorStop(0.35, 'rgba(255, 240, 150, 0.80)');
  rimGrad.addColorStop(0.70, 'rgba(255, 130, 20, 0.35)');
  rimGrad.addColorStop(1, 'rgba(235, 50, 10, 0)');
  cCtx.fillStyle = rimGrad;
  cCtx.beginPath();
  cCtx.arc(70, 64, 28, -Math.PI * 0.52, Math.PI * 0.52);
  cCtx.closePath();
  cCtx.fill();
  cCtx.restore();

  // 2. 소용돌이치는 불꽃 리본/혀 (Tendril A & B, 128x128)
  // 첨부 이미지(media_1791276621800.png)의 시그니처인 우아하게 휘어지는 화염 리본 가닥!
  function createTendrilCanvas(flip) {
    const tCanvas = document.createElement('canvas');
    tCanvas.width = 128;
    tCanvas.height = 128;
    const tCtx = tCanvas.getContext('2d');
    const sy = flip ? -1 : 1;

    tCtx.save();
    tCtx.translate(64, 64);

    // 1단계: 넓고 부드러운 외부 오렌지-적색 화염 페더링 (Flame Body Feather)
    tCtx.beginPath();
    tCtx.moveTo(-46, 12 * sy);
    tCtx.bezierCurveTo(-15, -18 * sy, 12, -45 * sy, 44, -28 * sy);
    tCtx.strokeStyle = 'rgba(235, 75, 15, 0.45)';
    tCtx.lineWidth = 24;
    tCtx.lineCap = 'round';
    tCtx.stroke();

    // 2단계: 중간 오렌지-골드 화염 바디
    tCtx.beginPath();
    tCtx.moveTo(-44, 11 * sy);
    tCtx.bezierCurveTo(-15, -18 * sy, 12, -44 * sy, 42, -27 * sy);
    tCtx.strokeStyle = 'rgba(255, 145, 25, 0.72)';
    tCtx.lineWidth = 13;
    tCtx.lineCap = 'round';
    tCtx.stroke();

    // 3단계: 선명한 황금빛 불꽃 혀 척추선 (Golden Flame Ribbon Core)
    tCtx.globalCompositeOperation = 'lighter';
    tCtx.beginPath();
    tCtx.moveTo(-42, 10 * sy);
    tCtx.bezierCurveTo(-14, -17 * sy, 11, -42 * sy, 39, -26 * sy);
    tCtx.strokeStyle = 'rgba(255, 215, 60, 0.92)';
    tCtx.lineWidth = 5.5;
    tCtx.lineCap = 'round';
    tCtx.stroke();

    // 4단계: 초고열 백열 척추 하이라이트 (White-hot Spine Filament)
    tCtx.beginPath();
    tCtx.moveTo(-40, 9 * sy);
    tCtx.bezierCurveTo(-14, -17 * sy, 11, -41 * sy, 36, -25 * sy);
    tCtx.strokeStyle = 'rgba(255, 255, 245, 0.98)';
    tCtx.lineWidth = 2.2;
    tCtx.lineCap = 'round';
    tCtx.stroke();

    tCtx.restore();
    return tCanvas;
  }

  const tendrilACanvas = createTendrilCanvas(false);
  const tendrilBCanvas = createTendrilCanvas(true);

  // 3. 화염 볼륨 퍼프 (Flame Puff, 128x128)
  // 코어 바로 뒤에서 꼬리 중간까지를 채우는 풍성한 가산 발광 화염 볼륨
  const puffCanvas = document.createElement('canvas');
  puffCanvas.width = 128;
  puffCanvas.height = 128;
  const pCtx = puffCanvas.getContext('2d');

  const pGrad = pCtx.createRadialGradient(64, 64, 0, 64, 64, 54);
  pGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  pGrad.addColorStop(0.24, 'rgba(255, 220, 80, 0.92)');
  pGrad.addColorStop(0.52, 'rgba(249, 115, 22, 0.80)');
  pGrad.addColorStop(0.80, 'rgba(220, 38, 38, 0.40)');
  pGrad.addColorStop(1, 'rgba(180, 20, 10, 0)');
  pCtx.fillStyle = pGrad;
  pCtx.beginPath();
  pCtx.arc(64, 64, 54, 0, Math.PI * 2);
  pCtx.fill();

  // 유기적인 화염 덩어리를 위한 보조 로브
  const puffLobes = [
    { x: 54, y: 56, r: 34, a: 0.6 },
    { x: 74, y: 58, r: 32, a: 0.55 },
    { x: 60, y: 72, r: 35, a: 0.5 },
    { x: 70, y: 70, r: 30, a: 0.45 }
  ];
  for (const pl of puffLobes) {
    const plGrad = pCtx.createRadialGradient(pl.x, pl.y, 2, pl.x, pl.y, pl.r);
    plGrad.addColorStop(0, `rgba(255, 240, 160, ${pl.a})`);
    plGrad.addColorStop(0.55, `rgba(251, 146, 60, ${pl.a * 0.7})`);
    plGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    pCtx.fillStyle = plGrad;
    pCtx.beginPath();
    pCtx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
    pCtx.fill();
  }

  // 4. 꼬리 끝 훈연/연기 퍼프 (Smoke Tail, 128x128)
  // 첨부 이미지의 꼬리 끝부분에 나타나는 짙은 적갈색 연기 실루엣
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const sCtx = smokeCanvas.getContext('2d');

  const sLobes = [
    { x: 64, y: 64, r: 46, col: 'rgba(55, 22, 18, 0.85)' },
    { x: 48, y: 52, r: 35, col: 'rgba(70, 28, 22, 0.75)' },
    { x: 80, y: 54, r: 33, col: 'rgba(65, 25, 20, 0.72)' },
    { x: 54, y: 76, r: 34, col: 'rgba(50, 18, 16, 0.70)' },
    { x: 74, y: 74, r: 32, col: 'rgba(45, 16, 14, 0.75)' }
  ];
  for (const sl of sLobes) {
    const sGrad = sCtx.createRadialGradient(sl.x, sl.y, sl.r * 0.15, sl.x, sl.y, sl.r);
    sGrad.addColorStop(0, sl.col);
    sGrad.addColorStop(0.7, 'rgba(85, 32, 25, 0.35)');
    sGrad.addColorStop(1, 'rgba(100, 35, 25, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.beginPath();
    sCtx.arc(sl.x, sl.y, sl.r, 0, Math.PI * 2);
    sCtx.fill();
  }

  // 5. 십자 섬광 불씨/스파크 (Spark Glint, 48x48)
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.width = 48;
  sparkCanvas.height = 48;
  const spCtx = sparkCanvas.getContext('2d');

  const spGrad = spCtx.createRadialGradient(24, 24, 1, 24, 24, 22);
  spGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  spGrad.addColorStop(0.28, 'rgba(255, 235, 140, 0.95)');
  spGrad.addColorStop(0.65, 'rgba(249, 115, 22, 0.55)');
  spGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
  spCtx.fillStyle = spGrad;
  spCtx.beginPath();
  spCtx.arc(24, 24, 22, 0, Math.PI * 2);
  spCtx.fill();

  spCtx.fillStyle = '#ffffff';
  spCtx.beginPath();
  spCtx.moveTo(24, 12);
  spCtx.lineTo(26, 24);
  spCtx.lineTo(36, 24);
  spCtx.lineTo(26, 26);
  spCtx.lineTo(24, 36);
  spCtx.lineTo(22, 26);
  spCtx.lineTo(12, 24);
  spCtx.lineTo(22, 24);
  spCtx.closePath();
  spCtx.fill();

  fireballTextures = {
    core: coreCanvas,
    tendrilA: tendrilACanvas,
    tendrilB: tendrilBCanvas,
    puff: puffCanvas,
    smoke: smokeCanvas,
    spark: sparkCanvas
  };
  return fireballTextures;
}

// ----------------------------------------------------------------------------
// 투사체 헤드(앞머리) 렌더링 - 둥근 초고열 플라즈마 구체 및 전면 압축 림 아크
// ----------------------------------------------------------------------------
function drawComicProjectile(painter, projectile, x, y, progress) {
  const textures = initFireballTextures();
  if (!textures) return;

  const heavy = projectile.type === 'pyroblast';
  const headRadius = projectile.radius * (heavy ? 1.5 : 1.25);
  const dx = projectile.targetX - projectile.startX;
  const dy = projectile.targetY - projectile.startY;
  const arcHeight = -20;
  const dArc = Math.cos(progress * Math.PI) * Math.PI * arcHeight;
  const tangent = Math.atan2(dy + dArc, dx);

  painter.save();
  painter.translate(x, y);
  painter.rotate(tangent);

  // 스쿼시 & 스트레치 (비행 방향으로 살짝 늘어나고, 고열 펄스 진동)
  const pulse = 1 + Math.sin(progress * 38) * 0.045;
  painter.scale(1.12 * pulse, 0.90 * pulse);

  // 1. 헤드 직후의 화염 넥 (Teardrop Connector)
  // 파티클과 코어 사이의 이음새를 완전히 메워 매끄러운 눈물방울 실루엣 형성
  painter.save();
  painter.globalCompositeOperation = 'lighter';
  painter.globalAlpha = 0.88;
  const neckSize1 = headRadius * 1.6;
  painter.drawImage(textures.puff, -headRadius * 0.5 - neckSize1 * 0.5, -neckSize1 * 0.5, neckSize1, neckSize1);
  painter.globalAlpha = 0.65;
  const neckSize2 = headRadius * 1.3;
  painter.drawImage(textures.puff, -headRadius * 0.9 - neckSize2 * 0.5, -neckSize2 * 0.5, neckSize2, neckSize2);
  painter.restore();

  // 2. 초고열 구체형 코어 (Spherical Plasma Core)
  const coreSize = headRadius * 2.3;
  painter.drawImage(
    textures.core,
    -coreSize * 0.52,
    -coreSize * 0.5,
    coreSize,
    coreSize
  );

  painter.restore();
}

// ----------------------------------------------------------------------------
// 투사체 궤적 파티클 방출 - 서브프레임 보간으로 끊김 없는 유체 꼬리 생성
// ----------------------------------------------------------------------------
function emitComicTrail(projectile, x, y, dt, pool, reduced) {
  if (reduced) return;
  const heavy = projectile.type === 'pyroblast';
  const headRadius = projectile.radius * (heavy ? 1.5 : 1.25);

  const prevX = projectile.trailX ?? x;
  const prevY = projectile.trailY ?? y;
  projectile.trailX = x;
  projectile.trailY = y;

  const dx = x - prevX;
  const dy = y - prevY;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return;

  const moveAngle = Math.atan2(dy, dx);
  const backAngle = moveAngle + Math.PI;
  const perpX = -Math.sin(moveAngle);
  const perpY = Math.cos(moveAngle);

  // 파티클 풀 상한 검사 (프레임 드랍 방지 최적화)
  let activeCount = 0;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].fireballTrail || pool[i].comicTrail) activeCount++;
  }
  const maxParticles = heavy ? 160 : 120;
  if (activeCount >= maxParticles) return;

  // 서브프레임 보간 (Sub-frame Lerping)
  // 고속 비행 시 점선처럼 끊기지 않도록 7~10px 간격으로 촘촘히 보간
  const stepSize = heavy ? 10.5 : 8.0;
  const steps = Math.min(8, Math.max(2, Math.ceil(dist / stepSize)));

  // 레이어링 보장: 배경 연기(Smoke) -> 화염 퍼프(Puff) -> 소용돌이 리본(Tendril) -> 불씨(Spark)
  const smokeBatch = [];
  const puffBatch = [];
  const tendrilBatch = [];
  const sparkBatch = [];

  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const px = prevX + dx * t;
    const py = prevY + dy * t;

    // 1. 꼬리 끝 훈연 연기 (Smoke Tail Falloff)
    if (s % 2 === 0) {
      const smokeOffset = (Math.random() - 0.5) * headRadius * 0.6;
      smokeBatch.push({
        fireballTrail: true,
        kind: 'smoke',
        x: px + perpX * smokeOffset - Math.cos(moveAngle) * headRadius * 0.5,
        y: py + perpY * smokeOffset - Math.sin(moveAngle) * headRadius * 0.5,
        vx: Math.cos(backAngle) * 30 + (Math.random() - 0.5) * 15,
        vy: Math.sin(backAngle) * 30 - 15 + (Math.random() - 0.5) * 15,
        baseSize: headRadius * (heavy ? 2.4 : 1.9) * (0.95 + Math.random() * 0.35),
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 2.0,
        life: 0,
        maxLife: (heavy ? 0.25 : 0.20) + Math.random() * 0.06
      });
    }

    // 2. 화염 볼륨 퍼프 (Flame Puff) - 몸통을 가득 채우는 고열 화염
    const puffOffset = (Math.random() - 0.5) * headRadius * 0.35;
    puffBatch.push({
      fireballTrail: true,
      kind: 'puff',
      x: px + perpX * puffOffset - Math.cos(moveAngle) * headRadius * 0.25,
      y: py + perpY * puffOffset - Math.sin(moveAngle) * headRadius * 0.25,
      vx: Math.cos(backAngle) * (40 + Math.random() * 45) - perpX * puffOffset * 2.5,
      vy: Math.sin(backAngle) * (40 + Math.random() * 45) - perpY * puffOffset * 2.5,
      baseSize: headRadius * (heavy ? 2.1 : 1.85) * (0.85 + Math.random() * 0.35),
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 3.5,
      life: 0,
      maxLife: (heavy ? 0.20 : 0.16) + Math.random() * 0.05
    });

    // 3. 소용돌이치는 불꽃 혀/리본 (Tendril Ribbon) - 첨부 이미지의 시그니처 연출!
    projectile.tendrilPhase = (projectile.tendrilPhase || 0) + 1;
    const side = (projectile.tendrilPhase % 2 === 0) ? 1 : -1;
    const sideOffset = side * headRadius * (0.35 + Math.random() * 0.45);
    const tendrilAngle = backAngle + side * (0.22 + Math.random() * 0.35);
    const recoilSpeed = 50 + Math.random() * 55;

    tendrilBatch.push({
      fireballTrail: true,
      kind: 'tendril',
      variant: Math.random() < 0.5 ? 'tendrilA' : 'tendrilB',
      x: px + perpX * sideOffset,
      y: py + perpY * sideOffset,
      vx: Math.cos(backAngle) * recoilSpeed + perpX * (-side * 18),
      vy: Math.sin(backAngle) * recoilSpeed + perpY * (-side * 18),
      baseSize: headRadius * (heavy ? 2.6 : 2.2) * (0.9 + Math.random() * 0.3),
      rot: tendrilAngle,
      vRot: side * (2.2 + Math.random() * 3.0),
      life: 0,
      maxLife: (heavy ? 0.22 : 0.18) + Math.random() * 0.06
    });

    // 4. 고열 불씨/스파크 (Sparks)
    if (Math.random() < 0.55) {
      const sparkAngle = backAngle + (Math.random() - 0.5) * 1.6;
      const sparkSpeed = 70 + Math.random() * 110;
      sparkBatch.push({
        fireballTrail: true,
        kind: 'spark',
        x: px + (Math.random() - 0.5) * 6,
        y: py + (Math.random() - 0.5) * 6,
        vx: Math.cos(sparkAngle) * sparkSpeed,
        vy: Math.sin(sparkAngle) * sparkSpeed,
        baseSize: (heavy ? 12 : 9) * (0.7 + Math.random() * 0.6),
        life: 0,
        maxLife: 0.13 + Math.random() * 0.08
      });
    }
  }

  // 순서대로 push하여 올바른 렌더링 계층 형성
  for (let i = 0; i < smokeBatch.length; i++) pool.push(smokeBatch[i]);
  for (let i = 0; i < puffBatch.length; i++) pool.push(puffBatch[i]);
  for (let i = 0; i < tendrilBatch.length; i++) pool.push(tendrilBatch[i]);
  for (let i = 0; i < sparkBatch.length; i++) pool.push(sparkBatch[i]);
}

// ----------------------------------------------------------------------------
// 화염구 트레일 파티클 렌더링 (game.js의 updateAndDrawVfx에서 호출)
// ----------------------------------------------------------------------------
function drawFireballParticle(ctx, pt, dt) {
  const textures = initFireballTextures();
  if (!textures) return;

  const progress = pt.life / pt.maxLife;
  if (progress >= 1) return;

  // 감속 및 열기 부력 (game.js에서 위치 이동은 이미 수행되었으므로 속도만 감속)
  pt.vx *= Math.pow(0.86, dt * 60);
  pt.vy *= Math.pow(0.86, dt * 60);
  if (pt.kind === 'smoke') {
    pt.vy -= 18 * dt; // 연기 열기 상승
  } else if (pt.kind === 'spark') {
    pt.vy += 45 * dt; // 중력 낙하
  }

  pt.rot = (pt.rot || 0) + (pt.vRot || 0) * dt;

  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.rotate(pt.rot);

  if (pt.kind === 'smoke') {
    // 꼬리 끝의 짙은 적갈색 연기 실루엣 (source-over)
    const scale = 0.85 + progress * 0.95;
    const sz = pt.baseSize * scale;
    const alpha = Math.pow(1 - progress, 1.25) * 0.75;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(textures.smoke, -sz * 0.5, -sz * 0.5, sz, sz);
  } else if (pt.kind === 'puff') {
    // 화염 볼륨 퍼프 (lighter 가산 혼합)
    const scale = progress < 0.2 ? (0.8 + progress * 1.5) : Math.max(0.3, 1.1 - (progress - 0.2) * 0.9);
    const sz = pt.baseSize * scale;
    const alpha = progress < 0.4 ? 0.95 : ((1 - progress) / 0.6) * 0.95;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(textures.puff, -sz * 0.5, -sz * 0.5, sz, sz);
  } else if (pt.kind === 'tendril') {
    // 소용돌이치는 불꽃 리본 (lighter 가산 혼합)
    const scale = progress < 0.25 ? (0.9 + progress * 0.8) : Math.max(0.35, 1.1 - (progress - 0.25) * 0.85);
    const sz = pt.baseSize * scale;
    const alpha = progress < 0.45 ? 0.95 : ((1 - progress) / 0.55) * 0.95;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'lighter';
    const tex = textures[pt.variant] || textures.tendrilA;
    ctx.drawImage(tex, -sz * 0.5, -sz * 0.5, sz, sz);
  } else if (pt.kind === 'spark') {
    // 십자 고열 불씨
    const scale = 1 - progress * 0.55;
    const sz = pt.baseSize * scale;
    const alpha = Math.pow(1 - progress, 1.1);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(textures.spark, -sz * 0.5, -sz * 0.5, sz, sz);
  } else {
    // 하위 호환 단색 파티클
    const alpha = 1 - progress;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.colorCore || '#fde047';
    ctx.beginPath();
    ctx.arc(0, 0, (pt.radius || 3) * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 슬라임 점액 스플래시 (기존 기능 보존)
// ----------------------------------------------------------------------------
let lastSlimeSplashAt = -Infinity;
function spawnSlimeSplash(pool, x, y, groundY, blue, strong, now, reduced, bounds = null) {
  if (reduced || now - lastSlimeSplashAt < (strong ? 0.055 : 0.09)) return;
  lastSlimeSplashAt = now;
  const available = Math.max(0, 48 - pool.filter(p => p.slimeDrop).length);
  const count = Math.min(available, strong ? 11 : 5);
  const size = bounds ? bounds.width : 180;
  const left = bounds ? bounds.x : x - size * 0.5;
  const top = bounds ? bounds.y : groundY - size * 0.875;
  const outlets = [[0.31,0.43,-1],[0.67,0.43,1],[0.27,0.58,-1],[0.73,0.58,1],[0.225,0.73,-1],[0.855,0.73,1]];
  const scale = size / 220;
  for (let i = 0; i < count; i++) {
    const [u, v, side] = outlets[i % outlets.length];
    pool.push({
      slimeDrop: true,
      x: left + u * size + side * Math.random() * 4 * scale,
      y: top + v * size + (Math.random() - 0.5) * 5 * scale,
      vx: side * (100 + Math.random() * (strong ? 120 : 65)) * scale,
      vy: -(45 + Math.random() * (strong ? 110 : 75)) * scale, groundY,
      radius: ((strong ? 3.5 : 2.5) + Math.random() * 3) * scale,
      life: 0, maxLife: 0.48 + Math.random() * 0.15,
      colorCore: blue ? '#8ee3e8' : '#d1ed75', colorEdge: blue ? '#448fbb' : '#84a33b'
    });
  }
}

function drawSlimeDrop(painter, drop, dt) {
  drop.vx *= Math.exp(-2.8 * dt);
  drop.vy += 600 * dt;
  const landed = drop.y >= drop.groundY - drop.radius;
  if (landed) {
    drop.y = drop.groundY - 1; drop.vx *= Math.exp(-18 * dt); drop.vy = 0;
    drop.maxLife = Math.min(drop.maxLife, drop.life + 0.12);
  }
  const alpha = Math.min(1, (drop.maxLife - drop.life) / 0.15);
  const stretch = landed ? 0.35 : Math.min(1.7, 1 + Math.abs(drop.vy) / 300);
  painter.save(); painter.translate(drop.x, drop.y);
  if (!landed) painter.rotate(Math.atan2(drop.vy, drop.vx) - Math.PI / 2);
  painter.globalAlpha = alpha;
  painter.beginPath(); painter.ellipse(0, 0, drop.radius / stretch, drop.radius * stretch, 0, 0, Math.PI * 2);
  painter.fillStyle = drop.colorEdge; painter.fill();
  painter.strokeStyle = '#292231'; painter.lineWidth = 1.2; painter.stroke();
  painter.beginPath(); painter.ellipse(-drop.radius * 0.2, -drop.radius * 0.3, drop.radius * 0.3, drop.radius * 0.45, 0, 0, Math.PI * 2);
  painter.fillStyle = drop.colorCore; painter.fill(); painter.restore();
}

if (typeof window !== 'undefined') {
  window.initFireballTextures = initFireballTextures;
  window.drawComicProjectile = drawComicProjectile;
  window.emitComicTrail = emitComicTrail;
  window.drawFireballParticle = drawFireballParticle;
  window.spawnSlimeSplash = spawnSlimeSplash;
  window.drawSlimeDrop = drawSlimeDrop;
}

if (typeof module !== 'undefined') {
  module.exports = {
    initFireballTextures,
    drawComicProjectile,
    emitComicTrail,
    drawFireballParticle,
    spawnSlimeSplash,
    drawSlimeDrop
  };
}
