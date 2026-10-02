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
  // 발사 순간부터 동일한 크기를 유지합니다.
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

// 점액은 불꽃과 별도로 짧은 포물선과 접지 후 납작한 여운을 갖습니다.
let lastSlimeSplashAt = -Infinity;
function spawnSlimeSplash(pool, x, y, groundY, blue, strong, now, reduced) {
  if (reduced || now - lastSlimeSplashAt < (strong ? 0.055 : 0.09)) return;
  lastSlimeSplashAt = now;
  const available = Math.max(0, 48 - pool.filter(p => p.slimeDrop).length);
  const count = Math.min(available, strong ? 11 : 5);
  for (let i = 0; i < count; i++) {
    pool.push({
      slimeDrop: true, x: x + (Math.random() - 0.5) * 16, y,
      vx: (Math.random() - 0.35) * (strong ? 210 : 135),
      vy: -95 - Math.random() * (strong ? 145 : 90), groundY,
      radius: (strong ? 3.5 : 2.5) + Math.random() * 3,
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
