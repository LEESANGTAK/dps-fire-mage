/* 치명타 숫자: 느낌표 없이 표시되고, 몰아치는 열기를 채우는 치명타만 붉은 숫자로 열기 문양을 향해 날아가는지 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const game = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
assert.ok(!/fmt\(dmg\)\}!`/.test(game), '치명타 숫자 끝에 느낌표가 붙으면 안 됩니다.');

const g = createHeadlessGame({ seed: 9 });
g.context.matchMedia = () => ({ matches: false }); // 모션 감소 꺼짐
const st = g.run('state');
st.monster.maxHp = st.monster.hp = 1e12;
const last = () => g.run('floatingTexts[floatingTexts.length - 1]');

st.grimoires.meteor = true;
st.combat.critStreak = 0;
g.run("dealDamage('fireball', 100, true, true)");
assert.equal(last().heatSigil, 0, '첫 열기 치명타는 1번 문양으로 날아갑니다.');
assert.equal(st.combat.critStreak, 1, '열기 판정은 연출과 무관하게 즉시 반영됩니다.');
g.run("dealDamage('fireball', 100, true, true)");
assert.equal(last().heatSigil, 1, '두 번째 열기 치명타는 2번 문양으로 날아갑니다.');
assert.equal(last().maxLife, g.run('HEAT_ABSORB.end'), '비행 시간만큼 수명이 늘어납니다.');
g.run("dealDamage('fireball', 100, true, true)");
assert.equal(last().heatSigil, null, '열기가 가득 찬 뒤의 치명타는 일반 치명타입니다.');
g.run("dealDamage('fireblast', 100, true, false)");
assert.equal(last().heatSigil, null, '열기를 채우지 않는 타격은 일반 치명타입니다.');
st.grimoires.meteor = false;
st.combat.critStreak = 0;
g.run("dealDamage('fireball', 100, true, true)");
assert.equal(last().heatSigil, null, '메테오가 없으면 열기 문양도 없습니다.');

// 열기 1칸에서 치명타가 아닌 화염구가 꽂히면 열기가 식습니다(규칙 유지). 숫자가 날아가는 중이면 도착 후 꺼지도록 예약합니다.
{
  st.grimoires.meteor = true;
  st.combat.critStreak = 0;
  g.run("dealDamage('fireball', 100, true, true)");
  const flying = last();
  g.run("dealDamage('fireball', 50, false, true)");
  assert.equal(st.combat.critStreak, 0, '비치명타 화염구는 열기 1칸을 식힙니다(규칙).');
  assert.equal(flying.extinguishOnArrival, true, '날아가는 열기 숫자는 도착해 켜진 뒤 꺼지도록 예약됩니다.');
}

// 게임 루프 경과 시간은 음수가 되지 않습니다(연출 시간이 거꾸로 흐르지 않게).
{
  const before = g.run('state.playTimeSec');
  g.run('gameLoop(lastTime - 500)');
  assert.ok(g.run('state.playTimeSec') >= before, '이전 시각이 들어와도 시간이 거꾸로 흐르면 안 됩니다.');
}

// 모션 감소 설정에서는 날아가지 않습니다.
st.grimoires.meteor = true;
st.combat.critStreak = 0;
g.context.matchMedia = () => ({ matches: true });
g.run("dealDamage('fireball', 100, true, true)");
assert.equal(last().heatSigil, null, '모션 감소 설정에서는 흡수 연출을 생략합니다.');
assert.equal(st.combat.critStreak, 1);

console.log('치명타 느낌표 제거, 열기 치명타 대상 문양(1·2번)·즉시 판정·일반 치명타 구분·열기 소멸 예약·음수 경과 시간 차단·모션 감소 검증 통과');
