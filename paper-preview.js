/* 종이 원화의 포즈 교체와 접지된 미세 회전으로 구성한 독립 아트 시범입니다. */
(async function () {
  const C = PaperPreviewCore;
  const canvas = document.getElementById('paper-stage');
  const ctx = canvas.getContext('2d');
  const dialog = document.getElementById('result');
  const loadStatus = document.getElementById('load-status');
  const diagnostic = document.getElementById('diagnostics');
  const controls = [...document.querySelectorAll('.controls button')];
  controls.forEach(b => b.disabled = true);
  let s = C.createState();
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = document.getElementById('reduced');
  reduced.checked = media.matches;
  s.reduced = reduced.checked;
  const images = {};
  try {
    await Promise.all(['mage', 'slime', 'arena'].map(async key => {
      const image = new Image();
      image.src = `assets/art/paper-${key}${['mage','slime'].includes(key) ? '-poses' : ''}.png`;
      await image.decode(); images[key] = image;
    }));
  } catch (error) {
    loadStatus.textContent = '원화를 불러오지 못했습니다. 로컬 서버에서 다시 열어 주세요.';
    diagnostic.textContent = `원화 로딩 오류: ${error.message}`;
    return;
  }
  // 생성 원화의 실제 발 위치는 검수한 메타데이터를 사용합니다. 모든 포즈에 같은 축척을 적용합니다.
  const frames = await fetch('paper-frames.json').then(r => {
    if (!r.ok) throw new Error('포즈 메타데이터를 읽을 수 없습니다.');
    return r.json();
  }).catch(error => { loadStatus.textContent = error.message; return null; });
  if (!frames) return;
  loadStatus.hidden = true;
  controls.forEach(b => b.disabled = false);
  const floor = 590, mageX = 300, slimeX = 910;
  let fireParticles = [];
  const fireVisuals = new WeakMap();
  function fireVisual(p) {
    if (!fireVisuals.has(p)) {
      const f = frames.mage.release, scale = 390 / frames.mage.cell;
      fireVisuals.set(p, { type: 'fireball', radius: p.strong ? 18 : 12,
        colorCore: '#ffffff', colorMid: '#f97316', ringRgb: '234, 88, 12', age: p.age,
        startX: mageX + (f.tip[0] - f.foot[0]) * scale,
        startY: floor + (f.tip[1] - f.foot[1]) * scale,
        targetX: slimeX - 70, targetY: floor - 125 });
    }
    const visual = fireVisuals.get(p); visual.age = p.age;
    return visual;
  }
  function drawFrame(sheet, frame, x, y, scale, angle = 0, sx = 1, alpha = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(sx, 1);
    ctx.globalAlpha = alpha;
    const [bx, by, bw, bh] = frame.box;
    ctx.drawImage(sheet, bx, by, bw, bh, (bx - frame.foot[0]) * scale, (by - frame.foot[1]) * scale, bw * scale, bh * scale);
    ctx.restore();
  }
  function shadow(x, radius, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#1c2d3044';
    ctx.beginPath(); ctx.ellipse(x + 5, floor + 3, radius, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function cutSpark(x, y, size, angle, green) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#ede1b7'; ctx.beginPath(); ctx.moveTo(-size, -size * .35); ctx.lineTo(size * .6, -size * .65);
    ctx.lineTo(size, size * .35); ctx.lineTo(-size * .65, size * .65); ctx.closePath(); ctx.fill();
    ctx.scale(.8, .8); ctx.fillStyle = green ? '#8aa94d' : '#e09b3d'; ctx.fill(); ctx.restore();
  }
  function render(effectDt = 0) {
    const density = Math.min(2, devicePixelRatio || 1);
    const width = Math.round(canvas.clientWidth * density), height = Math.round(canvas.clientHeight * density);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(canvas.width / 1200, 0, 0, canvas.height / 750, 0, 0);
    ctx.clearRect(0, 0, 1200, 750);
    ctx.drawImage(images.arena, 0, 0, 1200, 750);
    // 큰 그림자나 화면 흔들림을 누적하지 않고 배경을 고정합니다.
    const actorTime = Math.floor(s.time * C.LIMITS.actorFps) / C.LIMITS.actorFps;
    const magePose = C.magePose(s), mageFrame = frames.mage[magePose];
    const mageScale = 390 / frames.mage.cell;
    const mageAngle = s.reduced || s.casting || s.release ? 0 : Math.sin(actorTime * 2.1) * .008;
    shadow(mageX, 62);
    drawFrame(images.mage, mageFrame, mageX, floor, mageScale, mageAngle);
    const slimePose = C.slimePose(s), slimeFrame = frames.slime[slimePose];
    const slimeScale = 270 / frames.slime.cell;
    let tilt = s.reduced ? 0 : s.hit > .22 ? (s.strongHit ? .075 : .035) : s.hit > .13 ? -.018 : 0;
    let fold = 1, opacity = 1;
    if (s.death >= 0) {
      const p = C.clamp((s.death - .08) / .5);
      fold = s.reduced ? 1 : 1 - C.easeOut(p) * .9;
      tilt = s.reduced ? 0 : C.easeOut(p) * .22;
      opacity = 1 - C.clamp((s.death - .48) / .34);
    }
    shadow(slimeX, 95 * fold, opacity);
    drawFrame(images.slime, slimeFrame, slimeX, floor, slimeScale, tilt, fold, opacity);
    for (const p of s.projectiles) {
      const progress = C.clamp(p.age / p.life);
      // 비등속 전진과 얕은 곡선. 캐릭터의 12fps 포즈와 별개로 매 프레임 그립니다.
      const travel = Math.pow(progress, 1.35), visual = fireVisual(p);
      const x = visual.startX + (visual.targetX - visual.startX) * travel;
      const y = visual.startY + (visual.targetY - visual.startY) * travel - Math.sin(progress * Math.PI) * 20;
      // 기존 게임의 화염 코어·화염 혀·꼬리 불씨를 그대로 재사용합니다.
      const age = visual.age;
      emitComicTrail(visual, x, y, effectDt, fireParticles, s.reduced);
      visual.age = age;
      drawComicProjectile(ctx, visual, x, y, progress);
    }
    for (let i = fireParticles.length - 1; i >= 0; i--) {
      const p = fireParticles[i]; p.life += effectDt;
      if (p.life >= p.maxLife) { fireParticles.splice(i, 1); continue; }
      p.x += p.vx * effectDt; p.y += p.vy * effectDt;
      drawFireTrail(ctx, p, effectDt);
    }
    for (const p of s.particles) {
      const t = C.clamp(p.age / p.life), distance = C.easeOut(t) * p.distance;
      const x = slimeX - 78 + Math.cos(p.angle) * distance;
      const y = floor - 125 + Math.sin(p.angle) * distance + 75 * t * t;
      ctx.save(); ctx.globalAlpha = 1 - t * t;
      cutSpark(x, y, p.strong ? 7 : 4, p.angle + t * 2.8, p.green); ctx.restore();
    }
    const progress = s.casting ? 1 - s.casting / s.duration : 0;
    document.getElementById('cast-fill').style.width = `${C.clamp(progress) * 100}%`;
    document.querySelector('.cast-track').setAttribute('aria-valuenow', Math.round(C.clamp(progress) * 100));
    document.getElementById('target-hp').value = s.hp;
    canvas.dataset.pose = magePose; canvas.dataset.slimePose = slimePose;
    diagnostic.textContent = `발사 ${s.shots} · 적중 ${s.hits} · 투사체 ${s.projectiles.length}/${C.LIMITS.projectiles} (최대 ${s.peakProjectiles}) · 점액 조각 ${s.particles.length}/${C.LIMITS.particles} · 화염 입자 ${fireParticles.length}/170 · 전투 시간 ${s.time.toFixed(2)}초 · ${s.modal || s.paused ? '정지' : '진행'}`;
    if (s.modal && !dialog.open) dialog.showModal();
  }
  document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
    if (s.death >= 0 || s.modal) return;
    const ratio = s.casting / s.duration;
    s.duration = Number(b.dataset.speed); s.casting = ratio * s.duration;
    document.querySelectorAll('[data-speed]').forEach(other => other.setAttribute('aria-pressed', String(other === b)));
  }));
  document.getElementById('cast').addEventListener('click', () => C.startCast(s));
  document.getElementById('strong').addEventListener('click', () => C.shoot(s, true));
  const autoButton = document.getElementById('auto'), pauseButton = document.getElementById('pause');
  autoButton.addEventListener('click', () => { s.auto = !s.auto; autoButton.setAttribute('aria-pressed', s.auto); });
  pauseButton.addEventListener('click', () => {
    s.paused = !s.paused; pauseButton.setAttribute('aria-pressed', s.paused);
    pauseButton.textContent = s.paused ? '▶' : 'Ⅱ'; pauseButton.setAttribute('aria-label', s.paused ? '재개' : '일시정지');
  });
  document.getElementById('defeat').addEventListener('click', () => C.defeat(s));
  function updateReduced() {
    s.reduced = reduced.checked; document.body.classList.toggle('reduced', s.reduced);
    if (s.reduced) { s.particles.length = 0; fireParticles.length = 0; }
  }
  reduced.addEventListener('change', updateReduced);
  media.addEventListener('change', event => { reduced.checked = event.matches; updateReduced(); });
  updateReduced();
  function restart() {
    const duration = s.duration, auto = s.auto;
    s = C.createState(); s.duration = duration; s.auto = auto;
    fireParticles.length = 0;
    updateReduced(); pauseButton.textContent = 'Ⅱ'; pauseButton.setAttribute('aria-pressed', 'false');
    pauseButton.setAttribute('aria-label', '일시정지'); if (dialog.open) dialog.close();
  }
  document.getElementById('restart').addEventListener('click', restart);
  dialog.addEventListener('cancel', event => { event.preventDefault(); restart(); });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.target.matches('input, button, summary') || dialog.open) return;
    if (event.key === '1') C.startCast(s);
    if (event.key === '2') C.shoot(s, true);
    if (event.code === 'Space') { event.preventDefault(); pauseButton.click(); }
  });
  let previous = performance.now();
  function loop(now) {
    const elapsed = (now - previous) / 1000; previous = now;
    const effectDt = document.hidden || s.paused || s.modal ? 0 : C.clamp(elapsed, 0, .1);
    if (!document.hidden) C.step(s, elapsed, { impact: p => {
      spawnFireballImpact(fireParticles, fireVisual(p), s.reduced);
      fireParticles = fireParticles.slice(-170);
    } });
    render(s.modal ? 0 : effectDt); requestAnimationFrame(loop);
  }
  render(); requestAnimationFrame(loop);
})();
