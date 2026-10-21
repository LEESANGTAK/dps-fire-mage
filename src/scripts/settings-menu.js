/* 설정 화면: 일시정지 메뉴의 [⚙ 설정]에서 넘어가는 두 번째 카드입니다(뒤 화면은 계속 멈춰 있음).
 * - 게임: 언어(바꾸면 저장 후 새로고침), 모션 줄이기(motion-pref.js).
 * - 사운드: 볼륨 슬라이더·음소거·다음 곡. 동작은 game.js의 기존 사운드 이벤트가 같은 요소 ID로 처리합니다.
 * - 화면: 데스크톱 빌드만. 창/전체화면, 창 크기(전체화면 F11·Alt+Enter와 같은 상태를 공유).
 * - 데이터: 진행 초기화. 실수로 지우지 않게 한 번 더 눌러야 실행됩니다. */
const SETTINGS_LANG_NAMES = { ko: '한국어', en: 'English' }; // 언어 이름은 각 언어 그대로 씁니다(번역하지 않음).
const RESET_CONFIRM_MS = 3000;

let settingsOpen = false;
let resetArmedTimer = null;

function isSettingsOpen() {
  return settingsOpen;
}

function hasDesktopWindow() {
  return typeof window !== 'undefined' && Boolean(window.desktopWindow) && typeof window.desktopWindow.getState === 'function';
}

function setSegSelected(seg, value) {
  if (!seg) return;
  seg.querySelectorAll('button[data-value]').forEach((btn) => {
    const on = btn.dataset.value === String(value);
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function renderLanguageSeg() {
  const seg = document.getElementById('settings-lang');
  if (!seg) return;
  if (!seg.querySelector('button')) {
    seg.innerHTML = Object.entries(SETTINGS_LANG_NAMES)
      .map(([code, name]) => `<button type="button" data-value="${code}" lang="${code}">${name}</button>`).join('');
  }
  setSegSelected(seg, I18N.lang);
}

function renderDisplaySettings() {
  const group = document.getElementById('settings-display-group');
  if (!group) return;
  if (!hasDesktopWindow()) { group.hidden = true; return; }
  group.hidden = false;
  let ws = null;
  try { ws = window.desktopWindow.getState(); } catch (e) { ws = null; }
  if (!ws) { group.hidden = true; return; }
  setSegSelected(document.getElementById('settings-display-mode'), ws.fullscreen ? 'fullscreen' : 'window');
  const sizeSeg = document.getElementById('settings-window-size');
  if (sizeSeg) {
    const sizes = Array.isArray(ws.sizes) ? ws.sizes : [];
    const key = sizes.map((s) => `${s.width}x${s.height}:${s.fits}`).join(',');
    if (sizeSeg.dataset.sizes !== key) {
      sizeSeg.dataset.sizes = key;
      sizeSeg.innerHTML = sizes.map((s) => `<button type="button" data-value="${s.width}x${s.height}"${s.fits ? '' : ' disabled'}>${s.width}×${s.height}</button>`).join('');
    }
    setSegSelected(sizeSeg, `${ws.width}x${ws.height}`);
    // 전체화면에서는 창 크기를 고를 수 없습니다(고르면 창 모드로 돌아가며 적용).
    sizeSeg.classList.toggle('dimmed', Boolean(ws.fullscreen));
  }
}

function renderSettings() {
  renderLanguageSeg();
  setSegSelected(document.getElementById('settings-motion'), typeof getMotionPref === 'function' ? getMotionPref() : 'system');
  renderDisplaySettings();
  if (typeof updateSoundUI === 'function') updateSoundUI();
  disarmReset();
}

function openSettings() {
  const main = document.querySelector('#pause-menu-backdrop .pause-menu-card:not(.settings-card)');
  const card = document.getElementById('settings-card');
  if (!card) return false;
  settingsOpen = true;
  renderSettings();
  if (main) main.hidden = true;
  card.hidden = false;
  const back = document.getElementById('btn-settings-back');
  if (back && typeof back.focus === 'function') { try { back.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
  return true;
}

function closeSettings() {
  if (!settingsOpen) return false;
  settingsOpen = false;
  disarmReset();
  const main = document.querySelector('#pause-menu-backdrop .pause-menu-card:not(.settings-card)');
  const card = document.getElementById('settings-card');
  if (card) card.hidden = true;
  if (main) main.hidden = false;
  const settingsBtn = document.getElementById('btn-pause-settings');
  if (settingsBtn && typeof settingsBtn.focus === 'function') { try { settingsBtn.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
  return true;
}

function chooseLanguage(code) {
  if (!SETTINGS_LANG_NAMES[code] || code === I18N.lang) return;
  try { if (typeof saveGame === 'function') saveGame(); } catch (e) { /* 저장 실패해도 언어 전환은 진행 */ }
  I18N.setLang(code);
}

function chooseMotion(pref) {
  if (typeof setMotionPref !== 'function' || !setMotionPref(pref)) return;
  setSegSelected(document.getElementById('settings-motion'), pref);
  try { if (typeof saveGame === 'function') saveGame(); } catch (e) { /* 무시 */ }
}

function chooseDisplayMode(mode) {
  if (!hasDesktopWindow()) return;
  window.desktopWindow.setFullscreen(mode === 'fullscreen');
  renderDisplaySettings();
}

function chooseWindowSize(value) {
  if (!hasDesktopWindow()) return;
  const [w, h] = String(value).split('x').map(Number);
  if (!w || !h) return;
  window.desktopWindow.setSize(w, h);
  renderDisplaySettings();
}

function disarmReset() {
  if (resetArmedTimer) { clearTimeout(resetArmedTimer); resetArmedTimer = null; }
  const btn = document.getElementById('btn-reset-save');
  if (btn && btn.classList.contains('armed')) {
    btn.classList.remove('armed');
    btn.textContent = tr('🗑️ 초기화');
  }
}

// 첫 클릭: 버튼이 붉게 바뀌며 '한 번 더'를 요구합니다. 3초 안에 다시 누르면 세이브를 지우고 처음부터 시작합니다.
function onResetClick() {
  const btn = document.getElementById('btn-reset-save');
  if (!btn) return;
  if (!btn.classList.contains('armed')) {
    btn.classList.add('armed');
    btn.textContent = tr('⚠️ 한 번 더 누르면 초기화');
    resetArmedTimer = setTimeout(disarmReset, RESET_CONFIRM_MS);
    return;
  }
  disarmReset();
  saveStorage.remove(SAVE_KEY);
  location.reload();
}

function initSettingsMenu() {
  const bindSeg = (id, fn) => {
    const seg = document.getElementById(id);
    if (!seg) return;
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (btn && !btn.disabled) fn(btn.dataset.value);
    });
  };
  bindSeg('settings-lang', chooseLanguage);
  bindSeg('settings-motion', chooseMotion);
  bindSeg('settings-display-mode', chooseDisplayMode);
  bindSeg('settings-window-size', chooseWindowSize);

  const openBtn = document.getElementById('btn-pause-settings');
  if (openBtn) openBtn.addEventListener('click', openSettings);
  const backBtn = document.getElementById('btn-settings-back');
  if (backBtn) backBtn.addEventListener('click', closeSettings);
  const resetBtn = document.getElementById('btn-reset-save');
  if (resetBtn) resetBtn.addEventListener('click', onResetClick);

  // F11·Alt+Enter나 창 끌기로 화면 상태가 바뀌면 설정 화면 표시도 맞춥니다.
  window.addEventListener('resize', () => { if (settingsOpen) renderDisplaySettings(); });
}
