/* 타이틀 화면.
 * 게임을 켜면 먼저 뜹니다. 뒤 전장은 숨 쉬는 마법사와 배경만 흐르고 전투·스피드런 시계는 멈춰 있습니다(game.js gameLoop).
 * 버튼은 해금될 때만 나타납니다.
 *   - 첫 실행(세이브 없음): [▶ 시작] 하나. 누르면 바로 1스테이지.
 *   - 진행 중인 런: [▶ 이어하기](스테이지·시간). 런을 한 번이라도 마쳤다면 [⚡ 새 런](진행 중이면 한 번 더 눌러 포기 확인).
 *   - 끝났지만 결과를 아직 못 본 런: [▶ 이어하기] = 결과창(숙련도 연출)을 엽니다.
 *   - 끝난 런: [⚡ 새 런]. 업화 단계·시작 주문서를 고를 수 있으면 새 런 설정 칸을 먼저 펼칩니다.
 *   - 첫 최종 보스 토벌 이후: [🏆 명예의 전당].
 *   - 모서리: [⚙ 설정], [⏻ 게임 종료](데스크톱만).
 * 일시정지 메뉴의 [🏠 타이틀로]로 돌아올 수 있습니다(런은 저장된 채 유지). */
const TITLE_LEAVE_MS = 800;
const TITLE_NEW_RUN_CONFIRM_MS = 3000;

let titleOpen = false;
let titleHadSave = true;
let titleLeaveTimer = null;
let titleNewRunArmed = null;
let runSetupHome = null; // 결과창 안의 새 런 설정 칸 원래 자리

function isTitleOpen() {
  return titleOpen;
}

// 'first' 첫 실행 · 'progress' 진행 중 · 'result' 끝났지만 결과 미확인 · 'ended' 끝남
function getTitleRunStatus() {
  if (!titleHadSave) return 'first';
  if (state.runFailed || state.runRewarded) {
    return state.meta && state.meta.lastRun && state.meta.lastRun.shown === false ? 'result' : 'ended';
  }
  return 'progress';
}

function hasRunSetupChoices() {
  const meta = state.meta;
  return meta.infernoUnlocked > 0 || getUnlockedStartSpells(meta.xp, meta.infernoUnlocked).length > 0;
}

function titleContinueInfo() {
  if (getTitleRunStatus() === 'result') return tr('결과 보기');
  const t = typeof splitSpeedrunTime === 'function' ? splitSpeedrunTime(state.playTimeSec || 0) : { main: '', ms: '' };
  return `STAGE ${state.currentStage} / ${FINAL_STAGE} · ${t.main}`;
}

function renderTitleScreen() {
  const status = getTitleRunStatus();
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; return el; };
  const hasFinishedRun = Boolean(state.meta && state.meta.lastRun);
  show('btn-title-start', status === 'first');
  show('btn-title-continue', status === 'progress' || status === 'result');
  show('btn-title-new-run', status === 'ended' || ((status === 'progress' || status === 'result') && hasFinishedRun));
  show('btn-title-hall', status !== 'first' && Boolean(state.unfolded && state.unfolded.hallOfFame));
  show('btn-title-quit', typeof canQuitGame === 'function' && canQuitGame());
  const info = document.getElementById('title-continue-info');
  if (info) info.textContent = titleContinueInfo();
  // 가장 먼저 보이는 큰 버튼 하나만 주황 종이(주 행동)로 칠합니다.
  const order = ['btn-title-start', 'btn-title-continue', 'btn-title-new-run'];
  const primary = order.find((id) => { const el = document.getElementById(id); return el && !el.hidden; });
  for (const id of order) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('title-primary', id === primary);
  }
  disarmTitleNewRun();
  showTitleNewRunPanel(false);
}

function openTitleScreen() {
  const el = document.getElementById('title-screen');
  if (!el) return false;
  if (titleLeaveTimer) { clearTimeout(titleLeaveTimer); titleLeaveTimer = null; }
  titleOpen = true;
  renderTitleScreen();
  el.classList.remove('hidden', 'title-leaving');
  // 다시 열 때마다 등장 연출을 처음부터 재생합니다.
  void el.offsetWidth;
  el.classList.add('title-entering');
  if (document.body) document.body.classList.add('title-open');
  if (typeof pauseCombatLoopSounds === 'function') pauseCombatLoopSounds();
  const first = ['btn-title-start', 'btn-title-continue', 'btn-title-new-run'].map((id) => document.getElementById(id)).find((b) => b && !b.hidden);
  if (first && typeof first.focus === 'function') { try { first.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
  return true;
}

// 로고가 위로 빠지고 버튼이 떨어지는 동안(0.8초)도 전투는 멈춰 있습니다. instant는 결과창처럼 바로 다음 창을 띄울 때 씁니다.
function closeTitleScreen(instant = false) {
  if (!titleOpen) return false;
  const el = document.getElementById('title-screen');
  disarmTitleNewRun();
  const finish = () => {
    titleLeaveTimer = null;
    titleOpen = false;
    if (el) el.classList.add('hidden');
    if (el) el.classList.remove('title-leaving', 'title-entering');
    if (document.body) document.body.classList.remove('title-open');
  };
  if (instant || !el) { finish(); return true; }
  if (titleLeaveTimer) return true;
  el.classList.add('title-leaving');
  titleLeaveTimer = setTimeout(finish, TITLE_LEAVE_MS);
  return true;
}

function continueFromTitle() {
  const status = getTitleRunStatus();
  if (status === 'result') {
    closeTitleScreen(true);
    state.isPaused = true;
    if (state.campaignCleared) openVictoryModal(false);
    else openDefeatModal(state.runEndReason || 'enrage');
    return;
  }
  if (typeof playSound === 'function') playSound('proc');
  closeTitleScreen();
}

function disarmTitleNewRun() {
  if (titleNewRunArmed) { clearTimeout(titleNewRunArmed); titleNewRunArmed = null; }
  const btn = document.getElementById('btn-title-new-run');
  if (btn && btn.classList.contains('armed')) {
    btn.classList.remove('armed');
    btn.textContent = tr('⚡ 새 런');
  }
}

// 새 런 설정 칸(meta-ui.js renderRunSetup)은 결과창과 타이틀이 함께 씁니다. 지금 보이는 쪽으로 옮겨 붙입니다.
function mountRunSetup(where) {
  const box = document.getElementById('run-setup');
  if (!box) return;
  if (!runSetupHome && box.parentNode) runSetupHome = { parent: box.parentNode, next: box.nextSibling };
  if (where === 'title') {
    const slot = document.getElementById('title-run-setup-slot');
    if (slot && box.parentNode !== slot) slot.appendChild(box);
  } else if (runSetupHome && box.parentNode !== runSetupHome.parent) {
    runSetupHome.parent.insertBefore(box, runSetupHome.next);
  }
}

function showTitleNewRunPanel(on) {
  const menu = document.getElementById('title-menu');
  const panel = document.getElementById('title-new-run');
  if (menu) menu.hidden = on;
  if (panel) panel.hidden = !on;
  if (on) {
    mountRunSetup('title');
    renderRunSetup();
    initRunSetupEvents();
    const go = document.getElementById('btn-title-depart');
    if (go && typeof go.focus === 'function') { try { go.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
  }
}

function departNewRun() {
  if (typeof playSound === 'function') playSound('proc');
  closeTitleScreen();
  restartSpeedrunRun();
}

function onTitleNewRunClick() {
  const btn = document.getElementById('btn-title-new-run');
  // 진행 중인 런이 있으면 한 번 더 눌러야 포기하고 새로 시작합니다(보상 없음).
  if (getTitleRunStatus() === 'progress' && btn && !btn.classList.contains('armed')) {
    btn.classList.add('armed');
    btn.textContent = tr('⚠️ 진행 중인 런 포기 · 한 번 더');
    titleNewRunArmed = setTimeout(disarmTitleNewRun, TITLE_NEW_RUN_CONFIRM_MS);
    return;
  }
  disarmTitleNewRun();
  if (typeof playSound === 'function') playSound('item_select');
  if (hasRunSetupChoices()) showTitleNewRunPanel(true);
  else departNewRun();
}

function openSettingsFromTitle() {
  if (typeof openPauseMenu !== 'function') return;
  openPauseMenu('title');
  openSettings();
}

function initTitleScreen(hadSave) {
  titleHadSave = hadSave !== false;
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('btn-title-start', () => { if (typeof playSound === 'function') playSound('proc'); closeTitleScreen(); });
  on('btn-title-continue', continueFromTitle);
  on('btn-title-new-run', onTitleNewRunClick);
  on('btn-title-depart', departNewRun);
  on('btn-title-new-run-back', () => showTitleNewRunPanel(false));
  on('btn-title-hall', () => { if (typeof playSound === 'function') playSound('item_select'); openVictoryModal(false); });
  on('btn-title-settings', openSettingsFromTitle);
  on('btn-title-quit', () => { if (typeof quitGameFromPauseMenu === 'function') quitGameFromPauseMenu(); });
}

// 일시정지 메뉴 › [🏠 타이틀로]: 저장하고 타이틀로. 다음에 [이어하기]로 같은 자리에서 계속합니다.
function returnToTitle() {
  if (typeof awakeningModalOpen !== 'undefined' && awakeningModalOpen === true) return false;
  try { if (typeof saveGame === 'function') saveGame(); } catch (e) { /* 무시 */ }
  titleHadSave = true;
  if (typeof closePauseMenuImmediately === 'function') closePauseMenuImmediately();
  // 결과창에서 넘어왔다면 결과창을 닫습니다(타이틀보다 위에 남지 않게). 끝난 런은 타이틀의 [새 런]으로 이어집니다.
  const results = document.getElementById('victory-modal');
  if (results && !results.classList.contains('hidden') && typeof closeVictoryModal === 'function') closeVictoryModal();
  openTitleScreen();
  return true;
}
