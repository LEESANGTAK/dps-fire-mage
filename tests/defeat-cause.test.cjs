/* 패배 원인 진단: 런 카운터(즉시 메테오·식은 열기·놓친 메테오·마력 폭주 대기·불꽃 작렬 충전 가득)가
 * 실제 전투에서 쌓이고, 결과창 한 줄이 우선순위대로 가장 큰 원인 하나를 고르는지 검증합니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const FRAME = 1 / 30;
function setup() {
  const g = createHeadlessGame({ seed: 3 });
  g.context.matchMedia = () => ({ matches: true }); // 모션 감소: 열기 숫자 비행 없이 즉시 판정
  const st = g.run('state');
  g.run('restartSpeedrunRun()');
  st.monster.maxHp = st.monster.hp = 1e12;
  st.autoCast = false; // 화염구 자동 시전이 열기를 바꾸지 않게
  st.meta.tips.meteorCombo = true;
  st.meta.tips.fireblastHint = 99;
  return { g, st };
}
const stepFor = (g, sec) => { for (let t = 0; t < sec; t += FRAME) g.step(FRAME); };

// 1. 새 런은 진단 카운터를 0으로 시작합니다.
{
  const { st } = setup();
  for (const k of ['instantMeteors', 'heatCooled', 'meteorMissed', 'combustionIdle', 'fireblastCapped']) assert.equal(st.stats[k], 0, `${k}는 0에서 시작합니다.`);
}

// 2. 열기 카운터: 비치명 화염구로 식음, 시간이 지나 식음, 준비된 메테오 만료, 즉시 메테오 사용
{
  const { g, st } = setup();
  st.grimoires.meteor = true;
  g.run("dealDamage('fireball', 100, true, true)");
  g.run("dealDamage('fireball', 100, false, true)");
  assert.equal(st.stats.heatCooled, 1, '열기 1칸에서 비치명 화염구가 꽂히면 식은 열기 1회');

  g.run("dealDamage('fireball', 100, true, true)");
  stepFor(g, 8.5);
  assert.equal(st.stats.heatCooled, 2, '열기 1칸이 8초 지나 식으면 식은 열기 1회');

  g.run("dealDamage('fireball', 100, true, true)");
  g.run("dealDamage('fireball', 100, true, true)");
  assert.equal(st.combat.critStreak, 2);
  stepFor(g, 12.5);
  assert.equal(st.stats.meteorMissed, 1, '준비된 메테오(열기 2칸)를 12초 안에 안 쓰면 놓친 메테오 1회');
  assert.equal(st.stats.heatCooled, 2, '놓친 메테오는 식은 열기와 따로 셉니다.');

  g.run("dealDamage('fireball', 100, true, true)");
  g.run("dealDamage('fireball', 100, true, true)");
  stepFor(g, 0.2);
  assert.ok(g.run('isMeteorInstantReady()'));
  assert.equal(g.run("triggerSkill('meteor', true)"), true);
  assert.equal(st.stats.instantMeteors, 1, '열기 2칸에서 쓴 메테오는 즉시 메테오 1회');
}

// 3. 쉬는 시간: 마력 폭주 쿨 완료 상태, 불꽃 작렬 충전 가득 상태로 흐른 시간만 셉니다.
{
  const { g, st } = setup();
  st.grimoires.combustion = true;
  st.grimoires.fireblast = true;
  st.combat.combustionCdRem = 0;
  st.combat.fbCharges = st.combat.fbMaxCharges;
  stepFor(g, 5);
  assert.ok(Math.abs(st.stats.combustionIdle - 5) < 0.2, `마력 폭주 대기 약 5초: ${st.stats.combustionIdle}`);
  assert.ok(Math.abs(st.stats.fireblastCapped - 5) < 0.2, `불꽃 작렬 충전 가득 약 5초: ${st.stats.fireblastCapped}`);
  st.combat.gcdRemaining = 0;
  g.run("triggerSkill('combustion', true)");
  const idle = st.stats.combustionIdle;
  stepFor(g, 3);
  assert.equal(st.stats.combustionIdle, idle, '쿨이 도는 동안에는 대기 시간이 늘지 않습니다.');
  st.isPaused = true;
  const capped = st.stats.fireblastCapped;
  stepFor(g, 2);
  assert.equal(st.stats.fireblastCapped, capped, '일시정지 중에는 세지 않습니다.');
}

// 4. 진단 우선순위: 놓친 메테오 → 마력 폭주 대기 → 식은 열기(불꽃 작렬 놀림) → 낮은 치명타 → 아까운 체력 → 화력 부족
{
  const { g, st } = setup();
  const diag = (hp) => g.run(`diagnoseDefeat(${hp})`);
  const set = (grimoires, stats) => {
    Object.assign(st.grimoires, { fireblast: false, meteor: false, combustion: false, flame_patch: false }, grimoires);
    Object.assign(st.stats, g.run('createRunDiagnosticStats()'), stats);
  };
  set({ meteor: true, combustion: true }, { meteorMissed: 2, combustionIdle: 60 });
  assert.equal(diag(50).cause.key, 'meteor_missed');
  set({ meteor: true, combustion: true, fireblast: true }, { combustionIdle: 25, heatCooled: 9, fireblastCapped: 30 });
  assert.equal(diag(50).cause.key, 'combustion_idle');
  assert.ok(diag(50).cause.text.includes('25'), '쉰 시간을 문구에 보여 줍니다.');
  set({ meteor: true, fireblast: true }, { heatCooled: 6, fireblastCapped: 15, instantMeteors: 3 });
  assert.equal(diag(50).cause.key, 'heat_cooled');
  set({ meteor: true, fireblast: true }, { heatCooled: 6, fireblastCapped: 2, instantMeteors: 3 });
  assert.notEqual(diag(50).cause.key, 'heat_cooled', '불꽃 작렬을 잘 쓰고 있었다면 식은 열기를 탓하지 않습니다.');
  st.playerStatsBonus = {};
  set({ meteor: true }, { instantMeteors: 0 });
  assert.equal(diag(50).cause.key, 'low_crit', '치명타 5%에서 메테오 연계가 0회면 치명타 부족을 지적합니다.');
  st.playerStatsBonus = { crit: 30 };
  assert.notEqual(diag(50).cause.key, 'low_crit', '치명타가 충분하면 치명타 부족을 탓하지 않습니다.');
  set({}, {});
  assert.equal(diag(9).cause.key, 'close');
  assert.equal(diag(40).cause.key, 'firepower');

  // 지표 칩은 가진 주문만, 기준을 넘은 지표는 bad로 강조합니다.
  set({ combustion: true }, { combustionIdle: 30 });
  const chips = diag(40).chips;
  assert.equal(chips.length, 1, '마력 폭주만 가졌다면 칩은 하나입니다.');
  assert.equal(chips[0].bad, true);
  set({ meteor: true }, { instantMeteors: 2, heatCooled: 1 });
  assert.equal(diag(40).chips.some((c) => c.label.includes('놓친')), false, '놓친 메테오가 0이면 칩을 숨깁니다.');
}

// 5. 패배 결과창: 진단 영역을 채우고 원인을 기록합니다.
{
  const { g, st } = setup();
  st.grimoires.combustion = true;
  st.stats.combustionIdle = 40;
  st.monster.hp = st.monster.maxHp * 0.6;
  g.run('openDefeatModal()');
  const box = g.run("document.getElementById('defeat-cause')");
  assert.equal(box.hidden, false, '패배 결과창에서 진단 영역이 보입니다.');
  assert.equal(box.dataset.cause, 'combustion_idle');
  assert.ok(String(box.innerHTML).includes('40'), '진단 문구에 수치가 들어갑니다.');
}

console.log('패배 원인 진단: 열기·메테오·마력 폭주·불꽃 작렬 카운터, 우선순위 한 줄, 가진 주문 지표 칩, 결과창 표시 검증 통과');
