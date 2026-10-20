/* 실제 불장판 렌더러를 사용한 비교. 전투 판정·진행 데이터는 사용하지 않는다. */
const flameScenes = [];
const patch = new Image(); patch.src = '../assets/art/comic-flame-patch.png';
for (const theme of ['meadow', 'citadel']) {
  for (const before of [true, false]) {
    const card = document.createElement('section');
    card.innerHTML = `<h2>${theme === 'meadow' ? '초원' : '성채'} · ${before ? '기존 사진풍 원화' : '종이 불꽃'}</h2>`;
    const canvas = document.createElement('canvas'); canvas.width = 560; canvas.height = 320;
    card.append(canvas); document.querySelector('#gallery').append(card);
    const background = new Image(); background.src = `assets/art/paper-arena${theme === 'meadow' ? '' : '-citadel'}.png`;
    const frame = getPaperMonsterFrame(4), monster = new Image(); monster.src = frame.sheet;
    flameScenes.push({ canvas, background, monster, frame, before });
  }
}
let flameTime = 0, flamePrevious = performance.now();
function renderFlameComparison(now) {
  const dt = Math.min(.1, (now - flamePrevious) / 1000); flamePrevious = now;
  if (!document.querySelector('#paused').checked && !document.hidden) flameTime += dt;
  const reduced = document.querySelector('#reduced').checked || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pulse = reduced ? 1 : 1 + Math.sin(flameTime * 4) * .025;
  for (const { canvas, background, monster, frame, before } of flameScenes) {
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 560, 320);
    if (background.complete && background.naturalWidth) ctx.drawImage(background, 0, 0, 560, 320);
    ctx.save(); ctx.globalAlpha = Number(document.querySelector('#fade').value);
    if (before && patch.complete && patch.naturalWidth) ctx.drawImage(patch, 280 - 115 * pulse, 230 - 75, 230 * pulse, 150);
    if (!before) drawPaperFlamePatch(ctx, 280, 262, 230 * pulse, flameTime, reduced);
    ctx.restore();
    if (monster.complete && monster.naturalWidth) {
      const height = 140, width = frame.w / frame.h * height;
      ctx.drawImage(monster, frame.x, frame.y, frame.w, frame.h, 280 - width / 2, 265 - height, width, height);
    }
  }
  requestAnimationFrame(renderFlameComparison);
}
requestAnimationFrame(renderFlameComparison);
