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
    id: 'flame_patch',
    tier: 1,
    row: 1,
    col: 2,
    reqTotalSp: 0,
    cost: 1,
    maxLv: 3,
    name: '불장판',
    shortName: '불장판',
    icon: '🔥',
    desc: (lv) =>
      `[6] 불장판 스킬 사용 가능: 몬스터 아래쪽 바닥에 7초간 불장판을 깔아 0.5초마다 공격력의 ${lv === 0 ? 40 : lv * 40}% 도트 피해 (쿨타임 10초)`
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
  pendingEssence: 0,
  currentStage: 1,
  highestClearedStage: 0,
  dpsClearedStage: 0,
  maxDps: 0,
  playTimeSec: 0,
  totalKills: 0,
  campaignCleared: false,
  autoCast: false,
  autoAdvance: true,
  skillAuto: {
    fireball: true,
    fireblast: true,
    pyroblast: true,
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
    hallOfFame: false
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

    wasOnCd: { 2: false, 4: false, 5: false, 6: false }
  },

  dpsHistory: [],
  skillDamage: {
    fireball: { name: '🔥 화염구', dmg: 0, color: '#f97316' },
    fireblast: { name: '💥 불꽃 작렬', dmg: 0, color: '#fbbf24' },
    pyroblast: { name: '🌋 거대 화염구', dmg: 0, color: '#ef4444' },
    ignite: { name: '🩸 화상 (도트)', dmg: 0, color: '#ff8000' },
    meteor: { name: '☄️ 메테오', dmg: 0, color: '#a855f7' },
    flame_patch: { name: '🔥 불장판', dmg: 0, color: '#fb923c' },
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

function playFireballSfx(kind, volume = 0.65) {
  const effVol = getEffectiveSfxVol(volume);
  if (effVol <= 0) return null;
  try {
    const base = preloadedSfx[kind];
    if (!base) return null;
    const snd = base.cloneNode();
    snd.volume = effVol;
    snd.play().catch(() => {});
    return snd;
  } catch (e) {
    return null;
  }
}

function playSound(type) {
  if (!state.soundOn) return null;
  if (type === 'launch') {
    return playFireballSfx('fly', 0.8);
  }
  if (type === 'hit') {
    return playFireballSfx('explosion', 0.72);
  }
  if (type === 'crit') {
    return playFireballSfx('explosion_crit', 1.0);
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

const rockDebris = [];

function spawnMeteorRockDebris(x, y, scale = 1.0) {
  const count = Math.max(8, Math.round(16 * scale));
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
  const start = getCasterPos();
  const end = getTargetPos();
  const isPyro = type === 'pyroblast';
  const evo = getCurrentFlameEvolution();

  const avatar = document.getElementById('caster-avatar');
  avatar.classList.add('cast-recoil');
  setTimeout(() => avatar.classList.remove('cast-recoil'), 120);

  if (scaleMult >= 0.9) {
    playFireballSfx('fly', isPyro ? 0.82 : 0.52);
  }

  // 일반 화염구 반지름을 기존(6.2)의 2배인 12.4로 확대하고, 거대 화염구(pyroblast)는 더 큰 반지름(24)과 코로나 광선/위성으로 차별화!
  const baseRadius = isPyro ? 24 : 12.4;
  const effectiveEvoScale = isPyro ? evo.scale : 1 + (evo.scale - 1) * 0.38;

  launchCustomProjectile({
    type,
    startX: start.x,
    startY: start.y + offsetY,
    targetX: end.x,
    targetY: end.y + offsetY,
    duration: isPyro ? 0.31 : 0.24,
    radius: baseRadius * effectiveEvoScale * scaleMult,
    colorCore: evo.colorCore,
    colorMid: evo.colorMid,
    colorEdge: evo.colorEdge,
    ringRgb: evo.ringRgb,
    evoTier: evo.tier,
    orbiters: isPyro && scaleMult >= 0.9 ? Math.max(2, evo.orbiters + 1) : 0,
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

  // 거대 운석 암석 폴리곤 정점 생성 (회전하며 낙하하는 불타는 바위 덩어리 연출)
  const meteorRadius = 51 * scale; // 기존 34 * scale 대비 정확히 1.5배!
  const rockVerts = [];
  const numVerts = 9;
  for (let i = 0; i < numVerts; i++) {
    const ang = (i / numVerts) * Math.PI * 2;
    const r = meteorRadius * (0.68 + ((i * 37) % 10) * 0.026);
    rockVerts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
  }

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
    rockVerts,
    rot: Math.random() * Math.PI * 2,
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
    gCtx.translate(casterCenter.x, casterCenter.y + 46);
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

  // 1-B. 거대 화염구 준비 상태 (시전 중이거나 연쇄 폭발 즉시 발사 대기 중일 때 지팡이 끝에 거대 태양 구체 & 십자 코로나 & 마력 위성 연출!)
  const isPyroReady =
    c.castingSkill === 'pyroblast' || (state.grimoires.pyroblast && c.critStreak === 2);
  if (isPyroReady) {
    const casterPos = getCasterPos();
    const ox = casterPos.x + 12;
    const oy = casterPos.y - 4;
    const pulse = 1 + Math.sin(c.animTime * 14) * 0.14;
    const chargeR = 22 * pulse;

    // 거대 화염구 차징 코로나 광채
    const pyroGrad = ctx.createRadialGradient(ox, oy, 2, ox, oy, chargeR * 1.65);
    pyroGrad.addColorStop(0, '#ffffff');
    pyroGrad.addColorStop(0.32, '#fef08a');
    pyroGrad.addColorStop(0.68, '#ea580c');
    pyroGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = pyroGrad;
    ctx.beginPath();
    ctx.arc(ox, oy, chargeR * 1.65, 0, Math.PI * 2);
    ctx.fill();

    // 회전하는 태양 코로나 십자 광선 (일반 화염구 준비 상태에는 없는 거대 화염구만의 시그니처 연출!)
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(c.animTime * 7.5);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 2.6;
    const rayLen = chargeR * 1.55;
    ctx.beginPath();
    ctx.moveTo(-rayLen, 0);
    ctx.lineTo(rayLen, 0);
    ctx.moveTo(0, -rayLen);
    ctx.lineTo(0, rayLen);
    ctx.stroke();

    // 대각선 보조 코로나 광선
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.8)';
    ctx.lineWidth = 1.8;
    const subRayLen = chargeR * 1.15;
    ctx.beginPath();
    ctx.moveTo(-subRayLen, 0);
    ctx.lineTo(subRayLen, 0);
    ctx.moveTo(0, -subRayLen);
    ctx.lineTo(0, subRayLen);
    ctx.stroke();
    ctx.restore();

    // 주변을 빠르게 공전하는 3개의 화염 마력 위성
    for (let ob = 0; ob < 3; ob++) {
      const ang = c.animTime * 11 + (ob * Math.PI * 2) / 3;
      const sx = ox + Math.cos(ang) * (chargeR * 1.15);
      const sy = oy + Math.sin(ang) * (chargeR * 0.72);
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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
    ctx.fillText('🔥', 0, 0);

    ctx.font = 'bold 10px Pretendard, sans-serif';
    ctx.fillStyle = '#fed7aa';
    ctx.fillText(`불의 정령 Lv.${elemLv}`, 0, 24);

    ctx.restore();
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

  // 4-B. 불장판 (몬스터 이미지 뒤쪽/발밑 바닥 레이어 #ground-vfx-canvas 에 1.5배 넓어진 화염 지대 렌더링!)
  if (c.flamePatchRem > 0) {
    const fx = targetCenter.x;
    const fy = targetCenter.y + 56; // 몬스터 아바타 하단 발밑 바닥 위치
    const fadeAlpha = Math.min(1, c.flamePatchRem / 0.6);
    const pulse = 1 + Math.sin(c.animTime * 9) * 0.06;
    const patchRadius = 111 * pulse; // 기존 74 대비 1.5배 넓어진 반경!

    // 바닥 타원형 용암/화염 장판 베이스 (몬스터 이미지 아래쪽 바닥에 깔림)
    gCtx.save();
    gCtx.globalAlpha = fadeAlpha;
    gCtx.translate(fx, fy);
    gCtx.scale(1, 0.42);

    const floorGrad = gCtx.createRadialGradient(0, 0, 8, 0, 0, patchRadius);
    floorGrad.addColorStop(0, 'rgba(254, 240, 138, 0.94)');
    floorGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.82)');
    floorGrad.addColorStop(0.75, 'rgba(220, 38, 38, 0.52)');
    floorGrad.addColorStop(1, 'rgba(153, 27, 27, 0)');
    gCtx.fillStyle = floorGrad;
    gCtx.beginPath();
    gCtx.arc(0, 0, patchRadius, 0, Math.PI * 2);
    gCtx.fill();

    // 회전하는 화염 테두리 균열 링 (1.5배 확장: 87 / 60)
    gCtx.rotate(c.animTime * 1.8);
    gCtx.beginPath();
    gCtx.arc(0, 0, 87, 0, Math.PI * 2);
    gCtx.setLineDash([18, 11]);
    gCtx.strokeStyle = 'rgba(253, 224, 71, 0.88)';
    gCtx.lineWidth = 3.2;
    gCtx.stroke();

    gCtx.rotate(-c.animTime * 3.2);
    gCtx.beginPath();
    gCtx.arc(0, 0, 60, 0, Math.PI * 2);
    gCtx.setLineDash([11, 9]);
    gCtx.strokeStyle = 'rgba(251, 146, 60, 0.82)';
    gCtx.lineWidth = 2.5;
    gCtx.stroke();
    gCtx.restore();

    // 바닥 영역에서 일렁이며 솟아오르는 불길 기둥(Flame Tongues) 연출 (바닥 캔버스에 그려 몬스터 이미지를 가리지 않음)
    gCtx.save();
    gCtx.globalAlpha = fadeAlpha;
    const flameOffsets = [
      { dx: -72, dy: 2, h: 28, phase: 0.0 },
      { dx: -54, dy: 9, h: 34, phase: 1.1 },
      { dx: -36, dy: -5, h: 32, phase: 2.3 },
      { dx: -18, dy: 11, h: 38, phase: 3.5 },
      { dx: 0, dy: 14, h: 42, phase: 0.7 },
      { dx: 19, dy: 10, h: 37, phase: 2.9 },
      { dx: 37, dy: -4, h: 33, phase: 4.1 },
      { dx: 55, dy: 8, h: 35, phase: 1.8 },
      { dx: 72, dy: 1, h: 27, phase: 4.9 }
    ];
    for (const fl of flameOffsets) {
      const bx = fx + fl.dx;
      const by = fy + fl.dy;
      const waveX = Math.sin(c.animTime * 11 + fl.phase) * 6.5;
      const stretchH = fl.h * (0.78 + 0.32 * Math.sin(c.animTime * 14 + fl.phase * 1.7));
      const w = 11.5;

      // 외곽 붉은 오렌지 불길
      gCtx.beginPath();
      gCtx.moveTo(bx - w, by);
      gCtx.quadraticCurveTo(bx - w * 0.5 + waveX * 0.4, by - stretchH * 0.55, bx + waveX, by - stretchH);
      gCtx.quadraticCurveTo(bx + w * 0.5 + waveX * 0.4, by - stretchH * 0.55, bx + w, by);
      gCtx.closePath();
      gCtx.fillStyle = 'rgba(249, 115, 22, 0.8)';
      gCtx.fill();

      // 내부 밝은 노란 불꽃 코어
      gCtx.beginPath();
      gCtx.moveTo(bx - w * 0.52, by);
      gCtx.quadraticCurveTo(bx + waveX * 0.3, by - stretchH * 0.4, bx + waveX * 0.7, by - stretchH * 0.68);
      gCtx.quadraticCurveTo(bx + waveX * 0.3, by - stretchH * 0.4, bx + w * 0.52, by);
      gCtx.closePath();
      gCtx.fillStyle = 'rgba(254, 240, 138, 0.92)';
      gCtx.fill();
    }
    gCtx.restore();

    // 1.5배 넓어진 바닥 장판에서 위로 피어오르는 불티 파티클
    if (Math.random() < 0.75) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * 84;
      particles.push({
        x: fx + Math.cos(ang) * dist,
        y: fy + Math.sin(ang) * dist * 0.38,
        vx: (Math.random() - 0.5) * 32,
        vy: -(52 + Math.random() * 60),
        radius: 2.8 + Math.random() * 3.8,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.24,
        colorCore: '#fef08a',
        colorEdge: '#ea580c'
      });
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
  for (let i = groundEffects.length - 1; i >= 0; i--) {
    const g = groundEffects[i];
    g.life += dt;
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
    const isPyro = p.type === 'pyroblast';

    if (p.progress >= 1) {
      const tierScale = 1 + (p.evoTier - 1) * (isPyro ? 0.18 : 0.08);
      // 일반 화염구는 타격 파티클도 가볍고 작게, 거대 화염구는 화려하고 묵직하게!
      spawnParticles(
        p.targetX,
        p.targetY,
        isPyro ? Math.round(32 * tierScale) : 7,
        p.colorCore,
        p.colorMid,
        isPyro ? 1.45 * tierScale : 0.62
      );
      if (isPyro) {
        shockwaves.push({
          x: p.targetX,
          y: p.targetY,
          life: 0,
          maxLife: 0.32 + p.evoTier * 0.03,
          maxRadius: 62 + p.evoTier * 10,
          rgb: p.ringRgb,
          flat: false,
          lineWidth: 4.5
        });
        triggerArenaShake('sm');
      }
      if (p.onHit) p.onHit();
      projectiles.splice(i, 1);
      continue;
    }

    // 12대 애니메이션 원칙(호 Arcs & 추진 가속 Ease-In) 적용:
    // 1) 가속도: 출발 시 마력이 방출되어 살짝 가속하며 타격 지점에 내리꽂힘
    // 2) 호(Arc): 기계적 1자 직선 대신 자연스러운 상향 호를 그리며 비행
    const rawP = Math.min(1, Math.max(0, p.progress));
    const easeT = isPyro ? Math.pow(rawP, 1.25) : Math.pow(rawP, 1.12);
    const arcHeight = isPyro ? -15 : -8;
    const arcOffset = Math.sin(rawP * Math.PI) * arcHeight;

    const x = p.startX + (p.targetX - p.startX) * easeT;
    const y = p.startY + (p.targetY - p.startY) * easeT + arcOffset;

    if (isPyro) {
      const trailCount = p.evoTier >= 3 ? 2 : 1;
      for (let tr = 0; tr < trailCount; tr++) {
        if (Math.random() < 0.9) {
          particles.push({
            x: x + (Math.random() * 8 - 4),
            y: y + (Math.random() * 8 - 4),
            vx: -65 + Math.random() * 25,
            vy: -18 + Math.random() * 36,
            radius: p.radius * (0.42 + p.evoTier * 0.04),
            life: 0,
            maxLife: 0.16 + p.evoTier * 0.02,
            colorCore: p.colorCore,
            colorEdge: p.colorMid
          });
        }
      }
    } else {
      // 일반 화염구: 잔상 파티클을 작고 절제되게 표현
      if (Math.random() < 0.4) {
        particles.push({
          x: x + (Math.random() * 3 - 1.5),
          y: y + (Math.random() * 3 - 1.5),
          vx: -35 + Math.random() * 12,
          vy: -6 + Math.random() * 12,
          radius: p.radius * 0.28,
          life: 0,
          maxLife: 0.1,
          colorCore: p.colorCore,
          colorEdge: p.colorMid
        });
      }
    }

    // 본체 그라데이션: 일반 화염구는 작고 담백하게(1.22배), 거대 화염구는 거대한 화염 광채(1.85배)로 렌더링
    const glowRadius = p.radius * (isPyro ? 1.85 : 1.22);
    const grad = ctx.createRadialGradient(x, y, 1.5, x, y, glowRadius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(isPyro ? 0.38 : 0.28, p.colorCore);
    grad.addColorStop(isPyro ? 0.75 : 0.65, p.colorMid);
    grad.addColorStop(1, p.colorEdge);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 거대 화염구 전용: 회전하는 태양 코로나 십자 광선 & 마력 위성(Orbiters)
    if (isPyro) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(state.combat.animTime * 9 + t * 6);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 2.4;
      const rayLen = p.radius * 1.9;
      ctx.beginPath();
      ctx.moveTo(-rayLen, 0);
      ctx.lineTo(rayLen, 0);
      ctx.moveTo(0, -rayLen);
      ctx.lineTo(0, rayLen);
      ctx.stroke();
      ctx.restore();

      if (p.orbiters > 0) {
        for (let ob = 0; ob < p.orbiters; ob++) {
          const ang = state.combat.animTime * 14 + t * 10 + (ob * Math.PI * 2) / p.orbiters;
          const dist = p.radius * 1.12;
          const ox = x + Math.cos(ang) * dist * 0.65;
          const oy = y + Math.sin(ang) * dist;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ox, oy, 3.2 + p.evoTier * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.progress += dt / m.duration;
    // 초반에는 천천히 회전하다가 낙하 속도가 붙을수록 회전도 가속
    const speedFactor = 0.4 + 3.2 * Math.pow(Math.min(1, m.progress), 2.2);
    m.rot = (m.rot || 0) + dt * 5.5 * speedFactor;

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
      spawnParticles(m.targetX, m.targetY, Math.round(65 * m.scale), '#fef08a', '#dc2626', 2.2 * m.scale);
      spawnMeteorRockDebris(m.targetX, m.targetY, m.scale);
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
      triggerArenaShake('lg');
      playSound('meteor_impact');
      if (m.onImpact) m.onImpact();
      meteors.splice(i, 1);
      continue;
    }

    // 강한 Ease-In 가속 곡선 (p^3.5):
    // 처음 상공에 나타났을 때는 아주 느리게 내려오다가, 점점 중력 가속도가 붙어 땅에 부딪힐 때 최고 속도로 격돌!
    const t = Math.pow(m.progress, 3.5);
    const x = m.startX + (m.targetX - m.startX) * t;
    const y = m.startY + (m.targetY - m.startY) * t;

    // 먼 곳에서 점점 다가오는 원근감 스케일 연출:
    // 처음 배너 아래에 나타날 때는 작은 크기(0.42배)로 시작해, 지면으로 다가올수록 점점 거대하게(1.12배) 확대!
    const popIn = m.progress < 0.08 ? m.progress / 0.08 : 1.0;
    const appearScale = (0.42 + 0.70 * Math.pow(m.progress, 2.2)) * (0.35 + 0.65 * popIn);
    const curRadius = m.radius * appearScale;

    // 가속이 붙을수록 더 크고 맹렬해지는 화염 꼬리 파티클
    const trailCount = m.progress > 0.45 ? 3 : 1;
    for (let tr = 0; tr < trailCount; tr++) {
      particles.push({
        x: x + (Math.random() * 20 - 10) * m.scale * appearScale,
        y: y + (Math.random() * 20 - 10) * m.scale * appearScale,
        vx: (-25 - 65 * m.progress) + Math.random() * 20,
        vy: (-25 - 65 * m.progress) + Math.random() * 20,
        radius: (10 + Math.random() * 9) * m.scale * appearScale,
        life: 0,
        maxLife: 0.22 + m.progress * 0.08,
        colorCore: '#fde047',
        colorEdge: '#dc2626'
      });
    }

    // 메테오 외곽 화염 코로나 광채 (1.5배 확대된 curRadius 기반)
    const grad = ctx.createRadialGradient(x, y, 5, x, y, curRadius * 1.35);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.28, '#fde047');
    grad.addColorStop(0.62, '#ea580c');
    grad.addColorStop(1, 'rgba(185, 28, 28, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, curRadius * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // 메테오 중심부의 거대한 불타는 암석(운석) 폴리곤 렌더링
    if (m.rockVerts && m.rockVerts.length > 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(appearScale, appearScale);
      ctx.rotate(m.rot);
      ctx.beginPath();
      ctx.moveTo(m.rockVerts[0].x, m.rockVerts[0].y);
      for (let v = 1; v < m.rockVerts.length; v++) {
        ctx.lineTo(m.rockVerts[v].x, m.rockVerts[v].y);
      }
      ctx.closePath();
      const rockGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, m.radius * 0.75);
      rockGrad.addColorStop(0, '#fef08a');
      rockGrad.addColorStop(0.45, '#b45309');
      rockGrad.addColorStop(0.82, '#44403c');
      rockGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = rockGrad;
      ctx.fill();
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 2.5 * m.scale;
      ctx.stroke();
      ctx.restore();
    }
  }

  // 메테오 충돌 시 사방으로 튀어 나가는 바위 파편(Rock Debris) 물리 업데이트 및 렌더링
  for (let i = rockDebris.length - 1; i >= 0; i--) {
    const d = rockDebris[i];
    d.life += dt;
    if (d.life >= d.maxLife) {
      rockDebris.splice(i, 1);
      continue;
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.vy += d.gravity * dt;
    d.rot += d.vRot * dt;

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

function spawnEssenceFlight(totalEssence) {
  if (!totalEssence || totalEssence <= 0) return;

  const layer = document.getElementById('coin-fx-layer');
  const monsterEl = document.getElementById('dummy-avatar') || document.getElementById('target-stage-box');
  const essencePillEl = document.getElementById('pill-essence') || document.getElementById('ui-essence');

  if (!layer || !monsterEl || !essencePillEl) {
    state.pendingEssence = 0;
    return;
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
    el.textContent = '🔥';
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
  if (gainedEssence > 0) {
    state.essence = (state.essence || 0) + gainedEssence;
  }

  if (isFirstRagnarosKill || state.highestClearedStage >= 20) {
    state.campaignCleared = true;
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
  // 하스스톤 영웅 초상화 박살 연출: 이전 몬스터가 9개 다각형 조각으로 갈라져 사방으로 폭발!
  playSound('monster_destroy');
  spawnMonsterShatterVfx(pos.x, pos.y, data.emoji, data.isPhaseBoss);
  spawnParticles(pos.x, pos.y, 28, '#fef08a', '#f97316', 1.45);
  triggerArenaShake(data.isPhaseBoss ? 'lg' : 'sm');

  updateDpsMeterUI();

  if (isFirstRagnarosKill) {
    openVictoryModal(true);
    loadStage(state.currentStage);
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
    dummyEl.classList.remove('hit', 'crit-hit', 'knockback-pyro', 'knockback-meteor', 'respawn-pop');
    void dummyEl.offsetWidth;
    dummyEl.classList.add('respawn-pop');
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

function dealDamage(skillKey, rawDamage, isCrit, canTriggerStreak = true, isDotTick = false) {
  if (state.cheats && state.cheats.alwaysCrit) {
    if (!isCrit) {
      rawDamage *= getPlayerStats().critDmg;
      isCrit = true;
    }
  }
  const dmg = Math.max(1, Math.round(rawDamage));
  const now = performance.now() / 1000;
  const willKill = state.monster.hp - dmg <= 0;

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

  const isBigSkill = skillKey === 'pyroblast' || skillKey === 'meteor';
  if (!isDotTick && !willKill) {
    const dummyEl = document.getElementById('dummy-avatar');
    if (dummyEl) {
      if (skillKey === 'meteor') {
        lastHeavyKnockbackTime = now;
        dummyEl.classList.remove('hit', 'crit-hit', 'knockback-pyro', 'knockback-meteor', 'respawn-pop');
        void dummyEl.offsetWidth;
        dummyEl.classList.add('knockback-meteor');
      } else if (skillKey === 'pyroblast') {
        lastHeavyKnockbackTime = now;
        dummyEl.classList.remove('hit', 'crit-hit', 'knockback-pyro', 'knockback-meteor', 'respawn-pop');
        void dummyEl.offsetWidth;
        dummyEl.classList.add('knockback-pyro');
      } else if (now - lastHeavyKnockbackTime > 0.34) {
        dummyEl.classList.remove('hit', 'crit-hit', 'knockback-pyro', 'knockback-meteor', 'respawn-pop');
        void dummyEl.offsetWidth;
        dummyEl.classList.add(isCrit ? 'crit-hit' : 'hit');
      }
    }
  }

  if ((isDotTick || skillKey === 'ignite') && !(state.cheats && state.cheats.alwaysCrit)) {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-dot', 5);
  } else if (isCrit) {
    spawnFloatingText(`${fmt(dmg)}!`, 'fct-crit', -8, { isBig: isBigSkill });
    if (!isDotTick && skillKey !== 'meteor') playSound('crit');
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
  }

  if (canTriggerStreak && state.grimoires.pyroblast) {
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
  if (state.monster.hp <= 0) {
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

function finishCast(skillKey) {
  if (skillKey === 'fireball') {
    fireWithMultishot('fireball', 1.0);
  } else if (skillKey === 'pyroblast') {
    fireWithMultishot('pyroblast', 1.55);
    triggerAllSummonsSyncAttack();
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

  if (isSkillAutoActive('combustion') && state.grimoires.combustion && c.combustionCdRem <= 0) {
    triggerSkill('combustion');
  }
  if (isSkillAutoActive('flame_patch') && (state.skillTree.flame_patch || 0) > 0 && c.flamePatchCdRem <= 0) {
    triggerSkill('flame_patch');
  }
  if (isSkillAutoActive('meteor') && state.grimoires.meteor && c.meteorCdRem <= 0) {
    triggerSkill('meteor');
  }
  // 연쇄 폭발(즉시 시전 거대 화염구)이 발동했을 때, 현재 시전/GCD가 끝나고 테두리 빛 효과가 잠시(0.55초) 보여진 뒤 발사!
  if (
    isSkillAutoActive('pyroblast') &&
    state.grimoires.pyroblast &&
    c.critStreak === 2 &&
    !c.castingSkill &&
    c.gcdRemaining <= 0 &&
    c.streakTimer <= 11.45
  ) {
    triggerSkill('pyroblast');
  }
  if (isSkillAutoActive('fireblast') && state.grimoires.fireblast && c.fbCharges > 0) {
    if (!state.grimoires.pyroblast || c.critStreak === 1 || c.fbCharges >= c.fbMaxCharges) {
      triggerSkill('fireblast');
    }
  }
  if (
    isSkillAutoActive('fireball') &&
    !c.castingSkill &&
    c.gcdRemaining <= 0 &&
    !(state.grimoires.pyroblast && c.critStreak === 2 && isSkillAutoActive('pyroblast'))
  ) {
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
  setBadge('badge-skill-3', state.grimoires.pyroblast && c.critStreak === 2);
  setBadge('badge-skill-4', manualMode && state.grimoires.combustion && c.combustionCdRem <= 0);
  setBadge('badge-skill-5', manualMode && state.grimoires.meteor && c.meteorCdRem <= 0);
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

  const btn6 = document.getElementById('skill-6');
  const icon6 = document.getElementById('icon-6');
  if (btn6 && icon6) {
    const hasFlamePatch = (state.skillTree.flame_patch || 0) > 0;
    if (hasFlamePatch || state.unfolded.skillTree) {
      btn6.classList.remove('hidden-slot');
    } else {
      btn6.classList.add('hidden-slot');
    }
    if (hasFlamePatch) {
      btn6.classList.remove('locked-skill');
      icon6.textContent = '🔥';
    } else {
      btn6.classList.add('locked-skill');
      icon6.textContent = '🔒';
    }
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

  updateSkillAutoUI();
}

function updateSkillAutoUI() {
  const isAutocastUnlocked = !!state.grimoires.autocast;
  const isGlobalAutoOn = !!state.autoCast;

  const skillKeys = ['fireball', 'fireblast', 'pyroblast', 'combustion', 'meteor', 'flame_patch'];
  const skillNames = {
    fireball: '화염구',
    fireblast: '불꽃 작렬',
    pyroblast: '거대 화염구',
    combustion: '마력 폭주',
    meteor: '메테오',
    flame_patch: '불장판'
  };

  skillKeys.forEach((key) => {
    const el = document.getElementById(`auto-toggle-${key}`);
    if (!el) return;

    if (!isAutocastUnlocked) {
      el.classList.add('unfold-hidden');
      return;
    }
    el.classList.remove('unfold-hidden');

    const isEnabled = state.skillAuto && state.skillAuto[key] !== false;
    el.classList.toggle('active', isEnabled);
    el.classList.toggle('disabled', !isEnabled);
    el.classList.toggle('paused', isEnabled && !isGlobalAutoOn);

    if (isEnabled) {
      el.textContent = 'AUTO';
      el.title = isGlobalAutoOn
        ? `[${skillNames[key]}] 자동 시전: 활성 (클릭 시 수동 전환)`
        : `[${skillNames[key]}] 자동 시전: 활성 (전체 자동 시전 꺼짐 상태)`;
    } else {
      el.textContent = 'OFF';
      el.title = `[${skillNames[key]}] 자동 시전: 비활성/수동 전용 (클릭 시 자동 전환)`;
    }
  });
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
  const dpsMet = isStageDpsMet(state.currentStage);
  document.getElementById('ui-req-dps').textContent = dpsMet
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
  if (c.flamePatchCdRem > 0) {
    c.flamePatchCdRem = Math.max(0, c.flamePatchCdRem - dt);
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
  const isPyroReady =
    c.castingSkill === 'pyroblast' || (state.grimoires.pyroblast && c.critStreak === 2);

  casterAvatar.classList.toggle('casting-active', Boolean(c.castingSkill) && !isPyroReady);
  casterAvatar.classList.toggle('pyro-ready-mode', isPyroReady);
  casterAvatar.classList.toggle('combustion-mode', c.combustionRem > 0);
  castingOrb.classList.toggle('active', Boolean(c.castingSkill) && !isPyroReady);
  castingOrb.classList.toggle('pyro-ready', isPyroReady);
  combBg.classList.toggle('active', c.combustionRem > 0);

  const castFill = document.getElementById('castbar-fill');
  const castWrapper = castFill ? castFill.parentElement : null;
  const castName = document.getElementById('castbar-name');
  const castTime = document.getElementById('castbar-time');
  if (castWrapper) castWrapper.classList.toggle('pyro-cast', isPyroReady);
  if (castFill) castFill.classList.toggle('pyro-cast', isPyroReady);

  if (c.castingSkill) {
    const progress = ((c.castTotal - c.castRemaining) / c.castTotal) * 100;
    castFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    if (c.castingSkill === 'pyroblast') {
      castName.textContent = '🌋 거대 화염구 시전 중';
    } else if (isPyroReady) {
      castName.textContent = '🔥 화염구 (🌋거대 화염구 장전됨!)';
    } else {
      castName.textContent = '🔥 화염구';
    }
    castTime.textContent = `${c.castRemaining.toFixed(1)}s`;
  } else if (state.grimoires.pyroblast && c.critStreak === 2) {
    castFill.style.width = '100%';
    castName.textContent = '🌋 거대 화염구 준비 완료!';
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
      Digit5: 'meteor',
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

  document.querySelectorAll('.skill-auto-toggle').forEach((toggleEl) => {
    toggleEl.addEventListener('click', (e) => {
      e.stopPropagation(); // 스킬 수동 시전 방지
      const skillKey = toggleEl.getAttribute('data-auto-skill');
      if (!skillKey) return;
      if (!state.skillAuto) {
        state.skillAuto = {
          fireball: true,
          fireblast: true,
          pyroblast: true,
          combustion: true,
          meteor: true,
          flame_patch: true
        };
      }
      state.skillAuto[skillKey] = !state.skillAuto[skillKey];
      playSound('item_select');
      updateSkillAutoUI();
      saveGame();
    });
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
      spawnFloatingText('🔥 +10,000 정수!', 'fct-essence', -42, { anchor: 'caster' });
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
      playSound('item_select');
      showUnfoldToast('🔓 모든 시스템 UI 개방 완료!', '스테이지 이동, 주문서, 장비 강화, 마법 부여, 특성 트리, 명예의 전당이 모두 펼쳐졌습니다.');
      applyUnfoldedVisibility();
      updateSkillActionBarVisibility();
      renderInfusionUI();
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
  updateSoundUI();
  updateSkillActionBarVisibility();
  resizeCanvas();
  initEvents();
  updateBgmPlayback();
  loadStage(state.currentStage);
  renderShopUI();
  renderInfusionUI();
  renderSkillTreeUI();
  updateNotificationBadges();
  requestAnimationFrame(gameLoop);
});
