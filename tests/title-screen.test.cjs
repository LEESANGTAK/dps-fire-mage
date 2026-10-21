/* 타이틀 화면: 런 상태별 버튼 노출, 타이틀 중 전투 정지, 떠날 때 여운, 런 포기(2단계 확인·결과창 사유), 새 런·이어하기 흐름, 마크업 연결을 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const g = createHeadlessGame({ seed: 11 });
const st = g.run('state');
st.autoCast = true;
const runFor = (sec) => { for (let t = 0; t < sec; t += 1 / 30) g.step(1 / 30); };
const shown = (id) => g.run(`document.getElementById('${id}').hidden`) === false;

// 1. 첫 실행: [시작] 하나만 보이고, 타이틀이 떠 있는 동안 전투·시계·입력이 멈춥니다.
g.run('initTitleScreen(false); openTitleScreen();');
assert.equal(g.run('getTitleRunStatus()'), 'first');
assert.ok(shown('btn-title-start'));
for (const id of ['btn-title-continue', 'btn-title-new-run', 'btn-title-hall']) assert.ok(!shown(id), `첫 실행에는 ${id}가 보이면 안 됩니다.`);
const hp0 = st.monster.hp;
runFor(3);
assert.equal(st.playTimeSec, 0, '타이틀 중에는 스피드런 시계가 흐르면 안 됩니다.');
assert.equal(st.monster.hp, hp0, '타이틀 중에는 피해가 들어가면 안 됩니다.');
assert.equal(g.run("requestManualSkill('fireball')"), false, '타이틀 중 주문 입력은 무시됩니다.');

// 2. [시작]: 로고가 빠지는 0.8초 동안은 계속 멈춰 있다가 전투가 시작됩니다.
g.run('closeTitleScreen()');
runFor(0.5);
assert.equal(g.run('isTitleOpen()'), true);
assert.equal(st.playTimeSec, 0);
runFor(0.5);
assert.equal(g.run('isTitleOpen()'), false);
runFor(2);
assert.ok(st.playTimeSec > 1.5, '타이틀이 걷힌 뒤 시계가 흘러야 합니다.');

// 3. 진행 중인 런으로 타이틀에 돌아오면 [이어하기]. 런을 한 번도 마치지 않았다면 [새 런]은 아직 없습니다.
st.meta.lastRun = null;
g.run('returnToTitle()');
assert.equal(g.run('getTitleRunStatus()'), 'progress');
assert.ok(shown('btn-title-continue') && !shown('btn-title-start'));
assert.ok(!shown('btn-title-new-run'), '첫 런을 마치기 전에는 [새 런]이 없습니다.');
const t1 = st.playTimeSec;
runFor(1);
assert.equal(st.playTimeSec, t1, '타이틀로 돌아오면 시계가 멈춰야 합니다.');
g.run('continueFromTitle()');
runFor(1);
assert.equal(g.run('isTitleOpen()'), false);

// 4. 런 포기: 모달이 떠 있으면 거부, 전투 중에는 숙련도를 주고 '포기' 사유로 결과창을 엽니다.
let defeatReason = null;
g.run('const __openDefeat = openDefeatModal;');
g.context.__spyDefeat = (r) => { defeatReason = r; };
g.run('openDefeatModal = (r) => { __spyDefeat(r); __openDefeat(r); };');
st.isPaused = true;
assert.equal(g.run('abandonRun()'), false, '각성 카드·결과창이 떠 있으면 포기할 수 없습니다.');
assert.equal(g.run('canAbandonRun()'), false);
st.isPaused = false;
assert.equal(g.run('canAbandonRun()'), true);
assert.equal(g.run('abandonRun()'), true);
assert.equal(st.runFailed, true);
assert.equal(st.runEndReason, 'abandon');
assert.equal(st.runRewarded, true, '포기도 런 종료 보상(숙련도) 처리를 거칩니다.');
assert.equal(defeatReason, 'abandon');
assert.ok(st.meta.lastRun, '포기한 런도 lastRun을 남깁니다.');
assert.equal(g.run('abandonRun()'), false, '이미 끝난 런은 다시 포기할 수 없습니다.');

// 5. 세이브 왕복: 끝난 런의 사유가 유지됩니다.
g.run('saveGame(); state.runEndReason = null; loadGame();');
assert.equal(st.runEndReason, 'abandon');

// 6. 결과를 못 본 끝난 런: [이어하기] = 같은 사유의 결과창. 결과를 본 뒤에는 [새 런]이 주 행동입니다.
st.meta.lastRun.shown = false;
g.run('returnToTitle()');
assert.equal(g.run('getTitleRunStatus()'), 'result');
assert.ok(shown('btn-title-continue') && shown('btn-title-new-run'));
defeatReason = null;
g.run('continueFromTitle()');
assert.equal(defeatReason, 'abandon', '결과 보기는 저장된 사유로 패배 결과창을 열어야 합니다.');
assert.equal(g.run('isTitleOpen()'), false);
st.meta.lastRun.shown = true;
g.run('returnToTitle()');
assert.equal(g.run('getTitleRunStatus()'), 'ended');
assert.ok(shown('btn-title-new-run') && !shown('btn-title-continue'));

// 7. 새 런: 고를 설정이 없으면 바로 출발 → 1스테이지·사유 초기화·타이틀이 걷힙니다.
st.meta.xp = 0;
st.meta.infernoUnlocked = 0;
assert.equal(g.run('hasRunSetupChoices()'), false);
g.run('onTitleNewRunClick()');
runFor(1);
assert.equal(g.run('isTitleOpen()'), false);
assert.equal(st.runFailed, false);
assert.equal(st.runEndReason, null);
assert.equal(st.currentStage, 1);
// 고를 설정(시작 주문서)이 있으면 출발 전에 새 런 설정 칸을 펼칩니다.
st.meta.xp = 10;
g.run('returnToTitle()');
assert.equal(g.run('hasRunSetupChoices()'), true);

// 8. 명예의 전당은 첫 최종 보스 토벌 뒤에만 타이틀에 보입니다.
st.unfolded.hallOfFame = false;
g.run('renderTitleScreen()');
assert.ok(!shown('btn-title-hall'));
st.unfolded.hallOfFame = true;
g.run('renderTitleScreen()');
assert.ok(shown('btn-title-hall'));

// 9. 마크업·연결
const html = read('index.html');
const top = html.slice(html.indexOf('<div class="top-controls">'), html.indexOf('</header>'));
assert.ok(!top.includes('btn-hall-of-fame'), '명예의 전당은 상단에서 빠지고 타이틀로 옮겨야 합니다.');
for (const id of ['title-screen', 'btn-title-start', 'btn-title-continue', 'btn-title-new-run', 'btn-title-hall', 'btn-title-settings', 'btn-title-quit', 'title-new-run', 'title-run-setup-slot', 'btn-title-depart', 'btn-pause-title', 'btn-pause-abandon']) {
  assert.ok(html.includes(`id="${id}"`), `${id} 요소가 필요합니다.`);
}
assert.ok(html.indexOf('title-screen.js') < html.indexOf('src/scripts/game.js'));
const css = read('src/styles/paper-ui.css');
const zOf = (sel) => Number((css.match(new RegExp(`${sel.replace('.', '\\.')} \\{[^}]*z-index: (\\d+)`)) || [])[1]);
assert.ok(zOf('.title-screen') < zOf('.victory-modal-backdrop'), '타이틀에서 연 명예의 전당(결과창)이 타이틀 위에 떠야 합니다.');
assert.ok(zOf('.title-screen') < zOf('.pause-menu-backdrop'), '타이틀에서 연 설정 화면이 타이틀 위에 떠야 합니다.');
assert.match(read('scripts/store/capture-screenshots.cjs'), /closeTitleScreen\(true\)/, '스토어 촬영은 타이틀을 걷고 전투를 찍어야 합니다.');

console.log('   타이틀 화면 런 상태별 버튼, 전투 정지·떠남 여운, 런 포기·사유, 이어하기/결과 보기/새 런 흐름, 명예의 전당 이동 검증 통과');
