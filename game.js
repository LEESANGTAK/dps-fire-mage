/**
 * 마법사 토벌전: 간소화 UI & 앱 알림(!) 배지 온보딩 버전 (v0.7)
 * - 요구 DPS 충족 시에만 다음 스테이지 도전 활성화 (미충족 시 이동 불가)
 * - 몬스터 아바타 하단에 몬스터 이름 표시 (불필요한 조작 힌트 텍스트 제거)
 * - 텍스트 설명 배너 대신 직관적인 느낌표(!) 알림 배지로 다음 행동 유도
 */

const SAVE_KEY = 'MAGE_SLAYER_STAGE_SAVE_V7';

// ==========================================
// 1. 스테이지 몬스터 데이터베이스 (5스테이지 = 1페이즈)
// ==========================================
const STAGE_MONSTERS = [
  // PHASE 1 (Stage 1 ~ 5)
  { stage: 1, name: '초원 풀숲 슬라임', emoji: '🟢', hp: 50, timeLimit: 25, gold: 4, firstBonus: 2 },
  { stage: 2, name: '푸른 늪지 슬라임', emoji: '🔵', hp: 110, timeLimit: 25, gold: 7, firstBonus: 4 },
  { stage: 3, name: '들판 거대 들쥐', emoji: '🐀', hp: 240, timeLimit: 25, gold: 12, firstBonus: 8 },
  { stage: 4, name: '고블린 정찰병', emoji: '👺', hp: 480, timeLimit: 25, gold: 20, firstBonus: 14 },
  { stage: 5, name: '붉은송곳니 군주', emoji: '🐗', hp: 1000, timeLimit: 28, gold: 35, firstBonus: 35 },

  // PHASE 2 (Stage 6 ~ 10)
  { stage: 6, name: '잿빛 숲 늑대', emoji: '🐺', hp: 2400, timeLimit: 25, gold: 52, firstBonus: 40 },
  { stage: 7, name: '놀 야수사냥꾼', emoji: '🏹', hp: 4000, timeLimit: 25, gold: 80, firstBonus: 60 },
  { stage: 8, name: '폐광 해골 광부', emoji: '💀', hp: 6600, timeLimit: 25, gold: 125, firstBonus: 90 },
  { stage: 9, name: '맹독 모래전갈', emoji: '🦂', hp: 10800, timeLimit: 25, gold: 190, firstBonus: 140 },
  { stage: 10, name: '동굴 오우거 대족장', emoji: '👹', hp: 18500, timeLimit: 28, gold: 300, firstBonus: 260 },

  // PHASE 3 (Stage 11 ~ 15)
  { stage: 11, name: '화염 비늘 도마뱀', emoji: '🦎', hp: 29000, timeLimit: 25, gold: 460, firstBonus: 350 },
  { stage: 12, name: '심연 흡혈박쥐', emoji: '🦇', hp: 46000, timeLimit: 25, gold: 700, firstBonus: 500 },
  { stage: 13, name: '고대 바위 파수꾼', emoji: '🗿', hp: 74000, timeLimit: 25, gold: 1050, firstBonus: 800 },
  { stage: 14, name: '타락한 어둠마법사', emoji: '🧙', hp: 118000, timeLimit: 25, gold: 1600, firstBonus: 1200 },
  { stage: 15, name: '붉은 화염 비룡', emoji: '🐉', hp: 195000, timeLimit: 30, gold: 2500, firstBonus: 2200 },

  // PHASE 4 (Stage 16 ~ 20)
  { stage: 16, name: '저주받은 기사단원', emoji: '⚔️', hp: 310000, timeLimit: 25, gold: 3800, firstBonus: 3000 },
  { stage: 17, name: '원한 서린 밴시', emoji: '👻', hp: 490000, timeLimit: 25, gold: 5800, firstBonus: 4500 },
  { stage: 18, name: '지하군주 거대거미', emoji: '🕷️', hp: 780000, timeLimit: 25, gold: 8800, firstBonus: 7000 },
  { stage: 19, name: '심연의 파멸수호병', emoji: '👿', hp: 1250000, timeLimit: 25, gold: 13500, firstBonus: 11000 },
  { stage: 20, name: '화염군주 라그나로스', emoji: '🔥', hp: 2100000, timeLimit: 32, gold: 22000, firstBonus: 25000 }
];

function getStageData(stageNum) {
  const phase = Math.ceil(stageNum / 5);
  const stepInPhase = ((stageNum - 1) % 5) + 1;
  const isPhaseBoss = stepInPhase === 5;
  const hpMult = typeof state !== 'undefined' && state.heatPacts && state.heatPacts.iron_skin ? 1.5 : 1.0;

  if (stageNum <= STAGE_MONSTERS.length) {
    const raw = STAGE_MONSTERS[stageNum - 1];
    return {
      ...raw,
      hp: Math.round(raw.hp * hpMult),
      phase,
      stepInPhase,
      isPhaseBoss
    };
  }
  const base = STAGE_MONSTERS[STAGE_MONSTERS.length - 1];
  const extra = stageNum - STAGE_MONSTERS.length;
  const mult = Math.pow(1.58, extra);
  return {
    stage: stageNum,
    phase,
    stepInPhase,
    isPhaseBoss,
    name: isPhaseBoss ? `공허의 지배자 P.${phase}` : `공허의 정예병 Lv.${extra}`,
    emoji: isPhaseBoss ? '🌌' : '👾',
    hp: Math.round(base.hp * mult * hpMult),
    timeLimit: isPhaseBoss ? 32 : 25,
    gold: Math.round(base.gold * Math.pow(1.48, extra)),
    firstBonus: Math.round(base.firstBonus * Math.pow(1.48, extra))
  };
}

// ==========================================
// 2. 스킬 트리 (와우 스타일 3x3 특성 트리 노드 & 연결 구조)
// ==========================================
const SKILL_TREE_NODES = [
  // TIER 1 (Row 1)
  {
    id: 'fire_elem',
    tier: 1,
    row: 1,
    col: 1,
    reqTotalSp: 0,
    cost: 1,
    maxLv: 3,
    name: '불의 정령 소환',
    shortName: '불의 정령',
    icon: '🧞',
    desc: (lv) =>
      `불의 정령 상시 소환 (1.3초마다 주문 공격력의 ${lv === 0 ? 45 : lv * 45}% 화염탄 발사 및 화상 연장)`
  },
  {
    id: 'flame_patch',
    tier: 1,
    row: 1,
    col: 2,
    reqTotalSp: 0,
    cost: 1,
    maxLv: 3,
    name: '불장판',
    shortName: '불장판',
    icon: '♨️',
    desc: (lv) =>
      `[6] 불장판 스킬 사용 가능: 몬스터 아래쪽 바닥에 7초간 불장판을 깔아 0.5초마다 주문 공격력의 ${lv === 0 ? 40 : lv * 40}% 도트 피해 (쿨타임 10초)`
  },
  {
    id: 'phoenix',
    tier: 1,
    row: 1,
    col: 3,
    reqTotalSp: 0,
    cost: 1,
    maxLv: 3,
    name: '불사조 소환',
    shortName: '불사조',
    icon: '🦅',
    desc: (lv) =>
      `불사조 상시 소환 (2.4초마다 100% 치명타 섬광 ${lv === 0 ? 65 : lv * 65}% & 연쇄 폭발 유도)`
  },

  // TIER 2 (Row 2)
  {
    id: 'magma_golem',
    tier: 2,
    row: 2,
    col: 1,
    reqTotalSp: 1,
    cost: 1,
    maxLv: 3,
    name: '용암 골렘 소환',
    shortName: '용암 골렘',
    icon: '🗿',
    desc: (lv) =>
      `전열 용암 골렘 소환 (2.8초마다 대지 강타 ${lv === 0 ? 110 : lv * 110}% & 화상 피해 +${lv === 0 ? 15 : lv * 15}% 증폭)`
  },
  {
    id: 'multishot',
    tier: 2,
    row: 2,
    col: 2,
    reqTotalSp: 1,
    cost: 1,
    maxLv: 3,
    name: '갈래 화염구',
    shortName: '갈래 화염구',
    icon: '✨',
    desc: (lv) =>
      `화염구 시전 시 탄환이 ${lv === 0 ? 2 : lv + 1}발로 갈라져 직선 발사`
  },
  {
    id: 'rune_aura',
    tier: 2,
    row: 2,
    col: 3,
    reqTotalSp: 1,
    cost: 1,
    maxLv: 3,
    name: '고대 가속 마법진',
    shortName: '가속 마법진',
    icon: '⚡',
    desc: (lv) =>
      `마법사 및 모든 소환수의 공격·시전 속도 +${lv === 0 ? 18 : lv * 18}% 증가`
  },

  // TIER 3 (Row 3 - 궁극 특성)
  {
    id: 'legion_sync',
    tier: 3,
    row: 3,
    col: 1,
    reqTotalSp: 3,
    cost: 2,
    maxLv: 2,
    name: '태양왕의 군단 일제사격',
    shortName: '군단 일제사격',
    icon: '👑',
    desc: (lv) =>
      `몰열 메테오 발사 시 모든 소환수 즉시 일제 공격 & 소환수 피해 +${lv === 0 ? 50 : lv * 50}%`
  },
  {
    id: 'meteor_rain',
    tier: 3,
    row: 3,
    col: 3,
    reqTotalSp: 3,
    cost: 2,
    maxLv: 2,
    name: '종말의 유성우',
    shortName: '종말의 유성우',
    icon: '☄️',
    desc: (lv) =>
      `치명타 적중 시 ${lv === 0 ? 14 : lv * 14}% 확률로 미니 운석 자동 낙하`
  }
];

// 와우 특성 트리 노드 간 연결 화살표 정의 (from -> to)
const SKILL_TREE_LINKS = [
  { from: 'fire_elem', to: 'magma_golem' },
  { from: 'fire_elem', to: 'multishot' },
  { from: 'flame_patch', to: 'multishot' },
  { from: 'phoenix', to: 'rune_aura' },
  { from: 'phoenix', to: 'multishot' },
  { from: 'magma_golem', to: 'legion_sync' },
  { from: 'multishot', to: 'legion_sync' },
  { from: 'multishot', to: 'meteor_rain' },
  { from: 'rune_aura', to: 'meteor_rain' }
];

// ==========================================
// 3. 마법서 & 장비 상점 데이터
// ==========================================
const GRIMOIRE_LIST = [
  {
    id: 'autocast',
    name: '자동 시전 마법진',
    icon: '🤖',
    cost: 15,
    desc: '습득한 마법을 최적 시너지 순서로 자동 시전'
  },
  {
    id: 'fireblast',
    name: '마법서: 불꽃 작렬 [2]',
    icon: '💥',
    cost: 45,
    desc: '시전 중 즉시 발사 가능한 100% 확정 치명타 보조 마법'
  },
  {
    id: 'meteor',
    name: '마법서: 메테오 [3]',
    icon: '☄️',
    cost: 160,
    desc: '치명타 2연속 적중 시 대기시간 0초 즉시 발사'
  },
  {
    id: 'ignite',
    name: '비전서: 맹렬한 화상',
    icon: '🩸',
    cost: 520,
    desc: '치명타 화상(오렌지 도트) 피해량 2.2배 증폭 및 가속'
  },
  {
    id: 'combustion',
    name: '마법서: 마력 폭주 [4]',
    icon: '☀️',
    cost: 1800,
    desc: '기본 2초간 모든 마법 100% 치명타 & 시전 가속 (연마로 지속시간 연장)'
  }
];

const EQUIPMENT_LIST = [
  {
    id: 'oak_wand',
    name: '수습생의 참나무 완드',
    icon: '🪄',
    slot: 'weapon',
    baseCost: 8,
    costScale: 1.35,
    desc: '주문 공격력 +2',
    effect: (lv) => ({ sp: lv * 2 })
  },
  {
    id: 'ruby_ring',
    name: '구리빛 마력 반지',
    icon: '💍',
    slot: 'ring',
    baseCost: 22,
    costScale: 1.38,
    desc: '치명타 확률 +1.5% · 주문 공격력 +2',
    effect: (lv) => ({ crit: lv * 1.5, sp: lv * 2 })
  },
  {
    id: 'swift_gloves',
    name: '가죽 시전 장갑',
    icon: '🧤',
    slot: 'gloves',
    baseCost: 60,
    costScale: 1.4,
    desc: '시전 속도 +3% · 주문 공격력 +4',
    effect: (lv) => ({ haste: lv * 3, sp: lv * 4 })
  },
  {
    id: 'flame_orb',
    name: '붉은 화염 수정구',
    icon: '🔮',
    slot: 'orb',
    baseCost: 160,
    costScale: 1.42,
    desc: '치명타 피해 +8% · 주문 공격력 +9',
    effect: (lv) => ({ critDmg: lv * 0.08, sp: lv * 9 })
  },
  {
    id: 'sunfire_staff',
    name: '화염술사의 룬 지팡이',
    icon: '🔱',
    slot: 'weapon',
    baseCost: 450,
    costScale: 1.45,
    desc: '주문 공격력 +22 · 치명타 확률 +1.5%',
    effect: (lv) => ({ sp: lv * 22, crit: lv * 1.5 })
  },
  {
    id: 'chrono_watch',
    name: '마력 회중시계',
    icon: '⏳',
    slot: 'trinket',
    baseCost: 1250,
    costScale: 1.48,
    desc: '쿨타임 감소 +3% · 시전 속도 +3% · 주문 공격력 +55',
    effect: (lv) => ({ cdr: lv * 0.03, haste: lv * 3, sp: lv * 55 })
  },
  {
    id: 'firelord_crown',
    name: '화염군주의 보관',
    icon: '👑',
    slot: 'helm',
    baseCost: 3600,
    costScale: 1.5,
    desc: '주문 공격력 +140 · 치명타 피해 +12%',
    effect: (lv) => ({ sp: lv * 140, critDmg: lv * 0.12 })
  },
  {
    id: 'arcane_grail',
    name: '고대 불꽃의 성배',
    icon: '🏆',
    slot: 'relic',
    baseCost: 11000,
    costScale: 1.55,
    desc: '주문 공격력 +380 · 모든 마법 피해 +6%',
    effect: (lv) => ({ sp: lv * 380, bonusPct: lv * 0.06 })
  }
];

// ==========================================
// 3-B. 스킬 마스터리(숙련도) 무한 연마 데이터 (골드 소모)
// ==========================================
const SKILL_MASTERY_LIST = [
  {
    id: 'fireball',
    name: '화염구 숙련',
    icon: '🔥',
    baseCost: 10,
    costScale: 1.15,
    bonusPerLv: 0.06,
    desc: '화염구 피해량 +6%'
  },
  {
    id: 'fireblast',
    name: '불꽃 작렬 숙련',
    icon: '💥',
    baseCost: 35,
    costScale: 1.17,
    bonusPerLv: 0.08,
    desc: '불꽃 작렬 피해량 +8%'
  },
  {
    id: 'flame_patch',
    name: '불장판 숙련',
    icon: '♨️',
    baseCost: 75,
    costScale: 1.16,
    bonusPerLv: 0.07,
    desc: '불장판 피해량 +7%'
  },
  {
    id: 'meteor',
    name: '메테오 숙련',
    icon: '☄️',
    baseCost: 120,
    costScale: 1.22,
    bonusPerLv: 0.12,
    desc: '메테오 피해량 +12%'
  },
  {
    id: 'combustion',
    name: '마력 폭주 연마',
    icon: '☀️',
    baseCost: 180,
    costScale: 1.18,
    bonusPerLv: 0.2,
    type: 'duration',
    desc: '마력 폭주 지속시간 +0.2초'
  }
];

function getCombustionDuration() {
  const base = 2.0;
  const lv = (state.skillMastery && state.skillMastery.combustion) || 0;
  const mastery = SKILL_MASTERY_LIST.find((m) => m.id === 'combustion');
  const bonus = mastery ? mastery.bonusPerLv : 0.2;
  const artifactBonus = ((state.artifacts && state.artifacts.time_warp) || 0) * 1.5;
  return Number((base + lv * bonus + artifactBonus).toFixed(1));
}

function getSkillMasteryCost(mastery) {
  const lv = (state.skillMastery && state.skillMastery[mastery.id]) || 0;
  return Math.round(mastery.baseCost * Math.pow(mastery.costScale, lv));
}

function getSkillMasteryMult(skillKey) {
  const mastery = SKILL_MASTERY_LIST.find((m) => m.id === skillKey);
  if (!mastery || !state.skillMastery) return 1.0;
  const lv = state.skillMastery[skillKey] || 0;
  return 1.0 + lv * mastery.bonusPerLv;
}

function getAscensionDamageMult() {
  const count = state.ascensionCount || 0;
  return Math.pow(1.5, count);
}

function isSkillUnlocked(skillId) {
  if (skillId === 'fireball') return true;
  if (skillId === 'fireblast') return Boolean(state.grimoires && state.grimoires.fireblast);
  if (skillId === 'combustion') return Boolean(state.grimoires && state.grimoires.combustion);
  if (skillId === 'meteor') return Boolean(state.grimoires && state.grimoires.meteor);
  if (skillId === 'flame_patch') return Boolean(state.skillTree && (state.skillTree.flame_patch || 0) > 0);
  return false;
}

// ==========================================
// 3-C. 3단계: 제2 자원 '불꽃의 정수' & 고대 마법 부여(Infusion) 데이터
// ==========================================
const INFUSION_LIST = [
  {
    id: 'azure_core',
    name: '청염 코어 주입',
    icon: '🔵',
    maxLv: 15,
    baseCost: 2,
    costScale: 1.45,
    desc: (lv) => `최종 주문 공격력 곱연산 증폭 +${lv * 15}%`
  },
  {
    id: 'chrono_engraving',
    name: '시공 가속 각인',
    icon: '⏳',
    maxLv: 10,
    baseCost: 3,
    costScale: 1.5,
    desc: (lv) => `시전 속도 +${lv * 6}% · 스킬 재사용 대기시간 감소 +${(lv * 2.5).toFixed(1)}%`
  },
  {
    id: 'gold_alchemy',
    name: '황금 연금 변환',
    icon: '💎',
    maxLv: 12,
    baseCost: 3,
    costScale: 1.48,
    desc: (lv) => `몬스터 토벌 골드 획득량 +${lv * 22}% · 정수 획득량 +${lv * 8}%`
  },
  {
    id: 'ruin_eye',
    name: '파멸의 예지안',
    icon: '👁️',
    maxLv: 10,
    baseCost: 4,
    costScale: 1.52,
    desc: (lv) => `치명타 확률 +${(lv * 3.5).toFixed(1)}% · 치명타 피해 +${lv * 18}%`
  },
  {
    id: 'primordial_ignition',
    name: '태고의 발화 핵',
    icon: '🌋',
    maxLv: 10,
    baseCost: 5,
    costScale: 1.55,
    desc: (lv) => `화상(도트) 피해량 +${lv * 25}% · 치명타 시 ${lv * 3}% 확률로 🔹정수 +1 추출`
  }
];

// ==========================================
// 3-D. 시장 벤치마킹 개선: 불사조 영구 유물 (Phoenix Artifacts) 데이터
// ==========================================
const PHOENIX_ARTIFACTS = [
  {
    id: 'shard_of_sun',
    name: '태양의 파편',
    icon: '☀️',
    maxLv: 3,
    cost: 1,
    desc: (lv) => `화염구 시전 시 ${lv === 0 ? 10 : lv * 10}% 확률로 시전 시간 없이 즉시 발사`
  },
  {
    id: 'twin_cataclysm',
    name: '쌍둥이 운석',
    icon: '☄️',
    maxLv: 3,
    cost: 1,
    desc: (lv) => `몰열 메테오 발사 시 ${lv === 0 ? 1 : lv}개의 보조 미니 운석이 연속 낙하 (폭발 피해 50%)`
  },
  {
    id: 'ignited_circ',
    name: '타오르는 마력순환',
    icon: '🔄',
    maxLv: 3,
    cost: 1,
    desc: (lv) => `모든 치명타 적중 시 ${lv === 0 ? 5 : lv * 5}% 확률로 [불꽃 작렬] 즉시 1회 재충전`
  },
  {
    id: 'time_warp',
    name: '시공 왜곡의 룬',
    icon: '⏳',
    maxLv: 3,
    cost: 1,
    desc: (lv) => `발화(마력 폭주) 지속시간 +${lv === 0 ? 1.5 : (lv * 1.5).toFixed(1)}초 · 쿨다운 -${lv === 0 ? 3 : lv * 3}초`
  },
  {
    id: 'phoenix_treasury',
    name: '불사조 보물창고',
    icon: '🪶',
    maxLv: 3,
    cost: 1,
    desc: (lv) => `몬스터 토벌 및 스테이지 완료 시 골드 & 정수 획득량 +${lv === 0 ? 30 : lv * 30}%`
  }
];

// ==========================================
// 3-E. 3대 빌드 키스톤(Keystone) 특성 정의 (선형 업그레이드 탈피)
// ==========================================
const KEYSTONE_DEFINITIONS = [
  {
    id: 'burst',
    title: '마력 폭주',
    icon: '🔥',
    tagline: '발화 극딜 올인',
    color: '#ef4444',
    desc: '발화 지속 중 모든 피해 +100% 증폭 및 스킬 쿨타임 회복 속도 2배. (단, 발화 비활성 중 일반 주문 공격력 -15%)'
  },
  {
    id: 'dot',
    title: '작열 연소',
    icon: '🌋',
    tagline: '도트 연소 & 쿨감 순환',
    color: '#f97316',
    desc: '불장판 및 화상(도트) 틱 피해 +150% 증폭. 도트 틱마다 25% 확률로 [불꽃 작렬] 충전 시간 0.4초 단축.'
  },
  {
    id: 'summon',
    title: '태양왕 군단',
    icon: '👑',
    tagline: '소환수 치명타 공유',
    color: '#eab308',
    desc: '정령·불사조·골렘의 공격 주기 1.5배 가속 및 소환수가 마법사 본체의 치명타 확률을 100% 온전히 공유.'
  }
];

// ==========================================
// 4. 게임 상태 (State)
// ==========================================
const state = {
  gold: 0,
  pendingCoinGold: 0,
  essence: 0,
  pendingEssence: 0,
  currentStage: 1,
  highestClearedStage: 0,
  recordHighestStage: 0,
  dpsClearedStage: 0,
  maxDps: 0,
  playTimeSec: 0,
  totalKills: 0,
  campaignCleared: false,
  autoCast: false,
  autoAdvance: true,
  isPaused: false,
  skillAuto: {
    fireball: true,
    fireblast: true,
    combustion: true,
    meteor: true,
    flame_patch: true
  },
  soundOn: true,
  bgmVolume: 0.4,
  sfxVolume: 0.8,
  devMode: false,
  cheats: {
    alwaysCrit: false
  },

  // 실시간 측정 DPS 및 최근 전투 시각
  currentDps: 0,
  lastCombatTime: 0,

  // 1단계: Magic Archery 스타일 점진적 언폴딩(Unfolding) 해금 상태
  unfolded: {
    stageNav: false,
    grimoireShop: false,
    equipShop: false,
    infusionShop: false,
    skillTree: false,
    hallOfFame: false,
    artifactShop: false,
    trainingDummy: false,
    heatPacts: false
  },

  heatPacts: {
    fast_tempo: false,
    iron_skin: false,
    scorched_endure: false
  },

  bonusSkillPoints: 0,
  skillTree: {
    fire_elem: 0,
    flame_patch: 0,
    phoenix: 0,
    magma_golem: 0,
    multishot: 0,
    rune_aura: 0,
    legion_sync: 0,
    meteor_rain: 0
  },

  grimoires: {
    autocast: false,
    fireblast: false,
    ignite: false,
    combustion: false,
    meteor: false
  },

  items: {
    oak_wand: 0,
    ruby_ring: 0,
    swift_gloves: 0,
    flame_orb: 0,
    sunfire_staff: 0,
    chrono_watch: 0,
    firelord_crown: 0,
    arcane_grail: 0
  },

  infusions: {
    azure_core: 0,
    chrono_engraving: 0,
    gold_alchemy: 0,
    ruin_eye: 0,
    primordial_ignition: 0
  },

  // 불사조 승천 & 영구 유물 (Phoenix Artifacts)
  phoenixFeathers: 0,
  artifacts: {
    shard_of_sun: 0,
    twin_cataclysm: 0,
    ignited_circ: 0,
    time_warp: 0,
    phoenix_treasury: 0
  },

  // 3대 빌드 키스톤 ('burst' | 'dot' | 'summon' | null)
  activeKeystone: null,

  // 30초 훈련용 허수아비 벤치마크 모드
  isTrainingDummy: false,
  trainingTimer: 0,
  savedStageBeforeTraining: 1,
  dummyRecordDps: 0,

  ascensionCount: 0,
  canAscend: false,
  skillMastery: {
    fireball: 0,
    fireblast: 0,
    combustion: 0,
    flame_patch: 0,
    meteor: 0
  },

  monster: {
    hp: 50,
    maxHp: 50,
    isDying: false
  },

  combat: {
    gcdRemaining: 0,
    gcdTotal: 1.3,
    castingSkill: null,
    castRemaining: 0,
    castTotal: 0,

    // 타오르는 기운 (Heating Up Pity System): 비치명타 시마다 스택 누적 (+15%/스택)
    pityCritStacks: 0,

    critStreak: 0,
    streakTimer: 0,
    combustionRem: 0,

    fbCharges: 2,
    fbMaxCharges: 2,
    fbRechargeRem: 0,
    fbRechargeTotal: 9.0,

    combustionCdRem: 0,
    combustionCdTotal: 30,
    meteorCdRem: 0,
    meteorCdTotal: 18,
    flamePatchCdRem: 0,
    flamePatchCdTotal: 10,

    ignitePool: 0,
    igniteRem: 0,
    igniteTickTimer: 0,
    meteorBurnRem: 0,
    meteorBurnTickTimer: 0,
    flamePatchRem: 0,
    flamePatchTickTimer: 0,

    elemTimer: 0,
    elemRecoil: 0,
    elemSpawnTimer: 0,
    phoenixTimer: 0,
    phoenixRecoil: 0,
    golemTimer: 0,
    golemLunge: 0,
    animTime: 0,

    wasOnCd: { 2: false, 3: false, 4: false, 6: false }
  },

  dpsHistory: [],
  skillDamage: {
    fireball: { name: '🔥 화염구', dmg: 0, hits: 0, crits: 0, color: '#f97316' },
    fireblast: { name: '💥 불꽃 작렬', dmg: 0, hits: 0, crits: 0, color: '#fbbf24' },
    ignite: { name: '🩸 화상 (도트)', dmg: 0, hits: 0, crits: 0, color: '#ff8000' },
    meteor: { name: '☄️ 메테오', dmg: 0, hits: 0, crits: 0, color: '#a855f7' },
    flame_patch: { name: '♨️ 불장판', dmg: 0, hits: 0, crits: 0, color: '#fb923c' },
    summon_elem: { name: '🔥 불의 정령', dmg: 0, hits: 0, crits: 0, color: '#fb7185' },
    summon_phoenix: { name: '🦅 불사조', dmg: 0, hits: 0, crits: 0, color: '#facc15' },
    summon_golem: { name: '🗿 용암 골렘', dmg: 0, hits: 0, crits: 0, color: '#c084fc' }
  },

  // 1-1. 상세 전투 분석 (Details! 딜로그) 통계
  stats: {
    totalDamage: 0,
    peakDps: 0,
    biggestCrit: 0,
    biggestCritSkill: '',
    totalHits: 0,
    critHits: 0,
    combustionHits: 0,
    combustionDmg: 0
  },

  // 3-1. 페이즈 보스 전용 기믹 상태
  bossGimmick: {
    active: false,
    type: null,
    shield: 0,
    maxShield: 0,
    shieldTimer: 0,
    shieldTriggered: false,
    isAirborne: false,
    airborneDone: false,
    groggyTimer: 0
  },

  // 3-2. 순환형 미니 현상금 퀘스트 상태
  bounty: {
    id: 1,
    type: 'crit_count',
    title: '치명타 15회 달성',
    target: 15,
    current: 0,
    rewardGold: 25,
    rewardEssence: 1
  }
};

// ==========================================
// 5. 스킬 포인트, 스탯 & 요구 DPS 달성 판정
// ==========================================
function getEarnedPhaseBossSp() {
  // Stage 5, 10, 15, 20 보스 최초 격파 시 각각 영구 1 SP 지급 (첫 엔딩 전 최대 4 SP)
  const maxStage = Math.max(state.highestClearedStage || 0, state.recordHighestStage || 0);
  return Math.min(4, Math.floor(maxStage / 5));
}

function getSpentSkillPoints() {
  let spent = 0;
  for (const node of SKILL_TREE_NODES) {
    const lv = state.skillTree[node.id] || 0;
    spent += lv * node.cost;
  }
  return spent;
}

function getAvailableSkillPoints() {
  const total = (state.ascensionCount || 0) * 1 + (state.bonusSkillPoints || 0) + getEarnedPhaseBossSp();
  return Math.max(0, total - getSpentSkillPoints());
}

function getTotalInfusionLevels() {
  if (!state.infusions) return 0;
  return Object.values(state.infusions).reduce((acc, lv) => acc + (lv || 0), 0);
}

function getInfusionCost(inf) {
  const lv = state.infusions[inf.id] || 0;
  return Math.max(1, Math.round(inf.baseCost * Math.pow(inf.costScale, lv)));
}

function getPlayerStats() {
  let sp = 10;
  let crit = 5;
  let haste = 0;
  let critDmg = 1.5;
  let cdr = 0;
  let bonusPct = 0;

  for (const item of EQUIPMENT_LIST) {
    const lv = state.items[item.id] || 0;
    if (lv > 0) {
      const eff = item.effect(lv);
      if (eff.sp) sp += eff.sp;
      if (eff.crit) crit += eff.crit;
      if (eff.haste) haste += eff.haste;
      if (eff.critDmg) critDmg += eff.critDmg;
      if (eff.cdr) cdr += eff.cdr;
      if (eff.bonusPct) bonusPct += eff.bonusPct;
    }
  }

  // 마법 부여(Infusion) 패시브 및 공명 시너지 반영
  const azureLv = state.infusions.azure_core || 0;
  const chronoLv = state.infusions.chrono_engraving || 0;
  const alchemyLv = state.infusions.gold_alchemy || 0;
  const ruinLv = state.infusions.ruin_eye || 0;
  const ignitionLv = state.infusions.primordial_ignition || 0;
  const totalInfLv = getTotalInfusionLevels();

  haste += chronoLv * 6;
  cdr += chronoLv * 0.025;
  crit += ruinLv * 3.5;
  critDmg += ruinLv * 0.18;

  const runeLv = state.skillTree.rune_aura || 0;
  if (runeLv > 0) {
    haste += runeLv * 18;
  }

  if (state.combat.combustionRem > 0) {
    crit = 100;
    haste += 20;
  }

  if (state.cheats && state.cheats.alwaysCrit) {
    crit = 100;
  }

  crit = Math.min(100, crit);
  cdr = Math.min(0.6, cdr);

  const isAbyssUnlocked = state.campaignCleared || state.highestClearedStage >= 20;
  const abyssSpMult = isAbyssUnlocked ? 1.35 : 1.0;
  const abyssEssenceMult = isAbyssUnlocked ? 2.0 : 1.0;

  const ascMult = getAscensionDamageMult();
  let summonMult = 1 + (state.skillTree.legion_sync || 0) * 0.5;
  if (state.activeKeystone === 'summon') {
    summonMult *= 1.5;
  }

  let keystoneSpMult = 1.0;
  if (state.activeKeystone === 'burst') {
    if (state.combat.combustionRem > 0) {
      keystoneSpMult = 2.0;
    } else {
      keystoneSpMult = 0.85;
    }
  }

  const infusionSpMult = (1 + azureLv * 0.15) * (1 + totalInfLv * 0.02) * abyssSpMult;
  const artifactTreasuryBonus = 1 + ((state.artifacts && state.artifacts.phoenix_treasury) || 0) * 0.30;
  const goldMult = (1 + alchemyLv * 0.22) * artifactTreasuryBonus;
  const essenceMult = (1 + alchemyLv * 0.08) * abyssEssenceMult * artifactTreasuryBonus;
  let igniteMult = (1 + ignitionLv * 0.25);
  if (state.activeKeystone === 'dot') {
    igniteMult *= 2.5;
  }
  const siphonChance = ignitionLv * 0.03;

  return {
    sp: Math.round(sp * (1 + bonusPct) * infusionSpMult * ascMult * keystoneSpMult),
    crit,
    haste,
    critDmg,
    cdr,
    speedMult: 1 + haste / 100,
    summonMult,
    goldMult,
    essenceMult,
    igniteMult,
    siphonChance,
    ascMult
  };
}

function getStageReqDps(stageNum) {
  const data = getStageData(stageNum);
  return Math.ceil(data.hp / data.timeLimit);
}

/**
 * 요구 DPS 충족 여부 기록 및 다음 스테이지 도전 가능 판정
 */
function checkAndRecordDpsClear() {
  if (state.currentDps > state.maxDps) {
    state.maxDps = state.currentDps;
  }
  const reqDps = getStageReqDps(state.currentStage);
  if (state.currentDps >= reqDps || state.maxDps >= reqDps) {
    if (state.currentStage > state.dpsClearedStage) {
      state.dpsClearedStage = state.currentStage;
      saveGame();
    }
  }
}

function isStageDpsMet(stageNum = state.currentStage) {
  const reqDps = getStageReqDps(stageNum);
  return (
    state.dpsClearedStage >= stageNum ||
    state.maxDps >= reqDps ||
    state.currentDps >= reqDps
  );
}

function canAdvanceToNextStage() {
  const isMonsterKilledOnce = state.highestClearedStage >= state.currentStage;
  return isMonsterKilledOnce && isStageDpsMet(state.currentStage);
}

function fmt(num) {
  if (num < 1000) return Math.round(num).toLocaleString('ko-KR');
  if (num < 10000) return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const units = ['', '만', '억', '조', '경'];
  let unitIdx = 0;
  let val = num;
  while (val >= 10000 && unitIdx < units.length - 1) {
    val /= 10000;
    unitIdx++;
  }
  return `${val.toFixed(val >= 100 ? 1 : 2)}${units[unitIdx]}`;
}

// ==========================================
// 6. 사운드 매니저 (BGM / SFX 볼륨 개별 조절 & 교차 루프 재생)
// ==========================================
const FIREBALL_SFX_FILES = {
  fly: 'assets/sounds/sfx/fireball_fly.wav',
  explosion: 'assets/sounds/sfx/fireball_explosion.wav',
  explosion_crit: 'assets/sounds/sfx/fireball_explosion_critical.wav',
  item_select: 'assets/sounds/sfx/item_select.wav',
  drop_coin: 'assets/sounds/sfx/drop_coin.mp3',
  meteor_fly: 'assets/sounds/sfx/meteor_fly.mp3',
  meteor_explosion: 'assets/sounds/sfx/meteor_explosion.mp3',
  swish: 'assets/sounds/sfx/swish.mp3',
  monster_destroy: 'assets/sounds/sfx/monster_destroy.mp3',
  summon_spirit: 'assets/sounds/sfx/Summoning the Fire Spirit.mp3'
};

const preloadedSfx = {};
const burningLoopAudio = new Audio('assets/sounds/sfx/burning.mp3');
burningLoopAudio.preload = 'auto';
burningLoopAudio.loop = true;
burningLoopAudio.volume = 0.55;

const fireballCastAudio = new Audio('assets/sounds/sfx/fireball_ready.mp3');
fireballCastAudio.preload = 'auto';
fireballCastAudio.loop = true;
fireballCastAudio.volume = 0.58;

const BGM_TRACKS = [
  { title: '무한 던전 I', src: 'assets/sounds/bgm/Infinite Dungeon Loop_00.mp3' },
  { title: '무한 던전 II', src: 'assets/sounds/bgm/Infinite Dungeon Loop_01.mp3' },
  { title: '선술집의 변덕 A', src: 'assets/sounds/bgm/Tavern Whimsy.mp3' },
  { title: '선술집의 변덕 B', src: 'assets/sounds/bgm/Tavern Whimsy (1).mp3' },
  { title: "요새의 파수병 A", src: "assets/sounds/bgm/The Keep's Watch.mp3" },
  { title: "요새의 파수병 B", src: "assets/sounds/bgm/The Keep's Watch (1).mp3" }
];
const bgmAudios = [];
let currentBgmIndex = -1;
let bgmShuffleQueue = [];

function getNextBgmIndex() {
  if (bgmAudios.length <= 1) return 0;
  if (bgmShuffleQueue.length === 0) {
    const indices = bgmAudios.map((_, i) => i);
    // Fisher-Yates 셔플
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // 직전에 재생했던 곡과 새 큐의 첫 곡이 같다면 뒤로 보냄
    if (indices[0] === currentBgmIndex && indices.length > 1) {
      const first = indices.shift();
      indices.push(first);
    }
    bgmShuffleQueue = indices;
  }
  return bgmShuffleQueue.shift();
}

function playNextBgmTrack() {
  if (!bgmAudios.length) return;
  currentBgmIndex = getNextBgmIndex();
  const effVol = getEffectiveBgmVol();

  bgmAudios.forEach((aud, idx) => {
    if (idx !== currentBgmIndex && !aud.paused) {
      aud.pause();
      aud.currentTime = 0;
    }
  });

  const nextAudio = bgmAudios[currentBgmIndex];
  if (nextAudio && effVol > 0) {
    nextAudio.volume = effVol;
    nextAudio.currentTime = 0;
    nextAudio.play().catch(() => {});
  }
  updateSoundUI();
}

function getEffectiveBgmVol() {
  if (!state.soundOn) return 0;
  return Math.max(0, Math.min(1, typeof state.bgmVolume === 'number' ? state.bgmVolume : 0.4));
}

function getEffectiveSfxVol(baseVol = 0.75) {
  if (!state.soundOn) return 0;
  const userSfx = Math.max(0, Math.min(1, typeof state.sfxVolume === 'number' ? state.sfxVolume : 0.8));
  return Math.max(0, Math.min(1, baseVol * userSfx));
}

function initBgmAudio() {
  BGM_TRACKS.forEach((track) => {
    const audio = new Audio(track.src);
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = 0.4;
    audio.addEventListener('ended', () => {
      playNextBgmTrack();
    });
    audio.addEventListener('error', () => {
      // 로드 또는 디코딩 실패 시 다음 곡으로 안전하게 스킵
      playNextBgmTrack();
    });
    bgmAudios.push(audio);
  });
  if (bgmAudios.length > 0) {
    currentBgmIndex = getNextBgmIndex();
  }
}
initBgmAudio();

function updateBgmPlayback() {
  if (!bgmAudios.length) return;
  try {
    const effVol = getEffectiveBgmVol();
    if (effVol > 0) {
      if (currentBgmIndex < 0 || currentBgmIndex >= bgmAudios.length) {
        currentBgmIndex = getNextBgmIndex();
      }
      bgmAudios.forEach((aud, idx) => {
        aud.volume = effVol;
        if (idx !== currentBgmIndex && !aud.paused) {
          aud.pause();
          aud.currentTime = 0;
        }
      });
      const activeBgm = bgmAudios[currentBgmIndex];
      if (activeBgm && activeBgm.paused) {
        activeBgm.play().catch(() => {});
      }
    } else {
      bgmAudios.forEach((aud) => {
        if (!aud.paused) {
          aud.pause();
        }
      });
    }
    updateSoundUI();
  } catch (e) {}
}

function initSfxAudio() {
  for (const [key, src] of Object.entries(FIREBALL_SFX_FILES)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    preloadedSfx[key] = audio;
  }
}
initSfxAudio();

function updateBurningLoopSound() {
  const c = state.combat;
  const effVol = getEffectiveSfxVol(0.68);
  const isDotBurning =
    effVol > 0 &&
    ((c.igniteRem > 0 && c.ignitePool >= 5) || c.meteorBurnRem > 0 || c.flamePatchRem > 0);
  try {
    burningLoopAudio.volume = effVol;
    if (isDotBurning) {
      if (burningLoopAudio.paused) {
        burningLoopAudio.play().catch(() => {});
      }
    } else {
      if (!burningLoopAudio.paused) {
        burningLoopAudio.pause();
      }
    }
  } catch (e) {}
}

function updateCastingLoopSound() {
  const c = state.combat;
  const effVol = getEffectiveSfxVol(0.72);
  const isCasting = effVol > 0 && Boolean(c.castingSkill) && c.castRemaining > 0;
  try {
    fireballCastAudio.volume = effVol;
    if (isCasting) {
      if (fireballCastAudio.paused) {
        fireballCastAudio.play().catch(() => {});
      }
    } else {
      if (!fireballCastAudio.paused) {
        fireballCastAudio.pause();
      }
    }
  } catch (e) {}
}

function playFireballSfx(kind, volume = 0.65, pitchMult = 1.0) {
  const effVol = getEffectiveSfxVol(volume);
  if (effVol <= 0) return null;
  try {
    const base = preloadedSfx[kind];
    if (!base) return null;
    const snd = base.cloneNode();
    snd.volume = effVol;
    if (pitchMult !== 1.0 && typeof snd.playbackRate === 'number') {
      snd.playbackRate = Math.min(2.0, Math.max(0.5, pitchMult));
    }
    snd.play().catch(() => {});
    return snd;
  } catch (e) {
    return null;
  }
}

function playSound(type, pitchMult = 1.0) {
  if (!state.soundOn) return null;
  const isCombusting = Boolean(state.combat && state.combat.combustionRem > 0);
  const combPitch = isCombusting
    ? 1.0 + Math.min(0.45, (state.stats && state.stats.combustionHits ? state.stats.combustionHits : 0) * 0.04)
    : 1.0;
  const finalPitch = combPitch * pitchMult;

  if (type === 'launch') {
    return playFireballSfx('fly', 0.8, finalPitch);
  }
  if (type === 'hit') {
    return playFireballSfx('explosion', 0.72, finalPitch);
  }
  if (type === 'crit') {
    return playFireballSfx('explosion_crit', 1.0, finalPitch);
  }
  if (type === 'item_select') {
    return playFireballSfx('item_select', 0.92);
  }
  if (type === 'drop_coin' || type === 'coin_tick') {
    return playFireballSfx('drop_coin', 0.92);
  }
  if (type === 'meteor_fly') {
    return playFireballSfx('meteor_fly', 0.95);
  }
  if (type === 'meteor_impact') {
    return playFireballSfx('meteor_explosion', 1.0);
  }
  if (type === 'proc' || type === 'swish') {
    return playFireballSfx('swish', 0.92);
  }
  if (type === 'monster_destroy') {
    return playFireballSfx('monster_destroy', 0.96);
  }
  if (type === 'summon_spirit' || type === 'summon_fire_spirit') {
    return playFireballSfx('summon_spirit', 0.95);
  }
  return null;
}

function updateSoundUI() {
  const bgmPct = Math.round((typeof state.bgmVolume === 'number' ? state.bgmVolume : 0.4) * 100);
  const sfxPct = Math.round((typeof state.sfxVolume === 'number' ? state.sfxVolume : 0.8) * 100);
  const isAllMuted = !state.soundOn || (bgmPct === 0 && sfxPct === 0);

  const soundBtn = document.getElementById('btn-sound');
  if (soundBtn) {
    soundBtn.textContent = isAllMuted ? '🔇 음소거' : '🔊 사운드';
  }

  const muteAllBtn = document.getElementById('btn-sound-mute-all');
  if (muteAllBtn) {
    muteAllBtn.textContent = state.soundOn ? '🔊 켜짐' : '🔇 음소거됨';
    muteAllBtn.classList.toggle('muted', !state.soundOn);
  }

  const bgmSlider = document.getElementById('slider-bgm-vol');
  const bgmValEl = document.getElementById('ui-bgm-vol-val');
  if (bgmSlider) bgmSlider.value = String(bgmPct);
  if (bgmValEl) bgmValEl.textContent = state.soundOn ? `${bgmPct}%` : '음소거';

  const sfxSlider = document.getElementById('slider-sfx-vol');
  const sfxValEl = document.getElementById('ui-sfx-vol-val');
  if (sfxSlider) sfxSlider.value = String(sfxPct);
  if (sfxValEl) sfxValEl.textContent = state.soundOn ? `${sfxPct}%` : '음소거';

  const bgmTrackTitleEl = document.getElementById('ui-bgm-title');
  if (bgmTrackTitleEl) {
    if (currentBgmIndex >= 0 && currentBgmIndex < BGM_TRACKS.length) {
      bgmTrackTitleEl.textContent = `🎲 ${BGM_TRACKS[currentBgmIndex].title}`;
      bgmTrackTitleEl.title = `현재 트랙: ${BGM_TRACKS[currentBgmIndex].title} (${currentBgmIndex + 1}/${BGM_TRACKS.length})`;
    } else {
      bgmTrackTitleEl.textContent = '🎲 랜덤 재생';
    }
  }
}

// ==========================================
// 7. 2D 캔버스 투사체(직선 비행), 메테오 & 소환수 렌더링 엔진
// ==========================================
const canvas = document.getElementById('vfx-canvas');
const ctx = canvas.getContext('2d');
const groundCanvas = document.getElementById('ground-vfx-canvas');
const groundCtx = groundCanvas ? groundCanvas.getContext('2d') : ctx;
const projectiles = [];
const particles = [];
const meteors = [];
const groundEffects = [];
const shockwaves = [];

function resizeCanvas() {
  const arena = document.getElementById('combat-arena');
  if (!arena) return;
  canvas.width = arena.clientWidth;
  canvas.height = arena.clientHeight;
  if (groundCanvas) {
    groundCanvas.width = arena.clientWidth;
    groundCanvas.height = arena.clientHeight;
  }
}
window.addEventListener('resize', resizeCanvas);

function getCasterCenter() {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const caster = document.getElementById('caster-avatar').getBoundingClientRect();
  return {
    x: caster.left - arena.left + caster.width * 0.5,
    y: caster.top - arena.top + caster.height * 0.5
  };
}

function getActorGroundPos(id) {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const actor = document.getElementById(id).getBoundingClientRect();
  return { x: actor.left - arena.left + actor.width * 0.5, y: actor.bottom - arena.top };
}

function getCasterPos() {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const muzzle = document.getElementById('mage-muzzle').getBoundingClientRect();
  return {
    x: muzzle.left - arena.left,
    y: muzzle.top - arena.top
  };
}

function getTargetPos() {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const dummy = document.getElementById('dummy-avatar').getBoundingClientRect();
  return {
    x: dummy.left - arena.left + dummy.width * 0.5,
    y: dummy.top - arena.top + dummy.height * 0.5
  };
}

function spawnParticles(x, y, count, colorCore, colorEdge, speedScale = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (35 + Math.random() * 140) * speedScale;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 20,
      radius: 2.5 + Math.random() * 4.5 * speedScale,
      life: 0,
      maxLife: 0.25 + Math.random() * 0.3,
      colorCore,
      colorEdge
    });
  }
}

function spawnHitSparkVfx(x, y, isCrit, skillKey) {
  const isHeavy = skillKey === 'meteor';
  const count = isCrit ? (isHeavy ? 24 : 16) : 8;
  const speedScale = isCrit ? 1.45 : 0.85;
  const coreColor = isCrit ? '#fef08a' : '#fed7aa';
  const edgeColor = isCrit ? '#f59e0b' : '#ea580c';
  spawnParticles(x, y, count, coreColor, edgeColor, speedScale);

  if (isCrit || isHeavy) {
    shockwaves.push({
      x,
      y,
      radius: 12,
      maxRadius: isHeavy ? 75 : 45,
      rgb: skillKey === 'meteor' ? '253, 224, 71' : '249, 115, 22',
      lineWidth: isHeavy ? 4.5 : 3.0,
      life: 0,
      maxLife: 0.28
    });
  }
}

let lastHitMarkTime = 0;
function spawnHitMark(markChar) {
  const now = performance.now();
  if (now - lastHitMarkTime < 100) return;
  lastHitMarkTime = now;

  const dummyEl = document.getElementById('dummy-avatar');
  if (!dummyEl) return;

  const markEl = document.createElement('div');
  markEl.className = 'monster-hit-mark';
  markEl.setAttribute('aria-hidden', 'true');
  const offsetX = (Math.random() - 0.5) * 36;
  const offsetY = (Math.random() - 0.5) * 20;
  markEl.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;

  dummyEl.appendChild(markEl);
  setTimeout(() => {
    if (markEl.parentNode) markEl.parentNode.removeChild(markEl);
  }, 400);
}

// ==========================================
// 7-B. 2단계: 화염구의 시각적 진화 (5단계 외형·크기·위성·탄막 진화)
// ==========================================
const FLAME_EVOLUTION_TIERS = [
  {
    tier: 1,
    name: '견습 불꽃',
    badgeText: '🟠 Lv.1 견습 불꽃',
    reqSp: 0,
    reqEquipLv: 0,
    colorCore: '#fde047',
    colorMid: '#f97316',
    colorEdge: 'rgba(239, 68, 68, 0)',
    ringRgb: '251, 146, 60',
    scale: 1.0,
    orbiters: 0,
    barrageCount: 0
  },
  {
    tier: 2,
    name: '홍련의 업화',
    badgeText: '🔴 Lv.2 홍련의 업화',
    reqSp: 22,
    reqEquipLv: 4,
    colorCore: '#ffffff',
    colorMid: '#fb7185',
    colorEdge: 'rgba(225, 29, 72, 0)',
    ringRgb: '244, 63, 94',
    scale: 1.18,
    orbiters: 1,
    barrageCount: 0
  },
  {
    tier: 3,
    name: '고열 청염',
    badgeText: '🔵 Lv.3 고열 청염',
    reqSp: 75,
    reqEquipLv: 10,
    colorCore: '#e0f2fe',
    colorMid: '#38bdf8',
    colorEdge: 'rgba(37, 99, 235, 0)',
    ringRgb: '56, 189, 248',
    scale: 1.34,
    orbiters: 2,
    barrageCount: 1
  },
  {
    tier: 4,
    name: '심연 비전화',
    badgeText: '🟣 Lv.4 심연 비전화',
    reqSp: 260,
    reqEquipLv: 18,
    colorCore: '#fae8ff',
    colorMid: '#c084fc',
    colorEdge: 'rgba(126, 34, 206, 0)',
    ringRgb: '192, 132, 252',
    scale: 1.5,
    orbiters: 3,
    barrageCount: 1
  },
  {
    tier: 5,
    name: '태양신화',
    badgeText: '🌟 Lv.5 태양신화',
    reqSp: 900,
    reqEquipLv: 28,
    colorCore: '#ffffff',
    colorMid: '#fde047',
    colorEdge: 'rgba(255, 69, 0, 0)',
    ringRgb: '250, 204, 21',
    scale: 1.68,
    orbiters: 4,
    barrageCount: 2
  }
];

function getTotalEquipmentLevels() {
  return Object.values(state.items).reduce((acc, lv) => acc + (lv || 0), 0);
}

function getUnlockedFlameTier() {
  const sp = getPlayerStats().sp;
  const eqLv = getTotalEquipmentLevels();
  let unlocked = 1;
  for (const t of FLAME_EVOLUTION_TIERS) {
    if (sp >= t.reqSp || eqLv >= t.reqEquipLv) {
      unlocked = t.tier;
    }
  }
  return unlocked;
}

function getCurrentFlameEvolution() {
  const activeTier = state.previewFlameTier > 0 ? state.previewFlameTier : getUnlockedFlameTier();
  return FLAME_EVOLUTION_TIERS[Math.min(5, Math.max(1, activeTier)) - 1];
}

function updateFlameEvolutionUI(silent = false) {
  const unlockedTier = getUnlockedFlameTier();
  if (!state.highestFlameTier) state.highestFlameTier = 1;

  if (unlockedTier > state.highestFlameTier) {
    state.highestFlameTier = unlockedTier;
    const newEvo = FLAME_EVOLUTION_TIERS[unlockedTier - 1];
    if (!silent) {
      showUnfoldToast(
        `🔥 화염 마법 진화! [${newEvo.badgeText}]`,
        `화염구의 크기(+${Math.round((newEvo.scale - 1) * 100)}%)와 마력 파장이 한 단계 진화했습니다!`
      );
      triggerUnfoldPop('flame-evo-badge');
    }
  }

  const evo = getCurrentFlameEvolution();
  const badgeEl = document.getElementById('flame-evo-badge');
  if (badgeEl) {
    const isPreview = state.previewFlameTier > 0;
    const nextTierObj = FLAME_EVOLUTION_TIERS[evo.tier];
    const nextHint = nextTierObj
      ? `다음 진화(${nextTierObj.name}): 주문 공격력 ${fmt(nextTierObj.reqSp)} 또는 총 장비 +${nextTierObj.reqEquipLv}강`
      : '최고 단계 화염 진화 달성!';
    badgeEl.className = `flame-evo-badge evo-tier-${evo.tier}`;
    badgeEl.textContent = isPreview ? `${evo.badgeText} (미리보기)` : evo.badgeText;
    badgeEl.title = `${nextHint} (클릭 시 1~5단계 외형 미리보기 전환)`;
  }

  const avatarEl = document.getElementById('caster-avatar');
  if (avatarEl) {
    for (let i = 1; i <= 5; i++) avatarEl.classList.remove(`evo-${i}`);
    avatarEl.classList.add(`evo-${evo.tier}`);
  }

  const orbEl = document.getElementById('casting-orb');
  if (orbEl) {
    orbEl.style.background = `radial-gradient(circle, #fff 0%, ${evo.colorCore} 45%, ${evo.colorMid} 85%, transparent 100%)`;
    orbEl.style.boxShadow = `0 0 ${14 + evo.tier * 3}px ${evo.colorMid}`;
  }
}

const rockDebris = [];
let lastMeteorShakeTime = -Infinity;

function spawnMeteorRockDebris(x, y, scale = 1.0) {
  const count = Math.min(Math.max(8, Math.round(12 * scale)), Math.max(0, 48 - rockDebris.length));
  for (let i = 0; i < count; i++) {
    // 좌우 사방으로 퍼져 나가도록 각도 및 속도 설정
    const side = i % 2 === 0 ? 1 : -1;
    const vx = side * (65 + Math.random() * 270) * scale + (Math.random() * 40 - 20);
    const vy = -(170 + Math.random() * 260) * scale;
    const size = (6.5 + Math.random() * 9.5) * scale;
    const vertCount = 5 + Math.floor(Math.random() * 3);
    const verts = [];
    for (let v = 0; v < vertCount; v++) {
      const ang = (v / vertCount) * Math.PI * 2 + (Math.random() * 0.35 - 0.175);
      const r = size * (0.62 + Math.random() * 0.48);
      verts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
    }
    rockDebris.push({
      x: x + (Math.random() * 20 - 10) * scale,
      y: y + (Math.random() * 12 - 6) * scale,
      vx,
      vy,
      gravity: 820 * scale,
      groundY: y + 16 + (Math.random() * 36 - 10) * scale,
      bounced: false,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 22,
      verts,
      life: 0,
      maxLife: 0.68 + Math.random() * 0.32,
      isMolten: Math.random() < 0.65
    });
  }
}

const monsterShards = [];

/**
 * 하스스톤 영웅 초상화 박살 연출처럼 몬스터 원형 초상화를 9개의 다각형 조각으로 쪼개어 사방으로 폭발시키는 이펙트
 */
function spawnMonsterShatterVfx(x, y, emoji, isBoss = false) {
  const numShards = 9;
  const radius = 65;
  const fx = (Math.random() - 0.5) * 14;
  const fy = (Math.random() - 0.5) * 14;

  // 방사형 균열 각도 및 지그재그 중간 정점 생성 (인접 조각끼리 경계선을 공유해 완벽한 퍼즐 조각 형성)
  const spokes = [];
  for (let i = 0; i < numShards; i++) {
    const baseAng = (i / numShards) * Math.PI * 2;
    const ang = baseAng + (Math.random() * 0.24 - 0.12);
    const midR = 28 + Math.random() * 14;
    const midAng = ang + (Math.random() * 0.28 - 0.14);
    spokes.push({
      ang,
      midPt: {
        x: fx + Math.cos(midAng) * midR,
        y: fy + Math.sin(midAng) * midR
      },
      outerPt: {
        x: Math.cos(ang) * radius,
        y: Math.sin(ang) * radius
      }
    });
  }

  for (let i = 0; i < numShards; i++) {
    const s1 = spokes[i];
    const s2 = spokes[(i + 1) % numShards];
    let midArcAng = (s1.ang + s2.ang) * 0.5;
    if (i === numShards - 1) {
      midArcAng = (s1.ang + s2.ang + Math.PI * 2) * 0.5;
    }
    const arcMidPt = {
      x: Math.cos(midArcAng) * radius,
      y: Math.sin(midArcAng) * radius
    };

    const poly = [
      { x: fx, y: fy },
      s1.midPt,
      s1.outerPt,
      arcMidPt,
      s2.outerPt,
      s2.midPt
    ];

    // 조각의 무게중심(centroid) 계산
    let cx = 0;
    let cy = 0;
    for (const p of poly) {
      cx += p.x;
      cy += p.y;
    }
    cx /= poly.length;
    cy /= poly.length;

    const localVerts = poly.map((p) => ({ x: p.x - cx, y: p.y - cy }));
    const outAng = Math.atan2(cy - fy, cx - fx) + (Math.random() * 0.28 - 0.14);
    const speed = (185 + Math.random() * 210) * (isBoss ? 1.25 : 1.0);

    monsterShards.push({
      baseX: x + cx,
      baseY: y + cy,
      x: x + cx,
      y: y + cy,
      cx,
      cy,
      outDirX: Math.cos(outAng),
      outDirY: Math.sin(outAng),
      vx: Math.cos(outAng) * speed + 35,
      vy: Math.sin(outAng) * speed - (95 + Math.random() * 90),
      gravity: 780,
      rot: 0,
      vRot: (Math.random() < 0.5 ? -1 : 1) * (5.5 + Math.random() * 9.5),
      scale: 1.0,
      localVerts,
      emoji,
      isBoss,
      crackHoldTime: 0.065,
      life: 0,
      maxLife: 0.62 + Math.random() * 0.16
    });
  }

  // 박살 순간 중심 충격파 & 파편 파티클 추가
  shockwaves.push({
    x,
    y,
    life: 0,
    maxLife: 0.34,
    maxRadius: isBoss ? 130 : 96,
    rgb: isBoss ? '253, 224, 71' : '251, 146, 60',
    flat: false,
    lineWidth: isBoss ? 6 : 4.5
  });
}

function launchCustomProjectile(opts) {
  projectiles.push({
    type: opts.type || 'fireball',
    startX: opts.startX,
    startY: opts.startY,
    targetX: opts.targetX,
    targetY: opts.targetY,
    progress: 0,
    duration: opts.duration || 0.28,
    radius: opts.radius || 10,
    colorCore: opts.colorCore || '#fde047',
    colorMid: opts.colorMid || '#f97316',
    colorEdge: opts.colorEdge || 'rgba(239, 68, 68, 0)',
    ringRgb: opts.ringRgb || '251, 146, 60',
    evoTier: opts.evoTier || 1,
    orbiters: opts.orbiters || 0,
    onHit: opts.onHit
  });
}

function launchProjectile(type, onHitCallback, offsetY = 0, scaleMult = 1.0) {
  // 주 탄환은 발사 자세로 바꾼 손끝에서 출발합니다.
  if (scaleMult >= 0.9) beginMageGesture('fireball');
  const start = getCasterPos();
  const end = getTargetPos();
  const evo = getCurrentFlameEvolution();


  if (scaleMult >= 0.9) {
    playFireballSfx('fly', 0.52);
  }

  // 화염구 크기와 진화 배율은 기존 손맛을 유지합니다.
  const baseRadius = 12.4;
  const effectiveEvoScale = 1 + (evo.scale - 1) * 0.38;

  launchCustomProjectile({
    type,
    startX: start.x,
    startY: start.y + offsetY,
    targetX: end.x,
    targetY: end.y + offsetY,
    duration: 0.24,
    radius: baseRadius * effectiveEvoScale * scaleMult,
    colorCore: evo.colorCore,
    colorMid: evo.colorMid,
    colorEdge: evo.colorEdge,
    ringRgb: evo.ringRgb,
    evoTier: evo.tier,
    orbiters: 0,
    onHit: onHitCallback
  });
}

function launchMeteorVfx(onImpactCallback, scale = 1.0) {
  const target = getTargetPos();
  const offsetX = scale < 1 ? Math.random() * 40 - 20 : 0;
  const offsetY = scale < 1 ? Math.random() * 24 - 12 : 10;
  const fallDuration = 0.96 * Math.max(0.78, scale);

  // 메테오 크기 1.5배 확대에 맞춰 지면 충돌 예고 마법진도 1.5배 확대
  groundEffects.push({
    x: target.x + offsetX,
    y: target.y + 32 + offsetY,
    radius: 93 * scale,
    life: 0,
    maxLife: fallDuration
  });

  const meteorRadius = 51 * scale;

  // 첨부 이미지 기준: 상단 중앙 스테이지 배너(#arena-stage-banner)의 'STAGE 1-1' 바로 아래 위치에서 출현!
  const arenaEl = document.getElementById('combat-arena');
  const bannerEl = document.getElementById('arena-stage-banner');
  let startX = target.x - 185 * scale + offsetX;
  let startY = Math.max(155, target.y - 195 * scale);
  if (arenaEl && bannerEl) {
    const arenaRect = arenaEl.getBoundingClientRect();
    const bannerRect = bannerEl.getBoundingClientRect();
    startX = bannerRect.left - arenaRect.left + bannerRect.width * 0.28 + offsetX * 0.5;
    startY = bannerRect.bottom - arenaRect.top + 36;
  }

  const flyAudio = playFireballSfx('meteor_fly', scale >= 0.9 ? 0.82 : 0.6);

  meteors.push({
    startX,
    startY,
    targetX: target.x + offsetX,
    targetY: target.y + offsetY,
    progress: 0,
    duration: fallDuration,
    radius: meteorRadius,
    trailClock: 0,
    scale,
    flyAudio,
    onImpact: onImpactCallback
  });
}

function drawSummonsAndAuras(dt) {
  const c = state.combat;
  c.animTime += dt;
  const casterCenter = getCasterCenter();
  const targetCenter = getTargetPos();
  const gCtx = groundCtx || ctx;

  // 1. 고대 가속 마법진 (캐릭터 발밑 바닥 레이어에 렌더링)
  const runeLv = state.skillTree.rune_aura || 0;
  if (runeLv > 0) {
    gCtx.save();
    const feet = getActorGroundPos('caster-avatar');
    gCtx.translate(feet.x, feet.y);
    gCtx.scale(1, 0.42);
    gCtx.rotate(c.animTime * 1.4);

    gCtx.beginPath();
    gCtx.arc(0, 0, 68, 0, Math.PI * 2);
    gCtx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    gCtx.lineWidth = 3;
    gCtx.stroke();

    gCtx.beginPath();
    gCtx.arc(0, 0, 52, 0, Math.PI * 2);
    gCtx.setLineDash([10, 8]);
    gCtx.strokeStyle = 'rgba(249, 115, 22, 0.7)';
    gCtx.lineWidth = 2;
    gCtx.stroke();
    gCtx.restore();
  }

  // 화염구는 발사 시에만 생성합니다. 시전 중에는 준비 탄환을 그리지 않습니다.
  // 2. 불의 정령
  const elemLv = state.skillTree.fire_elem || 0;
  if (elemLv > 0) {
    if (c.elemRecoil > 0) c.elemRecoil = Math.max(0, c.elemRecoil - dt * 5);
    const bobY = Math.sin(c.animTime * 3.5) * 6;
    const ex = casterCenter.x + 58 + c.elemRecoil * 8;
    const ey = casterCenter.y - 68 + bobY;

    // 12대 애니메이션 원칙(Squash & Stretch, Follow Through, Ease-In/Out) 스폰 모션
    let scaleX = 1;
    let scaleY = 1;
    let spawnOffsetY = 0;
    let spawnAlpha = 1;

    if (c.elemSpawnTimer > 0) {
      c.elemSpawnTimer = Math.max(0, c.elemSpawnTimer - dt);
      const prog = 1 - c.elemSpawnTimer / 0.55; // 0 -> 1 (0.55초간 스폰 모션)
      if (prog < 0.35) {
        // 1단계: 마법진에서 솟구치며 수직 스트레치 (Stretch)
        const t = prog / 0.35;
        scaleX = 0.35 + t * 0.45;
        scaleY = 0.5 + t * 1.1;
        spawnOffsetY = (1 - t) * 32;
        spawnAlpha = Math.min(1, t * 1.8);
      } else if (prog < 0.65) {
        // 2단계: 착지하며 쿵 하고 눌리는 스쿼시 (Squash)
        const t = (prog - 0.35) / 0.3;
        scaleX = 1.3 - t * 0.15;
        scaleY = 0.7 + t * 0.2;
        spawnOffsetY = 0;
      } else if (prog < 0.85) {
        // 3단계: 젤리 반동 솟구침 (Follow-through & Overshoot)
        const t = (prog - 0.65) / 0.2;
        scaleX = 0.92 + t * 0.08;
        scaleY = 1.14 - t * 0.1;
        spawnOffsetY = -Math.sin(t * Math.PI) * 4;
      } else {
        // 4단계: 안착
        scaleX = 1;
        scaleY = 1;
        spawnOffsetY = 0;
      }
    }

    ctx.save();
    ctx.translate(ex, ey + spawnOffsetY);
    ctx.scale(scaleX, scaleY);
    ctx.globalAlpha = spawnAlpha;

    const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.45, '#f97316');
    grad.addColorStop(0.8, 'rgba(239, 68, 68, 0.35)');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < elemLv + 1; i++) {
      const ang = c.animTime * 4 + (i * Math.PI * 2) / (elemLv + 1);
      const ox = Math.cos(ang) * 22;
      const oy = Math.sin(ang) * 12;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawComicAbility(ctx, 'fire-elemental', 0, 0, 48);

    ctx.font = 'bold 10px Pretendard, sans-serif';
    ctx.fillStyle = '#fed7aa';
    ctx.fillText(`불의 정령 Lv.${elemLv}`, 0, 24);

    ctx.restore();
  }

  // 3. 불사조
  const phxLv = state.skillTree.phoenix || 0;
  if (phxLv > 0) {
    if (c.phoenixRecoil > 0) c.phoenixRecoil = Math.max(0, c.phoenixRecoil - dt * 5);
    const bobX = Math.cos(c.animTime * 2.8) * 5;
    const bobY = Math.sin(c.animTime * 4.2) * 7;
    const px = casterCenter.x + 62 + bobX + c.phoenixRecoil * 10;
    const py = casterCenter.y + 62 + bobY;

    const grad = ctx.createRadialGradient(px, py, 4, px, py, 30);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#facc15');
    grad.addColorStop(0.8, 'rgba(234, 179, 8, 0.3)');
    grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawComicSummon(ctx, 12, px, py, 42);

    ctx.font = 'bold 10px Pretendard, sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`불사조 Lv.${phxLv}`, px, py + 24);
  }

  // 4. 용암 골렘
  const golemLv = state.skillTree.magma_golem || 0;
  if (golemLv > 0) {
    if (c.golemLunge > 0) c.golemLunge = Math.max(0, c.golemLunge - dt * 4);
    const gx = targetCenter.x - 102 + c.golemLunge * 26;
    const gy = targetCenter.y + 26 - Math.sin(c.golemLunge * Math.PI) * 12;

    const grad = ctx.createRadialGradient(gx, gy, 5, gx, gy, 32);
    grad.addColorStop(0, '#f97316');
    grad.addColorStop(0.55, 'rgba(153, 27, 27, 0.5)');
    grad.addColorStop(1, 'rgba(153, 27, 27, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, 32, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawComicSummon(ctx, 13, gx, gy, 44);

    ctx.font = 'bold 10px Pretendard, sans-serif';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(`용암 골렘 Lv.${golemLv}`, gx, gy + 26);
  }

  // 4-B. 불장판 (몬스터 이미지 뒤쪽/발밑 바닥 레이어 #ground-vfx-canvas 에 1.5배 넓어진 화염 지대 렌더링!)
  if (c.flamePatchRem > 0) {
    const fx = targetCenter.x;
    const fy = getActorGroundPos('dummy-avatar').y; // 실제 접지 위치
    const fadeAlpha = Math.min(1, c.flamePatchRem / 0.6);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pulse = reduced ? 1 : 1 + Math.sin(c.animTime * 4) * 0.025;
    gCtx.save();
    gCtx.globalAlpha = fadeAlpha;
    // 원화의 타원형 바닥을 접지하고, 몬스터 뒤 레이어에만 표시합니다.
    drawComicAbility(gCtx, 'flame-patch', fx, fy - 35, 230 * pulse, 150);
    gCtx.restore();
    if (!reduced && dt > 0 && particles.length < 180 && Math.random() < Math.min(1, dt * 12)) {
      particles.push({x:fx+(Math.random()-.5)*140,y:fy,vx:(Math.random()-.5)*18,vy:-45,
        radius:2,life:0,maxLife:.4,colorCore:'#fef08a',colorEdge:'#ea580c'});
    }
  }

  // 5. 충격파 (지면 flat 충격파는 바닥 캔버스에, 공중 충격파는 전면 캔버스에 렌더링)
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life += dt;
    if (sw.life >= sw.maxLife) {
      shockwaves.splice(i, 1);
      continue;
    }
    const prog = sw.life / sw.maxLife;
    const alpha = 1 - prog;
    const rgb = sw.rgb || '251, 146, 60';
    const targetCtx = sw.flat ? gCtx : ctx;
    targetCtx.save();
    targetCtx.translate(sw.x, sw.y);
    targetCtx.scale(1, sw.flat ? 0.45 : 0.85);
    targetCtx.beginPath();
    targetCtx.arc(0, 0, sw.maxRadius * prog, 0, Math.PI * 2);
    targetCtx.strokeStyle = `rgba(${rgb}, ${alpha})`;
    targetCtx.lineWidth = sw.lineWidth || 4;
    targetCtx.stroke();
    targetCtx.restore();
  }
}

function updateAndDrawVfx(dt) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (groundCtx && groundCanvas) {
    groundCtx.clearRect(0, 0, groundCanvas.width, groundCanvas.height);
  }
  drawSummonsAndAuras(dt);

  const gCtx = groundCtx || ctx;
  const meteorDt = state.isPaused ? 0 : dt;
  const reducedMeteor = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = groundEffects.length - 1; i >= 0; i--) {
    const g = groundEffects[i];
    g.life += meteorDt;
    if (g.life >= g.maxLife) {
      groundEffects.splice(i, 1);
      continue;
    }
    const prog = g.life / g.maxLife;
    const alpha = 1 - prog;
    gCtx.save();
    gCtx.translate(g.x, g.y);
    gCtx.scale(1, 0.42);
    gCtx.beginPath();
    gCtx.arc(0, 0, g.radius, 0, Math.PI * 2);
    gCtx.strokeStyle = `rgba(251, 191, 36, ${alpha * 0.9})`;
    gCtx.lineWidth = 3.5;
    gCtx.stroke();
    gCtx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.28})`;
    gCtx.fill();
    // 내부 수축 타겟 링 연출
    gCtx.beginPath();
    gCtx.arc(0, 0, g.radius * (1 - prog * 0.65), 0, Math.PI * 2);
    gCtx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.65})`;
    gCtx.lineWidth = 2;
    gCtx.stroke();
    gCtx.restore();
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.progress += dt / p.duration;

    if (p.progress >= 1) {
      // 일반 화염구의 타격 파티클은 작고 짧게 유지합니다.
      spawnParticles(
        p.targetX,
        p.targetY,
        7,
        p.colorCore,
        p.colorMid,
        0.62
      );
      if (p.onHit) p.onHit();
      projectiles.splice(i, 1);
      continue;
    }

    // 12대 애니메이션 원칙(호 Arcs & 추진 가속 Ease-In) 적용:
    // 1) 가속도: 출발 시 마력이 방출되어 살짝 가속하며 타격 지점에 내리꽂힘
    // 2) 호(Arc): 기계적 1자 직선 대신 자연스러운 상향 호를 그리며 비행
    const rawP = Math.min(1, Math.max(0, p.progress));
    const easeT = Math.pow(rawP, 1.35);
    const arcHeight = -20;
    const arcOffset = Math.sin(rawP * Math.PI) * arcHeight;

    const x = p.startX + (p.targetX - p.startX) * easeT;
    const y = p.startY + (p.targetY - p.startY) * easeT + arcOffset;

    emitComicTrail(p, x, y, dt, particles,
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

    drawComicProjectile(ctx, p, x, y, rawP);
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.progress += meteorDt / m.duration;
    if (!state.soundOn && m.flyAudio && !m.flyAudio.paused) {
      try {
        m.flyAudio.pause();
      } catch (e) {}
    }

    if (m.progress >= 1) {
      if (m.flyAudio) {
        try {
          m.flyAudio.pause();
          m.flyAudio.currentTime = 0;
        } catch (e) {}
      }
      // 메테오 충돌 시 대규모 화염 폭발 + 이중 충격파 + 사방으로 튀어 나가는 바위 파편들!
      const burstCount = Math.min(reducedMeteor ? 6 : Math.round(30 * m.scale), Math.max(0, 220 - particles.length));
      spawnParticles(m.targetX, m.targetY, burstCount, '#ffe4a0', '#e8592f', 1.8 * m.scale);
      if (!reducedMeteor) spawnMeteorRockDebris(m.targetX, m.targetY, m.scale);
      if (!reducedMeteor && shockwaves.length <= 28) {
        shockwaves.push({
          x: m.targetX,
          y: m.targetY + 12,
          life: 0,
          maxLife: 0.45,
          maxRadius: 125 * m.scale,
          rgb: '251, 146, 60',
          flat: true,
          lineWidth: 6 * m.scale
        });
        shockwaves.push({
          x: m.targetX,
          y: m.targetY,
          life: 0,
          maxLife: 0.35,
          maxRadius: 85 * m.scale,
          rgb: '254, 240, 138',
          flat: false,
          lineWidth: 4.5 * m.scale
        });
      }
      const now = performance.now() / 1000;
      if (!reducedMeteor && m.scale >= 0.9 && now - lastMeteorShakeTime >= 0.3) {
        lastMeteorShakeTime = now;
        triggerArenaShake('lg');
      }
      playSound('meteor_impact');
      if (m.onImpact) m.onImpact();
      meteors.splice(i, 1);
      continue;
    }

    const pose = getMeteorPose(m);
    emitMeteorTrail(m, pose, meteorDt, particles, reducedMeteor);
    drawComicMeteor(ctx, m, pose);
  }

  // 메테오 충돌 시 사방으로 튀어 나가는 바위 파편(Rock Debris) 물리 업데이트 및 렌더링
  for (let i = rockDebris.length - 1; i >= 0; i--) {
    const d = rockDebris[i];
    d.life += meteorDt;
    if (d.life >= d.maxLife) {
      rockDebris.splice(i, 1);
      continue;
    }
    d.x += d.vx * meteorDt;
    d.y += d.vy * meteorDt;
    d.vy += d.gravity * meteorDt;
    d.rot += d.vRot * meteorDt;

    // 지면에 닿으면 한 번 튕겨 오르는 바운스 물리 연출
    if (!d.bounced && d.y >= d.groundY && d.vy > 0) {
      d.y = d.groundY;
      d.vy *= -0.44;
      d.vx *= 0.72;
      d.vRot *= 0.65;
      d.bounced = true;
    }

    const alpha = d.life > d.maxLife * 0.7 ? Math.max(0, 1 - (d.life - d.maxLife * 0.7) / (d.maxLife * 0.3)) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.beginPath();
    ctx.moveTo(d.verts[0].x, d.verts[0].y);
    for (let v = 1; v < d.verts.length; v++) {
      ctx.lineTo(d.verts[v].x, d.verts[v].y);
    }
    ctx.closePath();
    ctx.fillStyle = d.isMolten ? '#44403c' : '#292524';
    ctx.fill();
    ctx.strokeStyle = d.isMolten ? '#f97316' : '#78716c';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  // 몬스터 사망 시 하스스톤 영웅 초상화처럼 여러 조각으로 갈라지며 흩어지는 파편(Monster Shards) 렌더링
  for (let i = monsterShards.length - 1; i >= 0; i--) {
    const s = monsterShards[i];
    s.life += dt;
    if (s.life >= s.maxLife) {
      monsterShards.splice(i, 1);
      continue;
    }

    if (s.life < s.crackHoldTime) {
      // 1단계 (0~65ms): 균열이 번쩍이며 조각들이 중심에서 살짝 벌어지는 하스스톤 특유의 프리-브레이크 연출
      const p = s.life / s.crackHoldTime;
      const spread = 6.5 * (1 - Math.pow(1 - p, 2));
      s.x = s.baseX + s.outDirX * spread;
      s.y = s.baseY + s.outDirY * spread;
      s.scale = 1.0 + 0.05 * p;
    } else {
      // 2단계 (65ms~): 사방으로 폭발하듯 회전하며 튕겨 나가는 물리 모션
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += s.gravity * dt;
      s.rot += s.vRot * dt;
      const flyProg = (s.life - s.crackHoldTime) / (s.maxLife - s.crackHoldTime);
      s.scale = Math.max(0.45, 1.05 - flyProg * 0.48);
    }

    const fadeStart = s.maxLife * 0.58;
    const alpha =
      s.life > fadeStart
        ? Math.max(0, 1 - (s.life - fadeStart) / (s.maxLife - fadeStart))
        : 1.0;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.scale(s.scale, s.scale);

    // 다각형 조각 모양으로 클리핑 후 원본 초상화(배경 + 테두리 + 몬스터 이모지)를 그대로 투영
    ctx.beginPath();
    ctx.moveTo(s.localVerts[0].x, s.localVerts[0].y);
    for (let v = 1; v < s.localVerts.length; v++) {
      ctx.lineTo(s.localVerts[v].x, s.localVerts[v].y);
    }
    ctx.closePath();
    ctx.save();
    ctx.clip();

    const ox = -s.cx;
    const oy = -s.cy;
    const bgGrad = ctx.createRadialGradient(ox, oy, 6, ox, oy, 63);
    bgGrad.addColorStop(0, s.life < s.crackHoldTime ? '#7f1d1d' : '#2b3346');
    bgGrad.addColorStop(1, '#151924');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(ox, oy, 63, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = s.isBoss ? '#f59e0b' : '#64748b';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.font = '59px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.emoji, ox, oy);
    ctx.restore();

    // 깨진 조각 단면을 따라 빛나는 균열 테두리
    ctx.beginPath();
    ctx.moveTo(s.localVerts[0].x, s.localVerts[0].y);
    for (let v = 1; v < s.localVerts.length; v++) {
      ctx.lineTo(s.localVerts[v].x, s.localVerts[v].y);
    }
    ctx.closePath();
    ctx.strokeStyle = s.life < s.crackHoldTime * 1.6 ? '#ffffff' : '#fbbf24';
    ctx.lineWidth = s.life < s.crackHoldTime ? 2.8 : 1.9;
    ctx.stroke();
    ctx.restore();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life += dt;
    if (pt.life >= pt.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    if (pt.materialChip) {
      pt.vy += 540 * dt;
      pt.vx *= Math.exp(-2 * dt);
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.life * 5);
      ctx.globalAlpha = Math.min(1, (pt.maxLife - pt.life) / .15);
      ctx.fillStyle = pt.colorCore; ctx.fillRect(-pt.radius, -pt.radius/2, pt.radius*2, pt.radius);
      ctx.strokeStyle = pt.colorEdge; ctx.lineWidth = 1; ctx.strokeRect(-pt.radius, -pt.radius/2, pt.radius*2, pt.radius);
      ctx.restore(); continue;
    }
    if (pt.slimeDrop) {
      drawSlimeDrop(ctx, pt, dt);
      continue;
    }
    const alpha = 1 - pt.life / pt.maxLife;
    ctx.fillStyle = pt.life < pt.maxLife * 0.4 ? pt.colorCore : pt.colorEdge;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    if (pt.comicTrail) {
      // 둥근 광점 대신 만화 원화와 같은 각진 불씨가 작아지며 사라집니다.
      const r = pt.radius * alpha;
      ctx.moveTo(pt.x + r * 1.8, pt.y);
      ctx.lineTo(pt.x - r, pt.y - r * 0.7);
      ctx.lineTo(pt.x - r * 0.4, pt.y);
      ctx.lineTo(pt.x - r * 1.4, pt.y + r * 0.6);
      pt.vx *= Math.exp(-5 * dt);
      pt.vy += 65 * dt;
    } else {
      ctx.arc(pt.x, pt.y, pt.radius * alpha, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  updateFloatingTexts(dt);
}

function triggerArenaShake(level) {
  if (!level) return;
  const arena = document.getElementById('combat-arena');
  const cls = level === 'lg' ? 'shake-lg' : 'shake-sm';
  arena.classList.remove('shake-sm', 'shake-lg');
  void arena.offsetWidth;
  arena.classList.add(cls);
}

// ==========================================
// 8. 플로팅 텍스트 (와우 스타일 포물선 궤적 & 크리티컬 스케일 펀치)
// ==========================================
const floatingTexts = [];
const fctArcState = {
  lastSide: 1,
  fanStep: 0,
  critStep: 0,
  dotSide: -1
};

function spawnFloatingText(text, styleClass, offsetY = 0, extraOpts = {}) {
  const layer = document.getElementById('fct-layer');
  if (!layer) return;

  // 화면 내 과도한 DOM 누적으로 인한 프레임 드랍 방지
  while (floatingTexts.length >= 45) {
    const oldest = floatingTexts.shift();
    if (oldest && oldest.el) oldest.el.remove();
  }

  const pos = extraOpts.anchor === 'caster' ? getCasterCenter() : getTargetPos();
  const isCrit = styleClass === 'fct-crit';
  const isDot = styleClass === 'fct-dot';
  const isNormal = styleClass === 'fct-normal';
  const isGold = styleClass === 'fct-gold' || styleClass === 'fct-essence';
  const isBig = Boolean(extraOpts.isBig);

  const el = document.createElement('div');
  el.className = `fct-item ${styleClass}${isCrit ? ' crit-flash' : ''}${isCrit && isBig ? ' fct-big-crit' : ''}`;
  el.textContent = text;

  let x = pos.x;
  let y = pos.y + offsetY;
  let vx = 0;
  let vy = -200;
  let gravity = 680;
  let maxLife = 0.95;
  let holdTime = 0;

  if (isCrit) {
    // 크리티컬 데미지: 가장 낮은 속도(-240)와 가장 높은 속도(-960)가 정확히 4배 차이가 나도록 설정하고,
    // 연속 치명타 시 텍스트가 절대 한곳에 겹치지 않도록 5단계 교차 속도 대역(저속 ➔ 고속 ➔ 중저속 ➔ 최고속 ➔ 중속) 순환!
    if (Math.random() < 0.88) {
      fctArcState.lastSide *= -1;
    }
    const side = fctArcState.lastSide;
    const critBand = fctArcState.critStep;
    fctArcState.critStep = (fctArcState.critStep + 1) % 5;

    // 최저 240 ~ 최고 960 (4.0배 차이) 구간을 5개 교차 대역으로 분배
    const critVelBands = [
      { vyMin: -240, vyMax: -320, vxMin: 28, vxMax: 52 },   // 1단계: 최저속 (1.0x ~ 1.33x)
      { vyMin: -700, vyMax: -810, vxMin: 68, vxMax: 96 },   // 2단계: 고속 (2.9x ~ 3.38x)
      { vyMin: -370, vyMax: -470, vxMin: 84, vxMax: 112 },  // 3단계: 중저속 + 넓은 측면 (1.54x ~ 1.96x)
      { vyMin: -850, vyMax: -960, vxMin: 36, vxMax: 68 },   // 4단계: 최고속 (3.54x ~ 4.0x)
      { vyMin: -520, vyMax: -640, vxMin: 52, vxMax: 84 }    // 5단계: 중속 (2.17x ~ 2.67x)
    ];
    const bandProf = critVelBands[critBand];
    const bigMult = isBig ? 1.12 : 1.0;

    const randVy = (bandProf.vyMin + Math.random() * (bandProf.vyMax - bandProf.vyMin)) * bigMult;
    const randVx = (bandProf.vxMin + Math.random() * (bandProf.vxMax - bandProf.vxMin)) * bigMult;

    x = pos.x + side * (8 + Math.random() * 22);
    y = pos.y - 18 + offsetY + (Math.random() * 16 - 8);
    vx = side * randVx;
    vy = randVy;
    gravity = 0;
    maxLife = isBig ? 1.08 : 0.98;
    holdTime = 0;
  } else if (isNormal) {
    // 일반 데미지: 연속 타격 시 좌/우 방향 교차 및 5단계 부채꼴 각도 순환
    if (Math.random() < 0.84) {
      fctArcState.lastSide *= -1;
    }
    const side = fctArcState.lastSide;
    const band = fctArcState.fanStep;
    fctArcState.fanStep = (fctArcState.fanStep + 1) % 5;

    const angleProfiles = [
      { vxMin: 48, vxMax: 74, vyMin: -255, vyMax: -285 },
      { vxMin: 92, vxMax: 128, vyMin: -215, vyMax: -245 },
      { vxMin: 32, vxMax: 56, vyMin: -275, vyMax: -305 },
      { vxMin: 118, vxMax: 154, vyMin: -190, vyMax: -220 },
      { vxMin: 72, vxMax: 104, vyMin: -235, vyMax: -265 }
    ];
    const prof = angleProfiles[band];
    const randVx = prof.vxMin + Math.random() * (prof.vxMax - prof.vxMin);
    const randVy = prof.vyMin + Math.random() * (prof.vyMax - prof.vyMin);

    x = pos.x + side * (5 + Math.random() * 16);
    y = pos.y - 12 + offsetY + (Math.random() * 16 - 8);
    vx = side * randVx;
    vy = randVy;
    gravity = 720;
    maxLife = 0.92;
  } else if (isDot) {
    // 도트(화상/연소) 데미지는 몬스터 좌/우 측면에서 짧고 경쾌한 포물선으로 톡톡 튀어나와 바닥으로 낙하
    fctArcState.dotSide *= -1;
    const side = Math.random() < 0.85 ? fctArcState.dotSide : -fctArcState.dotSide;
    x = pos.x + side * (24 + Math.random() * 20);
    y = pos.y - 2 + offsetY + (Math.random() * 16 - 8);
    vx = side * (62 + Math.random() * 55);
    vy = -(145 + Math.random() * 48);
    gravity = 650;
    maxLife = 0.82;
  } else if (isGold) {
    const side = Math.random() < 0.5 ? -1 : 1;
    x = pos.x + (Math.random() * 24 - 12);
    y = pos.y - 20 + offsetY;
    vx = side * (38 + Math.random() * 45);
    vy = -(225 + Math.random() * 35);
    gravity = 620;
    maxLife = 1.08;
  } else {
    // 프록 알림 (🔥 연쇄 폭발! 등)
    x = pos.x + (Math.random() * 16 - 8);
    y = pos.y - 32 + offsetY;
    vx = (Math.random() - 0.5) * 36;
    vy = -165;
    gravity = 420;
    maxLife = 1.05;
    holdTime = 0.08;
  }

  const item = {
    el,
    type: isCrit ? 'crit' : isDot ? 'dot' : isNormal ? 'normal' : isGold ? 'gold' : 'proc',
    isBig,
    x,
    y,
    vx,
    vy,
    gravity,
    life: 0,
    maxLife,
    holdTime,
    flashed: isCrit
  };

  applyFloatingTextTransform(item);
  layer.appendChild(el);
  floatingTexts.push(item);
}

function applyFloatingTextTransform(f) {
  const t = f.life;
  const prog = Math.min(1, t / f.maxLife);
  let scale = 1.0;
  let rotDeg = 0;

  if (f.type === 'crit') {
    // 강화된 크리티컬 스케일 펀치:
    // 1) 폭발적 팽창 (0~55ms: 0.15배 ➔ 최대 2.9~3.35배)
    // 2) 최대 크기 체공 (55~105ms: 눈에 확실히 각인되는 임팩트 홀드)
    // 3) 묵직한 스탬프 내리꽂기 & 언더슈트 (105~185ms: 팍! 하고 화면에 박힘)
    // 4) 탄성 리바운드 안착 (185~270ms: 쫀득한 반동 후 정착)
    const peak = f.isBig ? 3.35 : 2.9;
    const settle = f.isBig ? 1.28 : 1.15;
    if (t < 0.055) {
      const p = t / 0.055;
      const easeOut = 1 - Math.pow(1 - p, 3);
      scale = 0.15 + (peak - 0.15) * easeOut;
      rotDeg = -4.5 * Math.sin(p * Math.PI);
    } else if (t < 0.105) {
      const p = (t - 0.055) / 0.05;
      scale = peak - peak * 0.05 * p;
      rotDeg = 3.2 * (1 - p);
    } else if (t < 0.185) {
      const p = (t - 0.105) / 0.08;
      const slamEase = p * p;
      const under = settle * 0.82;
      scale = peak * 0.95 - (peak * 0.95 - under) * slamEase;
      rotDeg = -2.2 * Math.sin(p * Math.PI);
    } else if (t < 0.27) {
      const p = (t - 0.185) / 0.085;
      const under = settle * 0.82;
      const over = settle * 1.12;
      if (p < 0.55) {
        const subP = p / 0.55;
        scale = under + (over - under) * (1 - Math.pow(1 - subP, 2));
      } else {
        const subP = (p - 0.55) / 0.45;
        scale = over - (over - settle) * subP;
      }
    } else {
      scale = settle;
    }
  } else if (f.type === 'normal') {
    // 일반 데미지: '뿅!' 하고 탄력 있게 튀어나오는 팝인 스케일
    if (t < 0.05) {
      const p = t / 0.05;
      scale = 0.32 + (1.24 - 0.32) * (1 - Math.pow(1 - p, 2));
    } else if (t < 0.11) {
      const p = (t - 0.05) / 0.06;
      scale = 1.24 - 0.24 * p;
    } else {
      scale = 1.0;
    }
  } else if (f.type === 'dot') {
    if (t < 0.045) {
      const p = t / 0.045;
      scale = 0.4 + (1.14 - 0.4) * p;
    } else if (t < 0.095) {
      const p = (t - 0.045) / 0.05;
      scale = 1.14 - 0.18 * p;
    } else {
      scale = 0.96;
    }
  } else {
    // proc / gold / essence
    if (t < 0.055) {
      const p = t / 0.055;
      scale = 0.35 + (1.32 - 0.35) * (1 - Math.pow(1 - p, 2));
    } else if (t < 0.12) {
      const p = (t - 0.055) / 0.065;
      scale = 1.32 - 0.32 * p;
    } else {
      scale = 1.0;
    }
  }

  let opacity = 1.0;
  if (f.type === 'crit') {
    // 크리티컬은 위로 쭉 올라가면서 후반부(68%~100%)에 자연스럽게 페이드 아웃
    if (prog > 0.68) {
      const fadeProg = (prog - 0.68) / 0.32;
      opacity = Math.max(0, Math.pow(1 - fadeProg, 1.4));
    }
  } else if (prog > 0.65) {
    const fadeProg = (prog - 0.65) / 0.35;
    opacity = Math.max(0, Math.pow(1 - fadeProg, 1.45));
    scale *= 1 - fadeProg * 0.12;
  }

  f.el.style.opacity = opacity.toFixed(3);
  const rotStr = rotDeg !== 0 ? ` rotate(${rotDeg.toFixed(1)}deg)` : '';
  f.el.style.transform = `translate3d(${f.x.toFixed(2)}px, ${f.y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)})${rotStr}`;
}

// ==========================================
// 8-B. 캔디크러시 스타일 골드 동전 & 불꽃의 정수 곡선 비행 흡수 연출
// ==========================================
const flyingCoins = [];
let goldPulseTimeout = null;
let essencePulseTimeout = null;

function triggerGoldPillPulse() {
  const pill = document.getElementById('pill-gold');
  if (!pill) return;
  pill.classList.remove('gold-absorb-pulse');
  void pill.offsetWidth;
  pill.classList.add('gold-absorb-pulse');
  if (goldPulseTimeout) clearTimeout(goldPulseTimeout);
  goldPulseTimeout = setTimeout(() => {
    pill.classList.remove('gold-absorb-pulse');
  }, 250);
}

function triggerEssencePillPulse() {
  const pill = document.getElementById('pill-essence');
  if (!pill) return;
  pill.classList.remove('essence-absorb-pulse');
  void pill.offsetWidth;
  pill.classList.add('essence-absorb-pulse');
  if (essencePulseTimeout) clearTimeout(essencePulseTimeout);
  essencePulseTimeout = setTimeout(() => {
    pill.classList.remove('essence-absorb-pulse');
  }, 260);
}

function spawnGoldCoinFlight(totalGold, isBigReward = false, customStartEl = null) {
  const layer = document.getElementById('coin-fx-layer');
  const rewardEl = customStartEl || document.getElementById('target-reward');
  const goldPillEl = document.getElementById('pill-gold') || document.getElementById('ui-gold');

  if (!layer || !rewardEl || !goldPillEl) {
    state.pendingCoinGold = 0;
    return;
  }

  // 출발지 배지 팝 애니메이션
  rewardEl.classList.remove('reward-pop');
  void rewardEl.offsetWidth;
  rewardEl.classList.add('reward-pop');

  const startRect = rewardEl.getBoundingClientRect();
  const endRect = goldPillEl.getBoundingClientRect();

  const baseStartX = startRect.left + startRect.width * 0.5;
  const baseStartY = startRect.top + startRect.height * 0.5;
  const endX = endRect.left + endRect.width * 0.5;
  const endY = endRect.top + endRect.height * 0.5;

  const coinCount = isBigReward ? 9 : 6;
  const baseShare = Math.floor(totalGold / coinCount);
  let remainingShare = totalGold;

  state.pendingCoinGold = (state.pendingCoinGold || 0) + totalGold;

  for (let i = 0; i < coinCount; i++) {
    const share = i === coinCount - 1 ? remainingShare : baseShare;
    remainingShare -= share;

    const el = document.createElement('div');
    el.className = 'flying-gold-coin';
    el.style.opacity = '0';
    layer.appendChild(el);

    const startX = baseStartX + (Math.random() * 14 - 7);
    const startY = baseStartY + (Math.random() * 8 - 4);

    // 캔디크러시 스타일 우아한 3차 베지어 곡선(Cubic Bezier Curve) 제어점 생성
    // 동전이 하나씩 튀어나올 때마다 살짝 아래·외곽으로 둥글게 부풀어 올랐다가 호를 그리며 상단 골드 UI로 빨려 들어감
    const curveSide = i % 2 === 0 ? -1 : 1;
    const spreadFactor = 1 + (i % 3) * 0.28;
    const cp1X = startX + curveSide * (68 * spreadFactor) + (Math.random() * 24 - 12);
    const cp1Y = startY + 54 + (i % 3) * 20 + Math.random() * 14;

    const cp2X = (startX + endX) * 0.5 + curveSide * (52 * spreadFactor) + (Math.random() * 18 - 9);
    const cp2Y = Math.min(startY, endY) - 28 - (i % 2) * 18;

    flyingCoins.push({
      kind: 'gold',
      el,
      startX,
      startY,
      cp1X,
      cp1Y,
      cp2X,
      cp2Y,
      endX: endX + (Math.random() * 10 - 5),
      endY: endY + (Math.random() * 6 - 3),
      delay: i * 0.058, // 하나씩 다다다닥 튀어나오는 시간차(58ms)
      life: 0,
      duration: 0.58 + (i % 3) * 0.04,
      share,
      started: false
    });
  }
}

function spawnEssenceFlight(totalEssence, customStartEl = null) {
  if (!totalEssence || totalEssence <= 0) return;

  const layer = document.getElementById('coin-fx-layer');
  const monsterEl = customStartEl || document.getElementById('dummy-avatar') || document.getElementById('target-stage-box');
  const essencePillEl = document.getElementById('pill-essence') || document.getElementById('ui-essence');

  if (!layer || !monsterEl || !essencePillEl) {
    state.pendingEssence = 0;
    return;
  }

  if (customStartEl) {
    customStartEl.classList.remove('reward-pop');
    void customStartEl.offsetWidth;
    customStartEl.classList.add('reward-pop');
  }

  const startRect = monsterEl.getBoundingClientRect();
  const endRect = essencePillEl.getBoundingClientRect();

  if (endRect.width === 0 && endRect.height === 0) {
    state.pendingEssence = 0;
    return;
  }

  const baseStartX = startRect.left + startRect.width * 0.5;
  const baseStartY = startRect.top + startRect.height * 0.45;
  const endX = endRect.left + endRect.width * 0.5;
  const endY = endRect.top + endRect.height * 0.5;

  const orbCount = Math.min(7, Math.max(1, Math.round(totalEssence)));
  const baseShare = Math.floor(totalEssence / orbCount);
  let remainingShare = totalEssence;

  state.pendingEssence = (state.pendingEssence || 0) + totalEssence;

  for (let i = 0; i < orbCount; i++) {
    const share = i === orbCount - 1 ? remainingShare : baseShare;
    remainingShare -= share;

    const el = document.createElement('div');
    el.className = 'flying-essence-orb';
    el.textContent = '';
    el.style.opacity = '0';
    layer.appendChild(el);

    const startX = baseStartX + (Math.random() * 28 - 14);
    const startY = baseStartY + (Math.random() * 22 - 11);

    // 몬스터에서 사방으로 톡 튀어나왔다가 우아한 호를 그리며 상단 정수 자원 UI(#pill-essence)로 흡수
    const curveSide = i % 2 === 0 ? 1 : -1;
    const spreadFactor = 1 + (i % 3) * 0.34;
    const cp1X = startX + curveSide * (85 * spreadFactor) + (Math.random() * 30 - 15);
    const cp1Y = startY + 42 + (i % 3) * 24 + (Math.random() * 20 - 10);

    const cp2X = (startX + endX) * 0.5 + curveSide * (60 * spreadFactor) + (Math.random() * 20 - 10);
    const cp2Y = Math.min(startY, endY) - 36 - (i % 2) * 22;

    flyingCoins.push({
      kind: 'essence',
      el,
      startX,
      startY,
      cp1X,
      cp1Y,
      cp2X,
      cp2Y,
      endX: endX + (Math.random() * 8 - 4),
      endY: endY + (Math.random() * 6 - 3),
      delay: i * 0.065,
      life: 0,
      duration: 0.64 + (i % 3) * 0.045,
      share,
      started: false
    });
  }
}

function updateFlyingCoins(dt) {
  for (let i = flyingCoins.length - 1; i >= 0; i--) {
    const c = flyingCoins[i];
    if (c.delay > 0) {
      c.delay -= dt;
      continue;
    }

    if (!c.started) {
      c.started = true;
      c.el.style.opacity = '1';
    }

    c.life += dt;
    const rawT = Math.min(1, c.life / c.duration);

    if (rawT >= 1) {
      c.el.remove();
      flyingCoins.splice(i, 1);

      if (c.kind === 'essence') {
        state.pendingEssence = Math.max(0, (state.pendingEssence || 0) - c.share);
        if (!flyingCoins.some((item) => item.kind === 'essence')) {
          state.pendingEssence = 0;
        }
        triggerEssencePillPulse();
        playSound('drop_coin');
      } else {
        state.pendingCoinGold = Math.max(0, (state.pendingCoinGold || 0) - c.share);
        if (!flyingCoins.some((item) => item.kind === 'gold')) {
          state.pendingCoinGold = 0;
        }
        triggerGoldPillPulse();
        playSound('drop_coin');
      }
      continue;
    }

    // 초반(0~25%)엔 톡 튀어나오며 완만하게 곡선을 시작하고, 후반부로 갈수록 가속하며 흡수되는 이징 곡선
    const u = rawT < 0.25
      ? rawT * 0.85
      : 0.2125 + Math.pow((rawT - 0.25) / 0.75, 1.75) * 0.7875;
    const inv = 1 - u;

    // 3차 베지어 곡선 B(u) 계산
    const x =
      inv * inv * inv * c.startX +
      3 * inv * inv * u * c.cp1X +
      3 * inv * u * u * c.cp2X +
      u * u * u * c.endX;
    const y =
      inv * inv * inv * c.startY +
      3 * inv * inv * u * c.cp1Y +
      3 * inv * u * u * c.cp2Y +
      u * u * u * c.endY;

    // 팝아웃 스케일 펀치 후 알약 UI로 빨려 들어갈 때 자연스럽게 축소
    let scale = 1.0;
    if (rawT < 0.16) {
      const p = rawT / 0.16;
      scale = 0.28 + (1.3 - 0.28) * (1 - Math.pow(1 - p, 2));
    } else if (rawT < 0.3) {
      const p = (rawT - 0.16) / 0.14;
      scale = 1.3 - 0.3 * p;
    } else if (rawT > 0.78) {
      const p = (rawT - 0.78) / 0.22;
      scale = 1.0 - 0.34 * p;
    }

    const rotDeg = c.kind === 'essence' ? Math.sin(rawT * Math.PI * 3) * 18 : rawT * 360;
    c.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${rotDeg.toFixed(1)}deg)`;
  }
}

function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.life += dt;
    if (f.life >= f.maxLife) {
      f.el.remove();
      floatingTexts.splice(i, 1);
      continue;
    }

    // 크리티컬 첫 임팩트 순간 화이트핫 플래시 해제 (최대 스케일 체공 시점까지 유지)
    if (f.flashed && f.life >= 0.105) {
      f.flashed = false;
      f.el.classList.remove('crit-flash');
    }

    const motionScale = f.life < f.holdTime ? (f.type === 'crit' ? 0.08 : 0.22) : 1.0;
    const effDt = dt * motionScale;

    f.x += f.vx * effDt;
    f.y += f.vy * effDt;

    if (f.type === 'crit') {
      // 강한 Ease-Out 감속: 처음엔 '팍~!' 하고 빠르게 위로 솟구쳤다가 급격히 속도가 감소해 잔잔하게 부유
      const decay = Math.pow(0.002, effDt);
      f.vx *= decay;
      f.vy *= decay;
      if (f.vy > -12) f.vy = -12;
    } else {
      f.vy += f.gravity * effDt;
      // 수평 공기 저항으로 자연스러운 포물선 곡률 형성
      f.vx *= Math.pow(0.92, effDt * 60 * 0.016);
    }

    applyFloatingTextTransform(f);
  }

  updateFlyingCoins(dt);
}

// ==========================================
// 9. 스테이지 설정 및 몬스터 처치 처리 (제한시간 제거)
// ==========================================
function loadStage(stageNum) {
  if (state.isTrainingDummy) {
    state.monster.maxHp = 999999999999;
    state.monster.hp = 999999999999;
    state.monster.isDying = false;
    state.combat.ignitePool = 0;
    state.combat.igniteRem = 0;
    state.combat.meteorBurnRem = 0;
    updateBurningLoopSound();

    const nameLabel = document.getElementById('monster-name-label');
    if (nameLabel) nameLabel.textContent = '🎯 훈련용 허수아비 (무한 체력)';
    const hpText = document.getElementById('target-hp-text');
    if (hpText) hpText.textContent = '무한 체력';
    const hpPct = document.getElementById('target-hp-pct');
    if (hpPct) hpPct.textContent = '100%';
    const hpFill = document.getElementById('target-hp-fill');
    if (hpFill) hpFill.style.width = '100%';
    const dummyEmoji = document.getElementById('dummy-emoji');
    if (dummyEmoji) {
      dummyEmoji.textContent = '🪵';
      dummyEmoji.dataset.art = 'dummy';
    }
    const dummyBanner = document.getElementById('training-dummy-banner');
    if (dummyBanner) dummyBanner.classList.remove('hidden');
    const stageBanner = document.getElementById('arena-stage-banner');
    if (stageBanner) stageBanner.classList.add('hidden');
    const centerInfo = document.getElementById('stage-center-info');
    if (centerInfo) centerInfo.classList.add('hidden');
    return;
  }

  const dummyBanner = document.getElementById('training-dummy-banner');
  if (dummyBanner) dummyBanner.classList.add('hidden');
  const stageBanner = document.getElementById('arena-stage-banner');
  if (stageBanner) stageBanner.classList.remove('hidden');
  const centerInfo = document.getElementById('stage-center-info');
  if (centerInfo) centerInfo.classList.remove('hidden');

  state.currentStage = Math.max(1, stageNum);
  const data = getStageData(state.currentStage);
  if (arenaEnvironment) arenaEnvironment.setStage(state.currentStage);
  state.monster.maxHp = data.hp;
  state.monster.hp = data.hp;
  state.monster.isDying = false;
  if (data.isPhaseBoss) {
    state.currentBossFightStartTime = performance.now() / 1000;
  } else {
    state.currentBossFightStartTime = null;
  }

  state.combat.ignitePool = 0;
  state.combat.igniteRem = 0;
  state.combat.meteorBurnRem = 0;
  updateBurningLoopSound();

  // 페이즈 보스 전용 기믹 상태 초기화
  state.bossGimmick = {
    active: false,
    type: null,
    shield: 0,
    maxShield: 0,
    shieldTimer: 0,
    shieldTriggered: false,
    isAirborne: false,
    airborneDone: false,
    groggyTimer: 0
  };
  const dummyEl = document.getElementById('dummy-avatar');
  if (dummyEl) dummyEl.classList.remove('airborne-flying');

  checkAndRecordDpsClear();
  updateStageUI();
}

function switchRightTab(tabName) {
  document.getElementById('tab-btn-shop').classList.toggle('active', tabName === 'shop');
  const infBtn = document.getElementById('tab-btn-infusion');
  if (infBtn) infBtn.classList.toggle('active', tabName === 'infusion');
  document.getElementById('tab-btn-tree').classList.toggle('active', tabName === 'tree');
  const artBtn = document.getElementById('tab-btn-artifacts');
  if (artBtn) artBtn.classList.toggle('active', tabName === 'artifacts');

  document.getElementById('pane-shop').classList.toggle('active', tabName === 'shop');
  const infPane = document.getElementById('pane-infusion');
  if (infPane) infPane.classList.toggle('active', tabName === 'infusion');
  document.getElementById('pane-tree').classList.toggle('active', tabName === 'tree');
  const artPane = document.getElementById('pane-artifacts');
  if (artPane) artPane.classList.toggle('active', tabName === 'artifacts');
  updateNotificationBadges();
}

function getFirstClearEssenceBonus(stageNum) {
  const data = getStageData(stageNum);
  if (!data.isPhaseBoss) return 0; // 일반 몬스터는 정수를 주지 않음!
  const stats = getPlayerStats();
  const base = Math.max(30, Math.round(stageNum * 6));
  return Math.max(1, Math.round(base * (stats.essenceMult || 1)));
}

function onMonsterKilled() {
  if (state.monster.isDying) return;
  state.monster.isDying = true;

  const data = getStageData(state.currentStage);
  const stats = getPlayerStats();
  const isFirstClear = state.currentStage > state.highestClearedStage;
  const isFirstRagnarosKill = state.currentStage === 20 && !state.campaignCleared;
  const isRagnarosKill = state.currentStage === 20;
  let totalGold = Math.max(1, Math.round(data.gold * (stats.goldMult || 1)));
  let gainedEssence = 0;

  state.totalKills = (state.totalKills || 0) + 1;
  checkBountyProgress('monster_kill', 1);
  if (data.isPhaseBoss && state.currentBossFightStartTime) {
    const duration = Math.max(0.1, (performance.now() / 1000) - state.currentBossFightStartTime);
    if (!state.stats) state.stats = {};
    state.stats.lastBossKillDuration = duration;
    const prevBest = state.bossClearTimes ? state.bossClearTimes[state.currentStage] : null;
    if (typeof prevBest === 'number') {
      const diff = prevBest - duration;
      state.stats.lastBossKillDiff = diff;
      if (duration < prevBest) {
        state.bossClearTimes[state.currentStage] = duration;
      }
    } else {
      if (!state.bossClearTimes) state.bossClearTimes = {};
      state.bossClearTimes[state.currentStage] = duration;
      state.stats.lastBossKillDiff = null;
    }
  }

  if (isFirstClear) {
    state.highestClearedStage = state.currentStage;
    state.recordHighestStage = Math.max(state.recordHighestStage || 0, state.currentStage);
    totalGold += Math.round(data.firstBonus * (stats.goldMult || 1));

    if (data.isPhaseBoss) {
      gainedEssence = getFirstClearEssenceBonus(state.currentStage);
      const isBossSpStage = [5, 10, 15, 20].includes(state.currentStage);
      if (isBossSpStage) {
        spawnFloatingText(`👑 보스 격파! 🌟 +1 SP & 🔹 +${gainedEssence} 정수!`, 'fct-proc', -60, { isBig: true });
      } else {
        spawnFloatingText(`👑 보스 격파! 🔹 +${gainedEssence} 정수!`, 'fct-proc', -60);
      }
      playSound('proc');
    }
  } else {
    // 반복 처치 시: 보스만 100% 확정 정수 지급, 일반 몬스터는 정수 지급 없음!
    if (data.isPhaseBoss) {
      const baseDrop = Math.max(5, Math.floor(state.currentStage * 0.9));
      gainedEssence = Math.max(1, Math.round(baseDrop * (stats.essenceMult || 1)));
    } else {
      gainedEssence = 0;
    }
  }

  state.gold += totalGold;
  if (gainedEssence > 0) {
    state.essence = (state.essence || 0) + gainedEssence;
  }

  if (isRagnarosKill || state.highestClearedStage >= 20) {
    state.campaignCleared = true;
    state.canAscend = true;
    state.unfolded.hallOfFame = true;
  }

  // 정수 UI(#pill-essence)가 처음 해금되는 순간에도 도착 좌표를 정확히 계산할 수 있도록 Unfold를 먼저 실행
  checkAndTriggerUnfolds(false);

  // 골드는 상단 배너(#target-reward)에서 #pill-gold로, 정수는 몬스터(#dummy-avatar)에서 #pill-essence로 곡선 비행 흡수!
  spawnGoldCoinFlight(totalGold, isFirstClear || data.isPhaseBoss);
  if (gainedEssence > 0) {
    spawnEssenceFlight(gainedEssence);
  }

  const pos = getTargetPos();
  // 재질에 맞는 사망 여운. 생물까지 유리처럼 조각내지 않습니다.
  spawnMaterialDeath(state.currentStage, data.isPhaseBoss);
  if (data.isPhaseBoss) triggerArenaShake('lg');

  updateDpsMeterUI();

  if (isFirstRagnarosKill) {
    // 하스스톤 스타일 라그나로스 대폭발 & 드라마틱 여운 (Breathing Room)
    state.isPaused = true;
    playSound('proc');
    spawnFloatingText('👑 화염군주 라그나로스 최초 토벌!', 'fct-crit', -60, { isBig: true });

    // 1.3초간 보스 파괴 연출과 진동 여운을 감상할 충분한 호흡을 둔 뒤 웅장하게 승천 모달 개방!
    setTimeout(() => {
      openVictoryModal(true);
    }, 1300);

    saveGame();
    renderShopUI();
    renderInfusionUI();
    renderSkillTreeUI();
    updateNotificationBadges();
    return;
  } else if (state.autoAdvance !== false && canAdvanceToNextStage()) {
    // 목표 DPS 달성 및 몬스터 1회 이상 처치 완료 시 다음 도전으로 자동 진입!
    loadStage(state.currentStage + 1);
    const nextData = getStageData(state.currentStage);
    spawnFloatingText(
      nextData.isPhaseBoss ? '👑 보스 구역 자동 진입!' : '🚀 다음 도전 자동 진입!',
      'fct-proc',
      -50
    );
  } else {
    // 공격 흐름이 끊기지 않도록 즉시 새 몬스터를 스폰하되, 팝업 등장 모션(.respawn-pop) 적용!
    loadStage(state.currentStage);
  }
  const dummyEl = document.getElementById('dummy-avatar');
  if (dummyEl) {
    dummyEl.className = 'dummy-avatar';
    void dummyEl.offsetWidth;
    dummyEl.classList.add('respawn-pop');
    const dummyEmoji = document.getElementById('dummy-emoji');
    if (dummyEmoji) dummyEmoji.className = 'dummy-emoji';
  }

  saveGame();
  renderShopUI();
  renderInfusionUI();
  renderSkillTreeUI();
  updateNotificationBadges();
}

// ==========================================
// 10. 데미지 적용 & 연쇄 치명타 / 유성우 판정
// ==========================================
let lastHeavyKnockbackTime = 0;
let hitDirectionCounter = 0;
let lastDotShiverTime = 0;

function dealDamage(skillKey, rawDamage, isCrit, canTriggerStreak = true, isDotTick = false) {
  const masteryMult = getSkillMasteryMult(skillKey);
  rawDamage *= masteryMult;

  // 3-1. 페이즈 보스 전용 기믹 판정
  const bg = state.bossGimmick;
  if (state.currentStage === 10) {
    // Phase 2 오우거: 도트 화상이 묻어있을 때 바위 갑옷 융해(+30%), 아닐 때는 35% 감소
    const isDotted = Boolean(state.combat.igniteRem > 0 || state.combat.flamePatchRem > 0);
    if (isDotted) {
      rawDamage *= 1.3;
    } else if (!isDotTick) {
      rawDamage *= 0.65;
    }
  } else if (state.currentStage === 15 && bg) {
    // Phase 3 비룡: 공중 비행 중 일반 화염구 50% 회피, 즉발기(작렬/메테오) 적중 시 추락 기절
    if (bg.isAirborne) {
      if (skillKey === 'fireblast' || skillKey === 'meteor') {
        bg.isAirborne = false;
        bg.groggyTimer = 3.5;
        triggerArenaShake('lg');
        playSound('meteor_impact');
        spawnFloatingText('💥 비룡 격추! 3.5초간 기절!', 'fct-crit', -45, { isBig: true });
        const dEl = document.getElementById('dummy-avatar');
        if (dEl) dEl.classList.remove('airborne-flying');
      } else if (skillKey === 'fireball' && Math.random() < 0.5) {
        spawnFloatingText('💨 빗나감 (공중 회피)', 'fct-normal', 0);
        return;
      }
    } else if (bg.groggyTimer > 0) {
      isCrit = true; // 기절 중 100% 확정 크리티컬
      rawDamage *= getPlayerStats().critDmg;
    }
  } else if (state.currentStage === 20 && bg && bg.shield > 0) {
    // Phase 4 라그나로스: 불의 심장 보호막 우선 흡수
    bg.shield -= Math.round(rawDamage);
    if (bg.shield <= 0) {
      bg.shield = 0;
      bg.shieldTimer = 0;
      triggerArenaShake('lg');
      playSound('meteor_impact');
      spawnFloatingText('💥 불의 심장 파괴! 화염 역류!', 'fct-crit', -50, { isBig: true });
      rawDamage *= 1.5;
    }
  } else if ([3, 7, 12, 17].includes(state.currentStage)) {
    // 일반 몬스터 기믹 1: 가연성 기름막 (도트가 걸려 있는 동안 치명타 피해 2배)
    const isDotted = Boolean(state.combat.igniteRem > 0 || state.combat.flamePatchRem > 0);
    if (isDotted && isCrit) {
      rawDamage *= 2.0;
    }
  } else if ([4, 8, 14, 18].includes(state.currentStage) && bg) {
    // 일반 몬스터 기믹 2: 단단한 껍질 (치명타 2회 시 껍질 파괴 & 즉시 몰열 장전)
    if (!bg.isShellBroken) {
      if (isCrit) {
        bg.shellCritHits = (bg.shellCritHits || 0) + 1;
        if (bg.shellCritHits >= 2) {
          bg.isShellBroken = true;
          triggerArenaShake('sm');
          playSound('meteor_impact');
          spawnFloatingText('💥 껍질 파괴! 몰아치는 열기 충전!', 'fct-crit', -45, { isBig: true });
          if (state.grimoires.meteor) {
            state.combat.critStreak = 2;
            state.combat.streakTimer = 6.0;
          }
        }
      } else if (!isDotTick) {
        rawDamage *= 0.6; // 껍질 방어력: 일반 피해 40% 감소
      }
    }
  }

  if (state.cheats && state.cheats.alwaysCrit) {
    if (!isCrit) {
      rawDamage *= getPlayerStats().critDmg;
      isCrit = true;
    }
  }
  const dmg = Math.max(1, Math.round(rawDamage));
  if (isCrit && !isDotTick && canTriggerStreak) mageGesture.hitStop = 0.03;
  const now = performance.now() / 1000;
  const willKill = state.monster.hp - dmg <= 0;

  state.lastCombatTime = now;
  state.dpsHistory.push({ time: now, amount: dmg });

  // 1-1. 상세 전투 분석 (Details! 딜로그) 및 스킬 통계 갱신
  if (!state.stats) {
    state.stats = {
      totalDamage: 0,
      peakDps: 0,
      biggestCrit: 0,
      biggestCritSkill: '',
      totalHits: 0,
      critHits: 0,
      combustionHits: 0,
      combustionDmg: 0
    };
  }
  state.stats.totalDamage += dmg;
  state.stats.totalHits += 1;
  if (isCrit) {
    state.stats.critHits += 1;
    if (dmg > (state.stats.biggestCrit || 0)) {
      state.stats.biggestCrit = dmg;
      state.stats.biggestCritSkill = skillKey;
    }
  }
  if (state.combat.combustionRem > 0) {
    state.stats.combustionDmg = (state.stats.combustionDmg || 0) + dmg;
    state.stats.combustionHits = (state.stats.combustionHits || 0) + 1;
  }
  if (state.currentDps > (state.stats.peakDps || 0)) {
    state.stats.peakDps = state.currentDps;
  }

  if (state.skillDamage[skillKey]) {
    state.skillDamage[skillKey].dmg += dmg;
    state.skillDamage[skillKey].hits = (state.skillDamage[skillKey].hits || 0) + 1;
    if (isCrit) {
      state.skillDamage[skillKey].crits = (state.skillDamage[skillKey].crits || 0) + 1;
    }
  }

  // 3-2. 순환형 현상금 퀘스트 진척도 체크
  if (isCrit) checkBountyProgress('crit_count', 1);
  if (skillKey === 'meteor') checkBountyProgress('meteor_hit', 1);
  if (skillKey === 'fireblast') checkBountyProgress('fireblast_hit', 1);
  if (state.combat.combustionRem > 0) checkBountyProgress('combustion_dmg', dmg);

  // 타격 즉시 DPS 달성 여부를 체크해 요구 DPS 충족 시 다음 도전 버튼을 즉시 영구 활성화
  const windowSec = 6.0;
  const sumDmg = state.dpsHistory
    .filter((entry) => now - entry.time <= windowSec)
    .reduce((acc, e) => acc + e.amount, 0);
  state.currentDps = Math.round(sumDmg / windowSec);
  checkAndRecordDpsClear();

  const isBigSkill = skillKey === 'meteor';
  const dummyEl = document.getElementById('dummy-avatar');
  const dummyEmoji = document.getElementById('dummy-emoji');
  const targetPos = getTargetPos();
  if (!isDotTick && dummyEmoji && dummyEmoji.dataset.art === 'slime') {
    const slimeBounds = dummyEmoji.getBoundingClientRect();
    const arenaBounds = document.getElementById('combat-arena').getBoundingClientRect();
    spawnSlimeSplash(particles, targetPos.x, targetPos.y,
      getActorGroundPos('dummy-avatar').y, dummyEmoji.dataset.variant === 'blue',
      isCrit || isBigSkill || willKill, now,
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
      { x: slimeBounds.left - arenaBounds.left, y: slimeBounds.top - arenaBounds.top, width: slimeBounds.width });
  }

  prepareMonsterHit(state.currentStage, isCrit || isBigSkill, hitDirectionCounter % 2, isDotTick);
  if (dummyEl && !willKill) {
    const hitClasses = [
      'hit', 'hit-left', 'hit-right', 'crit-hit', 'crit-left', 'crit-right',
      'hit-fireblast', 'hit-golem', 'knockback-pyro', 'knockback-meteor', 'burn-shiver', 'respawn-pop'
    ];

    if (isDotTick) {
      // 도트 틱 적중 시 미세 연소 진동 (0.18초 쿨타임)
      if (now - lastDotShiverTime > 0.18) {
        lastDotShiverTime = now;
        dummyEl.classList.remove(...hitClasses);
        void dummyEl.offsetWidth;
        dummyEl.classList.add('burn-shiver');
      }
    } else {
      const hitDir = (hitDirectionCounter++ % 2 === 0) ? 'left' : 'right';

      if (skillKey === 'meteor') {
        lastHeavyKnockbackTime = now;
        dummyEl.classList.remove(...hitClasses);
        void dummyEl.offsetWidth;
        dummyEl.classList.add('knockback-meteor');
        spawnHitMark('💫');
        if (dummyEmoji) {
          dummyEmoji.classList.remove('emoji-hit', 'emoji-crit');
          void dummyEmoji.offsetWidth;
          dummyEmoji.classList.add('emoji-crit');
        }
      } else if (skillKey === 'fireblast') {
        lastHeavyKnockbackTime = now;
        dummyEl.classList.remove(...hitClasses);
        void dummyEl.offsetWidth;
        dummyEl.classList.add('hit-fireblast');
        spawnHitMark('⚡');
        if (dummyEmoji) {
          dummyEmoji.classList.remove('emoji-hit', 'emoji-crit');
          void dummyEmoji.offsetWidth;
          dummyEmoji.classList.add('emoji-crit');
        }
      } else if (skillKey === 'summon_golem') {
        dummyEl.classList.remove(...hitClasses);
        void dummyEl.offsetWidth;
        dummyEl.classList.add('hit-golem');
        spawnHitMark('💥');
      } else if (now - lastHeavyKnockbackTime > 0.28) {
        dummyEl.classList.remove(...hitClasses);
        void dummyEl.offsetWidth;
        if (isCrit) {
          dummyEl.classList.add(`crit-${hitDir}`);
          spawnHitMark(Math.random() > 0.4 ? '💥' : '💢');
          if (dummyEmoji) {
            dummyEmoji.classList.remove('emoji-hit', 'emoji-crit');
            void dummyEmoji.offsetWidth;
            dummyEmoji.classList.add('emoji-crit');
          }
        } else {
          dummyEl.classList.add(`hit-${hitDir}`);
          if (dummyEmoji) {
            dummyEmoji.classList.remove('emoji-hit', 'emoji-crit');
            void dummyEmoji.offsetWidth;
            dummyEmoji.classList.add('emoji-hit');
          }
        }
      }

      // 캔버스 타격 스파크 및 충격파 방사
      spawnHitSparkVfx(targetPos.x, targetPos.y, isCrit, skillKey);
    }
  }

  if ((isDotTick || skillKey === 'ignite') && !(state.cheats && state.cheats.alwaysCrit)) {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-dot', 5);
  } else if (isCrit) {
    spawnFloatingText(`${fmt(dmg)}!`, 'fct-crit', -8, { isBig: isBigSkill });
    if (!isDotTick && skillKey !== 'meteor') playSound('crit');
    if (state.combat.combustionRem > 0) {
      spawnParticles(targetPos.x, targetPos.y, 12, '#fef08a', '#ea580c', 1.6);
    }
  } else {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-normal', 0);
    if (skillKey !== 'meteor') playSound('hit');
  }

  if (isCrit && !isDotTick && skillKey !== 'ignite') {
    const st = getPlayerStats();
    const golemBonus = (state.skillTree.magma_golem || 0) * 0.15;
    const igniteRatio = (state.grimoires.ignite ? 0.48 : 0.22) * (1 + golemBonus) * (st.igniteMult || 1);
    const igniteAdd = dmg * igniteRatio;
    const remainingCarry = state.combat.igniteRem > 0 ? state.combat.ignitePool * (state.combat.igniteRem / 5.0) : 0;
    state.combat.ignitePool = remainingCarry + igniteAdd;
    state.combat.igniteRem = 5.0;

    // 태고의 발화 핵 마법 부여: 치명타 시 일정 확률로 즉시 불꽃의 정수 +1 추출 (몬스터에서 정수 UI로 비행 흡수!)
    if (st.siphonChance > 0 && Math.random() < st.siphonChance) {
      state.essence = (state.essence || 0) + 1;
      checkAndTriggerUnfolds(false);
      spawnEssenceFlight(1);
      renderInfusionUI();
    }

    const rainLv = state.skillTree.meteor_rain || 0;
    if (rainLv > 0 && skillKey !== 'meteor' && Math.random() < rainLv * 0.14) {
      launchMeteorVfx(() => {
        const curSt = getPlayerStats();
        dealDamage('meteor', curSt.sp * 1.45 * curSt.critDmg, true, false);
      }, 0.65);
    }

    // 불사조 유물: 타오르는 마력순환 (치명타 시 작렬 즉시 재충전)
    const circLv = (state.artifacts && state.artifacts.ignited_circ) || 0;
    if (circLv > 0 && Math.random() < circLv * 0.05) {
      if (state.combat.fbCharges < state.combat.fbMaxCharges) {
        state.combat.fbCharges = Math.min(state.combat.fbMaxCharges, state.combat.fbCharges + 1);
        triggerReadyFlash('skill-2');
        spawnFloatingText('🔄 작열 즉시 충전!', 'fct-proc', -30);
        playSound('proc');
      }
    }
  }

  // 3대 빌드 키스톤: 작열 연소 (도트 틱 발생 시 25% 확률로 작렬 쿨타임 0.4초 단축)
  if (isDotTick && state.activeKeystone === 'dot') {
    if (Math.random() < 0.25 && state.combat.fbCharges < state.combat.fbMaxCharges) {
      state.combat.fbRechargeRem = Math.max(0, state.combat.fbRechargeRem - 0.4);
    }
  }

  // 타오르는 기운 (Heating Up Pity System): 메인 화염구의 비치명타/치명타 스택 갱신
  if (skillKey === 'fireball' && canTriggerStreak) {
    if (isCrit) {
      state.combat.pityCritStacks = 0;
    } else {
      state.combat.pityCritStacks = Math.min(6, (state.combat.pityCritStacks || 0) + 1);
    }
    updatePityCritBadgeUI();
  }

  if (canTriggerStreak && state.grimoires.meteor) {
    if (isCrit) {
      if (state.combat.critStreak === 0) {
        state.combat.critStreak = 1;
        state.combat.streakTimer = 8.0;
      } else if (state.combat.critStreak === 1) {
        state.combat.critStreak = 2;
        state.combat.streakTimer = 12.0;
        playSound('proc');
        triggerReadyFlash('skill-3');
      }
    } else if (skillKey === 'fireball') {
      if (state.combat.critStreak === 1) {
        state.combat.critStreak = 0;
      }
    }
  }

  state.monster.hp = Math.max(0, state.monster.hp - dmg);
  if (state.monster.hp <= 0 && !state.monster.isDying) {
    onMonsterKilled();
  }
}

// ==========================================
// 11. 소환수 공격 및 스폰 연출 로직
// ==========================================
function triggerFireSpiritSpawn() {
  state.combat.elemSpawnTimer = 0.55;
  const casterCenter = getCasterCenter();
  const ex = casterCenter.x + 58;
  const ey = casterCenter.y - 68;
  // 소환 폭발 파티클 방출 & 소환 효과음 재생
  spawnParticles(ex, ey, 24, '#fef08a', '#ea580c', 1.35);
  playSound('summon_spirit');
}

function fireElementalAttack() {
  const lv = state.skillTree.fire_elem || 0;
  if (lv <= 0) return;
  const casterCenter = getCasterCenter();
  const target = getTargetPos();
  state.combat.elemRecoil = 1.0;

  launchCustomProjectile({
    type: 'elem_bolt',
    startX: casterCenter.x + 58,
    startY: casterCenter.y - 68,
    targetX: target.x,
    targetY: target.y,
    duration: 0.25,
    radius: 8,
    colorCore: '#fef08a',
    colorMid: '#fb7185',
    onHit: () => {
      const st = getPlayerStats();
      const isCrit = Math.random() * 100 < st.crit;
      const base = st.sp * (0.45 * lv) * st.summonMult;
      const finalDmg = isCrit ? base * st.critDmg : base;
      if (state.combat.igniteRem > 0) {
        state.combat.igniteRem = Math.min(6.0, state.combat.igniteRem + 0.8);
      }
      dealDamage('summon_elem', finalDmg, isCrit, false);
    }
  });
}

function firePhoenixAttack() {
  const lv = state.skillTree.phoenix || 0;
  if (lv <= 0) return;
  const casterCenter = getCasterCenter();
  const target = getTargetPos();
  state.combat.phoenixRecoil = 1.0;

  launchCustomProjectile({
    type: 'phoenix_bolt',
    startX: casterCenter.x + 62,
    startY: casterCenter.y + 62,
    targetX: target.x,
    targetY: target.y,
    duration: 0.26,
    radius: 12,
    colorCore: '#ffffff',
    colorMid: '#facc15',
    onHit: () => {
      const st = getPlayerStats();
      const dmg = st.sp * (0.65 * lv) * st.critDmg * st.summonMult;
      dealDamage('summon_phoenix', dmg, true, true);
    }
  });
}

function fireMagmaGolemAttack() {
  const lv = state.skillTree.magma_golem || 0;
  if (lv <= 0) return;
  const target = getTargetPos();
  state.combat.golemLunge = 1.0;

  shockwaves.push({
    x: target.x,
    y: target.y + 28,
    life: 0,
    maxLife: 0.4,
    maxRadius: 68
  });

  const st = getPlayerStats();
  const isCrit = Math.random() * 100 < st.crit;
  const base = st.sp * (1.1 * lv) * st.summonMult;
  const finalDmg = isCrit ? base * st.critDmg : base;

  dealDamage('summon_golem', finalDmg, isCrit, false);
}

function triggerAllSummonsSyncAttack() {
  if ((state.skillTree.legion_sync || 0) <= 0) return;
  if (state.skillTree.fire_elem > 0) fireElementalAttack();
  if (state.skillTree.phoenix > 0) firePhoenixAttack();
  if (state.skillTree.magma_golem > 0) fireMagmaGolemAttack();
}

// ==========================================
// 12. 마법사 스킬 시전 로직
// ==========================================
function fireWithMultishot(type, baseMult) {
  const multiLv = state.skillTree.multishot || 0;
  const evo = getCurrentFlameEvolution();
  const totalShots = 1 + multiLv;

  // 1. 기본 탄환 + 갈래 화염구 특성 탄환
  for (let i = 0; i < totalShots; i++) {
    const isMain = i === 0;
    const delayMs = i * 85;
    const lineOffsetY = i === 0 ? 0 : (i % 2 === 1 ? -13 : 13) * Math.ceil(i / 2);

    const doLaunch = () => {
      launchProjectile(
        type,
        () => {
          const st = getPlayerStats();
          // 타오르는 기운 (Heating Up Pity System): 비치명타 시마다 치명타율 누적 보정 (+15%/스택)
          const pityBonus = isMain ? (state.combat.pityCritStacks || 0) * 15 : 0;
          const effectiveCrit = Math.min(100, st.crit + pityBonus);
          const isCrit = Math.random() * 100 < effectiveCrit;
          const mult = isMain ? baseMult : baseMult * 0.4;
          const base = st.sp * mult;
          const finalDmg = isCrit ? base * st.critDmg : base;
          dealDamage(type, finalDmg, isCrit, isMain);
        },
        lineOffsetY,
        isMain ? 1.0 : 0.82
      );
    };

    if (delayMs === 0) {
      doLaunch();
    } else {
      setTimeout(doLaunch, delayMs);
    }
  }

  // 2. 화염 진화(Tier 3~5) 탄막 인플레이션: 고열 청염 이상 진화 시 날렵한 보조 마력탄이 상하 궤적으로 추가 발사
  if (evo.barrageCount > 0) {
    for (let b = 0; b < evo.barrageCount; b++) {
      const barrageDelay = 45 + b * 65;
      const barrageOffsetY = (b % 2 === 0 ? -24 : 24) + (Math.random() * 10 - 5);
      setTimeout(() => {
        launchProjectile(
          type,
          () => {
            const st = getPlayerStats();
            const isCrit = Math.random() * 100 < st.crit;
            const base = st.sp * (baseMult * 0.22);
            const finalDmg = isCrit ? base * st.critDmg : base;
            dealDamage(type, finalDmg, isCrit, false);
          },
          barrageOffsetY,
          0.62
        );
      }, barrageDelay);
    }
  }
}

function triggerSkill(skillKey) {
  const stats = getPlayerStats();
  const c = state.combat;

  if (skillKey === 'fireball') {
    if (c.castingSkill || c.gcdRemaining > 0) return false;

    // 불사조 유물: 태양의 파편 (즉시 시전 확률)
    const shardLv = (state.artifacts && state.artifacts.shard_of_sun) || 0;
    const instantChance = shardLv * 0.10;
    if (instantChance > 0 && Math.random() < instantChance) {
      spawnFloatingText('☀️ 파편: 즉시 시전!', 'fct-proc', -35, { anchor: 'caster' });
      playSound('proc');
      fireWithMultishot('fireball', 1.0);
      beginMageGesture('fireball');
      c.gcdTotal = Math.max(0.35, 0.85 / stats.speedMult);
      c.gcdRemaining = c.gcdTotal;
      return true;
    }

    const castTime = Math.max(0.4, 1.5 / stats.speedMult);
    c.castingSkill = 'fireball';
    c.castTotal = castTime;
    c.castRemaining = castTime;
    c.gcdTotal = Math.max(0.5, 1.2 / stats.speedMult);
    c.gcdRemaining = c.gcdTotal;
    updateCastingLoopSound();
    return true;
  }

  if (skillKey === 'fireblast') {
    if (!state.grimoires.fireblast) return false;
    if (c.fbCharges <= 0) return false;

    c.fbCharges--;
    if (c.fbRechargeRem <= 0) {
      c.fbRechargeTotal = Math.max(3.5, (9.0 * (1 - stats.cdr)) / stats.speedMult);
      c.fbRechargeRem = c.fbRechargeTotal;
    }

    const pos = getTargetPos();
    spawnParticles(pos.x, pos.y, 20, '#fef08a', '#f97316', 1.15);
    const dmg = stats.sp * 0.85 * stats.critDmg;
    dealDamage('fireblast', dmg, true, true);
    beginMageGesture('fireblast');
    return true;
  }

  if (skillKey === 'combustion') {
    if (!state.grimoires.combustion) return false;
    if (c.combustionCdRem > 0) return false;

    c.combustionRem = getCombustionDuration();
    beginMageGesture('combustion');
    const timeWarpCdCut = ((state.artifacts && state.artifacts.time_warp) || 0) * 3;
    c.combustionCdTotal = Math.max(Math.max(10, 14 - timeWarpCdCut), (30 - timeWarpCdCut) * (1 - stats.cdr));
    c.combustionCdRem = c.combustionCdTotal;
    spawnFloatingText('☀️ 마력 폭주!', 'fct-proc', -45, { anchor: 'caster' });
    playSound('proc');
    return true;
  }

  if (skillKey === 'meteor') {
    if (!state.grimoires.meteor) return false;
    // 몰열은 일반 쿨타임과 화염구 시전을 방해하지 않는 즉시 연계입니다.
    if (c.critStreak === 2) {
      c.critStreak = 0;
      c.streakTimer = 0;
      releaseMeteor();
      triggerAllSummonsSyncAttack();
      return true;
    }
    if (c.meteorCdRem > 0 || c.castingSkill || c.gcdRemaining > 0) return false;
    c.castingSkill = 'meteor';
    c.castTotal = Math.max(0.7, 2.5 / stats.speedMult);
    c.castRemaining = c.castTotal;
    c.gcdTotal = Math.max(0.5, 1.2 / stats.speedMult);
    c.gcdRemaining = c.gcdTotal;
    updateCastingLoopSound();
    return true;
  }

  if (skillKey === 'flame_patch') {
    const patchLv = state.skillTree.flame_patch || 0;
    if (patchLv <= 0) return false;
    if (c.flamePatchCdRem > 0) return false;

    c.flamePatchCdTotal = Math.max(4.5, 10 * (1 - stats.cdr));
    c.flamePatchCdRem = c.flamePatchCdTotal;
    c.flamePatchRem = 7.0;
    c.flamePatchTickTimer = 0;

    const target = getTargetPos();
    const fx = target.x;
    const fy = target.y + 56;
    spawnParticles(fx, fy, 32, '#fef08a', '#ea580c', 1.45);
    shockwaves.push({
      x: fx,
      y: fy,
      life: 0,
      maxLife: 0.42,
      maxRadius: 123,
      rgb: '251, 146, 60',
      flat: true,
      lineWidth: 5
    });
    playFireballSfx('explosion', 0.65);

    // 시전 즉시 첫 불장판 도트 틱 피해 적용
    const golemBonus = (state.skillTree.magma_golem || 0) * 0.15;
    const tickDmg = stats.sp * (0.4 * patchLv) * (1 + golemBonus) * (stats.igniteMult || 1);
    dealDamage('flame_patch', tickDmg, false, false, true);
    updateBurningLoopSound();
    return true;
  }

  return false;
}

function releaseMeteor() {
  beginMageGesture('meteor');
  if (state.combat && state.combat.combustionRem > 0) {
    if (!state.stats) state.stats = {};
    state.stats.combustionPyros = (state.stats.combustionPyros || 0) + 1;
  }
  launchMeteorVfx(() => {
    const stats = getPlayerStats();
    const isCrit = Math.random() * 100 < stats.crit;
    const damage = stats.sp * 3.2 * (isCrit ? stats.critDmg : 1);
    // 메테오 자체는 소비한 몰열을 다시 충전하지 않습니다.
    dealDamage('meteor', damage, isCrit, false);
    state.combat.meteorBurnRem = 6;
  }, 1);

  // 불사조 유물: 쌍둥이 운석 (보조 미니 운석 연속 낙하)
  const twinLv = (state.artifacts && state.artifacts.twin_cataclysm) || 0;
  if (twinLv > 0) {
    for (let tc = 0; tc < twinLv; tc++) {
      setTimeout(() => {
        launchMeteorVfx(() => {
          const stats = getPlayerStats();
          const isCrit = Math.random() * 100 < stats.crit;
          const damage = stats.sp * 1.6 * (isCrit ? stats.critDmg : 1);
          dealDamage('meteor', damage, isCrit, false);
        }, 0.68);
      }, (tc + 1) * 220);
    }
  }
}

function finishCast(skillKey) {
  if (skillKey === 'fireball') {
    checkBountyProgress('fireball_cast', 1);
    fireWithMultishot('fireball', 1.0);
    // 화염구 시전 완료 직후 몰열(치명타 2연속)이 켜져 있고 자동 시전이 켜져 있다면 지체 없이 메테오 즉시 발사 연계!
    if (state.combat.critStreak === 2 && isSkillAutoActive('meteor') && state.grimoires.meteor) {
      triggerSkill('meteor');
    }
  } else if (skillKey === 'meteor') {
    const c = state.combat;
    c.meteorCdTotal = Math.max(8, 18 * (1 - getPlayerStats().cdr));
    c.meteorCdRem = c.meteorCdTotal;
    releaseMeteor();
  }
}

function isSkillAutoActive(skillKey) {
  if (!state.grimoires.autocast || !state.autoCast) return false;
  if (!state.skillAuto) return true;
  return state.skillAuto[skillKey] !== false;
}

function runSmartAutoCast() {
  if (!state.grimoires.autocast || !state.autoCast) return;
  const c = state.combat;

  if (state.grimoires.combustion && isSkillAutoActive('combustion') && c.combustionCdRem <= 0) {
    triggerSkill('combustion');
  }
  if ((state.skillTree.flame_patch || 0) > 0 && isSkillAutoActive('flame_patch') && c.flamePatchCdRem <= 0) {
    triggerSkill('flame_patch');
  }

  // 1. 몰아치는 열기 (즉시 시전 메테오): 몰열 2스택 상태라면 지체 없이 최우선 발사!
  if (state.grimoires.meteor && isSkillAutoActive('meteor') && c.critStreak === 2) {
    triggerSkill('meteor');
  }

  // 2. 불꽃 작렬 (확정 치명타): 1스택일 때 즉시 2스택 완성 유도 또는 완충 시 즉시 소모
  if (state.grimoires.fireblast && isSkillAutoActive('fireblast') && c.fbCharges > 0) {
    if (!state.grimoires.meteor || c.critStreak === 1 || c.fbCharges >= c.fbMaxCharges) {
      triggerSkill('fireblast');
    }
  }

  // 3. 일반 화염구 기본 시전 (몰열 2스택 대기 중이 아닐 때)
  if (
    isSkillAutoActive('fireball') &&
    !c.castingSkill &&
    c.gcdRemaining <= 0 &&
    !(state.grimoires.meteor && c.critStreak === 2)
  ) {
    triggerSkill('fireball');
  }
}

function toggleSkillAuto(skillKey) {
  if (!state.grimoires.autocast) return;
  if (!state.skillAuto) {
    state.skillAuto = { fireball: true, fireblast: true, combustion: true, meteor: true, flame_patch: true };
  }
  state.skillAuto[skillKey] = !state.skillAuto[skillKey];
  playSound('item_select');
  const isAuto = state.skillAuto[skillKey];
  const nameMap = {
    fireball: '화염구',
    fireblast: '불꽃 작렬',
    meteor: '메테오',
    combustion: '마력 폭주',
    flame_patch: '불장판'
  };
  const skillName = nameMap[skillKey] || skillKey;
  spawnFloatingText(`${skillName}: ${isAuto ? '🤖 자동' : '✋ 수동'}`, isAuto ? 'fct-normal' : 'fct-crit', -35, { anchor: 'caster' });
  updateSkillAutoUI();
  saveGame();
}

function updateSkillAutoUI() {
  const autoMap = {
    fireball: document.getElementById('skill-1'),
    fireblast: document.getElementById('skill-2'),
    meteor: document.getElementById('skill-3'),
    combustion: document.getElementById('skill-4'),
    flame_patch: document.getElementById('skill-6')
  };

  const hasAutocast = Boolean(state.grimoires.autocast);

  for (const [key, btn] of Object.entries(autoMap)) {
    if (!btn) continue;
    const isAuto = state.skillAuto ? state.skillAuto[key] !== false : true;
    let badge = btn.querySelector('.skill-auto-badge');
    if (!badge && hasAutocast) {
      badge = document.createElement('span');
      badge.className = 'skill-auto-badge';
      badge.setAttribute('title', '자동/수동 전환 (클릭 또는 우클릭)');
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleSkillAuto(key);
      });
      btn.appendChild(badge);
    }
    if (badge) {
      badge.classList.toggle('unfold-hidden', !hasAutocast);
      badge.classList.toggle('is-auto', isAuto);
      badge.classList.toggle('is-manual', !isAuto);
      badge.textContent = isAuto ? 'AUTO' : '수동';
      badge.setAttribute('aria-label', `${isAuto ? '자동' : '수동'} 시전 모드`);
    }
    btn.classList.toggle('manual-mode-active', !isAuto);
  }
}

// ==========================================
// 13. 시계방향 쿨타임 오버레이 헬퍼
// ==========================================
function setRadialSweep(el, remaining, total, showNumber = true) {
  if (!el) return;
  if (remaining <= 0 || total <= 0) {
    el.classList.remove('active');
    el.style.background = 'transparent';
    el.textContent = '';
    return;
  }
  el.classList.add('active');
  const elapsedRatio = Math.max(0, Math.min(1, 1 - remaining / total));
  const deg = (elapsedRatio * 360).toFixed(1);
  el.style.background = `conic-gradient(from 0deg, rgba(8, 11, 18, 0.18) 0deg, rgba(8, 11, 18, 0.18) ${deg}deg, rgba(8, 11, 18, 0.84) ${deg}deg, rgba(8, 11, 18, 0.84) 360deg)`;
  if (showNumber) {
    el.textContent = remaining >= 10 ? Math.ceil(remaining) : remaining.toFixed(1);
  }
}

const readyFlashTimers = {};
function triggerReadyFlash(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn || btn.classList.contains('hidden-slot') || btn.classList.contains('locked-skill')) return;
  btn.classList.remove('cd-ready-flash');
  void btn.offsetWidth;
  btn.classList.add('cd-ready-flash');
  if (readyFlashTimers[btnId]) clearTimeout(readyFlashTimers[btnId]);
  readyFlashTimers[btnId] = setTimeout(() => {
    btn.classList.remove('cd-ready-flash');
  }, 560);
}

// ==========================================
// 14. 앱 알림 스타일 느낌표(!) 배지 통합 관리
// ==========================================
function setBadge(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function updateNotificationBadges() {
  const c = state.combat;
  const availSp = getAvailableSkillPoints();
  const spentSp = getSpentSkillPoints();

  // 1. 다음 스테이지 도전 버튼 (!) 배지 & 활성화 제어 (현재 스테이지 몬스터 1회 처치 + 요구 DPS 충족 시 활성화!)
  const canGoNext = canAdvanceToNextStage();
  const isKilledOnce = state.highestClearedStage >= state.currentStage;
  const isDpsMet = isStageDpsMet(state.currentStage);
  const nextBtn = document.getElementById('btn-next-stage');
  const nextBtnText = document.getElementById('btn-next-stage-text');
  const nextStageData = getStageData(state.currentStage + 1);

  nextBtn.disabled = !canGoNext;
  nextBtn.classList.toggle('ready-glow', canGoNext);
  nextBtnText.textContent = nextStageData.isPhaseBoss
    ? '👑 보스 도전 ▶'
    : '다음 도전 ▶';

  if (canGoNext) {
    nextBtn.title = '조건 달성 완료! 클릭하여 다음 스테이지에 도전하세요.';
  } else if (!isKilledOnce && !isDpsMet) {
    nextBtn.title = '현재 스테이지 몬스터 1회 처치 및 목표 DPS 달성 시 활성화됩니다.';
  } else if (!isKilledOnce) {
    nextBtn.title = '목표 DPS 달성! 현재 스테이지의 몬스터를 1회 처치하면 다음 도전이 활성화됩니다.';
  } else {
    nextBtn.title = '몬스터 처치 완료! 목표 DPS를 달성하면 다음 도전이 활성화됩니다.';
  }

  setBadge('badge-next-stage', canGoNext);

  // 2. 자동 시전 버튼 (!) 배지: 해금되었는데 꺼져 있을 때 표시
  setBadge('badge-auto-cast', state.grimoires.autocast && !state.autoCast);

  // 3. 스킬 액션바 1~6번 (!) 배지: 수동 조작 중이거나 즉시 발사 프록이 떴을 때
  const manualMode = !state.grimoires.autocast || !state.autoCast;
  setBadge('badge-skill-1', manualMode && !c.castingSkill && c.gcdRemaining <= 0 && state.dpsHistory.length === 0);
  setBadge(
    'badge-skill-2',
    state.grimoires.fireblast && c.fbCharges > 0 && (c.critStreak === 1 || (manualMode && c.fbCharges >= 2))
  );
  setBadge('badge-skill-3', state.grimoires.meteor && c.critStreak === 2);
  setBadge('badge-skill-4', manualMode && state.grimoires.combustion && c.combustionCdRem <= 0);
  setBadge('badge-skill-6', manualMode && (state.skillTree.flame_patch || 0) > 0 && c.flamePatchCdRem <= 0);

  // 4. 상점 탭 (!) 배지: 구매 가능한 마법서나 장비가 있을 때 표시
  let anyShopAffordable = false;
  document.querySelectorAll('[data-grimoire]').forEach((btn) => {
    const id = btn.getAttribute('data-grimoire');
    const g = GRIMOIRE_LIST.find((x) => x.id === id);
    if (!g) return;
    const owned = state.grimoires[id];
    const canBuy = !owned && state.gold >= g.cost;
    if (canBuy) anyShopAffordable = true;
    btn.disabled = owned || !canBuy;
    const card = btn.closest('.shop-card');
    if (card) card.classList.toggle('affordable', canBuy);
    const badge = btn.querySelector('.noti-badge');
    if (badge) badge.classList.toggle('hidden', !canBuy);
  });

  document.querySelectorAll('[data-item]').forEach((btn) => {
    const id = btn.getAttribute('data-item');
    const it = EQUIPMENT_LIST.find((x) => x.id === id);
    if (!it) return;
    const cost = getItemCost(it);
    const canBuy = state.gold >= cost;
    if (canBuy) anyShopAffordable = true;
    btn.disabled = !canBuy;
    const card = btn.closest('.shop-card');
    if (card) card.classList.toggle('affordable', canBuy);
    const badge = btn.querySelector('.noti-badge');
    if (badge) badge.classList.toggle('hidden', !canBuy);
  });

  document.querySelectorAll('[data-mastery]').forEach((btn) => {
    const id = btn.getAttribute('data-mastery');
    const m = SKILL_MASTERY_LIST.find((x) => x.id === id);
    if (!m) return;
    const cost = getSkillMasteryCost(m);
    const canBuy = state.gold >= cost;
    if (canBuy) anyShopAffordable = true;
    btn.disabled = !canBuy;
    const card = btn.closest('.shop-card');
    if (card) card.classList.toggle('affordable', canBuy);
    const badge = btn.querySelector('.noti-badge');
    if (badge) badge.classList.toggle('hidden', !canBuy);
  });

  setBadge('badge-tab-shop', anyShopAffordable);

  // 4-A. 승천 버튼 노출 및 (!) 배지
  const canAscendNow = Boolean(state.campaignCleared || state.highestClearedStage >= 20);
  const ascendBtn = document.getElementById('btn-ascend');
  if (ascendBtn) {
    ascendBtn.classList.toggle('unfold-hidden', !canAscendNow);
  }
  setBadge('badge-ascend', canAscendNow);

  // 4-B. 마법 부여 탭 (!) 배지: 구매 가능한 마법 부여가 있을 때 표시
  let anyInfusionAffordable = false;
  for (const inf of INFUSION_LIST) {
    const lv = state.infusions[inf.id] || 0;
    const cost = getInfusionCost(inf);
    if (lv < inf.maxLv && (state.essence || 0) >= cost) {
      anyInfusionAffordable = true;
      break;
    }
  }
  setBadge('badge-tab-infusion', anyInfusionAffordable);

  // 5. 스킬 트리 탭 (!) 배지: 투자 가능한 스킬 트리 노드가 있을 때 표시
  let anyTreeLearnable = false;
  for (const n of SKILL_TREE_NODES) {
    const lv = state.skillTree[n.id] || 0;
    if (lv < n.maxLv && spentSp >= n.reqTotalSp && availSp >= n.cost) {
      anyTreeLearnable = true;
      break;
    }
  }
  setBadge('badge-tab-tree', anyTreeLearnable);
}

// ==========================================
// 15. 상점, 스킬 트리 & 스테이지 UI 렌더링
// ==========================================
function getItemCost(item) {
  const lv = state.items[item.id] || 0;
  return Math.round(item.baseCost * Math.pow(item.costScale, lv));
}

let selectedTalentId = 'fire_elem';

function buildTalentTooltipHtml(nodeId) {
  const n = SKILL_TREE_NODES.find((x) => x.id === nodeId) || SKILL_TREE_NODES[0];
  const availSp = getAvailableSkillPoints();
  const spentSp = getSpentSkillPoints();
  const lv = state.skillTree[n.id] || 0;
  const isMax = lv >= n.maxLv;
  const tierUnlocked = spentSp >= n.reqTotalSp;
  const canLearn = tierUnlocked && !isMax && availSp >= n.cost;

  let reqHtml = '';
  if (isMax) {
    reqHtml = `<div class="wow-tt-req is-max">★ 최고 단계 달성 (마스터 완료)</div>`;
  } else if (!tierUnlocked) {
    reqHtml = `<div class="wow-tt-req is-locked">🔒 하위 특성에 총 ${n.reqTotalSp} SP 투자 필요 (현재 ${spentSp} SP)</div>`;
  } else if (availSp < n.cost) {
    reqHtml = `<div class="wow-tt-req is-locked">필요 포인트: ${n.cost} SP (보유 SP 부족)</div>`;
  } else {
    reqHtml = `<div class="wow-tt-req is-ready">필요 포인트: ${n.cost} SP · 아이콘 클릭 시 즉시 습득</div>`;
  }

  let effectHtml = '';
  if (lv === 0) {
    effectHtml = `
      <div class="wow-tt-section">
        <div class="wow-tt-label next">다음 단계 (1/${n.maxLv}):</div>
        <div class="wow-tt-desc next">${n.desc(1)}</div>
      </div>
    `;
  } else if (isMax) {
    effectHtml = `
      <div class="wow-tt-section">
        <div class="wow-tt-label current">현재 효과 (${lv}/${n.maxLv}):</div>
        <div class="wow-tt-desc current">${n.desc(lv)}</div>
      </div>
    `;
  } else {
    effectHtml = `
      <div class="wow-tt-section">
        <div class="wow-tt-label current">현재 효과 (${lv}/${n.maxLv}):</div>
        <div class="wow-tt-desc current">${n.desc(lv)}</div>
      </div>
      <div class="wow-tt-section next-block">
        <div class="wow-tt-label next">다음 단계 (${lv + 1}/${n.maxLv}):</div>
        <div class="wow-tt-desc next">${n.desc(lv + 1)}</div>
      </div>
    `;
  }

  return `
    <div class="wow-tt-header">
      <div class="wow-tt-title-wrap">
        <span class="wow-tt-icon">${n.icon}</span>
        <div>
          <div class="wow-tt-name">${n.name}</div>
          <div class="wow-tt-rank">단계 ${lv} / ${n.maxLv}</div>
        </div>
      </div>
      <button class="wow-tt-learn-btn has-badge-anchor" data-tree-node="${n.id}" ${!canLearn ? 'disabled' : ''}>
        <span>${isMax ? '마스터' : !tierUnlocked ? `🔒 ${n.reqTotalSp} SP` : `습득 (${n.cost} SP)`}</span>
        <span class="noti-badge ${canLearn ? '' : 'hidden'}">!</span>
      </button>
    </div>
    ${reqHtml}
    ${effectHtml}
  `;
}

function renderSkillTreeUI() {
  const availSp = getAvailableSkillPoints();
  const spentSp = getSpentSkillPoints();

  document.getElementById('ui-tab-sp-badge').textContent = `${availSp} SP`;
  document.getElementById('ui-tree-sp-box').textContent = `특성 포인트: ${availSp} SP (누적 ${spentSp} SP)`;

  const badgesEl = document.getElementById('summon-active-badges');
  const activeChips = [];
  if (state.skillTree.fire_elem > 0) activeChips.push(`<span class="summon-chip">🔥 정령 Lv.${state.skillTree.fire_elem}</span>`);
  if (state.skillTree.flame_patch > 0) activeChips.push(`<span class="summon-chip">🔥 불장판 Lv.${state.skillTree.flame_patch}</span>`);
  if (state.skillTree.phoenix > 0) activeChips.push(`<span class="summon-chip">🦅 불사조 Lv.${state.skillTree.phoenix}</span>`);
  if (state.skillTree.magma_golem > 0) activeChips.push(`<span class="summon-chip">🗿 골렘 Lv.${state.skillTree.magma_golem}</span>`);
  if (state.skillTree.multishot > 0) activeChips.push(`<span class="summon-chip">✨ ${state.skillTree.multishot + 1}연발</span>`);
  badgesEl.innerHTML = activeChips.join('');

  const container = document.getElementById('skill-tree-container');

  // 좌표 계산 헬퍼 (viewBox 300 x 288 기준)
  const getCoord = (node) => ({
    x: (node.col - 0.5) * 100,
    y: (node.row - 1) * 96 + 40
  });

  // 1. 노드 간 화살표 연결선(SVG) 생성
  const svgLinesHtml = SKILL_TREE_LINKS.map((link) => {
    const fromNode = SKILL_TREE_NODES.find((n) => n.id === link.from);
    const toNode = SKILL_TREE_NODES.find((n) => n.id === link.to);
    if (!fromNode || !toNode) return '';

    const p1 = getCoord(fromNode);
    const p2 = getCoord(toNode);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    // 아이콘 테두리 바깥에서 시작해 타겟 아이콘 테두리 직전에 화살표가 닿도록 오프셋 적용
    const x1 = (p1.x + ux * 26).toFixed(1);
    const y1 = (p1.y + uy * 26).toFixed(1);
    const x2 = (p2.x - ux * 31).toFixed(1);
    const y2 = (p2.y - uy * 31).toFixed(1);

    const fromLv = state.skillTree[fromNode.id] || 0;
    const toLv = state.skillTree[toNode.id] || 0;
    const toTierUnlocked = spentSp >= toNode.reqTotalSp;

    let stateCls = 'locked';
    let markerId = 'wow-arrow-locked';
    if (toLv > 0 || (fromLv > 0 && toTierUnlocked)) {
      stateCls = 'active';
      markerId = 'wow-arrow-active';
    } else if (toTierUnlocked) {
      stateCls = 'ready';
      markerId = 'wow-arrow-ready';
    }

    return `
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wow-link-casing" />
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wow-link-line ${stateCls}" marker-end="url(#${markerId})" />
    `;
  }).join('');

  // 2. 3x3 와우 특성 그리드 셀 생성 (단계 텍스트 없이 깔끔한 그리드만 표시)
  let gridRowsHtml = '';
  for (let r = 1; r <= 3; r++) {
    const tierReq = r === 1 ? 0 : r === 2 ? 1 : 3;
    const tierUnlocked = spentSp >= tierReq;
    let cellsHtml = '';

    for (let c = 1; c <= 3; c++) {
      const n = SKILL_TREE_NODES.find((node) => node.row === r && node.col === c);
      if (!n) {
        cellsHtml += `<div class="wow-tree-cell empty-cell"></div>`;
        continue;
      }

      const lv = state.skillTree[n.id] || 0;
      const isMax = lv >= n.maxLv;
      const canLearn = tierUnlocked && !isMax && availSp >= n.cost;
      const isSelected = n.id === selectedTalentId;

      let stateClass = 'state-locked';
      if (isMax) stateClass = 'state-max';
      else if (canLearn) stateClass = 'state-learnable';
      else if (lv > 0) stateClass = 'state-invested';
      else if (tierUnlocked) stateClass = 'state-unlocked';

      cellsHtml += `
        <div class="wow-tree-cell">
          <button
            type="button"
            class="wow-talent-node ${stateClass} ${isSelected ? 'is-selected' : ''} has-badge-anchor"
            data-tree-node="${n.id}"
            data-inspect-node="${n.id}"
          >
            <div class="wow-node-frame">
              <span class="wow-node-icon">${n.icon}</span>
              <span class="wow-node-rank">${lv}/${n.maxLv}</span>
              ${!tierUnlocked ? '<span class="wow-node-lock">🔒</span>' : ''}
            </div>
            <span class="wow-node-name">${n.shortName}</span>
            <span class="noti-badge ${canLearn ? '' : 'hidden'}">!</span>
          </button>
        </div>
      `;
    }

    gridRowsHtml += `
      <div class="wow-tree-row ${tierUnlocked ? 'tier-open' : 'tier-locked'}">
        ${cellsHtml}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="wow-tree-board">
      <svg class="wow-tree-svg" viewBox="0 0 300 288" preserveAspectRatio="none">
        <defs>
          <marker id="wow-arrow-locked" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
            <path d="M0,0.5 L5.5,3 L0,5.5 Z" fill="#475569" />
          </marker>
          <marker id="wow-arrow-ready" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
            <path d="M0,0.5 L5.5,3 L0,5.5 Z" fill="#d97706" />
          </marker>
          <marker id="wow-arrow-active" markerWidth="6" markerHeight="6" refX="4.5" refY="3" orient="auto">
            <path d="M0,0.5 L5.5,3 L0,5.5 Z" fill="#fde047" />
          </marker>
        </defs>
        ${svgLinesHtml}
      </svg>
      <div class="wow-tree-grid">
        ${gridRowsHtml}
      </div>
    </div>
    <div class="wow-talent-tooltip" id="wow-talent-tooltip">
      ${buildTalentTooltipHtml(selectedTalentId)}
    </div>
  `;

  renderKeystoneUI();
  updateNotificationBadges();
}

// ==========================================
// 15-B. 3대 빌드 키스톤(Keystone) UI & 토글
// ==========================================
function toggleKeystone(keystoneId) {
  if (state.activeKeystone === keystoneId) {
    state.activeKeystone = null;
    spawnFloatingText('키스톤 특성 해제됨', 'fct-normal', -30, { anchor: 'caster' });
  } else {
    state.activeKeystone = keystoneId;
    const def = KEYSTONE_DEFINITIONS.find((k) => k.id === keystoneId);
    playSound('proc');
    spawnFloatingText(`🌟 키스톤 활성화: [${def.title}]!`, 'fct-proc', -40, { anchor: 'caster' });
  }
  saveGame();
  renderKeystoneUI();
  updateLiveHUD();
}

function renderKeystoneUI() {
  const container = document.getElementById('keystone-selector-box');
  if (!container) return;

  container.innerHTML = KEYSTONE_DEFINITIONS.map((k) => {
    const isActive = state.activeKeystone === k.id;
    return `
      <div class="keystone-card ${isActive ? 'active' : ''}" data-keystone="${k.id}">
        <div class="keystone-title">
          <span>${k.icon} ${k.title}</span>
          ${isActive ? '<span class="keystone-active-badge">선택됨</span>' : ''}
        </div>
        <div class="keystone-tagline">${k.tagline}</div>
        <div class="keystone-desc">${k.desc}</div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 15-C. 불사조 영구 유물 (Phoenix Artifacts) UI
// ==========================================
function getArtifactCost(art) {
  return art.cost || 1;
}

function buyArtifact(artId) {
  const art = PHOENIX_ARTIFACTS.find((a) => a.id === artId);
  if (!art) return;
  const lv = (state.artifacts && state.artifacts[artId]) || 0;
  const cost = getArtifactCost(art);
  if (lv >= art.maxLv || (state.phoenixFeathers || 0) < cost) return;

  state.phoenixFeathers -= cost;
  if (!state.artifacts) state.artifacts = {};
  state.artifacts[artId] = lv + 1;

  playSound('item_select');
  spawnFloatingText(`🪶 ${art.name} Lv.${lv + 1} 각성!`, 'fct-crit', -45, { anchor: 'caster', isBig: true });
  saveGame();
  renderArtifactsUI();
  updateLiveHUD();
  updateNotificationBadges();
}

function renderArtifactsUI() {
  const listEl = document.getElementById('artifacts-shop-list');
  const featherEl = document.getElementById('ui-artifacts-feather-box');
  const topFeatherEl = document.getElementById('ui-feathers');
  const tabBadgeEl = document.getElementById('ui-tab-feather-badge');

  const feathers = state.phoenixFeathers || 0;
  if (featherEl) featherEl.textContent = `🪶 ${fmt(feathers)} 깃털`;
  if (topFeatherEl) topFeatherEl.textContent = fmt(feathers);
  if (tabBadgeEl) tabBadgeEl.textContent = `${fmt(feathers)} 🪶`;

  if (!listEl) return;

  listEl.innerHTML = PHOENIX_ARTIFACTS.map((art) => {
    const lv = (state.artifacts && state.artifacts[art.id]) || 0;
    const isMax = lv >= art.maxLv;
    const cost = getArtifactCost(art);
    const canBuy = !isMax && feathers >= cost;
    const descText = art.desc(lv);

    return `
      <div class="artifact-card ${canBuy ? 'affordable' : ''} ${isMax ? 'maxed' : ''}">
        <div class="art-icon">${art.icon}</div>
        <div class="art-info">
          <div class="art-name-row">
            <span class="art-name">${art.name}</span>
            <span class="art-lv-tag ${isMax ? 'is-max' : ''}">${isMax ? 'MAX' : `Lv.${lv} / ${art.maxLv}`}</span>
          </div>
          <div class="art-desc">${descText}</div>
        </div>
        <button class="btn-buy-art has-badge-anchor" data-artifact="${art.id}" ${!canBuy ? 'disabled' : ''}>
          <span>${isMax ? '습득 완료' : `🪶 ${cost} 깃털`}</span>
          <span class="noti-badge ${canBuy ? '' : 'hidden'}">!</span>
        </button>
      </div>
    `;
  }).join('');
}

// ==========================================
// 15-D. 타오르는 기운 (Heating Up Pity Badge) UI
// ==========================================
function updatePityCritBadgeUI() {
  const badge = document.getElementById('badge-pity-crit');
  const btn = document.getElementById('skill-1');
  const stacks = (state.combat && state.combat.pityCritStacks) || 0;
  if (!badge || !btn) return;
  if (stacks > 0) {
    badge.textContent = `🔥 +${stacks * 15}%`;
    badge.classList.remove('hidden');
    btn.classList.add('heating-pity-active');
  } else {
    badge.classList.add('hidden');
    btn.classList.remove('heating-pity-active');
  }
}

// ==========================================
// 15-E. 30초 훈련용 허수아비 벤치마크 모드
// ==========================================
function startTrainingDummyMode() {
  if (state.isTrainingDummy) return;
  state.savedStageBeforeTraining = state.currentStage || 1;
  state.isTrainingDummy = true;
  state.trainingTimer = 30.0;
  state.dpsHistory = [];
  state.currentDps = 0;
  if (!state.stats) {
    state.stats = { totalDamage: 0, peakDps: 0, biggestCrit: 0, biggestCritSkill: '', totalHits: 0, critHits: 0, combustionHits: 0, combustionDmg: 0 };
  } else {
    state.stats.peakDps = 0;
    state.stats.totalDamage = 0;
  }
  loadStage(state.currentStage);
  playSound('proc');
  spawnFloatingText('🎯 30초 딜사이클 훈련 시작! 전력을 다해 폭딜하세요!', 'fct-proc', -50, { isBig: true });
}

function finishTrainingDummyMode() {
  if (!state.isTrainingDummy) return;
  state.isTrainingDummy = false;
  const peak = Math.max(state.currentDps, state.stats?.peakDps || 0);
  const isNewRecord = peak > (state.dummyRecordDps || 0);
  if (isNewRecord) {
    state.dummyRecordDps = peak;
  }

  loadStage(state.savedStageBeforeTraining || 1);
  saveGame();

  openDetailsModal();
  const parseEl = document.getElementById('details-parse-badge');
  if (parseEl) {
    parseEl.textContent = `🎯 훈련장: ${fmt(peak)} DPS (${isNewRecord ? '🎉 최고기록!' : '측정 완료'})`;
  }
  playSound(isNewRecord ? 'proc' : 'hit');
  spawnFloatingText(
    isNewRecord ? `🎉 훈련장 최고 기록 갱신: ${fmt(peak)} DPS!` : `🎯 훈련 종료: ${fmt(peak)} DPS`,
    'fct-crit',
    -50,
    { isBig: true }
  );
}

function exitTrainingDummyMode() {
  if (!state.isTrainingDummy) return;
  state.isTrainingDummy = false;
  loadStage(state.savedStageBeforeTraining || 1);
  spawnFloatingText('전투로 복귀했습니다.', 'fct-normal', -30);
}

// ==========================================
// 15-F. 심연의 열기(Heat) 챌린지 규약 시스템
// ==========================================
function getHeatBonusMult() {
  let bonus = 0;
  if (state.heatPacts && state.heatPacts.fast_tempo) bonus += 0.25;
  if (state.heatPacts && state.heatPacts.iron_skin) bonus += 0.35;
  if (state.heatPacts && state.heatPacts.scorched_endure) bonus += 0.40;
  return bonus;
}

function openHeatModal() {
  const modal = document.getElementById('modal-heat-pacts');
  if (!modal) return;
  renderHeatUI();
  modal.classList.remove('hidden');
  state.isPaused = true;
  playSound('item_select');
}

function closeHeatModal() {
  const modal = document.getElementById('modal-heat-pacts');
  if (modal) modal.classList.add('hidden');
  state.isPaused = false;
  saveGame();
}

function renderHeatUI() {
  const bonusMult = getHeatBonusMult();
  const totalValEl = document.getElementById('ui-heat-total-bonus');
  const badgeEl = document.getElementById('ui-heat-badge');
  const pctStr = `+${Math.round(bonusMult * 100)}%`;

  if (totalValEl) totalValEl.textContent = pctStr;
  if (badgeEl) {
    badgeEl.textContent = pctStr;
    badgeEl.classList.toggle('hidden', bonusMult <= 0);
  }

  const pacts = state.heatPacts || {};
  const chkFast = document.getElementById('chk-heat-fast-tempo');
  const chkIron = document.getElementById('chk-heat-iron-skin');
  const chkScorched = document.getElementById('chk-heat-scorched-endure');

  if (chkFast) chkFast.checked = Boolean(pacts.fast_tempo);
  if (chkIron) chkIron.checked = Boolean(pacts.iron_skin);
  if (chkScorched) chkScorched.checked = Boolean(pacts.scorched_endure);
}

function renderInfusionUI() {
  const ess = state.essence || 0;
  const totalLv = getTotalInfusionLevels();

  const tabBadge = document.getElementById('ui-tab-essence-badge');
  if (tabBadge) tabBadge.textContent = `${fmt(ess)} 🔹`;

  const headerBox = document.getElementById('ui-infusion-essence-box');
  if (headerBox) headerBox.textContent = `🔹 ${fmt(ess)} 정수`;

  const resBar = document.getElementById('ui-infusion-resonance');
  if (resBar) {
    resBar.innerHTML = `공명 등급 합계: <b>${totalLv} Lv</b> · 최종 피해 공명 보너스 <b>+${totalLv * 2}%</b>`;
  }

  const listEl = document.getElementById('infusion-shop-list');
  if (!listEl) return;

  listEl.innerHTML = INFUSION_LIST.map((inf) => {
    const lv = state.infusions[inf.id] || 0;
    const isMax = lv >= inf.maxLv;
    const cost = getInfusionCost(inf);
    const canBuy = !isMax && ess >= cost;

    let pipsHtml = '';
    for (let i = 1; i <= inf.maxLv; i++) {
      const filled = i <= lv;
      pipsHtml += `<span class="inf-pip ${filled ? 'filled' : ''} ${isMax ? 'maxed' : ''}"></span>`;
    }

    const descText = lv === 0
      ? `다음(Lv.1): ${inf.desc(1)}`
      : isMax
        ? `최고 단계: ${inf.desc(lv)}`
        : `현재: ${inf.desc(lv)} ➔ 다음: ${inf.desc(lv + 1)}`;

    return `
      <div class="infusion-card ${canBuy ? 'affordable' : ''} ${isMax ? 'maxed-infusion' : ''}">
        <div class="shop-card-left">
          <div class="inf-icon">${inf.icon}</div>
          <div class="shop-info">
            <div class="shop-title">
              <span>${inf.name}</span>
              <span class="inf-lv-tag ${isMax ? 'is-max' : ''}">${isMax ? `★ MAX (${lv}/${inf.maxLv})` : `Lv.${lv}/${inf.maxLv}`}</span>
            </div>
            <div class="shop-desc">${descText}</div>
            <div class="inf-pips-row">${pipsHtml}</div>
          </div>
        </div>
        <button class="inf-buy-btn has-badge-anchor ${isMax ? 'done-btn' : ''}" data-infusion="${inf.id}" ${isMax || !canBuy ? 'disabled' : ''}>
          <span>${isMax ? '✔ 마스터' : `주입 🔹 ${fmt(cost)}`}</span>
          <span class="noti-badge ${canBuy ? '' : 'hidden'}">!</span>
        </button>
      </div>
    `;
  }).join('');

  updateNotificationBadges();
}

function renderShopUI() {
  const eqLeftContainer = document.getElementById('caster-equipped-left');
  if (eqLeftContainer) {
    const ownedEquip = EQUIPMENT_LIST.filter((it) => (state.items[it.id] || 0) > 0);
    eqLeftContainer.innerHTML = ownedEquip
      .map((it) => {
        const lv = state.items[it.id] || 0;
        return `
          <div class="caster-eq-slot" title="${it.name} (+${lv}강) — ${it.desc}">
            <span class="caster-eq-icon">${it.icon}</span>
            <span class="caster-eq-lv">+${lv}</span>
          </div>
        `;
      })
      .join('');
  }

  const grimContainer = document.getElementById('grimoire-shop-list');
  const learnedCount = Object.values(state.grimoires).filter(Boolean).length;
  document.getElementById('grimoire-progress').textContent = `${learnedCount} / ${GRIMOIRE_LIST.length}`;

  let unlearnedShown = 0;
  const visibleGrimoires = GRIMOIRE_LIST.filter((g) => {
    if (state.grimoires[g.id]) return true;
    if (unlearnedShown < 2) {
      unlearnedShown++;
      return true;
    }
    return false;
  });

  visibleGrimoires.sort((a, b) => Number(state.grimoires[a.id]) - Number(state.grimoires[b.id]));

  grimContainer.innerHTML = visibleGrimoires
    .map((g) => {
      const owned = state.grimoires[g.id];
      const canBuy = !owned && state.gold >= g.cost;
      return `
        <div class="shop-card ${canBuy ? 'affordable' : ''} ${owned ? 'purchased-grimoire' : ''}">
          <div class="shop-card-left">
            <div class="shop-icon">${g.icon}</div>
            <div class="shop-info">
              <div class="shop-title">${g.name}</div>
              <div class="shop-desc">${g.desc}</div>
            </div>
          </div>
          <button class="shop-buy-btn has-badge-anchor ${owned ? 'done-btn' : ''}" data-grimoire="${g.id}" ${owned || !canBuy ? 'disabled' : ''}>
            <span>${owned ? '✔ 완료' : `💰 ${fmt(g.cost)} G`}</span>
            <span class="noti-badge ${canBuy ? '' : 'hidden'}">!</span>
          </button>
        </div>
      `;
    })
    .join('');

  const itemContainer = document.getElementById('item-shop-list');
  let newItemsShown = 0;
  const visibleItems = EQUIPMENT_LIST.filter((it) => {
    if ((state.items[it.id] || 0) > 0) return true;
    if (newItemsShown < 2) {
      newItemsShown++;
      return true;
    }
    return false;
  });

  itemContainer.innerHTML = visibleItems
    .map((it) => {
      const lv = state.items[it.id] || 0;
      const cost = getItemCost(it);
      const canBuy = state.gold >= cost;
      return `
        <div class="shop-card ${canBuy ? 'affordable' : ''}">
          <div class="shop-card-left">
            <div class="shop-icon">${it.icon}</div>
            <div class="shop-info">
              <div class="shop-title">
                <span>${it.name}</span>
                <span class="shop-lv-tag">${lv === 0 ? '미보유' : `+${lv}강`}</span>
              </div>
              <div class="shop-desc">${it.desc}</div>
            </div>
          </div>
          <button class="shop-buy-btn has-badge-anchor" data-item="${it.id}" ${!canBuy ? 'disabled' : ''}>
            <span>${lv === 0 ? '구매' : '강화'} 💰 ${fmt(cost)} G</span>
            <span class="noti-badge ${canBuy ? '' : 'hidden'}">!</span>
          </button>
        </div>
      `;
    })
    .join('');

  const masteryContainer = document.getElementById('mastery-shop-list');
  const masterySection = document.getElementById('mastery-section');
  if (masteryContainer) {
    const unlockedMasteries = SKILL_MASTERY_LIST.filter((m) => isSkillUnlocked(m.id));
    if (masterySection) {
      masterySection.style.display = unlockedMasteries.length > 0 ? '' : 'none';
    }

    const totalMasteryLvs = Object.values(state.skillMastery || {}).reduce((a, b) => a + b, 0);
    const summaryEl = document.getElementById('ui-mastery-summary');
    if (summaryEl) {
      summaryEl.textContent = totalMasteryLvs > 0 ? `누적 ${totalMasteryLvs} Lv` : '';
    }

    masteryContainer.innerHTML = unlockedMasteries.map((m) => {
      const lv = (state.skillMastery && state.skillMastery[m.id]) || 0;
      const cost = getSkillMasteryCost(m);
      const canBuy = state.gold >= cost;
      let statDisplay = '';
      if (m.type === 'duration') {
        const curDur = (2.0 + lv * m.bonusPerLv).toFixed(1);
        const nextDur = (2.0 + (lv + 1) * m.bonusPerLv).toFixed(1);
        statDisplay = lv === 0
          ? `<span class="mastery-bonus-preview">지속 2.0s ➔ ${nextDur}s (+${m.bonusPerLv}s)</span>`
          : `<span class="mastery-bonus-val">지속 ${curDur}s</span> <span class="mastery-arrow">➔</span> <span class="mastery-next">${nextDur}s</span> <span class="mastery-bonus-preview">(+${m.bonusPerLv}s)</span>`;
      } else {
        const curBonus = (lv * m.bonusPerLv * 100).toFixed(0);
        const nextBonus = ((lv + 1) * m.bonusPerLv * 100).toFixed(0);
        statDisplay = lv === 0
          ? `<span class="mastery-bonus-preview">+${nextBonus}% 강화</span>`
          : `<span class="mastery-bonus-val">+${curBonus}%</span> <span class="mastery-arrow">➔</span> <span class="mastery-next">+${nextBonus}%</span>`;
      }

      return `
        <div class="shop-card mastery-card ${canBuy ? 'affordable' : ''}">
          <div class="shop-card-left">
            <div class="shop-icon">${m.icon}</div>
            <div class="shop-info">
              <div class="shop-title">
                <span>${m.name}</span>
                ${lv > 0 ? `<span class="shop-lv-tag is-max">Lv.${lv}</span>` : ''}
              </div>
              <div class="shop-desc">${statDisplay}</div>
            </div>
          </div>
          <button class="shop-buy-btn has-badge-anchor" data-mastery="${m.id}" ${!canBuy ? 'disabled' : ''}>
            <span>💰 ${fmt(cost)} G</span>
            <span class="noti-badge ${canBuy ? '' : 'hidden'}">!</span>
          </button>
        </div>
      `;
    }).join('');
  }

  updateSkillActionBarVisibility();
  updateNotificationBadges();
}

let unfoldToastTimer = null;

function showUnfoldToast(title, desc) {
  const toastEl = document.getElementById('unfold-toast');
  if (!toastEl) return;
  toastEl.innerHTML = `
    <div class="unfold-toast-title">${title}</div>
    <div class="unfold-toast-desc">${desc}</div>
  `;
  toastEl.classList.remove('hidden', 'toast-pop');
  void toastEl.offsetWidth;
  toastEl.classList.add('toast-pop');

  if (unfoldToastTimer) clearTimeout(unfoldToastTimer);
  unfoldToastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

function triggerUnfoldPop(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.classList.remove('unfold-pop-anim');
  void el.offsetWidth;
  el.classList.add('unfold-pop-anim');
}

function checkAndTriggerUnfolds(silent = false) {
  const u = state.unfolded;
  let changed = false;

  // 1. 첫 몬스터 처치 또는 첫 골드(4G+) 획득 시: 주문서 상점 & 스테이지 네비게이션 개방
  if (!u.grimoireShop && (state.gold >= 4 || state.highestClearedStage >= 1 || state.grimoires.autocast)) {
    u.grimoireShop = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔓 새로운 시스템 해금: 마법 연구소!', '우측 [📜 주문서] 상점에서 새로운 주문서를 구매할 수 있습니다.');
      triggerUnfoldPop('grimoire-section');
    }
  }

  if (!u.stageNav && (state.highestClearedStage >= 1 || state.currentStage > 1)) {
    u.stageNav = true;
    changed = true;
    if (!silent) {
      triggerUnfoldPop('btn-next-stage');
    }
  }

  // 2. 자동 시전 마법진 구매(또는 장비 1개 이상 보유) 시: 장비 강화 상점 & 자동 시전 버튼 & 치명타/시전속도 스탯 개방
  const hasAnyEquip = Object.values(state.items).some((lv) => lv > 0);
  if (!u.equipShop && (state.grimoires.autocast || hasAnyEquip || state.highestClearedStage >= 3)) {
    u.equipShop = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔓 새로운 시스템 해금: 자동 시전 & 장비 강화!', '이제 마법을 자동으로 시전하고 장비를 강화해 스탯을 높일 수 있습니다.');
      triggerUnfoldPop('item-section');
      triggerUnfoldPop('btn-auto-cast');
      triggerUnfoldPop('pill-crit');
      triggerUnfoldPop('pill-haste');
    }
  }

  // 2-B. Stage 2 클리어 또는 불꽃의 정수 획득/투자 시: 불꽃의 정수 & [🔮 마법 부여] 탭 개방
  if (!u.infusionShop && ((state.essence || 0) > 0 || state.highestClearedStage >= 2 || getTotalInfusionLevels() > 0)) {
    u.infusionShop = true;
    changed = true;
    if (!silent) {
      showUnfoldToast(
        '🔓 새로운 시스템 해금: 불꽃의 정수 & 마법 부여!',
        '우측 상단 [🔮 마법 부여] 탭에서 🔹 정수를 주입해 고대 유물 패시브를 각성하세요!'
      );
      triggerUnfoldPop('pill-essence');
      triggerUnfoldPop('right-mode-tabs');
    }
  }

  // 3. Stage 5 보스 격파 또는 SP 보유/투자 시: 소환수 & 특성 트리 탭 개방
  const hasSpProgress =
    state.highestClearedStage >= 5 ||
    getEarnedPhaseBossSp() > 0 ||
    (state.bonusSkillPoints || 0) > 0 ||
    getSpentSkillPoints() > 0;
  if (!u.skillTree && hasSpProgress) {
    u.skillTree = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔓 새로운 시스템 해금: 소환수 & 특성 트리!', '우측 상단 [🌳 스킬 트리] 탭에서 강력한 소환수와 마법 특성을 습득하세요!');
      triggerUnfoldPop('tab-btn-tree');
    }
  }

  // 4. Stage 20(화염군주 라그나로스) 클리어 시: 상단 명예의 전당 & 무한 심연 모드 해금
  if (!u.hallOfFame && (state.campaignCleared || state.highestClearedStage >= 20)) {
    u.hallOfFame = true;
    state.campaignCleared = true;
    changed = true;
    if (!silent) {
      triggerUnfoldPop('btn-hall-of-fame');
    }
  }

  // 5. 불사조 영구 유물 상점 해금 (승천 1회 이상 또는 깃털 보유 또는 20스테이지 도달)
  const hasArtifactProgress =
    (state.ascensionCount || 0) > 0 ||
    (state.phoenixFeathers || 0) > 0 ||
    state.highestClearedStage >= 20 ||
    state.campaignCleared ||
    Object.values(state.artifacts || {}).some((lv) => lv > 0);
  if (!u.artifactShop && hasArtifactProgress) {
    u.artifactShop = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔓 새로운 시스템 해금: 불사조 영구 유물!', '우측 상단 [🪶 유물] 탭에서 승천 깃털로 영구 아티팩트를 각성하세요!');
      triggerUnfoldPop('tab-btn-artifacts');
      triggerUnfoldPop('pill-feathers');
    }
  }

  // 6. 훈련용 허수아비 벤치마크 모드 해금 (Stage 3 클리어 이상)
  if (!u.trainingDummy && (state.highestClearedStage >= 3 || state.currentStage >= 3 || state.campaignCleared)) {
    u.trainingDummy = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔓 새로운 모드 해금: 허수아비 훈련장!', '상단 [🎯 허수아비 훈련]에서 30초간 내 빌드의 한계 DPS를 측정하세요!');
      triggerUnfoldPop('btn-training-dummy');
    }
  }

  // 7. 심연의 열기(Heat) 규약 해금 (승천 1회 이상 또는 20스테이지 클리어)
  if (!u.heatPacts && ((state.ascensionCount || 0) > 0 || state.campaignCleared || state.highestClearedStage >= 20)) {
    u.heatPacts = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔓 새로운 시스템 해금: 심연의 열기(Heat) 규약!', '상단 [🔥 심연의 규약]에서 난이도 제약을 걸고 승천 깃털을 추가 획득하세요!');
      triggerUnfoldPop('btn-heat-pacts');
    }
  }

  applyUnfoldedVisibility();
  if (changed && !silent) {
    saveGame();
  }
}

function applyUnfoldedVisibility() {
  const u = state.unfolded;

  // 상단 정수/치명타/시전속도 알약 & 명예의 전당/깃털/훈련장/규약 버튼
  const pillEssence = document.getElementById('pill-essence');
  const pillCrit = document.getElementById('pill-crit');
  const pillHaste = document.getElementById('pill-haste');
  const pillFeathers = document.getElementById('pill-feathers');
  const hallBtn = document.getElementById('btn-hall-of-fame');
  const btnTraining = document.getElementById('btn-training-dummy');
  const btnHeat = document.getElementById('btn-heat-pacts');
  if (pillEssence) pillEssence.classList.toggle('unfold-hidden', !u.infusionShop);
  if (pillCrit) pillCrit.classList.toggle('unfold-hidden', !u.equipShop);
  if (pillHaste) pillHaste.classList.toggle('unfold-hidden', !u.equipShop);
  if (pillFeathers) pillFeathers.classList.toggle('unfold-hidden', !u.artifactShop);
  if (hallBtn) hallBtn.classList.toggle('unfold-hidden', !u.hallOfFame);
  if (btnTraining) btnTraining.classList.toggle('unfold-hidden', !u.trainingDummy);
  if (btnHeat) btnHeat.classList.toggle('unfold-hidden', !u.heatPacts);

  // 우측 상단 [상점 / 마법 부여 / 스킬 트리 / 불사조 유물] 탭 전환 바
  const modeTabs = document.getElementById('right-mode-tabs');
  const tabInfBtn = document.getElementById('tab-btn-infusion');
  const tabTreeBtn = document.getElementById('tab-btn-tree');
  const tabArtBtn = document.getElementById('tab-btn-artifacts');
  if (modeTabs) modeTabs.classList.toggle('unfold-hidden', !u.infusionShop && !u.skillTree && !u.artifactShop);
  if (tabInfBtn) tabInfBtn.classList.toggle('unfold-hidden', !u.infusionShop);
  if (tabTreeBtn) tabTreeBtn.classList.toggle('unfold-hidden', !u.skillTree);
  if (tabArtBtn) tabArtBtn.classList.toggle('unfold-hidden', !u.artifactShop);

  // 우측 상점 내부: 초기 봉인 안내 vs 마법 습득 vs 스킬 연마 vs 장비 강화
  const sealedCard = document.getElementById('unfold-sealed-shop');
  const grimoireSec = document.getElementById('grimoire-section');
  const masterySec = document.getElementById('mastery-section');
  const itemSec = document.getElementById('item-section');
  if (sealedCard) sealedCard.classList.toggle('unfold-hidden', u.grimoireShop);
  if (grimoireSec) grimoireSec.classList.toggle('unfold-hidden', !u.grimoireShop);
  if (masterySec) masterySec.classList.toggle('unfold-hidden', !u.grimoireShop);
  if (itemSec) itemSec.classList.toggle('unfold-hidden', !u.equipShop);

  // 전체 해금 완료 시 상단 테스트 버튼 숨김/비활성 표시
  const unfoldAllBtn = document.getElementById('btn-unfold-all');
  if (unfoldAllBtn) {
    const allDone = u.grimoireShop && u.equipShop && u.infusionShop && u.skillTree && u.hallOfFame && u.artifactShop && u.trainingDummy && u.heatPacts;
    unfoldAllBtn.style.display = allDone ? 'none' : '';
  }
}

function updateSkillActionBarVisibility() {
  checkAndTriggerUnfolds(true);

  const btn2 = document.getElementById('skill-2');
  const icon2 = document.getElementById('icon-2');
  const charges2 = document.getElementById('charges-2');
  const hasFireblast = Boolean(state.grimoires.fireblast);
  if (btn2) {
    btn2.classList.toggle('hidden-slot', !hasFireblast);
    btn2.classList.toggle('locked-skill', !hasFireblast);
    if (icon2) icon2.textContent = '💥';
    if (charges2) {
      charges2.style.display = hasFireblast ? 'block' : 'none';
      charges2.textContent = (state.combat && state.combat.fbCharges > 0) ? state.combat.fbCharges : '';
    }
  }

  const btn3 = document.getElementById('skill-3');
  const icon3 = document.getElementById('icon-3');
  const hasMeteor = Boolean(state.grimoires.meteor);
  if (btn3) {
    btn3.classList.toggle('hidden-slot', !hasMeteor);
    btn3.classList.toggle('locked-skill', !hasMeteor);
    if (icon3) icon3.textContent = '☄️';
    if (!hasMeteor) btn3.classList.remove('proc-glow');
  }

  const btn4 = document.getElementById('skill-4');
  const icon4 = document.getElementById('icon-4');
  const hasCombustion = Boolean(state.grimoires.combustion);
  if (btn4) {
    btn4.classList.toggle('hidden-slot', !hasCombustion);
    btn4.classList.toggle('locked-skill', !hasCombustion);
    if (icon4) icon4.textContent = '☀️';
    btn4.setAttribute('aria-label', '마력 폭주');
  }

  const btn6 = document.getElementById('skill-6');
  const icon6 = document.getElementById('icon-6');
  const hasFlamePatch = Boolean(state.skillTree && (state.skillTree.flame_patch || 0) > 0);
  if (btn6) {
    btn6.classList.toggle('hidden-slot', !hasFlamePatch);
    btn6.classList.toggle('locked-skill', !hasFlamePatch);
    if (icon6) icon6.textContent = '♨️';
  }

  const autoBtn = document.getElementById('btn-auto-cast');
  const autoBtnText = document.getElementById('btn-auto-cast-text');
  autoBtn.classList.toggle('unfold-hidden', !state.unfolded.equipShop && !state.grimoires.autocast);
  if (!state.grimoires.autocast) {
    autoBtn.className = `auto-cast-btn locked has-badge-anchor ${!state.unfolded.equipShop ? 'unfold-hidden' : ''}`;
    autoBtnText.textContent = '🔒 자동 시전';
  } else if (state.autoCast) {
    autoBtn.className = 'auto-cast-btn active has-badge-anchor';
    autoBtnText.textContent = '🤖 자동: ON';
  } else {
    autoBtn.className = 'auto-cast-btn has-badge-anchor';
    autoBtnText.textContent = '🤖 자동: OFF';
  }

  updateAutoCastMagicCircle();
  updateSkillAutoUI();
}

function updateAutoCastMagicCircle() {
  const circleEl = document.getElementById('autocast-magic-circle');
  if (!circleEl) return;
  if (!state.grimoires || !state.grimoires.autocast) {
    circleEl.classList.add('hidden');
    circleEl.classList.remove('active', 'dormant');
    return;
  }
  circleEl.classList.remove('hidden');
  if (state.autoCast) {
    circleEl.classList.add('active');
    circleEl.classList.remove('dormant');
  } else {
    circleEl.classList.add('dormant');
    circleEl.classList.remove('active');
  }
}

function updateStageUI() {
  const data = getStageData(state.currentStage);
  const stats = getPlayerStats();
  const isAbyssStage = state.currentStage > 20;
  const phaseEl = document.getElementById('ui-phase-num');
  phaseEl.textContent = isAbyssStage ? `🌌 ABYSS ${data.phase - 4}` : `PHASE ${data.phase}`;
  phaseEl.classList.toggle('abyss-phase', isAbyssStage);
  document.getElementById('ui-stage-num').textContent = `${data.stepInPhase} / 5`;

  // 5단계 도트 진행도
  const dotsEl = document.getElementById('ui-phase-dots');
  const phaseStartStage = (data.phase - 1) * 5 + 1;
  let dotsHtml = '';
  for (let i = 0; i < 5; i++) {
    const stg = phaseStartStage + i;
    const isBossDot = i === 4;
    const isClearedDot = stg <= state.highestClearedStage;
    const isCurrentDot = stg === state.currentStage;
    if (isBossDot) {
      dotsHtml += `<div class="p-dot boss-dot ${isClearedDot ? 'cleared' : ''} ${isCurrentDot ? 'current' : ''}">👑</div>`;
    } else {
      dotsHtml += `<div class="p-dot ${isClearedDot ? 'cleared' : ''} ${isCurrentDot ? 'current' : ''}"></div>`;
    }
  }
  dotsEl.innerHTML = dotsHtml;

  const isCleared = state.currentStage <= state.highestClearedStage;
  const monsterFrame = document.getElementById('monster-frame');
  monsterFrame.classList.toggle('boss-frame', data.isPhaseBoss);

  const stageBanner = document.getElementById('arena-stage-banner');
  if (stageBanner) {
    stageBanner.classList.toggle('boss-banner', data.isPhaseBoss);
    stageBanner.classList.toggle('abyss-banner', isAbyssStage && !data.isPhaseBoss);
  }

  const stageLabelPrefix = isAbyssStage ? 'ABYSS' : 'STAGE';
  document.getElementById('target-stage-tag').textContent = data.isPhaseBoss
    ? `👑 BOSS [${stageLabelPrefix} ${data.phase}-${data.stepInPhase}]`
    : `${stageLabelPrefix} ${data.phase}-${data.stepInPhase}`;

  // 몬스터 이미지와 그 아래 몬스터 이름 표시
  const monsterArt = document.getElementById('dummy-emoji');
  monsterArt.textContent = data.emoji;
  monsterArt.dataset.art = data.stage <= 2 ? 'slime' : '';
  configureMonsterMotion(data.stage);
  monsterArt.dataset.variant = data.stage === 2 ? 'blue' : '';
  monsterArt.setAttribute('aria-label', data.name);
  const monsterNameLabel = document.getElementById('monster-name-label');
  monsterNameLabel.textContent = data.isPhaseBoss ? `👑 ${data.name}` : data.name;
  monsterNameLabel.classList.toggle('boss-label', data.isPhaseBoss);

  const dispGold = isCleared
    ? Math.max(1, Math.round(data.gold * (stats.goldMult || 1)))
    : Math.max(1, Math.round((data.gold + data.firstBonus) * (stats.goldMult || 1)));
  let rewardText = `💰 ${fmt(dispGold)} G`;

  if (!isCleared && state.currentStage >= 2) {
    const firstEss = getFirstClearEssenceBonus(state.currentStage);
    if (firstEss > 0) {
      rewardText += ` · 🔹 ${fmt(firstEss)}`;
    }
  }
  document.getElementById('target-reward').textContent = rewardText;

  document.getElementById('btn-prev-stage').disabled = state.currentStage <= 1;

  const reqDps = getStageReqDps(state.currentStage);
  const dpsMet = isStageDpsMet(state.currentStage);
  document.getElementById('ui-req-dps').textContent = dpsMet
    ? `${fmt(reqDps)} /초 ✔`
    : `${fmt(reqDps)} /초`;

  updateBossGimmick(0);
  updateBountyUI();
  updateNotificationBadges();
}

// ==========================================
// 15-A2. 상세 전투 분석(Details!) 및 보스 기믹, 현상금 퀘스트 시스템
// ==========================================
function calculateParseGrade() {
  const targetReq = getStageReqDps(Math.max(1, state.highestClearedStage || state.currentStage));
  const peak = state.stats && state.stats.peakDps ? state.stats.peakDps : state.currentDps;
  const ratio = targetReq > 0 ? peak / targetReq : 1.0;

  if (ratio >= 2.0) {
    return {
      tier: 'mythic',
      cls: 'parse-mythic',
      label: '🌟 99th Mythic (공대 1등 화법!)'
    };
  } else if (ratio >= 1.4) {
    return {
      tier: 'heroic',
      cls: 'parse-heroic',
      label: '🟣 90th Heroic (숙련된 화염술사)'
    };
  } else if (ratio >= 1.0) {
    return {
      tier: 'rare',
      cls: 'parse-rare',
      label: '🔵 75th Rare (정예 공격대원)'
    };
  } else if (ratio >= 0.7) {
    return {
      tier: 'common',
      cls: 'parse-common',
      label: '🟢 50th Green (준수한 딜러)'
    };
  } else {
    return {
      tier: 'grey',
      cls: 'parse-grey',
      label: '⚪ 25th Grey (마나 부족 수습생)'
    };
  }
}

function openDetailsModal() {
  const modal = document.getElementById('details-modal');
  if (!modal) return;
  playSound('item_select');
  state.isPaused = true;

  const stats = state.stats || {
    totalDamage: 0,
    peakDps: 0,
    biggestCrit: 0,
    biggestCritSkill: '',
    totalHits: 0,
    critHits: 0,
    combustionHits: 0,
    combustionDmg: 0
  };

  const parse = calculateParseGrade();
  const badgeEl = document.getElementById('details-parse-badge');
  if (badgeEl) {
    badgeEl.className = `details-parse-badge ${parse.cls}`;
    badgeEl.textContent = parse.label;
  }

  const peakEl = document.getElementById('details-peak-dps');
  if (peakEl) peakEl.textContent = `${fmt(stats.peakDps || state.currentDps)} /초`;

  const critEl = document.getElementById('details-biggest-crit');
  if (critEl) {
    if (stats.biggestCrit > 0) {
      const skillName = (state.skillDamage[stats.biggestCritSkill] && state.skillDamage[stats.biggestCritSkill].name) || '마법';
      critEl.textContent = `${fmt(stats.biggestCrit)} (${skillName})`;
    } else {
      critEl.textContent = '-';
    }
  }

  const combEl = document.getElementById('details-combustion-dmg');
  if (combEl) combEl.textContent = fmt(stats.combustionDmg || 0);

  const critRateEl = document.getElementById('details-crit-rate');
  if (critRateEl) {
    const rate = stats.totalHits > 0 ? (stats.critHits / stats.totalHits) * 100 : 0;
    critRateEl.textContent = `${rate.toFixed(1)}%`;
  }

  const listEl = document.getElementById('details-breakdown-list');
  if (listEl) {
    const skillsArr = Object.values(state.skillDamage).filter((s) => s.dmg > 0);
    const totalDmg = skillsArr.reduce((a, b) => a + b.dmg, 0);

    if (totalDmg > 0) {
      skillsArr.sort((a, b) => b.dmg - a.dmg);
      listEl.innerHTML = skillsArr
        .map((s) => {
          const pct = ((s.dmg / totalDmg) * 100).toFixed(1);
          const hits = s.hits || 0;
          const crits = s.crits || 0;
          const critPct = hits > 0 ? ((crits / hits) * 100).toFixed(0) : 0;
          return `
            <div class="details-row">
              <div class="details-row-fill" style="width:${pct}%; background:${s.color};"></div>
              <div class="details-row-left">
                <span>${s.name}</span>
                <span class="details-crit-tag">${hits}타 (크리 ${critPct}%)</span>
              </div>
              <div class="details-row-right">
                <span>${fmt(s.dmg)}</span>
                <span style="color:#94a3b8; font-size:0.75rem;">(${pct}%)</span>
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      listEl.innerHTML = '<div style="text-align:center; padding:18px; color:#64748b; font-size:0.85rem;">아직 기록된 전투 데이터가 없습니다. 몬스터를 타격해 보세요!</div>';
    }
  }

  modal.classList.remove('hidden');
}

function closeDetailsModal() {
  const modal = document.getElementById('details-modal');
  if (modal) modal.classList.add('hidden');
  playSound('item_select');

  const victoryModal = document.getElementById('victory-modal');
  const isVictoryOpen = victoryModal && !victoryModal.classList.contains('hidden');
  if (!isVictoryOpen) {
    state.isPaused = false;
  }
}

function resetDetailsStats() {
  state.stats = {
    totalDamage: 0,
    peakDps: 0,
    biggestCrit: 0,
    biggestCritSkill: '',
    totalHits: 0,
    critHits: 0,
    combustionHits: 0,
    combustionDmg: 0
  };
  for (const k of Object.keys(state.skillDamage)) {
    state.skillDamage[k].dmg = 0;
    state.skillDamage[k].hits = 0;
    state.skillDamage[k].crits = 0;
  }
  playSound('item_select');
  openDetailsModal();
  updateDpsMeterUI();
}

function updateBossGimmick(dt) {
  const bg = state.bossGimmick;
  if (!bg) return;
  const stage = state.currentStage;
  const badge = document.getElementById('boss-gimmick-badge');
  const dummyEl = document.getElementById('dummy-avatar');

  if (stage === 10) {
    const isDotted = Boolean(state.combat.igniteRem > 0 || state.combat.flamePatchRem > 0);
    if (badge) {
      badge.classList.remove('hidden', 'gimmick-armor', 'gimmick-melted', 'gimmick-airborne', 'gimmick-groggy', 'gimmick-shield');
      if (isDotted) {
        badge.classList.add('gimmick-melted');
        badge.textContent = '🔥 갑옷 융해! (+30% 피해 증폭)';
      } else {
        badge.classList.add('gimmick-armor');
        badge.textContent = '🪨 바위 갑옷 (피해 35% 감소)';
      }
    }
  } else if (stage === 15) {
    if (bg.groggyTimer > 0) {
      bg.groggyTimer -= dt;
      if (bg.groggyTimer <= 0) {
        bg.groggyTimer = 0;
      }
      if (badge) {
        badge.classList.remove('hidden', 'gimmick-armor', 'gimmick-melted', 'gimmick-airborne', 'gimmick-shield');
        badge.classList.add('gimmick-groggy');
        badge.textContent = `💫 추락 기절! (100% 확정 크리 · ${bg.groggyTimer.toFixed(1)}s)`;
      }
    } else if (bg.isAirborne) {
      if (badge) {
        badge.classList.remove('hidden', 'gimmick-armor', 'gimmick-melted', 'gimmick-groggy', 'gimmick-shield');
        badge.classList.add('gimmick-airborne');
        badge.textContent = '🌪️ 비룡 비상! (즉발 마법으로 격추 가능)';
      }
    } else {
      if (state.monster.hp <= state.monster.maxHp * 0.5 && !bg.airborneDone && !state.monster.isDying) {
        bg.isAirborne = true;
        bg.airborneDone = true;
        if (dummyEl) dummyEl.classList.add('airborne-flying');
        spawnFloatingText('🌪️ 비룡이 공중으로 비상했습니다!', 'fct-crit', -45);
        playSound('proc');
      }
      if (badge && !bg.isAirborne && bg.groggyTimer <= 0) badge.classList.add('hidden');
    }
  } else if (stage === 20) {
    if (bg.shield > 0) {
      bg.shieldTimer -= dt;
      if (badge) {
        badge.classList.remove('hidden', 'gimmick-armor', 'gimmick-melted', 'gimmick-airborne', 'gimmick-groggy');
        badge.classList.add('gimmick-shield');
        badge.textContent = `🌋 용암 보호막 (${fmt(bg.shield)} / ${Math.max(0, bg.shieldTimer).toFixed(1)}s)`;
      }
      if (bg.shieldTimer <= 0) {
        bg.shield = 0;
        bg.shieldTimer = 0;
        state.monster.hp = Math.min(state.monster.maxHp, state.monster.hp + Math.round(state.monster.maxHp * 0.1));
        triggerArenaShake('lg');
        playSound('meteor_impact');
        spawnFloatingText('⚠️ 보호막 폭발! 라그나로스 체력 회복!', 'fct-normal', -35);
      }
    } else {
      if (state.monster.hp <= state.monster.maxHp * 0.3 && !bg.shieldTriggered && !state.monster.isDying) {
        bg.shieldTriggered = true;
        bg.shield = Math.round(state.monster.maxHp * 0.12);
        bg.maxShield = bg.shield;
        bg.shieldTimer = 10.0;
        triggerArenaShake('lg');
        playSound('proc');
        spawnFloatingText('🌋 불의 심장 전개! 10초 내 보호막을 파괴하세요!', 'fct-crit', -50, { isBig: true });
      }
      if (badge && bg.shield <= 0) badge.classList.add('hidden');
    }
  } else if ([3, 7, 12, 17].includes(stage)) {
    // 일반 몬스터 기믹 1: 가연성 기름막 (화상/불장판 도트 유지 시 치명타 2배 증폭!)
    const isDotted = Boolean(state.combat.igniteRem > 0 || state.combat.flamePatchRem > 0);
    if (badge) {
      badge.classList.remove('hidden', 'gimmick-armor', 'gimmick-melted', 'gimmick-airborne', 'gimmick-groggy', 'gimmick-shield');
      badge.classList.add(isDotted ? 'gimmick-melted' : 'gimmick-armor');
      badge.textContent = isDotted ? '🛢️ 기름 발화! (치명타 피해 +100%)' : '🛢️ 가연성 기름막 (도트 시 크리 2배)';
    }
  } else if ([4, 8, 14, 18].includes(stage)) {
    // 일반 몬스터 기믹 2: 단단한 껍질 (치명타 2회 적중 시 껍질 파괴 & 즉시 몰열 장전!)
    const hits = bg.shellCritHits || 0;
    const isBroken = Boolean(bg.isShellBroken);
    if (badge) {
      badge.classList.remove('hidden', 'gimmick-armor', 'gimmick-melted', 'gimmick-airborne', 'gimmick-groggy', 'gimmick-shield');
      if (isBroken) {
        badge.classList.add('gimmick-groggy');
        badge.textContent = '💥 껍질 파괴됨! (방어력 0)';
      } else {
        badge.classList.add('gimmick-armor');
        badge.textContent = `💎 단단한 껍질 (${hits}/2 크리 시 파괴)`;
      }
    }
  } else {
    if (badge) badge.classList.add('hidden');
  }
}

const BOUNTY_TEMPLATES = [
  {
    type: 'crit_count',
    title: '치명타 {n}회 달성',
    baseTarget: 12,
    scaleTarget: 2,
    baseGold: 30,
    baseEss: 1,
    req: () => true
  },
  {
    type: 'monster_kill',
    title: '몬스터 {n}마리 토벌',
    baseTarget: 3,
    scaleTarget: 0.5,
    baseGold: 50,
    baseEss: 2,
    req: () => true
  },
  {
    type: 'fireball_cast',
    title: '화염구 {n}회 시전',
    baseTarget: 8,
    scaleTarget: 1.5,
    baseGold: 30,
    baseEss: 1,
    req: () => true
  },
  {
    type: 'fireblast_hit',
    title: '불꽃 작렬 {n}회 시전',
    baseTarget: 4,
    scaleTarget: 0.8,
    baseGold: 35,
    baseEss: 1,
    req: () => Boolean(state.grimoires && state.grimoires.fireblast)
  },
  {
    type: 'meteor_hit',
    title: '메테오 {n}회 낙하',
    baseTarget: 3,
    scaleTarget: 0.5,
    baseGold: 45,
    baseEss: 2,
    req: () => Boolean(state.grimoires && state.grimoires.meteor)
  },
  {
    type: 'combustion_dmg',
    title: '발화 중 {n} 피해 달성',
    baseTarget: 600,
    scaleTarget: 250,
    baseGold: 65,
    baseEss: 3,
    req: () => Boolean(state.grimoires && state.grimoires.combustion)
  }
];

function isBountyValid(type) {
  const tpl = BOUNTY_TEMPLATES.find((t) => t.type === type);
  return tpl && typeof tpl.req === 'function' ? tpl.req() : true;
}

function generateNextBounty() {
  const available = BOUNTY_TEMPLATES.filter((t) => typeof t.req !== 'function' || t.req());
  const fallback = BOUNTY_TEMPLATES.filter((t) => t.type === 'crit_count' || t.type === 'monster_kill');
  const pool = available.length > 0 ? available : fallback;

  const curType = state.bounty ? state.bounty.type : null;
  const filtered = pool.filter((t) => t.type !== curType);
  const choicePool = filtered.length > 0 ? filtered : pool;
  const tpl = choicePool[Math.floor(Math.random() * choicePool.length)];

  const stg = Math.max(1, state.currentStage);
  const target = Math.max(1, Math.round(tpl.baseTarget + tpl.scaleTarget * Math.min(20, stg)));
  const title = tpl.title.replace('{n}', fmt(target));
  const gold = Math.round((tpl.baseGold + stg * 8) * (getPlayerStats().goldMult || 1));
  const essence = Math.max(1, Math.round(tpl.baseEss + Math.floor(stg / 8)));

  state.bounty = {
    id: (state.bounty && state.bounty.id ? state.bounty.id : 0) + 1,
    type: tpl.type,
    title,
    target,
    current: 0,
    rewardGold: gold,
    rewardEssence: essence
  };
  updateBountyUI();
}

function checkBountyProgress(type, amount = 1) {
  if (!state.bounty || !isBountyValid(state.bounty.type)) {
    generateNextBounty();
    return;
  }
  if (state.bounty.type !== type) return;

  state.bounty.current = Math.min(state.bounty.target, state.bounty.current + amount);
  if (state.bounty.current >= state.bounty.target) {
    const rwGold = state.bounty.rewardGold || 0;
    const rwEss = state.bounty.rewardEssence || 0;
    state.gold += rwGold;
    if (rwEss > 0) state.essence += rwEss;
    playSound('item_select');

    // 퀘스트 완료 보상 골드 & 정수 비행 흡수 애니메이션 발동!
    const bountyBarEl = document.getElementById('bounty-bar') || document.getElementById('target-reward');
    if (rwGold > 0) {
      spawnGoldCoinFlight(rwGold, false, bountyBarEl);
    }
    if (rwEss > 0) {
      spawnEssenceFlight(rwEss, bountyBarEl);
    }

    spawnFloatingText(`✨ 퀘스트 완료! 🪙+${fmt(rwGold)} 🔮+${fmt(rwEss)}`, 'fct-proc', -55, { isBig: true });
    generateNextBounty();
  } else {
    updateBountyUI();
  }
}

function updateBountyUI() {
  if (!state.bounty || !isBountyValid(state.bounty.type)) {
    generateNextBounty();
    return;
  }
  const b = state.bounty;
  const titleEl = document.getElementById('bounty-title');
  const fillEl = document.getElementById('bounty-prog-fill');
  const textEl = document.getElementById('bounty-prog-text');
  const rewardEl = document.getElementById('bounty-reward');

  if (titleEl) titleEl.textContent = b.title;
  const pct = Math.min(100, Math.max(0, (b.current / b.target) * 100));
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (textEl) textEl.textContent = `${fmt(b.current)} / ${fmt(b.target)}`;
  if (rewardEl) rewardEl.textContent = `🪙 ${fmt(b.rewardGold)} · 🔮 ${fmt(b.rewardEssence)}`;
}

// ==========================================
// 15-B. 4단계: Stage 20(화염군주 라그나로스) 토벌 명예의 전당 엔딩 모달 & 무한 심연 모드
// ==========================================
function formatPlayTime(sec) {
  const totalSec = Math.max(0, Math.floor(sec || 0));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}시간 ${mins}분 ${secs}초`;
  }
  return `${mins}분 ${secs}초`;
}

function openVictoryModal(isFirstVictory = false) {
  const modal = document.getElementById('victory-modal');
  const grid = document.getElementById('victory-stats-grid');
  const titleEl = document.getElementById('victory-modal-title');
  const subEl = document.getElementById('victory-modal-subtitle');
  const bannerTitle = document.getElementById('victory-ascend-title');
  const bannerDesc = document.getElementById('victory-ascend-desc');
  const doAscendBtn = document.getElementById('btn-do-ascend');
  if (!modal || !grid) return;

  const stats = getPlayerStats();
  const evo = getCurrentFlameEvolution();
  const cleared20 = state.campaignCleared || state.highestClearedStage >= 20;
  const currentAsc = state.ascensionCount || 0;
  const nextAscMult = Math.pow(1.5, currentAsc + 1);

  if (isFirstVictory) {
    titleEl.textContent = '👑 화염군주 라그나로스 최초 토벌 완료!';
    subEl.textContent = '불타는 심연의 지배자를 물리치고 불사조의 영구 승천 자격을 획득했습니다!';
  } else if (cleared20) {
    titleEl.textContent = `🔥 불사조 승천실 (현재: 제${currentAsc}회차 환생)`;
    subEl.textContent = 'Stage 20 정복 완료! 언제든 불사조로 승천하여 영구 보너스를 획득하고 다시 질주할 수 있습니다.';
  } else {
    titleEl.textContent = '🏆 대마법사 원정 기록실 (목표: Stage 20)';
    subEl.textContent = 'Stage 20 최종 보스 [화염군주 라그나로스]를 토벌하면 불사조 승천 및 특성 포인트가 개방됩니다!';
  }

  const maxStageRecord = Math.max(state.highestClearedStage, state.recordHighestStage || 0);
  const baseFeathers = 1 + Math.max(0, Math.floor(((maxStageRecord || 20) - 20) / 5));
  const heatMult = 1 + getHeatBonusMult();
  const feathersGained = Math.round(baseFeathers * heatMult);
  const heatPctText = heatMult > 1 ? ` (규약 +${Math.round((heatMult - 1) * 100)}%)` : '';

  if (bannerTitle && bannerDesc) {
    bannerTitle.textContent = cleared20
      ? `🔥 불사조 승천 가능! (제${currentAsc + 1}회차 환생)`
      : `🔒 불사조 승천 (Stage 20 클리어 시 해금)`;
    bannerDesc.innerHTML = cleared20
      ? `지금 승천하면 <b>🪶 불사조 깃털 +${feathersGained}개${heatPctText}</b>, <b>🌟 영구 스킬 포인트 +1 SP</b> 및 <b>전체 피해량 x${nextAscMult.toFixed(2)}배 (누적 +50%씩)</b> 영구 증폭 축복을 받고 Stage 1로 환생합니다!`
      : `Phase 4 최종 보스 라그나로스를 처치하면 승천을 통해 불사조 깃털과 스킬 포인트를 얻고 영구 유물을 해금할 수 있습니다!`;
  }

  if (doAscendBtn) {
    doAscendBtn.style.display = cleared20 ? '' : 'none';
    doAscendBtn.textContent = `🔥 불사조 승천 진행 (+${feathersGained} 깃털 · +1 SP & x${nextAscMult.toFixed(2)}배)`;
  }

  const lastDur = state.stats?.lastBossKillDuration;
  const lastDiff = state.stats?.lastBossKillDiff;
  let durStr = '측정 없음';
  if (typeof lastDur === 'number' && lastDur > 0) {
    if (typeof lastDiff === 'number' && lastDiff > 0.1) {
      durStr = `${lastDur.toFixed(1)}초 <span style="color:#4ade80; font-weight:800;">(-${lastDiff.toFixed(1)}초 단축! ⚡)</span>`;
    } else {
      durStr = `${lastDur.toFixed(1)}초`;
    }
  }

  grid.innerHTML = `
    <div class="victory-stat-item">
      <span class="victory-stat-label">현재 승천 회차</span>
      <span class="victory-stat-val gold">제 ${currentAsc} 회차 (피해량 x${getAscensionDamageMult().toFixed(2)}배)</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">보스 처치 시간</span>
      <span class="victory-stat-val cyan">${durStr}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">발화 중 몰열 메테오</span>
      <span class="victory-stat-val gold">☄️ ${state.stats?.combustionPyros || 0}회 폭딜</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">최고 돌파 스테이지</span>
      <span class="victory-stat-val gold">STAGE ${maxStageRecord} ${cleared20 ? '👑' : ''}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">최고 달성 DPS</span>
      <span class="victory-stat-val gold">${fmt(state.maxDps)} /초</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">최종 주문 공격력 & 화염 단계</span>
      <span class="victory-stat-val cyan">${fmt(stats.sp)} (${evo.name})</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">마법 부여 & 특성 투자</span>
      <span class="victory-stat-val cyan">주입 ${getTotalInfusionLevels()} Lv · 특성 ${getSpentSkillPoints()} SP (보유 ${getAvailableSkillPoints()} SP)</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">누적 토벌 몬스터</span>
      <span class="victory-stat-val">${fmt(state.totalKills || 0)} 마리</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">누적 전투 시간</span>
      <span class="victory-stat-val">${formatPlayTime(state.playTimeSec)}</span>
    </div>
  `;

  modal.classList.remove('hidden');
  state.isPaused = true;
  playSound('proc');

  const card = modal.querySelector('.victory-modal-card');
  if (card) {
    card.classList.remove('hs-victory-pop');
    void card.offsetWidth;
    card.classList.add('hs-victory-pop');
  }
}

function closeVictoryModal() {
  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.add('hidden');
  state.isPaused = false;

  // 보스 토벌 후 몬스터가 없는 상태라면 정상 소환
  if (state.monster.hp <= 0) {
    loadStage(state.currentStage);
  }
}

function doAscend() {
  if (!state.campaignCleared && state.highestClearedStage < 20) {
    spawnFloatingText('🔒 Stage 20을 클리어해야 승천할 수 있습니다!', 'fct-normal', -40);
    return;
  }

  closeVictoryModal();
  state.isPaused = false;

  // 1. 최고 도달 기록 영구 보존 및 승천 횟수 증가 (영구 +1 SP 및 피해량 배수 누적)
  state.recordHighestStage = Math.max(state.recordHighestStage || 0, state.highestClearedStage);
  state.ascensionCount = (state.ascensionCount || 0) + 1;
  const baseFeathers = 1 + Math.max(0, Math.floor(((state.recordHighestStage || 20) - 20) / 5));
  const feathersGained = Math.round(baseFeathers * (1 + getHeatBonusMult()));
  state.phoenixFeathers = (state.phoenixFeathers || 0) + feathersGained;
  state.unfolded.artifactShop = true;
  state.unfolded.heatPacts = true;
  const ascMult = getAscensionDamageMult();

  // 2. 초기화 진행 (방안 A: 단기 진행도, 마도서 스킬, 초반 언폴딩 리셋)
  state.currentStage = 1;
  state.highestClearedStage = 0;
  state.gold = 10;

  // 일반 장비 레벨 초기화
  for (const k of Object.keys(state.items)) {
    state.items[k] = 0;
  }

  // 스킬 마스터리 초기화
  if (state.skillMastery) {
    for (const k of Object.keys(state.skillMastery)) {
      state.skillMastery[k] = 0;
    }
  }

  // ★ 스킬 유지 스피드런: 마도서(스킬)와 자동 시전 및 상점을 영구 보존하여, 승천 즉시 폭발적인 화력으로 스피드런 쾌감 제공!
  state.unfolded.grimoireShop = true;
  state.unfolded.stageNav = true;
  state.unfolded.equipShop = true;

  // 전투 상태 초기화
  state.combat.castingSkill = null;
  state.combat.castRemaining = 0;
  state.combat.gcdRemaining = 0;
  state.combat.critStreak = 0;
  state.combat.streakTimer = 0;
  state.combat.igniteRem = 0;
  state.combat.meteorBurnRem = 0;
  state.combat.flamePatchRem = 0;

  const s3 = document.getElementById('skill-3');
  if (s3) s3.classList.remove('proc-glow');

  // 3. 연출: 화면 전체 불사조 황금빛 폭발 파티클 및 웅장한 승천 사운드
  playSound('proc');
  playSound('meteor_impact');
  const casterCenter = getCasterCenter();
  spawnParticles(casterCenter.x, casterCenter.y, 48, '#fef08a', '#ea580c', 2.2);
  triggerArenaShake('lg');

  spawnFloatingText(`🔥 불사조 승천 완료! 🪶 +${feathersGained} 깃털 & 🌟 +1 SP! (피해량 x${ascMult.toFixed(2)}배 · 쾌속 스피드런 시작!)`, 'fct-proc', -55, { isBig: true });

  loadStage(1);
  checkAndTriggerUnfolds(true);
  updateSkillActionBarVisibility();
  saveGame();
  renderShopUI();
  renderSkillTreeUI();
  renderArtifactsUI();
  updateLiveHUD();
  updateNotificationBadges();

  // 특성 트리 탭으로 자동 전환하여 새로 얻은 스킬 포인트를 찍도록 유도!
  switchRightTab('tree');
}

// ==========================================
// 16. 메인 게임 루프 (60 FPS, 제한 시간 제거)
// ==========================================
let lastTime = performance.now();
let uiRefreshAccum = 0;

function gameLoop(nowMs) {
  const dt = Math.min(0.1, (nowMs - lastTime) / 1000);
  lastTime = nowMs;
  if (arenaEnvironment) {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    arenaEnvironment.update(dt, state.isPaused || document.hidden, reduced);
  }

  if (state.isPaused) {
    updateMageMotion(0, true);
    // 팝업/모달 표시 중: 전투 로직(캐스팅, 쿨다운, 도트 틱) 올스톱!
    // 단, 캔버스 파티클/VFX는 부드럽게 유지하여 시각적 생동감 보존
    try {
      updateAndDrawVfx(dt);
    } catch (e) {}
    requestAnimationFrame(gameLoop);
    return;
  }

  state.playTimeSec = (state.playTimeSec || 0) + dt;

  const c = state.combat;
  const stats = getPlayerStats();

  updateBossGimmick(dt);

  if (c.gcdRemaining > 0) {
    c.gcdRemaining = Math.max(0, c.gcdRemaining - dt);
  }

  if (c.castingSkill) {
    c.castRemaining -= dt;
    if (c.castRemaining <= 0) {
      const doneSkill = c.castingSkill;
      c.castingSkill = null;
      c.castRemaining = 0;
      updateCastingLoopSound();
      if (!state.autoCast && doneSkill === 'fireball') {
        triggerReadyFlash('skill-1');
      }
      finishCast(doneSkill);
    }
  }

  // 훈련용 허수아비 벤치마크 모드 타이머
  if (state.isTrainingDummy) {
    state.trainingTimer -= dt;
    const timerEl = document.getElementById('ui-training-timer');
    if (timerEl) {
      timerEl.textContent = `${Math.max(0, state.trainingTimer).toFixed(1)}s`;
    }
    if (state.trainingTimer <= 0) {
      finishTrainingDummyMode();
    }
  }

  const summonSpeedBonus = state.activeKeystone === 'summon' ? 1.5 : 1.0;
  if (state.skillTree.fire_elem > 0) {
    c.elemTimer += dt * stats.speedMult * summonSpeedBonus;
    if (c.elemTimer >= 1.3) {
      c.elemTimer -= 1.3;
      fireElementalAttack();
    }
  }

  if (state.skillTree.phoenix > 0) {
    c.phoenixTimer += dt * stats.speedMult * summonSpeedBonus;
    if (c.phoenixTimer >= 2.4) {
      c.phoenixTimer -= 2.4;
      firePhoenixAttack();
    }
  }

  if (state.skillTree.magma_golem > 0) {
    c.golemTimer += dt * stats.speedMult * summonSpeedBonus;
    if (c.golemTimer >= 2.8) {
      c.golemTimer -= 2.8;
      fireMagmaGolemAttack();
    }
  }

  // 3대 빌드 키스톤: 마력 폭주 활성화 중 쿨다운 회복 속도 2배 가속
  const cdDt = dt * (state.activeKeystone === 'burst' && c.combustionRem > 0 ? 2.0 : 1.0);

  if (state.grimoires.fireblast && c.fbCharges < c.fbMaxCharges) {
    c.fbRechargeRem -= cdDt;
    if (c.fbRechargeRem <= 0) {
      const prevCharges = c.fbCharges;
      c.fbCharges++;
      if (c.fbCharges < c.fbMaxCharges) {
        c.fbRechargeTotal = Math.max(3.5, (9.0 * (1 - stats.cdr)) / stats.speedMult);
        c.fbRechargeRem = c.fbRechargeTotal;
        // 0충전에서 1충전이 되어 다시 사용 가능해졌을 때도 번쩍임 연출!
        if (prevCharges === 0) {
          triggerReadyFlash('skill-2');
        }
      } else {
        c.fbRechargeRem = 0;
        triggerReadyFlash('skill-2');
      }
    }
  }

  if (c.combustionRem > 0) {
    c.combustionRem = Math.max(0, c.combustionRem - dt);
  }
  if (c.combustionCdRem > 0) {
    c.combustionCdRem = Math.max(0, c.combustionCdRem - dt);
    if (c.combustionCdRem === 0 && c.wasOnCd[4]) {
      triggerReadyFlash('skill-4');
      c.wasOnCd[4] = false;
    } else {
      c.wasOnCd[4] = true;
    }
  }
  if (c.meteorCdRem > 0) {
    c.meteorCdRem = Math.max(0, c.meteorCdRem - cdDt);
    if (c.meteorCdRem === 0 && c.wasOnCd[3]) {
      triggerReadyFlash('skill-3');
      c.wasOnCd[3] = false;
    } else {
      c.wasOnCd[3] = true;
    }
  }
  if (c.flamePatchCdRem > 0) {
    c.flamePatchCdRem = Math.max(0, c.flamePatchCdRem - cdDt);
    if (c.flamePatchCdRem === 0 && c.wasOnCd[6]) {
      triggerReadyFlash('skill-6');
      c.wasOnCd[6] = false;
    } else {
      c.wasOnCd[6] = true;
    }
  }

  if (c.critStreak > 0) {
    c.streakTimer -= dt;
    if (c.streakTimer <= 0) {
      c.critStreak = 0;
    }
  }

  if (c.igniteRem > 0) {
    c.igniteRem = Math.max(0, c.igniteRem - dt);
    c.igniteTickTimer += dt;
    const tickInterval = state.grimoires.ignite ? 0.65 : 0.85;
    if (c.igniteTickTimer >= tickInterval) {
      c.igniteTickTimer -= tickInterval;
      const tickDmg = c.ignitePool / 5.0;
      if (tickDmg >= 1) {
        dealDamage('ignite', tickDmg, false, false, true);
      }
    }
  }

  if (c.meteorBurnRem > 0) {
    c.meteorBurnRem = Math.max(0, c.meteorBurnRem - dt);
    c.meteorBurnTickTimer += dt;
    if (c.meteorBurnTickTimer >= 0.85) {
      c.meteorBurnTickTimer -= 0.85;
      dealDamage('meteor', stats.sp * 0.35, false, false, true);
    }
  }

  if (c.flamePatchRem > 0) {
    c.flamePatchRem = Math.max(0, c.flamePatchRem - dt);
    c.flamePatchTickTimer += dt;
    const patchLv = Math.max(1, state.skillTree.flame_patch || 1);
    if (c.flamePatchTickTimer >= 0.5) {
      c.flamePatchTickTimer -= 0.5;
      const golemBonus = (state.skillTree.magma_golem || 0) * 0.15;
      const tickDmg = stats.sp * (0.4 * patchLv) * (1 + golemBonus) * (stats.igniteMult || 1);
      dealDamage('flame_patch', tickDmg, false, false, true);
    }
  }

  try {
    updateCastingLoopSound();
    updateBurningLoopSound();
    runSmartAutoCast();
    updateMageMotion(dt, false);
    updateAndDrawVfx(dt);
    updateLiveHUD();
  } catch (loopErr) {
    console.error('gameLoop internal error:', loopErr);
  }

  uiRefreshAccum += dt;
  if (uiRefreshAccum >= 0.25) {
    uiRefreshAccum = 0;
    try {
      updateDpsMeterUI();
    } catch (e) {}
  }

  requestAnimationFrame(gameLoop);
}

// ==========================================
// 17. 실시간 HUD & DPS 미터기 업데이트
// ==========================================
function updateLiveHUD() {
  const stats = getPlayerStats();
  const c = state.combat;

  // 골드 동전 및 불꽃의 정수가 곡선 비행하여 상단 알약 UI에 하나씩 닿을 때마다 숫자가 차르륵 올라가도록 표시!
  const pendingGold = Math.min(state.gold, Math.max(0, state.pendingCoinGold || 0));
  const displayedGold = Math.max(0, Math.round(state.gold - pendingGold));
  document.getElementById('ui-gold').textContent = fmt(displayedGold);

  const essEl = document.getElementById('ui-essence');
  if (essEl) {
    const curEssence = state.essence || 0;
    const pendingEss = Math.min(curEssence, Math.max(0, state.pendingEssence || 0));
    const displayedEssence = Math.max(0, Math.round(curEssence - pendingEss));
    essEl.textContent = fmt(displayedEssence);
  }
  const featherEl = document.getElementById('ui-feathers');
  if (featherEl) {
    featherEl.textContent = fmt(state.phoenixFeathers || 0);
  }
  updatePityCritBadgeUI();
  document.getElementById('ui-sp').textContent = fmt(stats.sp);
  document.getElementById('ui-crit').textContent = `${stats.crit.toFixed(1)}%`;
  document.getElementById('ui-haste').textContent = `+${stats.haste.toFixed(0)}%`;
  document.getElementById('ui-power-summary').textContent = `주문 공격력 ${fmt(stats.sp)}`;

  const hpPct = Math.max(0, Math.min(100, (state.monster.hp / state.monster.maxHp) * 100));
  document.getElementById('target-hp-fill').style.width = `${hpPct}%`;
  document.getElementById('target-hp-text').textContent = `${fmt(state.monster.hp)} / ${fmt(state.monster.maxHp)}`;
  document.getElementById('target-hp-pct').textContent = `${hpPct.toFixed(0)}%`;

  const casterAvatar = document.getElementById('caster-avatar');
  const castingOrb = document.getElementById('casting-orb');
  const combBg = document.getElementById('combustion-bg');
  const isMeteorReady =
    c.castingSkill === 'meteor' || (state.grimoires.meteor && c.critStreak === 2);

  casterAvatar.classList.toggle('casting-active', Boolean(c.castingSkill) && !isMeteorReady);
  casterAvatar.classList.toggle('pyro-ready-mode', isMeteorReady);
  casterAvatar.classList.toggle('combustion-mode', c.combustionRem > 0);
  casterAvatar.classList.toggle('ascension-aura', (state.ascensionCount || 0) > 0);
  castingOrb.classList.toggle('active', Boolean(c.castingSkill) && !isMeteorReady);
  castingOrb.classList.toggle('pyro-ready', isMeteorReady);
  combBg.classList.toggle('active', c.combustionRem > 0);

  // 1-1. 발화(마력 폭주) 피버 모드 화면/미터기 테두리 활성화
  const isCombusting = c.combustionRem > 0;
  const arenaEl = document.getElementById('combat-arena');
  const meterEl = document.getElementById('dps-meter-panel');
  const feverTag = document.getElementById('dps-fever-tag');
  if (arenaEl) arenaEl.classList.toggle('fever-mode', isCombusting);
  if (meterEl) meterEl.classList.toggle('fever-mode', isCombusting);
  if (feverTag) feverTag.classList.toggle('hidden', !isCombusting);

  // 연계 신호는 실제 치명타와 발화 상태를 그대로 따라갑니다.
  const arenaArt = document.getElementById('combat-arena');
  arenaArt.classList.toggle('art-combustion', c.combustionRem > 0);
  arenaArt.classList.toggle('art-hot-streak', Boolean(state.grimoires.meteor && c.critStreak === 2));
  const heatSigils = document.getElementById('heat-sigils');
  heatSigils.hidden = !state.grimoires.meteor;
  heatSigils.dataset.heat = String(c.critStreak);
  heatSigils.setAttribute('aria-label', `연속 치명타 ${c.critStreak}회`);
  document.getElementById('skill-2').classList.toggle('art-followup', Boolean(state.grimoires.meteor && c.critStreak === 1 && c.fbCharges > 0));
  document.getElementById('skill-4').classList.toggle('art-active', c.combustionRem > 0);

  const castFill = document.getElementById('castbar-fill');
  const castWrapper = castFill ? castFill.parentElement : null;
  const castName = document.getElementById('castbar-name');
  const castTime = document.getElementById('castbar-time');
  if (castWrapper) castWrapper.classList.toggle('pyro-cast', isMeteorReady);
  if (castFill) castFill.classList.toggle('pyro-cast', isMeteorReady);

  if (c.castingSkill) {
    const progress = ((c.castTotal - c.castRemaining) / c.castTotal) * 100;
    castFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    if (c.castingSkill === 'meteor') {
      castName.textContent = '☄️ 메테오 시전 중';
    } else if (isMeteorReady) {
      castName.textContent = '🔥 화염구 (☄️메테오 장전됨!)';
    } else {
      castName.textContent = '🔥 화염구';
    }
    castTime.textContent = `${c.castRemaining.toFixed(1)}s`;
  } else if (state.grimoires.meteor && c.critStreak === 2) {
    castFill.style.width = '100%';
    castName.textContent = '☄️ 메테오 준비 완료!';
    castTime.textContent = '즉시 발사!';
  } else {
    castFill.style.width = '0%';
    castName.textContent = state.autoCast ? '🤖 자동 시전 중' : '대기 중';
    castTime.textContent = '';
  }

  const buffRow = document.getElementById('player-buffs');
  let buffsHtml = '';
  if (c.combustionRem > 0) {
    buffsHtml += `<div class="buff-chip combustion">☀️ 마력 폭주 (${c.combustionRem.toFixed(1)}s)</div>`;
  }
  buffRow.innerHTML = buffsHtml;

  const debuffRow = document.getElementById('target-debuffs');
  let debuffHtml = '';
  if (c.igniteRem > 0 && c.ignitePool >= 5) {
    debuffHtml += `<div class="debuff-chip">🩸 화상 ${fmt(c.ignitePool / 5)} (${c.igniteRem.toFixed(1)}s)</div>`;
  }
  if (c.flamePatchRem > 0) {
    debuffHtml += `<div class="debuff-chip">🔥 불장판 (${c.flamePatchRem.toFixed(1)}s)</div>`;
  }
  if (c.meteorBurnRem > 0) {
    debuffHtml += `<div class="debuff-chip">☄️ 연소 (${c.meteorBurnRem.toFixed(1)}s)</div>`;
  }
  debuffRow.innerHTML = debuffHtml;

  const dummyAvatar = document.getElementById('dummy-avatar');
  if (dummyAvatar) {
    const isBurning = (c.igniteRem > 0 && c.ignitePool >= 5) || c.flamePatchRem > 0 || c.meteorBurnRem > 0;
    dummyAvatar.classList.toggle('is-burning', isBurning);
  }

  setRadialSweep(document.getElementById('gcd-1'), c.gcdRemaining, c.gcdTotal, false);

  if (state.grimoires.fireblast) {
    const charges2 = document.getElementById('charges-2');
    if (charges2) charges2.textContent = c.fbCharges > 0 ? c.fbCharges : '';
    if (c.fbCharges === 0) {
      setRadialSweep(document.getElementById('cd-2'), c.fbRechargeRem, c.fbRechargeTotal, true);
    } else {
      setRadialSweep(document.getElementById('cd-2'), 0, 0, false);
    }
    document.getElementById('skill-2').classList.remove('proc-glow');
  }

  const btn3 = document.getElementById('skill-3');
  if (btn3) {
    const isMeteorProc = Boolean(state.grimoires.meteor && c.critStreak === 2);
    btn3.classList.toggle('proc-glow', isMeteorProc);
    if (state.grimoires.meteor) {
      setRadialSweep(document.getElementById('gcd-3'), c.critStreak === 2 ? 0 : c.gcdRemaining, c.gcdTotal, false);
    }
  }

  if (state.grimoires.combustion) {
    setRadialSweep(document.getElementById('cd-4'), c.combustionCdRem, c.combustionCdTotal, true);
  }

  if (state.grimoires.meteor) {
    setRadialSweep(document.getElementById('cd-3'), c.critStreak === 2 ? 0 : c.meteorCdRem, c.meteorCdTotal, true);
  }

  if ((state.skillTree.flame_patch || 0) > 0) {
    setRadialSweep(document.getElementById('cd-6'), c.flamePatchCdRem, c.flamePatchCdTotal, true);
  }
}

function updateDpsMeterUI() {
  const now = performance.now() / 1000;
  const windowSec = 6.0;

  state.dpsHistory = state.dpsHistory.filter((entry) => now - entry.time <= windowSec);
  const sumDmg = state.dpsHistory.reduce((acc, e) => acc + e.amount, 0);
  state.currentDps = Math.round(sumDmg / windowSec);

  checkAndRecordDpsClear();

  const reqDps = getStageReqDps(state.currentStage);
  const dpsMet = isStageDpsMet(state.currentStage);

  const dpsEl = document.getElementById('ui-current-dps');
  dpsEl.textContent = `${fmt(state.currentDps)} /초`;
  dpsEl.classList.toggle('enough', state.currentDps >= reqDps || dpsMet);

  const reqEl = document.getElementById('ui-req-dps');
  reqEl.textContent = dpsMet ? `${fmt(reqDps)} /초 ✔` : `${fmt(reqDps)} /초`;

  const breakdownContainer = document.getElementById('skill-breakdown-bars');
  const skillsArr = Object.values(state.skillDamage).filter((s) => s.dmg > 0);
  const totalAllDmg = skillsArr.reduce((a, b) => a + b.dmg, 0);

  if (totalAllDmg > 0) {
    skillsArr.sort((a, b) => b.dmg - a.dmg);
    breakdownContainer.innerHTML = skillsArr
      .slice(0, 3)
      .map((s) => {
        const pct = ((s.dmg / totalAllDmg) * 100).toFixed(0);
        return `
          <div class="mini-bar-row">
            <div class="mini-bar-fill" style="width:${pct}%; background:${s.color};"></div>
            <span class="mini-bar-left">${s.name}</span>
            <span class="mini-bar-right">${fmt(s.dmg)} (${pct}%)</span>
          </div>
        `;
      })
      .join('');
  }

  updateNotificationBadges();
}

function updateDevCheatUI() {
  const devBtn = document.getElementById('btn-dev-mode');
  const devPanel = document.getElementById('dev-cheat-panel');
  const critBtn = document.getElementById('btn-cheat-always-crit');
  const critStateEl = document.getElementById('ui-cheat-crit-state');

  if (devBtn) {
    devBtn.classList.toggle('active', Boolean(state.devMode));
    devBtn.textContent = state.devMode ? '🛠️ 개발자 모드: ON' : '🛠️ 개발자 모드';
  }
  if (devPanel) {
    devPanel.classList.toggle('hidden', !state.devMode);
  }
  const alwaysCritOn = Boolean(state.cheats && state.cheats.alwaysCrit);
  if (critBtn) {
    critBtn.classList.toggle('active', alwaysCritOn);
  }
  if (critStateEl) {
    critStateEl.textContent = alwaysCritOn ? 'ON' : 'OFF';
  }
}

// ==========================================
// 18. 세이브 / 로드 & 이벤트 바인딩
// ==========================================
function saveGame() {
  try {
    const payload = {
      gold: state.gold,
      essence: state.essence,
      currentStage: state.currentStage,
      highestClearedStage: state.highestClearedStage,
      recordHighestStage: state.recordHighestStage || 0,
      dpsClearedStage: state.dpsClearedStage,
      maxDps: state.maxDps,
      playTimeSec: state.playTimeSec,
      totalKills: state.totalKills,
      campaignCleared: state.campaignCleared,
      autoCast: state.autoCast,
      autoAdvance: state.autoAdvance,
      skillAuto: state.skillAuto,
      soundOn: state.soundOn,
      bgmVolume: state.bgmVolume,
      sfxVolume: state.sfxVolume,
      devMode: state.devMode,
      cheats: state.cheats,
      unfolded: state.unfolded,
      bonusSkillPoints: state.bonusSkillPoints,
      skillTree: state.skillTree,
      grimoires: state.grimoires,
      items: state.items,
      infusions: state.infusions,
      ascensionCount: state.ascensionCount,
      canAscend: state.canAscend,
      phoenixFeathers: state.phoenixFeathers,
      artifacts: state.artifacts,
      activeKeystone: state.activeKeystone,
      dummyRecordDps: state.dummyRecordDps,
      bossClearTimes: state.bossClearTimes,
      heatPacts: state.heatPacts,
      skillMastery: state.skillMastery,
      stats: state.stats,
      bounty: state.bounty
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

// 옛 저장 데이터의 투자 보너스를 손실 없이 한 번만 이전합니다.
function migrateMeteorSave() {
  if (state.grimoires.pyroblast) state.grimoires.meteor = true;
  const oldLevel = Math.max(0, Number(state.skillMastery.pyroblast) || 0);
  state.skillMastery.meteor += Math.ceil(oldLevel * 0.1 / 0.12);
  if (Object.hasOwn(state.skillAuto, 'pyroblast')) state.skillAuto.meteor = state.skillAuto.pyroblast;
  delete state.grimoires.pyroblast;
  delete state.skillMastery.pyroblast;
  delete state.skillAuto.pyroblast;
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.gold === 'number') state.gold = data.gold;
    if (typeof data.essence === 'number') state.essence = data.essence;
    if (typeof data.currentStage === 'number') state.currentStage = data.currentStage;
    if (typeof data.highestClearedStage === 'number') state.highestClearedStage = data.highestClearedStage;
    if (typeof data.recordHighestStage === 'number') state.recordHighestStage = data.recordHighestStage;
    if (typeof data.dpsClearedStage === 'number') state.dpsClearedStage = data.dpsClearedStage;
    if (typeof data.maxDps === 'number') state.maxDps = data.maxDps;
    if (typeof data.playTimeSec === 'number') state.playTimeSec = data.playTimeSec;
    if (typeof data.totalKills === 'number') state.totalKills = data.totalKills;
    if (typeof data.campaignCleared === 'boolean') state.campaignCleared = data.campaignCleared;
    if (typeof data.autoCast === 'boolean') state.autoCast = data.autoCast;
    if (typeof data.autoAdvance === 'boolean') state.autoAdvance = data.autoAdvance;
    if (data.skillAuto) Object.assign(state.skillAuto, data.skillAuto);
    if (typeof data.soundOn === 'boolean') state.soundOn = data.soundOn;
    if (typeof data.bgmVolume === 'number') state.bgmVolume = Math.max(0, Math.min(1, data.bgmVolume));
    if (typeof data.sfxVolume === 'number') state.sfxVolume = Math.max(0, Math.min(1, data.sfxVolume));
    if (typeof data.devMode === 'boolean') state.devMode = data.devMode;
    if (data.cheats) Object.assign(state.cheats, data.cheats);
    if (typeof data.bonusSkillPoints === 'number') state.bonusSkillPoints = data.bonusSkillPoints;
    if (data.unfolded) Object.assign(state.unfolded, data.unfolded);
    if (data.skillTree) Object.assign(state.skillTree, data.skillTree);
    if (data.grimoires) Object.assign(state.grimoires, data.grimoires);
    if (data.items) Object.assign(state.items, data.items);
    if (data.infusions) Object.assign(state.infusions, data.infusions);
    if (typeof data.phoenixFeathers === 'number') state.phoenixFeathers = data.phoenixFeathers;
    if (data.artifacts) Object.assign(state.artifacts, data.artifacts);
    if (typeof data.activeKeystone === 'string' || data.activeKeystone === null) state.activeKeystone = data.activeKeystone;
    if (typeof data.dummyRecordDps === 'number') state.dummyRecordDps = data.dummyRecordDps;
    if (data.bossClearTimes) state.bossClearTimes = Object.assign({}, data.bossClearTimes);
    if (data.heatPacts) Object.assign(state.heatPacts, data.heatPacts);
    if (typeof data.ascensionCount === 'number') state.ascensionCount = data.ascensionCount;
    if (typeof data.canAscend === 'boolean') state.canAscend = data.canAscend;
    if (data.skillMastery) Object.assign(state.skillMastery, data.skillMastery);
    if (data.stats) Object.assign(state.stats, data.stats);
    if (data.bounty) Object.assign(state.bounty, data.bounty);
    if (!state.bounty || !isBountyValid(state.bounty.type)) {
      generateNextBounty();
    }
    migrateMeteorSave();
    saveGame();
  } catch (e) {}
}

function initEvents() {
  initSkillTooltips();
  document.getElementById('dummy-avatar').addEventListener('click', () => {
    if (state.grimoires.meteor && state.combat.critStreak === 2) {
      triggerSkill('meteor');
    } else {
      triggerSkill('fireball');
    }
  });

  document.querySelectorAll('.skill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skill = btn.getAttribute('data-skill');
      triggerSkill(skill);
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const skill = btn.getAttribute('data-skill');
      if (skill && state.grimoires.autocast) {
        toggleSkillAuto(skill);
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const detailsModal = document.getElementById('details-modal');
      if (detailsModal && !detailsModal.classList.contains('hidden')) {
        closeDetailsModal();
        return;
      }
    }

    const map = {
      Digit1: 'fireball',
      Digit2: 'fireblast',
      Digit3: 'meteor',
      Digit4: 'combustion',
      Digit6: 'flame_patch'
    };
    const skill = map[e.code] || map[`Digit${e.key}`];
    if (skill) {
      triggerSkill(skill);
    }
  });

  document.getElementById('btn-prev-stage').addEventListener('click', () => {
    if (state.currentStage > 1) {
      playSound('item_select');
      loadStage(state.currentStage - 1);
      saveGame();
    }
  });

  // 다음 도전 버튼: 반드시 canAdvanceToNextStage() (현재 스테이지 몬스터 1회 처치 완료 + 요구 DPS 충족) 확인!
  document.getElementById('btn-next-stage').addEventListener('click', () => {
    if (canAdvanceToNextStage()) {
      playSound('item_select');
      loadStage(state.currentStage + 1);
      saveGame();
    }
  });

  const autoAdvanceChk = document.getElementById('chk-auto-advance');
  if (autoAdvanceChk) {
    autoAdvanceChk.checked = state.autoAdvance !== false;
    autoAdvanceChk.addEventListener('change', () => {
      state.autoAdvance = autoAdvanceChk.checked;
      saveGame();
    });
  }

  document.getElementById('btn-auto-cast').addEventListener('click', () => {
    if (!state.grimoires.autocast) return;
    state.autoCast = !state.autoCast;
    updateSkillActionBarVisibility();
    updateNotificationBadges();
    saveGame();
  });

  document.getElementById('tab-btn-shop').addEventListener('click', () => switchRightTab('shop'));
  const infTabBtn = document.getElementById('tab-btn-infusion');
  if (infTabBtn) infTabBtn.addEventListener('click', () => switchRightTab('infusion'));
  document.getElementById('tab-btn-tree').addEventListener('click', () => switchRightTab('tree'));
  const artTabBtn = document.getElementById('tab-btn-artifacts');
  if (artTabBtn) artTabBtn.addEventListener('click', () => switchRightTab('artifacts'));

  const artListEl = document.getElementById('artifacts-shop-list');
  if (artListEl) {
    artListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-artifact]');
      if (!btn) return;
      const id = btn.getAttribute('data-artifact');
      buyArtifact(id);
    });
  }

  const keystoneBox = document.getElementById('keystone-selector-box');
  if (keystoneBox) {
    keystoneBox.addEventListener('click', (e) => {
      const card = e.target.closest('[data-keystone]');
      if (!card) return;
      const id = card.getAttribute('data-keystone');
      toggleKeystone(id);
    });
  }

  const btnDummy = document.getElementById('btn-training-dummy');
  if (btnDummy) {
    btnDummy.addEventListener('click', () => {
      if (state.isTrainingDummy) {
        finishTrainingDummyMode();
      } else {
        startTrainingDummyMode();
      }
    });
  }
  const btnFinishTraining = document.getElementById('btn-finish-training');
  if (btnFinishTraining) {
    btnFinishTraining.addEventListener('click', () => finishTrainingDummyMode());
  }
  const btnExitTraining = document.getElementById('btn-exit-training');
  if (btnExitTraining) {
    btnExitTraining.addEventListener('click', () => exitTrainingDummyMode());
  }

  const btnHeat = document.getElementById('btn-heat-pacts');
  if (btnHeat) {
    btnHeat.addEventListener('click', () => {
      openHeatModal();
    });
  }
  const btnCloseHeat = document.getElementById('btn-close-heat');
  if (btnCloseHeat) {
    btnCloseHeat.addEventListener('click', () => {
      closeHeatModal();
    });
  }
  const modalHeat = document.getElementById('modal-heat-pacts');
  if (modalHeat) {
    modalHeat.addEventListener('click', (e) => {
      if (e.target === modalHeat) closeHeatModal();
    });
    modalHeat.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
      chk.addEventListener('change', () => {
        const card = chk.closest('[data-pact]');
        if (!card) return;
        const pactKey = card.getAttribute('data-pact');
        if (!state.heatPacts) state.heatPacts = {};
        state.heatPacts[pactKey] = chk.checked;
        playSound('item_select');
        renderHeatUI();
        saveGame();
      });
    });
  }

  const infListEl = document.getElementById('infusion-shop-list');
  if (infListEl) {
    infListEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-infusion]');
      if (!btn) return;
      const id = btn.getAttribute('data-infusion');
      const inf = INFUSION_LIST.find((x) => x.id === id);
      if (!inf) return;
      const lv = state.infusions[id] || 0;
      const cost = getInfusionCost(inf);
      if (lv >= inf.maxLv || (state.essence || 0) < cost) return;

      state.essence -= cost;
      state.infusions[id] = lv + 1;
      playSound('item_select');
      spawnFloatingText(`🔮 ${inf.name} Lv.${lv + 1}!`, 'fct-essence', -40, { anchor: 'caster' });
      checkAndTriggerUnfolds(false);
      updateFlameEvolutionUI(false);
      updateStageUI();
      saveGame();
      renderInfusionUI();
      renderShopUI();
    });
  }

  const treeContainer = document.getElementById('skill-tree-container');
  treeContainer.addEventListener('mouseover', (e) => {
    const inspectEl = e.target.closest('[data-inspect-node]');
    if (!inspectEl) return;
    const id = inspectEl.getAttribute('data-inspect-node');
    if (!id || id === selectedTalentId) return;

    selectedTalentId = id;
    treeContainer.querySelectorAll('.wow-talent-node').forEach((nodeBtn) => {
      nodeBtn.classList.toggle('is-selected', nodeBtn.getAttribute('data-inspect-node') === id);
    });
    const tooltipEl = document.getElementById('wow-talent-tooltip');
    if (tooltipEl) {
      tooltipEl.innerHTML = buildTalentTooltipHtml(id);
    }
  });

  treeContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tree-node]');
    if (!btn) return;
    const id = btn.getAttribute('data-tree-node');
    const node = SKILL_TREE_NODES.find((n) => n.id === id);
    if (!node) return;

    selectedTalentId = id;
    const lv = state.skillTree[id] || 0;
    const availSp = getAvailableSkillPoints();
    const spentSp = getSpentSkillPoints();

    if (lv >= node.maxLv || availSp < node.cost || spentSp < node.reqTotalSp) {
      renderSkillTreeUI();
      return;
    }

    state.skillTree[id] = lv + 1;
    if (id === 'fire_elem') {
      triggerFireSpiritSpawn();
    } else {
      playSound('item_select');
    }
    spawnFloatingText(`🌟 ${node.name} Lv.${lv + 1}!`, 'fct-proc', -42, { anchor: 'caster' });
    updateSkillActionBarVisibility();
    if (id === 'flame_patch' && lv === 0) {
      triggerUnfoldPop('skill-6');
      triggerReadyFlash('skill-6');
    }
    saveGame();
    renderSkillTreeUI();
    renderShopUI();
  });

  document.getElementById('btn-respec-tree').addEventListener('click', () => {
    for (const k of Object.keys(state.skillTree)) {
      state.skillTree[k] = 0;
    }
    state.combat.flamePatchRem = 0;
    state.combat.flamePatchCdRem = 0;
    state.combat.elemSpawnTimer = 0;
    playSound('item_select');
    updateSkillActionBarVisibility();
    saveGame();
    renderSkillTreeUI();
    renderShopUI();
  });

  document.getElementById('grimoire-shop-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-grimoire]');
    if (!btn) return;
    const id = btn.getAttribute('data-grimoire');
    const g = GRIMOIRE_LIST.find((x) => x.id === id);
    if (!g || state.grimoires[id] || state.gold < g.cost) return;

    state.gold -= g.cost;
    state.grimoires[id] = true;
    if (id === 'autocast') {
      state.autoCast = true;
      const circleEl = document.getElementById('autocast-magic-circle');
      if (circleEl) {
        circleEl.classList.remove('hidden');
        circleEl.classList.remove('unfold-pop');
        void circleEl.offsetWidth;
        circleEl.classList.add('unfold-pop');
      }
    }
    playSound('item_select');
    spawnFloatingText(`📜 ${g.name}!`, 'fct-proc', -35, { anchor: 'caster' });
    checkAndTriggerUnfolds(false);
    updateSkillActionBarVisibility();
    saveGame();
    renderShopUI();
  });

  document.getElementById('item-shop-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-item]');
    if (!btn) return;
    const id = btn.getAttribute('data-item');
    const it = EQUIPMENT_LIST.find((x) => x.id === id);
    if (!it) return;
    const cost = getItemCost(it);
    if (state.gold < cost) return;

    state.gold -= cost;
    state.items[id] = (state.items[id] || 0) + 1;
    playSound('item_select');
    checkAndTriggerUnfolds(false);
    updateFlameEvolutionUI(false);
    saveGame();
    renderShopUI();
  });

  const masteryShopList = document.getElementById('mastery-shop-list');
  if (masteryShopList) {
    masteryShopList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mastery]');
      if (!btn) return;
      const id = btn.getAttribute('data-mastery');
      const m = SKILL_MASTERY_LIST.find((x) => x.id === id);
      if (!m) return;
      const cost = getSkillMasteryCost(m);
      if (state.gold < cost) return;

      state.gold -= cost;
      if (!state.skillMastery) state.skillMastery = {};
      state.skillMastery[id] = (state.skillMastery[id] || 0) + 1;
      playSound('item_select');
      spawnFloatingText(`✨ ${m.name} Lv.${state.skillMastery[id]}!`, 'fct-proc', -35, { anchor: 'caster' });
      updateSkillActionBarVisibility();
      saveGame();
      renderShopUI();
    });
  }

  const flameBadgeBtn = document.getElementById('flame-evo-badge');
  if (flameBadgeBtn) {
    flameBadgeBtn.addEventListener('click', () => {
      const curPreview = state.previewFlameTier || 0;
      if (curPreview === 0) {
        state.previewFlameTier = 1;
      } else if (curPreview < 5) {
        state.previewFlameTier = curPreview + 1;
      } else {
        state.previewFlameTier = 0;
      }
      playSound('item_select');
      updateFlameEvolutionUI(true);
    });
  }

  const ascendBtn = document.getElementById('btn-ascend');
  if (ascendBtn) {
    ascendBtn.addEventListener('click', () => {
      playSound('item_select');
      openVictoryModal(false);
    });
  }

  const doAscendBtn = document.getElementById('btn-do-ascend');
  if (doAscendBtn) {
    doAscendBtn.addEventListener('click', () => {
      doAscend();
    });
  }

  const hallBtn = document.getElementById('btn-hall-of-fame');
  if (hallBtn) {
    hallBtn.addEventListener('click', () => {
      playSound('item_select');
      openVictoryModal(false);
    });
  }

  const vicContinueBtn = document.getElementById('btn-victory-continue');
  if (vicContinueBtn) {
    vicContinueBtn.addEventListener('click', () => {
      playSound('item_select');
      closeVictoryModal();
      if (state.currentStage === 20 && canAdvanceToNextStage()) {
        loadStage(21);
        saveGame();
      }
    });
  }

  const vicJump20Btn = document.getElementById('btn-victory-jump-20');
  if (vicJump20Btn) {
    vicJump20Btn.addEventListener('click', () => {
      playSound('item_select');
      closeVictoryModal();
      state.highestClearedStage = Math.max(state.highestClearedStage, 19);
      state.dpsClearedStage = Math.max(state.dpsClearedStage, 19);
      loadStage(20);
      saveGame();
    });
  }

  const devModeBtn = document.getElementById('btn-dev-mode');
  if (devModeBtn) {
    devModeBtn.addEventListener('click', () => {
      state.devMode = !state.devMode;
      playSound('item_select');
      updateDevCheatUI();
      saveGame();
    });
  }

  const cheatGoldBtn = document.getElementById('btn-cheat-gold');
  if (cheatGoldBtn) {
    cheatGoldBtn.addEventListener('click', () => {
      state.gold += 10000;
      playSound('drop_coin');
      triggerGoldPillPulse();
      spawnFloatingText('💰 +10,000 G', 'fct-gold', -40, { anchor: 'caster' });
      checkAndTriggerUnfolds(false);
      updateLiveHUD();
      renderShopUI();
      updateNotificationBadges();
      saveGame();
    });
  }

  const cheatEssenceBtn = document.getElementById('btn-cheat-essence');
  if (cheatEssenceBtn) {
    cheatEssenceBtn.addEventListener('click', () => {
      state.essence = (state.essence || 0) + 10000;
      playSound('item_select');
      checkAndTriggerUnfolds(false);
      triggerEssencePillPulse();
      spawnFloatingText('🔹 +10,000 정수!', 'fct-essence', -42, { anchor: 'caster' });
      updateLiveHUD();
      renderInfusionUI();
      updateNotificationBadges();
      saveGame();
    });
  }

  const cheatSpBtn = document.getElementById('btn-cheat-sp');
  if (cheatSpBtn) {
    cheatSpBtn.addEventListener('click', () => {
      state.bonusSkillPoints = (state.bonusSkillPoints || 0) + 10000;
      playSound('item_select');
      spawnFloatingText('🌟 +10,000 SP!', 'fct-proc', -40, { anchor: 'caster' });
      checkAndTriggerUnfolds(false);
      updateSkillActionBarVisibility();
      renderSkillTreeUI();
      updateNotificationBadges();
      saveGame();
    });
  }

  const cheatCritBtn = document.getElementById('btn-cheat-always-crit');
  if (cheatCritBtn) {
    cheatCritBtn.addEventListener('click', () => {
      state.cheats.alwaysCrit = !state.cheats.alwaysCrit;
      playSound('item_select');
      spawnFloatingText(
        state.cheats.alwaysCrit ? '💥 100% 치명타 ON!' : '💥 100% 치명타 OFF',
        'fct-proc',
        -40,
        { anchor: 'caster' }
      );
      updateDevCheatUI();
      updateLiveHUD();
      saveGame();
    });
  }

  const unfoldAllBtn = document.getElementById('btn-unfold-all');
  if (unfoldAllBtn) {
    unfoldAllBtn.addEventListener('click', () => {
      state.unfolded.stageNav = true;
      state.unfolded.grimoireShop = true;
      state.unfolded.equipShop = true;
      state.unfolded.infusionShop = true;
      state.unfolded.skillTree = true;
      state.unfolded.hallOfFame = true;
      state.unfolded.artifactShop = true;
      state.unfolded.trainingDummy = true;
      state.unfolded.heatPacts = true;
      playSound('item_select');
      showUnfoldToast('🔓 모든 시스템 UI 개방 완료!', '스테이지 이동, 주문서, 장비 강화, 마법 부여, 특성 트리, 불사조 유물, 허수아비 훈련장이 모두 펼쳐졌습니다.');
      applyUnfoldedVisibility();
      updateSkillActionBarVisibility();
      renderInfusionUI();
      renderArtifactsUI();
      saveGame();
    });
  }

  const soundBtn = document.getElementById('btn-sound');
  const soundPopover = document.getElementById('sound-popover');
  const soundMenuWrap = document.getElementById('sound-menu-wrap');
  const muteAllBtn = document.getElementById('btn-sound-mute-all');
  const bgmSlider = document.getElementById('slider-bgm-vol');
  const sfxSlider = document.getElementById('slider-sfx-vol');

  if (soundBtn && soundPopover) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      soundPopover.classList.toggle('hidden');
      updateSoundUI();
    });
  }

  window.addEventListener('pointerdown', (e) => {
    if (soundPopover && !soundPopover.classList.contains('hidden')) {
      if (soundMenuWrap && !soundMenuWrap.contains(e.target)) {
        soundPopover.classList.add('hidden');
      }
    }
  });

  if (muteAllBtn) {
    muteAllBtn.addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      updateSoundUI();
      updateBgmPlayback();
      updateCastingLoopSound();
      updateBurningLoopSound();
      saveGame();
    });
  }

  if (bgmSlider) {
    bgmSlider.addEventListener('input', () => {
      state.bgmVolume = Math.max(0, Math.min(1, Number(bgmSlider.value) / 100));
      if (state.bgmVolume > 0 && !state.soundOn) {
        state.soundOn = true;
      }
      updateSoundUI();
      updateBgmPlayback();
      saveGame();
    });
  }

  const skipBtn = document.getElementById('btn-sound-skip');
  if (skipBtn) {
    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.soundOn) {
        state.soundOn = true;
        updateSoundUI();
      }
      playNextBgmTrack();
    });
  }

  if (sfxSlider) {
    sfxSlider.addEventListener('input', () => {
      state.sfxVolume = Math.max(0, Math.min(1, Number(sfxSlider.value) / 100));
      if (state.sfxVolume > 0 && !state.soundOn) {
        state.soundOn = true;
      }
      updateSoundUI();
      updateCastingLoopSound();
      updateBurningLoopSound();
      saveGame();
    });
  }

  // 브라우저 자동재생 정책 해제용: 첫 클릭 또는 키 입력 시 사운드가 켜져 있으면 즉시 BGM 재생 시작
  const unlockBgmOnInteract = () => {
    if (state.soundOn) {
      updateBgmPlayback();
    }
  };
  window.addEventListener('pointerdown', unlockBgmOnInteract);
  window.addEventListener('keydown', unlockBgmOnInteract);

  const meterPanel = document.getElementById('dps-meter-panel');
  if (meterPanel) {
    meterPanel.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        openDetailsModal();
      }
    });
  }

  const openDetailsBtn = document.getElementById('btn-open-details');
  if (openDetailsBtn) {
    openDetailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDetailsModal();
    });
  }

  const detailsModal = document.getElementById('details-modal');
  if (detailsModal) {
    detailsModal.addEventListener('click', (e) => {
      if (e.target === detailsModal) {
        closeDetailsModal();
      }
    });
  }

  const closeDetailsBtn = document.getElementById('btn-details-close');
  if (closeDetailsBtn) {
    closeDetailsBtn.addEventListener('click', closeDetailsModal);
  }

  const okDetailsBtn = document.getElementById('btn-details-ok');
  if (okDetailsBtn) {
    okDetailsBtn.addEventListener('click', closeDetailsModal);
  }

  const resetDetailsBtn = document.getElementById('btn-details-reset');
  if (resetDetailsBtn) {
    resetDetailsBtn.addEventListener('click', resetDetailsStats);
  }

  document.getElementById('btn-reset-save').addEventListener('click', () => {
    if (confirm('처음부터 다시 시작하시겠습니까?')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });
}

// ==========================================
// 19. 초기화 실행
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  loadGame();
  const environmentCanvas = document.getElementById('arena-environment-canvas');
  const arena = document.getElementById('combat-arena');
  if (environmentCanvas) {
    arenaEnvironment = createArenaEnvironment(environmentCanvas, arena);
  }
  checkAndTriggerUnfolds(true);
  updateFlameEvolutionUI(true);
  updateDevCheatUI();
  updateSoundUI();
  updateSkillActionBarVisibility();
  resizeCanvas();
  initEvents();
  updateBgmPlayback();
  loadStage(state.currentStage);
  renderShopUI();
  renderInfusionUI();
  renderSkillTreeUI();
  renderArtifactsUI();
  renderKeystoneUI();
  updatePityCritBadgeUI();
  updateSkillAutoUI();
  renderHeatUI();
  updateNotificationBadges();
  requestAnimationFrame(gameLoop);
});
