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

test('Step 3-1: 전설 카드가 없을 때 보스 보상에 전설 1장 보장', () => {
  const legendaries = CARD_POOL.filter(c => c.rarity === RARITY.LEGENDARY);
  const fakeState = { gold: 0, playerStatsBonus: {}, deckMechanics: {}, grimoires: {} };

  // 전설이 없으면 보스 보상마다 반드시 전설이 섞여 나와야 함 (선택은 플레이어 몫)
  for (let i = 0; i < 50; i++) {
    const choices = createDeckManager().drawChoices(3, true, fakeState);
    assert.equal(choices.length, 3, '보장 후에도 선택지 수는 그대로여야 합니다.');
    assert.equal(new Set(choices.map(c => c.id)).size, 3, '보장된 전설이 다른 선택지와 겹치지 않아야 합니다.');
    assert.ok(choices.some(c => c.rarity === RARITY.LEGENDARY), '전설이 없는 런의 보스 보상에는 전설이 1장 이상 있어야 합니다.');
  }

  // 일반 웨이브에는 보장이 없어야 함
  let normalWithoutLegendary = 0;
  for (let i = 0; i < 50; i++) {
    const choices = createDeckManager().drawChoices(3, false, fakeState);
    if (!choices.some(c => c.rarity === RARITY.LEGENDARY)) normalWithoutLegendary++;
  }
  assert.ok(normalWithoutLegendary > 0, '일반 웨이브에는 전설 보장이 적용되지 않아야 합니다.');

  // 이미 전설을 가진 런에는 보장이 없어야 함 (보스 보상도 가중치 그대로)
  let heldWithoutLegendary = 0;
  for (let i = 0; i < 50; i++) {
    const manager = createDeckManager();
    manager.selectCard(legendaries[0].id, { gold: 0, playerStatsBonus: {}, deckMechanics: {}, grimoires: {} });
    const choices = manager.drawChoices(3, true, fakeState);
    if (!choices.some(c => c.rarity === RARITY.LEGENDARY)) heldWithoutLegendary++;
  }
  assert.ok(heldWithoutLegendary > 0, '전설을 이미 가진 런에는 보장이 적용되지 않아야 합니다.');

  // 전설이 모두 잠긴 첫 런에서는 보장할 전설이 없으므로 선택지에 전설이 없어야 함
  const lockedState = { ...fakeState, lockedCards: legendaries.map(c => c.id) };
  for (let i = 0; i < 20; i++) {
    const choices = createDeckManager().drawChoices(3, true, lockedState);
    assert.ok(!choices.some(c => c.rarity === RARITY.LEGENDARY), '잠긴 전설은 보장으로도 나오면 안 됩니다.');
  }
});

test('Step 4: 카드 선택 및 스탯/메커니즘 반영 검증', () => {
  const manager = createDeckManager();
  const fakeState = { gold: 100, playerStatsBonus: {}, deckMechanics: {} };

  // 수치는 카드 데이터에서 읽어 밸런스 조정과 무관하게 '누적 규칙'만 검증합니다.
  const statOf = (id, key) => CARD_POOL.find(c => c.id === id).stats[key] || 0;

  // 신속의 불꽃 (rapid_spark: 가속) 선택
  const res = manager.selectCard('rapid_spark', fakeState);
  assert.ok(res, '카드 선택이 성공해야 합니다.');
  assert.equal(fakeState.playerStatsBonus.haste, statOf('rapid_spark', 'haste'), '시전 속도 버프가 정상 적용되어야 합니다.');
  assert.equal(manager.getActiveDeck()['rapid_spark'], 1, '덱에 1장 등록되어야 합니다.');

  // 대가형 카드는 이득과 손해가 함께 누적되어야 함 (과부하 시전: 가속 +, 주문력 -)
  manager.selectCard('rapid_overload', fakeState);
  assert.equal(fakeState.playerStatsBonus.haste, statOf('rapid_spark', 'haste') + statOf('rapid_overload', 'haste'), '대가형 카드의 가속 이득이 누적되어야 합니다.');
  assert.ok(statOf('rapid_overload', 'spPct') < 0, '과부하 시전은 주문력 손해가 있는 대가형 카드여야 합니다.');
  assert.equal(fakeState.playerStatsBonus.spPct, statOf('rapid_overload', 'spPct'), '대가형 카드의 주문력 손해가 누적되어야 합니다.');

  // 분열 화염구 (rapid_split: splitFireball) 선택
  manager.selectCard('rapid_split', fakeState);
  assert.equal(fakeState.deckMechanics.splitFireball, 1, '분열 화염구 메커니즘이 활성화되어야 합니다.');
});

test('Step 5: 골드 리롤(Redraw) 비용 및 차감 검증', () => {
  const manager = createDeckManager();
  const fakeState = { gold: 50 };

  manager.drawChoices(3, false);
  // 리롤 비용 = 기준 비용(현재 스테이지 처치 골드) x (1 + 이번 선택에서 리롤한 횟수)
  assert.equal(manager.getRerollCost(10), 10, '첫 리롤 비용은 기준 비용과 같아야 합니다.');
  assert.equal(manager.getRerollCost(300), 300, '후반 스테이지는 기준 비용이 커져 리롤 비용도 커져야 합니다.');

  // 1회차 리롤 성공
  const reroll1 = manager.reroll(fakeState, false, 10);
  assert.ok(reroll1.success, '리롤이 성공해야 합니다.');
  assert.equal(fakeState.gold, 40, '10G가 차감되어 40G가 남아야 합니다.');
  assert.equal(manager.getRerollCost(10), 20, '다음 리롤 비용은 2배인 20G여야 합니다.');

  // 2회차 리롤 성공
  const reroll2 = manager.reroll(fakeState, false, 10);
  assert.ok(reroll2.success);
  assert.equal(fakeState.gold, 20, '20G가 차감되어 20G가 남아야 합니다.');
  assert.equal(manager.getRerollCost(10), 30, '다음 리롤 비용은 3배인 30G여야 합니다.');

  // 3회차 리롤 실패 (골드 부족: 20G < 30G)
  const reroll3 = manager.reroll(fakeState, false, 10);
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

  const savedDeck = { rapid_spark: 2, crit_focus: 1, util_power: 2 };
  const statOf = (id, key) => CARD_POOL.find(c => c.id === id).stats[key] || 0;

  manager.restoreDeck(savedDeck, fakeState);
  assert.equal(manager.getActiveDeck()['rapid_spark'], 2);
  assert.equal(manager.getActiveDeck()['crit_focus'], 1);
  assert.equal(fakeState.playerStatsBonus.haste, statOf('rapid_spark', 'haste') * 2, '복원 시 haste 스탯이 2중첩 반영되어야 합니다.');
  assert.equal(fakeState.playerStatsBonus.spPct, statOf('util_power', 'spPct') * 2, '복원 시 주문력 % 스탯이 2중첩 반영되어야 합니다.');
  assert.equal(fakeState.playerStatsBonus.crit, statOf('crit_focus', 'crit'), '복원 시 crit 스탯이 정상 반영되어야 합니다.');

  // file:// 실행용 내장 fallback 카드는 JSON 원본과 항상 같아야 합니다. (scripts/sync-card-fallback.cjs)
  const json = JSON.parse(require('node:fs').readFileSync(path.join(__dirname, '../src/data/roguelike-cards.json'), 'utf8'));
  const deckSource = require('node:fs').readFileSync(path.join(__dirname, '../src/scripts/roguelike-deck.js'), 'utf8');
  const startIdx = deckSource.indexOf('const DEFAULT_CARDS_RAW = ') + 'const DEFAULT_CARDS_RAW = '.length;
  const match = deckSource.slice(startIdx).match(/\r?\n  \];/);
  assert.ok(match, 'DEFAULT_CARDS_RAW 종료 지점을 찾을 수 있어야 합니다.');
  const literal = deckSource.slice(startIdx, startIdx + match.index + match[0].length - 1);
  assert.deepEqual(JSON.parse(literal), json, '내장 fallback 카드가 roguelike-cards.json과 다릅니다. node scripts/sync-card-fallback.cjs를 실행하세요.');
});

test('Step 8: HTML 마크업 무결성 (각성 모달 및 하단 덱 트레이) 검증', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');

  // 각성 모달 구조 검증
  assert.ok(html.includes('id="awakening-modal-backdrop"'), '마도서 각성 모달 백드롭이 존재해야 합니다.');
  assert.ok(!html.includes('id="awakening-wave-tag"'), '불필요한 웨이브 돌파 보상 뱃지는 UI 미니멀리즘을 위해 제거되어 있어야 합니다.');
  assert.ok(!gameSource.includes('btn-card-choose'), '카드 내부의 불필요한 각성 수락 버튼은 제거되어야 합니다.');
  assert.ok(html.includes('id="awakening-modal-title"'), '각성 모달 타이틀이 존재해야 합니다.');
  assert.ok(html.includes('id="awakening-cards-container"'), '3지선다 카드 컨테이너가 존재해야 합니다.');
  assert.ok(html.includes('id="ui-awakening-player-gold"'), '보상 창 내 보유 골드 표시 박스가 존재해야 합니다.');
  assert.ok(html.includes('id="ui-awakening-gold-amount"'), '보상 창 내 보유 골드 텍스트 요소가 존재해야 합니다.');
  assert.ok(html.includes('id="btn-reroll-cards"'), '다시 뽑기(Reroll) 버튼이 존재해야 합니다.');
  assert.ok(html.includes('id="ui-reroll-cost"'), '리롤 비용 표시 배지가 존재해야 합니다.');
  assert.ok(html.includes('id="btn-skip-cards"'), '골드 아끼고 넘기기 버튼이 존재해야 합니다.');

  // 하단 덱 트레이 구조 검증
  assert.ok(html.includes('id="deck-strip-container"'), '하단 덱 트레이 컨테이너가 존재해야 합니다.');
  assert.ok(html.includes('id="deck-strip-cards"'), '장착된 덱 칩 목록 요소가 존재해야 합니다.');
});

test('Step 9: game.js 연동 무결성 (웨이브 클리어 호출, 일시정지, 다시 도전하기 덱 리셋) 검증', () => {
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

  // restartSpeedrunRun 내 deckManager.resetDeck 호출 확인
  assert.ok(gameSource.includes('deckManager.resetDeck(state)'), '다시 도전하기 시 덱 리셋이 수행되어야 합니다.');
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

test('Step 11: 고대 마법 주문서 4종 카드 통합 및 중복 습득 방지 검증', () => {
  const manager = createDeckManager();
  const spellIds = ['spell_fireblast', 'spell_meteor', 'spell_flame_patch', 'spell_combustion'];
  assert.ok(!CARD_POOL.some(c => c.id === 'spell_autocast'), '자동 시전은 기본 제공 시스템이므로 카드 풀에 없어야 합니다.');

  // 1. 4종 주문서가 CARD_POOL에 모두 등록되어 있고 maxStack이 1인지 검증
  for (const id of spellIds) {
    const card = CARD_POOL.find(c => c.id === id);
    assert.ok(card, `${id} 주문서 카드가 CARD_POOL에 존재해야 합니다.`);
    assert.equal(card.maxStack, 1, `${id} 카드의 최대 중첩 수는 1이어야 합니다.`);
  }

  // 2. 카드 선택 시 state.grimoires 플래그 갱신 검증
  const fakeState = {
    gold: 500,
    grimoires: {},
    autoCast: false,
    playerStatsBonus: {},
    deckMechanics: {}
  };

  manager.selectCard('spell_fireblast', fakeState);
  assert.equal(fakeState.grimoires.fireblast, true, '불꽃 작렬 주문서 습득 시 grimoires.fireblast가 true여야 합니다.');

  manager.selectCard('spell_flame_patch', fakeState);
  assert.equal(fakeState.grimoires.flame_patch, true, '불장판 주문서 습득 시 grimoires.flame_patch가 true여야 합니다.');

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

test('Step 12: 소환수 및 스킬 강화 카드 선행 조건(Prerequisite) 필터링 검증', () => {
  const manager = createDeckManager();
  const summonUpgradeIds = ['sum_volley', 'sum_cinder_lord'];
  const emptyState = {
    gold: 1000,
    grimoires: {},
    skillTree: {},
    deckMechanics: {}
  };

  // 1. 초기 상태에서 50회 추첨 시 선행 조건 미충족 카드가 전혀 나오지 않는지 검증
  for (let i = 0; i < 50; i++) {
    const choices = manager.drawChoices(3, false, emptyState);
    for (const c of choices) {
      assert.ok(!summonUpgradeIds.includes(c.id), `소환수가 없는 상태에서는 ${c.id} 카드가 등장하지 않아야 합니다.`);
      assert.notEqual(c.id, 'crit_meteor_storm', '메테오가 없는 상태에서는 태양석 메테오 카드가 등장하지 않아야 합니다.');
      assert.notEqual(c.id, 'crit_crimson_frenzy', '마력 폭주가 없는 상태에서는 진홍의 마력 폭주 카드가 등장하지 않아야 합니다.');
      assert.notEqual(c.id, 'util_phoenix_reborn', '쿨다운 스킬이 없는 상태에서는 불사조의 가호(쿨다운 리셋) 카드가 등장하지 않아야 합니다.');
    }
  }

  // 1-0. 연쇄 몰열 카드는 카드 풀 전체에서 완전히 제외되었는지 확인
  assert.ok(!manager.CARD_POOL.some(c => c.id === 'crit_chain_streak'), '연쇄 몰열(crit_chain_streak) 카드는 카드 풀에서 완전히 제거되어야 합니다.');

  // 1-1. 불장판 강화 카드는 불장판 습득 전에는 등장하지 않아야 함
  const burnSpread = manager.CARD_POOL.find(c => c.id === 'burn_spread');
  assert.equal(burnSpread.req({ grimoires: {} }, {}), false, '불장판이 없으면 번지는 불길이 등장하지 않아야 합니다.');
  assert.equal(burnSpread.req({ grimoires: { flame_patch: true } }, {}), true, '불장판 습득 후에는 번지는 불길이 등장할 수 있어야 합니다.');

  // 2. 메테오(spell_meteor)를 획득한 후에는 메테오 강화 카드가 정상 등장하는지 검증
  //    (희귀 카드 1장의 추첨당 등장 확률이 약 3%이므로 1000회 추첨으로 우연한 실패를 배제)
  manager.selectCard('spell_meteor', emptyState);
  let foundMeteorUpgrade = false;
  for (let i = 0; i < 1000; i++) {
    const choices = manager.drawChoices(3, false, emptyState);
    if (choices.some(c => c.id === 'crit_meteor_storm')) {
      foundMeteorUpgrade = true;
      break;
    }
  }
  assert.ok(foundMeteorUpgrade, '메테오를 획득한 이후에는 메테오 강화(태양석 메테오) 카드가 등장할 수 있어야 합니다.');

  // 3. 화염 정령 소환(sum_spirit)을 1장 획득한 후에는 소환수 업그레이드 카드가 정상 등장할 수 있는지 검증
  manager.selectCard('sum_spirit', emptyState);
  let foundSummonUpgrade = false;
  for (let i = 0; i < 1000; i++) {
    const choices = manager.drawChoices(3, false, emptyState);
    if (choices.some(c => summonUpgradeIds.includes(c.id))) {
      foundSummonUpgrade = true;
      break;
    }
  }
  assert.ok(foundSummonUpgrade, '소환수를 획득한 이후에는 소환수 업그레이드 카드가 등장할 수 있어야 합니다.');
});

test('Step 13: roguelike-cards.json 파일 데이터 주도(Data-Driven) 연동 및 실시간 반영 검증', () => {
  const fs = require('node:fs');
  const jsonPath = path.join(__dirname, '../src/data/roguelike-cards.json');
  assert.ok(fs.existsSync(jsonPath), 'src/data/roguelike-cards.json 파일이 존재해야 합니다.');

  const rawJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(Array.isArray(rawJson), 'JSON 루트는 배열이어야 합니다.');
  assert.equal(rawJson.length, 29, '카드 풀은 밸런스 패치 v2의 27종 + 자동 영창·불꽃 심판(전설) 29종이어야 합니다.');
  assert.ok(!rawJson.some(c => c.id === 'crit_chain_streak'), '연쇄 몰열 카드는 JSON에 존재하지 않아야 합니다.');

  // 동적 로더 및 실시간 반영 검증
  const { setCardPoolFromRaw, CARD_POOL, createDeckManager } = require('../src/scripts/roguelike-deck.js');
  
  // 임의의 테스트용 커스텀 카드 데이터 주입
  const customCards = [
    {
      id: 'custom_designer_super_card',
      title: '디자이너의 시험용 슈퍼 불꽃',
      icon: '💎',
      rarity: 'legendary',
      build: 'rapid',
      maxStack: 1,
      desc: '주문력 <b>+999%</b> 증가.',
      stats: { spPct: 999 }
    }
  ];

  setCardPoolFromRaw(customCards);
  assert.equal(CARD_POOL.length, 1);
  assert.equal(CARD_POOL[0].id, 'custom_designer_super_card');
  assert.equal(CARD_POOL[0].title, '디자이너의 시험용 슈퍼 불꽃');

  const manager = createDeckManager();
  const fakeState = { playerStatsBonus: {} };
  manager.selectCard('custom_designer_super_card', fakeState);
  assert.equal(fakeState.playerStatsBonus.spPct, 999, 'JSON에서 수정된 수치(+999%)가 즉시 인게임에 반영되어야 합니다.');

  // 원본 JSON 데이터로 복원
  setCardPoolFromRaw(rawJson);
  assert.equal(CARD_POOL.length, rawJson.length, `원본 ${rawJson.length}장으로 복원되어야 합니다.`);
});

test('Step 14: 뱀파이어 서바이버즈 스타일 좌상단 덱 슬롯 및 마우스 오버 툴팁 무결성 검증', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const stylesSource = fs.readFileSync(path.join(__dirname, '../src/styles/styles.css'), 'utf8');
  const { createDeckManager } = require('../src/scripts/roguelike-deck.js');

  // 1. HTML 마크업 검증 (좌상단 컨테이너 및 전역 툴팁)
  assert.ok(html.includes('class="deck-strip-container vampire-style hidden" id="deck-strip-container"'), '뱀서 스타일 좌측 상단 덱 컨테이너가 존재해야 합니다.');
  assert.ok(html.includes('id="deck-vampire-tooltip"'), '마우스 오버 시 표시할 전역 덱 툴팁 요소가 존재해야 합니다.');

  // 2. game.js 툴팁 및 뱀서 슬롯 렌더링 함수 검증
  assert.ok(gameSource.includes('function showDeckTooltip('), 'showDeckTooltip 함수가 구현되어 있어야 합니다.');
  assert.ok(gameSource.includes('function hideDeckTooltip('), 'hideDeckTooltip 함수가 구현되어 있어야 합니다.');
  assert.ok(gameSource.includes('vampire-deck-slot'), 'game.js에서 뱀파이어 슬롯 클래스를 생성해야 합니다.');
  assert.ok(gameSource.includes('vampire-deck-badge'), 'game.js에서 중첩/MAX 배지를 생성해야 합니다.');

  // 3. CSS 스타일링 검증
  assert.ok(stylesSource.includes('.vampire-deck-slot'), '뱀서 스타일 슬롯 CSS가 정의되어 있어야 합니다.');
  assert.ok(stylesSource.includes('.deck-vampire-tooltip'), '마우스 오버 툴팁 CSS가 정의되어 있어야 합니다.');
  assert.ok(stylesSource.includes('.vampire-deck-slot.rarity-legendary'), '전설 등급 슬롯 발광 스타일이 정의되어 있어야 합니다.');

  // 4. getActiveCards() 데이터 완결성 검증
  const manager = createDeckManager();
  const fakeState = { playerStatsBonus: {} };
  manager.selectCard('rapid_spark', fakeState);
  manager.selectCard('rapid_spark', fakeState);
  
  const activeCards = manager.getActiveCards();
  assert.equal(activeCards.length, 1);
  const card = activeCards[0];
  assert.equal(card.id, 'rapid_spark');
  assert.equal(card.count, 2);
  assert.ok(card.desc, '툴팁에 표시할 설명문(desc)이 포함되어 있어야 합니다.');
  assert.ok(card.maxStack >= 2, '최대 중첩 수(maxStack)가 포함되어 있어야 합니다.');
  assert.ok(card.stats && card.stats.haste, '스탯 정보가 포함되어 있어야 합니다.');
});

test('Step 15: 최종 보스 세계관/스토리 및 파멸 저지 진척도 UI 무결성 검증', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const paperCss = fs.readFileSync(path.join(__dirname, '../src/styles/paper-ui.css'), 'utf8');

  // 1. HTML 마크업 검증 (진척도 게이지, 마법사/보스 핀, 스토리 툴팁)
  assert.ok(html.includes('class="arena-center-mission-wrap"'), '중앙 미션 래퍼가 존재해야 합니다.');
  assert.ok(html.includes('id="doom-tracker"'), '최종 보스 멸망 저지 트래커 요소가 존재해야 합니다.');
  assert.ok(html.includes('id="doom-stage-display"'), '스테이지 진행도 텍스트 요소가 존재해야 합니다.');
  assert.ok(html.includes('id="doom-track-fill"'), '게이지 바 채우기 요소가 존재해야 합니다.');
  assert.ok(html.includes('id="doom-caster-pin"'), '마법사 위치 핀이 존재해야 합니다.');
  assert.ok(html.includes('id="doom-story-tooltip"'), '스토리 툴팁 요소가 존재해야 합니다.');

  // 2. 세계관/스토리 대사 정확도 검증
  const bossName = '<span class="final-boss-name">이그나르크</span>';
  const expectedStory = `잿불의 폭군 ${bossName}가 세계를 멸망 시키려 하고 있네!<br>최대한 빨리 ${bossName}를 물리쳐 이 세상을 구해 주게나!`;
  assert.ok(html.includes(expectedStory), '세계관/스토리 대사가 HTML 툴팁에 정확히 반영되어 있어야 합니다.');
  // 블리자드 IP(라그나로스·아제로스 등)가 화면 문구와 코드에 남아 있으면 안 됩니다.
  for (const banned of ['라그나로스', 'Ragnaros', '아제로스', 'Azeroth', 'WarcraftLogs', '파멸수호병']) {
    assert.ok(!html.includes(banned) && !gameSource.includes(banned), `${banned} 표기가 남아 있으면 안 됩니다.`);
  }
  // HTML 속 보스 이름은 FINAL_BOSS 정의와 일치해야 합니다(실행 시 applyFinalBossNames가 동기화).
  assert.ok(gameSource.includes("const FINAL_BOSS = { name: tr('이그나르크')"), 'FINAL_BOSS 이름 정의가 HTML 기본 문구와 일치해야 합니다.');

  // 3. game.js 연동 무결성 검증
  assert.ok(gameSource.includes('function updateDoomProgressUI('), 'updateDoomProgressUI 함수가 정의되어 있어야 합니다.');
  assert.ok(gameSource.includes('updateDoomProgressUI()'), 'updateStageUI 내에서 updateDoomProgressUI가 호출되어야 합니다.');
  assert.ok(gameSource.includes('function initDoomTrackerEvents('), 'initDoomTrackerEvents 함수가 정의되어 있어야 합니다.');

  // 4. paper-ui.css 스타일링 무결성 검증
  assert.ok(paperCss.includes('.arena-center-mission-wrap'), '중앙 미션 래퍼 스타일이 정의되어 있어야 합니다.');
  assert.ok(paperCss.includes('.doom-tracker'), '최종 보스 트래커 스타일이 정의되어 있어야 합니다.');
  assert.ok(paperCss.includes('.doom-story-tooltip'), '스토리 툴팁 스타일이 정의되어 있어야 합니다.');
  assert.ok(paperCss.includes('.doom-boss-pin.pin-final'), '최종 보스 핀 스타일이 정의되어 있어야 합니다.');
});

test('Step 16: 화염 기관총 (rapid_gatling) 시전 시간 단축(0.3s) 및 덱 메커니즘 연동 검증', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const { createDeckManager } = require('../src/scripts/roguelike-deck.js');

  // 1. 카드 선택 시 gatlingMode 키 정상 활성화 검증
  const manager = createDeckManager();
  const fakeState = { deckMechanics: {}, playerStatsBonus: {} };
  manager.selectCard('rapid_gatling', fakeState);
  assert.equal(fakeState.deckMechanics.gatlingMode, true, 'gatlingMode가 true여야 합니다.');

  // 2. game.js 소스 코드 수치 스펙 검증
  assert.ok(gameSource.includes('baseCast = isGatling ? 0.30 : 1.5'), '기관총 모드 시 기본 시전 시간이 0.30초여야 합니다.');
  assert.ok(gameSource.includes('minCast = isGatling ? 0.12 : 0.35'), '기관총 모드 시 최소 시전 상한이 0.12초여야 합니다.');
  assert.ok(gameSource.includes('baseGcd = isGatling ? 0.30 : 1.2'), '기관총 모드 시 기본 GCD가 0.30초여야 합니다.');
  assert.ok(gameSource.includes('minGcd = isGatling ? 0.12 : 0.4'), '기관총 모드 시 최소 GCD가 0.12초여야 합니다.');
  assert.ok(gameSource.includes('⚡ 화염 기관총 난사!'), '캐스트바에 ⚡ 화염 기관총 난사! 문구가 표시되어야 합니다.');

  // 3. 실제 triggerSkill('fireball') 실행 시 0.3초 시전 및 GCD 단축 실측 검증
  const trigger = gameSource.slice(gameSource.indexOf('function triggerSkill('), gameSource.indexOf('function runSmartAutoCast('));
  const combat = { castingSkill: null, gcdRemaining: 0, castTotal: 0, castRemaining: 0, gcdTotal: 0 };
  const stats = { speedMult: 1.0, cdr: 0 };
  const context = vm.createContext({
    state: { combat, deckMechanics: { gatlingMode: true } },
    getPlayerStats: () => stats,
    updateCastingLoopSound: () => {}
  });
  vm.runInContext(trigger, context);
  const success = vm.runInContext("triggerSkill('fireball', false)", context);
  assert.equal(success, true, '화염구 시전이 성공해야 합니다.');
  assert.equal(combat.castTotal, 0.30, '화염 기관총 활성화 시 castTotal이 0.30초여야 합니다.');
  assert.equal(combat.gcdTotal, 0.30, '화염 기관총 활성화 시 gcdTotal이 0.30초여야 합니다.');
});

test('Step 17: 좌상단 덱 스트립에서 주문서(spellKey) 제외 및 패시브 카드 전용 렌더링 검증', () => {
  const fs = require('node:fs');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');

  // 1. game.js 내 주문서 필터링 구문 검증
  assert.ok(gameSource.includes("!c.spellKey && !c.id.startsWith('spell_')"), '주문서 카드는 좌상단 덱 스트립에서 필터링되어야 합니다.');

  // 2. 주문서와 패시브 카드가 혼합된 경우 필터링 로직 동작 검증
  const sampleCards = [
    { id: 'rapid_spark', title: '신속의 불꽃', icon: '⚡', count: 1 },
    { id: 'spell_fireblast', title: '주문서: 불꽃 작렬', icon: '💥', spellKey: 'fireblast', count: 1 },
    { id: 'spell_meteor', title: '주문서: 메테오', icon: '☄️', spellKey: 'meteor', count: 1 },
    { id: 'crit_focus', title: '타오르는 집중', icon: '🎯', count: 2 }
  ];

  const filtered = sampleCards.filter(c => !c.spellKey && !c.id.startsWith('spell_'));
  assert.equal(filtered.length, 2, '주문서 2종이 제외되고 패시브 카드 2종만 남아야 합니다.');
  assert.equal(filtered[0].id, 'rapid_spark');
  assert.equal(filtered[1].id, 'crit_focus');
  assert.equal(filtered.reduce((a, b) => a + b.count, 0), 3, '패시브 카드 중첩 수만 덱 카운트로 집계되어야 합니다.');
});

test('Step 18: 스킬 습득 순서에 따른 동적 단축키 및 슬롯 배정 검증', () => {
  const fs = require('node:fs');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const { createDeckManager } = require('../src/scripts/roguelike-deck.js');

  // 1. game.js 내 getActiveSpellList 및 동적 단축키 로직 존재 확인
  assert.ok(gameSource.includes('function getActiveSpellList()'), 'getActiveSpellList 함수가 정의되어 있어야 합니다.');
  assert.ok(gameSource.includes('btn.style.order = String(hotkeyNum)'), '스킬 액션바 버튼에 order가 동적으로 부여되어야 합니다.');
  assert.ok(gameSource.includes('const activeSpells = getActiveSpellList();'), '키보드 입력 시 동적 스킬 목록을 참조해야 합니다.');

  // 2. 카드 획득 시 spellOrder 순서 등록 검증 (불꽃 작렬 없이 메테오를 2번째로 배울 경우)
  const manager = createDeckManager();
  const testState = {
    grimoires: {},
    spellOrder: ['fireball'],
    deckMechanics: {},
    playerStatsBonus: {}
  };

  // 메테오 주문서 선택
  manager.selectCard('spell_meteor', testState);
  assert.deepEqual(testState.spellOrder, ['fireball', 'meteor'], '화염구 다음으로 메테오가 spellOrder에 2번째로 추가되어야 합니다.');
  assert.equal(testState.grimoires.meteor, true, '메테오가 해금되어야 합니다.');

  // 그 다음 불꽃 작렬 주문서 선택
  manager.selectCard('spell_fireblast', testState);
  assert.deepEqual(testState.spellOrder, ['fireball', 'meteor', 'fireblast'], '그 다음 배운 불꽃 작렬이 3번째로 추가되어야 합니다.');
  assert.equal(testState.grimoires.fireblast, true, '불꽃 작렬이 해금되어야 합니다.');

  // 3. getActiveSpellList 모의 실행 검증
  const getActiveSpells = (stateObj) => {
    const list = Array.isArray(stateObj.spellOrder) ? stateObj.spellOrder.slice() : ['fireball'];
    return list.filter(k => k === 'fireball' || Boolean(stateObj.grimoires?.[k]));
  };

  const activeSpells = getActiveSpells(testState);
  assert.equal(activeSpells[0], 'fireball', '1번 슬롯/단축키는 fireball이어야 합니다.');
  assert.equal(activeSpells[1], 'meteor', '2번 슬롯/단축키는 meteor이어야 합니다.');
  assert.equal(activeSpells[2], 'fireblast', '3번 슬롯/단축키는 fireblast이어야 합니다.');
});

test('Step 19: 보상 모달(각성 창) 내 보유 골드 표시 실시간 동기화 및 리롤 활성/비활성화 검증', () => {
  const fs = require('node:fs');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const { createDeckManager } = require('../src/scripts/roguelike-deck.js');

  // 1. game.js 내 골드 엘리먼트 갱신 로직 검증
  assert.ok(gameSource.includes("document.getElementById('ui-awakening-gold-amount')"), '보유 골드 표시 엘리먼트를 참조해야 합니다.');
  assert.ok(gameSource.includes("document.getElementById('ui-awakening-player-gold')"), '보유 골드 박스 요소를 참조해야 합니다.');
  assert.ok(gameSource.includes("btn.classList.toggle('disabled', !canAfford)"), '골드 부족 시 disabled 클래스를 토글해야 합니다.');
  assert.ok(gameSource.includes("goldBox.classList.toggle('insufficient', !canAfford)"), '골드 부족 시 경고 스타일을 토글해야 합니다.');

  // 2. 리롤 시 골드 차감 및 비용 증가 수치 검증
  const manager = createDeckManager();
  const testState = { gold: 25 };
  manager.drawChoices(3, false);

  // 1회차: 비용 10G, 잔액 25G -> 성공, 잔액 15G
  const r1 = manager.reroll(testState, false, 10);
  assert.equal(r1.success, true);
  assert.equal(testState.gold, 15);
  assert.equal(manager.getRerollCost(10), 20);

  // 2회차: 비용 20G, 잔액 15G -> 골드 부족 실패, 잔액 15G 유지
  const r2 = manager.reroll(testState, false, 10);
  assert.equal(r2.success, false);
  assert.equal(testState.gold, 15);
});

test('Step 20: 모든 화염구 및 추가 생성 탄환의 마법봉 끝(Wand Tip) 발사 원점 고정 검증', () => {
  const fs = require('node:fs');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');

  // 1. 마법봉 끝 전용 좌표 산출 함수 검증
  assert.ok(gameSource.includes('function getWandTipPos()'), 'getWandTipPos 함수가 정의되어 있어야 합니다.');
  assert.ok(gameSource.includes('artRect.width * 0.859'), '마법사 release 포즈의 마법봉 끝 X 비율(85.9%)이 계산되어야 합니다.');
  assert.ok(gameSource.includes('artRect.height * 0.639'), '마법사 release 포즈의 마법봉 끝 Y 비율(63.9%)이 계산되어야 합니다.');

  // 2. launchProjectile 출발점 고정 및 발사 제스처 동기화 검증
  assert.ok(gameSource.includes('const start = getWandTipPos();'), '모든 투사체 발사 시 getWandTipPos를 출발점으로 삼아야 합니다.');
  assert.ok(gameSource.includes('const startSpreadY = Math.sign(offsetY)'), '추가 화염구는 발 쪽으로 떨어지지 않고 마법봉 끝에서 미세 부채꼴로 뻗어나가야 합니다.');

  // 3. 소환수 불사조 볼트의 발바닥 출발 제거 검증
  assert.ok(!gameSource.includes('startY: casterCenter.y + 62'), '불사조 볼트가 발바닥(+62px)에서 출발하는 버그가 수정되어 있어야 합니다.');
  assert.ok(gameSource.includes('startY: casterCenter.y - 45'), '불사조 볼트는 마법사 어깨 위 비상 고도에서 출발해야 합니다.');
});

test('Step 21: 정수(Essence) 재화 및 관련 UI(상단 알약, 마법 부여 탭/패널, 치트 버튼) 완전 배제 검증', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');

  // 1. index.html 내 정수 관련 UI 부재 검증
  assert.ok(!html.includes('id="pill-essence"'), '상단 상태바에 #pill-essence가 존재하지 않아야 합니다.');
  assert.ok(!html.includes('id="btn-cheat-essence"'), '개발자 치트에 #btn-cheat-essence가 존재하지 않아야 합니다.');
  assert.ok(!html.includes('id="tab-btn-infusion"'), '우측 탭에 #tab-btn-infusion이 존재하지 않아야 합니다.');
  assert.ok(!html.includes('id="pane-infusion"'), '우측 패널에 #pane-infusion이 존재하지 않아야 합니다.');

  // 2. 스테이지·보상 배너는 제거되었습니다(진행은 가운데 진척도, 골드는 몬스터에서 재화 UI로 비행).
  assert.ok(!gameSource.includes("rewardText += ` · 🔹 ${fmt(firstEss)}`"), '스테이지 보상에 🔹 정수가 표시되지 않아야 합니다.');
  assert.ok(!html.includes('id="arena-stage-banner"') && !html.includes('id="target-reward"'), '스테이지·보상 배너가 남아 있으면 안 됩니다.');
  assert.ok(!gameSource.includes("getElementById('target-reward')") && !gameSource.includes("getElementById('arena-stage-banner')"), '제거된 배너를 참조하는 코드가 남아 있으면 안 됩니다.');
  assert.ok(gameSource.includes("document.getElementById('dummy-emoji') || document.getElementById('dummy-avatar')"), '골드 코인은 몬스터에서 출발해야 합니다.');

  // 3. 연쇄 몰열(crit_chain_streak) 카드가 완전히 배제되었는지 검증
  assert.ok(!gameSource.includes('chainHotStreak'), 'game.js에 연쇄 몰열(chainHotStreak) 로직이 남아있지 않아야 합니다.');
});

test('Step 22: 화염 정령 덱 메커니즘 & 결과창 스피드런 기록 비교 대시보드 및 재도전 검증', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  // 결과창 스타일은 페이퍼 UI 구역(paper-ui.css)에 모여 있습니다.
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/styles.css'), 'utf8') + fs.readFileSync(path.join(__dirname, '../src/styles/paper-ui.css'), 'utf8');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const { createDeckManager, CARD_POOL } = require('../src/scripts/roguelike-deck.js');

  // 1. 화염 정령 소환 카드가 덱 메커니즘(spiritCount)에만 반영되는지 검증
  const manager = createDeckManager();
  const testState = {
    deckMechanics: {},
    playerStatsBonus: {}
  };
  manager.selectCard('sum_spirit', testState);
  assert.equal(testState.deckMechanics.spiritCount, 1, 'spiritCount가 1이어야 합니다.');
  assert.equal(testState.skillTree, undefined, '정령 카드는 제거된 특성 트리 상태를 만들지 않아야 합니다.');

  // 2. sum_spirit 2중첩 시 정령 편대 증가 검증
  manager.selectCard('sum_spirit', testState);
  assert.equal(testState.deckMechanics.spiritCount, 2, 'spiritCount가 2여야 합니다.');

  // 3. 선행 조건(has_summon)이 정령 보유를 체크하는지 검증
  const summonCard = CARD_POOL.find(c => c.prerequisite === 'has_summon');
  assert.ok(summonCard, 'has_summon 선행 조건 카드가 존재해야 합니다.');
  assert.equal(summonCard.req(testState, manager.getActiveDeck()), true, '정령 보유 시 has_summon 조건이 충족되어야 합니다.');

  // 4. game.js 정령 렌더링/공격/스폰 및 세이브 복구 로직 검증
  assert.ok(gameSource.includes('const elemLv = (state.deckMechanics && state.deckMechanics.spiritCount) || 0;'), '정령 수는 deckMechanics.spiritCount로 계산되어야 합니다.');
  assert.ok(gameSource.includes("else if (cardId === 'sum_spirit') triggerFireSpiritSpawn();"), 'sum_spirit 카드 선택 시 스폰 연출이 트리거되어야 합니다.');

  // 5. index.html 승천 결과 모달 UI 개편 검증
  assert.ok(html.includes('id="btn-speedrun-retry"'), '스피드런 재도전 버튼(#btn-speedrun-retry)이 존재해야 합니다.');
  assert.ok(html.includes('id="btn-victory-close"'), '결과창 닫기 버튼(#btn-victory-close)이 존재해야 합니다.');
  assert.ok(html.includes('id="speedrun-comparison-board"'), '스피드런 비교 보드(#speedrun-comparison-board)가 존재해야 합니다.');
  assert.ok(html.includes('id="speedrun-current-val"'), '이번 도전 결과 엘리먼트가 존재해야 합니다.');
  assert.ok(html.includes('id="speedrun-best-val"'), '역대 최단시간 엘리먼트가 존재해야 합니다.');
  assert.ok(html.includes('id="speedrun-diff-banner"'), '기록 차이 분석 배너가 존재해야 합니다.');
  assert.ok(!html.includes('id="btn-victory-continue"'), '구형 심연 계속하기 버튼은 제거되어야 합니다.');

  // 6. styles.css 스타일 검증
  assert.ok(css.includes('.speedrun-comparison-board'), '스피드런 비교 보드 스타일이 정의되어 있어야 합니다.');
  assert.ok(css.includes('.victory-btn.primary'), '스피드런 재도전 버튼(.victory-btn.primary) 스타일이 정의되어 있어야 합니다.');
  assert.ok(css.includes('.victory-close-icon'), '결과창 닫기 아이콘 스타일이 정의되어 있어야 합니다.');

  // 7. game.js 내 스피드런 비교 데이터 갱신 검증
  assert.ok(gameSource.includes('speedrun-current-val'), 'openVictoryModal에서 이번 기록을 주입해야 합니다.');
  assert.ok(gameSource.includes('speedrun-best-val'), 'openVictoryModal에서 최단시간을 주입해야 합니다.');
  assert.ok(gameSource.includes('speedrun-diff-banner'), 'openVictoryModal에서 차이 배너를 주입해야 합니다.');
  assert.ok(gameSource.includes("speedrunRetryBtn.addEventListener('click'"), '스피드런 재도전 버튼 클릭 이벤트가 바인딩되어 있어야 합니다.');
});

test('Step 23: 메테오 연속 낙하 시 파티클 지속 보장, 다시 도전하기 런 완전 초기화, 상단 구형 UI 비노출 검증', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../src/styles/styles.css'), 'utf8');
  const gameSource = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
  const meteorSource = fs.readFileSync(path.join(__dirname, '../src/scripts/meteor-art.js'), 'utf8');

  // 1. 메테오 꼬리 및 폭발 파티클 풀 고갈 방지 로직 검증
  assert.ok(meteorSource.includes('if (available < count && meteorCount > 0)'), '연속 메테오 투하 시 오래된 꼬리 파티클 재활용 로직이 있어야 합니다.');
  assert.ok(gameSource.includes('if (particles.length + desiredBurst > 450)'), '메테오 폭발 파티클을 위해 풀 공간 확보 로직이 구현되어 있어야 합니다.');

  // 2. 다시 도전하기(restartSpeedrunRun)의 완전 초기화 로직 검증
  assert.ok(gameSource.includes('function restartSpeedrunRun()'), 'restartSpeedrunRun 함수가 구현되어 있어야 합니다.');
  assert.ok(gameSource.includes("state.spellOrder = ['fireball'];"), '다시 도전하기 시 스킬 슬롯이 기본 화염구 1개로 초기화되어야 합니다.');
  assert.ok(gameSource.includes('state.runFailed = false;'), '다시 도전하기 시 광폭화 실패 상태가 해제되어야 합니다.');
  assert.ok(gameSource.includes('state.playTimeSec = 0;'), '다시 도전하기 시 타이머가 0초로 초기화되어야 합니다.');
  assert.ok(gameSource.includes('restartSpeedrunRun();'), '재도전 버튼 클릭 시 restartSpeedrunRun이 호출되어야 합니다.');

  // 3. 구형 UI(불사조 승천, 심연의 규약, 깃털 알약, 유물 탭)는 숨김이 아니라 마크업·스타일에서 완전히 제거되어야 함
  for (const id of ['btn-ascend', 'btn-heat-pacts', 'pill-feathers', 'tab-btn-artifacts']) {
    assert.ok(!html.includes(`id="${id}"`), `구형 UI #${id}는 마크업에서 제거되어야 합니다.`);
    assert.ok(!css.includes(`#${id}`), `구형 UI #${id} 스타일은 제거되어야 합니다.`);
  }
});







test('무모한 일격은 받은 뒤에도 치명타 확률이 15% 이상 남거나 마력 폭주를 가졌을 때만 등장', () => {
  const reckless = CARD_POOL.find((c) => c.id === 'crit_reckless');
  assert.equal(reckless.prerequisite, 'crit_15_or_combustion');
  const canOffer = (bonusCrit) => reckless.req({ playerStatsBonus: { crit: bonusCrit } }, {});
  // 기본 치명타 5%: 집중 0장(5→0%), 1장(15→7%)으로는 함정이 되므로 나오지 않습니다.
  assert.equal(canOffer(0), false, '기본 치명타 5%에서는 등장하면 안 됩니다.');
  assert.equal(canOffer(10), false, '집중 1장(15%)에서 고르면 7%만 남으므로 등장하면 안 됩니다.');
  assert.equal(canOffer(20), true, '집중 2장(25%)이면 고른 뒤 17%가 남으므로 등장합니다.');
  assert.equal(canOffer(12), false, '무모한 일격 1장을 이미 든 집중 2장(17%)에서는 두 번째가 9%로 떨어지므로 등장하지 않습니다.');
  assert.equal(reckless.req(null, {}), false, '상태를 모르면 등장시키지 않습니다.');
  // 마력 폭주(치명타 100%)가 있으면 치명타 피해 +80%가 살아나므로 치명타가 낮아도 등장합니다.
  assert.equal(reckless.req({ playerStatsBonus: {}, grimoires: { combustion: true } }, {}), true, '마력 폭주를 배웠으면 등장합니다.');
  assert.equal(reckless.req({ playerStatsBonus: {} }, { spell_combustion: 1 }), true, '덱에 마력 폭주 주문서가 있으면 등장합니다.');

  const manager = createDeckManager();
  for (let i = 0; i < 200; i++) {
    const ids = manager.drawChoices(3, true, { playerStatsBonus: {} }).map((c) => c.id);
    assert.ok(!ids.includes('crit_reckless'), '치명타 카드 없이 시작한 런의 보스 보상에도 나오면 안 됩니다.');
  }
});
