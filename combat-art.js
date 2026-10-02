/* 원본의 투명 여백은 미리 측정합니다. 파일 실행에서도 픽셀 읽기 없이 그립니다. */
const comicFireball = new Image();
const comicFireballFrame = [119, 324, 1294, 387];
comicFireball.src = 'assets/art/comic-fireball.png';
comicFireball.onerror = () => console.error('화염구 이미지 로딩 실패:', comicFireball.src);

function drawComicProjectile(painter, projectile, x, y, progress) {
  const heavy = projectile.type === 'pyroblast';
  const width = projectile.radius * (heavy ? 5 : 5.8);
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
