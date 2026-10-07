/**
 * roguelike-deck.js - 마도서 각성 (Grimoire Awakening) 로그라이크 3지선다 덱빌딩 시스템
 * 
 * 웨이브 클리어 시 3장의 무작위 각성 카드를 제공하며,
 * 플레이어의 선택에 따라 머신건 속사, 극치명타 누킹, 화염 정령 군단 등 
 * 완전히 다른 3대 빌드를 완성하는 런(Run) 단위 로그라이크 모듈.
 */

(function (global) {
  'use strict';

  // 카드 등급 정의
  const RARITY = {
    COMMON: 'common',
    RARE: 'rare',
    LEGENDARY: 'legendary'
  };

  // 등급별 스타일/라벨 메타
  const RARITY_META = {
    [RARITY.COMMON]: { name: '일반', color: '#94a3b8', border: '#475569', bg: 'rgba(30, 41, 59, 0.9)', badge: '#64748b' },
    [RARITY.RARE]: { name: '희귀', color: '#38bdf8', border: '#0284c7', bg: 'rgba(12, 74, 110, 0.9)', badge: '#0369a1' },
    [RARITY.LEGENDARY]: { name: '전설', color: '#fbbf24', border: '#d97706', bg: 'rgba(120, 53, 15, 0.9)', badge: '#b45309' }
  };

  // 3대 빌드 카테고리
  const BUILD = {
    RAPID: 'rapid',       // 속사 머신건
    CRIT: 'crit',         // 극치명타 몰열
    SUMMON: 'summon',     // 화염 정령 군단
    UTILITY: 'utility'    // 유틸리티 및 특수
  };

  // 전체 카드 풀 (Card Database)
  const CARD_POOL = [
    // ==========================================
    // 1. 속사 머신건 빌드 (Rapid Fire)
    // ==========================================
    {
      id: 'rapid_spark',
      title: '신속의 불꽃',
      icon: '⚡',
      rarity: RARITY.COMMON,
      build: BUILD.RAPID,
      maxStack: 5,
      desc: '화염구 시전 속도가 <b>+25%</b> 빨라집니다.',
      stats: { haste: 25 },
      apply: (state) => {
        state.playerStatsBonus = state.playerStatsBonus || {};
        state.playerStatsBonus.haste = (state.playerStatsBonus.haste || 0) + 25;
      }
    },
    {
      id: 'rapid_power',
      title: '연속 점화',
      icon: '🔥',
      rarity: RARITY.COMMON,
      build: BUILD.RAPID,
      maxStack: 5,
      desc: '주문 공격력이 <b>+30</b> 증가합니다.',
      stats: { sp: 30 },
      apply: (state) => {
        state.playerStatsBonus = state.playerStatsBonus || {};
        state.playerStatsBonus.sp = (state.playerStatsBonus.sp || 0) + 30;
      }
    },
    {
      id: 'rapid_split',
      title: '분열 화염구',
      icon: '💥',
      rarity: RARITY.RARE,
      build: BUILD.RAPID,
      maxStack: 3,
      desc: '화염구 적중 시 <b>2개의 작은 불씨</b>로 분열되어 추가 타격합니다 (각각 40% 피해).',
      mechanic: 'split_fireball',
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.splitFireball = (state.deckMechanics.splitFireball || 0) + 1;
      }
    },
    {
      id: 'rapid_overdrive',
      title: '가속 과부하',
      icon: '🌀',
      rarity: RARITY.RARE,
      build: BUILD.RAPID,
      maxStack: 2,
      desc: '화염구 시전 완료 시 4초간 시전 속도가 <b>+15%</b> 가속됩니다 (최대 5중첩).',
      mechanic: 'haste_stack',
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.hasteStack = true;
      }
    },
    {
      id: 'rapid_gatling',
      title: '화염 기관총',
      icon: '☄️',
      rarity: RARITY.LEGENDARY,
      build: BUILD.RAPID,
      maxStack: 1,
      desc: '화염구의 기본 시전 시간이 <b>0.3초</b>로 극도로 단축되며 기관총처럼 난사됩니다.',
      mechanic: 'gatling_mode',
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.gatlingMode = true;
      }
    },

    // ==========================================
    // 2. 극치명타 몰열 누킹 빌드 (Hot Streak Nuke)
    // ==========================================
    {
      id: 'crit_focus',
      title: '타오르는 집중',
      icon: '🎯',
      rarity: RARITY.COMMON,
      build: BUILD.CRIT,
      maxStack: 5,
      desc: '치명타 확률이 <b>+15%</b> 증가합니다.',
      stats: { crit: 15 },
      apply: (state) => {
        state.playerStatsBonus = state.playerStatsBonus || {};
        state.playerStatsBonus.crit = (state.playerStatsBonus.crit || 0) + 15;
      }
    },
    {
      id: 'crit_multiplier',
      title: '작열의 맹공',
      icon: '🌋',
      rarity: RARITY.COMMON,
      build: BUILD.CRIT,
      maxStack: 5,
      desc: '치명타 피해량이 <b>+45%</b> 증가합니다.',
      stats: { critDmg: 0.45 },
      apply: (state) => {
        state.playerStatsBonus = state.playerStatsBonus || {};
        state.playerStatsBonus.critDmg = (state.playerStatsBonus.critDmg || 0) + 0.45;
      }
    },
    {
      id: 'crit_chain_streak',
      title: '연쇄 몰열',
      icon: '✨',
      rarity: RARITY.RARE,
      build: BUILD.CRIT,
      maxStack: 2,
      desc: '몰아치는 열기 소모 시 <b>40% 확률</b>로 몰열 버프가 사라지지 않고 유지됩니다.',
      mechanic: 'chain_hot_streak',
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.chainHotStreak = (state.deckMechanics.chainHotStreak || 0) + 0.4;
      }
    },
    {
      id: 'crit_meteor_storm',
      title: '태양석 메테오',
      icon: '☄️',
      rarity: RARITY.RARE,
      build: BUILD.CRIT,
      maxStack: 2,
      desc: '메테오의 재사용 대기시간이 <b>50% 감소</b>하고 피해량이 <b>+60%</b> 증가합니다.',
      mechanic: 'meteor_buff',
      req: (st, deck) => (deck['spell_meteor'] || 0) > 0 || Boolean(st && st.grimoires && st.grimoires.meteor),
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.meteorBuff = (state.deckMechanics.meteorBuff || 0) + 1;
        state.grimoires = state.grimoires || {};
        state.grimoires.meteor = true; // 메테오 즉시 해금
      }
    },
    {
      id: 'crit_crimson_frenzy',
      title: '진홍의 마력 폭주',
      icon: '👑',
      rarity: RARITY.LEGENDARY,
      build: BUILD.CRIT,
      maxStack: 1,
      desc: '발화(마력 폭주) 지속 시간이 2배가 되며, 발화 중 모든 공격 피해가 <b>150% 증폭</b>됩니다.',
      mechanic: 'combustion_god',
      req: (st, deck) => (deck['spell_combustion'] || 0) > 0 || Boolean(st && st.grimoires && st.grimoires.combustion),
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.combustionGod = true;
        state.grimoires = state.grimoires || {};
        state.grimoires.combustion = true; // 발화 즉시 해금
      }
    },

    // ==========================================
    // 3. 화염 정령 군단 빌드 (Flame Summoner)
    // ==========================================
    {
      id: 'sum_spirit',
      title: '화염 정령 소환',
      icon: '🔥',
      rarity: RARITY.COMMON,
      build: BUILD.SUMMON,
      maxStack: 4,
      desc: '플레이어 옆에 지속 화염 공격을 퍼붓는 <b>화염 정령 1기</b>를 소환합니다 (최대 4기).',
      mechanic: 'extra_spirit',
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.extraSpirits = (state.deckMechanics.extraSpirits || 0) + 1;
        state.skillTree = state.skillTree || {};
        state.skillTree.magma_golem = Math.max(state.skillTree.magma_golem || 0, 1);
      }
    },
    {
      id: 'sum_haste',
      title: '정령 격노',
      icon: '⚔️',
      rarity: RARITY.RARE,
      build: BUILD.SUMMON,
      maxStack: 3,
      desc: '모든 소환수의 공격 속도 <b>+50%</b> 및 공격력 <b>+40%</b> 증가.',
      mechanic: 'spirit_frenzy',
      req: (st, deck) => (deck['sum_spirit'] || 0) > 0 || Boolean(st && st.deckMechanics && st.deckMechanics.extraSpirits > 0) || Boolean(st && st.skillTree && st.skillTree.magma_golem > 0),
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.spiritDamageMult = (state.deckMechanics.spiritDamageMult || 1) * 1.4;
        state.deckMechanics.spiritSpeedMult = (state.deckMechanics.spiritSpeedMult || 1) * 1.5;
      }
    },
    {
      id: 'sum_volley',
      title: '일제 협공 사격',
      icon: '🏹',
      rarity: RARITY.RARE,
      build: BUILD.SUMMON,
      maxStack: 1,
      desc: '마법사가 화염구를 발사할 때마다 <b>소환된 모든 정령이 동시에 협공 탄환</b>을 발사합니다.',
      mechanic: 'synchronized_fire',
      req: (st, deck) => (deck['sum_spirit'] || 0) > 0 || Boolean(st && st.deckMechanics && st.deckMechanics.extraSpirits > 0) || Boolean(st && st.skillTree && st.skillTree.magma_golem > 0),
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.synchronizedFire = true;
      }
    },
    {
      id: 'sum_cinder_lord',
      title: '잿더미 군단장',
      icon: '👹',
      rarity: RARITY.LEGENDARY,
      build: BUILD.SUMMON,
      maxStack: 1,
      desc: '소환수 1기당 마법사의 모든 주문 피해량이 <b>+30%</b> 증폭됩니다.',
      mechanic: 'cinder_lord',
      req: (st, deck) => (deck['sum_spirit'] || 0) > 0 || Boolean(st && st.deckMechanics && st.deckMechanics.extraSpirits > 0) || Boolean(st && st.skillTree && st.skillTree.magma_golem > 0),
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.cinderLord = true;
      }
    },

    // ==========================================
    // 4. 유틸리티 및 특수 파밍 (Utility & Synergy)
    // ==========================================
    {
      id: 'util_gold_greed',
      title: '탐욕의 불길',
      icon: '💰',
      rarity: RARITY.COMMON,
      build: BUILD.UTILITY,
      maxStack: 3,
      desc: '몬스터 처치 시 획득하는 골드가 <b>+60%</b> 증가합니다.',
      stats: { goldMult: 0.6 },
      apply: (state) => {
        state.playerStatsBonus = state.playerStatsBonus || {};
        state.playerStatsBonus.goldMult = (state.playerStatsBonus.goldMult || 0) + 0.6;
      }
    },
    {
      id: 'util_executioner',
      title: '처형인의 불꽃',
      icon: '☠️',
      rarity: RARITY.RARE,
      build: BUILD.UTILITY,
      maxStack: 2,
      desc: '체력이 40% 이하인 적에게 입히는 모든 피해량이 <b>+70%</b> 증가합니다.',
      mechanic: 'executioner',
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.executionerMult = (state.deckMechanics.executionerMult || 0) + 0.7;
      }
    },
    {
      id: 'util_phoenix_reborn',
      title: '불사조의 가호',
      icon: '🪶',
      rarity: RARITY.LEGENDARY,
      build: BUILD.UTILITY,
      maxStack: 1,
      desc: '치명타 적중 시 15% 확률로 모든 스킬의 쿨다운이 즉시 초기화됩니다.',
      mechanic: 'phoenix_reset',
      apply: (state) => {
        state.deckMechanics = state.deckMechanics || {};
        state.deckMechanics.phoenixReset = true;
      }
    },

    // ==========================================
    // 5. 고대 마법 주문서 (Spell Grimoires)
    // ==========================================
    {
      id: 'spell_autocast',
      title: '비전 마법진: 자동 시전',
      icon: '🪄',
      rarity: RARITY.COMMON,
      build: BUILD.UTILITY,
      maxStack: 1,
      desc: '발아래 마법진을 전개하여 습득한 마법을 쿨다운마다 <b>자동 연계 시전</b>합니다.',
      apply: (state) => {
        state.grimoires = state.grimoires || {};
        state.grimoires.autocast = true;
        state.autoCast = true;
        if (typeof updateSkillActionBarVisibility === 'function') updateSkillActionBarVisibility();
        if (typeof updateAutoCastMagicCircle === 'function') updateAutoCastMagicCircle();
        if (typeof updateSkillAutoUI === 'function') updateSkillAutoUI();
      }
    },
    {
      id: 'spell_fireblast',
      title: '주문서: 불꽃 작렬',
      icon: '💥',
      rarity: RARITY.COMMON,
      build: BUILD.CRIT,
      maxStack: 1,
      desc: '시전 중에도 즉시 발사되는 <b>100% 확정 치명타 보조 마법 [불꽃 작렬]</b>을 습득합니다.',
      apply: (state) => {
        state.grimoires = state.grimoires || {};
        state.grimoires.fireblast = true;
        if (typeof updateSkillActionBarVisibility === 'function') updateSkillActionBarVisibility();
      }
    },
    {
      id: 'spell_meteor',
      title: '주문서: 메테오',
      icon: '☄️',
      rarity: RARITY.RARE,
      build: BUILD.CRIT,
      maxStack: 1,
      desc: '하늘에서 거대 운석을 낙하시킵니다. 치명타 2연속(몰열) 시 <b>즉시 노코스트로 투하</b>됩니다.',
      apply: (state) => {
        state.grimoires = state.grimoires || {};
        state.grimoires.meteor = true;
        if (typeof updateSkillActionBarVisibility === 'function') updateSkillActionBarVisibility();
      }
    },
    {
      id: 'spell_flame_patch',
      title: '주문서: 불장판',
      icon: '🌋',
      rarity: RARITY.RARE,
      build: BUILD.RAPID,
      maxStack: 1,
      desc: '몬스터 발밑에 지속적인 화염 지대를 생성하여 <b>강력한 화상 도트 피해</b>를 입힙니다.',
      apply: (state) => {
        state.grimoires = state.grimoires || {};
        state.grimoires.flame_patch = true;
        state.skillTree = state.skillTree || {};
        state.skillTree.flame_patch = Math.max(1, state.skillTree.flame_patch || 1);
        if (typeof updateSkillActionBarVisibility === 'function') updateSkillActionBarVisibility();
      }
    },
    {
      id: 'spell_combustion',
      title: '주문서: 마력 폭주',
      icon: '🔥',
      rarity: RARITY.LEGENDARY,
      build: BUILD.CRIT,
      maxStack: 1,
      desc: '일정 시간 동안 <b>모든 마법 100% 확정 치명타 및 시전 속도 대폭 가속</b> 궁극기를 습득합니다.',
      apply: (state) => {
        state.grimoires = state.grimoires || {};
        state.grimoires.combustion = true;
        if (typeof updateSkillActionBarVisibility === 'function') updateSkillActionBarVisibility();
      }
    }
  ];

  // 런(Run) 단위 덱 관리자 객체
  function createDeckManager() {
    let activeDeck = {};       // { cardId: count }
    let rerollCount = 0;       // 현재 3지선다 내 리롤 횟수
    let currentChoices = [];   // 현재 제시된 3장의 카드

    // 리롤 비용 계산 공식: 10G -> 25G -> 50G -> 100G...
    function getRerollCost() {
      return 10 + rerollCount * 15;
    }

    // 3장의 카드 무작위 추첨
    function drawChoices(count = 3, isBossWave = false, gameState = null) {
      // 1. 뽑을 수 있는 유효 카드 필터링 (최대 중첩 미달성 카드 및 이미 습득한 주문서 제외)
      const st = gameState || (typeof state !== 'undefined' ? state : null);
      const eligible = CARD_POOL.filter(card => {
        const currentCount = activeDeck[card.id] || 0;
        if (currentCount >= card.maxStack) return false;
        if (st && st.grimoires) {
          if (card.id === 'spell_fireblast' && st.grimoires.fireblast) return false;
          if (card.id === 'spell_meteor' && st.grimoires.meteor) return false;
          if (card.id === 'spell_combustion' && st.grimoires.combustion) return false;
          if (card.id === 'spell_flame_patch' && st.grimoires.flame_patch) return false;
          if (card.id === 'spell_autocast' && st.grimoires.autocast) return false;
        }
        if (typeof card.req === 'function') {
          if (!card.req(st, activeDeck)) return false;
        }
        return true;
      });

      if (eligible.length === 0) return [];

      // 등급 가중치 설정 (보스 웨이브는 고급 등급 우대)
      const weights = isBossWave
        ? { [RARITY.COMMON]: 0, [RARITY.RARE]: 65, [RARITY.LEGENDARY]: 35 }
        : { [RARITY.COMMON]: 65, [RARITY.RARE]: 28, [RARITY.LEGENDARY]: 7 };

      const selected = [];
      const poolCopy = [...eligible];

      while (selected.length < count && poolCopy.length > 0) {
        // 가중치가 0인 카드는 후보 풀에서 제외
        const validPool = poolCopy.filter(c => (weights[c.rarity] !== undefined ? weights[c.rarity] : 10) > 0);
        if (validPool.length === 0) break;

        const totalWeight = validPool.reduce((sum, c) => sum + weights[c.rarity], 0);
        let rand = Math.random() * totalWeight;
        let chosenIndexInValid = 0;

        for (let i = 0; i < validPool.length; i++) {
          const w = weights[validPool[i].rarity];
          if (rand < w) {
            chosenIndexInValid = i;
            break;
          }
          rand -= w;
        }

        const chosenCard = validPool[chosenIndexInValid];
        selected.push(chosenCard);
        
        // 원본 poolCopy에서 제거
        const originalIndex = poolCopy.findIndex(c => c.id === chosenCard.id);
        if (originalIndex !== -1) {
          poolCopy.splice(originalIndex, 1);
        }
      }

      currentChoices = selected;
      return selected;
    }

    // 카드 선택 적용
    function selectCard(cardId, gameState) {
      const card = CARD_POOL.find(c => c.id === cardId);
      if (!card) return false;

      activeDeck[card.id] = (activeDeck[card.id] || 0) + 1;
      rerollCount = 0; // 리롤 횟수 초기화
      currentChoices = [];

      // 효과 적용
      if (typeof card.apply === 'function') {
        card.apply(gameState);
      }

      return true;
    }

    // 리롤 수행 (골드 차감 성공 시)
    function reroll(gameState, isBossWave = false) {
      const cost = getRerollCost();
      if ((gameState.gold || 0) < cost) {
        return { success: false, reason: '골드가 부족합니다.' };
      }

      gameState.gold -= cost;
      rerollCount++;
      const newChoices = drawChoices(3, isBossWave, gameState);

      return {
        success: true,
        newCost: getRerollCost(),
        choices: newChoices
      };
    }

    // 덱 초기화 (회차 승천/리셋 시)
    function resetDeck(gameState) {
      activeDeck = {};
      rerollCount = 0;
      currentChoices = [];
      if (gameState) {
        gameState.playerStatsBonus = {};
        gameState.deckMechanics = {};
      }
    }

    // 현재 획득한 카드 덱 정보 반환 (UI 렌더링용)
    function getActiveCards() {
      return Object.entries(activeDeck).map(([id, count]) => {
        const card = CARD_POOL.find(c => c.id === id);
        return { ...card, count };
      });
    }

    // 덱 복원 (저장된 세이브 데이터 로드 시)
    function restoreDeck(savedDeck, gameState) {
      resetDeck(gameState);
      if (!savedDeck || typeof savedDeck !== 'object') return;
      for (const [id, count] of Object.entries(savedDeck)) {
        const card = CARD_POOL.find(c => c.id === id);
        if (!card) continue;
        activeDeck[id] = count;
        for (let i = 0; i < count; i++) {
          if (typeof card.apply === 'function') {
            card.apply(gameState);
          }
        }
      }
    }

    return {
      CARD_POOL,
      RARITY,
      RARITY_META,
      BUILD,
      getActiveDeck: () => ({ ...activeDeck }),
      getCurrentChoices: () => [...currentChoices],
      getActiveCards,
      getRerollCost,
      drawChoices,
      selectCard,
      reroll,
      resetDeck,
      restoreDeck
    };
  }

  // 글로벌 등록
  const roguelikeDeckModule = {
    RARITY,
    RARITY_META,
    BUILD,
    CARD_POOL,
    createDeckManager
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = roguelikeDeckModule;
  }
  if (typeof window !== 'undefined') {
    global.RoguelikeDeck = roguelikeDeckModule;
  }
})(typeof window !== 'undefined' ? window : global);
