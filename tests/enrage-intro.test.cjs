/* 광폭화 타이머 안내 쪽지: 처음 두 번의 보스전에서만 한 번씩 뜨고(세이브에 횟수 기록), 일반 스테이지·타이틀·일시정지 중에는 뜨지 않습니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const g = createHeadlessGame();
const count = () => g.run('state.meta.tips.enrageIntro');
const bossStages = [];
for (let s = 1; s <= 20 && bossStages.length < 3; s++) if (g.run(`getStageData(${s}).isPhaseBoss`)) bossStages.push(s);
const normalStage = bossStages[0] - 1;
assert.equal(bossStages.length, 3, '보스 스테이지가 3개 이상 있어야 합니다.');
g.run('if (typeof isTitleOpen === "function" && isTitleOpen()) closeTitleScreen && closeTitleScreen();');
g.run('state.meta.tips.enrageIntro = 0; state.isPaused = false;');

// 1. 일반 스테이지에서는 뜨지 않습니다.
g.run(`loadStage(${normalStage}); updateLiveHUD(); updateLiveHUD();`);
assert.equal(count(), 0);

// 2. 일시정지 중에는 미뤘다가, 풀리면 그 보스전에서 한 번만 뜹니다.
g.run(`loadStage(${bossStages[0]}); state.isPaused = true; updateLiveHUD();`);
assert.equal(count(), 0, '일시정지(모달) 중에는 쪽지를 띄우지 않습니다.');
g.run('state.isPaused = false; updateLiveHUD(); updateLiveHUD(); updateLiveHUD();');
assert.equal(count(), 1, '한 보스전에서는 한 번만 셉니다.');

// 3. 두 번째 보스전까지 보여 주고, 세 번째부터는 막대만 남습니다.
g.run(`loadStage(${bossStages[1]}); updateLiveHUD();`);
assert.equal(count(), 2);
g.run(`loadStage(${bossStages[2]}); updateLiveHUD();`);
assert.equal(count(), 2, '세 번째 보스전부터는 쪽지가 뜨지 않습니다.');
assert.equal(g.run('maybeShowEnrageIntro()'), false);

// 4. 마크업·스타일 연결
assert.match(read('src/scripts/game.js'), /maybeShowEnrageIntro\(\);\n\s*const enrageTotal/, '타이머를 그릴 때 안내를 확인해야 합니다.');
const css = read('src/styles/paper-ui.css');
assert.match(css, /\.enrage-intro \{/);
assert.match(css, /prefers-reduced-motion[\s\S]*\.enrage-intro, \.enrage-intro\.leaving/, '모션 줄이기에서는 쪽지 애니메이션을 끕니다.');

console.log('   광폭화 타이머 안내 쪽지 첫 두 보스전 노출·전투당 1회·일시정지 중 미룸·일반 스테이지 미노출 검증 통과');
