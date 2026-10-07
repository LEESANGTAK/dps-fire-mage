/* 운석은 진행 방향으로 암석을 앞세우고, 화염만 뒤에 남깁니다. */
const comicMeteor=typeof Image!=='undefined'?new Image():null;
if(comicMeteor)comicMeteor.src='assets/art/comic-meteor.png';
// 생성 원화의 투명 여백과 암석 중심은 검토 후 설정합니다. (1024x1024 정중앙 앵커)
const COMIC_METEOR_FRAME = { x: 0, y: 0, w: 1024, h: 1024, anchor: 0.5, anchorY: 0.5 };

function getMeteorPose(m, progress = m.progress) {
  const p = Math.max(0, Math.min(1, progress));
  // 디즈니 12원칙 가속 낙하 이징: 초반 완만한 진입 -> 중력 가속도로 지면 급속 내리꽂힘 (불연속 점프 없는 매끄러운 단일 이징)
  const travel = Math.pow(p, 1.85);
  const dx = m.targetX - m.startX;
  const dy = m.targetY - m.startY;
  // 원근감(Perspective Depth): 저 멀리 높은 대기권(작음 0.52배)에서 지면 충돌 순간 거대화(1.4배) (초기 0 깜빡임 제거)
  const scale = 0.52 + 0.88 * Math.pow(p, 1.6);
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
    // 1. 대기권 돌입 압축 마그마 림 라이팅 (운석 전면부 고열 연소 압축 광채)
    if (pose.progress > 0.3) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flareAlpha = Math.min(0.48, (pose.progress - 0.3) * 0.95);
      ctx.globalAlpha = flareAlpha;
      const glowR = pose.radius * 1.4;
      const grad = ctx.createRadialGradient ? ctx.createRadialGradient(0, 0, glowR * 0.15, 0, 0, glowR) : null;
      if (grad && grad.addColorStop) {
        grad.addColorStop(0, 'rgba(255, 237, 213, 0.7)');
        grad.addColorStop(0.35, 'rgba(251, 146, 60, 0.45)');
        grad.addColorStop(0.7, 'rgba(234, 88, 12, 0.2)');
        grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, glowR, 0, Math.PI * 2);
        ctx.fill();
      }
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

  // 1. 화염 퍼프 텍스처 (Flame Puff, 128x128) - 첨부 이미지의 찬란한 백황색 코어 및 선명한 주황-적색 림
  const flameCanvas = document.createElement('canvas');
  flameCanvas.width = 128;
  flameCanvas.height = 128;
  const fCtx = flameCanvas.getContext('2d');

  const fGrad = fCtx.createRadialGradient(64, 64, 0, 64, 64, 58);
  fGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');      // 순백 고열 코어
  fGrad.addColorStop(0.22, 'rgba(254, 240, 138, 0.95)'); // 선명한 황금빛 백황색
  fGrad.addColorStop(0.52, 'rgba(249, 115, 22, 0.85)');  // 고열 오렌지
  fGrad.addColorStop(0.8, 'rgba(220, 38, 38, 0.45)');   // 붉은 화염 림
  fGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
  fCtx.fillStyle = fGrad;
  fCtx.beginPath();
  fCtx.arc(64, 64, 58, 0, Math.PI * 2);
  fCtx.fill();

  // 만화풍 화염 볼륨을 위한 보조 고열 퍼프
  const flameLobes = [
    { x: 55, y: 54, r: 36, alpha: 0.55 },
    { x: 73, y: 56, r: 34, alpha: 0.5 },
    { x: 60, y: 74, r: 35, alpha: 0.45 },
    { x: 70, y: 72, r: 32, alpha: 0.4 }
  ];
  for (const l of flameLobes) {
    const lGrad = fCtx.createRadialGradient(l.x, l.y, 2, l.x, l.y, l.r);
    lGrad.addColorStop(0, `rgba(255, 247, 237, ${l.alpha})`);
    lGrad.addColorStop(0.55, `rgba(251, 146, 60, ${l.alpha * 0.65})`);
    lGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
    fCtx.fillStyle = lGrad;
    fCtx.beginPath();
    fCtx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    fCtx.fill();
  }

  // 2. 만화풍 다층 연기 퍼프 텍스처 (Smoke Puff, 128x128) - 화염 뒤에 든든하게 깔리는 짙은 차콜 구름
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 128;
  smokeCanvas.height = 128;
  const sCtx = smokeCanvas.getContext('2d');

  const smokeLobes = [
    { x: 64, y: 64, r: 48, col: 'rgba(26, 24, 22, 0.90)' },
    { x: 48, y: 50, r: 36, col: 'rgba(41, 37, 36, 0.82)' },
    { x: 80, y: 52, r: 34, col: 'rgba(38, 35, 34, 0.80)' },
    { x: 52, y: 78, r: 35, col: 'rgba(50, 46, 44, 0.76)' },
    { x: 76, y: 76, r: 33, col: 'rgba(32, 29, 27, 0.78)' },
    { x: 64, y: 40, r: 30, col: 'rgba(68, 64, 60, 0.72)' }
  ];
  for (const sl of smokeLobes) {
    const sGrad = sCtx.createRadialGradient(sl.x, sl.y, sl.r * 0.15, sl.x, sl.y, sl.r);
    sGrad.addColorStop(0, sl.col);
    sGrad.addColorStop(0.7, 'rgba(75, 70, 68, 0.40)');
    sGrad.addColorStop(1, 'rgba(90, 85, 82, 0)');
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

  const spGrad = spCtx.createRadialGradient(24, 24, 1, 24, 24, 22);
  spGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  spGrad.addColorStop(0.28, 'rgba(254, 240, 138, 0.95)');
  spGrad.addColorStop(0.65, 'rgba(249, 115, 22, 0.55)');
  spGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
  spCtx.fillStyle = spGrad;
  spCtx.beginPath();
  spCtx.arc(24, 24, 22, 0, Math.PI * 2);
  spCtx.fill();

  spCtx.fillStyle = '#ffffff';
  spCtx.beginPath();
  spCtx.moveTo(24, 13);
  spCtx.lineTo(26, 24);
  spCtx.lineTo(35, 24);
  spCtx.lineTo(26, 26);
  spCtx.lineTo(24, 35);
  spCtx.lineTo(22, 26);
  spCtx.lineTo(13, 24);
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

  // 감속 및 연기 부력
  if (pt.kind === 'smoke') {
    pt.vx *= Math.pow(0.92, dt * 60);
    pt.vy -= 18 * dt; // 위쪽으로 피어오르는 열기 부력
  } else if (pt.kind === 'flame') {
    pt.vx *= Math.pow(0.88, dt * 60);
    pt.vy *= Math.pow(0.88, dt * 60);
  } else if (pt.kind === 'spark') {
    pt.vy += 140 * dt;
    pt.vx *= Math.pow(0.94, dt * 60);
  }

  ctx.save();
  ctx.translate(pt.x, pt.y);

  if (pt.kind === 'smoke') {
    // 배경에 깔리는 짙은 묵직한 연기 구름 (source-over)
    pt.rot = (pt.rot || 0) + (pt.vRot || 0) * dt;
    ctx.rotate(pt.rot);
    const scale = 1.0 + progress * 0.85;
    const currentSize = pt.baseSize * scale;
    const alpha = Math.pow(1 - progress, 1.25) * 0.85;
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
    // 첨부 이미지의 그 찬란하고 선명한 고열 가산 발광(lighter) 화염 복원!
    pt.rot = (pt.rot || 0) + (pt.vRot || 0) * dt;
    ctx.rotate(pt.rot);
    const scale = progress < 0.25 ? 1.0 + progress * 0.45 : Math.max(0.35, 1.12 - (progress - 0.25) * 0.9);
    const currentSize = pt.baseSize * scale;
    const alpha = progress < 0.65 ? 0.95 : ((1 - progress) / 0.35) * 0.95;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(
      textures.flame,
      -currentSize * 0.5,
      -currentSize * 0.5,
      currentSize,
      currentSize
    );
  } else if (pt.kind === 'spark') {
    const alpha = Math.pow(1 - progress, 1.1);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = 'lighter';
    const sz = pt.baseSize * (1 - progress * 0.45);
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

function emitMeteorTrail(m, pose, dt, pool, reduced = false, activeMeteorCount = 1) {
  if (reduced || dt <= 0) return;
  // 가장 긴 연기 수명까지 고려하여 동시 낙하 전체가 꼬리 예산을 나눕니다.
  const spawnInterval = Math.max(0.008, Math.max(1, activeMeteorCount) * 0.52 / 200);
  m.trailClock = (m.trailClock ?? spawnInterval) + Math.min(0.08, dt);
  
  // 프레임당 최대 두 개만 생성하며, 밀집 시 생성 간격을 늘립니다.
  const count = Math.min(2, Math.floor(m.trailClock / spawnInterval));
  m.trailClock %= spawnInterval;
  if (count <= 0) return;

  // 파티클 풀 검사
  let meteorCount = 0;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].meteorTrail) meteorCount++;
  }
  const maxMeteorParticles = 260;
  const maxTotalParticles = 450;
  let available = Math.min(maxMeteorParticles - meteorCount, maxTotalParticles - pool.length);

  // 연속 메테오 시 파티클이 끊기지 않도록: 꼬리 파티클이 차있을 때 가장 오래된 꼬리 파티클을 재활용
  if (available < count && meteorCount > 0) {
    const toFree = Math.min(count, meteorCount);
    let removed = 0;
    // 1차: 방금 생성된 파티클의 조기 삭제(증발)를 방지하기 위해, 충분히 성숙한(수명 45% 이상 지난) 오래된 꼬리 파티클부터 교체
    for (let i = 0; i < pool.length && removed < toFree; i++) {
      const pt = pool[i];
      if (pt.meteorTrail && typeof pt.life === 'number' && typeof pt.maxLife === 'number' && (pt.life >= 0.12 || pt.life / pt.maxLife >= 0.45)) {
        pool.splice(i, 1);
        i--;
        removed++;
      }
    }
    // 어린 꼬리는 다른 운석의 방출 때문에 삭제하지 않습니다.
    meteorCount -= removed;
    available = Math.min(count, Math.min(maxMeteorParticles - meteorCount, maxTotalParticles - pool.length));
  }

  // 전체 풀이 차면 일반 입자의 나이와 무관하게 공간을 확보합니다.
  // 고속 화염구가 매 프레임 새 입자를 채워도 운석 꼬리는 생성되어야 합니다.
  if (available < count && pool.length + count > maxTotalParticles) {
    // 새 꼬리 자리뿐 아니라 다른 방출기가 쌓은 전체 초과분까지 비웁니다.
    const need = Math.max(0, pool.length + count - maxTotalParticles);
    let freed = 0;
    for (let i = 0; i < pool.length && freed < need && pool.length + count > maxTotalParticles; i++) {
      const pt = pool[i];
      if (!pt.meteorTrail) {
        pool.splice(i, 1);
        i--;
        freed++;
      }
    }
    available = Math.min(count, Math.min(maxMeteorParticles - meteorCount, maxTotalParticles - pool.length));
  }
  if (available <= 0) return;

  const actualCount = Math.min(count, available);
  const dx = Math.cos(pose.angle);
  const dy = Math.sin(pose.angle);
  const perpX = -dy;
  const perpY = dx;

  // 레이어링 보장: 배경에 깔리는 연기(Smoke)를 먼저 push하고, 그 위에 화염(Flame)을 push
  const smokeBatch = [];
  const flameBatch = [];
  const sparkBatch = [];

  for (let i = 0; i < actualCount; i++) {
    // 첫 입자와 매 두 번째 입자는 연기: 난수에 따른 연기 누락을 막습니다.
    const emissionIndex = m.trailEmissionIndex || 0;
    m.trailEmissionIndex = emissionIndex + 1;
    const roll = emissionIndex % 2 === 0 ? 0 : 0.45 + Math.random() * 0.55;

    if (roll < 0.45) {
      // 1. 연기 퍼프 (Smoke Puff) - 화염 뒤에 든든하게 깔려 첨부 이미지의 대비를 만드는 검은 연기
      const dist = pose.radius * (0.5 + Math.random() * 1.5);
      const taper = Math.max(0.25, 1 - (dist - pose.radius * 0.5) / (pose.radius * 2.2));
      const side = (Math.random() - 0.5) * (pose.radius * 1.8) * taper;
      const speed = 35 + Math.random() * 45;
      const inwardSpeed = -side * 0.8;
      smokeBatch.push({
        meteorTrail: true,
        kind: 'smoke',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: -dx * speed + perpX * inwardSpeed,
        vy: -dy * speed + perpY * inwardSpeed - 12,
        baseSize: pose.radius * (1.3 + Math.random() * 0.5) * taper,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 2.2,
        life: 0,
        maxLife: 0.38 + Math.random() * 0.14
      });
    } else if (roll < 0.90) {
      // 2. 화염 퍼프 (Flame Puff) - 첨부 이미지처럼 검은 연기 위에서 눈부시게 빛나는 황금빛/주황 가산 발광 화염
      const dist = pose.radius * (0.12 + Math.random() * 0.85);
      const taper = Math.max(0.3, 1 - dist / (pose.radius * 2.2));
      const side = (Math.random() - 0.5) * (pose.radius * 1.9) * taper;
      const speed = 45 + Math.random() * 50;
      const inwardSpeed = -side * 0.7;
      flameBatch.push({
        meteorTrail: true,
        kind: 'flame',
        x: pose.x - dx * dist + perpX * side,
        y: pose.y - dy * dist + perpY * side,
        vx: -dx * speed + perpX * inwardSpeed,
        vy: -dy * speed + perpY * inwardSpeed,
        baseSize: pose.radius * (1.5 + Math.random() * 0.5) * taper,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3.2,
        life: 0,
        maxLife: 0.22 + Math.random() * 0.08
      });
    } else {
      // 3. 고열 스파크 (Spark/Ember)
      const dist = pose.radius * (Math.random() * 0.6);
      const side = (Math.random() - 0.5) * pose.radius * 1.2;
      const speed = 80 + Math.random() * 100;
      const spreadAngle = pose.angle + Math.PI + (Math.random() - 0.5) * 1.2;
      sparkBatch.push({
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

  // push 순서: 연기(바닥) -> 화염(위에서 발광) -> 스파크
  for (let i = 0; i < smokeBatch.length; i++) pool.push(smokeBatch[i]);
  for (let i = 0; i < flameBatch.length; i++) pool.push(flameBatch[i]);
  for (let i = 0; i < sparkBatch.length; i++) pool.push(sparkBatch[i]);
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
