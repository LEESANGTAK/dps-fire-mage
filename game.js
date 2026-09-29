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
  { stage: 1, name: '초원 풀숲 슬라임', emoji: '🟢', hp: 120, timeLimit: 25, gold: 4, firstBonus: 2 },
  { stage: 2, name: '푸른 늪지 슬라임', emoji: '🔵', hp: 230, timeLimit: 25, gold: 7, firstBonus: 4 },
  { stage: 3, name: '들판 거대 들쥐', emoji: '🐀', hp: 420, timeLimit: 25, gold: 12, firstBonus: 8 },
  { stage: 4, name: '고블린 정찰병', emoji: '👺', hp: 750, timeLimit: 25, gold: 20, firstBonus: 14 },
  { stage: 5, name: '붉은송곳니 군주', emoji: '🐗', hp: 1400, timeLimit: 28, gold: 35, firstBonus: 35 },

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

  if (stageNum <= STAGE_MONSTERS.length) {
    return {
      ...STAGE_MONSTERS[stageNum - 1],
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
    hp: Math.round(base.hp * mult),
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
    icon: '🔥',
    desc: (lv) =>
      `불의 정령 상시 소환 (1.3초마다 공격력의 ${lv === 0 ? 45 : lv * 45}% 화염탄 발사 및 화상 연장)`
  },
  {
    id: 'phoenix',
    tier: 1,
    row: 1,
    col: 3,
    reqTotalSp: 0,
    cost: 1,
    maxLv: 3,
    name: '비전 불사조 소환',
    shortName: '비전 불사조',
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
      `화염구·거대 화염구 시전 시 탄환이 ${lv === 0 ? 2 : lv + 1}발로 갈라져 직선 발사`
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
      `거대 화염구 발사 시 모든 소환수 즉시 일제 공격 & 소환수 피해 +${lv === 0 ? 50 : lv * 50}%`
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
    id: 'pyroblast',
    name: '마법서: 거대 화염구 [3]',
    icon: '🌋',
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
    desc: '8초간 모든 마법 100% 치명타 & 시전 속도 증가'
  },
  {
    id: 'meteor',
    name: '금서: 메테오 [5]',
    icon: '☄️',
    cost: 6500,
    desc: '하늘에서 거대 운석 소환 폭발 및 6초 대지 연소'
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
    desc: '치명타 확률 +1.5% · 공격력 +2',
    effect: (lv) => ({ crit: lv * 1.5, sp: lv * 2 })
  },
  {
    id: 'swift_gloves',
    name: '가죽 시전 장갑',
    icon: '🧤',
    slot: 'gloves',
    baseCost: 60,
    costScale: 1.4,
    desc: '시전 속도 +3% · 공격력 +4',
    effect: (lv) => ({ haste: lv * 3, sp: lv * 4 })
  },
  {
    id: 'flame_orb',
    name: '붉은 화염 수정구',
    icon: '🔮',
    slot: 'orb',
    baseCost: 160,
    costScale: 1.42,
    desc: '치명타 피해 +8% · 공격력 +9',
    effect: (lv) => ({ critDmg: lv * 0.08, sp: lv * 9 })
  },
  {
    id: 'sunfire_staff',
    name: '화염술사의 룬 지팡이',
    icon: '🔱',
    slot: 'weapon',
    baseCost: 450,
    costScale: 1.45,
    desc: '공격력 +22 · 치명타 확률 +1.5%',
    effect: (lv) => ({ sp: lv * 22, crit: lv * 1.5 })
  },
  {
    id: 'chrono_watch',
    name: '마력 회중시계',
    icon: '⏳',
    slot: 'trinket',
    baseCost: 1250,
    costScale: 1.48,
    desc: '쿨타임 감소 +3% · 시전 속도 +3% · 공격력 +55',
    effect: (lv) => ({ cdr: lv * 0.03, haste: lv * 3, sp: lv * 55 })
  },
  {
    id: 'firelord_crown',
    name: '화염군주의 보관',
    icon: '👑',
    slot: 'helm',
    baseCost: 3600,
    costScale: 1.5,
    desc: '공격력 +140 · 치명타 피해 +12%',
    effect: (lv) => ({ sp: lv * 140, critDmg: lv * 0.12 })
  },
  {
    id: 'arcane_grail',
    name: '고대 불꽃의 성배',
    icon: '🏆',
    slot: 'relic',
    baseCost: 11000,
    costScale: 1.55,
    desc: '공격력 +380 · 모든 마법 피해 +6%',
    effect: (lv) => ({ sp: lv * 380, bonusPct: lv * 0.06 })
  }
];

// ==========================================
// 3-B. 3단계: 제2 자원 '불꽃의 정수' & 고대 마법 부여(Infusion) 데이터
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
    desc: (lv) => `화상(도트) 피해량 +${lv * 25}% · 치명타 시 ${lv * 3}% 확률로 🔥정수 +1 추출`
  }
];

// ==========================================
// 4. 게임 상태 (State)
// ==========================================
const state = {
  gold: 0,
  pendingCoinGold: 0,
  essence: 0,
  currentStage: 1,
  highestClearedStage: 0,
  dpsClearedStage: 0,
  maxDps: 0,
  playTimeSec: 0,
  totalKills: 0,
  campaignCleared: false,
  autoCast: false,
  soundOn: true,
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
    hallOfFame: false
  },

  bonusSkillPoints: 0,
  skillTree: {
    fire_elem: 0,
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
    pyroblast: false,
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

  monster: {
    hp: 120,
    maxHp: 120
  },

  combat: {
    gcdRemaining: 0,
    gcdTotal: 1.3,
    castingSkill: null,
    castRemaining: 0,
    castTotal: 0,

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

    ignitePool: 0,
    igniteRem: 0,
    igniteTickTimer: 0,
    meteorBurnRem: 0,
    meteorBurnTickTimer: 0,

    elemTimer: 0,
    elemRecoil: 0,
    phoenixTimer: 0,
    phoenixRecoil: 0,
    golemTimer: 0,
    golemLunge: 0,
    animTime: 0,

    wasOnCd: { 2: false, 4: false, 5: false }
  },

  dpsHistory: [],
  skillDamage: {
    fireball: { name: '🔥 화염구', dmg: 0, color: '#f97316' },
    fireblast: { name: '💥 불꽃 작렬', dmg: 0, color: '#fbbf24' },
    pyroblast: { name: '🌋 거대 화염구', dmg: 0, color: '#ef4444' },
    ignite: { name: '🩸 화상 (도트)', dmg: 0, color: '#ff8000' },
    meteor: { name: '☄️ 메테오', dmg: 0, color: '#a855f7' },
    summon_elem: { name: '🔥 불의 정령', dmg: 0, color: '#fb7185' },
    summon_phoenix: { name: '🦅 비전 불사조', dmg: 0, color: '#facc15' },
    summon_golem: { name: '🗿 용암 골렘', dmg: 0, color: '#c084fc' }
  }
};

// ==========================================
// 5. 스킬 포인트, 스탯 & 요구 DPS 달성 판정
// ==========================================
function getEarnedPhaseBossSp() {
  return Math.floor(state.highestClearedStage / 5);
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
  const total = getEarnedPhaseBossSp() + (state.bonusSkillPoints || 0);
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

  const summonMult = 1 + (state.skillTree.legion_sync || 0) * 0.5;
  const infusionSpMult = (1 + azureLv * 0.15) * (1 + totalInfLv * 0.02) * abyssSpMult;
  const goldMult = 1 + alchemyLv * 0.22;
  const essenceMult = (1 + alchemyLv * 0.08) * abyssEssenceMult;
  const igniteMult = 1 + ignitionLv * 0.25;
  const siphonChance = ignitionLv * 0.03;

  return {
    sp: Math.round(sp * (1 + bonusPct) * infusionSpMult),
    crit,
    haste,
    critDmg,
    cdr,
    speedMult: 1 + haste / 100,
    summonMult,
    goldMult,
    essenceMult,
    igniteMult,
    siphonChance
  };
}

function getStageReqDps(stageNum) {
  const data = getStageData(stageNum);
  return Math.ceil(data.hp / data.timeLimit);
}

/**
 * 요구 DPS 충족이 한번 이상 되면 다음 도전 버튼이 활성화된 상태를 영구 유지!
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

function canAdvanceToNextStage() {
  const reqDps = getStageReqDps(state.currentStage);
  return (
    state.dpsClearedStage >= state.currentStage ||
    state.maxDps >= reqDps ||
    state.currentDps >= reqDps
  );
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
// 6. 사운드 매니저 (화염구 발사/폭발/크리티컬 폭발/아이템 선택/골드 도착/도트 화상 효과음)
// ==========================================
const FIREBALL_SFX_FILES = {
  fly: 'assets/sounds/sfx/fireball_fly.wav',
  explosion: 'assets/sounds/sfx/fireball_explosion.wav',
  explosion_crit: 'assets/sounds/sfx/fireball_explosion_critical.wav',
  item_select: 'assets/sounds/sfx/item_select.wav',
  drop_coin: 'assets/sounds/sfx/drop_coin.mp3'
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
  const isDotBurning = state.soundOn && ((c.igniteRem > 0 && c.ignitePool >= 5) || c.meteorBurnRem > 0);
  try {
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
  const isCasting = state.soundOn && Boolean(c.castingSkill) && c.castRemaining > 0;
  try {
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

function playFireballSfx(kind, volume = 0.65) {
  if (!state.soundOn) return;
  try {
    const base = preloadedSfx[kind];
    if (!base) return;
    const snd = base.cloneNode();
    snd.volume = volume;
    snd.play().catch(() => {});
  } catch (e) {}
}

let audioCtx = null;
function playSound(type) {
  if (!state.soundOn) return;
  if (type === 'launch') {
    playFireballSfx('fly', 0.65);
    return;
  }
  if (type === 'hit') {
    playFireballSfx('explosion', 0.58);
    return;
  }
  if (type === 'crit') {
    playFireballSfx('explosion_crit', 0.85);
    return;
  }
  if (type === 'item_select') {
    playFireballSfx('item_select', 0.78);
    return;
  }
  if (type === 'drop_coin' || type === 'coin_tick') {
    playFireballSfx('drop_coin', 0.78);
    return;
  }
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;

    if (type === 'proc') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'meteor_impact') {
      playFireballSfx('explosion_crit', 0.92);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.38);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    }
  } catch (e) {}
}

// ==========================================
// 7. 2D 캔버스 투사체(직선 비행), 메테오 & 소환수 렌더링 엔진
// ==========================================
const canvas = document.getElementById('vfx-canvas');
const ctx = canvas.getContext('2d');
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

function getCasterPos() {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const caster = document.getElementById('caster-avatar').getBoundingClientRect();
  return {
    x: caster.left - arena.left + caster.width * 0.85,
    y: caster.top - arena.top + caster.height * 0.5
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
      ? `다음 진화(${nextTierObj.name}): 공격력 ${fmt(nextTierObj.reqSp)} 또는 총 장비 +${nextTierObj.reqEquipLv}강`
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
  const start = getCasterPos();
  const end = getTargetPos();
  const isPyro = type === 'pyroblast';
  const evo = getCurrentFlameEvolution();

  const avatar = document.getElementById('caster-avatar');
  avatar.classList.add('cast-recoil');
  setTimeout(() => avatar.classList.remove('cast-recoil'), 120);

  if (scaleMult >= 0.9) {
    playFireballSfx('fly', isPyro ? 0.78 : 0.62);
  }

  const baseRadius = isPyro ? 17 : 10;
  launchCustomProjectile({
    type,
    startX: start.x,
    startY: start.y + offsetY,
    targetX: end.x,
    targetY: end.y + offsetY,
    duration: isPyro ? 0.31 : 0.25,
    radius: baseRadius * evo.scale * scaleMult,
    colorCore: evo.colorCore,
    colorMid: evo.colorMid,
    colorEdge: evo.colorEdge,
    ringRgb: evo.ringRgb,
    evoTier: evo.tier,
    orbiters: scaleMult >= 0.9 ? evo.orbiters : 0,
    onHit: onHitCallback
  });
}

function launchMeteorVfx(onImpactCallback, scale = 1.0) {
  const target = getTargetPos();
  const offsetX = scale < 1 ? Math.random() * 40 - 20 : 0;
  const offsetY = scale < 1 ? Math.random() * 24 - 12 : 10;

  groundEffects.push({
    x: target.x + offsetX,
    y: target.y + 32 + offsetY,
    radius: 62 * scale,
    life: 0,
    maxLife: 0.9 * scale
  });

  meteors.push({
    startX: target.x - 210 * scale + offsetX,
    startY: -50,
    targetX: target.x + offsetX,
    targetY: target.y + offsetY,
    progress: 0,
    duration: 0.8 * scale,
    radius: 34 * scale,
    scale,
    onImpact: onImpactCallback
  });
}

function drawSummonsAndAuras(dt) {
  const c = state.combat;
  c.animTime += dt;
  const casterCenter = getCasterCenter();
  const targetCenter = getTargetPos();

  // 1. 고대 가속 마법진
  const runeLv = state.skillTree.rune_aura || 0;
  if (runeLv > 0) {
    ctx.save();
    ctx.translate(casterCenter.x, casterCenter.y + 42);
    ctx.scale(1, 0.42);
    ctx.rotate(c.animTime * 1.4);

    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // 2. 불의 정령
  const elemLv = state.skillTree.fire_elem || 0;
  if (elemLv > 0) {
    if (c.elemRecoil > 0) c.elemRecoil = Math.max(0, c.elemRecoil - dt * 5);
    const bobY = Math.sin(c.animTime * 3.5) * 6;
    const ex = casterCenter.x + 58 + c.elemRecoil * 8;
    const ey = casterCenter.y - 68 + bobY;

    const grad = ctx.createRadialGradient(ex, ey, 4, ex, ey, 28);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.45, '#f97316');
    grad.addColorStop(0.8, 'rgba(239, 68, 68, 0.35)');
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ex, ey, 28, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < elemLv + 1; i++) {
      const ang = c.animTime * 4 + (i * Math.PI * 2) / (elemLv + 1);
      const ox = ex + Math.cos(ang) * 22;
      const oy = ey + Math.sin(ang) * 12;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔥', ex, ey);

    ctx.font = 'bold 10px Pretendard, sans-serif';
    ctx.fillStyle = '#fed7aa';
    ctx.fillText(`불의 정령 Lv.${elemLv}`, ex, ey + 24);
  }

  // 3. 비전 불사조
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
    ctx.fillText('🦅', px, py);

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
    ctx.fillText('🗿', gx, gy);

    ctx.font = 'bold 10px Pretendard, sans-serif';
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(`용암 골렘 Lv.${golemLv}`, gx, gy + 26);
  }

  // 5. 충격파 (진화 단계별 컬러 지원)
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
    ctx.save();
    ctx.translate(sw.x, sw.y);
    ctx.scale(1, sw.flat ? 0.45 : 0.85);
    ctx.beginPath();
    ctx.arc(0, 0, sw.maxRadius * prog, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
    ctx.lineWidth = sw.lineWidth || 4;
    ctx.stroke();
    ctx.restore();
  }
}

function updateAndDrawVfx(dt) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSummonsAndAuras(dt);

  for (let i = groundEffects.length - 1; i >= 0; i--) {
    const g = groundEffects[i];
    g.life += dt;
    if (g.life >= g.maxLife) {
      groundEffects.splice(i, 1);
      continue;
    }
    const alpha = 1 - g.life / g.maxLife;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251, 191, 36, ${alpha * 0.85})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.25})`;
    ctx.fill();
    ctx.restore();
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.progress += dt / p.duration;
    if (p.progress >= 1) {
      const isPyro = p.type === 'pyroblast';
      const tierScale = 1 + (p.evoTier - 1) * 0.18;
      spawnParticles(
        p.targetX,
        p.targetY,
        Math.round((isPyro ? 26 : 14) * tierScale),
        p.colorCore,
        p.colorMid,
        (isPyro ? 1.35 : 0.9) * tierScale
      );
      if (p.evoTier >= 2 || isPyro) {
        shockwaves.push({
          x: p.targetX,
          y: p.targetY,
          life: 0,
          maxLife: 0.28 + p.evoTier * 0.03,
          maxRadius: (isPyro ? 52 : 34) + p.evoTier * 8,
          rgb: p.ringRgb,
          flat: false,
          lineWidth: p.evoTier >= 4 ? 4.5 : 3
        });
      }
      triggerArenaShake(isPyro || p.evoTier >= 4 ? 'sm' : null);
      if (p.onHit) p.onHit();
      projectiles.splice(i, 1);
      continue;
    }

    // 곡선 없이 완전한 직선(Linear) 보간으로 비행
    const t = p.progress;
    const x = p.startX + (p.targetX - p.startX) * t;
    const y = p.startY + (p.targetY - p.startY) * t;

    const trailCount = p.evoTier >= 4 ? 2 : 1;
    for (let tr = 0; tr < trailCount; tr++) {
      if (Math.random() < 0.85) {
        particles.push({
          x: x + (Math.random() * 6 - 3),
          y: y + (Math.random() * 6 - 3),
          vx: -55 + Math.random() * 20,
          vy: -14 + Math.random() * 28,
          radius: p.radius * (0.38 + p.evoTier * 0.04),
          life: 0,
          maxLife: 0.14 + p.evoTier * 0.02,
          colorCore: p.colorCore,
          colorEdge: p.colorMid
        });
      }
    }

    // 메인 진화 화염구 본체 그라데이션
    const grad = ctx.createRadialGradient(x, y, 2, x, y, p.radius * 1.6);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, p.colorCore);
    grad.addColorStop(0.72, p.colorMid);
    grad.addColorStop(1, p.colorEdge);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, p.radius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Tier 5 (태양신화): 회전하는 태양 코로나 십자 광선 연출
    if (p.evoTier >= 5) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(state.combat.animTime * 9 + t * 6);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2.2;
      const rayLen = p.radius * 1.85;
      ctx.beginPath();
      ctx.moveTo(-rayLen, 0);
      ctx.lineTo(rayLen, 0);
      ctx.moveTo(0, -rayLen);
      ctx.lineTo(0, rayLen);
      ctx.stroke();
      ctx.restore();
    }

    // Tier 2~5: 화염구 주변을 나선형으로 회전하며 따라가는 마력 위성(Orbiters)
    if (p.orbiters > 0) {
      for (let ob = 0; ob < p.orbiters; ob++) {
        const ang = state.combat.animTime * 14 + t * 10 + (ob * Math.PI * 2) / p.orbiters;
        const dist = p.radius * 1.05;
        const ox = x + Math.cos(ang) * dist * 0.65;
        const oy = y + Math.sin(ang) * dist;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox, oy, 2.8 + p.evoTier * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.progress += dt / m.duration;
    if (m.progress >= 1) {
      spawnParticles(m.targetX, m.targetY, Math.round(40 * m.scale), '#fef08a', '#dc2626', 1.7 * m.scale);
      triggerArenaShake(m.scale >= 0.9 ? 'lg' : 'sm');
      playSound('meteor_impact');
      if (m.onImpact) m.onImpact();
      meteors.splice(i, 1);
      continue;
    }

    const t = m.progress * m.progress;
    const x = m.startX + (m.targetX - m.startX) * t;
    const y = m.startY + (m.targetY - m.startY) * t;

    particles.push({
      x: x + (Math.random() * 12 - 6),
      y: y + (Math.random() * 12 - 6),
      vx: -35,
      vy: -35,
      radius: (8 + Math.random() * 5) * m.scale,
      life: 0,
      maxLife: 0.22,
      colorCore: '#fde047',
      colorEdge: '#dc2626'
    });

    const grad = ctx.createRadialGradient(x, y, 3, x, y, m.radius);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.3, '#fde047');
    grad.addColorStop(0.65, '#ea580c');
    grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, m.radius, 0, Math.PI * 2);
    ctx.fill();
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
    const alpha = 1 - pt.life / pt.maxLife;
    ctx.fillStyle = pt.life < pt.maxLife * 0.4 ? pt.colorCore : pt.colorEdge;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.radius * alpha, 0, Math.PI * 2);
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
    // 크리티컬 데미지: 물리 낙하(중력) 없이 타격 지점에 강렬하게 꽂힌 뒤 위로 쭉 올라감!
    if (Math.random() < 0.84) {
      fctArcState.lastSide *= -1;
    }
    const side = fctArcState.lastSide;
    x = pos.x + side * (6 + Math.random() * 20);
    y = pos.y - 32 + offsetY + (Math.random() * 14 - 7);
    vx = 0;
    vy = isBig ? -78 : -70;
    gravity = 0;
    maxLife = isBig ? 1.18 : 1.08;
    // 스케일 펀치가 강하게 꽂히는 동안 위치 이동을 억제해 묵직한 타격감 부여
    holdTime = 0.2;
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
// 8-B. 캔디크러시 스타일 골드 동전 곡선 비행 흡수 연출 (#target-reward ➔ #pill-gold)
// ==========================================
const flyingCoins = [];
let goldPulseTimeout = null;

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

function spawnGoldCoinFlight(totalGold, isBigReward = false) {
  const layer = document.getElementById('coin-fx-layer');
  const rewardEl = document.getElementById('target-reward');
  const goldPillEl = document.getElementById('pill-gold') || document.getElementById('ui-gold');

  if (!layer || !rewardEl || !goldPillEl) {
    state.pendingCoinGold = 0;
    return;
  }

  // 출발지(#target-reward) 배지 팝 애니메이션
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
      goldShare: share,
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
      state.pendingCoinGold = Math.max(0, (state.pendingCoinGold || 0) - c.goldShare);
      if (flyingCoins.length === 0) {
        state.pendingCoinGold = 0;
      }
      triggerGoldPillPulse();
      playSound('drop_coin');
      continue;
    }

    // 초반(0~22%)엔 톡 튀어나오며 완만하게 곡선을 시작하고, 후반부로 갈수록 가속하며 흡수되는 이징 곡선
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

    // 팝아웃 스케일 펀치 후 골드 알약으로 빨려 들어갈 때 자연스럽게 축소
    let scale = 1.0;
    if (rawT < 0.16) {
      const p = rawT / 0.16;
      scale = 0.28 + (1.24 - 0.28) * (1 - Math.pow(1 - p, 2));
    } else if (rawT < 0.3) {
      const p = (rawT - 0.16) / 0.14;
      scale = 1.24 - 0.24 * p;
    } else if (rawT > 0.78) {
      const p = (rawT - 0.78) / 0.22;
      scale = 1.0 - 0.32 * p;
    }

    const rotDeg = rawT * 360;
    c.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${rotDeg.toFixed(0)}deg)`;
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

    // 크리티컬 임팩트 홀드 구간에서는 '팍!' 하고 제자리에 박히는 느낌을 위해 이동을 거의 멈췄다가 위로 부유
    const motionScale = f.life < f.holdTime ? (f.type === 'crit' ? 0.08 : 0.22) : 1.0;
    const effDt = dt * motionScale;

    f.x += f.vx * effDt;
    f.y += f.vy * effDt;
    f.vy += f.gravity * effDt;
    // 수평 공기 저항으로 자연스러운 포물선 곡률 형성
    f.vx *= Math.pow(0.92, effDt * 60 * 0.016);

    applyFloatingTextTransform(f);
  }

  updateFlyingCoins(dt);
}

// ==========================================
// 9. 스테이지 설정 및 몬스터 처치 처리 (제한시간 제거)
// ==========================================
function loadStage(stageNum) {
  state.currentStage = Math.max(1, stageNum);
  const data = getStageData(state.currentStage);
  state.monster.maxHp = data.hp;
  state.monster.hp = data.hp;

  state.combat.ignitePool = 0;
  state.combat.igniteRem = 0;
  state.combat.meteorBurnRem = 0;
  updateBurningLoopSound();

  checkAndRecordDpsClear();
  updateStageUI();
}

function switchRightTab(tabName) {
  document.getElementById('tab-btn-shop').classList.toggle('active', tabName === 'shop');
  const infBtn = document.getElementById('tab-btn-infusion');
  if (infBtn) infBtn.classList.toggle('active', tabName === 'infusion');
  document.getElementById('tab-btn-tree').classList.toggle('active', tabName === 'tree');

  document.getElementById('pane-shop').classList.toggle('active', tabName === 'shop');
  const infPane = document.getElementById('pane-infusion');
  if (infPane) infPane.classList.toggle('active', tabName === 'infusion');
  document.getElementById('pane-tree').classList.toggle('active', tabName === 'tree');
  updateNotificationBadges();
}

function getFirstClearEssenceBonus(stageNum) {
  if (stageNum < 2) return 0;
  const data = getStageData(stageNum);
  const stats = getPlayerStats();
  const base = data.isPhaseBoss
    ? Math.max(8, stageNum * 2)
    : Math.max(2, Math.floor(stageNum * 0.85));
  return Math.max(1, Math.round(base * (stats.essenceMult || 1)));
}

function onMonsterKilled() {
  const data = getStageData(state.currentStage);
  const stats = getPlayerStats();
  const isFirstClear = state.currentStage > state.highestClearedStage;
  const isFirstRagnarosKill = state.currentStage === 20 && !state.campaignCleared;
  let totalGold = Math.max(1, Math.round(data.gold * (stats.goldMult || 1)));
  let gainedEssence = 0;

  state.totalKills = (state.totalKills || 0) + 1;

  if (isFirstClear) {
    state.highestClearedStage = state.currentStage;
    totalGold += Math.round(data.firstBonus * (stats.goldMult || 1));
    gainedEssence = getFirstClearEssenceBonus(state.currentStage);

    if (data.isPhaseBoss) {
      spawnFloatingText(`👑 보스 격파! 🌟 +1 SP!`, 'fct-proc', -60);
      playSound('proc');
      if (data.phase === 1) {
        switchRightTab('tree');
      }
    }
  } else {
    // Stage 2 이상 반복 처치 시: 보스는 100% 확정 드롭, 일반 몬스터는 38% 확률로 불꽃의 정수 드롭
    if (state.currentStage >= 2) {
      const dropChance = data.isPhaseBoss ? 1.0 : 0.38;
      if (Math.random() < dropChance) {
        const baseDrop = data.isPhaseBoss
          ? Math.max(2, Math.floor(state.currentStage * 0.5))
          : Math.max(1, Math.floor(state.currentStage * 0.28));
        gainedEssence = Math.max(1, Math.round(baseDrop * (stats.essenceMult || 1)));
      }
    }
  }

  state.gold += totalGold;
  // 몬스터에서 골드 텍스트를 띄우는 대신, 상단 배너(#target-reward)에서 최상단 골드(#pill-gold)로 동전이 하나씩 곡선 비행 흡수!
  spawnGoldCoinFlight(totalGold, isFirstClear || data.isPhaseBoss);

  if (gainedEssence > 0) {
    state.essence = (state.essence || 0) + gainedEssence;
    spawnFloatingText(`🔥 +${fmt(gainedEssence)} 정수`, 'fct-essence', -54);
  }

  const pos = getTargetPos();
  spawnParticles(pos.x, pos.y, 24, '#fde047', '#22c55e', 1.2);

  if (isFirstRagnarosKill || state.highestClearedStage >= 20) {
    state.campaignCleared = true;
    state.unfolded.hallOfFame = true;
  }

  checkAndTriggerUnfolds(false);
  updateDpsMeterUI();

  if (isFirstRagnarosKill) {
    openVictoryModal(true);
  }
  loadStage(state.currentStage);

  saveGame();
  renderShopUI();
  renderInfusionUI();
  renderSkillTreeUI();
  updateNotificationBadges();
}

// ==========================================
// 10. 데미지 적용 & 연쇄 치명타 / 유성우 판정
// ==========================================
function dealDamage(skillKey, rawDamage, isCrit, canTriggerStreak = true, isDotTick = false) {
  if (state.cheats && state.cheats.alwaysCrit) {
    if (!isCrit) {
      rawDamage *= getPlayerStats().critDmg;
      isCrit = true;
    }
  }
  const dmg = Math.max(1, Math.round(rawDamage));
  const now = performance.now() / 1000;

  state.lastCombatTime = now;
  state.dpsHistory.push({ time: now, amount: dmg });
  if (state.skillDamage[skillKey]) {
    state.skillDamage[skillKey].dmg += dmg;
  }

  // 타격 즉시 DPS 달성 여부를 체크해 요구 DPS 충족 시 다음 도전 버튼을 즉시 영구 활성화
  const windowSec = 6.0;
  const sumDmg = state.dpsHistory
    .filter((entry) => now - entry.time <= windowSec)
    .reduce((acc, e) => acc + e.amount, 0);
  state.currentDps = Math.round(sumDmg / windowSec);
  checkAndRecordDpsClear();

  if (!isDotTick) {
    const dummyEl = document.getElementById('dummy-avatar');
    dummyEl.classList.remove('hit', 'crit-hit');
    void dummyEl.offsetWidth;
    dummyEl.classList.add(isCrit ? 'crit-hit' : 'hit');
  }

  const isBigSkill = skillKey === 'pyroblast' || skillKey === 'meteor';
  if ((isDotTick || skillKey === 'ignite') && !(state.cheats && state.cheats.alwaysCrit)) {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-dot', 5);
  } else if (isCrit) {
    spawnFloatingText(`${fmt(dmg)}!`, 'fct-crit', -8, { isBig: isBigSkill });
    if (!isDotTick) playSound('crit');
  } else {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-normal', 0);
    playSound('hit');
  }

  if (isCrit && !isDotTick && skillKey !== 'ignite') {
    const st = getPlayerStats();
    const golemBonus = (state.skillTree.magma_golem || 0) * 0.15;
    const igniteRatio = (state.grimoires.ignite ? 0.48 : 0.22) * (1 + golemBonus) * (st.igniteMult || 1);
    const igniteAdd = dmg * igniteRatio;
    const remainingCarry = state.combat.igniteRem > 0 ? state.combat.ignitePool * (state.combat.igniteRem / 5.0) : 0;
    state.combat.ignitePool = remainingCarry + igniteAdd;
    state.combat.igniteRem = 5.0;

    // 태고의 발화 핵 마법 부여: 치명타 시 일정 확률로 즉시 불꽃의 정수 +1 추출
    if (st.siphonChance > 0 && Math.random() < st.siphonChance) {
      state.essence = (state.essence || 0) + 1;
      spawnFloatingText('🔥 +1 정수 추출!', 'fct-essence', -36);
      renderInfusionUI();
    }

    const rainLv = state.skillTree.meteor_rain || 0;
    if (rainLv > 0 && skillKey !== 'meteor' && Math.random() < rainLv * 0.14) {
      launchMeteorVfx(() => {
        const curSt = getPlayerStats();
        dealDamage('meteor', curSt.sp * 1.45 * curSt.critDmg, true, false);
      }, 0.65);
    }
  }

  if (canTriggerStreak && state.grimoires.pyroblast) {
    if (isCrit) {
      if (state.combat.critStreak === 0) {
        state.combat.critStreak = 1;
        state.combat.streakTimer = 8.0;
      } else if (state.combat.critStreak === 1) {
        state.combat.critStreak = 2;
        state.combat.streakTimer = 12.0;
        spawnFloatingText('🔥 연쇄 폭발!', 'fct-proc', -48);
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
  if (state.monster.hp <= 0) {
    onMonsterKilled();
  }
}

// ==========================================
// 11. 소환수 공격 로직
// ==========================================
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
          const isCrit = Math.random() * 100 < st.crit;
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
    return true;
  }

  if (skillKey === 'pyroblast') {
    if (!state.grimoires.pyroblast) return false;

    if (c.critStreak === 2) {
      c.critStreak = 0;
      c.streakTimer = 0;
      fireWithMultishot('pyroblast', 1.75);
      triggerAllSummonsSyncAttack();
      return true;
    }

    if (c.castingSkill || c.gcdRemaining > 0) return false;
    const castTime = Math.max(0.7, 2.5 / stats.speedMult);
    c.castingSkill = 'pyroblast';
    c.castTotal = castTime;
    c.castRemaining = castTime;
    c.gcdTotal = Math.max(0.5, 1.2 / stats.speedMult);
    c.gcdRemaining = c.gcdTotal;
    updateCastingLoopSound();
    return true;
  }

  if (skillKey === 'combustion') {
    if (!state.grimoires.combustion) return false;
    if (c.combustionCdRem > 0) return false;

    c.combustionRem = 8.0;
    c.combustionCdTotal = Math.max(14, 30 * (1 - stats.cdr));
    c.combustionCdRem = c.combustionCdTotal;
    spawnFloatingText('☀️ 마력 폭주!', 'fct-proc', -45, { anchor: 'caster' });
    playSound('proc');
    return true;
  }

  if (skillKey === 'meteor') {
    if (!state.grimoires.meteor) return false;
    if (c.meteorCdRem > 0) return false;

    c.meteorCdTotal = Math.max(8, 18 * (1 - stats.cdr));
    c.meteorCdRem = c.meteorCdTotal;

    launchMeteorVfx(() => {
      const st = getPlayerStats();
      const isCrit = Math.random() * 100 < st.crit;
      const base = st.sp * 3.2;
      const finalDmg = isCrit ? base * st.critDmg : base;
      dealDamage('meteor', finalDmg, isCrit, true);
      state.combat.meteorBurnRem = 6.0;
    }, 1.0);
    return true;
  }

  return false;
}

function finishCast(skillKey) {
  if (skillKey === 'fireball') {
    fireWithMultishot('fireball', 1.0);
  } else if (skillKey === 'pyroblast') {
    fireWithMultishot('pyroblast', 1.55);
    triggerAllSummonsSyncAttack();
  }
}

function runSmartAutoCast() {
  if (!state.grimoires.autocast || !state.autoCast) return;
  const c = state.combat;

  if (state.grimoires.combustion && c.combustionCdRem <= 0) {
    triggerSkill('combustion');
  }
  if (state.grimoires.meteor && c.meteorCdRem <= 0) {
    triggerSkill('meteor');
  }
  // 연쇄 폭발(즉시 시전 거대 화염구)이 발동했을 때, 현재 시전/GCD가 끝나고 테두리 빛 효과가 잠시(0.55초) 보여진 뒤 발사!
  if (state.grimoires.pyroblast && c.critStreak === 2 && !c.castingSkill && c.gcdRemaining <= 0 && c.streakTimer <= 11.45) {
    triggerSkill('pyroblast');
  }
  if (state.grimoires.fireblast && c.fbCharges > 0) {
    if (!state.grimoires.pyroblast || c.critStreak === 1 || c.fbCharges >= c.fbMaxCharges) {
      triggerSkill('fireblast');
    }
  }
  if (!c.castingSkill && c.gcdRemaining <= 0 && !(state.grimoires.pyroblast && c.critStreak === 2)) {
    triggerSkill('fireball');
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

  // 1. 다음 스테이지 도전 버튼 (!) 배지 & 활성화 제어 (요구 DPS 1회 이상 충족 시 활성화 유지!)
  const canGoNext = canAdvanceToNextStage();
  const nextBtn = document.getElementById('btn-next-stage');
  const nextBtnText = document.getElementById('btn-next-stage-text');
  const nextStageData = getStageData(state.currentStage + 1);

  nextBtn.disabled = !canGoNext;
  nextBtn.classList.toggle('ready-glow', canGoNext);
  nextBtnText.textContent = nextStageData.isPhaseBoss
    ? '👑 보스 도전 ▶'
    : '다음 도전 ▶';

  setBadge('badge-next-stage', canGoNext);

  // 2. 자동 시전 버튼 (!) 배지: 해금되었는데 꺼져 있을 때 표시
  setBadge('badge-auto-cast', state.grimoires.autocast && !state.autoCast);

  // 3. 스킬 액션바 1~5번 (!) 배지: 수동 조작 중이거나 즉시 발사 프록이 떴을 때
  const manualMode = !state.grimoires.autocast || !state.autoCast;
  setBadge('badge-skill-1', manualMode && !c.castingSkill && c.gcdRemaining <= 0 && state.dpsHistory.length === 0);
  setBadge(
    'badge-skill-2',
    state.grimoires.fireblast && c.fbCharges > 0 && (c.critStreak === 1 || (manualMode && c.fbCharges >= 2))
  );
  setBadge('badge-skill-3', state.grimoires.pyroblast && c.critStreak === 2);
  setBadge('badge-skill-4', manualMode && state.grimoires.combustion && c.combustionCdRem <= 0);
  setBadge('badge-skill-5', manualMode && state.grimoires.meteor && c.meteorCdRem <= 0);

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

  setBadge('badge-tab-shop', anyShopAffordable);

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

  // 2. 3x3 와우 특성 그리드 셀 생성
  const tierLabels = {
    1: '1단계 · 기본 소환',
    2: '2단계 · 1 SP 요구',
    3: '3단계 · 3 SP 궁극'
  };

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
        <div class="wow-tier-side-tag">
          <span>${tierLabels[r]}</span>
        </div>
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

  updateNotificationBadges();
}

function renderInfusionUI() {
  const ess = state.essence || 0;
  const totalLv = getTotalInfusionLevels();

  const tabBadge = document.getElementById('ui-tab-essence-badge');
  if (tabBadge) tabBadge.textContent = `${fmt(ess)} 🔥`;

  const headerBox = document.getElementById('ui-infusion-essence-box');
  if (headerBox) headerBox.textContent = `🔥 ${fmt(ess)} 정수`;

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
          <span>${isMax ? '✔ 마스터' : `주입 🔥 ${fmt(cost)}`}</span>
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

  // 1. 첫 몬스터 처치 또는 첫 골드(4G+) 획득 시: 마법 습득 상점 & 스테이지 네비게이션 개방
  if (!u.grimoireShop && (state.gold >= 4 || state.highestClearedStage >= 1 || state.grimoires.autocast)) {
    u.grimoireShop = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔓 새로운 시스템 해금: 마법 연구소!', '우측 [📜 마법 습득] 상점에서 새로운 마법서를 구매할 수 있습니다.');
      triggerUnfoldPop('grimoire-section');
    }
  }

  if (!u.stageNav && (state.highestClearedStage >= 1 || state.dpsClearedStage >= 1 || state.currentStage > 1)) {
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
        '우측 상단 [🔮 마법 부여] 탭에서 🔥 정수를 주입해 고대 유물 패시브를 각성하세요!'
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

  applyUnfoldedVisibility();
  if (changed && !silent) {
    saveGame();
  }
}

function applyUnfoldedVisibility() {
  const u = state.unfolded;

  // 상단 정수/치명타/시전속도 알약 & 명예의 전당 버튼
  const pillEssence = document.getElementById('pill-essence');
  const pillCrit = document.getElementById('pill-crit');
  const pillHaste = document.getElementById('pill-haste');
  const hallBtn = document.getElementById('btn-hall-of-fame');
  if (pillEssence) pillEssence.classList.toggle('unfold-hidden', !u.infusionShop);
  if (pillCrit) pillCrit.classList.toggle('unfold-hidden', !u.equipShop);
  if (pillHaste) pillHaste.classList.toggle('unfold-hidden', !u.equipShop);
  if (hallBtn) hallBtn.classList.toggle('unfold-hidden', !u.hallOfFame);

  // 우측 상단 [상점 / 마법 부여 / 스킬 트리] 탭 전환 바
  const modeTabs = document.getElementById('right-mode-tabs');
  const tabInfBtn = document.getElementById('tab-btn-infusion');
  const tabTreeBtn = document.getElementById('tab-btn-tree');
  if (modeTabs) modeTabs.classList.toggle('unfold-hidden', !u.infusionShop && !u.skillTree);
  if (tabInfBtn) tabInfBtn.classList.toggle('unfold-hidden', !u.infusionShop);
  if (tabTreeBtn) tabTreeBtn.classList.toggle('unfold-hidden', !u.skillTree);

  // 우측 상점 내부: 초기 봉인 안내 vs 마법 습득 vs 장비 강화
  const sealedCard = document.getElementById('unfold-sealed-shop');
  const grimoireSec = document.getElementById('grimoire-section');
  const itemSec = document.getElementById('item-section');
  if (sealedCard) sealedCard.classList.toggle('unfold-hidden', u.grimoireShop);
  if (grimoireSec) grimoireSec.classList.toggle('unfold-hidden', !u.grimoireShop);
  if (itemSec) itemSec.classList.toggle('unfold-hidden', !u.equipShop);

  // 전체 해금 완료 시 상단 테스트 버튼 숨김/비활성 표시
  const unfoldAllBtn = document.getElementById('btn-unfold-all');
  if (unfoldAllBtn) {
    const allDone = u.grimoireShop && u.equipShop && u.infusionShop && u.skillTree && u.hallOfFame;
    unfoldAllBtn.style.display = allDone ? 'none' : '';
  }
}

function updateSkillActionBarVisibility() {
  checkAndTriggerUnfolds(true);

  const btn2 = document.getElementById('skill-2');
  const icon2 = document.getElementById('icon-2');
  const charges2 = document.getElementById('charges-2');
  // 2번 스킬 슬롯도 자동 시전 마법진 해금(또는 불꽃 작렬 습득) 전에는 숨겨서 초반 [1] 화염구에 집중!
  if (state.grimoires.autocast || state.grimoires.fireblast || state.unfolded.equipShop) {
    btn2.classList.remove('hidden-slot');
  } else {
    btn2.classList.add('hidden-slot');
  }
  if (state.grimoires.fireblast) {
    btn2.classList.remove('locked-skill');
    icon2.textContent = '💥';
    charges2.style.display = 'block';
  } else {
    btn2.classList.add('locked-skill');
    icon2.textContent = '🔒';
    charges2.style.display = 'none';
  }

  const btn3 = document.getElementById('skill-3');
  const icon3 = document.getElementById('icon-3');
  if (state.grimoires.fireblast || state.grimoires.pyroblast) {
    btn3.classList.remove('hidden-slot');
  } else {
    btn3.classList.add('hidden-slot');
  }
  if (state.grimoires.pyroblast) {
    btn3.classList.remove('locked-skill');
    icon3.textContent = '🌋';
  } else {
    btn3.classList.add('locked-skill');
    icon3.textContent = '🔒';
  }

  const btn4 = document.getElementById('skill-4');
  const icon4 = document.getElementById('icon-4');
  if (state.grimoires.pyroblast || state.grimoires.combustion) {
    btn4.classList.remove('hidden-slot');
  } else {
    btn4.classList.add('hidden-slot');
  }
  if (state.grimoires.combustion) {
    btn4.classList.remove('locked-skill');
    icon4.textContent = '☀️';
  } else {
    btn4.classList.add('locked-skill');
    icon4.textContent = '🔒';
  }

  const btn5 = document.getElementById('skill-5');
  const icon5 = document.getElementById('icon-5');
  if (state.grimoires.combustion || state.grimoires.meteor) {
    btn5.classList.remove('hidden-slot');
  } else {
    btn5.classList.add('hidden-slot');
  }
  if (state.grimoires.meteor) {
    btn5.classList.remove('locked-skill');
    icon5.textContent = '☄️';
  } else {
    btn5.classList.add('locked-skill');
    icon5.textContent = '🔒';
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
    const isClearedDot = stg <= Math.max(state.highestClearedStage, state.dpsClearedStage);
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
  document.getElementById('dummy-emoji').textContent = data.emoji;
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
      rewardText += ` · 🔥 ${fmt(firstEss)}`;
    }
  }
  if (!isCleared && data.isPhaseBoss) {
    rewardText += ' · 🌟1 SP';
  }
  document.getElementById('target-reward').textContent = rewardText;

  document.getElementById('btn-prev-stage').disabled = state.currentStage <= 1;

  const reqDps = getStageReqDps(state.currentStage);
  const achieved = canAdvanceToNextStage();
  document.getElementById('ui-req-dps').textContent = achieved
    ? `${fmt(reqDps)} /초 ✔`
    : `${fmt(reqDps)} /초`;

  updateNotificationBadges();
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
  const jump20Btn = document.getElementById('btn-victory-jump-20');
  if (!modal || !grid) return;

  const stats = getPlayerStats();
  const evo = getCurrentFlameEvolution();
  const cleared20 = state.campaignCleared || state.highestClearedStage >= 20;

  if (isFirstVictory) {
    titleEl.textContent = '👑 화염군주 라그나로스 최초 토벌 완료!';
    subEl.textContent = '불타는 심연의 지배자를 물리치고 아제로스 최고의 대마법사 반열에 올랐습니다!';
  } else if (cleared20) {
    titleEl.textContent = '🏆 대마법사 명예의 전당 & 무한 심연 기록';
    subEl.textContent = 'Stage 20 라그나로스를 정복하고 끝없는 심연 균열(Stage 21+)을 탐사 중입니다.';
  } else {
    titleEl.textContent = '🏆 대마법사 원정 기록실 (목표: Stage 20)';
    subEl.textContent = 'Phase 4 최종 보스 [화염군주 라그나로스 (Stage 4-5)]를 토벌하면 무한 심연 축복이 개방됩니다!';
  }

  if (jump20Btn) {
    jump20Btn.style.display = state.currentStage === 20 ? 'none' : '';
  }

  grid.innerHTML = `
    <div class="victory-stat-item">
      <span class="victory-stat-label">최고 돌파 스테이지</span>
      <span class="victory-stat-val gold">STAGE ${state.highestClearedStage} ${cleared20 ? '👑' : ''}</span>
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
      <span class="victory-stat-val cyan">주입 ${getTotalInfusionLevels()} Lv · 특성 ${getSpentSkillPoints()} SP</span>
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
}

function closeVictoryModal() {
  const modal = document.getElementById('victory-modal');
  if (modal) modal.classList.add('hidden');
}

// ==========================================
// 16. 메인 게임 루프 (60 FPS, 제한 시간 제거)
// ==========================================
let lastTime = performance.now();
let uiRefreshAccum = 0;

function gameLoop(nowMs) {
  const dt = Math.min(0.1, (nowMs - lastTime) / 1000);
  lastTime = nowMs;

  state.playTimeSec = (state.playTimeSec || 0) + dt;

  const c = state.combat;
  const stats = getPlayerStats();

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

  if (state.skillTree.fire_elem > 0) {
    c.elemTimer += dt * stats.speedMult;
    if (c.elemTimer >= 1.3) {
      c.elemTimer -= 1.3;
      fireElementalAttack();
    }
  }

  if (state.skillTree.phoenix > 0) {
    c.phoenixTimer += dt * stats.speedMult;
    if (c.phoenixTimer >= 2.4) {
      c.phoenixTimer -= 2.4;
      firePhoenixAttack();
    }
  }

  if (state.skillTree.magma_golem > 0) {
    c.golemTimer += dt * stats.speedMult;
    if (c.golemTimer >= 2.8) {
      c.golemTimer -= 2.8;
      fireMagmaGolemAttack();
    }
  }

  if (state.grimoires.fireblast && c.fbCharges < c.fbMaxCharges) {
    c.fbRechargeRem -= dt;
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
    c.meteorCdRem = Math.max(0, c.meteorCdRem - dt);
    if (c.meteorCdRem === 0 && c.wasOnCd[5]) {
      triggerReadyFlash('skill-5');
      c.wasOnCd[5] = false;
    } else {
      c.wasOnCd[5] = true;
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

  updateCastingLoopSound();
  updateBurningLoopSound();
  runSmartAutoCast();
  updateAndDrawVfx(dt);
  updateLiveHUD();

  uiRefreshAccum += dt;
  if (uiRefreshAccum >= 0.25) {
    uiRefreshAccum = 0;
    updateDpsMeterUI();
  }

  requestAnimationFrame(gameLoop);
}

// ==========================================
// 17. 실시간 HUD & DPS 미터기 업데이트
// ==========================================
function updateLiveHUD() {
  const stats = getPlayerStats();
  const c = state.combat;

  // 골드 동전이 곡선 비행하여 #pill-gold에 하나씩 닿을 때마다 숫자가 차르륵 올라가도록 표시!
  const pendingGold = Math.min(state.gold, Math.max(0, state.pendingCoinGold || 0));
  const displayedGold = Math.max(0, Math.round(state.gold - pendingGold));
  document.getElementById('ui-gold').textContent = fmt(displayedGold);

  const essEl = document.getElementById('ui-essence');
  if (essEl) essEl.textContent = fmt(state.essence || 0);
  document.getElementById('ui-sp').textContent = fmt(stats.sp);
  document.getElementById('ui-crit').textContent = `${stats.crit.toFixed(1)}%`;
  document.getElementById('ui-haste').textContent = `+${stats.haste.toFixed(0)}%`;
  document.getElementById('ui-power-summary').textContent = `공격력 ${fmt(stats.sp)}`;

  const hpPct = Math.max(0, Math.min(100, (state.monster.hp / state.monster.maxHp) * 100));
  document.getElementById('target-hp-fill').style.width = `${hpPct}%`;
  document.getElementById('target-hp-text').textContent = `${fmt(state.monster.hp)} / ${fmt(state.monster.maxHp)}`;
  document.getElementById('target-hp-pct').textContent = `${hpPct.toFixed(0)}%`;

  const casterAvatar = document.getElementById('caster-avatar');
  const castingOrb = document.getElementById('casting-orb');
  const combBg = document.getElementById('combustion-bg');
  casterAvatar.classList.toggle('casting-active', Boolean(c.castingSkill));
  casterAvatar.classList.toggle('combustion-mode', c.combustionRem > 0);
  castingOrb.classList.toggle('active', Boolean(c.castingSkill));
  combBg.classList.toggle('active', c.combustionRem > 0);

  const castFill = document.getElementById('castbar-fill');
  const castName = document.getElementById('castbar-name');
  const castTime = document.getElementById('castbar-time');
  if (c.castingSkill) {
    const progress = ((c.castTotal - c.castRemaining) / c.castTotal) * 100;
    castFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    castName.textContent = c.castingSkill === 'fireball' ? '🔥 화염구' : '🌋 거대 화염구';
    castTime.textContent = `${c.castRemaining.toFixed(1)}s`;
  } else {
    castFill.style.width = '0%';
    castName.textContent = state.autoCast ? '🤖 자동 시전 중' : '대기 중';
    castTime.textContent = '';
  }

  const waLeft = document.getElementById('wa-left');
  const waRight = document.getElementById('wa-right');
  waLeft.className = 'wa-bracket left';
  waRight.className = 'wa-bracket right';
  if (c.critStreak === 1) {
    waLeft.classList.add('active-heat');
  } else if (c.critStreak === 2) {
    waLeft.classList.add('active-hotstreak');
    waRight.classList.add('active-hotstreak');
  }

  const buffRow = document.getElementById('player-buffs');
  let buffsHtml = '';
  if (c.critStreak === 1) {
    buffsHtml += `<div class="buff-chip heat">🔥 열기</div>`;
  } else if (c.critStreak === 2) {
    buffsHtml += `<div class="buff-chip hotstreak">🌋 연쇄 폭발!</div>`;
  }
  if (c.combustionRem > 0) {
    buffsHtml += `<div class="buff-chip combustion">☀️ 마력 폭주 (${c.combustionRem.toFixed(1)}s)</div>`;
  }
  buffRow.innerHTML = buffsHtml;

  const debuffRow = document.getElementById('target-debuffs');
  let debuffHtml = '';
  if (c.igniteRem > 0 && c.ignitePool >= 5) {
    debuffHtml += `<div class="debuff-chip">🩸 화상 ${fmt(c.ignitePool / 5)} (${c.igniteRem.toFixed(1)}s)</div>`;
  }
  if (c.meteorBurnRem > 0) {
    debuffHtml += `<div class="debuff-chip">☄️ 연소 (${c.meteorBurnRem.toFixed(1)}s)</div>`;
  }
  debuffRow.innerHTML = debuffHtml;

  setRadialSweep(document.getElementById('gcd-1'), c.gcdRemaining, c.gcdTotal, false);

  if (state.grimoires.fireblast) {
    document.getElementById('charges-2').textContent = c.fbCharges;
    if (c.fbCharges === 0) {
      setRadialSweep(document.getElementById('cd-2'), c.fbRechargeRem, c.fbRechargeTotal, true);
    } else {
      setRadialSweep(document.getElementById('cd-2'), 0, 0, false);
    }
    document.getElementById('skill-2').classList.remove('proc-glow');
  }

  if (state.grimoires.pyroblast) {
    setRadialSweep(document.getElementById('gcd-3'), c.critStreak === 2 ? 0 : c.gcdRemaining, c.gcdTotal, false);
    // 원래 시전시간이 있는 [3] 거대 화염구가 연쇄 폭발 시너지로 즉시 시전 가능할 때 테두리의 얇은 선을 따라 빛나는 와우 프록 효과 활성화
    document.getElementById('skill-3').classList.toggle('proc-glow', c.critStreak === 2);
  }

  if (state.grimoires.combustion) {
    setRadialSweep(document.getElementById('cd-4'), c.combustionCdRem, c.combustionCdTotal, true);
  }

  if (state.grimoires.meteor) {
    setRadialSweep(document.getElementById('cd-5'), c.meteorCdRem, c.meteorCdTotal, true);
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
  const achieved = canAdvanceToNextStage();

  const dpsEl = document.getElementById('ui-current-dps');
  dpsEl.textContent = `${fmt(state.currentDps)} /초`;
  dpsEl.classList.toggle('enough', state.currentDps >= reqDps || achieved);

  const reqEl = document.getElementById('ui-req-dps');
  reqEl.textContent = achieved ? `${fmt(reqDps)} /초 ✔` : `${fmt(reqDps)} /초`;

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
      dpsClearedStage: state.dpsClearedStage,
      maxDps: state.maxDps,
      playTimeSec: state.playTimeSec,
      totalKills: state.totalKills,
      campaignCleared: state.campaignCleared,
      autoCast: state.autoCast,
      soundOn: state.soundOn,
      devMode: state.devMode,
      cheats: state.cheats,
      unfolded: state.unfolded,
      bonusSkillPoints: state.bonusSkillPoints,
      skillTree: state.skillTree,
      grimoires: state.grimoires,
      items: state.items,
      infusions: state.infusions
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {}
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
    if (typeof data.dpsClearedStage === 'number') state.dpsClearedStage = data.dpsClearedStage;
    if (typeof data.maxDps === 'number') state.maxDps = data.maxDps;
    if (typeof data.playTimeSec === 'number') state.playTimeSec = data.playTimeSec;
    if (typeof data.totalKills === 'number') state.totalKills = data.totalKills;
    if (typeof data.campaignCleared === 'boolean') state.campaignCleared = data.campaignCleared;
    if (typeof data.autoCast === 'boolean') state.autoCast = data.autoCast;
    if (typeof data.soundOn === 'boolean') state.soundOn = data.soundOn;
    if (typeof data.devMode === 'boolean') state.devMode = data.devMode;
    if (data.cheats) Object.assign(state.cheats, data.cheats);
    if (typeof data.bonusSkillPoints === 'number') state.bonusSkillPoints = data.bonusSkillPoints;
    if (data.unfolded) Object.assign(state.unfolded, data.unfolded);
    if (data.skillTree) Object.assign(state.skillTree, data.skillTree);
    if (data.grimoires) Object.assign(state.grimoires, data.grimoires);
    if (data.items) Object.assign(state.items, data.items);
    if (data.infusions) Object.assign(state.infusions, data.infusions);
  } catch (e) {}
}

function initEvents() {
  document.getElementById('dummy-avatar').addEventListener('click', () => {
    if (state.grimoires.pyroblast && state.combat.critStreak === 2) {
      triggerSkill('pyroblast');
    } else {
      triggerSkill('fireball');
    }
  });

  document.querySelectorAll('.skill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skill = btn.getAttribute('data-skill');
      triggerSkill(skill);
    });
  });

  window.addEventListener('keydown', (e) => {
    const map = {
      Digit1: 'fireball',
      Digit2: 'fireblast',
      Digit3: 'pyroblast',
      Digit4: 'combustion',
      Digit5: 'meteor'
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

  // 다음 도전 버튼: 반드시 canAdvanceToNextStage() (클리어 완료 + 요구 DPS 충족) 확인!
  document.getElementById('btn-next-stage').addEventListener('click', () => {
    if (canAdvanceToNextStage()) {
      playSound('item_select');
      loadStage(state.currentStage + 1);
      saveGame();
    }
  });

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

  const testEssBtn = document.getElementById('btn-grant-test-essence');
  if (testEssBtn) {
    testEssBtn.addEventListener('click', () => {
      state.essence = (state.essence || 0) + 25;
      playSound('item_select');
      spawnFloatingText('🔥 +25 정수!', 'fct-essence', -42, { anchor: 'caster' });
      checkAndTriggerUnfolds(false);
      saveGame();
      renderInfusionUI();
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
    playSound('item_select');
    spawnFloatingText(`🌟 ${node.name} Lv.${lv + 1}!`, 'fct-proc', -42, { anchor: 'caster' });
    saveGame();
    renderSkillTreeUI();
  });

  document.getElementById('btn-grant-test-sp').addEventListener('click', () => {
    state.bonusSkillPoints = (state.bonusSkillPoints || 0) + 1;
    playSound('item_select');
    spawnFloatingText('🌟 +1 SP!', 'fct-proc', -40, { anchor: 'caster' });
    checkAndTriggerUnfolds(false);
    saveGame();
    renderSkillTreeUI();
  });

  document.getElementById('btn-respec-tree').addEventListener('click', () => {
    for (const k of Object.keys(state.skillTree)) {
      state.skillTree[k] = 0;
    }
    playSound('item_select');
    saveGame();
    renderSkillTreeUI();
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
    }
    playSound('item_select');
    spawnFloatingText(`📜 ${g.name}!`, 'fct-proc', -35, { anchor: 'caster' });
    checkAndTriggerUnfolds(false);
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

  const cheatGoldBtn = document.getElementById('btn-cheat-gold-100');
  if (cheatGoldBtn) {
    cheatGoldBtn.addEventListener('click', () => {
      state.gold += 100;
      playSound('drop_coin');
      triggerGoldPillPulse();
      spawnFloatingText('💰 +100 G', 'fct-gold', -40, { anchor: 'caster' });
      checkAndTriggerUnfolds(false);
      updateLiveHUD();
      renderShopUI();
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
      playSound('item_select');
      showUnfoldToast('🔓 모든 시스템 UI 개방 완료!', '스테이지 이동, 마법 습득, 장비 강화, 마법 부여, 특성 트리, 명예의 전당이 모두 펼쳐졌습니다.');
      applyUnfoldedVisibility();
      updateSkillActionBarVisibility();
      renderInfusionUI();
      saveGame();
    });
  }

  const soundBtn = document.getElementById('btn-sound');
  soundBtn.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    soundBtn.textContent = state.soundOn ? '🔊 사운드' : '🔇 음소거';
    updateCastingLoopSound();
    updateBurningLoopSound();
    saveGame();
  });

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
  checkAndTriggerUnfolds(true);
  updateFlameEvolutionUI(true);
  updateDevCheatUI();
  resizeCanvas();
  initEvents();
  document.getElementById('btn-sound').textContent = state.soundOn ? '🔊 사운드' : '🔇 음소거';
  loadStage(state.currentStage);
  renderShopUI();
  renderInfusionUI();
  renderSkillTreeUI();
  updateNotificationBadges();
  requestAnimationFrame(gameLoop);
});
