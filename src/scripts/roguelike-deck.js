/**
 * roguelike-deck.js - 마도서 각성 (Grimoire Awakening) 로그라이크 3지선다 덱빌딩 시스템
 * 
 * 웨이브 클리어 시 3장의 무작위 각성 카드를 제공하며,
 * 플레이어의 선택에 따라 머신건 속사, 극치명타 누킹, 화염 정령 군단 등 
 * 완전히 다른 3대 빌드를 완성하는 런(Run) 단위 로그라이크 모듈.
 * 
 * 💡 데이터 주도 설계(Data-Driven):
 * 모든 카드 데이터는 `src/data/roguelike-cards.json`에서 관리되며,
 * 디자이너가 JSON 파일을 수정하면 새로고침 시 인게임에 즉시 반영됩니다.
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

  // 빌드 카테고리
  const BUILD = {
    RAPID: 'rapid',       // 속사 머신건
    CRIT: 'crit',         // 극치명타 몰열
    SUMMON: 'summon',     // 화염 정령 군단
    BURN: 'burn',         // 연소 지대 (지속 피해)
    UTILITY: 'utility'    // 유틸리티 및 특수
  };

  // 기본 내장 카드 데이터는 roguelike-cards.json과 동일하게 유지합니다. (file:// 실행 시 fallback)
  const DEFAULT_CARDS_RAW = [
    {
      "id": "rapid_spark",
      "title": "신속의 불꽃",
      "icon": "⚡",
      "rarity": "common",
      "build": "rapid",
      "maxStack": 5,
      "desc": "화염 마법 시전 속도가 <b>+20%</b> 빨라집니다.",
      "stats": {
        "haste": 20
      }
    },
    {
      "id": "rapid_split",
      "title": "분열 화염구",
      "icon": "💥",
      "rarity": "rare",
      "build": "rapid",
      "maxStack": 3,
      "desc": "화염구 적중 시 <b>2개의 작은 불씨</b>로 분열되어 추가 타격합니다 (각각 40% 피해).",
      "mechanic": "split_fireball"
    },
    {
      "id": "rapid_overload",
      "title": "과부하 시전",
      "icon": "🌀",
      "rarity": "rare",
      "build": "rapid",
      "maxStack": 2,
      "desc": "시전 속도가 <b>+45%</b> 빨라지지만, 주문력이 <b>-20%</b> 감소합니다.",
      "stats": {
        "haste": 45,
        "spPct": -20
      }
    },
    {
      "id": "rapid_quickdraw",
      "title": "속사 장전",
      "icon": "🎇",
      "rarity": "rare",
      "build": "rapid",
      "maxStack": 2,
      "desc": "스테이지 시작마다 화염구를 <b>시전 없이 즉시 발사</b>하는 충전을 <b>4회</b> 얻습니다.",
      "mechanic": "quickdraw_charge",
      "mechanicParams": {
        "charges": 4
      }
    },
    {
      "id": "rapid_gatling",
      "title": "화염 기관총",
      "icon": "☄️",
      "rarity": "legendary",
      "build": "rapid",
      "maxStack": 1,
      "desc": "화염구의 기본 시전 시간이 <b>0.3초</b>로 극도로 단축되며 기관총처럼 난사됩니다.",
      "mechanic": "gatling_mode"
    },
    {
      "id": "spell_fireblast",
      "title": "주문서: 불꽃 작렬",
      "icon": "💥",
      "rarity": "common",
      "build": "crit",
      "maxStack": 1,
      "spellKey": "fireblast",
      "desc": "시전 중에도 즉시 발사되는 <b>100% 확정 치명타 보조 마법 [불꽃 작렬]</b>을 습득합니다."
    },
    {
      "id": "crit_focus",
      "title": "타오르는 집중",
      "icon": "🎯",
      "rarity": "common",
      "build": "crit",
      "maxStack": 5,
      "desc": "치명타 확률이 <b>+10%</b> 증가합니다.",
      "stats": {
        "crit": 10
      }
    },
    {
      "id": "crit_heat",
      "title": "작열하는 열기",
      "icon": "🔥",
      "rarity": "common",
      "build": "crit",
      "maxStack": 5,
      "desc": "치명타 피해량이 <b>+35%</b> 증가합니다.",
      "stats": {
        "critDmg": 35
      }
    },
    {
      "id": "crit_reckless",
      "title": "무모한 일격",
      "icon": "🗡️",
      "rarity": "rare",
      "build": "crit",
      "maxStack": 2,
      "desc": "치명타 피해량이 <b>+80%</b> 증가하지만, 치명타 확률이 <b>-8%</b> 감소합니다.",
      "stats": {
        "critDmg": 80,
        "crit": -8
      }
    },
    {
      "id": "spell_meteor",
      "title": "주문서: 메테오",
      "icon": "☄️",
      "rarity": "rare",
      "build": "crit",
      "maxStack": 1,
      "spellKey": "meteor",
      "desc": "하늘에서 거대 운석을 낙하시킵니다. 치명타 2연속(몰열) 시 <b>즉시 노코스트로 투하</b>됩니다."
    },
    {
      "id": "crit_meteor_storm",
      "title": "태양석 메테오",
      "icon": "☄️",
      "rarity": "rare",
      "build": "crit",
      "maxStack": 2,
      "prerequisite": "has_meteor",
      "desc": "메테오의 재사용 대기시간이 <b>50% 감소</b>하고 피해량이 <b>+60%</b> 증가합니다.",
      "mechanic": "meteor_buff"
    },
    {
      "id": "crit_meteor_charge",
      "title": "잠열 충전",
      "icon": "🔋",
      "rarity": "rare",
      "build": "crit",
      "maxStack": 2,
      "prerequisite": "has_meteor",
      "desc": "스테이지 시작마다 <b>메테오 피해 +150%</b> 충전을 <b>3회</b> 얻습니다.",
      "mechanic": "meteor_charge",
      "mechanicParams": {
        "charges": 3,
        "damageBonus": 1.5
      }
    },
    {
      "id": "spell_combustion",
      "title": "주문서: 마력 폭주",
      "icon": "🔥",
      "rarity": "rare",
      "build": "crit",
      "maxStack": 1,
      "spellKey": "combustion",
      "desc": "<b>5초간 모든 마법이 100% 치명타</b>로 적중하고 시전 속도가 빨라지는 궁극기를 습득합니다."
    },
    {
      "id": "crit_crimson_frenzy",
      "title": "진홍의 마력 폭주",
      "icon": "👑",
      "rarity": "legendary",
      "build": "crit",
      "maxStack": 1,
      "prerequisite": "has_combustion",
      "desc": "마력 폭주 지속 시간이 2배가 되며, 폭주 중 모든 공격 피해가 <b>150% 증폭</b>됩니다.",
      "mechanic": "combustion_god"
    },
    {
      "id": "sum_spirit",
      "title": "화염 정령 소환",
      "icon": "🧞",
      "rarity": "common",
      "build": "summon",
      "maxStack": 4,
      "desc": "플레이어 옆에 지속 화염 공격을 퍼붓는 <b>화염 정령 1기</b>를 소환합니다 (최대 4기).",
      "mechanic": "extra_spirit"
    },
    {
      "id": "sum_fury",
      "title": "정령의 분노",
      "icon": "😤",
      "rarity": "common",
      "build": "summon",
      "maxStack": 5,
      "prerequisite": "has_summon",
      "desc": "정령·불사조 등 <b>소환수 피해량이 +40%</b> 증가합니다.",
      "stats": {
        "spiritPct": 40
      }
    },
    {
      "id": "sum_volley",
      "title": "일제 협공 사격",
      "icon": "🏹",
      "rarity": "rare",
      "build": "summon",
      "maxStack": 1,
      "prerequisite": "has_summon",
      "desc": "마법사가 화염구를 발사할 때마다 <b>소환된 모든 정령이 동시에 협공 탄환</b>을 발사합니다.",
      "mechanic": "synchronized_fire"
    },
    {
      "id": "sum_pact",
      "title": "정령 계약",
      "icon": "🤝",
      "rarity": "rare",
      "build": "summon",
      "maxStack": 1,
      "prerequisite": "has_summon",
      "desc": "소환수 피해량이 <b>+100%</b> 증가하지만, 마법사의 주문력이 <b>-25%</b> 감소합니다.",
      "stats": {
        "spiritPct": 100,
        "spPct": -25
      }
    },
    {
      "id": "sum_cinder_lord",
      "title": "잿더미 군단장",
      "icon": "👹",
      "rarity": "legendary",
      "build": "summon",
      "maxStack": 1,
      "prerequisite": "has_summon",
      "desc": "소환수 1기당 마법사의 모든 주문 피해량이 <b>+30%</b> 증폭됩니다.",
      "mechanic": "cinder_lord"
    },
    {
      "id": "burn_ignite",
      "title": "맹렬한 화상",
      "icon": "🩸",
      "rarity": "common",
      "build": "burn",
      "maxStack": 5,
      "desc": "화상·연소·불장판 등 <b>지속 피해량이 +45%</b> 증가합니다.",
      "stats": {
        "burnPct": 45
      }
    },
    {
      "id": "spell_flame_patch",
      "title": "주문서: 불장판",
      "icon": "🌋",
      "rarity": "rare",
      "build": "burn",
      "maxStack": 1,
      "spellKey": "flame_patch",
      "desc": "몬스터 발밑에 지속적인 화염 지대를 생성하여 <b>강력한 화상 도트 피해</b>를 입힙니다."
    },
    {
      "id": "burn_spread",
      "title": "번지는 불길",
      "icon": "♨️",
      "rarity": "rare",
      "build": "burn",
      "maxStack": 2,
      "prerequisite": "has_flame_patch",
      "desc": "불장판 재사용 대기시간이 <b>30% 감소</b>하고 불장판 피해량이 <b>+50%</b> 증가합니다.",
      "mechanic": "patch_boost",
      "mechanicParams": {
        "cooldownMult": 0.7,
        "damageBonus": 0.5
      }
    },
    {
      "id": "burn_wildfire",
      "title": "들불",
      "icon": "🌋",
      "rarity": "legendary",
      "build": "burn",
      "maxStack": 1,
      "desc": "치명타가 남기는 <b>화상 피해가 2.5배</b>로 불어납니다.",
      "mechanic": "wildfire",
      "mechanicParams": {
        "igniteRatioMult": 2.5
      }
    },
    {
      "id": "util_power",
      "title": "마력 증폭",
      "icon": "🔮",
      "rarity": "common",
      "build": "utility",
      "maxStack": 5,
      "desc": "주문력이 <b>+15%</b> 증가합니다.",
      "stats": {
        "spPct": 15
      }
    },
    {
      "id": "util_executioner",
      "title": "처형인의 불꽃",
      "icon": "☠️",
      "rarity": "rare",
      "build": "utility",
      "maxStack": 2,
      "desc": "체력이 40% 이하인 적에게 입히는 모든 피해량이 <b>+70%</b> 증가합니다.",
      "mechanic": "executioner",
      "mechanicParams": {
        "executionerMult": 0.7
      }
    },
    {
      "id": "util_glass_cannon",
      "title": "유리 대포",
      "icon": "💎",
      "rarity": "rare",
      "build": "utility",
      "maxStack": 2,
      "desc": "주문력이 <b>+50%</b> 증가하지만, 시전 속도가 <b>-25%</b> 느려집니다.",
      "stats": {
        "spPct": 50,
        "haste": -25
      }
    },
    {
      "id": "util_phoenix_reborn",
      "title": "불사조의 가호",
      "icon": "🪶",
      "rarity": "legendary",
      "build": "utility",
      "maxStack": 1,
      "prerequisite": "has_any_spell",
      "desc": "<b>불사조</b>가 함께 싸우며 확정 치명타로 협공하고, 치명타 적중 시 <b>15% 확률로 모든 스킬 쿨다운</b>이 초기화됩니다.",
      "mechanic": "phoenix_reset"
    }
  ];

  // 선언적 raw 카드 객체를 실행 가능한 카드 객체로 변환
  function buildCardFromData(raw) {
    const card = { ...raw };

    // 1. 선행 조건(req) 인터프리터
    if (raw.prerequisite === 'has_summon') {
      card.req = (st, deck) => (deck['sum_spirit'] || 0) > 0 || Boolean(st && st.deckMechanics && st.deckMechanics.extraSpirits > 0);
    } else if (raw.prerequisite === 'has_meteor') {
      card.req = (st, deck) => (deck['spell_meteor'] || 0) > 0 || Boolean(st && st.grimoires && st.grimoires.meteor);
    } else if (raw.prerequisite === 'has_combustion') {
      card.req = (st, deck) => (deck['spell_combustion'] || 0) > 0 || Boolean(st && st.grimoires && st.grimoires.combustion);
    } else if (raw.prerequisite === 'has_flame_patch') {
      card.req = (st, deck) => (deck['spell_flame_patch'] || 0) > 0 || Boolean(st && st.grimoires && st.grimoires.flame_patch);
    } else if (raw.prerequisite === 'has_any_spell') {
      card.req = (st, deck) => Boolean(
        (deck['spell_fireblast'] || 0) > 0 ||
        (deck['spell_meteor'] || 0) > 0 ||
        (deck['spell_combustion'] || 0) > 0 ||
        (deck['spell_flame_patch'] || 0) > 0 ||
        (st && st.grimoires && (st.grimoires.fireblast || st.grimoires.meteor || st.grimoires.combustion || st.grimoires.flame_patch))
      );
    }

    // 2. 효과 적용(apply) 인터프리터
    card.apply = (state) => {
      if (!state) return;

      // A. 스탯 보너스 부여
      if (raw.stats) {
        state.playerStatsBonus = state.playerStatsBonus || {};
        for (const [key, val] of Object.entries(raw.stats)) {
          state.playerStatsBonus[key] = (state.playerStatsBonus[key] || 0) + val;
        }
      }

      // B. 주문서 스킬 습득 및 인터페이스 갱신
      if (raw.spellKey) {
        state.grimoires = state.grimoires || {};
        state.grimoires[raw.spellKey] = true;
        state.spellOrder = state.spellOrder || ['fireball'];
        if (!state.spellOrder.includes(raw.spellKey)) {
          state.spellOrder.push(raw.spellKey);
        }
        if (typeof updateSkillActionBarVisibility === 'function') updateSkillActionBarVisibility();
      }

      // C. 특수 로그라이크 메카닉 부여
      if (raw.mechanic) {
        state.deckMechanics = state.deckMechanics || {};
        const p = raw.mechanicParams || {};
        switch (raw.mechanic) {
          case 'split_fireball':
            state.deckMechanics.splitFireball = (state.deckMechanics.splitFireball || 0) + 1;
            break;
          case 'gatling_mode':
            state.deckMechanics.gatlingMode = true;
            break;
          case 'meteor_buff':
            state.deckMechanics.meteorBuff = (state.deckMechanics.meteorBuff || 0) + 1;
            state.grimoires = state.grimoires || {};
            state.grimoires.meteor = true;
            break;
          case 'combustion_god':
            state.deckMechanics.combustionGod = true;
            state.grimoires = state.grimoires || {};
            state.grimoires.combustion = true;
            break;
          case 'extra_spirit':
            state.deckMechanics.extraSpirits = (state.deckMechanics.extraSpirits || 0) + 1;
            state.deckMechanics.spiritCount = state.deckMechanics.extraSpirits;
            break;
          case 'synchronized_fire':
            state.deckMechanics.synchronizedFire = true;
            break;
          case 'cinder_lord':
            state.deckMechanics.cinderLord = true;
            break;
          case 'executioner':
            state.deckMechanics.executionerMult = (state.deckMechanics.executionerMult || 0) + (p.executionerMult || 0.7);
            break;
          case 'quickdraw_charge':
            // 충전형: 스테이지 시작마다 즉시 발사 화염구 충전 (중첩 시 합산)
            state.deckMechanics.quickdrawCharges = (state.deckMechanics.quickdrawCharges || 0) + (p.charges || 4);
            break;
          case 'meteor_charge':
            // 충전형: 스테이지 시작마다 메테오 강화 충전 (중첩 시 충전 횟수 합산)
            state.deckMechanics.meteorCharges = (state.deckMechanics.meteorCharges || 0) + (p.charges || 3);
            state.deckMechanics.meteorChargeBonus = p.damageBonus || 1.5;
            break;
          case 'patch_boost':
            state.deckMechanics.patchCooldownMult = (state.deckMechanics.patchCooldownMult || 1) * (p.cooldownMult || 0.7);
            state.deckMechanics.patchDamageBonus = (state.deckMechanics.patchDamageBonus || 0) + (p.damageBonus || 0.4);
            break;
          case 'wildfire':
            state.deckMechanics.igniteRatioMult = p.igniteRatioMult || 2.5;
            break;
          case 'phoenix_reset':
            state.deckMechanics.phoenixReset = true;
            state.deckMechanics.phoenixAwake = true;
            break;
        }
      }
    };

    return card;
  }

  // 런타임 카드 풀 배열
  const CARD_POOL = [];

  function setCardPoolFromRaw(rawList) {
    CARD_POOL.length = 0;
    const list = Array.isArray(rawList) ? rawList : (rawList && Array.isArray(rawList.cards) ? rawList.cards : []);
    for (const raw of list) {
      CARD_POOL.push(buildCardFromData(raw));
    }
  }

  // Node.js 환경에서 JSON 동기 로드
  let initialRaw = DEFAULT_CARDS_RAW;
  if (typeof require !== 'undefined' && typeof __dirname !== 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const jsonPath = path.join(__dirname, '../data/roguelike-cards.json');
      if (fs.existsSync(jsonPath)) {
        initialRaw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    } catch (e) {
      initialRaw = DEFAULT_CARDS_RAW;
    }
  }
  setCardPoolFromRaw(initialRaw);

  // 브라우저 환경에서 실시간 JSON 파일 비동기 로드
  async function loadCardsFromJSON() {
    if (typeof fetch === 'undefined') return false;
    try {
      // 캐싱 방지용 타임스탬프 쿼리 적용 -> JSON 수정 후 새로고침 시 즉시 반영!
      const res = await fetch('src/data/roguelike-cards.json?v=' + Date.now());
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json) ? json : (json && Array.isArray(json.cards) ? json.cards : null);
        if (list && list.length > 0) {
          setCardPoolFromRaw(list);
          console.log(`[RoguelikeDeck] 📜 ${list.length}종의 카드를 roguelike-cards.json에서 성공적으로 로드했습니다.`);
          if (typeof window !== 'undefined') {
            if (typeof window.renderDeckStripUI === 'function') {
              window.renderDeckStripUI();
            }
            window.dispatchEvent(new CustomEvent('deck-cards-updated', { detail: list }));
          }
          return true;
        }
      }
    } catch (err) {
      console.warn('[RoguelikeDeck] JSON 파일 비동기 로드 실패 (기본 fallback 카드셋 유지):', err.message);
    }
    return false;
  }

  // 브라우저 환경이면 즉시 비동기 로드 시도
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    loadCardsFromJSON();
  }

  // 런(Run) 단위 덱 관리자 객체
  function createDeckManager() {
    let activeDeck = {};       // { cardId: count }
    let rerollCount = 0;       // 현재 3지선다 내 리롤 횟수
    let currentChoices = [];   // 현재 제시된 3장의 카드

    // 리롤 비용: 기준 비용(현재 스테이지 처치 골드) x (1 + 이번 선택에서 리롤한 횟수)
    function getRerollCost(baseCost = 10) {
      return Math.max(1, Math.round(baseCost * (1 + rerollCount)));
    }

    // 3장의 카드 무작위 추첨
    function drawChoices(count = 3, isBossWave = false, gameState = null) {
      // 1. 뽑을 수 있는 유효 카드 필터링 (최대 중첩 미달성 카드, 이미 습득한 주문서, 선행 조건 미충족 카드 제외)
      const st = gameState || (typeof state !== 'undefined' ? state : null);
      const eligible = CARD_POOL.filter(card => {
        const currentCount = activeDeck[card.id] || 0;
        if (currentCount >= card.maxStack) return false;
        if (card.spellKey && st && st.grimoires && st.grimoires[card.spellKey]) return false;
        if (typeof card.req === 'function') {
          if (!card.req(st, activeDeck)) return false;
        }
        return true;
      });

      if (eligible.length === 0) return [];

      // 등급 가중치 설정 (보스 웨이브는 고급 등급 우대, 일반 웨이브는 일반 카드 중심 빌드업)
      const weights = isBossWave
        ? { [RARITY.COMMON]: 0, [RARITY.RARE]: 85, [RARITY.LEGENDARY]: 15 }
        : { [RARITY.COMMON]: 75, [RARITY.RARE]: 21, [RARITY.LEGENDARY]: 4 };

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
    function reroll(gameState, isBossWave = false, baseCost = 10) {
      const cost = getRerollCost(baseCost);
      if ((gameState.gold || 0) < cost) {
        return { success: false, reason: '골드가 부족합니다.' };
      }

      gameState.gold -= cost;
      rerollCount++;
      const newChoices = drawChoices(3, isBossWave, gameState);

      return {
        success: true,
        newCost: getRerollCost(baseCost),
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

    // 획득한 카드 목록 반환 (UI 노출용)
    function getActiveCards() {
      return Object.entries(activeDeck).map(([id, count]) => {
        const card = CARD_POOL.find(c => c.id === id);
        return {
          id,
          count,
          title: card ? card.title : id,
          icon: card ? card.icon : '🃏',
          rarity: card ? card.rarity : RARITY.COMMON,
          build: card ? card.build : BUILD.UTILITY,
          maxStack: card ? (card.maxStack || 1) : 1,
          desc: card ? (card.desc || '') : '',
          stats: card ? card.stats : null,
          mechanic: card ? card.mechanic : null,
          spellKey: card ? card.spellKey : null
        };
      });
    }

    // 저장 데이터로부터 덱 복원
    function restoreDeck(savedDeck, gameState) {
      resetDeck(gameState);
      if (!savedDeck || typeof savedDeck !== 'object') return;

      for (const [cardId, count] of Object.entries(savedDeck)) {
        const card = CARD_POOL.find(c => c.id === cardId);
        if (card) {
          for (let i = 0; i < count; i++) {
            activeDeck[card.id] = (activeDeck[card.id] || 0) + 1;
            if (typeof card.apply === 'function') {
              card.apply(gameState);
            }
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
    createDeckManager,
    buildCardFromData,
    setCardPoolFromRaw,
    loadCardsFromJSON
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = roguelikeDeckModule;
  }
  if (typeof window !== 'undefined') {
    global.RoguelikeDeck = roguelikeDeckModule;
  }
})(typeof window !== 'undefined' ? window : global);
