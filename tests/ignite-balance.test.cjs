/* 화상(ignite)이 치명타 피해의 고정 비율만큼만 들어가고, 정령 연속 공격이나 긴 전투에서도 무한 누적되지 않는지 실제 게임 코드로 검증합니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

function burnRatioAfterCrits({ critsPerSecond, seconds, igniteRatioMult = 1, burnPct = 0, spirits = 0 }) {
  const g = createHeadlessGame({ seed: 3 });
  const state = g.run('state');
  state.autoCast = false;
  state.monster.maxHp = 1e15;
  state.monster.hp = 1e15;
  state.playerStatsBonus = { burnPct };
  state.deckMechanics = { igniteRatioMult, spiritCount: spirits, extraSpirits: spirits };

  const frame = 1 / 30;
  let critTimer = 0;
  for (let t = 0; t < seconds; t += frame) {
    critTimer += frame;
    if (critTimer >= 1 / critsPerSecond) {
      critTimer = 0;
      g.run("dealDamage('fireblast', 1000, true, false)");
    }
    g.step(frame);
  }
  // 마지막 치명타 이후 화상이 모두 소진될 때까지 진행
  for (let t = 0; t < 8; t += frame) g.step(frame);

  const crit = state.skillDamage.fireblast.dmg;
  const ignite = state.skillDamage.ignite.dmg;
  return { ratio: ignite / crit, leftover: state.combat.ignitePool };
}

const EXPECTED = 0.22;

// 1. 치명타 빈도와 무관하게 화상 총량은 치명타 피해의 22%
for (const critsPerSecond of [0.5, 2, 6]) {
  const { ratio, leftover } = burnRatioAfterCrits({ critsPerSecond, seconds: 60 });
  assert.ok(Math.abs(ratio - EXPECTED) < 0.01, `초당 치명타 ${critsPerSecond}회: 화상 비율 ${ratio.toFixed(3)} (기대 ${EXPECTED})`);
  assert.ok(leftover < 1, '지속 시간이 끝나면 남은 화상 피해가 모두 정산되어야 합니다.');
}

// 2. 정령이 계속 공격해도(구형 버그: 화상 시간 연장으로 풀이 기하급수 누적) 비율이 유지되어야 함
{
  const short = burnRatioAfterCrits({ critsPerSecond: 3, seconds: 20, spirits: 4 });
  const long = burnRatioAfterCrits({ critsPerSecond: 3, seconds: 120, spirits: 4 });
  assert.ok(Math.abs(long.ratio - short.ratio) < 0.02, `전투 시간이 길어져도 화상 비율이 커지면 안 됩니다. (20초 ${short.ratio.toFixed(3)} / 120초 ${long.ratio.toFixed(3)})`);
}

// 3. 들불(전환율 2.5배)과 지속 피해 % 스탯은 곱으로 적용
{
  const { ratio } = burnRatioAfterCrits({ critsPerSecond: 2, seconds: 40, igniteRatioMult: 2.5, burnPct: 45 });
  const expected = EXPECTED * 2.5 * 1.45;
  assert.ok(Math.abs(ratio - expected) < 0.02, `들불 + 지속 피해 +45%: ${ratio.toFixed(3)} (기대 ${expected.toFixed(3)})`);
}

console.log('화상 총량 22% 고정·정령 연장 무한 누적 제거·들불/지속 피해 배율 검증 통과');
