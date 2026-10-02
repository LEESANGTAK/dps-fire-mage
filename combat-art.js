/* 원본의 투명 여백은 미리 측정합니다. 파일 실행에서도 픽셀 읽기 없이 그립니다. */
const comicFireball = new Image();
const comicFireballFrame = [119, 324, 1294, 387];
comicFireball.src = 'assets/art/comic-fireball.png';
comicFireball.onerror = () => console.error('화염구 이미지 로딩 실패:', comicFireball.src);

function drawComicProjectile(painter, projectile, x, y, progress) {
  const heavy = projectile.type === 'pyroblast';
  const width = projectile.radius * (heavy ? 5 : 5.8) * 2;
  const height = width / 2.6;
  const dx = projectile.targetX - projectile.startX;
  const dy = projectile.targetY - projectile.startY;
  const tangent = Math.atan2(dy - Math.cos(progress * Math.PI) * (heavy ? 35 : 20), dx);
  painter.save();
  painter.translate(x, y);
  painter.rotate(tangent);
  // 추진으로 늘어나는 본체와 뒤늦게 사라지는 잔상을 분리합니다.
  painter.scale(1 + progress * 0.18, 1 - progress * 0.1);
  if (comicFireball.complete && comicFireball.naturalWidth > 0) {
    for (let echo = 2; echo >= 0; echo--) {
      painter.globalAlpha = echo === 0 ? 1 : 0.12 / echo;
      painter.drawImage(comicFireball, ...comicFireballFrame,
        -width * 0.85 - echo * width * 0.22, -height / 2, width, height);
    }
  }
  painter.restore();
}

// 시간 기준으로 불씨를 남겨 화면 주사율에 따라 밀도가 달라지지 않도록 합니다.
function emitComicTrail(projectile, x, y, dt, pool, reduced) {
  if (reduced) return;
  const heavy = projectile.type === 'pyroblast';
  const width = projectile.radius * (heavy ? 5 : 5.8) * 2;
  const previousX = projectile.trailX ?? x;
  const previousY = projectile.trailY ?? y;
  projectile.trailX = x; projectile.trailY = y;
  projectile.trailClock = (projectile.trailClock || 0) + dt;
  const interval = 1 / 75;
  const count = Math.min(4, Math.floor(projectile.trailClock / interval));
  projectile.trailClock %= interval;
  let available = Math.max(0, 96 - pool.filter(p => p.comicTrail).length);
  for (let i = 0; i < count && available > 0; i++, available--) {
    const t = (i + 1) / count;
    pool.push({
      comicTrail: true,
      x: previousX + (x - previousX) * t - width * 0.72,
      y: previousY + (y - previousY) * t + (Math.random() - 0.5) * 12,
      vx: -28 - Math.random() * 35, vy: (Math.random() - 0.5) * 48,
      radius: (heavy ? 4 : 2.5) + Math.random() * 2.5,
      life: 0, maxLife: 0.16 + Math.random() * 0.08,
      colorCore: '#ffe6a0', colorEdge: '#f66c29'
    });
  }
}
