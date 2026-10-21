/* 설정 화면: 모션 줄이기 덮어쓰기(JS·CSS), 세이브 왕복, 설정 열기/닫기와 Esc, 초기화 2단계 확인, 데스크톱 화면 설정 저장소, 상단 버튼 정리를 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const ws = require('../electron/window-settings.cjs');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// 1. 모션 줄이기: matchMedia 질의와 CSS @media 조건을 선택값으로 덮어씁니다.
{
  const osReduce = { value: true };
  const ctx = { matchMedia: (q) => ({ matches: /reduce/.test(q) ? osReduce.value : !osReduce.value, media: q }) };
  const rules = [
    { media: { mediaText: '(prefers-reduced-motion: reduce)' }, cssRules: [] },
    { media: { mediaText: '(prefers-reduced-motion: no-preference)' }, cssRules: [] },
    { media: { mediaText: '(max-width: 700px)' }, cssRules: [] }
  ];
  ctx.document = { styleSheets: [{ cssRules: rules }], documentElement: { classList: { toggle() {} } }, addEventListener() {} };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('src/scripts/motion-pref.js'), ctx);
  const q = (s) => vm.runInContext(`matchMedia(${JSON.stringify(s)}).matches`, ctx);
  const REDUCE = '(prefers-reduced-motion: reduce)';
  assert.equal(vm.runInContext('getMotionPref()', ctx), 'system');
  assert.equal(q(REDUCE), true, '시스템: OS 설정을 그대로 따라야 합니다.');
  vm.runInContext("setMotionPref('full')", ctx);
  assert.equal(q(REDUCE), false, '전체: OS가 줄이기여도 연출을 모두 보여야 합니다.');
  assert.equal(q('(prefers-reduced-motion: no-preference)'), true);
  assert.equal(rules[0].media.mediaText, 'not all', '전체: CSS의 줄이기 규칙이 꺼져야 합니다.');
  assert.equal(rules[1].media.mediaText, 'all');
  assert.equal(rules[2].media.mediaText, '(max-width: 700px)', '모션과 무관한 @media는 건드리지 않습니다.');
  osReduce.value = false;
  vm.runInContext("setMotionPref('reduce')", ctx);
  assert.equal(q(REDUCE), true, '줄임: OS와 무관하게 줄여야 합니다.');
  assert.equal(vm.runInContext('isReducedMotion()', ctx), true);
  assert.equal(rules[0].media.mediaText, 'all');
  vm.runInContext("setMotionPref('system')", ctx);
  assert.equal(rules[0].media.mediaText, REDUCE, '시스템으로 돌아오면 원래 조건이 복원되어야 합니다.');
  assert.equal(q(REDUCE), false);
  assert.equal(vm.runInContext("setMotionPref('nope')", ctx), false, '알 수 없는 값은 거부합니다.');
  // 실제 CSS의 모션 조건은 모두 덮어쓸 수 있는 단일 조건이어야 합니다.
  for (const css of ['src/styles/styles.css', 'src/styles/art.css', 'src/styles/paper-ui.css']) {
    for (const m of read(css).matchAll(/@media([^{]*prefers-reduced-motion[^{]*)\{/g)) {
      assert.match(m[1].trim(), /^\(\s*prefers-reduced-motion\s*:\s*(reduce|no-preference)\s*\)$/, `${css}: ${m[1].trim()}`);
    }
  }
}

// 2. 게임 안: 모션 설정은 세이브에 저장되고 다시 불러옵니다.
{
  const g = createHeadlessGame({ seed: 5 });
  g.run("setMotionPref('reduce'); saveGame();");
  const saved = JSON.parse(g.run('saveStorage.read(SAVE_KEY)'));
  assert.equal(saved.motionPref, 'reduce');
  g.run("setMotionPref('system'); loadGame();");
  assert.equal(g.run('getMotionPref()'), 'reduce', '불러오면 저장된 모션 설정이 적용되어야 합니다.');

  // 3. 설정 화면 열기/닫기: 일시정지 메뉴 안에서만 넘나들고, 설정에서 뒤로 가도 일시정지는 유지됩니다.
  g.run("openPauseMenu('manual')");
  assert.equal(g.run('openSettings()'), true);
  assert.equal(g.run('isSettingsOpen()'), true);
  assert.equal(g.run("document.getElementById('settings-card').hidden"), false);
  assert.equal(g.run('closeSettings()'), true);
  assert.equal(g.run('isSettingsOpen()'), false);
  assert.equal(g.run('isMenuPaused()'), true, '설정에서 뒤로 가도 일시정지는 유지되어야 합니다.');
  g.run('openSettings()');
  g.run("resumeFromPauseMenu(); openPauseMenu('manual');");
  assert.equal(g.run('isSettingsOpen()'), false, '일시정지 메뉴는 항상 첫 화면부터 열려야 합니다.');

  // 4. 초기화: 한 번 누르면 확인 상태만, 3초가 지나면 원래대로, 확인 상태에서 다시 누르면 세이브를 지웁니다.
  let reloaded = 0;
  g.context.location = { reload: () => { reloaded++; } };
  const btn = g.run("document.getElementById('btn-reset-save')");
  const classes = new Set();
  btn.classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c), toggle() {} };
  g.run('saveGame(); onResetClick();');
  assert.ok(classes.has('armed'), '첫 클릭은 확인 상태가 되어야 합니다.');
  assert.notEqual(g.run('saveStorage.read(SAVE_KEY)'), null, '첫 클릭만으로 세이브가 지워지면 안 됩니다.');
  assert.equal(reloaded, 0);
  for (let i = 0; i < 100; i++) g.step(1 / 30); // 3.3초
  assert.ok(!classes.has('armed'), '3초가 지나면 확인 상태가 풀려야 합니다.');
  g.run('onResetClick(); onResetClick();');
  assert.equal(g.run('saveStorage.read(SAVE_KEY)'), null, '확인 상태에서 다시 누르면 세이브가 지워져야 합니다.');
  assert.equal(reloaded, 1);

  // 5. 웹 빌드에는 화면 묶음이 없습니다.
  assert.equal(g.run('hasDesktopWindow()'), false);
}

// 6. 데스크톱 화면 설정 저장소: 기본값, 잘못된 값 정리, 작업 영역 맞춤, 크기 목록
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dps-window-'));
  try {
    const store = ws.createWindowSettings(dir);
    assert.deepEqual(store.read(), ws.DEFAULT_PREFS, '파일이 없으면 기본 창(1280×800)입니다.');
    assert.deepEqual(store.write({ fullscreen: true, width: 1600, height: 900 }), { fullscreen: true, width: 1600, height: 900 });
    assert.deepEqual(store.read(), { fullscreen: true, width: 1600, height: 900 });
    fs.writeFileSync(store.file, '{ broken');
    assert.deepEqual(store.read(), ws.DEFAULT_PREFS, '깨진 파일은 기본값으로 읽습니다.');
    assert.deepEqual(ws.sanitizePrefs({ fullscreen: 'yes', width: 100, height: 'x' }), ws.DEFAULT_PREFS);
    assert.deepEqual(ws.fitToWorkArea({ fullscreen: false, width: 1920, height: 1080 }, { width: 1366, height: 728 }), { fullscreen: false, width: 1366, height: 728 });
    assert.deepEqual(ws.sizeOptions({ width: 1366, height: 728 }).map((o) => o.fits), [false, false, false], '작업 영역보다 큰 크기는 고를 수 없게 표시합니다.');
    assert.deepEqual(ws.sizeOptions({ width: 1920, height: 1040 }).map((o) => o.fits), [true, true, false]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// 7. 상단 버튼 정리와 연결: 언어·사운드·초기화는 상단에서 빠지고 설정 화면에 있습니다.
{
  const html = read('index.html');
  const top = html.slice(html.indexOf('<div class="top-controls">'), html.indexOf('</header>'));
  for (const id of ['btn-lang', 'btn-sound', 'sound-popover', 'btn-reset-save']) assert.ok(!top.includes(`id="${id}"`), `${id}는 상단에 남으면 안 됩니다.`);
  const settings = html.slice(html.indexOf('id="settings-card"'), html.indexOf('<script'));
  for (const id of ['settings-lang', 'settings-motion', 'slider-master-vol', 'slider-bgm-vol', 'slider-sfx-vol', 'btn-sound-mute-all', 'btn-sound-skip', 'settings-display-group', 'btn-reset-save']) {
    assert.ok(settings.includes(`id="${id}"`), `설정 화면에 ${id}가 필요합니다.`);
  }
  assert.ok(html.indexOf('motion-pref.js') < html.indexOf('i18n-en.js'), 'motion-pref.js는 다른 스크립트보다 먼저 로드되어야 합니다.');
  assert.ok(html.indexOf('settings-menu.js') < html.indexOf('src/scripts/game.js'));
  const preload = read('electron/preload.cjs');
  for (const ch of ['window:get-state', 'window:set-fullscreen', 'window:set-size']) {
    assert.ok(preload.includes(ch), `preload에 ${ch}가 필요합니다.`);
    assert.ok(read('electron/main.cjs').includes(`ipcMain.on('${ch}'`), `main에 ${ch} 처리가 필요합니다.`);
  }
}

console.log('   설정 화면 모션 줄이기(JS·CSS 덮어쓰기·세이브 왕복), 열기/닫기, 초기화 2단계 확인, 데스크톱 화면 설정 저장소, 상단 버튼 정리 검증 통과');
