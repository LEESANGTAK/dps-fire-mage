/* 배경 소품 상호작용: 폐광 수정 군락·성채 화로(이 파일), 나머지 소품은 arena-props-extra.js.
 *
 * - 움직이는 소품은 원화에서 잘라 낸 조각(scripts/build-arena-props.py)만 씁니다. 새 소품을 따로 그려 얹지 않습니다
 *   (2026-10-04에 캔버스로 그린 소품·조명을 제거한 이력, docs/design-decisions.md).
 * - 캔버스로 직접 그리는 것은 금·파편·불티·빛처럼 '반응' 효과뿐입니다.
 * - 보상은 연출뿐입니다. 전투 수치·골드에는 아무 영향이 없습니다(광클이 늘 정답이 되지 않게).
 * - 일시정지 중에는 반응하지 않고, 모션 줄이기에서는 흔들림·입자를 끄고 상태 변화만 보여 줍니다.
 */
const ARENA_PROP_RULES = {
  crystalHits: 5,          // 몇 번째 클릭에 부서지는지
  crystalWobbleSec: .42,
  shatterSec: 1.1,
  regrowSec: .6,
  flareSec: 1.1,           // 화로 클릭 직후 치솟는 시간
  warmSec: 7,              // 치솟은 뒤 크게 타오르는 시간(이 안에 4개를 모두 키우면 옥좌가 빛남)
  sigilSec: 1.5,
  maxParticles: 70,
  fadeInSec: .9,           // 배경 전환(0.9초)과 맞춰 소품도 서서히 드러냅니다.
  hitPad: 10               // 클릭 판정 여유(원화 px)
};
// 성채 옥좌 문양 위치(원화 좌표). 화로 4개를 모두 키우면 이 자리가 빛납니다.
const CITADEL_SIGIL = { x: 762, y: 240, r: 170 };

function createArenaProps(canvas, data, options = {}) {
  const ImageType = options.ImageType || (typeof Image !== 'undefined' ? Image : null);
  const rng = options.random || Math.random;
  const onSound = options.onSound || (() => {});
  const ctx = canvas.getContext('2d');
  const [artW, artH] = data.artSize;
  const images = {};
  function image(name) {
    if (!images[name] && ImageType) {
      const im = new ImageType();
      im.src = name.includes('/') ? name : `assets/art/props/${name}.png`;
      images[name] = im;
    }
    return images[name];
  }
  const ready = (im) => im && im.complete && im.naturalWidth;

  let theme = null, stage = 0, time = 0, fade = 1, needsClear = true;
  const particles = [];
  const crystal = { hits: 0, flash: 0, broken: false, wobble: 0, shatter: 0, regrow: 0, glint: 2.5, glintAt: null, shards: [], cracks: [], impacts: [] };
  const flames = data.citadelFlames.map((f) => ({ ...f, flare: 0, warm: 0, phase: rng() * 6.28 }));
  let sigil = 0, allWarmLast = false;
  let crystalLayer = null;
  const onLuckyRaw = options.onLucky || (() => {});
  const onEvent = options.onEvent || (() => {});
  // 큰 반응 뒤 확률로 '행운 불씨'(다음 화염구 하나의 색만 바뀌는 외형 보상).
  function lucky(name) {
    const chance = typeof ARENA_EXTRA_RULES !== 'undefined' ? ARENA_EXTRA_RULES.luckyChance : .5;
    if (rng() < chance) onLuckyRaw(name);
    return name;
  }
  const extraFactory = options.extras || (typeof createArenaPropExtras === 'function' ? createArenaPropExtras : null);
  const extras = extraFactory ? extraFactory({
    ctx, data, image, ready, rng, onSound, inBox: (p, box, pad) => inBox(p, box, pad),
    pushParticle: (q) => pushParticle(q),
    onLucky: (name) => onLuckyRaw(name),
    event: (name) => onEvent(name)
  }) : [];
  const THEME_IMAGES = {
    mine: ['mine-crystals', 'mine-crystals-broken', 'mine-extra'],
    citadel: ['citadel-flames'],
    ruins: ['ruins', 'ruins-lava-mask'],
    void: ['void', 'void-crystals'],
    meadow: ['assets/art/paper-slime-poses.png']
  };

  function resetCrystal(regrow) {
    if (crystal.broken && regrow) crystal.regrow = ARENA_PROP_RULES.regrowSec;
    crystal.hits = 0; crystal.broken = false; crystal.wobble = 0; crystal.shatter = 0; crystal.shards = []; crystal.cracks = []; crystal.impacts = [];
  }
  function resetFlames() {
    flames.forEach((f) => { f.flare = 0; f.warm = 0; });
    sigil = 0; allWarmLast = false;
  }

  function setStage(next, themeId) {
    if (next === stage && themeId === theme) return;
    const changedTheme = themeId !== theme;
    stage = next;
    if (changedTheme) {
      theme = themeId; fade = 0; particles.length = 0;
      resetCrystal(false); resetFlames();
      (THEME_IMAGES[theme] || []).forEach((name) => image(name));
    } else {
      // 같은 지역의 다음 스테이지: 부서진 수정은 다시 자라고, 화로는 원래 크기로 돌아갑니다.
      resetCrystal(true); resetFlames();
    }
    extras.forEach((x) => x.reset());
    needsClear = true;
  }

  function toArt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return { x: (clientX - rect.left) / rect.width * artW, y: (clientY - rect.top) / rect.height * artH };
  }
  function inBox(p, box, pad = ARENA_PROP_RULES.hitPad) {
    return p.x >= box[0] - pad && p.x <= box[0] + box[2] + pad && p.y >= box[1] - pad && p.y <= box[1] + box[3] + pad;
  }
  function pushParticle(p) {
    if (particles.length >= ARENA_PROP_RULES.maxParticles) particles.shift();
    particles.push(p);
  }

  // 금은 맞은 지점에서 두 갈래로 뻗어 나갑니다(깨진 유리·만화풍 얼음 레퍼런스). 원화 좌표.
  function addCrack(p) {
    const bodies = data.mineCrystals.bodies;
    const inside = bodies.filter((b) => inBox(p, b, 0));
    const b = inside.length
      ? inside.reduce((a, c) => (a[2] * a[3] < c[2] * c[3] ? a : c))
      : bodies.reduce((a, c) => (Math.hypot(p.x - a[0] - a[2] / 2, p.y - a[1] - a[3] / 2) < Math.hypot(p.x - c[0] - c[2] / 2, p.y - c[1] - c[3] / 2) ? a : c));
    // 결정 가장자리를 눌러도 금은 결정 안쪽에서 시작합니다.
    const ox = Math.min(b[0] + b[2] * .8, Math.max(b[0] + b[2] * .2, p.x));
    const oy = Math.min(b[1] + b[3] * .75, Math.max(b[1] + b[3] * .15, p.y));
    const size = Math.min(b[2], b[3]);
    const base = rng() * Math.PI * 2;
    for (const turn of [0, Math.PI * (.7 + rng() * .5)]) {
      let a = base + turn, x = ox, y = oy;
      const points = [[x, y]];
      const steps = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < steps; i++) {
        a += (rng() - .5) * .9;
        const len = size * (.12 + rng() * .1);
        x += Math.cos(a) * len; y += Math.sin(a) * len;
        points.push([x, y]);
      }
      crystal.cracks.push(points);
    }
    crystal.impacts.push([ox, oy]);
  }

  function hitCrystal(p, reduced) {
    if (crystal.broken || crystal.regrow > 0) return null;
    crystal.hits += 1;
    addCrack(p);
    if (crystal.hits >= ARENA_PROP_RULES.crystalHits) {
      crystal.broken = true;
      crystal.shatter = reduced ? 0 : ARENA_PROP_RULES.shatterSec;
      if (!reduced) spawnShards();
      onSound('prop_crystal_break', 1.15 + rng() * .1);
      return lucky('crystal-break');
    }
    crystal.wobble = reduced ? 0 : ARENA_PROP_RULES.crystalWobbleSec;
    crystal.flash = .14;
    if (!reduced) {
      for (let i = 0; i < 4; i++) {
        pushParticle({ kind: 'chip', x: p.x, y: p.y, vx: (rng() - .5) * 160, vy: -60 - rng() * 120, life: .5, max: .5, size: 3 + rng() * 3, rot: rng() * 6 });
      }
    }
    // 두드릴수록 음이 조금씩 올라가 '곧 깨진다'는 긴장을 소리로 알립니다.
    onSound('prop_crystal_tap', 1.35 + crystal.hits * .09);
    return 'crystal-hit';
  }

  // 원화 수정 조각을 삼각형으로 나눠 파편으로 날립니다.
  function spawnShards() {
    crystal.shards = [];
    for (const b of data.mineCrystals.bodies) {
      const count = b[2] * b[3] > 2000 ? 4 : 2;
      for (let i = 0; i < count; i++) {
        const cx = b[0] + b[2] * (.2 + rng() * .6), cy = b[1] + b[3] * (.15 + rng() * .5);
        const r = Math.max(6, Math.min(b[2], b[3]) * (.22 + rng() * .14));
        const tri = [0, 1, 2].map((k) => {
          const a = k * 2.1 + rng() * .8;
          return [Math.cos(a) * r, Math.sin(a) * r];
        });
        crystal.shards.push({ x: cx, y: cy, ox: cx, oy: cy, tri, vx: (cx - 1420) * 2.4 + (rng() - .5) * 120, vy: -180 - rng() * 220, rot: 0, vr: (rng() - .5) * 9 });
      }
    }
    for (let i = 0; i < 16; i++) {
      pushParticle({ kind: 'glint', x: 1400 + (rng() - .5) * 140, y: 380 + (rng() - .5) * 180, vx: (rng() - .5) * 200, vy: -40 - rng() * 160, life: .8, max: .8, size: 3 + rng() * 4, rot: 0 });
    }
  }

  function hitFlame(f, reduced) {
    f.flare = reduced ? 0 : ARENA_PROP_RULES.flareSec;
    f.warm = ARENA_PROP_RULES.warmSec;
    if (!reduced) {
      const cx = f.box[0] + f.box[2] / 2, top = f.box[1];
      for (let i = 0; i < 9; i++) {
        pushParticle({ kind: 'ember', x: cx + (rng() - .5) * f.box[2] * .6, y: top + f.box[3] * .4, vx: (rng() - .5) * 60, vy: -120 - rng() * 140, life: .9 + rng() * .5, max: 1.4, size: 2 + rng() * 2.5, rot: 0 });
      }
    }
    onSound('prop_brazier', .78 + rng() * .1);
    const clickable = flames.filter((x) => x.clickable);
    const allWarm = clickable.every((x) => x.warm > 0);
    if (allWarm && !allWarmLast) {
      sigil = ARENA_PROP_RULES.sigilSec;
      flames.forEach((x) => { x.flare = reduced ? 0 : ARENA_PROP_RULES.flareSec; x.warm = Math.max(x.warm, ARENA_PROP_RULES.warmSec); });
      onSound('prop_sigil', .85);
      allWarmLast = true;
      return lucky('citadel-sigil');
    }
    return 'brazier-flare';
  }

  // 화면 좌표로 클릭을 받습니다. 반응했으면 사건 이름, 아니면 null.
  function hit(clientX, clientY, paused = false, reduced = false) {
    if (paused) return null;
    const p = toArt(clientX, clientY);
    if (!p) return null;
    return hitArt(p, reduced);
  }
  function hitArt(p, reduced = false) {
    // 배경이 서서히 드러나는 동안(전환 중)에는 반응하지 않습니다.
    if (fade < .5) return null;
    let result = null;
    if (theme === 'mine' && data.mineCrystals.bodies.some((b) => inBox(p, b))) result = hitCrystal(p, reduced);
    if (theme === 'citadel') {
      const f = flames.find((x) => x.clickable && inBox(p, [x.box[0], x.box[1], x.box[2], x.box[3] + 30]));
      if (f) result = hitFlame(f, reduced);
    }
    if (!result) {
      for (const x of extras) {
        if (x.theme !== theme || !x.hit) continue;
        const boxes = x.boxes || (x.box ? [x.box] : []);
        if (!boxes.some((b) => inBox(p, b))) continue;
        result = x.hit(p, reduced);
        if (result) break;
      }
    }
    if (result) { needsClear = true; onEvent(result); }
    return result;
  }

  function step(dt, reduced) {
    time += dt;
    fade = reduced ? 1 : Math.min(1, fade + dt / ARENA_PROP_RULES.fadeInSec);
    crystal.wobble = Math.max(0, crystal.wobble - dt);
    crystal.flash = Math.max(0, crystal.flash - dt);
    crystal.regrow = Math.max(0, crystal.regrow - dt);
    if (crystal.shatter > 0) {
      crystal.shatter = Math.max(0, crystal.shatter - dt);
      for (const s of crystal.shards) { s.vy += 900 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; }
    }
    // 수정은 가끔 반짝여 '건드려 볼 만하다'는 신호만 줍니다(정답 표시가 아니라 살아 있는 느낌).
    if (theme === 'mine' && !crystal.broken && !reduced) {
      crystal.glint -= dt;
      if (crystal.glint <= 0) {
        const b = data.mineCrystals.bodies[Math.floor(rng() * data.mineCrystals.bodies.length)];
        crystal.glintAt = { x: b[0] + b[2] * (.35 + rng() * .3), y: b[1] + b[3] * (.15 + rng() * .3), t: .55 };
        crystal.glint = 3 + rng() * 4;
      }
      if (crystal.glintAt) { crystal.glintAt.t -= dt; if (crystal.glintAt.t <= 0) crystal.glintAt = null; }
    }
    let anyWarm = false;
    for (const f of flames) {
      f.flare = Math.max(0, f.flare - dt);
      f.warm = Math.max(0, f.warm - dt);
      if (f.clickable && f.warm > 0) anyWarm = true;
    }
    if (!flames.filter((x) => x.clickable).every((x) => x.warm > 0)) allWarmLast = false;
    if (!anyWarm) allWarmLast = false;
    sigil = Math.max(0, sigil - dt);
    for (const x of extras) if (x.theme === theme && x.step) x.step(dt, reduced, time);
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      q.vy += (q.kind === 'ember' ? -20 : q.grav != null ? q.grav : q.kind === 'piece' ? 900 : 520) * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * (q.kind === 'piece' ? q.vx / 40 : 5);
      // 광석 조각은 레일 높이에서 한두 번 튀고 멈춥니다.
      if (q.floor != null && q.y > q.floor && q.vy > 0) { q.y = q.floor; q.vy *= -.35; q.vx *= .6; }
    }
  }

  function resize() {
    const w = Math.max(1, Math.round(canvas.clientWidth || canvas.width)), h = Math.max(1, Math.round(canvas.clientHeight || canvas.height));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; needsClear = true; }
  }

  // 탄성 복원: 피격 스쿼시 scale(1.15, .85)에서 시작해 흔들리며 1로 돌아옵니다(AGENTS.md 2장).
  function elastic(t) { return Math.exp(-6 * t) * Math.cos(t * 18); }

  function drawCrystal(sx, sy) {
    const box = data.mineCrystals.box;
    const sprite = image('mine-crystals'), broken = image('mine-crystals-broken');
    if (crystal.broken) {
      if (ready(broken)) ctx.drawImage(broken, box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy);
      if (crystal.shatter > 0 && ready(sprite)) drawShards(sprite, sx, sy);
      return;
    }
    if (!ready(sprite)) return;
    if (!crystalLayer && typeof document !== 'undefined') crystalLayer = document.createElement('canvas');
    // 금은 수정 조각 안쪽에만 보이도록 별도 캔버스에서 합성합니다.
    let source = sprite;
    if (crystalLayer && crystal.cracks.length) {
      crystalLayer.width = box[2]; crystalLayer.height = box[3];
      const c = crystalLayer.getContext('2d');
      c.clearRect(0, 0, box[2], box[3]);
      c.drawImage(sprite, 0, 0);
      c.globalCompositeOperation = 'source-atop';
      c.lineJoin = 'round';
      // 밝은 수정의 금은 검은 선이 아니라 하얗게 빛나는 갈라짐으로 그립니다(검은 선은 '실을 붙인' 것처럼 보였음).
      // 시작점이 가장 굵고 끝으로 갈수록 가늘어지며, 한쪽에만 옅은 푸른 그림자를 둬 패인 느낌을 줍니다.
      // 원화의 0.4~0.8배로 줄여 그려지므로 원화 기준 굵기입니다.
      for (const crack of crystal.cracks) {
        const last = crack.length - 1;
        for (let i = 0; i < last; i++) {
          const [x0, y0] = crack[i], [x1, y1] = crack[i + 1];
          const w = 3.4 * (1 - i / (last + .5)) + .6;
          c.beginPath(); c.moveTo(x0 - box[0] + 1.6, y0 - box[1] + 1.2); c.lineTo(x1 - box[0] + 1.6, y1 - box[1] + 1.2);
          c.strokeStyle = 'rgba(38,70,120,.32)'; c.lineWidth = w * 1.1; c.stroke();
          c.beginPath(); c.moveTo(x0 - box[0], y0 - box[1]); c.lineTo(x1 - box[0], y1 - box[1]);
          c.strokeStyle = 'rgba(248,254,255,.95)'; c.lineWidth = w; c.stroke();
        }
      }
      // 맞은 자리: 작은 흰 점.
      c.fillStyle = 'rgba(250,255,255,.95)';
      for (const [ix, iy] of crystal.impacts) { c.beginPath(); c.arc(ix - box[0], iy - box[1], 2.6, 0, Math.PI * 2); c.fill(); }
      c.globalCompositeOperation = 'source-over';
      source = crystalLayer;
    }
    let scaleX = 1, scaleY = 1;
    if (crystal.wobble > 0) {
      const t = 1 - crystal.wobble / ARENA_PROP_RULES.crystalWobbleSec;
      const e = elastic(t);
      scaleX = 1 + .1 * e; scaleY = 1 - .1 * e;
    }
    if (crystal.regrow > 0) {
      const t = 1 - crystal.regrow / ARENA_PROP_RULES.regrowSec;
      const pop = 1 + Math.sin(t * Math.PI) * .12 * (1 - t);
      scaleX = scaleY = Math.min(1.12, (.55 + .45 * t) * pop);
      if (ready(broken)) ctx.drawImage(broken, box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy);
    }
    // 바닥(아래 가운데)을 축으로 늘이고 줄여 땅에 박힌 느낌을 유지합니다.
    const ax = (box[0] + box[2] * .55) * sx, ay = (box[1] + box[3]) * sy;
    ctx.save();
    ctx.translate(ax, ay); ctx.scale(scaleX, scaleY); ctx.translate(-ax, -ay);
    ctx.drawImage(source, box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy);
    // 두드린 순간 0.14초 하얗게 번쩍: 클릭이 먹혔다는 확인.
    if (crystal.flash > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= crystal.flash / .14 * .5;
      ctx.drawImage(source, box[0] * sx, box[1] * sy, box[2] * sx, box[3] * sy);
    }
    ctx.restore();
    if (crystal.glintAt) {
      const g = crystal.glintAt, k = Math.sin((1 - g.t / .55) * Math.PI), r = 9 * k * Math.min(sx, sy) * 1.6;
      ctx.save(); ctx.translate(g.x * sx, g.y * sy); ctx.globalAlpha = k * .9; ctx.fillStyle = '#f2fdff';
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.quadraticCurveTo(0, 0, r * .35, 0); ctx.quadraticCurveTo(0, 0, 0, r);
      ctx.quadraticCurveTo(0, 0, -r * .35, 0); ctx.quadraticCurveTo(0, 0, 0, -r); ctx.fill();
      ctx.restore();
    }
  }

  function drawShards(sprite, sx, sy) {
    const box = data.mineCrystals.box;
    const t = 1 - crystal.shatter / ARENA_PROP_RULES.shatterSec;
    // 깨지는 순간 하늘색 섬광(0.15초).
    if (t < .15) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - t / .15) * .55;
      const cx = (box[0] + box[2] * .55) * sx, cy = (box[1] + box[3] * .45) * sy, r = box[3] * .7 * sy;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, '#d8f6ff'); g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.restore();
    }
    for (const s of crystal.shards) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - .55) / .45);
      ctx.translate(s.x * sx, s.y * sy); ctx.rotate(s.rot);
      ctx.beginPath();
      s.tri.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
      ctx.closePath(); ctx.save(); ctx.clip();
      // 파편 속은 원래 자리의 원화 픽셀 그대로입니다.
      ctx.drawImage(sprite, (box[0] - s.ox) * sx, (box[1] - s.oy) * sy, box[2] * sx, box[3] * sy);
      ctx.restore();
      ctx.strokeStyle = '#2b2138'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlames(sx, sy) {
    const atlas = image('citadel-flames');
    if (!ready(atlas)) return;
    for (const f of flames) {
      const [x, y, w, h] = f.box, [ux, uy, uw, uh] = f.src;
      // 불꽃은 늘 원래 크기 이상으로만 늘려 원화의 정지 불꽃이 뒤로 비치지 않게 합니다.
      const flick = reducedLast ? 0 : (Math.sin(time * 7.3 + f.phase) * .5 + Math.sin(time * 12.1 + f.phase * 2) * .3 + .8) * .05;
      const warmK = Math.min(1, f.warm / .8) * .2;
      let flareK = 0;
      if (f.flare > 0) {
        const t = 1 - f.flare / ARENA_PROP_RULES.flareSec;
        // 오버슈트 팝업 후 감속 안착.
        flareK = t < .18 ? (t / .18) * .95 : .95 * Math.pow(1 - (t - .18) / .82, 2);
      }
      const scaleY = 1 + flick + warmK + flareK, scaleX = 1 + flick * .4 + warmK * .5 + flareK * .45;
      const sway = reducedLast ? 0 : Math.sin(time * 3.1 + f.phase) * .05;
      const ax = (x + w / 2) * sx, ay = (y + h) * sy;
      ctx.save();
      ctx.translate(ax, ay); ctx.transform(1, 0, -sway, 1, 0, 0); ctx.scale(scaleX, scaleY);
      ctx.drawImage(atlas, ux, uy, uw, uh, -w / 2 * sx, -h * sy, w * sx, h * sy);
      if (warmK + flareK > 0) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(.55, (warmK + flareK) * .6);
        ctx.drawImage(atlas, ux, uy, uw, uh, -w / 2 * sx, -h * sy, w * sx, h * sy);
      }
      ctx.restore();
    }
    if (sigil > 0) {
      const t = 1 - sigil / ARENA_PROP_RULES.sigilSec, k = Math.sin(t * Math.PI);
      const cx = CITADEL_SIGIL.x * sx, cy = CITADEL_SIGIL.y * sy, r = CITADEL_SIGIL.r * Math.min(sx, sy) * 1.6;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k * .9;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, '#ffd27a'); g.addColorStop(.4, 'rgba(255,140,60,.45)'); g.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.restore();
    }
  }

  function drawParticles(sx, sy) {
    for (const q of particles) {
      const k = q.life / q.max;
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.translate(q.x * sx, q.y * sy); ctx.rotate(q.rot);
      const s = q.size * Math.min(sx, sy) * 1.4;
      if (q.kind === 'piece') {
        // 원화 조각을 삼각형으로 잘라 그대로 씁니다(광석 등).
        const atlas = image(q.atlas), f = q.frame;
        ctx.globalAlpha = Math.min(1, k * 2.5);
        if (ready(atlas)) {
          ctx.beginPath(); q.tri.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy))); ctx.closePath();
          ctx.save(); ctx.clip();
          const [bx, by, bw, bh] = f.box, [ux, uy, uw, uh] = f.src;
          ctx.drawImage(atlas, ux, uy, uw, uh, (bx - q.ox) * sx, (by - q.oy) * sy, bw * sx, bh * sy);
          ctx.restore();
          ctx.strokeStyle = '#2b2138'; ctx.lineWidth = 1.2; ctx.stroke();
        }
      } else if (q.kind === 'ember') {
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = k > .5 ? '#ffd27a' : '#ff8a3d';
        ctx.beginPath(); ctx.arc(0, 0, s * .6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = q.kind === 'glint' ? '#e8fbff' : '#8fd6f5';
        ctx.strokeStyle = '#2b2138'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .7, s * .5); ctx.lineTo(-s * .6, s * .6); ctx.closePath();
        ctx.fill(); if (q.kind === 'chip') ctx.stroke();
      }
      ctx.restore();
    }
  }

  let reducedLast = false;
  function update(dt, paused = false, reduced = false) {
    resize();
    reducedLast = reduced;
    const active = Boolean(theme);
    if (!active) {
      if (needsClear) { ctx.clearRect(0, 0, canvas.width, canvas.height); needsClear = false; }
      return;
    }
    if (paused && !needsClear) return;
    if (!paused) step(Math.max(0, Math.min(.1, dt)), reduced);
    if (reduced) particles.length = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sx = canvas.width / artW, sy = canvas.height / artH;
    ctx.save(); ctx.globalAlpha = fade;
    for (const x of extras) if (x.theme === theme && x.draw) x.draw(sx, sy, time, reduced);
    if (theme === 'mine') drawCrystal(sx, sy);
    if (theme === 'citadel') drawFlames(sx, sy);
    ctx.restore();
    // 배경 원화와 같은 위아래 그늘을 소품 픽셀에만 씌웁니다. 빠뜨리면 화면 위쪽 소품이 주변보다 밝게 떠 보입니다.
    const stops = typeof ARENA_SHADE_STOPS !== 'undefined' ? ARENA_SHADE_STOPS : null;
    if (stops && ctx.createLinearGradient) {
      const shade = ctx.createLinearGradient(0, 0, 0, canvas.height);
      stops.forEach(([at, color]) => shade.addColorStop(at, color));
      ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = shade; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
    }
    drawParticles(sx, sy);
    needsClear = false;
  }

  return {
    setStage, update, hit, hitArt, resize,
    snapshot: () => ({
      theme, stage, fade,
      crystal: { hits: crystal.hits, broken: crystal.broken, cracks: crystal.cracks.length, shards: crystal.shards.length, regrow: crystal.regrow },
      flames: flames.map((f) => ({ id: f.id, warm: f.warm, flare: f.flare })),
      sigil, particles: particles.length,
      extras: Object.fromEntries(extras.filter((x) => x.snap).map((x) => [x.id, x.snap()]))
    })
  };
}
let arenaProps = null;
// 노드 테스트: 확장 묶음을 함께 읽습니다(브라우저는 index.html에서 arena-props-extra.js를 먼저 읽음).
if (typeof module !== 'undefined') {
  // eslint-disable-next-line no-global-assign
  if (typeof createArenaPropExtras === 'undefined') global.createArenaPropExtras = require('./arena-props-extra.js').createArenaPropExtras;
  if (typeof ARENA_SHADE_STOPS === 'undefined') global.ARENA_SHADE_STOPS = require('./arena-environment.js').ARENA_SHADE_STOPS;
  module.exports = { ARENA_PROP_RULES, CITADEL_SIGIL, createArenaProps };
}
