/* 메테오 연계 안내: 첫 획득 시연(세이브 1회, 전투 정지), 첫 열기 2칸 보장, 불꽃 작렬 '지금!' 말풍선(세이브 3회),
 * 와우 용어('몰열') 없는 카드·툴팁 문구, 안내 기록의 세이브 정리를 검증합니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../src/scripts/meta-progression.js');
const { buildSkillDetails } = require('../src/scripts/skill-tooltips.js');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const FRAME = 1 / 30;

// 1. 세이브 정리: 안내 기록은 기본값이 '안 봄'이고, 말풍선 횟수는 0~최대로 고정됩니다.
assert.deepEqual(M.normalizeMeta(null).tips, { meteorCombo: false, fireblastHint: 0 });
assert.deepEqual(M.normalizeMeta({ tips: { meteorCombo: true, fireblastHint: 99 } }).tips, { meteorCombo: true, fireblastHint: M.FIREBLAST_HINT_MAX });
assert.deepEqual(M.normalizeMeta({ tips: { meteorCombo: 'yes', fireblastHint: -2 } }).tips, { meteorCombo: false, fireblastHint: 0 });

// 2. 카드·툴팁 문구: 신규 유저가 모르는 '몰열' 대신 인과(치명타 2연속 → 즉시·무료)를 씁니다.
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/roguelike-cards.json'), 'utf8'));
const meteorCard = cards.find((c) => c.id === 'spell_meteor');
assert.ok(!meteorCard.desc.includes('몰열'), '메테오 카드에 와우 용어가 남으면 안 됩니다.');
assert.ok(meteorCard.desc.includes('치명타 2연속') && meteorCard.desc.includes('불꽃 작렬은 항상 치명타'));
assert.ok(cards.find((c) => c.id === 'spell_fireblast').desc.includes('치명타 2연속'), '불꽃 작렬 카드는 메테오 연계를 알려 줍니다.');
const stats = { sp: 100, crit: 5, critDmg: 1.5, speedMult: 1, cdr: 0 };
for (const streak of [0, 2]) {
  const tip = buildSkillDetails('meteor', stats, { critStreak: streak, fbCharges: 1, fbMaxCharges: 1 });
  assert.ok(!/몰열|몰아치는/.test(tip.cast + tip.feature), `메테오 툴팁(열기 ${streak})에 와우 용어가 남으면 안 됩니다.`);
}

function setup() {
  const g = createHeadlessGame({ seed: 5 });
  g.context.matchMedia = () => ({ matches: false });
  const st = g.run('state');
  st.monster.maxHp = st.monster.hp = 1e12;
  st.autoCast = true;
  st.playerStatsBonus = { crit: -100 }; // 치명타 0%: 보장된 치명타만 터지게
  return { g, st };
}

// 3. 메테오 첫 획득: 시연이 뜨며 전투가 멈추고, 첫 열기 2칸이 보장됩니다(화염구 치명타 강제 → 메테오 준비 시 해제).
{
  const { g, st } = setup();
  assert.equal(st.meta.tips.meteorCombo, false);
  g.run("selectAwakeningCard('spell_meteor')");
  assert.equal(st.meta.tips.meteorCombo, true, '시연은 본 것으로 기록됩니다.');
  assert.equal(st.isPaused, true, '시연이 떠 있는 동안 전투가 멈춥니다.');
  assert.equal(st.heatTutorial, true, '이번 런의 첫 열기 2칸이 보장됩니다.');

  assert.equal(g.run('dismissMeteorComboCoach()'), true, '열린 시연은 즉시 닫을 수 있습니다(시뮬레이터용).');
  assert.equal(st.isPaused, false, '시연을 닫으면 전투가 다시 흐릅니다.');
  assert.equal(g.run('dismissMeteorComboCoach()'), false, '닫힌 시연은 다시 닫지 않습니다.');
  let t = 0;
  while (t < 8 && !g.run('isMeteorInstantReady()')) { g.step(FRAME); t += FRAME; }
  assert.ok(g.run('isMeteorInstantReady()'), `치명타 0%여도 화염구 두 발로 메테오가 준비되어야 합니다(${t.toFixed(1)}초).`);
  assert.equal(st.heatTutorial, false, '열기 2칸이 한 번 완성되면 보장은 끝납니다.');

  // 이후에는 원래 치명타율(0%)을 따릅니다.
  st.combat.critStreak = 0;
  const before = st.combat.critStreak;
  for (let i = 0; i < 120; i++) g.step(FRAME);
  assert.equal(st.combat.critStreak, before, '보장이 끝난 뒤에는 치명타 0%에서 열기가 생기지 않습니다.');

  // 같은 세이브에서 다시 메테오를 얻으면 시연·보장은 반복되지 않습니다.
  g.run('restartSpeedrunRun()');
  st.playerStatsBonus = { crit: -100 };
  g.run("selectAwakeningCard('spell_meteor')");
  assert.equal(st.isPaused, false, '두 번째 획득에서는 전투를 멈추지 않습니다.');
  assert.equal(st.heatTutorial, false, '두 번째 획득에서는 보장이 없습니다.');
}

// 4. 불꽃 작렬 '지금!' 말풍선: 열기 1칸 + 수동 불꽃 작렬 + 충전 있음일 때만, 세이브 전체에서 최대 3회.
{
  const { g, st } = setup();
  st.meta.tips.meteorCombo = true;
  st.grimoires.meteor = true;
  st.grimoires.fireblast = true;
  st.combat.fbCharges = 1;
  st.deckMechanics = {}; // 자동 영창 없음 → 불꽃 작렬은 수동
  const heatOne = () => {
    st.combat.critStreak = 0;
    g.run("dealDamage('fireball', 100, true, true)");
  };
  for (let i = 0; i < 5; i++) heatOne();
  assert.equal(st.meta.tips.fireblastHint, M.FIREBLAST_HINT_MAX, '말풍선은 세이브 전체에서 3회까지만 뜹니다.');

  const g2 = setup();
  g2.st.meta.tips.meteorCombo = true;
  g2.st.grimoires.meteor = true;
  g2.st.grimoires.fireblast = true;
  g2.st.combat.fbCharges = 1;
  g2.st.deckMechanics = { smartAutoCast: true }; // 자동 영창으로 불꽃 작렬이 자동이면 안내가 필요 없습니다.
  g2.g.run("dealDamage('fireball', 100, true, true)");
  assert.equal(g2.st.meta.tips.fireblastHint, 0, '불꽃 작렬이 자동 시전이면 말풍선을 띄우지 않습니다.');
  g2.st.deckMechanics = {};
  g2.st.combat.critStreak = 0;
  g2.st.combat.fbCharges = 0;
  g2.g.run("dealDamage('fireball', 100, true, true)");
  assert.equal(g2.st.meta.tips.fireblastHint, 0, '불꽃 작렬 충전이 없으면 말풍선을 띄우지 않습니다.');
}

console.log('메테오 연계 시연(1회·전투 정지)·첫 열기 보장·불꽃 작렬 말풍선(3회)·와우 용어 제거·안내 기록 세이브 정리 검증 통과');
