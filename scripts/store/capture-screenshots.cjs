/* Steam 스토어 스크린샷 촬영기 (Electron 메인 스크립트).
 * 실행: npx electron scripts/store/capture-screenshots.cjs [출력 폴더]
 * 1280×720 레이아웃을 1.5배 확대해 1920×1080 PNG로 찍습니다. 장면마다 진행 세이브를 주입한 뒤 실제 전투를 돌려
 * 여러 프레임을 남기므로, 그중 가장 읽기 좋은 프레임을 골라 스토어에 올립니다. 번역 후 같은 장면을 다시 찍을 때 재사용합니다. */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..', '..');
// --lang=en 이면 영어 화면으로 찍습니다(기본 한국어). 출력 폴더도 언어별로 나눕니다.
const LANG = (process.argv.find((a) => a.startsWith('--lang=')) || '').slice(7) === 'en' ? 'en' : 'ko';
const OUT = path.resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('-') && !a.endsWith('.cjs')) || path.join(ROOT, 'dist', LANG === 'en' ? 'store-capture-en' : 'store-capture'));

const WIDTH = 1920, HEIGHT = 1080, ZOOM = 1.5;

// 스토어 화면에 개발용 도구(밸런스 로그 버튼)와 일시정지 버튼은 노출하지 않습니다.
// 전투 장면을 찍으므로 타이틀 화면은 바로 걷습니다.
const HIDE_DEV_UI = "['btn-export-telemetry','btn-victory-export-telemetry','btn-pause'].forEach((id) => document.getElementById(id)?.style.setProperty('display','none')); if (typeof closeTitleScreen === 'function') closeTitleScreen(true);";

const midRunDeck = { spell_fireblast: 1, spell_meteor: 1, spell_combustion: 1, spell_flame_patch: 1, sum_spirit: 1, crit_focus: 2, crit_heat: 1, burn_ignite: 1, util_power: 1 };
const allSpells = { fireblast: true, meteor: true, combustion: true, flame_patch: true };
function save(over) {
  return Object.assign({
    gold: 3820, currentStage: 12, highestClearedStage: 11, playTimeSec: 402, totalPlayTimeSec: 402, totalKills: 11,
    campaignCleared: false, bestReachedStage: 12, runFailed: false, autoCast: true, soundOn: false,
    unfolded: { combatStats: true, hallOfFame: false }, grimoires: allSpells,
    spellOrder: ['fireball', 'fireblast', 'meteor', 'combustion', 'flame_patch'], activeDeck: midRunDeck
  }, over);
}

const SCENES = [
  { name: '01-midrun-combat', save: save({}), warmup: 7000, frames: 6, interval: 450 },
  { name: '02-combustion-meteor', save: save({ currentStage: 15, highestClearedStage: 14, gold: 6100, playTimeSec: 520 }), warmup: 3500,
    action: "state.combat.combustionCdRem = 0; triggerSkill('combustion', true); setTimeout(() => { state.combat.meteorCdRem = 0; triggerSkill('meteor', true); }, 700);",
    afterAction: 600, frames: 8, interval: 250 },
  { name: '03-final-boss-heart', save: save({ currentStage: 20, highestClearedStage: 19, gold: 41000, playTimeSec: 731, activeDeck: Object.assign({}, midRunDeck, { crit_crimson_frenzy: 1, sum_volley: 1 }) }), warmup: 4000,
    action: 'state.monster.hp = Math.round(state.monster.maxHp * 0.29);', afterAction: 2600, frames: 6, interval: 400 },
  { name: '04-awakening-cards', save: save({ currentStage: 9, highestClearedStage: 8, gold: 980, playTimeSec: 288 }), warmup: 2500,
    action: 'triggerAwakeningSelection(9, false, () => {});', afterAction: 2200, frames: 3, interval: 300 },
  { name: '05-speedrun-record', save: save({ currentStage: 20, highestClearedStage: 20, campaignCleared: true, bestSpeedrunTime: 754, playTimeSec: 754, totalPlayTimeSec: 754, totalKills: 20,
      unfolded: { combatStats: true, hallOfFame: true },
      stats: { peakDps: 48200, lastSpeedrunTime: 754, prevBestSpeedrunTime: 812, isNewSpeedrunRecord: true, lastBossKillDuration: 96.4, combustionPyros: 5 } }), warmup: 2500,
    action: 'openVictoryModal(false);', afterAction: 2600, frames: 2, interval: 300 },
  { name: '06-early-forest', save: save({ currentStage: 6, highestClearedStage: 5, gold: 210, playTimeSec: 140, grimoires: { fireblast: true, meteor: false, combustion: false, flame_patch: false },
      spellOrder: ['fireball', 'fireblast'], activeDeck: { spell_fireblast: 1, rapid_spark: 1, crit_focus: 1 } }), warmup: 6000, frames: 6, interval: 450 }
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function shoot(win, scene) {
  const loaded = () => new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  let done = loaded();
  win.loadFile(path.join(ROOT, 'index.html'));
  await done;
  done = loaded();
  await win.webContents.executeJavaScript(`localStorage.setItem(SAVE_KEY, ${JSON.stringify(JSON.stringify(scene.save))}); localStorage.setItem(I18N_LANG_KEY, ${JSON.stringify(LANG)}); location.reload(); 0`);
  await done;
  win.webContents.setZoomFactor(ZOOM);
  await win.webContents.executeJavaScript(HIDE_DEV_UI);
  await wait(scene.warmup);
  if (scene.action) {
    await win.webContents.executeJavaScript(`${scene.action}; 0`);
    await wait(scene.afterAction || 0);
  }
  const files = [];
  for (let i = 0; i < scene.frames; i++) {
    const image = await win.webContents.capturePage();
    const size = image.getSize();
    // 비율이 다르면 늘려서 맞추지 않고 실패시켜, 찌그러진 스크린샷이 올라가지 않게 합니다.
    if (size.width / size.height !== WIDTH / HEIGHT) throw new Error(`캡처 비율 불일치: ${size.width}x${size.height}`);
    const png = (size.width === WIDTH ? image : image.resize({ width: WIDTH, height: HEIGHT, quality: 'best' })).toPNG();
    const file = path.join(OUT, `${scene.name}-${i + 1}.png`);
    fs.writeFileSync(file, png);
    files.push({ file: path.basename(file), captured: `${size.width}x${size.height}` });
    await wait(scene.interval);
  }
  return files;
}

app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'dps-store-capture-')));
app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({
    width: WIDTH, height: HEIGHT, useContentSize: true, show: false, enableLargerThanScreen: true,
    webPreferences: { offscreen: true, contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // 작업 표시줄 높이 등으로 창이 화면보다 작게 잘리지 않도록 크기를 다시 고정합니다.
  win.setContentSize(WIDTH, HEIGHT);
  win.webContents.setFrameRate(60);
  const report = {};
  try {
    // --only=05 처럼 장면 번호 접두어로 일부만 다시 찍을 수 있습니다.
    const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
    for (const scene of SCENES.filter((sc) => !only || sc.name.startsWith(only))) report[scene.name] = await shoot(win, scene);
    process.stdout.write(`CAPTURE_RESULT ${JSON.stringify({ ok: true, out: OUT, report })}\n`);
  } catch (e) {
    process.stdout.write(`CAPTURE_RESULT ${JSON.stringify({ ok: false, error: String(e && e.stack || e) })}\n`);
  } finally {
    try { fs.rmSync(app.getPath('userData'), { recursive: true, force: true }); } catch (e) { /* 무시 */ }
    app.exit(0);
  }
});
