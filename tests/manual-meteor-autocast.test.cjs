/* 메테오 수동·화염구 자동일 때, 메테오 즉시 시전 준비 상태에서도 화염구 자동 시전이 멈추지 않는지 검증합니다.
 * (메테오가 자동이면 곧 메테오가 나가므로 화염구가 잠깐 쉬는 기존 동작을 유지) */
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

// 2. 메테오 자동: 화염구 대신 메테오가 먼저 나갑니다.
{
  const { g, st } = readyState(true);
  let fired = false;
  for (let i = 0; i < 30 && !fired; i++) {
    g.step(FRAME);
    if (st.combat.critStreak === 0) { fired = true; break; } // 메테오가 나간 프레임에 화염구가 이어지는 것은 정상
    assert.notEqual(st.combat.castingSkill, 'fireball', '자동 메테오가 나가기 전에 화염구 시전을 시작하지 않습니다.');
  }
  assert.ok(fired, '자동 메테오가 즉시 시전되어야 합니다.');
}

console.log('메테오 수동 시 준비 상태에서도 화염구 자동 시전 유지, 메테오 자동 시 메테오 우선 발사 검증 통과');
