/* Steam 캡슐 임시본 렌더러 (Electron 메인 스크립트).
 * 실행: npx electron scripts/store/render-capsules.cjs [출력 폴더]
 * capsule.html을 Steam 규격 크기 그대로 열어 PNG로 저장합니다. 라이브러리 로고만 투명 배경입니다. */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const OUT = path.resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('-') && !a.endsWith('.cjs')) || path.join(__dirname, '..', '..', 'dist', 'store-capsules'));
const TEMPLATE = path.join(__dirname, 'capsule.html');

// Steamworks 그래픽 자산 규격(2024-08 개정)
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
const ALL_CAPSULES = [
  { file: 'header_capsule_920x430.png', w: 920, h: 430, layout: 'wide' },
  { file: 'small_capsule_462x174.png', w: 462, h: 174, layout: 'small' },
  { file: 'main_capsule_1232x706.png', w: 1232, h: 706, layout: 'wide' },
  { file: 'vertical_capsule_748x896.png', w: 748, h: 896, layout: 'tall' },
  { file: 'library_capsule_600x900.png', w: 600, h: 900, layout: 'tall' },
  { file: 'library_header_920x430.png', w: 920, h: 430, layout: 'wide' },
  { file: 'library_hero_3840x1240.png', w: 3840, h: 1240, layout: 'hero' },
  { file: 'library_logo_1280x720.png', w: 1280, h: 720, layout: 'logo', transparent: true }
];

const CAPSULES = ALL_CAPSULES.filter((c) => !ONLY || c.file.startsWith(ONLY));

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'dps-capsules-')));
// 캡슐마다 창을 새로 만들고 닫으므로, 마지막 창이 닫혀도 앱이 종료되지 않게 합니다(Electron 기본 동작 해제).
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  try {
    for (const c of CAPSULES) {
      const win = new BrowserWindow({
        width: c.w, height: c.h, useContentSize: true, show: false, enableLargerThanScreen: true,
        transparent: Boolean(c.transparent), backgroundColor: c.transparent ? '#00000000' : '#160d10',
        webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true }
      });
      win.setContentSize(c.w, c.h);
      const ready = new Promise((resolve) => win.webContents.on('page-title-updated', (e, title) => { if (title === 'READY') resolve(); }));
      await win.loadFile(TEMPLATE, { query: { layout: c.layout, w: String(c.w), h: String(c.h) } });
      await ready;
      const image = await win.webContents.capturePage();
      const size = image.getSize();
      if (size.width !== c.w || size.height !== c.h) throw new Error(`${c.file} 크기 불일치: ${size.width}x${size.height}`);
      fs.writeFileSync(path.join(OUT, c.file), image.toPNG());
      results.push(c.file);
      win.destroy();
    }
    process.stdout.write(`CAPSULE_RESULT ${JSON.stringify({ ok: true, out: OUT, results })}\n`);
  } catch (e) {
    process.stdout.write(`CAPSULE_RESULT ${JSON.stringify({ ok: false, error: String(e && e.stack || e), results })}\n`);
  } finally {
    try { fs.rmSync(app.getPath('userData'), { recursive: true, force: true }); } catch (e) { /* 무시 */ }
    app.exit(0);
  }
});
