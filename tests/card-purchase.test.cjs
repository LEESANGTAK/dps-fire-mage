// 각성 카드 구매: 각성 창의 카드는 모두 골드로 사고, 골드가 되는 만큼 여러 장 살 수 있습니다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDeckManager, PURCHASE_RULES, CARD_POOL } = require('../src/scripts/roguelike-deck.js');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const newState = (gold) => ({ gold, playerStatsBonus: {}, deckMechanics: {} });

test('가격: 처치 골드 × 등급 배율, 등급이 높을수록 비쌈', () => {
  const m = createDeckManager();
  const { common, rare, legendary } = PURCHASE_RULES.rarityMult;
  assert.ok(common < rare && rare < legendary);
  const card = (rarity) => CARD_POOL.find((c) => c.rarity === rarity);
  assert.equal(m.getPurchaseCost(card('common'), 100), 100 * common);
  assert.equal(m.getPurchaseCost(card('rare'), 100), 100 * rare);
  assert.equal(m.getPurchaseCost(card('legendary'), 100), 100 * legendary);
});

test('가격: 같은 카드를 가진 장수만큼 비싸짐(다른 카드는 그대로)', () => {
  const m = createDeckManager();
  const stackable = CARD_POOL.find((c) => c.maxStack >= 3 && c.rarity === 'common');
  const other = CARD_POOL.find((c) => c.rarity === 'common' && c.id !== stackable.id);
  const base = m.getPurchaseCost(stackable, 100);
  m.selectCard(stackable.id, newState(0));
  assert.equal(m.getPurchaseCost(stackable, 100), Math.round(base * (1 + PURCHASE_RULES.stackStep)));
  m.selectCard(stackable.id, newState(0));
  assert.equal(m.getPurchaseCost(stackable, 100), Math.round(base * (1 + 2 * PURCHASE_RULES.stackStep)));
  assert.equal(m.getPurchaseCost(other, 100), m.getPurchaseCost({ id: 'x', rarity: 'common' }, 100), '다른 카드 가격은 그대로여야 합니다.');
});

test('일반 카드는 어느 스테이지든 그 스테이지 수입보다 쌈(아끼지 않으면 스테이지마다 1장)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const rows = [...src.matchAll(/stage: (\d+),.*?gold: (\d+), firstBonus: (\d+)/g)];
  assert.equal(rows.length, 20);
  for (const [, stage, gold, first] of rows) {
    const price = Number(gold) * PURCHASE_RULES.rarityMult.common;
    assert.ok(price <= Number(gold) + Number(first), `${stage}스테이지 일반 카드 ${price}G가 수입 ${Number(gold) + Number(first)}G보다 비쌉니다.`);
  }
});

test('구매: 골드 차감, 덱 반영, 제시 카드에서 빠지고 골드가 되면 여러 장', () => {
  const m = createDeckManager();
  const st = newState(1e6);
  m.beginWindow();
  const choices = m.drawChoices(3, false, st);
  const cost = m.getPurchaseCost(choices[0], 100);
  const r = m.buyCard(choices[0].id, st, 100);
  assert.ok(r.success);
  assert.equal(st.gold, 1e6 - cost);
  assert.equal(m.getActiveDeck()[choices[0].id], 1);
  assert.equal(m.getCurrentChoices().length, 2);
  assert.ok(m.buyCard(choices[1].id, st, 100).success, '골드가 되면 같은 창에서 더 살 수 있습니다.');
  assert.ok(m.buyCard(choices[2].id, st, 100).success);
  assert.equal(m.getCurrentChoices().length, 0);
});

test('구매 실패: 골드 부족·제시되지 않은 카드', () => {
  const m = createDeckManager();
  const st = newState(0);
  m.beginWindow();
  const choices = m.drawChoices(3, false, st);
  assert.equal(m.buyCard(choices[0].id, st, 100).success, false);
  assert.equal(st.gold, 0);
  st.gold = 1e9;
  assert.equal(m.buyCard('no_such_card', st, 100).success, false);
});

test('창 열기·닫기: 다시 뽑기 횟수와 남은 제시 카드가 다음 창으로 넘어가지 않음', () => {
  const m = createDeckManager();
  const st = newState(1000);
  m.beginWindow();
  m.drawChoices(3, false, st);
  m.reroll(st, false, 10);
  assert.equal(m.getRerollCost(10), 20);
  m.endWindow();
  assert.equal(m.getCurrentChoices().length, 0);
  m.beginWindow();
  assert.equal(m.getRerollCost(10), 10);
});

test('실제 게임: 첫 창(6골드)에서 일반 카드를 살 수 있고, 더 살 수 없으면 창이 닫힘', () => {
  const g = createHeadlessGame({ seed: 3 });
  const st = g.run('state');
  g.run('restartSpeedrunRun()');
  st.currentStage = 1;
  st.gold = 6;
  g.run('triggerAwakeningSelection(1, false, null)');
  const choices = g.run('deckManager.getCurrentChoices()');
  const common = choices.find((c) => c.rarity === 'common');
  assert.ok(common, '시드 3의 첫 창에는 일반 카드가 있어야 합니다.');
  assert.equal(g.run(`deckManager.getPurchaseCost(${JSON.stringify(common)}, getPurchaseBaseCost())`), 5, '1스테이지 일반 카드는 5G입니다(처치 골드 4 × 1.25).');
  g.run(`awakeningInputLockUntil = 0; buyAwakeningCard(${JSON.stringify(common.id)})`);
  assert.equal(st.gold, 1);
  assert.equal(g.run('awakeningExiting || !awakeningModalOpen'), true, '살 수 있는 카드가 없으면 창을 마쳐야 합니다.');
  assert.equal(g.run('deckManager.getCurrentChoices().length'), 0, '창을 마치면 남은 카드를 거둬야 합니다.');
});

test('실제 게임: 골드가 넉넉하면 창이 열린 채로 여러 장을 사고, 구매 마치기로 닫음', () => {
  const g = createHeadlessGame({ seed: 7 });
  const st = g.run('state');
  g.run('restartSpeedrunRun()');
  st.gold = 1e6;
  g.run('triggerAwakeningSelection(3, false, null)');
  const choices = g.run('deckManager.getCurrentChoices()');
  g.run(`awakeningInputLockUntil = 0; buyAwakeningCard(${JSON.stringify(choices[0].id)})`);
  assert.equal(g.run('awakeningModalOpen && !awakeningExiting'), true, '더 살 수 있으면 창이 열려 있어야 합니다.');
  assert.equal(g.run("document.getElementById('btn-skip-cards').textContent"), '구매 마치기 ➔');
  g.run(`awakeningInputLockUntil = 0; buyAwakeningCard(${JSON.stringify(choices[1].id)})`);
  assert.equal(st.stats.cardsBought, 2);
  g.run("awakeningInputLockUntil = 0; finishAwakeningWindow(awakeningBoughtIds[awakeningBoughtIds.length - 1])");
  const deck = g.run('deckManager.getActiveDeck()');
  assert.ok(deck[choices[0].id] >= 1 && deck[choices[1].id] >= 1);
  assert.ok(!deck[choices[2].id], '사지 않은 카드는 덱에 들어가면 안 됩니다.');
});

test('UI: 카드 전체가 구매 버튼이고, 가격표는 사실(가격·골드 부족)만 보여 줌', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const fn = src.slice(src.indexOf('function renderAwakeningChoicesUI'), src.indexOf('function getPurchaseBaseCost'));
  assert.ok(fn.includes('card-price'), '가격표가 있어야 합니다.');
  assert.ok(fn.includes('buyAwakeningCard(cardId)'), '카드를 누르면 구매해야 합니다.');
  assert.ok(!/synergy|recommend|추천/.test(fn), '추천·연계 표시를 넣지 않습니다(AGENTS.md 1부 4장).');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(html.includes('골드 아끼고 넘기기'), '넘기기가 골드를 아끼는 선택임을 보여 줘야 합니다.');
  assert.ok(!html.includes('1장 선택하세요'), '구형 무료 선택 안내가 남아 있으면 안 됩니다.');
});
