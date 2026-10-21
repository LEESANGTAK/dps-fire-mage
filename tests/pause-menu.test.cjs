/* Esc 일시정지 메뉴: 전투·시계 정지, 수동 입력 차단, 복귀 호흡, 모달 정지와의 분리, 자동 정지 조건, 종료 버튼 노출을 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const root = path.join(__dirname, '..');

const g = createHeadlessGame({ seed: 7 });
const st = g.run('state');
st.autoCast = true;
const runFor = (sec) => { for (let t = 0; t < sec; t += 1 / 30) g.step(1 / 30); };

// 1. 전투가 돌고 있음을 확인
runFor(2);
const timeBefore = st.playTimeSec;
assert.ok(timeBefore > 1.5, '일시정지 전에는 스피드런 시계가 흘러야 합니다.');

// 2. 메뉴를 열면 시계·몬스터 체력·시전이 모두 멈춥니다.
assert.equal(g.run("openPauseMenu('manual')"), true);
assert.equal(g.run('isMenuPaused()'), true);
const hpPaused = st.monster.hp;
const castPaused = st.combat.castRemaining;
runFor(5);
assert.equal(st.playTimeSec, timeBefore, '메뉴가 열려 있는 동안 스피드런 시계가 멈춰야 합니다.');
assert.equal(st.monster.hp, hpPaused, '메뉴가 열려 있는 동안 피해가 들어가면 안 됩니다.');
assert.equal(st.combat.castRemaining, castPaused, '메뉴가 열려 있는 동안 시전이 진행되면 안 됩니다.');

// 3. 수동 주문 입력은 무시되고 예약도 남지 않습니다.
assert.equal(g.run("requestManualSkill('fireball')"), false);
assert.equal(g.run("triggerSkill('fireball', true)"), false);
assert.ok(!st.combat.queuedSkill, '일시정지 중 입력이 예약되면 안 됩니다.');

// 4. [계속] → 복귀 호흡(0.6초) 동안은 계속 멈춰 있다가 재개합니다.
assert.equal(g.run('resumeFromPauseMenu()'), true);
runFor(0.4);
assert.equal(g.run('isMenuPaused()'), true, '복귀 호흡 중에는 아직 멈춰 있어야 합니다.');
assert.equal(st.playTimeSec, timeBefore);
runFor(0.5);
assert.equal(g.run('isMenuPaused()'), false, '복귀 호흡이 끝나면 재개되어야 합니다.');
runFor(1);
assert.ok(st.playTimeSec > timeBefore + 0.5, '재개 후 시계가 다시 흘러야 합니다.');

// 5. 복귀 호흡 중 다시 열면 정지가 유지됩니다(재개 타이머 취소).
g.run("openPauseMenu('manual'); resumeFromPauseMenu();");
runFor(0.2);
assert.equal(g.run("openPauseMenu('manual')"), true);
runFor(1.5);
assert.equal(g.run('isMenuPaused()'), true, '복귀 호흡 중 다시 열면 계속 멈춰 있어야 합니다.');
g.run('resumeFromPauseMenu()');
runFor(1);

// 6. 모달 정지(각성 카드 등)와 분리: 메뉴를 닫아도 모달 정지는 그대로입니다.
st.isPaused = true;
g.run("openPauseMenu('manual'); resumeFromPauseMenu();");
runFor(1);
assert.equal(g.run('isMenuPaused()'), false);
assert.equal(st.isPaused, true, '메뉴를 닫아도 열려 있던 모달의 정지는 유지되어야 합니다.');

// 7. 자동 정지(포커스 잃음): 포커스를 받은 적 있는 창에서, 모달이 없을 때만 열립니다.
g.run('pauseWindowFocused = false; autoPauseOnFocusLoss();');
assert.equal(g.run('isMenuPaused()'), false, '포커스를 받은 적 없는 창(스모크 테스트·촬영)은 자동 정지하지 않습니다.');
g.run('pauseWindowFocused = true; autoPauseOnFocusLoss();');
assert.equal(g.run('isMenuPaused()'), false, '이미 모달로 멈춰 있으면 메뉴를 덮지 않습니다.');
st.isPaused = false;
g.run('autoPauseOnFocusLoss();');
assert.equal(g.run('isMenuPaused()'), true, '전투 중 포커스를 잃으면 자동으로 멈춰야 합니다.');
g.run('resumeFromPauseMenu()');
runFor(1);

// 8. 종료 버튼은 데스크톱 빌드(desktopApp.quit)에서만 노출되고, 저장 후 종료를 요청합니다.
assert.equal(g.run('canQuitGame()'), false, '웹 빌드에는 종료 버튼이 없어야 합니다.');
let quitCalls = 0;
g.context.desktopApp = { quit: () => { quitCalls++; } };
assert.equal(g.run('canQuitGame()'), true);
g.run('quitGameFromPauseMenu()');
assert.equal(quitCalls, 1);

// 9. 마크업·연결: 메뉴는 모든 창 위에 뜨고, 스크립트는 game.js보다 먼저 로드되며, 데스크톱 종료는 창 닫기 경로를 탑니다.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const id of ['pause-menu-backdrop', 'btn-pause-resume', 'btn-pause-quit', 'btn-pause', 'pause-menu-stage', 'pause-menu-time']) {
  assert.ok(html.includes(`id="${id}"`), `${id} 요소가 필요합니다.`);
}
assert.ok(html.indexOf('pause-menu.js') < html.indexOf('src/scripts/game.js'), 'pause-menu.js가 game.js보다 먼저 로드되어야 합니다.');
const css = fs.readFileSync(path.join(root, 'src', 'styles', 'paper-ui.css'), 'utf8');
const z = Number((css.match(/\.pause-menu-backdrop \{[^}]*z-index: (\d+)/) || [])[1]);
// 도감(codex)만 일시정지 메뉴 위에 뜹니다(메뉴에서 연 도감이 메뉴를 덮음).
const codexZ = Number((css.match(/\.codex-backdrop \{[^}]*z-index: (\d+)/) || [])[1]);
assert.ok(codexZ > z, '일시정지 메뉴에서 연 도감은 메뉴 위에 떠야 합니다.');
for (const other of css.matchAll(/z-index: (\d+)/g)) {
  if (Number(other[1]) === codexZ) continue;
  assert.ok(z >= Number(other[1]), `일시정지 메뉴(z-index ${z})가 다른 창(${other[1]})보다 위에 있어야 합니다.`);
}
assert.match(fs.readFileSync(path.join(root, 'electron', 'preload.cjs'), 'utf8'), /quit: \(\) => ipcRenderer\.send\('app:quit'\)/);
assert.match(fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8'), /ipcMain\.on\('app:quit'[\s\S]*?win\.close\(\)/);

console.log('   일시정지 메뉴 전투·시계 정지, 입력 차단, 복귀 호흡, 모달 정지 분리, 포커스 자동 정지 조건, 데스크톱 종료 검증 통과');
