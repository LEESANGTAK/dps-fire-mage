/* 열기 → 메테오 인과 순서: 두 번째 붉은 열기 숫자가 문양에 닿기 전에는 메테오 즉시 시전이 발동하지 않고,
 * 닿는 순간 '준비'가 켜지며, 자동 시전은 준비를 보여준 뒤(0.3초) 발사하는지 검증합니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const FRAME = 1 / 30;
function setup({ autoMeteor }) {
  const g = createHeadlessGame({ seed: 11 });
  g.context.matchMedia = () => ({ matches: false });
  const st = g.run('state');
  st.monster.maxHp = st.monster.hp = 1e12;
  st.grimoires.meteor = true;
  if (!st.spellOrder.includes('meteor')) st.spellOrder.push('meteor');
  st.autoCast = true;
  st.skillAuto.fireball = false; // 화염구 자동 시전이 열기를 바꾸지 않게
  st.skillAuto.meteor = autoMeteor;
  st.combat.critStreak = 0;
  return { g, st };
}

// 1. 자동 메테오: 도착 전 발동 금지 → 도착 시 준비 → 숨을 둔 뒤 발사
{
  const { g, st } = setup({ autoMeteor: true });
  g.run("dealDamage('fireball', 100, true, true)");
  g.run("dealDamage('fireball', 100, true, true)");
  assert.equal(st.combat.critStreak, 2, '열기 판정은 즉시 확정됩니다.');
  assert.equal(st.combat.meteorArmPending, true, '두 번째 숫자가 날아가는 동안은 준비 보류입니다.');
  assert.equal(g.run('isMeteorInstantReady()'), false);

  let t = 0, armedAt = null, firedAt = null;
  while (t < 2.5 && firedAt === null) {
    g.step(FRAME); t += FRAME;
    if (armedAt === null && g.run('isMeteorInstantReady()')) armedAt = t;
    if (st.combat.critStreak === 0) firedAt = t;
  }
  const end = g.run('HEAT_ABSORB.end'), beat = g.run('METEOR_AUTO_BEAT');
  assert.ok(armedAt !== null && armedAt >= end - 2 * FRAME, `준비는 숫자 도착(${end}s) 무렵에 켜집니다: ${armedAt}`);
  assert.ok(firedAt !== null, '준비 후 자동으로 즉시 시전합니다.');
  assert.ok(firedAt - armedAt >= beat - FRAME, `준비가 보인 뒤 ${beat}s 숨을 두고 발사합니다: ${(firedAt - armedAt).toFixed(2)}`);
}

// 2. 수동 메테오: 숫자가 날아가는 중 누르면 예약 → 도착(준비) 즉시 발동, 느린 일반 시전은 시작하지 않음
{
  const { g, st } = setup({ autoMeteor: false });
  g.run("dealDamage('fireball', 100, true, true)");
  g.run("dealDamage('fireball', 100, true, true)");
  g.run("requestManualSkill('meteor')");
  assert.notEqual(st.combat.castingSkill, 'meteor', '준비 보류 중에는 느린 일반 시전을 시작하지 않습니다.');
  assert.equal(st.combat.queuedSkill, 'meteor', '보류 중 누른 메테오는 예약됩니다.');
  let t = 0, armedAt = null, firedAt = null;
  while (t < 2.5 && firedAt === null) {
    g.step(FRAME); t += FRAME;
    if (armedAt === null && !st.combat.meteorArmPending) armedAt = t;
    if (st.combat.critStreak === 0) firedAt = t;
  }
  assert.ok(firedAt !== null && firedAt - armedAt <= 2 * FRAME, '수동 예약은 준비되는 즉시 발동합니다.');
}

// 3. 모션 감소: 날아가는 숫자가 없으니 기존처럼 즉시 준비
{
  const { g, st } = setup({ autoMeteor: false });
  g.context.matchMedia = () => ({ matches: true });
  g.run("dealDamage('fireball', 100, true, true)");
  g.run("dealDamage('fireball', 100, true, true)");
  assert.equal(st.combat.meteorArmPending, false);
  assert.equal(g.run('isMeteorInstantReady()'), true);
}

console.log('열기 숫자 도착 전 메테오 미발동·도착 시 준비·자동 0.3초 후 발사·수동 예약 즉시 발동·모션 감소 즉시 준비 검증 통과');
