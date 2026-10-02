/* 전투 시간에 맞춘 포즈 제어. 저장 데이터와 별개로 관리합니다. */
const mageGesture = { kind: '', remaining: 0, total: 0 };

function selectMagePose(combat, gesture) {
  if (gesture.remaining > 0) {
    const progress = 1 - gesture.remaining / gesture.total;
    if (gesture.kind === 'combustion') return 'hot';
    return progress < 0.28 ? 'release' : progress < 0.72 ? 'recoil' : 'idle';
  }
  if (combat.castingSkill) {
    const progress = 1 - combat.castRemaining / Math.max(0.001, combat.castTotal);
    return progress < 0.32 ? 'anticipation' : 'charge';
  }
  if (combat.critStreak === 2 || combat.combustionRem > 0) return 'hot';
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
  if (paused) return;
  mageGesture.remaining = Math.max(0, mageGesture.remaining - dt);
  const pose = selectMagePose(state.combat, mageGesture);
  if (art.dataset.pose !== pose) art.dataset.pose = pose;
  art.dataset.heavy = mageGesture.remaining > 0 && mageGesture.kind === 'pyroblast' ? 'true' : 'false';
  const combat = state.combat;
  const progress = combat.castingSkill ? Math.min(1, Math.max(0, 1 - combat.castRemaining / combat.castTotal)) : 0;
  art.style.setProperty('--charge', String(progress * progress));
  art.classList.toggle('motion-combustion', combat.combustionRem > 0);
}

// 포즈 전환 경계는 브라우저 없이도 검증할 수 있습니다.
if (typeof module !== 'undefined') module.exports = { selectMagePose };
