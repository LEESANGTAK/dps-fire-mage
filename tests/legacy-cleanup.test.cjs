/* 로그라이크 전환 이후 사용되지 않는 구형 시스템이 코드·마크업·스타일에 다시 남지 않는지 검증합니다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const gameSource = read('src/scripts/game.js');
const deckSource = read('src/scripts/roguelike-deck.js');
const html = read('index.html');
const css = ['src/styles/styles.css', 'src/styles/art.css', 'src/styles/paper-ui.css'].map(read).join('\n');

test('구형 성장 시스템(승천·정수·장비·특성·키스톤·열기·현상금)이 게임 코드에서 제거되어 있어야 합니다', () => {
  const removedIdentifiers = [
    'ascensionCount', 'phoenixFeathers', 'doAscend', 'getAscensionDamageMult',
    'state.essence', 'INFUSION_LIST', 'renderInfusionUI',
    'EQUIPMENT_LIST', 'state.items', 'SKILL_MASTERY_LIST', 'getSkillMasteryMult',
    'SKILL_TREE_NODES', 'state.skillTree', 'getAvailableSkillPoints',
    'PHOENIX_ARTIFACTS', 'state.artifacts', 'KEYSTONE_DEFINITIONS', 'activeKeystone',
    'heatPacts', 'getHeatBonusMult', 'BOUNTY_TEMPLATES', 'checkBountyProgress',
    'getStageReqDps', 'isStageDpsMet', 'dpsClearedStage',
    'calculateParseGrade', 'openDetailsModal', 'state.cheats', 'devMode',
    'startTrainingDummyMode'
  ];
  for (const id of removedIdentifiers) {
    assert.ok(!gameSource.includes(id), `game.js에 구형 시스템 식별자 ${id}가 남아 있으면 안 됩니다.`);
  }
  assert.ok(!deckSource.includes('skillTree'), '덱 모듈은 제거된 특성 트리 상태를 건드리지 않아야 합니다.');
});

test('구형 UI 마크업과 전용 스타일이 숨김이 아니라 완전히 제거되어 있어야 합니다', () => {
  const removedIds = [
    'btn-ascend', 'btn-heat-pacts', 'modal-heat-pacts', 'pill-feathers', 'pill-essence',
    'btn-dev-mode', 'dev-cheat-panel', 'btn-unfold-all', 'dps-meter-panel', 'details-modal',
    'bounty-bar', 'shop-column', 'pane-tree', 'keystone-selector-box', 'artifacts-shop-list',
    'btn-prev-stage', 'btn-next-stage', 'chk-auto-advance', 'flame-evo-badge', 'casting-orb',
    'btn-training-dummy'
  ];
  for (const id of removedIds) {
    assert.ok(!html.includes(`id="${id}"`), `index.html에 구형 UI #${id}가 남아 있으면 안 됩니다.`);
  }
  for (const cls of ['.shop-card', '.wow-talent-node', '.keystone-card', '.artifact-card', '.heat-pact-card', '.infusion-card', '.details-modal-backdrop', '.bounty-bar', '.dev-cheat-panel', '.arena-side-nav']) {
    assert.ok(!css.includes(cls), `CSS에 제거된 UI 스타일 ${cls}가 남아 있으면 안 됩니다.`);
  }
});

function loadStatsAndSave(state) {
  const statsCode = gameSource.slice(gameSource.indexOf('function getPlayerStats('), gameSource.indexOf('function fmt('));
  const saveCode = gameSource.slice(gameSource.indexOf('function saveGame('), gameSource.indexOf('function initEvents('));
  const storage = {};
  const restored = [];
  const context = vm.createContext({
    state,
    FINAL_STAGE: 20,
    SAVE_KEY: 'TEST_SAVE',
    localStorage: { getItem: (k) => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; } },
    deckManager: { getActiveDeck: () => ({ util_gold_greed: 1 }), restoreDeck: (deck) => restored.push(deck) }
  });
  vm.runInContext(statsCode + saveCode, context);
  return { context, storage, restored };
}

function freshState() {
  return {
    gold: 0, currentStage: 1, highestClearedStage: 0, playTimeSec: 0, totalPlayTimeSec: 0, totalKills: 0,
    campaignCleared: false, bestSpeedrunTime: null, autoCast: false,
    skillAuto: { fireball: true, fireblast: true, combustion: true, meteor: true, flame_patch: true },
    soundOn: true, bgmVolume: 0.4, sfxVolume: 0.8,
    playerStatsBonus: {}, deckMechanics: {}, spellOrder: ['fireball'],
    unfolded: { awakening: false, combatStats: false, hallOfFame: false },
    grimoires: { autocast: false, fireblast: false, meteor: false, combustion: false, flame_patch: false },
    combat: { combustionRem: 0 },
    stats: { peakDps: 0, combustionHits: 0, combustionPyros: 0 }
  };
}

test('골드 보너스 카드(goldBonus)가 실제 골드 배율에 반영되어야 합니다', () => {
  const state = freshState();
  const { context } = loadStatsAndSave(state);
  assert.equal(vm.runInContext('getPlayerStats().goldMult', context), 1);
  state.playerStatsBonus.goldBonus = 0.6 + 0.2;
  assert.equal(vm.runInContext('getPlayerStats().goldMult', context), 1.8, '탐욕의 불길(+60%)과 현상금 사냥꾼(+20%)이 합산되어야 합니다.');

  // 카드 데이터의 골드 보너스 키가 게임이 읽는 키와 일치해야 합니다.
  const cards = JSON.parse(read('src/data/roguelike-cards.json'));
  for (const card of cards.filter((c) => c.stats && Object.keys(c.stats).some((k) => /gold/i.test(k)))) {
    assert.deepEqual(Object.keys(card.stats).filter((k) => /gold/i.test(k)), ['goldBonus'], `${card.id}의 골드 스탯 키는 goldBonus여야 합니다.`);
  }
});

test('구형 세이브를 불러와도 제거된 시스템 필드는 복원·재저장되지 않아야 합니다', () => {
  const state = freshState();
  const { context, storage, restored } = loadStatsAndSave(state);
  storage.TEST_SAVE = JSON.stringify({
    gold: 1234, currentStage: 27, highestClearedStage: 25, campaignCleared: true, bestSpeedrunTime: 812,
    essence: 99, ascensionCount: 3, phoenixFeathers: 5, items: { oak_wand: 9 }, skillTree: { fire_elem: 2 },
    heatPacts: { iron_skin: true }, bounty: { type: 'crit_count' }, devMode: true, cheats: { alwaysCrit: true },
    unfolded: { grimoireShop: true, equipShop: true, hallOfFame: true },
    grimoires: { autocast: true, ignite: true, meteor: true },
    stats: { peakDps: 4300, totalDamage: 1, biggestCrit: 2 },
    activeDeck: { sum_spirit: 1 }
  });
  vm.runInContext('loadGame()', context);

  assert.equal(state.gold, 1234);
  assert.equal(state.currentStage, 20, '최종 스테이지를 넘는 구형 심연 스테이지는 Stage 20으로 보정되어야 합니다.');
  assert.equal(state.highestClearedStage, 20);
  assert.equal(state.bestSpeedrunTime, 812);
  assert.deepEqual(state.unfolded, { awakening: false, combatStats: false, hallOfFame: true });
  assert.deepEqual(state.grimoires, { autocast: true, fireblast: false, meteor: true, combustion: false, flame_patch: false });
  assert.equal(state.stats.peakDps, 4300);
  assert.equal(state.stats.totalDamage, undefined, '제거된 상세 딜로그 통계는 복원하지 않아야 합니다.');
  assert.equal(JSON.stringify(restored), JSON.stringify([{ sum_spirit: 1 }]), '각성 덱은 덱 관리자로 복원되어야 합니다.');

  const resaved = JSON.parse(storage.TEST_SAVE);
  for (const key of ['essence', 'ascensionCount', 'phoenixFeathers', 'items', 'skillTree', 'heatPacts', 'bounty', 'devMode', 'cheats', 'dpsClearedStage', 'maxDps']) {
    assert.ok(!(key in resaved), `재저장된 세이브에 구형 필드 ${key}가 남아 있으면 안 됩니다.`);
  }
});
