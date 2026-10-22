/* 빌드 가중 추첨(개편안 2.5): 주력 빌드 판정, 가중치, 일반 웨이브 1장 보장, 2장 선택지 예외, 주력 빌드 전설 우선,
 * 겹치기 상한이 줄어든 카드의 구형 세이브 복원을 검증합니다. */
const assert = require('node:assert/strict');
const { createDeckManager, CARD_POOL, BUILD } = require('../src/scripts/roguelike-deck.js');

const freshState = () => ({ gold: 0, playerStatsBonus: {}, deckMechanics: {}, grimoires: {}, lockedCards: [] });
const buildOf = (id) => CARD_POOL.find((c) => c.id === id).build;

// 1. 주력 빌드 판정: 주문서·유틸리티 제외, 2장 이상, 동률이면 최근에 고른 빌드
{
  const m = createDeckManager();
  const st = freshState();
  assert.equal(m.getMainBuilds().main, null, '빈 덱에는 주력 빌드가 없습니다.');
  m.selectCard('rapid_spark', st);
  assert.equal(m.getMainBuilds().main, null, '1장만으로는 주력 빌드가 아닙니다.');
  m.selectCard('spell_meteor', st);
  m.selectCard('util_power', st);
  m.selectCard('util_glass_cannon', st);
  assert.equal(m.getMainBuilds().main, null, '주문서·유틸리티는 주력 빌드 판정에서 빠집니다.');
  m.selectCard('rapid_spark', st);
  assert.equal(m.getMainBuilds().main, BUILD.RAPID, '겹친 횟수 포함 2장이면 주력 빌드입니다.');
  m.selectCard('sum_spirit', st);
  m.selectCard('sum_fury', st);
  assert.equal(m.getMainBuilds().main, BUILD.SUMMON, '동률이면 최근에 고른 빌드가 주력입니다.');
  assert.equal(m.getMainBuilds().second, BUILD.RAPID);
}

// 2. 가중치와 1장 보장: 주력 빌드(속사)를 가진 일반 웨이브 3장 선택지에는 속사 카드가 항상 1장 이상 섞이고,
//    전체 출현 비율도 주력 빌드가 없을 때보다 높습니다.
{
  const st = freshState();
  const planned = createDeckManager();
  planned.selectCard('rapid_split', st);
  planned.selectCard('rapid_quickdraw', st);
  const plain = createDeckManager();
  let plannedRapid = 0, plainRapid = 0, total = 0;
  for (let i = 0; i < 3000; i++) {
    const a = planned.drawChoices(3, false, st);
    assert.ok(a.some((c) => c.build === BUILD.RAPID), '주력 빌드 카드가 1장 이상 있어야 합니다.');
    assert.equal(new Set(a.map((c) => c.id)).size, a.length, '보장으로 바꾼 카드가 다른 칸과 겹치면 안 됩니다.');
    plannedRapid += a.filter((c) => c.build === BUILD.RAPID).length;
    plainRapid += plain.drawChoices(3, false, st).filter((c) => c.build === BUILD.RAPID).length;
    total += 3;
  }
  assert.ok(plannedRapid / total > (plainRapid / total) * 1.5, `주력 빌드 출현 비율이 눈에 띄게 높아야 합니다(${(plannedRapid / total).toFixed(2)} vs ${(plainRapid / total).toFixed(2)}).`);
  assert.ok(plannedRapid / total < 0.75, '나머지 칸은 무작위로 남아 빌드를 갈아탈 여지가 있어야 합니다.');
}

// 3. 업화 5단계의 2장 선택지에는 보장을 적용하지 않습니다(가중치만).
{
  const st = freshState();
  const m = createDeckManager();
  m.selectCard('burn_spread', st);
  m.selectCard('burn_ignite', st);
  let withoutMain = 0;
  for (let i = 0; i < 2000; i++) if (!m.drawChoices(2, false, st).some((c) => c.build === BUILD.BURN)) withoutMain++;
  assert.ok(withoutMain > 0, '2장 선택지는 주력 빌드 카드 없이 나올 수 있어야 합니다.');
}

// 4. 보스 전설 보장: 해금된 주력 빌드 전설을 우선 내놓습니다.
{
  const st = freshState();
  const m = createDeckManager();
  m.selectCard('sum_spirit', st);
  m.selectCard('sum_fury', st);
  // 다른 전설이 원래 확률로 먼저 뽑히면 보장 교체는 일어나지 않으므로, '대부분의 보스 보상'에 나오는지로 확인합니다.
  let mainLegend = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    const legend = m.drawChoices(3, true, st).filter((c) => c.rarity === 'legendary');
    assert.ok(legend.length > 0, '전설이 없는 런의 보스 보상에는 전설이 있어야 합니다.');
    if (legend.some((c) => c.build === BUILD.SUMMON)) mainLegend++;
  }
  assert.ok(mainLegend / N > 0.6, `주력 빌드(정령) 전설이 보스 보상 대부분에 나와야 합니다(${(mainLegend / N).toFixed(2)}).`);
  // 주력 빌드 전설이 잠겨 있으면 다른 전설로 보장합니다.
  st.lockedCards = ['sum_cinder_lord'];
  for (let i = 0; i < 100; i++) assert.ok(m.drawChoices(3, true, st).some((c) => c.rarity === 'legendary'));
}

// 5. 수치 카드 겹치기 5 → 3: 구형 세이브에 5장이 있어도 상한까지만 복원합니다.
{
  const st = freshState();
  const m = createDeckManager();
  m.restoreDeck({ rapid_spark: 5, crit_focus: 2 }, st);
  assert.equal(m.getActiveDeck().rapid_spark, 3);
  assert.equal(m.getActiveDeck().crit_focus, 2);
  const haste = CARD_POOL.find((c) => c.id === 'rapid_spark').stats.haste;
  assert.equal(st.playerStatsBonus.haste, haste * 3, '복원된 장수만큼만 스탯이 적용되어야 합니다.');
  for (const id of ['rapid_spark', 'crit_focus', 'crit_heat', 'sum_fury', 'burn_ignite', 'util_power']) {
    assert.equal(CARD_POOL.find((c) => c.id === id).maxStack, 3, `${id}는 3번까지 겹칩니다.`);
  }
}

// 6. 분류 재편: 주문서는 spell, 무모한 일격·진홍의 마력 폭주는 combustion
for (const id of ['spell_fireblast', 'spell_meteor', 'spell_combustion', 'spell_flame_patch']) assert.equal(buildOf(id), BUILD.SPELL);
for (const id of ['crit_reckless', 'crit_crimson_frenzy']) assert.equal(buildOf(id), BUILD.COMBUSTION);

console.log('   빌드 가중 추첨 주력 빌드 판정·가중치·1장 보장·2장 선택지 예외·주력 전설 우선, 겹치기 3 복원, 분류 재편 검증 통과');
