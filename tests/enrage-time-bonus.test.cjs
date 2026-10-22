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
assert.equal(g.run('state.pendingBonusGold'), expected, '보너스 골드는 동전이 날아오기 전까지 골드 칸 숫자에 넣지 않습니다.');
assert.ok(read('src/scripts/game.js').includes('state.pendingCoinGold || 0) + Math.max(0, state.pendingBonusGold'), '골드 칸은 처치 동전과 보너스 동전을 따로 기다립니다.');

// 3. 연출 중에는 '10초 이하 위험' 점멸을 끄고, 새 스테이지에서 상태를 정리합니다.
const game = read('src/scripts/game.js');
assert.match(game, /toggle\('danger', c\.bossEnrageRem <= 10 && !c\.timeBonusDraining\)/);
g.run('loadStage(11);');
assert.equal(g.run('state.combat.timeBonusDraining'), false);

// 4. 연출 순서: 보스 격파 도장(1.9초)이 끝난 뒤 축하 배너 → 타이머 조각 → 마지막 동전 도착 → 카드 창
const cfg = g.run('ENRAGE_TIME_BONUS');
const bossBeat = g.run('KILL_BEAT_MS.boss');
assert.ok(cfg.bannerMs >= bossBeat + 300, '축하 배너는 보스 격파 도장·처치 동전이 끝나고 숨을 고른 뒤 나와야 합니다.');
assert.ok(cfg.drainStartMs >= cfg.bannerMs + 1000, '배너를 충분히 읽은 뒤 타이머가 동전으로 바뀝니다.');
// 동전: 처음엔 천천히 하나씩, 출발 간격과 비행 시간이 점점 짧아져 마지막엔 몰아칩니다.
const sched = g.run(`getTimeBonusSchedule(${boss.enrage})`);
const gaps = sched.slice(1).map((p, i) => p.at - sched[i].at);
assert.equal(sched.length, cfg.maxChunks, '시간이 많이 남으면 동전이 최대 개수까지 나옵니다.');
for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] <= gaps[i - 1], '동전 출발 간격은 점점 짧아져야 합니다.');
assert.ok(gaps[0] >= 400 && gaps[gaps.length - 1] <= 80, `첫 간격은 느긋하게, 마지막은 다다다닥(${gaps[0]} → ${gaps[gaps.length - 1]}ms).`);
assert.ok(sched[0].fly > sched[sched.length - 1].fly, '첫 동전은 천천히, 뒤 동전은 빠르게 날아갑니다.');
assert.equal(g.run('getTimeBonusSchedule(5)').length, cfg.minChunks, '남은 시간이 적어도 최소 개수는 날아갑니다.');
const fullBeat = g.run(`getTimeBonusBeatMs(${boss.enrage})`);
assert.ok(fullBeat > g.run(`getTimeBonusLandMs(${boss.enrage})`), '마지막 동전이 닿은 뒤에 카드 창이 열립니다.');
assert.ok(fullBeat <= 7000, `축하 연출이 너무 길면 반복 플레이에 지칩니다(${fullBeat}ms).`);
assert.ok(game.includes('const beatMs = timeBonus > 0 ? getTimeBonusBeatMs(timeBonusRemaining)'), '보상이 있을 때만 카드 창을 늦춥니다.');
assert.match(read('src/styles/paper-ui.css'), /prefers-reduced-motion[\s\S]*\.time-bonus-tag \{ animation: none; \}/);

console.log('   광폭화 남은 시간 보상 공식·제외 대상·즉시 지급·위험 점멸 끔·상태 정리·축하 배너→타이머 조각→카드 창 순서 검증 통과');
