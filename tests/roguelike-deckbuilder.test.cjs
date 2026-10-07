const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createDeckManager, CARD_POOL, RARITY } = require('../src/scripts/roguelike-deck.js');

test('Step 1: 마도서 각성 카드 풀 데이터 무결성 검증', () => {
  assert.ok(CARD_POOL.length >= 15, '최소 15종 이상의 카드가 등록되어 있어야 합니다.');
  for (const card of CARD_POOL) {
    assert.ok(card.id, '카드 ID가 존재해야 합니다.');
    assert.ok(card.title, '카드 제목이 존재해야 합니다.');
    assert.ok(card.desc, '카드 설명이 존재해야 합니다.');
    assert.ok(card.rarity, '카드 등급이 존재해야 합니다.');
    assert.ok(card.maxStack > 0, '카드 최대 중첩수가 양수여야 합니다.');
  }
});

test('Step 2: 3지선다 무작위 추첨 및 중복 방지 검증', () => {
  const manager = createDeckManager();
  const choices = manager.drawChoices(3, false);
  assert.equal(choices.length, 3, '정확히 3장의 카드가 추첨되어야 합니다.');

  // 3장이 서로 중복되지 않는지 검증
  const ids = new Set(choices.map(c => c.id));
  assert.equal(ids.size, 3, '추첨된 3장의 카드는 서로 중복되지 않아야 합니다.');
});

test('Step 3: 보스 웨이브 시 희귀/전설 카드 우대 가중치 검증', () => {
  const manager = createDeckManager();
  let rareOrLegendaryCount = 0;
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    const choices = manager.drawChoices(3, true); // isBossWave = true
    for (const c of choices) {
      if (c.rarity === RARITY.RARE || c.rarity === RARITY.LEGENDARY) {
        rareOrLegendaryCount++;
      }
    }
  }

  // 보스 웨이브에서는 일반 등급이 0%이고 희귀/전설만 나와야 함
  assert.equal(rareOrLegendaryCount, iterations * 3, '보스 웨이브에서는 모든 카드가 희귀 또는 전설이어야 합니다.');
});

test('Step 4: 카드 선택 및 스탯/메커니즘 반영 검증', () => {
  const manager = createDeckManager();
  const fakeState = { gold: 100, playerStatsBonus: {}, deckMechanics: {} };

  // 신속의 불꽃 (rapid_spark: haste +25) 선택
  const res = manager.selectCard('rapid_spark', fakeState);
  assert.ok(res, '카드 선택이 성공해야 합니다.');
  assert.equal(fakeState.playerStatsBonus.haste, 25, '시전 속도 25% 버프가 정상 적용되어야 합니다.');
  assert.equal(manager.getActiveDeck()['rapid_spark'], 1, '덱에 1장 등록되어야 합니다.');

  // 분열 화염구 (rapid_split: splitFireball) 선택
  manager.selectCard('rapid_split', fakeState);
  assert.equal(fakeState.deckMechanics.splitFireball, 1, '분열 화염구 메커니즘이 활성화되어야 합니다.');
});

test('Step 5: 골드 리롤(Redraw) 비용 및 차감 검증', () => {
  const manager = createDeckManager();
  const fakeState = { gold: 50 };

  manager.drawChoices(3, false);
  assert.equal(manager.getRerollCost(), 10, '첫 리롤 비용은 10G여야 합니다.');

  // 1회차 리롤 성공
  const reroll1 = manager.reroll(fakeState, false);
  assert.ok(reroll1.success, '리롤이 성공해야 합니다.');
  assert.equal(fakeState.gold, 40, '10G가 차감되어 40G가 남아야 합니다.');
  assert.equal(manager.getRerollCost(), 25, '다음 리롤 비용은 25G로 증가해야 합니다.');

  // 2회차 리롤 성공
  const reroll2 = manager.reroll(fakeState, false);
  assert.ok(reroll2.success);
  assert.equal(fakeState.gold, 15, '25G가 차감되어 15G가 남아야 합니다.');
  assert.equal(manager.getRerollCost(), 40, '다음 리롤 비용은 40G여야 합니다.');

  // 3회차 리롤 실패 (골드 부족: 15G < 40G)
  const reroll3 = manager.reroll(fakeState, false);
  assert.equal(reroll3.success, false, '골드가 부족하여 리롤이 실패해야 합니다.');
});

test('Step 6: 최대 중첩 도달 카드 제외 및 덱 리셋 검증', () => {
  const manager = createDeckManager();
  const fakeState = { gold: 1000 };

  // 화염 기관총 (rapid_gatling: maxStack 1)
  manager.selectCard('rapid_gatling', fakeState);
  assert.equal(manager.getActiveDeck()['rapid_gatling'], 1);

  // 다시 뽑았을 때 rapid_gatling이 더 이상 후보에 나오지 않는지 50회 시뮬레이션
  for (let i = 0; i < 50; i++) {
    const choices = manager.drawChoices(3, false);
    assert.ok(choices.every(c => c.id !== 'rapid_gatling'), '최대 중첩(1회)을 달성한 카드는 선택지에 등장하지 않아야 합니다.');
  }

  // 덱 초기화
  manager.resetDeck(fakeState);
  assert.deepEqual(manager.getActiveDeck(), {}, '덱이 완전히 초기화되어야 합니다.');
});

test('Step 7: 저장된 덱 복원(restoreDeck) 검증', () => {
  const manager = createDeckManager();
  const fakeState = { gold: 100, playerStatsBonus: {}, deckMechanics: {} };

  const savedDeck = {
    rapid_spark: 2, // haste +25 * 2 = +50
    rapid_power: 1  // sp +30
  };

  manager.restoreDeck(savedDeck, fakeState);
  assert.equal(manager.getActiveDeck()['rapid_spark'], 2);
  assert.equal(manager.getActiveDeck()['rapid_power'], 1);
  assert.equal(fakeState.playerStatsBonus.haste, 50, '복원 시 haste 스탯이 2중첩 반영되어야 합니다.');
  assert.equal(fakeState.playerStatsBonus.sp, 30, '복원 시 sp 스탯이 정상 반영되어야 합니다.');
});

test('Step 8: HTML 마크업 무결성 (각성 모달 및 하단 덱 트레이) 검증', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  // 각성 모달 구조 검증
  assert.ok(html.includes('id="awakening-modal-backdrop"'), '마도서 각성 모달 백드롭이 존재해야 합니다.');
  assert.ok(html.includes('id="awakening-wave-tag"'), '웨이브 태그 요소가 존재해야 합니다.');
  assert.ok(html.includes('id="awakening-modal-title"'), '각성 모달 타이틀이 존재해야 합니다.');
  assert.ok(html.includes('id="awakening-cards-container"'), '3지선다 카드 컨테이너가 존재해야 합니다.');
  assert.ok(html.includes('id="btn-reroll-cards"'), '다시 뽑기(Reroll) 버튼이 존재해야 합니다.');
  assert.ok(html.includes('id="ui-reroll-cost"'), '리롤 비용 표시 배지가 존재해야 합니다.');
  assert.ok(html.includes('id="btn-skip-cards"'), '선택 없이 넘기기 버튼이 존재해야 합니다.');

  // 하단 덱 트레이 구조 검증
  assert.ok(html.includes('id="deck-strip-container"'), '하단 덱 트레이 컨테이너가 존재해야 합니다.');
  assert.ok(html.includes('id="deck-strip-cards"'), '장착된 덱 칩 목록 요소가 존재해야 합니다.');
});

test('Step 9: game.js 연동 무결성 (웨이브 클리어 호출, 일시정지, 승천 리셋) 검증', () => {
  const fs = require('node:fs');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');

  // game.js 내 마도서 각성 함수 정의 확인
  assert.ok(gameSource.includes('function triggerAwakeningSelection('), 'triggerAwakeningSelection 함수가 정의되어야 합니다.');
  assert.ok(gameSource.includes('function renderAwakeningChoicesUI('), 'renderAwakeningChoicesUI 함수가 정의되어야 합니다.');
  assert.ok(gameSource.includes('function selectAwakeningCard('), 'selectAwakeningCard 함수가 정의되어야 합니다.');
  assert.ok(gameSource.includes('function renderDeckStripUI('), 'renderDeckStripUI 함수가 정의되어야 합니다.');
  assert.ok(gameSource.includes('function initAwakeningModalEvents('), 'initAwakeningModalEvents 함수가 정의되어야 합니다.');

  // onMonsterKilled 내 triggerAwakeningSelection 호출 확인
  assert.ok(gameSource.includes('triggerAwakeningSelection(clearedStage'), '웨이브 클리어 시 triggerAwakeningSelection이 호출되어야 합니다.');

  // doAscend 내 deckManager.resetDeck 호출 확인
  assert.ok(gameSource.includes('deckManager.resetDeck(state)'), '승천 시 덱 리셋이 수행되어야 합니다.');
});

test('Step 10: 런타임 덱 획득 및 activeCards 리스트 연동 검증', () => {
  const manager = createDeckManager();
  const choices = manager.drawChoices(3, false);
  assert.equal(choices.length, 3);

  const fakeState = { gold: 100, playerStatsBonus: {}, deckMechanics: {} };
  manager.selectCard(choices[0].id, fakeState);
  assert.equal(manager.getActiveDeck()[choices[0].id], 1);

  const activeCards = manager.getActiveCards();
  assert.equal(activeCards.length, 1);
  assert.equal(activeCards[0].id, choices[0].id);
  assert.equal(activeCards[0].count, 1);
});

test('Step 11: 고대 마법 주문서 5종 카드 통합 및 중복 습득 방지 검증', () => {
  const manager = createDeckManager();
  const spellIds = ['spell_autocast', 'spell_fireblast', 'spell_meteor', 'spell_flame_patch', 'spell_combustion'];

  // 1. 5종 주문서가 CARD_POOL에 모두 등록되어 있고 maxStack이 1인지 검증
  for (const id of spellIds) {
    const card = CARD_POOL.find(c => c.id === id);
    assert.ok(card, `${id} 주문서 카드가 CARD_POOL에 존재해야 합니다.`);
    assert.equal(card.maxStack, 1, `${id} 카드의 최대 중첩 수는 1이어야 합니다.`);
  }

  // 2. 카드 선택 시 state.grimoires 및 스킬 트리 플래그 갱신 검증
  const fakeState = {
    gold: 500,
    grimoires: {},
    skillTree: {},
    autoCast: false,
    playerStatsBonus: {},
    deckMechanics: {}
  };

  manager.selectCard('spell_fireblast', fakeState);
  assert.equal(fakeState.grimoires.fireblast, true, '불꽃 작렬 주문서 습득 시 grimoires.fireblast가 true여야 합니다.');

  manager.selectCard('spell_autocast', fakeState);
  assert.equal(fakeState.grimoires.autocast, true, '자동 시전 주문서 습득 시 grimoires.autocast가 true여야 합니다.');
  assert.equal(fakeState.autoCast, true, '자동 시전이 즉시 활성화되어야 합니다.');

  manager.selectCard('spell_flame_patch', fakeState);
  assert.equal(fakeState.grimoires.flame_patch, true);
  assert.ok(fakeState.skillTree.flame_patch >= 1, '불장판 스킬 트리가 1레벨 이상이어야 합니다.');

  manager.selectCard('spell_meteor', fakeState);
  assert.equal(fakeState.grimoires.meteor, true);

  manager.selectCard('spell_combustion', fakeState);
  assert.equal(fakeState.grimoires.combustion, true);

  // 3. 모든 주문서를 이미 습득한 상태에서는 3지선다에 주문서 카드가 단 하나도 등장하지 않는지 50회 추첨 검증
  for (let i = 0; i < 50; i++) {
    const choices = manager.drawChoices(3, false, fakeState);
    for (const c of choices) {
      assert.ok(!spellIds.includes(c.id), `이미 습득한 주문서(${c.id})는 선택지에 등장하지 않아야 합니다.`);
    }
  }
});



