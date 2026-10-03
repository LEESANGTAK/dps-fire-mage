/* 전투 시간에 맞춘 포즈 제어. 저장 데이터와 별개로 관리합니다. */
const mageGesture = { kind: '', remaining: 0, total: 0, hitStop: 0 };
const mageSpring = { x: 0, vx: 0, squash: 0, vs: 0, cloth: 0, vc: 0, time: 0, arm: 0, armVelocity: 0, pose: 'idle', weights: { idle: 1 } };
const mageSheet = typeof Image !== 'undefined' ? new Image() : null;
if (mageSheet) mageSheet.src = 'assets/art/comic-mage-poses.png';
// 원본의 칸 크기 대신 실제 발 위치와 지팡이 끝을 기준으로 정렬합니다.
const mageFrames = {
  idle: { box: [80, 65, 425, 430], foot: [228, 482], tip: [454, 210] },
  anticipation: { box: [590, 110, 380, 385], foot: [805, 482], tip: [643, 226] },
  charge: { box: [1090, 65, 420, 430], foot: [1290, 482], tip: [1445, 145] },
  release: { box: [20, 550, 580, 405], foot: [228, 941], tip: [555, 724] },
  recoil: { box: [600, 565, 420, 390], foot: [805, 941], tip: [925, 722] },
  hot: { box: [1065, 520, 445, 435], foot: [1290, 941], tip: [1465, 578] }
};

function advanceSpring(spring, dt, targetX, targetSquash) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    spring.vx += ((targetX - spring.x) * 270 - spring.vx * 23) * h;
    spring.x += spring.vx * h;
    spring.vs += ((targetSquash - spring.squash) * 320 - spring.vs * 25) * h;
    spring.squash += spring.vs * h;
    // 옷과 모자는 몸보다 느린 스프링으로 뒤따릅니다.
    spring.vc += ((spring.x - spring.cloth) * 110 - spring.vc * 14) * h;
    spring.cloth += spring.vc * h;
  }
}

// 반복 입력은 관절의 목표만 바꿉니다. 각도를 누적하거나 자세를 순간 이동시키지 않습니다.
function armTarget(combat, gesture) {
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  if (gesture.remaining > 0 && ['fireball', 'fireblast'].includes(gesture.kind)) {
    const p = 1 - gesture.remaining / gesture.total;
    // 발사 순간에 이미 겨냥하며, 작은 오버슈트 후 느리게 복귀합니다.
    if (p < 0.12) return 0.24 + 0.035 * Math.sin(p / 0.12 * Math.PI / 2);
    if (p < 0.72) return 0.275 * (1 - ease((p - 0.12) / 0.6));
    return -0.012 * Math.sin((p - 0.72) / 0.28 * Math.PI);
  }
  if (combat.castingSkill === 'fireball') {
    // 초반에 팔을 당겨 모으고 유지한 뒤, 끝에서 한 번 더 힘을 줍니다.
    const p = 1 - combat.castRemaining / Math.max(0.001, combat.castTotal);
    const strength = Math.min(1, Math.max(0.35, combat.castTotal / 0.6));
    return -(0.16 * ease(p / 0.28) + 0.04 * ease((p - 0.78) / 0.22)) * strength;
  }
  return 0;
}

function standingCastTarget(combat, gesture) {
  const angle = armTarget(combat, gesture);
  // 손의 추진을 상체에 연결하되 접지점과 최대 진폭은 유지합니다.
  return { lean: angle * 42, squash: Math.abs(angle) * 0.045 };
}

// 서로 다른 주기와 시차로 단순한 한 박자 반복을 피합니다.
function livingMageMotion(time, reduced, engaged) {
  if (reduced) return { breath: 1, shear: 0, wrist: 0, hat: 0, cloth: 0 };
  const quiet = engaged ? 0.35 : 1;
  return {
    breath: 1 + Math.sin(time * 1.8) * 0.012,
    shear: (Math.sin(time * 1.05) * 0.007 + Math.sin(time * 0.43) * 0.003) * quiet,
    wrist: Math.sin(time * 1.8 - 0.65) * 0.022 * quiet,
    hat: Math.sin(time * 1.05 - 0.9) * 4 * quiet,
    cloth: Math.sin(time * 1.4 - 1.2) * 3 * quiet
  };
}

function renderStandingMage(context, art, dt, reduced) {
  const spring = mageSpring;
  const engaged = state.combat.castingSkill || mageGesture.remaining > 0;
  const idle = livingMageMotion(spring.time, reduced, engaged);
  const body = standingCastTarget(state.combat, mageGesture);
  if (reduced) {
    spring.x = spring.vx = spring.squash = spring.vs = spring.cloth = spring.vc = 0;
  } else {
    advanceSpring(spring, dt, body.lean, body.squash);
    idle.shear -= spring.x / 320;
    idle.breath *= 1 - spring.squash;
    idle.cloth += (spring.cloth - spring.x) * 0.45;
    idle.hat += (spring.cloth - spring.x) * 0.35;
  }
  const target = reduced ? 0 : armTarget(state.combat, mageGesture) + idle.wrist;
  // 발사 자세는 피해·투사체 생성과 같은 프레임에 맞춥니다.
  spring.arm = target;
  spring.armVelocity = 0;
  const frame = mageFrames.idle;
  const [sx, sy, w, h] = frame.box;
  const ox = 294 - frame.foot[0], oy = 638 - frame.foot[1];
  const pivot = [302, 329];
  const wrist = [345, 329];
  // 소매와 팔의 회전이 주동작이며 손목·지팡이는 작게 뒤따릅니다.
  const elbowAngle = spring.arm * 0.72;
  const wristAngle = spring.arm * 0.28;
  // 소매·손·지팡이만 분리합니다. 관절 안쪽은 겹쳐 회전할 때 빈틈을 막습니다.
  const outline = [[296,310],[326,300],[356,308],[397,252],[413,194],[452,161],[500,191],[502,239],[427,271],[366,343],[337,400],[301,384]];
  function armPath() {
    context.moveTo(outline[0][0], outline[0][1]);
    for (const point of outline.slice(1)) context.lineTo(...point);
    context.closePath();
  }
  context.clearRect(0, 0, 640, 640);
  context.save(); context.translate(ox, oy);
  // 발 위치를 중심으로 호흡과 무게 이동을 적용해 접지를 유지합니다.
  context.transform(1, 0, idle.shear, idle.breath, -idle.shear * 482, 482 * (1 - idle.breath));
  context.save(); context.beginPath(); context.rect(sx, sy, w, h); armPath(); context.clip('evenodd');
  for (let row = 0; row < h; row += 6) {
    const sourceY = sy + row;
    const influence = Math.max(0, Math.min(1, (482 - sourceY) / 180));
    const hat = sourceY < 270 ? idle.hat * Math.pow((270 - sourceY) / 205, 2) : 0;
    const hem = sourceY > 370 && sourceY < 450 ? idle.cloth * Math.sin((sourceY - 370) / 80 * Math.PI) : 0;
    const strip = Math.min(6, h - row);
    context.drawImage(mageSheet, sx, sourceY, w, strip, sx + (hat + hem) * influence, sourceY, w, strip + 0.3);
  }
  context.restore();
  context.save(); context.translate(...pivot); context.rotate(elbowAngle); context.translate(-pivot[0], -pivot[1]);
  function handPath() {
    context.moveTo(333, 310); context.lineTo(355, 304); context.lineTo(397, 252);
    context.lineTo(413, 194); context.lineTo(452, 161); context.lineTo(500, 191);
    context.lineTo(502, 239); context.lineTo(427, 271); context.lineTo(369, 344);
    context.lineTo(334, 348); context.closePath();
  }
  context.save(); context.beginPath(); armPath(); handPath(); context.clip('evenodd');
  context.drawImage(mageSheet, sx, sy, w, h, sx, sy, w, h); context.restore();
  context.translate(...wrist); context.rotate(wristAngle); context.translate(-wrist[0], -wrist[1]);
  context.beginPath(); handPath(); context.clip();
  context.drawImage(mageSheet, sx, sy, w, h, sx, sy, w, h); context.restore(); context.restore();
  const dx = frame.tip[0] - wrist[0], dy = frame.tip[1] - wrist[1];
  const localX = wrist[0] - pivot[0] + dx * Math.cos(wristAngle) - dy * Math.sin(wristAngle);
  const localY = wrist[1] - pivot[1] + dx * Math.sin(wristAngle) + dy * Math.cos(wristAngle);
  const x = ox + pivot[0] + localX * Math.cos(elbowAngle) - localY * Math.sin(elbowAngle);
  const y = oy + pivot[1] + localX * Math.sin(elbowAngle) + localY * Math.cos(elbowAngle);
  art.style.setProperty('--muzzle-x', `${(x + idle.shear * (y - oy - 482)) / 640 * 100}%`);
  art.style.setProperty('--muzzle-y', `${(oy + 482 + (y - oy - 482) * idle.breath) / 640 * 100}%`);
}

function renderMage(art, pose, dt, reduced) {
  const surface = document.getElementById('mage-pose-canvas');
  if (!surface || !surface.getContext || !mageSheet || !mageSheet.complete || !mageSheet.naturalWidth) return;
  const context = surface.getContext('2d');
  const spring = mageSpring;
  spring.time += dt;
  if (pose === 'idle') {
    renderStandingMage(context, art, dt, reduced);
    spring.weights = { idle: 1 }; spring.pose = 'idle';
    return;
  }
  const strength = mageGesture.kind === 'pyroblast' ? 1.45 : 1;
  let lean = 0, squash = 0;
  if (pose === 'anticipation') { lean = -16; squash = 0.07; }
  if (pose === 'charge') { lean = -9; squash = 0.035; }
  if (pose === 'release') { lean = 27 * strength; squash = -0.07 * strength; }
  if (pose === 'recoil') { lean = -13 * strength; squash = 0.065 * strength; }
  if (pose === 'hot') { lean = 2; squash = -0.025; }
  if (reduced) { spring.x = 0; spring.squash = 0; spring.cloth = 0; }
  else advanceSpring(spring, dt, lean, squash);
  // 짧은 포즈 연결과 연속 변형을 함께 사용해 딱 끊기는 전환을 완화합니다.
  const blend = reduced || dt === 0 ? 0 : 1 - Math.exp(-dt / 0.035);
  for (const key of Object.keys(mageFrames)) {
    const target = key === pose ? 1 : 0;
    spring.weights[key] = (spring.weights[key] || 0) + (target - (spring.weights[key] || 0)) * blend;
  }
  if (reduced || (pose === 'release' && spring.pose !== pose)) spring.weights = { [pose]: 1 };
  spring.pose = pose;
  context.clearRect(0, 0, 640, 640);
  const footX = 294, footY = 638;
  const breath = reduced ? 0 : Math.sin(spring.time * 2.6) * 0.006;
  const scaleX = 1 + spring.squash;
  const scaleY = 1 - spring.squash + breath;
  context.save();
  context.translate(footX, footY);
  context.scale(scaleX, scaleY);
  for (const [key, frame] of Object.entries(mageFrames)) {
    const weight = spring.weights[key] || 0;
    if (weight < 0.005) continue;
    context.globalAlpha = weight;
    const [sx, sy, width, height] = frame.box;
    // 수평 띠를 휘게 그려 발은 고정하고 상체와 옷자락에 관성 차이를 줍니다.
    for (let row = 0; row < height; row += 6) {
      const sourceY = sy + row;
      const influence = Math.max(0, Math.min(1, (frame.foot[1] - sourceY) / 270));
      const overlap = (spring.cloth - spring.x) * Math.sin(influence * Math.PI) * 0.65;
      const offset = spring.x * influence * influence + overlap;
      const stripHeight = Math.min(6, height - row);
      context.drawImage(mageSheet, sx, sourceY, width, stripHeight,
        sx - frame.foot[0] + offset, sourceY - frame.foot[1], width, stripHeight + 0.4);
    }
  }
  context.restore();
  const frame = mageFrames[pose];
  const influence = Math.max(0, Math.min(1, (frame.foot[1] - frame.tip[1]) / 270));
  const muzzleX = footX + (frame.tip[0] - frame.foot[0] + spring.x * influence * influence) * scaleX;
  const muzzleY = footY + (frame.tip[1] - frame.foot[1]) * scaleY;
  art.style.setProperty('--muzzle-x', `${muzzleX / 640 * 100}%`);
  art.style.setProperty('--muzzle-y', `${muzzleY / 640 * 100}%`);
}

function selectMagePose(combat, gesture) {
  if (gesture.remaining > 0) {
    const progress = 1 - gesture.remaining / gesture.total;
    if (gesture.kind === 'combustion') return 'hot';
    if (gesture.kind !== 'pyroblast') return 'idle';
    return progress < 0.28 ? 'release' : progress < 0.72 ? 'recoil' : 'idle';
  }
  if (combat.castingSkill === 'fireball') return 'idle';
  if (combat.castingSkill) {
    const progress = 1 - combat.castRemaining / Math.max(0.001, combat.castTotal);
    return progress < 0.32 ? 'anticipation' : 'charge';
  }
  // 몰열 준비는 기존 UI 광채로 읽습니다. 매 치명타마다 몸 자세를 바꾸지 않습니다.
  if (combat.combustionRem > 0) return 'hot';
  return 'idle';
}

function beginMageGesture(kind) {
  mageGesture.kind = kind;
  mageGesture.total = kind === 'pyroblast' ? 0.38 : kind === 'combustion' ? 0.5 : 0.3;
  mageGesture.remaining = mageGesture.total;
  // 발사 함수 안에서 즉시 자세를 바꿔 투사체와 한 프레임에 맞춥니다.
  updateMageMotion(0, false);
}

function updateMageMotion(dt, paused) {
  const art = document.getElementById('mage-art');
  if (!art) return;
  art.classList.toggle('motion-paused', paused);
  const arena = document.getElementById('combat-arena');
  if (arena && arena.classList) arena.classList.toggle('living-paused', paused);
  if (paused) return;
  const target = document.getElementById('dummy-avatar');
  const stopped = mageGesture.hitStop > 0;
  if (target && target.classList) target.classList.toggle('impact-stop', stopped);
  if (stopped) {
    mageGesture.hitStop = Math.max(0, mageGesture.hitStop - dt);
    return;
  }
  mageGesture.remaining = Math.max(0, mageGesture.remaining - dt);
  const pose = selectMagePose(state.combat, mageGesture);
  if (art.dataset.pose !== pose) art.dataset.pose = pose;
  art.dataset.heavy = mageGesture.remaining > 0 && mageGesture.kind === 'pyroblast' ? 'true' : 'false';
  const combat = state.combat;
  const progress = combat.castingSkill ? Math.min(1, Math.max(0, 1 - combat.castRemaining / combat.castTotal)) : 0;
  art.style.setProperty('--charge', String(progress * progress));
  art.classList.toggle('motion-combustion', combat.combustionRem > 0);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderMage(art, pose, dt, reduced);
}

// 포즈 전환 경계는 브라우저 없이도 검증할 수 있습니다.
if (typeof module !== 'undefined') module.exports = { selectMagePose, advanceSpring, mageFrames, armTarget, livingMageMotion, standingCastTarget };
