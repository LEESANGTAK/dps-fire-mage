/* 치명타 피해: 한 방마다 ±CRIT_ROLL_SPREAD 안에서 다르게 터지고 평균은 유지되며, 일반 타격·지속 피해 틱은 흔들리지 않는지 검증합니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const g = createHeadlessGame({ seed: 17 });
const st = g.run('state');
const spread = g.run('CRIT_ROLL_SPREAD');
const hit = (args) => {
  st.monster.maxHp = st.monster.hp = 1e12;
  const before = st.monster.hp;
  g.run(`dealDamage(${args})`);
  return before - st.monster.hp;
};

const crits = Array.from({ length: 400 }, () => hit("'fireball', 1000, true, false"));
const min = Math.min(...crits), max = Math.max(...crits);
assert.ok(min >= Math.round(1000 * (1 - spread)) && max <= Math.round(1000 * (1 + spread)), `치명타는 ±${spread * 100}% 안에서 터져야 합니다 (${min}~${max}).`);
assert.ok(new Set(crits).size > 100, '치명타 숫자가 매번 같으면 안 됩니다.');
assert.ok(max - min > 1000 * spread, '범위 양 끝까지 고르게 나와야 체감됩니다.');
const mean = crits.reduce((a, b) => a + b, 0) / crits.length;
assert.ok(Math.abs(mean - 1000) < 15, `평균 피해는 유지되어야 합니다 (평균 ${mean.toFixed(1)}).`);

for (let i = 0; i < 20; i++) assert.equal(hit("'fireball', 1000, false, false"), 1000, '일반 타격은 흔들리지 않습니다.');
for (let i = 0; i < 20; i++) assert.equal(hit("'ignite', 1000, true, false, true"), 1000, '지속 피해 틱은 흔들리지 않습니다.');

console.log('치명타 피해 랜덤 폭(범위·다양성·평균 유지)·일반 타격/지속 피해 고정 검증 통과');
