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

function advanceSpring(spring, dt, targetX, targetSquash, response = 1) {
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    spring.vx += ((targetX - spring.x) * 270 * response * response - spring.vx * 23 * response) * h;
    spring.x += spring.vx * h;
    spring.vs += ((targetSquash - spring.squash) * 320 * response * response - spring.vs * 25 * response) * h;
    spring.squash += spring.vs * h;
    // 옷과 모자는 몸보다 느린 스프링으로 뒤따릅니다.
    spring.vc += ((spring.x - spring.cloth) * 110 - spring.vc * 14) * h;
    spring.cloth += spring.vc * h;
  }
}

// 반복 입력은 관절의 목표만 바꿉니다. 각도를 누적하거나 자세를 순간 이동시키지 않습니다.
function armTarget(combat, gesture) {
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const snap = t => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 4);
  if (gesture.remaining > 0 && ['fireball', 'fireblast'].includes(gesture.kind)) {
    const p = 1 - gesture.remaining / gesture.total;
    // 발사와 동시에 뻗고 18ms 안에 끝 자세에 도달한 뒤 잠깐 유지합니다.
    if (p < 0.06) return 0.24 + 0.035 * snap(p / 0.06);
    if (p < 0.2) return 0.275;
    if (p < 0.72) return 0.275 * (1 - ease((p - 0.2) / 0.52));
    return -0.012 * Math.sin((p - 0.72) / 0.28 * Math.PI);
  }
  if (combat.castingSkill === 'fireball') {
    // 긴 시전에서도 팔 올리기는 70ms 안에 끝내고 모으는 자세를 유지합니다.
    const p = 1 - combat.castRemaining / Math.max(0.001, combat.castTotal);
    const strength = Math.min(1, Math.max(0.35, combat.castTotal / 0.6));
    const raiseTime = Math.min(0.07, combat.castTotal * 0.16);
    const elapsed = combat.castTotal - combat.castRemaining;
    return -(0.16 * snap(elapsed / Math.max(0.001, raiseTime)) + 0.04 * snap((p - 0.88) / 0.12)) * strength;
  }
  return 0;
}

function standingCastTarget(combat, gesture) {
  const angle = armTarget(combat, gesture);
  // 손의 추진을 상체에 연결하되 접지점과 최대 진폭은 유지합니다.
  return { lean: angle * 42, squash: Math.abs(angle) * 0.045 };
}

// 서로 다른 주기와 시차로 살아있는 대기 호흡 모션 구현
function livingMageMotion(time, reduced, engaged) {
  if (reduced) return { breathY: 1, breathX: 1, lean: 0 };
  const quiet = engaged ? 0.2 : 1;
  const breath = Math.sin(time * 2.2) * 0.015 * quiet;
  const sway = Math.sin(time * 1.1) * 0.008 * quiet;
  return {
    breathY: 1 + breath,
    breathX: 1 - breath * 0.5,
    lean: sway
  };
}

function selectMagePose(combat, gesture) {
  if (gesture.remaining > 0 && gesture.kind === 'combustion') return 'hot';
  if (combat.combustionRem > 0) return 'hot';

  // 1. 발사 제스처: 자동 시전으로 다음 시전이 즉시 시작되어도 발사 동작(release)을 확실히 표출
  if (gesture.remaining > 0) {
    if (gesture.kind === 'fireball' || gesture.kind === 'fireblast') {
      return 'release';
    }
    const progress = 1 - gesture.remaining / gesture.total;
    return progress < 0.38 ? 'release' : progress < 0.82 ? 'recoil' : 'idle';
  }

  // 2. 시전 중: 발사 제스처 완료 후 다음 발사를 위한 준비 동작(anticipation) 유지
  if (combat.castingSkill === 'fireball') {
    return 'anticipation';
  }
  if (combat.castingSkill) {
    const progress = 1 - combat.castRemaining / Math.max(0.001, combat.castTotal);
    return progress < 0.32 ? 'anticipation' : 'charge';
  }

  return 'idle';
}

function beginMageGesture(kind) {
  mageGesture.kind = kind;
  mageGesture.total = kind === 'meteor' ? 0.42 : kind === 'combustion' ? 0.5 : 0.14;
  mageGesture.remaining = mageGesture.total;
  updateMageMotion(0, false);
}

function renderMage(art, pose, dt, reduced) {
  const surface = document.getElementById('mage-pose-canvas');
  if (!surface || !surface.getContext || !mageSheet || !mageSheet.complete || !mageSheet.naturalWidth) return;
  const context = surface.getContext('2d');
  const spring = mageSpring;
  spring.time += dt;

  const engaged = Boolean(state.combat.castingSkill || mageGesture.remaining > 0);
  const idle = livingMageMotion(spring.time, reduced, engaged);

  // 포즈별 동적 스쿼시 & 스트레치 (화염구 난사 시 정신 사납지 않도록 절제된 수치 적용)
  let targetSquash = 0;
  let targetLean = 0;
  if (!reduced) {
    if (pose === 'anticipation') {
      // 화염구 준비 동작: 과도한 쏠림 없이 단정하게 기를 모으는 수축
      targetSquash = 0.015;
      targetLean = -0.008;
    }
    else if (pose === 'charge') {
      targetSquash = 0.035;
      targetLean = -0.015;
    }
    else if (pose === 'release') {
      // 화염구 발사 동작: 난사 시 덜컹거림 없는 안정적 추진력
      const isHeavy = mageGesture.kind === 'meteor';
      targetSquash = isHeavy ? -0.06 : -0.015;
      targetLean = isHeavy ? 0.045 : 0.010;
    }
    else if (pose === 'recoil') {
      targetSquash = 0.03;
      targetLean = -0.015;
    }
    else if (pose === 'hot') {
      targetSquash = -0.025;
      targetLean = 0.01;
    }
  }

  advanceSpring(spring, dt, targetLean * 100, targetSquash, engaged ? 1.6 : 1.2);

  context.clearRect(0, 0, 640, 640);

  const frame = mageFrames[pose] || mageFrames.idle;
  const [sx, sy, width, height] = frame.box;

  // 발바닥 접지점 (Foot Ground Anchor)
  const footX = 294;
  const footY = 638;

  const finalScaleX = (1 - spring.squash) * idle.breathX;
  const finalScaleY = (1 + spring.squash) * idle.breathY;
  const finalAngle = idle.lean + (spring.x / 100);

  context.save();
  // 발바닥을 축으로 변환하여 지면에 견고하게 접지
  context.translate(footX, footY);
  context.scale(finalScaleX, finalScaleY);
  context.rotate(finalAngle);

  // 온전한 원본 스프라이트 렌더링 (가위질 찌꺼기 및 슬라이스 아티팩트 원천 차단)
  const drawX = -frame.foot[0] + sx;
  const drawY = -frame.foot[1] + sy;
  context.drawImage(mageSheet, sx, sy, width, height, drawX, drawY, width, height);

  context.restore();

  // 지팡이 끝 발사 위치 갱신
  const tipRelX = frame.tip[0] - frame.foot[0];
  const tipRelY = frame.tip[1] - frame.foot[1];
  const cos = Math.cos(finalAngle);
  const sin = Math.sin(finalAngle);
  const rotatedTipX = (tipRelX * cos - tipRelY * sin) * finalScaleX;
  const rotatedTipY = (tipRelX * sin + tipRelY * cos) * finalScaleY;
  const muzzleX = footX + rotatedTipX;
  const muzzleY = footY + rotatedTipY;

  art.style.setProperty('--muzzle-x', `${(muzzleX / 640) * 100}%`);
  art.style.setProperty('--muzzle-y', `${(muzzleY / 640) * 100}%`);
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
  art.dataset.heavy = mageGesture.remaining > 0 && mageGesture.kind === 'meteor' ? 'true' : 'false';
  const combat = state.combat;
  const progress = combat.castingSkill ? Math.min(1, Math.max(0, 1 - combat.castRemaining / combat.castTotal)) : 0;
  art.style.setProperty('--charge', String(progress * progress));
  art.classList.toggle('motion-combustion', combat.combustionRem > 0);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderMage(art, pose, dt, reduced);
}

// 포즈 전환 경계는 브라우저 없이도 검증할 수 있습니다.
if (typeof module !== 'undefined') module.exports = { selectMagePose, advanceSpring, mageFrames, armTarget, livingMageMotion, standingCastTarget };
