/* Steam 연동(메인 프로세스 전용): steamworks.js로 Steam에 붙고, 렌더러의 업적 해제 요청을 받아 처리합니다.
 * Steam이 없거나(설치 안 됨·실행 안 됨), 앱 ID가 정해지지 않았거나, 라이브러리를 못 읽으면 조용히 꺼진 상태로 남고 게임은 그대로 돕니다.
 *
 * 앱 ID 정하는 순서:
 *   1. 실행 인자 --steam-appid=480 (개발 시험용. 480은 Valve의 시험 앱 Spacewar라 우리 업적 id는 해제되지 않고 '연결됨'만 확인됩니다)
 *   2. Steam이 게임을 실행하며 넣어 주는 환경 변수 SteamAppId
 *   3. 아래 STEAM_APP_ID (Steamworks 앱 ID 발급 후 입력)
 * 어느 것도 없으면 Steam을 아예 건드리지 않습니다(개발 중 'Spacewar 플레이 중'으로 표시되는 일 방지). */
const path = require('node:path');
const { STEAM_ACHIEVEMENTS } = require(path.join(__dirname, '..', 'src', 'scripts', 'steam-achievements.js'));

const STEAM_APP_ID = null; // 앱 ID 발급 후 숫자로 입력
const RETRY_LIMIT = 5;
const RETRY_MS = 2000;

function resolveSteamAppId(argv = [], env = {}, fallback = STEAM_APP_ID) {
  const flag = argv.find((a) => typeof a === 'string' && a.startsWith('--steam-appid='));
  const candidates = [flag && flag.slice('--steam-appid='.length), env.SteamAppId, fallback];
  for (const c of candidates) {
    const n = Number(c);
    if (c != null && c !== '' && Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

// load: steamworks.js 모듈을 돌려주는 함수(테스트는 가짜를 넣음). overlay: 초기화 성공 시 Steam 오버레이(업적 알림 팝업)를 켭니다.
function createSteamBridge({ appId, load = () => require('steamworks.js'), overlay = true, log = console, setTimer = setTimeout } = {}) {
  const known = new Set(STEAM_ACHIEVEMENTS.map((a) => a.id));
  const metas = STEAM_ACHIEVEMENTS.filter((a) => Array.isArray(a.requires));
  const done = new Set();
  const pending = new Map(); // id → 남은 재시도 횟수
  let client = null;
  let reason = 'not-initialized';

  function init() {
    if (client) return true;
    if (!appId) { reason = 'no-app-id'; return false; }
    try {
      const steamworks = load();
      client = steamworks.init(appId);
      reason = 'ok';
      if (overlay && typeof steamworks.electronEnableSteamOverlay === 'function') {
        try { steamworks.electronEnableSteamOverlay(); } catch (e) { log.warn('[steam] 오버레이를 켜지 못했습니다', e && e.message); }
      }
      return true;
    } catch (e) {
      client = null;
      reason = 'init-failed';
      log.warn('[steam] Steam에 연결하지 못했습니다(Steam 미실행 등). 업적 없이 계속합니다.', e && e.message);
      return false;
    }
  }

  function isActivated(id) {
    if (done.has(id)) return true;
    try { if (client.achievement.isActivated(id)) { done.add(id); return true; } } catch (e) { /* 모르면 미해제로 봄 */ }
    return false;
  }

  function activate(id) {
    try { return client.achievement.activate(id) === true; } catch (e) { return false; }
  }

  // 해제 직후 묶음 업적(전부 찾기) 조건을 Steam의 해제 상태로 확인합니다.
  function checkMetas() {
    for (const m of metas) {
      if (!isActivated(m.id) && m.requires.every(isActivated)) unlock(m.id);
    }
  }

  // Steam이 아직 통계를 받지 못한 직후 등에는 activate가 실패할 수 있어, 몇 번 다시 시도합니다.
  function retryLater(id) {
    const left = pending.has(id) ? pending.get(id) : RETRY_LIMIT;
    if (left <= 0) { pending.delete(id); log.warn('[steam] 업적 해제 실패', id); return; }
    pending.set(id, left - 1);
    setTimer(() => { if (pending.has(id)) attempt(id); }, RETRY_MS);
  }

  function attempt(id) {
    if (activate(id)) {
      pending.delete(id);
      done.add(id);
      checkMetas();
      return true;
    }
    retryLater(id);
    return false;
  }

  // 반환: 'unlocked' | 'already' | 'retrying' | 'unknown' | 'offline'
  function unlock(id) {
    if (typeof id !== 'string' || !known.has(id)) return 'unknown';
    if (!client) return 'offline';
    if (isActivated(id)) return 'already';
    if (pending.has(id)) return 'retrying';
    return attempt(id) ? 'unlocked' : 'retrying';
  }

  return {
    init,
    unlock,
    get available() { return Boolean(client); },
    get reason() { return reason; }
  };
}

// 렌더러 → 메인 업적 해제 통로. 응답을 기다리지 않는 단방향 메시지입니다.
function registerSteamIpc(ipcMain, bridge) {
  ipcMain.on('steam:unlock-achievement', (event, id) => {
    try { bridge.unlock(id); } catch (e) { /* 업적 실패가 게임을 멈추지 않게 */ }
  });
}

module.exports = { STEAM_APP_ID, resolveSteamAppId, createSteamBridge, registerSteamIpc };
