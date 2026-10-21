/* Esc 일시정지 메뉴.
 * - 여는 방법: Esc, 상단 ⏸ 버튼, 창이 포커스를 잃거나 최소화될 때 자동.
 * - 모달 정지(state.isPaused: 각성 카드·결과창)와 따로 움직이는 '메뉴 정지'입니다. 메뉴를 닫아도 열려 있던 모달은 그대로 멈춰 있습니다.
 * - 메뉴가 열려 있는 동안 전투·투사체·쿨다운·시전·스피드런 시계·전장 애니메이션이 모두 멈춥니다(game.js gameLoop).
 * - [계속]을 누르면 메뉴가 닫힌 뒤 짧은 복귀 호흡(PAUSE_RESUME_BREATH_MS) 동안 계속 멈춰 있다가 재개합니다.
 * - [게임 종료]는 데스크톱 빌드에만 보입니다(마지막 저장 후 창을 닫음). */
const PAUSE_RESUME_BREATH_MS = 600;

let menuPaused = false;
let pauseResumeTimer = null;
let pauseWindowFocused = false; // 한 번이라도 포커스를 받은 창만 자동 정지합니다(숨김 창으로 도는 스모크 테스트·스토어 촬영 보호).

function isMenuPaused() {
  return menuPaused;
}

function canQuitGame() {
  return typeof window !== 'undefined' && Boolean(window.desktopApp) && typeof window.desktopApp.quit === 'function';
}

function renderPauseMenuInfo() {
  const stageEl = document.getElementById('pause-menu-stage');
  const timeEl = document.getElementById('pause-menu-time');
  if (stageEl && typeof state === 'object') {
    const total = typeof FINAL_STAGE === 'number' ? FINAL_STAGE : 20;
    stageEl.textContent = tr('{stage} / {total} 스테이지', { stage: state.currentStage, total });
  }
  if (timeEl && typeof state === 'object' && typeof splitSpeedrunTime === 'function') {
    const t = splitSpeedrunTime(state.playTimeSec || 0);
    timeEl.textContent = `${t.main}${t.ms}`;
  }
}

// 메뉴가 열리면 시전음·불타는 소리처럼 계속 도는 효과음을 멈춥니다(재개 후 전투 루프가 필요하면 다시 켭니다).
function pauseCombatLoopSounds() {
  // 두 오디오는 game.js의 최상위 상수입니다(이 파일보다 늦게 실행되지만, 메뉴를 여는 시점에는 이미 있습니다).
  try { if (!fireballCastAudio.paused) fireballCastAudio.pause(); } catch (e) { /* 오디오 미준비 */ }
  try { if (!burningLoopAudio.paused) burningLoopAudio.pause(); } catch (e) { /* 오디오 미준비 */ }
}

function openPauseMenu(reason = 'manual') {
  if (pauseResumeTimer) {
    // 복귀 호흡 중에 다시 열면 그대로 정지 상태를 유지합니다.
    clearTimeout(pauseResumeTimer);
    pauseResumeTimer = null;
  } else if (menuPaused) {
    return false;
  }
  menuPaused = true;
  pauseCombatLoopSounds();
  if (typeof closeSettings === 'function') closeSettings(); // 항상 메뉴 첫 화면부터 엽니다.
  renderPauseMenuInfo();
  const quitBtn = document.getElementById('btn-pause-quit');
  if (quitBtn) quitBtn.hidden = !canQuitGame();
  const backdrop = document.getElementById('pause-menu-backdrop');
  if (backdrop) {
    backdrop.dataset.reason = reason;
    backdrop.classList.remove('hidden', 'pause-closing');
  }
  if (document.body) {
    document.body.classList.add('game-menu-paused');
    document.body.classList.remove('game-menu-resuming');
  }
  const resumeBtn = document.getElementById('btn-pause-resume');
  if (resumeBtn && typeof resumeBtn.focus === 'function') {
    try { resumeBtn.focus({ preventScroll: true }); } catch (e) { /* 무시 */ }
  }
  return true;
}

function resumeFromPauseMenu() {
  if (!menuPaused || pauseResumeTimer) return false;
  const backdrop = document.getElementById('pause-menu-backdrop');
  if (backdrop) backdrop.classList.add('pause-closing');
  if (document.body) document.body.classList.add('game-menu-resuming');
  // 메뉴가 닫히는 동안에도 시계는 멈춰 있습니다. 손을 다시 올릴 시간을 준 뒤 재개합니다.
  pauseResumeTimer = setTimeout(() => {
    pauseResumeTimer = null;
    menuPaused = false;
    if (backdrop) backdrop.classList.add('hidden');
    if (document.body) document.body.classList.remove('game-menu-paused', 'game-menu-resuming');
  }, PAUSE_RESUME_BREATH_MS);
  return true;
}

function togglePauseMenu() {
  if (menuPaused && !pauseResumeTimer) return resumeFromPauseMenu();
  return openPauseMenu('manual');
}

function quitGameFromPauseMenu() {
  if (!canQuitGame()) return;
  try { if (typeof saveGame === 'function') saveGame(); } catch (e) { /* 저장 실패해도 종료는 진행(창 닫기 직전에 한 번 더 저장) */ }
  window.desktopApp.quit();
}

// 자동 정지: 이미 모달로 멈춰 있거나 런이 끝난 상태라면 메뉴를 덮지 않습니다(돌아왔을 때 보던 창이 그대로 보이게).
function autoPauseOnFocusLoss() {
  if (!pauseWindowFocused || menuPaused) return;
  if (typeof state === 'object' && (state.isPaused || state.runFailed)) return;
  openPauseMenu('focus');
}

function initPauseMenu() {
  const resumeBtn = document.getElementById('btn-pause-resume');
  const quitBtn = document.getElementById('btn-pause-quit');
  const topBtn = document.getElementById('btn-pause');
  if (resumeBtn) resumeBtn.addEventListener('click', resumeFromPauseMenu);
  if (quitBtn) {
    quitBtn.hidden = !canQuitGame();
    quitBtn.addEventListener('click', quitGameFromPauseMenu);
  }
  if (topBtn) topBtn.addEventListener('click', () => openPauseMenu('manual'));

  // 문서 캡처 단계에서 받습니다. 메테오 안내 말풍선은 창 캡처 단계에서 Esc를 먼저 받아 전파를 멈추므로(말풍선만 닫힘) 여기까지 오지 않습니다.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.repeat) return;
    // 최종 보스 이야기 말풍선이 열려 있으면 Esc로 그것만 닫습니다.
    if (document.querySelector('.story-open')) return;
    e.preventDefault();
    // 설정 화면에서는 Esc가 '뒤로'입니다(일시정지는 유지).
    if (typeof isSettingsOpen === 'function' && isSettingsOpen()) {
      closeSettings();
      return;
    }
    togglePauseMenu();
  }, true);

  if (typeof document.hasFocus === 'function' && document.hasFocus()) pauseWindowFocused = true;
  window.addEventListener('focus', () => { pauseWindowFocused = true; });
  window.addEventListener('pointerdown', () => { pauseWindowFocused = true; }, true);
  window.addEventListener('blur', autoPauseOnFocusLoss);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoPauseOnFocusLoss();
  });
}
