/* 화염구는 이미지 대신 사전 렌더링한 불꽃 텍스처로 백열 코어·화염 혀·꼬리 불씨를 조합합니다. */
const fireTextureCache = new Map();

function hexToRgb(hex) {
  const h = String(hex || '#f97316').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 진화 단계 색상별로 1회만 그려서 재사용합니다. 캔버스를 만들 수 없는 환경에서는 null을 돌려줍니다.
function getFireTextures(colorCore, colorMid, ringRgb) {
  const key = `${colorCore}|${colorMid}|${ringRgb}`;
  if (fireTextureCache.has(key)) return fireTextureCache.get(key);
  let textures = null;
  try {
    if (typeof document === 'undefined') throw Error('no document');
    const [cr, cg, cb] = hexToRgb(colorCore || '#ffffff');
    const [mr, mg, mb] = hexToRgb(colorMid || '#f97316');
    const ring = ringRgb || '234, 88, 12';

    // 불꽃 퍼프: 순백 코어 → 고열 황금빛 → 타오르는 주황 → 마그마 림
    const puff = document.createElement('canvas');
    puff.width = puff.height = 96;
    const p = puff.getContext('2d');
    const g = p.createRadialGradient(48, 48, 0, 48, 48, 46);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.18, `rgba(${cr}, ${cg}, ${cb}, 0.98)`);
    g.addColorStop(0.48, `rgba(${mr}, ${mg}, ${mb}, 0.85)`);
    g.addColorStop(0.78, `rgba(${ring}, 0.38)`);
    g.addColorStop(1, `rgba(${ring}, 0)`);
    p.fillStyle = g;
    p.fillRect(0, 0, 96, 96);

    // 외곽 광채: 넓고 따뜻한 열기
    const halo = document.createElement('canvas');
    halo.width = halo.height = 96;
    const h = halo.getContext('2d');
    const hg = h.createRadialGradient(48, 48, 0, 48, 48, 46);
    hg.addColorStop(0, `rgba(${mr}, ${mg}, ${mb}, 0.58)`);
    hg.addColorStop(0.48, `rgba(${ring}, 0.24)`);
    hg.addColorStop(1, `rgba(${ring}, 0)`);
    h.fillStyle = hg;
    h.fillRect(0, 0, 96, 96);

    textures = { puff, halo };
  } catch (e) {
    textures = null;
  }
  fireTextureCache.set(key, textures);
  return textures;
}

function drawComicProjectile(painter, projectile, x, y, progress) {
  const tex = getFireTextures(projectile.colorCore, projectile.colorMid, projectile.ringRgb);
  if (!tex) return;
  const heavy = projectile.type === 'pyroblast';
  const r = projectile.radius * (heavy ? 1.25 : 1);
  const age = projectile.age || 0;
  const dx = projectile.targetX - projectile.startX;
  const dy = projectile.targetY - projectile.startY;
  const tangent = Math.atan2(dy - Math.cos(progress * Math.PI) * (heavy ? 35 : 20), dx);

  painter.save();
  painter.translate(x, y);
  painter.rotate(tangent);
  painter.globalCompositeOperation = 'lighter';

  // 1. 외곽 열기 광채
  const haloSize = r * 6.5;
  painter.globalAlpha = 0.6;
  painter.drawImage(tex.halo, -haloSize * 0.62, -haloSize * 0.5, haloSize, haloSize);

  // 2. 뒤로 일렁이는 화염 혀: 뒤로 갈수록 작고 옅으며, 위상차로 S자 물결을 만듭니다.
  for (let k = 4; k >= 1; k--) {
    const back = r * (0.55 + k * 0.78);
    const sway = Math.sin(age * 30 + k * 1.9) * r * 0.16 * k;
    const flicker = 1 + Math.sin(age * 41 + k * 2.7) * 0.1;
    const size = r * (3.1 - k * 0.42) * flicker;
    painter.globalAlpha = Math.max(0.18, 0.88 - k * 0.15);
    painter.save();
    painter.translate(-back, sway);
    painter.scale(1.45, 1);
    painter.drawImage(tex.puff, -size * 0.5, -size * 0.5, size, size);
    painter.restore();
  }

  // 3. 진행 방향 앞쪽의 백열 코어 (탄두 앞쪽 순백 백열 및 고열 황금 림)
  const coreSize = r * 2.8;
  painter.globalAlpha = 1;
  painter.drawImage(tex.puff, r * 0.05 - coreSize * 0.5, -coreSize * 0.5, coreSize, coreSize);
  const hotSize = r * 1.6;
  painter.drawImage(tex.puff, r * 0.28 - hotSize * 0.5, -hotSize * 0.5, hotSize, hotSize);

  painter.restore();
}

// 시간 기준으로 꼬리 불꽃을 남겨 화면 주사율과 무관하게 밀도를 유지합니다.
const FIRE_TRAIL_CAP = 150;
function emitComicTrail(projectile, x, y, dt, pool, reduced) {
  projectile.age = (projectile.age || 0) + dt;
  const previousX = projectile.trailX ?? x;
  const previousY = projectile.trailY ?? y;
  projectile.trailX = x; projectile.trailY = y;
  if (reduced || dt <= 0) return;

  const heavy = projectile.type === 'pyroblast';
  const r = projectile.radius * (heavy ? 1.25 : 1);
  let dirX = x - previousX, dirY = y - previousY;
  const len = Math.hypot(dirX, dirY);
  if (len < 0.001) return;
  dirX /= len; dirY /= len;
  const perpX = -dirY, perpY = dirX;

  projectile.trailClock = (projectile.trailClock || 0) + Math.min(0.05, dt);
  const interval = 1 / 140;
  const count = Math.min(4, Math.floor(projectile.trailClock / interval));
  projectile.trailClock %= interval;

  let active = 0;
  for (let i = 0; i < pool.length; i++) if (pool[i].fireTrail) active++;
  let available = Math.max(0, FIRE_TRAIL_CAP - active);

  for (let i = 0; i < count && available > 0; i++, available--) {
    const t = (i + 1) / count;
    const bx = previousX + (x - previousX) * t - dirX * r * 0.9;
    const by = previousY + (y - previousY) * t - dirY * r * 0.9;
    const side = (Math.random() - 0.5) * r * 0.9;
    const ember = Math.random() < 0.14;
    const speed = ember ? 70 + Math.random() * 80 : 25 + Math.random() * 35;
    const spread = (Math.random() - 0.5) * (ember ? 120 : 30);
    pool.push({
      fireTrail: true,
      kind: ember ? 'ember' : 'flame',
      x: bx + perpX * side,
      y: by + perpY * side,
      vx: -dirX * speed + perpX * spread,
      vy: -dirY * speed + perpY * spread,
      perpX, perpY,
      phase: Math.random() * Math.PI * 2,
      waveAmp: r * (1.6 + Math.random() * 1.6),
      size: ember ? 5 + Math.random() * 5 : r * (2.0 + Math.random() * 1.1),
      colorCore: projectile.colorCore,
      colorMid: projectile.colorMid,
      ringRgb: projectile.ringRgb,
      life: 0,
      maxLife: ember ? 0.18 + Math.random() * 0.1 : 0.13 + Math.random() * 0.09
    });
  }
}

// 꼬리 불꽃: 진행 방향으로 늘어난 화염 혀가 물결치며 수축·소멸합니다.
function drawFireTrail(painter, pt, dt) {
  const tex = getFireTextures(pt.colorCore, pt.colorMid, pt.ringRgb);
  if (!tex) return;
  const progress = pt.life / pt.maxLife;
  if (progress >= 1) return;

  if (pt.kind === 'ember') {
    pt.vx *= Math.exp(-3 * dt);
    pt.vy += 160 * dt;
  } else {
    pt.vx *= Math.exp(-6 * dt);
    pt.vy = pt.vy * Math.exp(-6 * dt) - 40 * dt; // 열기 부력
    // 수직 방향 물결로 레퍼런스의 S자 화염 혀를 만듭니다.
    const wave = Math.cos(pt.life * 26 + pt.phase) * pt.waveAmp * dt * 4;
    pt.x += pt.perpX * wave;
    pt.y += pt.perpY * wave;
  }

  painter.save();
  painter.translate(pt.x, pt.y);
  painter.globalCompositeOperation = 'lighter';
  if (pt.kind === 'ember') {
    painter.globalAlpha = Math.pow(1 - progress, 1.2);
    const s = pt.size * (1 - progress * 0.5);
    painter.drawImage(tex.puff, -s * 0.5, -s * 0.5, s, s);
  } else {
    painter.rotate(Math.atan2(pt.vy, pt.vx));
    painter.scale(1 + 0.8 * (1 - progress), 1);
    const s = pt.size * Math.max(0.2, 1 - progress * 0.75);
    painter.globalAlpha = Math.pow(1 - progress, 1.3) * 0.85;
    painter.drawImage(tex.puff, -s * 0.5, -s * 0.5, s, s);
  }
  painter.restore();
}

// 착탄 순간 짧게 퍼지는 불꽃 꽃잎 (과도한 폭발 없이 일반 타격 강도를 유지합니다)
function spawnFireballImpact(pool, projectile, reduced) {
  if (reduced) return;
  const heavy = projectile.type === 'pyroblast';
  const r = projectile.radius * (heavy ? 1.25 : 1);
  let active = 0;
  for (let i = 0; i < pool.length; i++) if (pool[i].fireTrail) active++;
  const count = Math.min(heavy ? 10 : 6, Math.max(0, FIRE_TRAIL_CAP + 20 - active));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 90 + Math.random() * 70;
    pool.push({
      fireTrail: true,
      kind: 'flame',
      x: projectile.targetX,
      y: projectile.targetY,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 20,
      perpX: 0, perpY: 0, phase: 0, waveAmp: 0,
      size: r * (1.6 + Math.random() * 0.8),
      colorCore: projectile.colorCore,
      colorMid: projectile.colorMid,
      ringRgb: projectile.ringRgb,
      life: 0,
      maxLife: 0.14 + Math.random() * 0.06
    });
  }
}

// 점액은 불꽃과 별도로 짧은 포물선과 접지 후 납작한 여운을 갖습니다.
let lastSlimeSplashAt = -Infinity;
function spawnSlimeSplash(pool, x, y, groundY, blue, strong, now, reduced, bounds = null) {
  if (reduced || now - lastSlimeSplashAt < (strong ? 0.055 : 0.09)) return;
  lastSlimeSplashAt = now;
  const available = Math.max(0, 48 - pool.filter(p => p.slimeDrop).length);
  const count = Math.min(available, strong ? 11 : 5);
  const size = bounds ? bounds.width : 180;
  const left = bounds ? bounds.x : x - size * 0.5;
  const top = bounds ? bounds.y : groundY - size * 0.875;
  // 원화의 측면 윤곽을 따라 분출하며 얼굴과 몸 중앙에는 생성하지 않습니다.
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
