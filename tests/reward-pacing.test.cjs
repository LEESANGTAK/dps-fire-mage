/* 보상 연출 호흡: 처치 직후 바로 카드 창이 뜨지 않고 사망·골드 흡수를 볼 시간을 주며,
 * 그동안 전투와 스피드런 시계는 멈춥니다. 카드 창은 펼쳐지는 동안 입력을 받지 않고, 고른 뒤에는 여운을 두고 닫힙니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const FRAME = 1 / 60;
const g = createHeadlessGame({ seed: 3 });
const st = g.run('state');
const choicesOpen = () => g.run('deckManager.getCurrentChoices().length') > 0;
const kill = () => { st.monster.hp = 1; g.run("dealDamage('fireball', 100, false)"); };
const stepUntil = (cond, limit = 10) => {
  let t = 0;
  while (!cond() && t < limit) { g.step(FRAME); t += FRAME; }
  return t;
};

// 1. 처치: 전투만 멈추고(모달 정지 아님), 사망·골드 여운(약 1.2초) 뒤 카드 창이 열립니다. 개방 안내 토스트는 띄우지 않습니다.
assert.ok(!('awakening' in st.unfolded), '각성 개방 안내 플래그는 제거되었습니다.');
kill();
assert.equal(st.monster.isDying, true);
assert.equal(st.isPaused, false, '처치 여운은 모달 정지가 아니라 사망 잔상·골드 비행이 계속 흐릅니다.');
assert.equal(g.run('isCombatHeld()'), true, '처치 여운 동안 전투는 멈춥니다.');
assert.equal(st.combat.castingSkill, null, '처치 순간 시전 중이던 주문은 거둡니다.');
assert.equal(g.run("triggerSkill('fireball', true)"), false, '여운 중에는 주문을 시전하지 않습니다.');
const timeAtKill = st.playTimeSec;
const firstWait = stepUntil(choicesOpen);
assert.ok(firstWait >= 1.15 && firstWait < 1.4, `첫 처치도 일반 여운(약 1.2초) 뒤에 카드 창이 열립니다(${firstWait.toFixed(2)}초).`);
assert.equal(st.playTimeSec, timeAtKill, '여운 시간은 스피드런 기록에 포함되지 않습니다.');
assert.equal(st.isPaused, true, '카드 창이 열리면 게임이 정지합니다.');

// 2. 카드 창이 펼쳐지는 동안에는 입력(연타 잔여 클릭)을 받지 않습니다.
assert.equal(g.run('isAwakeningInputLocked()'), true, '카드가 다 펼쳐지기 전에는 선택을 받지 않습니다.');
stepUntil(() => !g.run('isAwakeningInputLocked()'), 2);
assert.equal(g.run('isAwakeningInputLocked()'), false);

// 3. 선택: 효과는 즉시, 창은 여운을 두고 닫히며, 다음 몬스터가 자리 잡은 뒤 전투가 재개됩니다.
const pick = g.run('deckManager.getCurrentChoices()[0].id');
g.run(`selectAwakeningCard(${JSON.stringify(pick)})`);
assert.ok(g.run('deckManager.getActiveDeck()')[pick] >= 1, '카드 효과는 고르는 순간 적용됩니다.');
assert.equal(g.run('isAwakeningInputLocked()'), true, '닫히는 동안 두 번째 선택을 받지 않습니다.');
g.run(`selectAwakeningCard(${JSON.stringify(pick)})`);
assert.equal(g.run('deckManager.getActiveDeck()')[pick], 1, '닫히는 중 연타로 카드가 두 번 들어가면 안 됩니다.');
assert.equal(g.run('isCombatHeld()'), true);
const resumeWait = stepUntil(() => !g.run('isCombatHeld()'), 3);
assert.ok(resumeWait >= 1.0 && resumeWait < 1.4, `선택 여운 + 진입 호흡 뒤 전투가 재개됩니다(${resumeWait.toFixed(2)}초).`);
assert.equal(st.currentStage, 2);
assert.equal(st.isPaused, false);

// 4. 두 번째 처치도 같은 여운(약 1.2초)을 둡니다.
kill();
const normalWait = stepUntil(choicesOpen);
assert.ok(normalWait >= 1.15 && normalWait < 1.4, `일반 처치 여운은 약 1.2초입니다(${normalWait.toFixed(2)}초).`);

// 5. 새 런을 시작하면 예약된 여운이 취소되고 전투 정지가 풀립니다.
stepUntil(() => !g.run('isAwakeningInputLocked()'), 2);
g.run('selectAwakeningCard(deckManager.getCurrentChoices()[0].id)');
stepUntil(() => !g.run('isCombatHeld()'), 3);
assert.equal(st.currentStage, 3);
kill();
assert.equal(g.run('isCombatHeld()'), true);
g.run('restartSpeedrunRun()');
assert.equal(g.run('isCombatHeld()'), false, '새 런은 여운 정지 없이 시작합니다.');
stepUntil(() => false, 2);
assert.equal(choicesOpen(), false, '이전 런의 처치 여운이 새 런에 카드 창을 띄우면 안 됩니다.');

console.log(`보상 연출 호흡: 첫 처치 ${firstWait.toFixed(2)}초·일반 ${normalWait.toFixed(2)}초 여운(시계 정지), 펼침 중 입력 잠금, 선택 여운 ${resumeWait.toFixed(2)}초, 새 런 취소 검증 통과`);
