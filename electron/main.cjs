/* DPS: Fire Mage 데스크톱(Steam) 실행 진입점.
 * 웹 빌드(index.html)를 그대로 띄우고, 세이브만 localStorage 대신 사용자 폴더의 파일로 저장합니다.
 * --smoke-test: 창을 숨긴 채 게임을 띄워 부팅·세이브 왕복·초기화 버튼·외부 이동 차단을 검증하고 결과(JSON)를 출력한 뒤 종료합니다. */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { fileURLToPath } = require('node:url');
const { createSaveStore } = require('./save-store.cjs');

const APP_DIR_NAME = 'DPS Fire Mage';
const ROOT = path.join(__dirname, '..');
const INDEX_FILE = path.join(ROOT, 'index.html');
const smokeTest = process.argv.includes('--smoke-test');

// 쿼리·해시와 무관하게 게임 진입 파일(index.html)을 가리키는 file: 주소인지 판정합니다.
function isGamePage(url) {
  try {
    const target = new URL(url);
    if (target.protocol !== 'file:') return false;
    const normalize = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
    return normalize(fileURLToPath(target)) === normalize(INDEX_FILE);
  } catch (e) {
    return false;
  }
}

// Steam 자동 클라우드가 고정 경로를 가리킬 수 있도록 세이브 위치를 앱 이름과 무관하게 고정합니다.
// Windows: %APPDATA%/DPS Fire Mage/saves
app.setPath('userData', path.join(app.getPath('appData'), smokeTest ? `${APP_DIR_NAME} (smoke-test)` : APP_DIR_NAME));
// 스모크 테스트는 매번 빈 폴더에서 시작합니다(종료 시점엔 Chromium이 파일을 잡고 있어 지울 수 없음).
if (smokeTest) fs.rmSync(app.getPath('userData'), { recursive: true, force: true });
const saveStore = createSaveStore(path.join(app.getPath('userData'), 'saves'));

ipcMain.on('save:read', (event, key) => {
  try { event.returnValue = saveStore.read(key); } catch (e) { event.returnValue = null; }
});
ipcMain.on('save:write', (event, key, value) => {
  try { saveStore.write(key, value); } catch (e) { console.error('[main] 세이브 거부', e.message); }
});
ipcMain.on('save:remove', (event, key) => {
  try { saveStore.remove(key); event.returnValue = true; } catch (e) { event.returnValue = false; }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#17121a',
    title: 'DPS: Fire Mage',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  win.setMenu(null);

  // 게임 밖으로의 이동과 새 창을 막고, 외부 링크는 기본 브라우저로 엽니다.
  // 게임 자신의 새로고침(초기화 버튼 등)도 will-navigate를 거치므로, 문자열이 아니라 실제 파일 경로로 비교합니다.
  win.webContents.on('will-navigate', (event, url) => {
    if (!isGamePage(url)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // F11·Alt+Enter 전체화면, 개발 실행에서만 F12 개발자 도구.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' && !app.isPackaged) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // 창을 닫기 직전 게임에 마지막 저장(플레이 시간 등)을 요청하고, 디스크 기록까지 마친 뒤 닫습니다.
  let closing = false;
  win.on('close', (event) => {
    if (closing) return;
    closing = true;
    event.preventDefault();
    win.webContents.executeJavaScript("typeof saveGame === 'function' && saveGame()", true)
      .catch(() => {})
      .finally(() => setTimeout(() => { saveStore.flushSync(); win.destroy(); }, 50));
  });

  if (!smokeTest) win.once('ready-to-show', () => win.show());
  win.loadFile(INDEX_FILE);
  return win;
}

async function runSmokeTest(win) {
  const result = { ok: false, steps: {} };
  const fail = (why) => { result.error = why; };
  try {
    const consoleErrors = [];
    win.webContents.on('console-message', (event) => { if (event.level === 'error') consoleErrors.push(event.message); });
    await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const page = await win.webContents.executeJavaScript(`({
      hasState: typeof state === 'object',
      desktop: typeof saveStorage === 'object' && saveStorage.isDesktop,
      scriptsLoaded: typeof configureComicMonster === 'function' && typeof getPaperMonsterFrame === 'function',
      stage: state.currentStage
    })`);
    result.steps.boot = page;
    if (!page.hasState || !page.scriptsLoaded) return fail('게임 스크립트가 로드되지 않았습니다.');
    if (!page.desktop) return fail('데스크톱 세이브 저장소가 연결되지 않았습니다.');

    // 세이브 왕복: 골드를 바꿔 저장 → 디스크 파일 확인 → 새로고침 후 복원 확인
    await win.webContents.executeJavaScript('state.gold = 4242; saveGame();');
    await new Promise((resolve) => setTimeout(resolve, 400));
    saveStore.flushSync();
    const file = path.join(saveStore.dir, 'MAGE_SLAYER_STAGE_SAVE_V7.json');
    const onDisk = fs.existsSync(file) && JSON.parse(fs.readFileSync(file, 'utf8')).gold;
    result.steps.writtenGold = onDisk;
    if (onDisk !== 4242) return fail('세이브 파일에 기록되지 않았습니다.');

    win.webContents.reload();
    await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
    await new Promise((resolve) => setTimeout(resolve, 800));
    result.steps.restoredGold = await win.webContents.executeJavaScript('state.gold');
    if (result.steps.restoredGold !== 4242) return fail('새로고침 후 세이브가 복원되지 않았습니다.');

    // 초기화 버튼: 확인 창을 수락한 것으로 두고 실제 버튼을 눌러, 새로고침 후 처음 상태로 돌아오는지 확인합니다.
    // 게임 스스로의 새로고침(location.reload)은 will-navigate 차단을 거치므로, 막히면 시간 초과로 실패시킵니다.
    const reloaded = new Promise((resolve) => win.webContents.once('did-finish-load', () => resolve(true)));
    await win.webContents.executeJavaScript("window.confirm = () => true; document.getElementById('btn-reset-save').click();");
    if (!await Promise.race([reloaded, new Promise((resolve) => setTimeout(() => resolve(false), 5000))])) {
      return fail('초기화 후 게임 새로고침이 차단되었습니다.');
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    saveStore.flushSync();
    result.steps.afterReset = await win.webContents.executeJavaScript('({ gold: state.gold, stage: state.currentStage })');
    if (result.steps.afterReset.gold === 4242) return fail('초기화 버튼을 눌러도 세이브가 지워지지 않았습니다.');

    // 게임 밖 주소로의 이동은 계속 막혀야 합니다.
    await win.webContents.executeJavaScript("location.href = 'https://example.com/'; 0");
    await new Promise((resolve) => setTimeout(resolve, 500));
    result.steps.externalBlocked = isGamePage(win.webContents.getURL());
    if (!result.steps.externalBlocked) return fail('외부 주소로 이동이 차단되지 않았습니다.');

    result.steps.consoleErrors = consoleErrors;
    if (consoleErrors.length) return fail('콘솔 오류가 있습니다.');
    result.ok = true;
  } catch (e) {
    fail(String(e && e.stack || e));
  } finally {
    try { fs.rmSync(saveStore.dir, { recursive: true, force: true }); } catch (e) { /* 정리 실패는 무시 */ }
    process.stdout.write(`SMOKE_RESULT ${JSON.stringify(result)}\n`);
    app.exit(result.ok ? 0 : 1);
  }
}

// 같은 세이브 파일을 두 프로세스가 동시에 쓰지 않도록 단일 실행만 허용합니다.
if (!smokeTest && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    const win = createWindow();
    if (smokeTest) runSmokeTest(win);
  });
  app.on('before-quit', () => saveStore.flushSync());
  app.on('window-all-closed', () => app.quit());
}
