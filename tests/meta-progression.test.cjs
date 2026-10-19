/* 클리어 후 콘텐츠: 업화 단계 규칙 누적, 런 종료 숙련도(실패 보상), 해금 순서, 세이브 정리, 실제 게임 런에 적용되는지 검증합니다. */
const assert = require('node:assert/strict');
const M = require('../src/scripts/meta-progression.js');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

// 1. 업화 단계 규칙은 누적되고, 범위를 벗어난 값은 0~최대로 고정됩니다.
const m0 = M.getInfernoModifiers(0);
assert.deepEqual([m0.hpMult, m0.bossHpMult, m0.enrageMult, m0.rerollMult, m0.normalChoices, m0.shieldMult], [1, 1, 1, 1, 3, 1]);
const m4 = M.getInfernoModifiers(4);
assert.equal(m4.hpMult, 1.15);
const bossHpPct4 = M.INFERNO_RULES.find((r) => r.level === 4).bossHpPct;
assert.ok(Math.abs(m4.bossHpMult - 1.15 * (1 + bossHpPct4 / 100)) < 1e-9, '보스 체력은 일반 배율에 보스 배율이 곱해집니다.');
// 규칙 값은 밸런스 조정으로 바뀌므로 표에서 누적값을 계산해 비교합니다.
const sumTo = (lv, key) => M.INFERNO_RULES.filter((r) => r.level <= lv).reduce((a, r) => a + (r[key] || 0), 0);
assert.ok(Math.abs(m4.enrageMult - (1 + sumTo(4, 'enragePct') / 100)) < 1e-9);
assert.ok(Math.abs(m4.rerollMult - (1 + sumTo(4, 'rerollPct') / 100)) < 1e-9);
assert.ok(Math.abs(m4.cooldownMult - (1 + sumTo(4, 'cooldownPct') / 100)) < 1e-9);
assert.equal(m4.cooldownMult, 1, '주문 재사용 대기시간 증가는 6단계부터입니다.');
assert.ok(M.getInfernoModifiers(6).cooldownMult > 1);
assert.equal(m4.normalChoices, 3, '선택지 감소는 5단계부터입니다.');
const m8 = M.getInfernoModifiers(8);
assert.equal(m8.normalChoices, 2);
assert.ok(Math.abs(m8.enrageMult - (1 + sumTo(8, 'enragePct') / 100)) < 1e-9);
assert.ok(Math.abs(m8.shieldMult - (1 + sumTo(8, 'shieldPct') / 100)) < 1e-9);
assert.ok(m8.shieldSec < 10, '7단계부터 불의 심장 제한 시간이 줄어듭니다.');
assert.ok(Math.abs(m8.shieldHeal - (10 + sumTo(8, 'shieldHealPct')) / 100) < 1e-9, '불의 심장을 못 깨면 회복량이 업화 규칙만큼 늘어납니다.');
assert.equal(M.getInfernoModifiers(6).shieldHeal, 0.1);
assert.equal(M.getInfernoModifiers(6).shieldSec, 10);
assert.deepEqual(M.getInfernoModifiers(99), m8);
assert.deepEqual(M.getInfernoModifiers(-3), m0);
assert.equal(M.INFERNO_RULES.length, M.INFERNO_MAX, '단계마다 규칙이 하나씩 있어야 합니다.');

// 2. 런 종료 숙련도: 실패해도 돌파한 만큼 쌓이고, 최종 보스·업화 단계는 더 많이 줍니다.
assert.equal(M.getRunMasteryXp({ clearedStage: 0 }), 0);
assert.equal(M.getRunMasteryXp({ clearedStage: 4 }), 4, '5스테이지 보스에서 실패하면 일반 4스테이지분');
assert.equal(M.getRunMasteryXp({ clearedStage: 9 }), 8 + 3, '10스테이지 보스에서 실패하면 일반 8 + 페이즈 보스 1');
assert.equal(M.getRunMasteryXp({ clearedStage: 20, finalKilled: true }), 16 + 9 + 10);
assert.equal(M.getRunMasteryXp({ clearedStage: 20, finalKilled: true, infernoLevel: 4 }), 70, '4단계는 +100%');

// 3. 해금은 경험치 순서대로, 카드 잠금·시작 주문서 목록이 일치합니다.
const xps = M.MASTERY_UNLOCKS.map((u) => u.xp);
assert.deepEqual(xps, [...xps].sort((a, b) => a - b), '해금 기준은 오름차순이어야 합니다.');
assert.equal(M.getLockedCardIds(0).length, M.MASTERY_UNLOCKS.filter((u) => u.type === 'card').length);
assert.deepEqual(M.getLockedCardIds(1e9), []);
assert.deepEqual(M.getUnlockedStartSpells(0), []);
assert.deepEqual(M.getUnlockedStartSpells(1e9).sort(), Object.keys(M.START_SPELL_CARDS).sort());
const p = M.getMasteryProgress(40);
assert.equal(p.level, 3);
assert.equal(p.next.xp, 45);
assert.ok(Math.abs(p.ratio - 0.5) < 1e-9);
assert.equal(M.getMasteryProgress(1e9).next, null);

// 4. 세이브 정리: 구형 세이브 최단 기록은 0단계로, 해금 안 된 선택은 걸러냅니다.
const legacy = M.normalizeMeta(undefined, 812);
assert.deepEqual(legacy.bestTimes, { 0: 812 });
assert.equal(legacy.infernoUnlocked, 1, '구형 세이브로 이미 클리어한 플레이어는 업화 1단계가 열려 있습니다.');
assert.equal(M.normalizeMeta(undefined, null).infernoUnlocked, 0);
const bad = M.normalizeMeta({ xp: 5, infernoUnlocked: 2, infernoSelected: 7, startSpell: 'meteor', bestTimes: { 3: 600, x: 'no' } }, 900);
assert.equal(bad.infernoSelected, 2, '해금된 단계보다 높게 고를 수 없습니다.');
assert.equal(bad.startSpell, null, '해금 안 된 시작 주문서는 비웁니다.');
assert.deepEqual(bad.bestTimes, { 3: 600 }, 'meta가 있는 세이브는 구형 기록을 덮어쓰지 않습니다.');

// 5. 실제 게임: 새 런에 업화 단계·시작 주문서·카드 잠금이 적용되고, 실패해도 숙련도가 한 번만 지급됩니다.
const g = createHeadlessGame({ seed: 7 });
const st = g.run('state');
assert.deepEqual([...st.lockedCards].sort(), M.getLockedCardIds(0).sort(), '첫 런은 전설 카드가 잠겨 있습니다.');
st.meta.xp = 30; // 시작 주문서 불꽃 작렬 해금 구간
st.meta.infernoUnlocked = 6;
st.meta.infernoSelected = 6;
st.meta.startSpell = 'fireblast';
g.run('restartSpeedrunRun()');
assert.equal(st.infernoLevel, 6);
assert.equal(st.grimoires.fireblast, true, '시작 주문서를 들고 시작합니다.');
assert.equal(st.monster.maxHp, Math.round(500 * M.getInfernoModifiers(6).hpMult), '1스테이지 체력에 업화 배율이 적용됩니다.');
const boss5 = g.run('getStageData(5)');
assert.equal(boss5.hp, Math.round(8200 * M.getInfernoModifiers(6).hpMult), '보스 체력 증가는 10스테이지 이후 보스에만 적용됩니다.');
assert.equal(boss5.enrage, 110, '광폭화 단축은 10스테이지 이후 보스에만 적용됩니다.');
assert.equal(g.run('getStageData(10)').hp, Math.round(28500 * M.getInfernoModifiers(6).bossHpMult));
assert.equal(g.run('getStageData(10)').enrage, Math.round(160 * M.getInfernoModifiers(6).enrageMult));
assert.equal(g.run('getAwakeningChoiceCount(false)'), 2, '5단계 이상 일반 웨이브는 선택지 2장');
assert.equal(g.run('getAwakeningChoiceCount(true)'), 3);
assert.equal(g.run('getRerollBaseCost()'), Math.round(10 * M.getInfernoModifiers(6).rerollMult));
for (let i = 0; i < 40; i++) {
  const ids = g.run('deckManager.drawChoices(3, true, state)').map((c) => c.id);
  for (const id of ids) assert.ok(!st.lockedCards.includes(id), `잠긴 카드 ${id}가 추첨되면 안 됩니다.`);
}

st.highestClearedStage = 9; // 10스테이지 보스에서 실패
g.run('failRunByEnrage()');
const gained = M.getRunMasteryXp({ clearedStage: 9, infernoLevel: 6 });
assert.equal(st.meta.xp, 30 + gained, '실패해도 돌파한 만큼 숙련도를 얻습니다.');
assert.equal(st.meta.lastRun.gained, gained);
assert.ok(st.meta.lastRun.newUnlocks.some((u) => u.id === 'sum_cinder_lord'), '기준을 넘으면 해금 목록에 기록됩니다.');
g.run('awardRunMastery(false)');
assert.equal(st.meta.xp, 30 + gained, '같은 런에서 두 번 지급하면 안 됩니다.');
assert.equal(st.meta.infernoUnlocked, 6, '실패로는 다음 업화 단계가 열리지 않습니다.');

// 6. 최고 단계로 최종 보스를 쓰러뜨리면 다음 단계가 열리고 다음 런 기본값이 됩니다.
g.run('restartSpeedrunRun()');
st.highestClearedStage = 20;
g.run('awardRunMastery(true)');
assert.equal(st.meta.infernoUnlocked, 7);
assert.equal(st.meta.infernoSelected, 7);
assert.equal(st.meta.lastRun.newInferno, 7);

// 7. 업화 7단계: 주문 재사용 대기시간 증가와 불의 심장 제한 시간 단축이 실제 전투에 적용됩니다.
g.run('restartSpeedrunRun()');
assert.equal(st.infernoLevel, 7);
const m7 = M.getInfernoModifiers(7);
assert.ok(Math.abs(g.run('getPlayerStats().cdr') - (1 - m7.cooldownMult)) < 1e-9, '업화 재사용 대기 증가가 cdr(음수)로 들어가야 합니다.');
st.grimoires.combustion = true;
st.combat.gcdRemaining = 0;
g.run("triggerSkill('combustion', true)");
assert.ok(Math.abs(st.combat.combustionCdTotal - Math.max(14, 30 * m7.cooldownMult)) < 1e-9, '마력 폭주 재사용 대기에 업화 배율이 곱해져야 합니다.');
g.run('loadStage(20)');
st.monster.hp = Math.floor(st.monster.maxHp * 0.29);
g.step(1 / 30);
assert.ok(st.bossGimmick.shield > 0, '체력 30% 이하에서 불의 심장이 전개됩니다.');
assert.ok(Math.abs(st.bossGimmick.shieldTimer - m7.shieldSec) < 0.1, `불의 심장 제한 시간은 ${m7.shieldSec}초여야 합니다.`);

// 8. 첫 런을 5스테이지 보스에서 실패해도 시작 주문서가 열리고, 다음 런 기본값으로 자동 선택됩니다.
assert.equal(M.MASTERY_UNLOCKS[0].xp, M.getRunMasteryXp({ clearedStage: 4 }), '첫 해금은 5스테이지 보스 실패 경험치로 열려야 합니다.');
assert.deepEqual(M.getUnlockedStartSpells(M.getRunMasteryXp({ clearedStage: 4 })), ['fireblast']);
const fresh = createHeadlessGame({ seed: 11 });
const fs0 = fresh.run('state');
assert.equal(fs0.meta.xp, 0);
assert.equal(fs0.meta.startSpell, null);
fs0.highestClearedStage = 4;
fresh.run('failRunByEnrage()');
assert.ok(fs0.meta.lastRun.newUnlocks.some((u) => u.type === 'start' && u.id === 'fireblast'), '첫 실패에서도 해금이 하나 생깁니다.');
assert.equal(fs0.meta.startSpell, 'fireblast', '새로 열린 시작 주문서는 자동으로 선택됩니다.');
fresh.run('restartSpeedrunRun()');
assert.equal(fs0.grimoires.fireblast, true, '두 번째 런은 불꽃 작렬을 들고 시작합니다.');
// 이미 고른 주문서는 새 시작 주문서가 열리지 않는 런에서 바뀌지 않습니다.
fs0.meta.startSpell = null;
fs0.highestClearedStage = 9;
fresh.run('failRunByEnrage()');
assert.deepEqual(Array.from(fs0.meta.lastRun.newUnlocks, (u) => u.id), ['rapid_gatling'], '10스테이지 보스 실패(4+11=15)에서는 화염 기관총만 열립니다.');
assert.equal(fs0.meta.startSpell, null, '시작 주문서 해금이 없으면 플레이어 선택을 유지합니다.');

console.log('업화 단계 규칙 누적·숙련도 지급(실패 포함, 중복 방지)·해금 순서·세이브 정리·새 런 적용·다음 단계 해금·재사용 대기·불의 심장 시간·첫 실패 해금과 시작 주문서 자동 선택 검증 통과');
