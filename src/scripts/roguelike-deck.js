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
    [RARITY.COMMON]: { name: typeof tr === 'function' ? tr('일반') : '일반', color: '#94a3b8', border: '#475569', bg: 'rgba(30, 41, 59, 0.9)', badge: '#64748b' },
    [RARITY.RARE]: { name: typeof tr === 'function' ? tr('희귀') : '희귀', color: '#38bdf8', border: '#0284c7', bg: 'rgba(12, 74, 110, 0.9)', badge: '#0369a1' },
    [RARITY.LEGENDARY]: { name: typeof tr === 'function' ? tr('전설') : '전설', color: '#fbbf24', border: '#d97706', bg: 'rgba(120, 53, 15, 0.9)', badge: '#b45309' }
  };

  // 빌드 카테고리
  const BUILD = {
    SPELL: 'spell',           // 고대 주문서 (빌드가 갈라지는 축)
    CRIT: 'crit',             // 극치명타 몰열 (열기·메테오)
    COMBUSTION: 'combustion', // 마력 폭주 극딜 (업화 2단계에 열림)
    RAPID: 'rapid',           // 속사 머신건
    SUMMON: 'summon',         // 화염 정령 군단
    BURN: 'burn',             // 화상 확산 (지속 피해)
    UTILITY: 'utility'        // 유틸리티 및 특수
  };

  // 빌드 가중 추첨(개편안 2.5): 주문서·유틸리티를 뺀 빌드 중 가장 많이 가진 빌드(카드 2장 이상)가 주력 빌드입니다.
  // 주력 빌드 카드는 등급 가중치 ×1.8, 두 번째 빌드는 ×1.3으로 더 자주 나오고, 일반 웨이브 3장 선택지에는 주력 빌드 카드가 1장 이상 섞입니다.
  // 나머지 칸은 지금처럼 무작위라 빌드를 갈아탈 여지가 남습니다.
  const MAIN_BUILD_MIN_CARDS = 2;
  const MAIN_BUILD_WEIGHT = 1.8;
  const SECOND_BUILD_WEIGHT = 1.3;
  const NON_PLAN_BUILDS = [BUILD.SPELL, BUILD.UTILITY];

  // 선행 조건 crit_15_or_combustion: 카드를 받은 뒤 남아야 하는 최소 치명타율(%)
  const CRIT_FLOOR_AFTER_CARD = 15;

  // 기본 내장 카드 데이터는 roguelike-cards.json과 동일하게 유지합니다. (file:// 실행 시 fallback)
  const DEFAULT_CARDS_RAW = [
    {
      "id": "rapid_spark",
      "title": "신속의 불꽃",
      "icon": "⚡",
      "rarity": "common",
      "build": "rapid",
      "maxStack": 3,
      "desc": "화염 마법 시전 속도가 <b>+30%</b> 빨라집니다.",
      "title_en": "Swift Flame",
      "desc_en": "Fire spell cast speed <b>+30%</b>.",
      "stats": {
        "haste": 30
      },
      "links": [
        "rapid_split",
        "sum_volley",
        "util_glass_cannon"
      ]
    },
    {
      "id": "rapid_split",
      "title": "분열 화염구",
      "icon": "💥",
      "rarity": "rare",
      "build": "rapid",
      "maxStack": 3,
      "desc": "화염구 적중 시 <b>2개의 작은 불씨</b>로 분열되어 추가 타격합니다 (각각 40% 피해).",
      "title_en": "Splitting Fireball",
      "desc_en": "Fireball splits into <b>2 small embers</b> on hit for extra strikes (40% damage each).",
      "mechanic": "split_fireball",
      "links": [
        "rapid_spark",
        "rapid_quickdraw",
        "rapid_gatling",
        "crit_focus"
      ]
    },
    {
      "id": "rapid_overload",
      "title": "과부하 시전",
      "icon": "🌀",
      "rarity": "rare",
      "build": "rapid",
      "maxStack": 2,
      "desc": "시전 속도가 <b>+45%</b> 빨라지지만, 주문력이 <b>-20%</b> 감소합니다.",
      "title_en": "Overload Casting",
      "desc_en": "Cast speed <b>+45%</b>, but Spell Power <b>-20%</b>.",
      "stats": {
        "spPct": -20,
        "haste": 45
      },
      "links": [
        "util_glass_cannon"
      ]
    },
    {
      "id": "rapid_quickdraw",
      "title": "속사 장전",
      "icon": "🎇",
      "rarity": "rare",
      "build": "rapid",
      "maxStack": 2,
      "desc": "스테이지 시작마다 화염구를 <b>시전 없이 즉시 발사</b>하는 충전을 <b>4회</b> 얻습니다.",
      "title_en": "Quickdraw",
      "desc_en": "Gain <b>4</b> charges at the start of each stage that <b>fire a Fireball instantly, with no cast time</b>.",
      "mechanic": "quickdraw_charge",
      "links": [
        "rapid_split"
      ],
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
      "title_en": "Flame Gatling",
      "desc_en": "Fireball base cast time drops to <b>0.3s</b> — fire it like a machine gun.",
      "mechanic": "gatling_mode",
      "links": [
        "rapid_split",
        "sum_volley"
      ]
    },
    {
      "id": "spell_fireblast",
      "title": "주문서: 불꽃 작렬",
      "icon": "💥",
      "rarity": "common",
      "build": "spell",
      "maxStack": 1,
      "desc": "시전 중에도 즉시 발사되는 <b>100% 확정 치명타 보조 마법 [불꽃 작렬]</b>을 습득합니다. 화염구 치명타 직후에 쓰면 치명타 2연속이 됩니다.",
      "title_en": "Grimoire: Fire Blast",
      "desc_en": "Learn <b>[Fire Blast], an instant spell that always crits</b> and fires even while casting. Use it right after a Fireball crit for 2 crits in a row.",
      "spellKey": "fireblast",
      "links": [
        "crit_heat",
        "spell_meteor",
        "util_auto_grimoire"
      ]
    },
    {
      "id": "crit_focus",
      "title": "타오르는 집중",
      "icon": "🎯",
      "rarity": "common",
      "build": "crit",
      "maxStack": 3,
      "desc": "치명타 확률이 <b>+15%</b> 증가합니다.",
      "title_en": "Burning Focus",
      "desc_en": "Critical strike chance <b>+15%</b>.",
      "stats": {
        "crit": 15
      },
      "links": [
        "rapid_split",
        "crit_heat",
        "crit_reckless",
        "spell_meteor",
        "burn_wildfire"
      ]
    },
    {
      "id": "crit_heat",
      "title": "작열하는 열기",
      "icon": "🔥",
      "rarity": "common",
      "build": "crit",
      "maxStack": 3,
      "desc": "치명타 피해량이 <b>+50%</b> 증가합니다.",
      "title_en": "Searing Heat",
      "desc_en": "Critical damage <b>+50%</b>.",
      "stats": {
        "critDmg": 50
      },
      "links": [
        "spell_fireblast",
        "crit_focus",
        "spell_combustion",
        "burn_wildfire"
      ]
    },
    {
      "id": "crit_reckless",
      "title": "무모한 일격",
      "icon": "🗡️",
      "rarity": "rare",
      "build": "combustion",
      "maxStack": 2,
      "desc": "치명타 피해량이 <b>+80%</b> 증가하지만, 치명타 확률이 <b>-8%</b> 감소합니다.",
      "title_en": "Reckless Strike",
      "desc_en": "Critical damage <b>+80%</b>, but critical strike chance <b>-8%</b>.",
      "stats": {
        "crit": -8,
        "critDmg": 80
      },
      "prerequisite": "crit_15_or_combustion",
      "links": [
        "crit_focus",
        "spell_combustion"
      ]
    },
    {
      "id": "spell_meteor",
      "title": "주문서: 메테오",
      "icon": "☄️",
      "rarity": "rare",
      "build": "spell",
      "maxStack": 1,
      "desc": "거대 운석을 떨어뜨립니다. <b>치명타 2연속</b>이면 메테오가 <b>즉시·무료</b>로 떨어집니다. 불꽃 작렬은 항상 치명타입니다.",
      "title_en": "Grimoire: Meteor",
      "desc_en": "Call down a giant meteor. Land <b>2 crits in a row</b> and Meteor drops <b>instantly, for free</b>. Fire Blast always crits.",
      "spellKey": "meteor",
      "links": [
        "spell_fireblast",
        "crit_focus",
        "crit_meteor_storm",
        "crit_meteor_charge",
        "burn_ignite",
        "util_phoenix_reborn",
        "util_auto_grimoire"
      ]
    },
    {
      "id": "crit_meteor_storm",
      "title": "태양석 메테오",
      "icon": "☄️",
      "rarity": "rare",
      "build": "crit",
      "maxStack": 2,
      "desc": "메테오의 재사용 대기시간이 <b>50% 감소</b>하고 피해량이 <b>+60%</b> 증가합니다.",
      "title_en": "Sunstone Meteor",
      "desc_en": "Meteor cooldown <b>-50%</b> and Meteor damage <b>+60%</b>.",
      "prerequisite": "has_meteor",
      "mechanic": "meteor_buff",
      "links": [
        "spell_meteor"
      ]
    },
    {
      "id": "crit_meteor_charge",
      "title": "잠열 충전",
      "icon": "🔋",
      "rarity": "rare",
      "build": "crit",
      "maxStack": 2,
      "desc": "스테이지 시작마다 <b>메테오 피해 +150%</b> 충전을 <b>3회</b> 얻습니다.",
      "title_en": "Latent Heat",
      "desc_en": "Gain <b>3</b> charges of <b>+150% Meteor damage</b> at the start of each stage.",
      "prerequisite": "has_meteor",
      "mechanic": "meteor_charge",
      "links": [
        "spell_meteor"
      ],
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
      "build": "spell",
      "maxStack": 1,
      "desc": "<b>5초간 모든 마법이 100% 치명타</b>로 적중하고 시전 속도가 빨라지는 궁극기를 습득합니다.",
      "title_en": "Grimoire: Combustion",
      "desc_en": "Learn an ultimate: for <b>5s, every spell crits 100%</b> and you cast faster.",
      "spellKey": "combustion",
      "links": [
        "crit_heat",
        "crit_reckless",
        "crit_crimson_frenzy",
        "util_phoenix_reborn",
        "util_auto_grimoire"
      ]
    },
    {
      "id": "crit_crimson_frenzy",
      "title": "진홍의 마력 폭주",
      "icon": "👑",
      "rarity": "legendary",
      "build": "combustion",
      "maxStack": 1,
      "desc": "마력 폭주 지속 시간이 2배가 되며, 폭주 중 모든 공격 피해가 <b>150% 증폭</b>됩니다.",
      "title_en": "Crimson Combustion",
      "desc_en": "Combustion lasts twice as long, and all damage during it is <b>amplified by 150%</b>.",
      "prerequisite": "has_combustion",
      "mechanic": "combustion_god",
      "links": [
        "spell_combustion"
      ]
    },
    {
      "id": "sum_spirit",
      "title": "화염 정령 소환",
      "icon": "🧞",
      "rarity": "common",
      "build": "summon",
      "maxStack": 4,
      "desc": "플레이어 옆에 지속 화염 공격을 퍼붓는 <b>화염 정령 1기</b>를 소환합니다 (최대 4기).",
      "title_en": "Summon Fire Spirit",
      "desc_en": "Summon <b>1 Fire Spirit</b> that pours fire beside you (up to 4).",
      "mechanic": "extra_spirit",
      "links": [
        "sum_fury",
        "sum_volley",
        "sum_pact",
        "sum_cinder_lord"
      ]
    },
    {
      "id": "sum_fury",
      "title": "정령의 분노",
      "icon": "😤",
      "rarity": "common",
      "build": "summon",
      "maxStack": 3,
      "desc": "정령·불사조 등 <b>소환수 피해량이 +30%</b> 증가합니다.",
      "title_en": "Spirit Fury",
      "desc_en": "<b>Summon damage +30%</b> (Fire Spirits, Phoenix).",
      "stats": {
        "spiritPct": 30
      },
      "prerequisite": "has_summon",
      "links": [
        "sum_spirit"
      ]
    },
    {
      "id": "sum_volley",
      "title": "일제 협공 사격",
      "icon": "🏹",
      "rarity": "rare",
      "build": "summon",
      "maxStack": 1,
      "desc": "마법사가 화염구를 발사할 때마다 <b>소환된 모든 정령이 동시에 협공 탄환</b>을 발사합니다.",
      "title_en": "Synchronized Volley",
      "desc_en": "Every time you cast Fireball, <b>all summoned spirits fire a volley at once</b>.",
      "prerequisite": "has_summon",
      "mechanic": "synchronized_fire",
      "links": [
        "rapid_spark",
        "rapid_gatling",
        "sum_spirit"
      ]
    },
    {
      "id": "sum_pact",
      "title": "정령 계약",
      "icon": "🤝",
      "rarity": "rare",
      "build": "summon",
      "maxStack": 1,
      "desc": "소환수 피해량이 <b>+100%</b> 증가하지만, 마법사의 주문력이 <b>-25%</b> 감소합니다.",
      "title_en": "Spirit Pact",
      "desc_en": "Summon damage <b>+100%</b>, but your Spell Power <b>-25%</b>.",
      "stats": {
        "spPct": -25,
        "spiritPct": 100
      },
      "prerequisite": "has_summon",
      "links": [
        "sum_spirit",
        "sum_cinder_lord"
      ]
    },
    {
      "id": "sum_cinder_lord",
      "title": "잿더미 군단장",
      "icon": "👹",
      "rarity": "legendary",
      "build": "summon",
      "maxStack": 1,
      "desc": "소환수 1기당 마법사의 모든 주문 피해량이 <b>+30%</b> 증폭됩니다.",
      "title_en": "Cinder Warlord",
      "desc_en": "All your spell damage <b>+30%</b> per active summon.",
      "prerequisite": "has_summon",
      "mechanic": "cinder_lord",
      "links": [
        "sum_spirit",
        "sum_pact"
      ]
    },
    {
      "id": "burn_ignite",
      "title": "맹렬한 화상",
      "icon": "🩸",
      "rarity": "common",
      "build": "burn",
      "maxStack": 3,
      "desc": "화상·연소·불장판 등 <b>지속 피해량이 +40%</b> 증가합니다.",
      "title_en": "Fierce Ignite",
      "desc_en": "<b>Damage over time +40%</b> (Ignite, Meteor burn, Flame Patch).",
      "stats": {
        "burnPct": 40
      },
      "links": [
        "spell_meteor",
        "spell_flame_patch",
        "burn_wildfire"
      ]
    },
    {
      "id": "spell_flame_patch",
      "title": "주문서: 불장판",
      "icon": "🌋",
      "rarity": "rare",
      "build": "spell",
      "maxStack": 1,
      "desc": "몬스터 발밑에 지속적인 화염 지대를 생성하여 <b>강력한 화상 도트 피해</b>를 입힙니다.",
      "title_en": "Grimoire: Flame Patch",
      "desc_en": "Create a lasting fire zone under the monster that deals <b>heavy burning damage over time</b>.",
      "spellKey": "flame_patch",
      "links": [
        "burn_ignite",
        "burn_spread",
        "util_phoenix_reborn",
        "util_auto_grimoire"
      ]
    },
    {
      "id": "burn_spread",
      "title": "번지는 불길",
      "icon": "♨️",
      "rarity": "rare",
      "build": "burn",
      "maxStack": 2,
      "desc": "불장판 재사용 대기시간이 <b>30% 감소</b>하고 불장판 피해량이 <b>+50%</b> 증가합니다.",
      "title_en": "Spreading Blaze",
      "desc_en": "Flame Patch cooldown <b>-30%</b> and Flame Patch damage <b>+50%</b>.",
      "prerequisite": "has_flame_patch",
      "mechanic": "patch_boost",
      "links": [
        "spell_flame_patch"
      ],
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
      "desc": "<b>모든 적중이 화상</b>을 남기고, 치명타가 남기는 <b>화상 피해는 6배</b>로 불어납니다. 쓰러진 적의 <b>남은 화상은 다음 적에게 번집니다</b>.",
      "title_en": "Wildfire",
      "desc_en": "<b>Every hit leaves Ignite</b>, and Ignite from critical strikes deals <b>6x damage</b>. Leftover Ignite <b>spreads to the next enemy</b>.",
      "mechanic": "wildfire",
      "links": [
        "crit_focus",
        "crit_heat",
        "burn_ignite"
      ],
      "mechanicParams": {
        "igniteRatioMult": 6,
        "igniteOnAllHits": true,
        "igniteCarryOver": true
      }
    },
    {
      "id": "util_power",
      "title": "마력 증폭",
      "icon": "🔮",
      "rarity": "common",
      "build": "utility",
      "maxStack": 3,
      "desc": "주문력이 <b>+22%</b> 증가합니다.",
      "title_en": "Arcane Amplify",
      "desc_en": "Spell Power <b>+22%</b>.",
      "stats": {
        "spPct": 22
      },
      "links": [
        "util_executioner"
      ]
    },
    {
      "id": "util_executioner",
      "title": "처형인의 불꽃",
      "icon": "☠️",
      "rarity": "rare",
      "build": "utility",
      "maxStack": 2,
      "desc": "체력이 40% 이하인 적에게 입히는 모든 피해량이 <b>+70%</b> 증가합니다.",
      "title_en": "Executioner's Flame",
      "desc_en": "All damage to enemies at or below 40% health <b>+70%</b>.",
      "mechanic": "executioner",
      "links": [
        "util_power"
      ],
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
      "title_en": "Glass Cannon",
      "desc_en": "Spell Power <b>+50%</b>, but cast speed <b>-25%</b>.",
      "stats": {
        "spPct": 50,
        "haste": -25
      },
      "links": [
        "rapid_spark",
        "rapid_overload"
      ]
    },
    {
      "id": "util_phoenix_reborn",
      "title": "불사조의 가호",
      "icon": "🪶",
      "rarity": "legendary",
      "build": "utility",
      "maxStack": 1,
      "desc": "<b>불사조</b>가 함께 싸우며 확정 치명타로 협공하고, 치명타 적중 시 <b>10% 확률로 모든 스킬 쿨다운</b>이 초기화됩니다.",
      "title_en": "Phoenix's Blessing",
      "desc_en": "A <b>Phoenix</b> fights at your side with guaranteed crits, and your crits have a <b>10% chance to reset all skill cooldowns</b>.",
      "prerequisite": "has_any_spell",
      "mechanic": "phoenix_reset",
      "links": [
        "spell_meteor",
        "spell_combustion",
        "spell_flame_patch"
      ]
    },
    {
      "id": "util_auto_grimoire",
      "title": "자동 영창",
      "icon": "🤖",
      "rarity": "legendary",
      "build": "utility",
      "maxStack": 1,
      "desc": "화염구 외 모든 주문(불꽃 작렬·메테오·마력 폭주·불장판)이 <b>최적의 순간에 자동 시전</b>됩니다. 주문 칸의 <b>AUTO</b>를 눌러 주문별로 끄고 켤 수 있습니다.",
      "title_en": "Auto-Incantation",
      "desc_en": "Every spell besides Fireball (Fire Blast, Meteor, Combustion, Flame Patch) <b>casts itself at the perfect moment</b>. Tap a slot's <b>AUTO</b> tag to toggle each spell.",
      "prerequisite": "has_any_spell",
      "mechanic": "smart_autocast",
      "links": [
        "spell_fireblast",
        "spell_meteor",
        "spell_combustion",
        "spell_flame_patch"
      ]
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
    } else if (raw.prerequisite === 'crit_15_or_combustion') {
      // 치명타율을 깎는 카드는 받은 뒤에도 치명타율이 15% 이상 남거나, 마력 폭주를 가졌을 때만 나옵니다.
      // 기본 치명타율(5%)에서 바로 고르면 0%가 되어 치명타 피해 증가와 몰아치는 열기가 모두 죽는 함정이 되지만,
      // 마력 폭주(치명타 100%) 중에는 치명타 피해 증가가 그대로 살아나 강한 카드가 됩니다(시뮬레이션 2026-10-20).
      card.req = (st, deck) => {
        if ((deck && deck['spell_combustion'] > 0) || (st && st.grimoires && st.grimoires.combustion)) return true;
        const baseCrit = typeof BASE_CRIT === 'number' ? BASE_CRIT : 5;
        const bonusCrit = (st && st.playerStatsBonus && st.playerStatsBonus.crit) || 0;
        return baseCrit + bonusCrit + ((raw.stats && raw.stats.crit) || 0) >= CRIT_FLOOR_AFTER_CARD;
      };
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
          // 플레이어가 드래그로 정한 선호 배치가 있으면 그 자리에 넣습니다(game.js insertSpellByPreference).
          if (typeof insertSpellByPreference === 'function') insertSpellByPreference(raw.spellKey, (state.meta && state.meta.slotOrder) || []);
          else state.spellOrder.push(raw.spellKey);
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
            state.deckMechanics.igniteRatioMult = p.igniteRatioMult || 6;
            state.deckMechanics.igniteOnAllHits = !!p.igniteOnAllHits;
            state.deckMechanics.igniteCarryOver = !!p.igniteCarryOver;
            break;
          case 'phoenix_reset':
            state.deckMechanics.phoenixReset = true;
            state.deckMechanics.phoenixAwake = true;
            break;
          case 'smart_autocast':
            // 화염구 외 주문도 최적의 순간에 자동 시전(game.js runSmartAutoCast)
            state.deckMechanics.smartAutoCast = true;
            if (typeof updateSkillActionBarVisibility === 'function') updateSkillActionBarVisibility();
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
    let pickSeq = {};          // { cardId: 마지막으로 고른 순번 } — 주력 빌드 동률 판정(최근에 고른 빌드 우선)
    let pickCounter = 0;
    let rerollCount = 0;       // 현재 3지선다 내 리롤 횟수
    let currentChoices = [];   // 현재 제시된 3장의 카드

    // 리롤 비용: 기준 비용(현재 스테이지 처치 골드) x (1 + 이번 선택에서 리롤한 횟수)
    function getRerollCost(baseCost = 10) {
      return Math.max(1, Math.round(baseCost * (1 + rerollCount)));
    }

    // 빌드별 보유 장수(겹친 횟수 포함)와 가장 최근에 고른 순번. 주문서·유틸리티는 세지 않습니다.
    function getBuildStanding() {
      const standing = {};
      const keys = Object.keys(activeDeck);
      keys.forEach((id, index) => {
        const card = CARD_POOL.find(c => c.id === id);
        if (!card || NON_PLAN_BUILDS.includes(card.build) || !(activeDeck[id] > 0)) return;
        const row = standing[card.build] || (standing[card.build] = { build: card.build, count: 0, recent: -1 });
        row.count += activeDeck[id];
        row.recent = Math.max(row.recent, pickSeq[id] !== undefined ? pickSeq[id] : index - keys.length);
      });
      return Object.values(standing).sort((a, b) => b.count - a.count || b.recent - a.recent);
    }

    // 주력 빌드(2장 이상)와 두 번째 빌드. 없으면 null.
    function getMainBuilds() {
      const ranked = getBuildStanding();
      const main = ranked[0] && ranked[0].count >= MAIN_BUILD_MIN_CARDS ? ranked[0].build : null;
      const second = main && ranked[1] ? ranked[1].build : null;
      return { main, second };
    }

    function getBuildWeightMult(build, plan) {
      if (plan.main && build === plan.main) return MAIN_BUILD_WEIGHT;
      if (plan.second && build === plan.second) return SECOND_BUILD_WEIGHT;
      return 1;
    }

    // 가중치에 비례해 한 장을 뽑습니다(가중치 0 이하는 제외).
    function pickWeighted(list, weightOf) {
      const valid = list.filter(c => weightOf(c) > 0);
      if (valid.length === 0) return null;
      const total = valid.reduce((sum, c) => sum + weightOf(c), 0);
      let rand = Math.random() * total;
      for (const c of valid) {
        const w = weightOf(c);
        if (rand < w) return c;
        rand -= w;
      }
      return valid[valid.length - 1];
    }

    // 3장의 카드 무작위 추첨
    function drawChoices(count = 3, isBossWave = false, gameState = null) {
      // 1. 뽑을 수 있는 유효 카드 필터링 (최대 중첩 미달성 카드, 이미 습득한 주문서, 선행 조건 미충족 카드 제외)
      const st = gameState || (typeof state !== 'undefined' ? state : null);
      const eligible = CARD_POOL.filter(card => {
        const currentCount = activeDeck[card.id] || 0;
        if (currentCount >= card.maxStack) return false;
        if (card.spellKey && st && st.grimoires && st.grimoires[card.spellKey]) return false;
        // 마도서 숙련도로 아직 열지 못한 카드(meta-progression.js)
        if (st && Array.isArray(st.lockedCards) && st.lockedCards.includes(card.id)) return false;
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

      const plan = getMainBuilds();
      const rarityWeight = (c) => (weights[c.rarity] !== undefined ? weights[c.rarity] : 10);
      const weightOf = (c) => rarityWeight(c) * getBuildWeightMult(c.build, plan);
      const selected = [];
      const poolCopy = [...eligible];

      while (selected.length < count && poolCopy.length > 0) {
        const chosenCard = pickWeighted(poolCopy, weightOf);
        if (!chosenCard) break;
        selected.push(chosenCard);
        poolCopy.splice(poolCopy.indexOf(chosenCard), 1);
      }

      // 주력 빌드 1장 보장: 일반 웨이브 3장 선택지에 주력 빌드 카드가 없으면 마지막 장을 주력 빌드 카드로 바꿉니다.
      if (!isBossWave && plan.main && count >= 3 && selected.length >= 3 && !selected.some(c => c.build === plan.main)) {
        const mainCard = pickWeighted(poolCopy.filter(c => c.build === plan.main), weightOf);
        if (mainCard) {
          poolCopy.push(selected[selected.length - 1]);
          selected[selected.length - 1] = mainCard;
          poolCopy.splice(poolCopy.indexOf(mainCard), 1);
        }
      }

      // 보스 보상 전설 보장: 아직 전설 카드가 없으면 마지막 한 장을 전설로 바꿔 내놓습니다.
      // 전설을 10스테이지까지 하나도 못 얻은 런이 얻은 런보다 5분 가까이 느려(시뮬레이션) 기록이 운에 좌우되던 문제를 줄입니다.
      // 고르는 것은 여전히 플레이어이고, 이미 전설을 가진 런·전설이 잠긴 첫 런에는 영향이 없습니다.
      // 자동 영창(smart_autocast)은 피해를 올리지 않는 편의 전설이라, 골라도 보장이 끝나지 않습니다(피해 전설을 놓치는 손해 없음).
      const holdsLegendary = CARD_POOL.some(c => c.rarity === RARITY.LEGENDARY && c.mechanic !== 'smart_autocast' && (activeDeck[c.id] || 0) > 0);
      if (isBossWave && !holdsLegendary && selected.length > 0 && !selected.some(c => c.rarity === RARITY.LEGENDARY)) {
        const legendaryPool = poolCopy.filter(c => c.rarity === RARITY.LEGENDARY);
        // 해금된 주력 빌드 전설이 있으면 그 전설을 우선 내놓습니다.
        const mainLegendary = plan.main ? legendaryPool.filter(c => c.build === plan.main) : [];
        const fromPool = mainLegendary.length > 0 ? mainLegendary : legendaryPool;
        if (fromPool.length > 0) {
          selected[selected.length - 1] = fromPool[Math.floor(Math.random() * fromPool.length)];
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
      pickSeq[card.id] = ++pickCounter;
      rerollCount = 0; // 리롤 횟수 초기화
      currentChoices = [];

      // 효과 적용
      if (typeof card.apply === 'function') {
        card.apply(gameState);
      }

      return true;
    }

    // 리롤 수행 (골드 차감 성공 시)
    function reroll(gameState, isBossWave = false, baseCost = 10, count = 3) {
      const cost = getRerollCost(baseCost);
      if ((gameState.gold || 0) < cost) {
        return { success: false, reason: typeof tr === 'function' ? tr('골드가 부족합니다.') : '골드가 부족합니다.' };
      }

      gameState.gold -= cost;
      rerollCount++;
      const newChoices = drawChoices(count, isBossWave, gameState);

      return {
        success: true,
        newCost: getRerollCost(baseCost),
        choices: newChoices
      };
    }

    // 덱 초기화 (회차 승천/리셋 시)
    function resetDeck(gameState) {
      activeDeck = {};
      pickSeq = {};
      pickCounter = 0;
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
          title_en: card ? card.title_en : undefined,
          desc_en: card ? card.desc_en : undefined,
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
          // 겹치기 상한이 줄어든 카드(수치 카드 5 → 3)는 구형 세이브에서도 상한까지만 복원합니다.
          const restoreCount = Math.min(Math.max(0, Math.floor(Number(count) || 0)), card.maxStack || 1);
          for (let i = 0; i < restoreCount; i++) {
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
      getMainBuilds,
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
