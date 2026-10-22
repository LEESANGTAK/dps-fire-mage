/* 전설 카드 '자동 영창': 카드 전에는 화염구만 자동이고 나머지 주문은 직접 눌러야 하며,
 * 카드를 얻으면 모든 주문이 최적 순간에 자동 시전되고 주문별 AUTO 토글이 생기는지 검증합니다. */
const assert = require('node:assert/strict');
const M = require('../src/scripts/meta-progression.js');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const FRAME = 1 / 30;
const g = createHeadlessGame({ seed: 5 });
const st = g.run('state');
st.monster.maxHp = st.monster.hp = 1e12;
st.autoCast = true;
g.run("selectAwakeningCard('spell_combustion')");

// 1. 카드 전: 화염구만 자동, 마력 폭주는 준비돼도 스스로 나가지 않습니다.
assert.equal(g.run("isSkillAutoActive('fireball')"), true);
assert.equal(g.run("isSkillAutoActive('combustion')"), false, '자동 영창 전에는 화염구 외 주문이 수동입니다.');
st.combat.combustionCdRem = 0;
for (let i = 0; i < 30; i++) g.step(FRAME);
assert.equal(st.combat.combustionCdRem, 0, '수동 주문은 준비돼도 자동으로 시전되지 않습니다.');
g.run('updateNotificationBadges()');
g.run("toggleSkillAuto('combustion')");
assert.equal(g.run("isSkillAutoActive('combustion')"), false, '카드 없이 AUTO를 켤 수 없습니다.');

// 2. 카드 획득: 마력 폭주가 바로 자동 시전되고, 주문별로 다시 끌 수 있습니다.
g.run("selectAwakeningCard('util_auto_grimoire')");
assert.equal(st.deckMechanics.smartAutoCast, true);
assert.equal(g.run("isSkillAutoActive('combustion')"), true);
for (let i = 0; i < 5; i++) g.step(FRAME);
assert.ok(st.combat.combustionCdRem > 0, '자동 영창을 얻으면 준비된 주문이 자동으로 나갑니다.');
g.run("toggleSkillAuto('combustion')");
assert.equal(g.run("isSkillAutoActive('combustion')"), false, '얻은 뒤에는 주문별로 수동 전환할 수 있습니다.');

// 3. 새 런에서는 카드 효과가 사라집니다.
g.run('restartSpeedrunRun()');
assert.equal(g.run('hasSmartAutoCast()'), false);

// 4. 카드 정의·해금: 전설, 주문서가 있어야 등장, 숙련도 45에서 해금(첫 런에는 잠김. 35는 잿더미 군단장).
const card = g.run("RoguelikeDeck.CARD_POOL.find((c) => c.id === 'util_auto_grimoire')");
assert.equal(card.rarity, 'legendary');
assert.equal(card.req(st, {}), false, '주문서가 없으면 자동으로 돌릴 주문이 없어 등장하지 않습니다.');
assert.ok(M.getLockedCardIds(0).includes('util_auto_grimoire'));
assert.ok(M.getLockedCardIds(35).includes('util_auto_grimoire'));
assert.ok(!M.getLockedCardIds(45).includes('util_auto_grimoire'));

// 5. 자동 영창은 편의 전설이라 골라도 보스 보상 전설 보장이 이어지고, 피해 전설을 고르면 보장이 끝납니다.
{
  const g2 = createHeadlessGame({ seed: 8 });
  const s2 = g2.run('state');
  s2.lockedCards = [];
  g2.run("selectAwakeningCard('spell_fireblast')");
  g2.run("selectAwakeningCard('util_auto_grimoire')");
  const bossDraws = () => Array.from({ length: 40 }, () => g2.run('deckManager.drawChoices(3, true, state)').map((c) => c.rarity));
  assert.ok(bossDraws().every((r) => r.includes('legendary')), '자동 영창만 가졌으면 보스 보상마다 전설이 보장됩니다.');
  g2.run("selectAwakeningCard('rapid_gatling')");
  assert.ok(bossDraws().some((r) => !r.includes('legendary')), '피해 전설을 얻으면 보장이 끝납니다.');
}

console.log('자동 영창: 카드 전 수동 주문·토글 차단·획득 즉시 자동 시전·주문별 토글·새 런 초기화·해금·전설 보장 유지 검증 통과');
