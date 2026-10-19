/* 메테오 즉시 시전 준비(열기 2칸) 상태에서도 화염구 자동 시전이 멈추지 않는지 검증합니다.
 * 메테오가 수동이면 플레이어가 쓸 때까지 준비가 유지되고, 자동이면 화염구 시전 중에 그 위로 즉시 떨어집니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const FRAME = 1 / 30;
function readyState(autoMeteor) {
  const g = createHeadlessGame({ seed: 13 });
  g.context.matchMedia = () => ({ matches: true }); // 숫자 비행 없이 즉시 준비
  const st = g.run('state');
  st.monster.maxHp = st.monster.hp = 1e12;
  st.grimoires.meteor = true;
  if (!st.spellOrder.includes('meteor')) st.spellOrder.push('meteor');
  st.autoCast = true;
  st.deckMechanics.smartAutoCast = true; // 주문별 AUTO 토글은 전설 카드 '자동 영창'을 얻은 뒤에 생깁니다.
  st.skillAuto.fireball = true;
  st.skillAuto.meteor = autoMeteor;
  st.combat.castingSkill = null;
  st.combat.gcdRemaining = 0;
  st.combat.critStreak = 1;
  g.run("dealDamage('fireblast', 100, true, true)"); // 두 번째 치명타 → 메테오 준비
  assert.equal(g.run('isMeteorInstantReady()'), true);
  return { g, st };
}

// 1. 메테오 수동: 준비 상태에서도 화염구를 계속 자동 시전하고, 메테오 준비는 유지됩니다.
{
  const { g, st } = readyState(false);
  let castFireball = false;
  for (let i = 0; i < 30 && !castFireball; i++) {
    g.step(FRAME);
    if (st.combat.castingSkill === 'fireball') castFireball = true;
  }
  assert.ok(castFireball, '메테오가 수동이면 준비 상태에서도 화염구 자동 시전이 이어져야 합니다.');
  assert.equal(st.combat.critStreak, 2, '수동 메테오 준비는 플레이어가 쓸 때까지 유지됩니다.');
}

// 2. 메테오 자동: 화염구 시전을 쉬지 않고, 메테오는 화염구 시전 중에 즉시 떨어집니다.
{
  const { g, st } = readyState(true);
  g.step(FRAME);
  assert.equal(st.combat.castingSkill, 'fireball', '메테오 준비 상태에서도 화염구 시전을 바로 시작합니다.');
  const castTotal = st.combat.castTotal;
  let firedDuringCast = false;
  for (let i = 0; i < 30; i++) {
    g.step(FRAME);
    if (st.combat.critStreak === 0) {
      firedDuringCast = st.combat.castingSkill === 'fireball';
      break;
    }
  }
  assert.ok(firedDuringCast, '자동 메테오는 화염구 시전을 끊지 않고 그 위로 즉시 떨어져야 합니다.');
  assert.equal(st.combat.castTotal, castTotal, '메테오가 화염구 시전 시간을 바꾸지 않습니다.');
}

console.log('메테오 준비 상태에서도 화염구 자동 시전 유지(수동: 준비 유지, 자동: 화염구 시전 중 즉시 낙하) 검증 통과');
