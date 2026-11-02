/* Steam 업적 연동: 배경 소품 큰 반응 → 렌더러 보고기 → preload(desktopSteam) → IPC → 메인 프로세스 Steam 다리 경로와,
 * Steam이 없을 때(브라우저·Steam 미실행·앱 ID 없음) 아무 일도 하지 않는지를 검증합니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { STEAM_ACHIEVEMENTS, PROP_EVENT_ACHIEVEMENTS, createAchievementReporter, createDesktopAchievementReporter } = require('../src/scripts/steam-achievements.js');
const { resolveSteamAppId, createSteamBridge, registerSteamIpc, STEAM_APP_ID } = require('../electron/steam.cjs');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const quiet = { warn() {} };

// 가짜 steamworks.js: activate 결과를 조절할 수 있고, 해제된 업적을 기억합니다.
function fakeSteamworks({ initThrows = false, failFirst = 0 } = {}) {
  const unlocked = new Set(), calls = [];
  let fails = failFirst;
  const sw = {
    inits: [], overlay: 0, unlocked, calls,
    init(appId) {
      sw.inits.push(appId);
      if (initThrows) throw new Error('Steam is not running');
      return {
        achievement: {
          activate(id) { calls.push(id); if (fails > 0) { fails--; return false; } unlocked.add(id); return true; },
          isActivated: (id) => unlocked.has(id)
        }
      };
    },
    electronEnableSteamOverlay() { sw.overlay++; }
  };
  return sw;
}
function manualTimers() {
  const queue = [];
  return { setTimer: (fn) => queue.push(fn), flush() { while (queue.length) queue.shift()(); }, get size() { return queue.length; } };
}

// 1. 업적 목록: 소품 큰 반응 7종이 모두 업적에 대응하고, id는 중복 없이 Steam API 이름 규칙(영대문자·숫자·_)을 따릅니다.
{
  const bigEvents = ['crystal-break', 'citadel-sigil', 'lantern-relight', 'cart-spill', 'banner-burnt', 'void-melody', 'slime-pop'];
  assert.deepEqual(Object.keys(PROP_EVENT_ACHIEVEMENTS).sort(), [...bigEvents].sort());
  const ids = STEAM_ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length, '업적 id 중복');
  for (const a of STEAM_ACHIEVEMENTS) {
    assert.match(a.id, /^[A-Z0-9_]+$/, `${a.id} id 형식`);
    assert.ok(a.ko && a.en && a.descKo && a.descEn, `${a.id} 이름·설명 누락`);
    for (const r of a.requires || []) assert.ok(ids.includes(r), `${a.id}가 없는 업적 ${r}을 요구`);
  }
  // 소품 사건 이름이 실제 소품 코드에 있는지(이름이 바뀌면 업적이 조용히 끊기므로).
  const propSource = read('src/scripts/arena-props.js') + read('src/scripts/arena-props-extra.js');
  for (const e of bigEvents) assert.ok(propSource.includes(`'${e}'`), `소품 코드에 사건 ${e}가 없음`);
}

// 2. 렌더러 보고기: 큰 반응만 보내고, 작은 반응은 무시하며, 같은 업적은 한 번만 보냅니다.
{
  const sent = [];
  const r = createAchievementReporter((id) => sent.push(id));
  assert.equal(r.onPropEvent('crystal-hit'), false, '작은 반응은 업적이 없음');
  assert.equal(r.onPropEvent('brazier-flare'), false);
  assert.equal(r.onPropEvent('crystal-break'), true);
  assert.equal(r.onPropEvent('crystal-break'), false, '같은 업적은 다시 보내지 않음');
  r.onPropEvent('slime-pop');
  assert.deepEqual(sent, ['ACH_PROP_CRYSTAL', 'ACH_PROP_SLIME']);
  // 보내는 쪽이 터져도 게임은 계속됩니다.
  assert.equal(createAchievementReporter(() => { throw new Error('ipc'); }).onPropEvent('cart-spill'), false);
  // 브라우저 실행(desktopSteam 없음): 아무 일도 하지 않습니다.
  assert.equal(createDesktopAchievementReporter({}).onPropEvent('crystal-break'), false);
  assert.equal(createDesktopAchievementReporter(null).onPropEvent('crystal-break'), false);
}

// 3. 앱 ID: 실행 인자 > Steam 환경 변수 > 상수. 없으면 null(Steam을 건드리지 않음).
{
  assert.equal(resolveSteamAppId([], {}, null), null);
  assert.equal(resolveSteamAppId(['electron', '.', '--steam-appid=480'], { SteamAppId: '123' }, 999), 480);
  assert.equal(resolveSteamAppId([], { SteamAppId: '123' }, 999), 123);
  assert.equal(resolveSteamAppId([], {}, 999), 999);
  assert.equal(resolveSteamAppId(['--steam-appid=abc'], { SteamAppId: '' }, null), null, '잘못된 값은 무시');
  assert.ok(STEAM_APP_ID === null || Number.isInteger(STEAM_APP_ID));
}

// 4. Steam 없이: 앱 ID가 없으면 라이브러리조차 읽지 않고, 초기화 실패(Steam 미실행)·라이브러리 오류도 조용히 꺼집니다.
{
  let loaded = 0;
  const none = createSteamBridge({ appId: null, load: () => { loaded++; return fakeSteamworks(); }, log: quiet });
  assert.equal(none.init(), false);
  assert.equal(loaded, 0, '앱 ID가 없으면 steamworks.js를 읽지 않음');
  assert.equal(none.unlock('ACH_PROP_CRYSTAL'), 'offline');
  assert.equal(none.reason, 'no-app-id');

  const sw = fakeSteamworks({ initThrows: true });
  const notRunning = createSteamBridge({ appId: 480, load: () => sw, log: quiet });
  assert.equal(notRunning.init(), false);
  assert.equal(notRunning.available, false);
  assert.equal(sw.overlay, 0, '연결 실패 시 오버레이 스위치를 켜지 않음(창 렌더링 무변화)');
  assert.equal(notRunning.unlock('ACH_PROP_CRYSTAL'), 'offline');

  const broken = createSteamBridge({ appId: 480, load: () => { throw new Error('dll missing'); }, log: quiet });
  assert.equal(broken.init(), false);
  assert.equal(broken.unlock('ACH_PROP_CRYSTAL'), 'offline');
}

// 5. Steam 연결됨: 해제·중복·모르는 id 거부·전부 찾기 묶음 업적.
{
  const sw = fakeSteamworks();
  const bridge = createSteamBridge({ appId: 480, load: () => sw, log: quiet });
  assert.equal(bridge.init(), true);
  assert.deepEqual(sw.inits, [480]);
  assert.equal(sw.overlay, 1, '연결되면 업적 알림용 오버레이를 켬');
  assert.equal(bridge.unlock('ACH_PROP_CRYSTAL'), 'unlocked');
  assert.equal(bridge.unlock('ACH_PROP_CRYSTAL'), 'already');
  assert.equal(bridge.unlock('ACH_EVIL'), 'unknown', '목록에 없는 id는 렌더러가 보내도 해제하지 않음');
  assert.equal(bridge.unlock(42), 'unknown');
  const meta = STEAM_ACHIEVEMENTS.find((a) => a.requires);
  for (const id of meta.requires) bridge.unlock(id);
  assert.ok(sw.unlocked.has(meta.id), '모두 찾으면 묶음 업적도 해제');
  assert.equal(sw.calls.filter((id) => id === meta.id).length, 1);
}
// 묶음 업적은 이전 실행에서 해제된 업적도 Steam 상태로 셉니다(세이브 불필요).
{
  const sw = fakeSteamworks();
  const meta = STEAM_ACHIEVEMENTS.find((a) => a.requires);
  meta.requires.slice(0, -1).forEach((id) => sw.unlocked.add(id));
  const bridge = createSteamBridge({ appId: 480, load: () => sw, log: quiet });
  bridge.init();
  assert.equal(sw.unlocked.has(meta.id), false);
  bridge.unlock(meta.requires[meta.requires.length - 1]);
  assert.ok(sw.unlocked.has(meta.id));
}

// 6. activate 실패(통계 수신 전 등)는 정해진 횟수까지 다시 시도합니다.
{
  const sw = fakeSteamworks({ failFirst: 2 });
  const timers = manualTimers();
  const bridge = createSteamBridge({ appId: 480, load: () => sw, log: quiet, setTimer: timers.setTimer });
  bridge.init();
  assert.equal(bridge.unlock('ACH_PROP_CART'), 'retrying');
  assert.equal(bridge.unlock('ACH_PROP_CART'), 'retrying', '재시도 중에는 중복 시도하지 않음');
  timers.flush();
  assert.ok(sw.unlocked.has('ACH_PROP_CART'));
  assert.equal(sw.calls.filter((id) => id === 'ACH_PROP_CART').length, 3);

  const never = fakeSteamworks({ failFirst: 100 });
  const t2 = manualTimers();
  const b2 = createSteamBridge({ appId: 480, load: () => never, log: quiet, setTimer: t2.setTimer });
  b2.init();
  b2.unlock('ACH_PROP_CART');
  t2.flush();
  assert.equal(never.calls.length, 6, '첫 시도 + 재시도 5번에서 멈춤');
}

// 7. 전체 경로: preload가 노출한 desktopSteam → IPC 채널 → 메인 등록 핸들러 → Steam 다리.
{
  const exposed = {}, handlers = {};
  const ipcRenderer = {
    sendSync: () => false,
    send: (channel, ...args) => { if (handlers[channel]) handlers[channel]({ sender: null }, ...args); }
  };
  const electron = { contextBridge: { exposeInMainWorld: (k, v) => { exposed[k] = v; } }, ipcRenderer };
  const preloadCode = read('electron/preload.cjs');
  const sandbox = { require: (m) => (m === 'electron' ? electron : require(m)) };
  vm.runInNewContext(preloadCode, sandbox);
  assert.equal(typeof exposed.desktopSteam.unlockAchievement, 'function');

  const sw = fakeSteamworks();
  const bridge = createSteamBridge({ appId: 480, load: () => sw, log: quiet });
  bridge.init();
  registerSteamIpc({ on: (channel, fn) => { handlers[channel] = fn; } }, bridge);

  const reporter = createDesktopAchievementReporter({ desktopSteam: exposed.desktopSteam });
  reporter.onPropEvent('void-melody');
  assert.ok(sw.unlocked.has('ACH_PROP_MELODY'), '소품 사건이 Steam 업적 해제까지 이어져야 함');

  // 핸들러 안에서 다리가 터져도 메인 프로세스는 멀쩡해야 합니다.
  const h = {};
  registerSteamIpc({ on: (c, fn) => { h[c] = fn; } }, { unlock() { throw new Error('boom'); } });
  assert.doesNotThrow(() => h['steam:unlock-achievement']({}, 'ACH_PROP_CRYSTAL'));
}

// 8. 게임 연결: 소품 사건(onEvent)을 보고기로 넘기고, 스크립트는 game.js보다 먼저 읽힙니다.
{
  const game = read('src/scripts/game.js');
  const init = game.slice(game.indexOf('function initArenaProps'), game.indexOf('function initEvents'));
  assert.match(init, /onEvent:\s*\(name\)\s*=>\s*achievementReporter\.onPropEvent\(name\)/);
  assert.match(game, /createDesktopAchievementReporter\(/);
  const html = read('index.html');
  assert.ok(html.indexOf('steam-achievements.js') > 0 && html.indexOf('steam-achievements.js') < html.indexOf('src/scripts/game.js'));
  // 브라우저 실행: 보고기 생성 코드가 desktopSteam 없이도 에러 없이 꺼진 보고기를 만듭니다.
  const line = game.match(/const achievementReporter = [\s\S]*?;\n/)[0];
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(read('src/scripts/steam-achievements.js').replace(/if \(typeof module[\s\S]*$/, ''), ctx);
  vm.runInContext(`${line}; this.r = achievementReporter;`, ctx);
  assert.equal(ctx.r.onPropEvent('crystal-break'), false);
}

// 9. 배포 빌드: 네이티브 모듈·steam_api64.dll은 asar 밖에 풀어야 로드됩니다. 라이선스는 MIT.
{
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies && pkg.dependencies['steamworks.js'], 'steamworks.js는 배포에 들어가는 dependencies');
  assert.ok((pkg.build.asarUnpack || []).some((p) => p.includes('steamworks.js')));
  const lib = path.join(root, 'node_modules', 'steamworks.js');
  if (fs.existsSync(lib)) {
    assert.equal(JSON.parse(fs.readFileSync(path.join(lib, 'package.json'), 'utf8')).license, 'MIT');
    assert.ok(fs.existsSync(path.join(lib, 'dist', 'win64', 'steam_api64.dll')));
  }
}
