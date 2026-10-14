/* 스펠 큐: 화염구 자동·메테오 수동일 때 메테오 단축키가 자동 화염구에 밀려 무시되지 않고, 현재 시전이 끝나는 즉시 발동되는지 검증합니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const FRAME = 1 / 30;
const g = createHeadlessGame({ seed: 5 });
const st = g.run('state');
st.monster.maxHp = st.monster.hp = 1e12; // 시험 중 몬스터가 죽어 스테이지가 넘어가지 않게
st.grimoires.meteor = true;
if (!st.spellOrder.includes('meteor')) st.spellOrder.push('meteor');
st.autoCast = true;
st.skillAuto.fireball = true;
st.skillAuto.meteor = false;
st.combat.critStreak = 0;

// 자동 화염구가 시전 중이 될 때까지 진행
let guard = 0;
while (st.combat.castingSkill !== 'fireball' && guard++ < 300) g.step(FRAME);
assert.equal(st.combat.castingSkill, 'fireball', '자동 화염구가 시전 중이어야 합니다.');

// 시전 중 메테오 단축키: 즉시는 못 쓰지만 예약됩니다.
st.combat.critStreak = 0;
assert.equal(g.run("requestManualSkill('meteor')"), false);
assert.equal(st.combat.queuedSkill, 'meteor', '시전 중 누른 메테오가 예약되어야 합니다.');

// 화염구가 끝나면 자동 화염구보다 먼저 메테오를 시전합니다.
let sawMeteor = false;
for (let i = 0; i < 120 && !sawMeteor; i++) {
  g.step(FRAME);
  if (st.combat.castingSkill === 'meteor') sawMeteor = true;
  if (!sawMeteor && st.combat.castingSkill === 'fireball' && st.combat.queuedSkill === null) break;
}
assert.ok(sawMeteor, '현재 시전이 끝나면 예약한 메테오가 자동 화염구보다 먼저 시전되어야 합니다.');
assert.equal(st.combat.queuedSkill, null, '발동한 예약은 비워야 합니다.');

// 쿨타임 중에는 예약하지 않습니다.
while (st.combat.castingSkill === 'meteor') g.step(FRAME);
st.combat.meteorCdRem = 10;
while (st.combat.castingSkill !== 'fireball' && guard++ < 600) g.step(FRAME);
st.combat.critStreak = 0;
g.run("requestManualSkill('meteor')");
assert.equal(st.combat.queuedSkill, null, '쿨타임 중인 메테오는 예약하지 않습니다.');

// 오래된 예약은 버립니다.
st.combat.meteorCdRem = 0;
st.combat.castingSkill = 'fireball';
st.combat.castRemaining = 99;
st.combat.castTotal = 99;
g.run("requestManualSkill('meteor')");
assert.equal(st.combat.queuedSkill, 'meteor');
g.run('processQueuedSkill(3.5)');
assert.equal(st.combat.queuedSkill, null, '대기 시간을 넘긴 예약은 버립니다.');

console.log('화염구 자동·메테오 수동 시 시전 중 메테오 입력 예약→시전 종료 즉시 발동, 쿨타임 중 미예약, 오래된 예약 폐기 검증 통과');
