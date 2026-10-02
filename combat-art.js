/* 투사체는 만화풍 원본 이미지로 그리며, 여백은 로딩 시 읽어서 제외합니다. */
const comicFireball = new Image();
let comicFireballFrame = null;
comicFireball.onload = () => {
  const probe = document.createElement('canvas');
  probe.width = comicFireball.naturalWidth;
  probe.height = comicFireball.naturalHeight;
  const painter = probe.getContext('2d', { willReadFrequently: true });
  painter.drawImage(comicFireball, 0, 0);
  const pixels = painter.getImageData(0, 0, probe.width, probe.height).data;
  let left = probe.width, right = 0, top = probe.height, bottom = 0;
  for (let y = 0; y < probe.height; y++) {
    for (let x = 0; x < probe.width; x++) {
      if (pixels[(y * probe.width + x) * 4 + 3] < 32) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right > left && bottom > top) comicFireballFrame = [left, top, right - left + 1, bottom - top + 1];
};
comicFireball.src = 'assets/art/comic-fireball.png';

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
  if (comicFireballFrame) {
    for (let echo = 2; echo >= 0; echo--) {
      painter.globalAlpha = echo === 0 ? 1 : 0.12 / echo;
      painter.drawImage(comicFireball, ...comicFireballFrame,
        -width * 0.85 - echo * width * 0.22, -height / 2, width, height);
    }
  } else {
    // 로딩 중에도 이모지 없이 짧은 화염 실루엣으로 표시합니다.
    painter.fillStyle = '#ffc75c';
    painter.beginPath();
    painter.moveTo(width * 0.15, 0); painter.lineTo(-width * 0.5, -height / 2);
    painter.lineTo(-width * 0.85, 0); painter.lineTo(-width * 0.5, height / 2);
    painter.closePath(); painter.fill();
  }
  painter.restore();
}
