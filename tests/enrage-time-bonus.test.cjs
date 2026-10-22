/* 광폭화 남은 시간 보상: 보상 공식(남은 시간 비율 × 보스 골드 × 배수), 최종 보스·일반 몬스터 제외,
 * 처치 순간 즉시 지급, 연출 중 위험 점멸 끔, 새 스테이지에서 연출 상태 정리를 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const g = createHeadlessGame();
const mult = g.run('ENRAGE_TIME_BONUS.goldMult');
const boss = g.run('getStageData(10)');

// 1. 공식: 남은 시간 비율에 비례, 0~1로 자름
assert.equal(g.run(`getEnrageTimeBonus(10, ${boss.enrage})`), Math.round(boss.gold * mult), '시간이 모두 남으면 보스 골드 × 배수');
assert.equal(g.run(`getEnrageTimeBonus(10, ${boss.enrage / 2})`), Math.round(boss.gold * mult * 0.5));
assert.equal(g.run('getEnrageTimeBonus(10, 0)'), 0);
assert.equal(g.run(`getEnrageTimeBonus(10, ${boss.enrage * 3})`), Math.round(boss.gold * mult), '남은 시간이 제한보다 길어도 비율 1까지만');
assert.equal(g.run('getEnrageTimeBonus(9, 50)'), 0, '일반 몬스터는 보상이 없습니다.');
assert.equal(g.run('getEnrageTimeBonus(FINAL_STAGE, 100)'), 0, '최종 보스는 골드를 쓸 곳이 없어 제외합니다.');

// 2. 실제 처치: 보너스는 처치 순간 지급되고 런 통계에 남습니다.
g.run('loadStage(10); state.gold = 0; state.stats = {}; state.highestClearedStage = 99;');
g.run(`state.combat.bossEnrageRem = ${boss.enrage - 30};`);
const expected = g.run(`getEnrageTimeBonus(10, ${boss.enrage - 30})`);
g.run('state.monster.hp = 0; onMonsterKilled();');
assert.equal(g.run('state.gold'), boss.gold + expected, '처치 골드 + 남은 시간 보너스가 즉시 들어와야 합니다.');
assert.equal(g.run('state.stats.timeBonusGold'), expected);
assert.equal(g.run('state.combat.timeBonusDraining'), true, '연출 중 표시가 켜져야 합니다.');

// 3. 연출 중에는 '10초 이하 위험' 점멸을 끄고, 새 스테이지에서 상태를 정리합니다.
const game = read('src/scripts/game.js');
assert.match(game, /toggle\('danger', c\.bossEnrageRem <= 10 && !c\.timeBonusDraining\)/);
g.run('loadStage(11);');
assert.equal(g.run('state.combat.timeBonusDraining'), false);

// 4. 연출 시간은 보스 처치 여운 안에 끝나야 합니다(마지막 조각 출발 + 비행 0.6초).
const cfg = g.run('ENRAGE_TIME_BONUS');
const lastLandMs = cfg.startMs + (cfg.maxChunks - 1) * cfg.stepMs + 600;
assert.ok(lastLandMs <= g.run('KILL_BEAT_MS.boss'), `연출(${lastLandMs}ms)이 보스 처치 여운 안에 끝나야 합니다.`);
assert.match(read('src/styles/paper-ui.css'), /prefers-reduced-motion[\s\S]*\.time-bonus-tag \{ animation: none; \}/);

console.log('   광폭화 남은 시간 보상 공식·제외 대상·즉시 지급·위험 점멸 끔·상태 정리·여운 안 완료 검증 통과');
