/* 종이 원화의 네 핵심 포즈를 실제 시전 사건에 연결합니다. 피해·쿨다운·저장 데이터는 변경하지 않습니다. */
const mageGesture = { kind: '', remaining: 0, total: 0, hitStop: 0 };
const mageMotion = { time: 0 };
const mageSheet = typeof Image !== 'undefined' ? new Image() : null;
if (mageSheet) mageSheet.src = 'assets/art/paper-mage-poses.png';
const magePaperFrames = typeof PAPER_ART_FRAMES !== 'undefined' ? PAPER_ART_FRAMES.mage : require('./paper-art.js').mage;
// 기모으기는 준비 원화, 발화는 대기 원화와 기존 화염 오라를 사용합니다.
const mageFrames = {
  idle: magePaperFrames.idle, anticipation: magePaperFrames.anticipation,
  charge: magePaperFrames.anticipation, release: magePaperFrames.release,
  recoil: magePaperFrames.recoil, hot: magePaperFrames.idle
};
function livingMageMotion(time, reduced, engaged) {
  const heldTime = Math.floor(time * 12) / 12;
  return { breathY: 1, breathX: 1, lean: reduced || engaged ? 0 : Math.sin(heldTime * 1.1) * .008 };
}
function selectMagePose(combat, gesture) {
  if (gesture.remaining > 0 && gesture.kind === 'combustion') return 'hot';
  // 발사는 다음 자동 시전이나 발화 오라보다 우선하며 실제 지팡이 끝과 출발점을 일치시킵니다.
  if (gesture.remaining > 0) {
    const p = 1 - gesture.remaining / Math.max(.001, gesture.total);
    if (gesture.kind === 'fireball' || gesture.kind === 'fireblast') return p < .55 ? 'release' : 'recoil';
    return p < .38 ? 'release' : p < .82 ? 'recoil' : 'idle';
  }
  if (combat.combustionRem > 0) return 'hot';
  if (combat.castingSkill === 'fireball') return 'anticipation';
  if (combat.castingSkill) {
    const p = 1 - combat.castRemaining / Math.max(.001, combat.castTotal);
    return p < .32 ? 'anticipation' : 'charge';
  }
  return 'idle';
}
function beginMageGesture(kind) {
  mageGesture.kind = kind;
  mageGesture.total = kind === 'meteor' ? .42 : kind === 'combustion' ? .5 : .14;
  mageGesture.remaining = mageGesture.total;
  updateMageMotion(0, false, true);
}
function getMagePlacement(pose, angle = 0) {
  const frame = mageFrames[pose] || mageFrames.idle;
  const foot = [294, 638], dx = frame.tip[0] - frame.foot[0], dy = frame.tip[1] - frame.foot[1];
  return { frame, foot, angle, muzzle: [
    foot[0] + dx * Math.cos(angle) - dy * Math.sin(angle),
    foot[1] + dx * Math.sin(angle) + dy * Math.cos(angle)
  ] };
}
function renderMage(art, pose, dt, reduced) {
  mageMotion.time += dt;
  const engaged = Boolean(state.combat.castingSkill || mageGesture.remaining > 0 || state.combat.combustionRem > 0);
  const angle = livingMageMotion(mageMotion.time, reduced, engaged).lean;
  const placement = getMagePlacement(pose, angle);
  const surface = document.getElementById('mage-pose-canvas');
  if (surface && surface.getContext) {
    const context = surface.getContext('2d');
    context.clearRect(0, 0, 640, 640);
    if (mageSheet && mageSheet.complete && mageSheet.naturalWidth) {
      const frame = placement.frame, [sx, sy, width, height] = frame.box;
      context.save(); context.translate(...placement.foot); context.rotate(angle);
      // 포즈 혼합·전신 스프링 변형 없이 동일 축척으로 원화를 교체하고 발 원점을 고정합니다.
      context.drawImage(mageSheet, sx, sy, width, height, sx - frame.foot[0], sy - frame.foot[1], width, height);
      context.restore();
    }
  }
  // 이미지 로딩 중에도 메타데이터로 발사 위치를 계산합니다.
  art.style.setProperty('--muzzle-x', `${placement.muzzle[0] / 640 * 100}%`);
  art.style.setProperty('--muzzle-y', `${placement.muzzle[1] / 640 * 100}%`);
}
function updateMageMotion(dt, paused, immediate = false) {
  if (typeof updatePaperSlime === 'function') updatePaperSlime(dt, paused || (!immediate && mageGesture.hitStop > 0));
  const art = document.getElementById('mage-art');
  if (!art) return;
  art.classList.toggle('motion-paused', paused);
  const arena = document.getElementById('combat-arena');
  if (arena && arena.classList) arena.classList.toggle('living-paused', paused);
  if (paused) return;
  const target = document.getElementById('dummy-avatar');
  const stopped = mageGesture.hitStop > 0;
  if (target && target.classList) target.classList.toggle('impact-stop', stopped);
  if (stopped && !immediate) { mageGesture.hitStop = Math.max(0, mageGesture.hitStop - dt); return; }
  mageGesture.remaining = Math.max(0, mageGesture.remaining - dt);
  const pose = selectMagePose(state.combat, mageGesture);
  art.dataset.pose = pose;
  art.dataset.heavy = mageGesture.remaining > 0 && mageGesture.kind === 'meteor' ? 'true' : 'false';
  const combat = state.combat;
  const p = combat.castingSkill ? Math.min(1, Math.max(0, 1 - combat.castRemaining / combat.castTotal)) : 0;
  art.style.setProperty('--charge', String(p * p));
  art.classList.toggle('motion-combustion', combat.combustionRem > 0);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderMage(art, pose, dt, reduced);
}
if (typeof module !== 'undefined') module.exports = { selectMagePose, mageFrames, livingMageMotion, getMagePlacement };
