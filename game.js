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
// 2. 스킬 트리 (소환수 & 마법 변이)
// ==========================================
const SKILL_TREE_NODES = [
  // TIER 1
  {
    id: 'fire_elem',
    tier: 1,
    reqTotalSp: 0,
    cost: 1,
    maxLv: 3,
    name: '불의 정령 소환',
    icon: '🔥',
    desc: (lv) =>
      `불의 정령 상시 소환 (1.3초마다 공격력의 ${lv === 0 ? 45 : lv * 45}% 화염탄 발사 및 화상 연장)`
  },
  {
    id: 'phoenix',
    tier: 1,
    reqTotalSp: 0,
    cost: 1,
    maxLv: 3,
    name: '비전 불사조 소환',
    icon: '🦅',
    desc: (lv) =>
      `불사조 상시 소환 (2.4초마다 100% 치명타 섬광 ${lv === 0 ? 65 : lv * 65}% & 연쇄 폭발 유도)`
  },

  // TIER 2
  {
    id: 'magma_golem',
    tier: 2,
    reqTotalSp: 1,
    cost: 1,
    maxLv: 3,
    name: '용암 골렘 소환',
    icon: '🗿',
    desc: (lv) =>
      `전열 용암 골렘 소환 (2.8초마다 대지 강타 ${lv === 0 ? 110 : lv * 110}% & 화상 피해 +${lv === 0 ? 15 : lv * 15}% 증폭)`
  },
  {
    id: 'multishot',
    tier: 2,
    reqTotalSp: 1,
    cost: 1,
    maxLv: 3,
    name: '갈래 화염구',
    icon: '✨',
    desc: (lv) =>
      `화염구·거대 화염구 시전 시 탄환이 ${lv === 0 ? 2 : lv + 1}발로 갈라져 직선 발사`
  },
  {
    id: 'rune_aura',
    tier: 2,
    reqTotalSp: 1,
    cost: 1,
    maxLv: 3,
    name: '고대 가속 마법진',
    icon: '⚡',
    desc: (lv) =>
      `마법사 및 모든 소환수의 공격·시전 속도 +${lv === 0 ? 18 : lv * 18}% 증가`
  },

  // TIER 3
  {
    id: 'legion_sync',
    tier: 3,
    reqTotalSp: 3,
    cost: 2,
    maxLv: 2,
    name: '태양왕의 군단 일제사격',
    icon: '👑',
    desc: (lv) =>
      `거대 화염구 발사 시 모든 소환수 즉시 일제 공격 & 소환수 피해 +${lv === 0 ? 50 : lv * 50}%`
  },
  {
    id: 'meteor_rain',
    tier: 3,
    reqTotalSp: 3,
    cost: 2,
    maxLv: 2,
    name: '종말의 유성우',
    icon: '☄️',
    desc: (lv) =>
      `치명타 적중 시 ${lv === 0 ? 14 : lv * 14}% 확률로 미니 운석 자동 낙하`
  }
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
// 4. 게임 상태 (State)
// ==========================================
const state = {
  gold: 0,
  currentStage: 1,
  highestClearedStage: 0,
  dpsClearedStage: 0,
  maxDps: 0,
  autoAdvance: false,
  autoCast: false,
  soundOn: true,

  // 실시간 측정 DPS 및 최근 전투 시각
  currentDps: 0,
  lastCombatTime: 0,

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

  const runeLv = state.skillTree.rune_aura || 0;
  if (runeLv > 0) {
    haste += runeLv * 18;
  }

  if (state.combat.combustionRem > 0) {
    crit = 100;
    haste += 20;
  }

  crit = Math.min(100, crit);
  cdr = Math.min(0.5, cdr);

  const summonMult = 1 + (state.skillTree.legion_sync || 0) * 0.5;

  return {
    sp: Math.round(sp * (1 + bonusPct)),
    crit,
    haste,
    critDmg,
    cdr,
    speedMult: 1 + haste / 100,
    summonMult
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
// 6. 사운드 매니저 (화염구 발사/폭발 WAV 효과음 & 보조 효과음)
// ==========================================
const FIREBALL_SFX_FILES = {
  fly: 'assets/sounds/sfx/fireball_fly.wav',
  explosion: 'assets/sounds/sfx/fireball_explosion.wav'
};

const preloadedSfx = {};

function initSfxAudio() {
  for (const [key, src] of Object.entries(FIREBALL_SFX_FILES)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    preloadedSfx[key] = audio;
  }
}
initSfxAudio();

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
  if (type === 'hit' || type === 'crit') {
    playFireballSfx('explosion', type === 'crit' ? 0.8 : 0.55);
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
      playFireballSfx('explosion', 0.9);
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
    } else if (type === 'kill') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.07);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.22);
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
    onHit: opts.onHit
  });
}

function launchProjectile(type, onHitCallback, offsetY = 0) {
  const start = getCasterPos();
  const end = getTargetPos();
  const isPyro = type === 'pyroblast';

  const avatar = document.getElementById('caster-avatar');
  avatar.classList.add('cast-recoil');
  setTimeout(() => avatar.classList.remove('cast-recoil'), 120);

  playFireballSfx('fly', isPyro ? 0.78 : 0.62);

  launchCustomProjectile({
    type,
    startX: start.x,
    startY: start.y + offsetY,
    targetX: end.x,
    targetY: end.y + offsetY,
    duration: isPyro ? 0.32 : 0.26,
    radius: isPyro ? 17 : 10,
    colorCore: '#fde047',
    colorMid: '#f97316',
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

  // 5. 충격파
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.life += dt;
    if (sw.life >= sw.maxLife) {
      shockwaves.splice(i, 1);
      continue;
    }
    const prog = sw.life / sw.maxLife;
    const alpha = 1 - prog;
    ctx.save();
    ctx.translate(sw.x, sw.y);
    ctx.scale(1, 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, sw.maxRadius * prog, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
    ctx.lineWidth = 4;
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
      spawnParticles(p.targetX, p.targetY, isPyro ? 24 : 12, p.colorCore, p.colorMid, isPyro ? 1.3 : 0.85);
      triggerArenaShake(isPyro ? 'sm' : null);
      if (p.onHit) p.onHit();
      projectiles.splice(i, 1);
      continue;
    }

    // 곡선 없이 완전한 직선(Linear) 보간으로 비행
    const t = p.progress;
    const x = p.startX + (p.targetX - p.startX) * t;
    const y = p.startY + (p.targetY - p.startY) * t;

    if (Math.random() < 0.75) {
      particles.push({
        x: x + (Math.random() * 4 - 2),
        y: y + (Math.random() * 4 - 2),
        vx: -45 + Math.random() * 15,
        vy: -10 + Math.random() * 20,
        radius: p.radius * 0.42,
        life: 0,
        maxLife: 0.14,
        colorCore: p.colorCore,
        colorEdge: p.colorMid
      });
    }

    const grad = ctx.createRadialGradient(x, y, 2, x, y, p.radius * 1.55);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, p.colorCore);
    grad.addColorStop(0.7, p.colorMid);
    grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, p.radius * 1.55, 0, Math.PI * 2);
    ctx.fill();
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
// 8. 플로팅 텍스트 (와우 스타일 데미지 & 골드 보상)
// ==========================================
function spawnFloatingText(text, styleClass, offsetY = 0) {
  const layer = document.getElementById('fct-layer');
  const pos = getTargetPos();
  const el = document.createElement('div');
  el.className = `fct-item ${styleClass}`;
  el.textContent = text;

  let rx = pos.x;
  let ry = pos.y + offsetY;
  let driftX = 0;

  if (styleClass === 'fct-crit') {
    rx = pos.x + (Math.random() * 36 - 18);
    ry = pos.y - 38 + offsetY + (Math.random() * 16 - 8);
    driftX = 0;
  } else if (styleClass === 'fct-dot') {
    const side = Math.random() < 0.5 ? -1 : 1;
    rx = pos.x + side * (18 + Math.random() * 26);
    ry = pos.y - 10 + offsetY + (Math.random() * 18 - 9);
    driftX = side * (10 + Math.random() * 14);
  } else if (styleClass === 'fct-normal') {
    rx = pos.x + (Math.random() * 44 - 22);
    ry = pos.y - 24 + offsetY + (Math.random() * 14 - 7);
    driftX = Math.random() * 24 - 12;
  } else {
    rx = pos.x + (Math.random() * 40 - 20);
    ry = pos.y - 28 + offsetY;
  }

  el.style.left = `${rx}px`;
  el.style.top = `${ry}px`;
  el.style.setProperty('--drift-x', `${driftX.toFixed(1)}px`);
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1200);
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

  checkAndRecordDpsClear();
  updateStageUI();
}

function switchRightTab(tabName) {
  document.getElementById('tab-btn-shop').classList.toggle('active', tabName === 'shop');
  document.getElementById('tab-btn-tree').classList.toggle('active', tabName === 'tree');
  document.getElementById('pane-shop').classList.toggle('active', tabName === 'shop');
  document.getElementById('pane-tree').classList.toggle('active', tabName === 'tree');
  updateNotificationBadges();
}

function onMonsterKilled() {
  const data = getStageData(state.currentStage);
  const isFirstClear = state.currentStage > state.highestClearedStage;
  let totalGold = data.gold;

  if (isFirstClear) {
    state.highestClearedStage = state.currentStage;
    totalGold += data.firstBonus;

    if (data.isPhaseBoss) {
      spawnFloatingText(`👑 보스 격파! 🌟 +1 SP!`, 'fct-proc', -60);
      playSound('proc');
      if (data.phase === 1) {
        switchRightTab('tree');
      }
    } else {
      spawnFloatingText(`🎉 +${fmt(totalGold)} G`, 'fct-gold', -42);
    }
  } else {
    spawnFloatingText(`💰 +${fmt(totalGold)} G`, 'fct-gold', -32);
  }

  state.gold += totalGold;
  playSound('kill');

  const pos = getTargetPos();
  spawnParticles(pos.x, pos.y, 24, '#fde047', '#22c55e', 1.2);

  updateDpsMeterUI();
  if (state.autoAdvance && canAdvanceToNextStage()) {
    loadStage(state.currentStage + 1);
  } else {
    loadStage(state.currentStage);
  }

  saveGame();
  renderShopUI();
  renderSkillTreeUI();
  updateNotificationBadges();
}

// ==========================================
// 10. 데미지 적용 & 연쇄 치명타 / 유성우 판정
// ==========================================
function dealDamage(skillKey, rawDamage, isCrit, canTriggerStreak = true, isDotTick = false) {
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

  if (isDotTick || skillKey === 'ignite') {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-dot', 5);
  } else if (isCrit) {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-crit', -8);
    playSound('crit');
  } else {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-normal', 0);
    playSound('hit');
  }

  if (isCrit && !isDotTick && skillKey !== 'ignite') {
    const golemBonus = (state.skillTree.magma_golem || 0) * 0.15;
    const igniteRatio = (state.grimoires.ignite ? 0.48 : 0.22) * (1 + golemBonus);
    const igniteAdd = dmg * igniteRatio;
    const remainingCarry = state.combat.igniteRem > 0 ? state.combat.ignitePool * (state.combat.igniteRem / 5.0) : 0;
    state.combat.ignitePool = remainingCarry + igniteAdd;
    state.combat.igniteRem = 5.0;

    const rainLv = state.skillTree.meteor_rain || 0;
    if (rainLv > 0 && skillKey !== 'meteor' && Math.random() < rainLv * 0.14) {
      launchMeteorVfx(() => {
        const st = getPlayerStats();
        dealDamage('meteor', st.sp * 1.45 * st.critDmg, true, false);
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
  const totalShots = 1 + multiLv;

  for (let i = 0; i < totalShots; i++) {
    const isMain = i === 0;
    const delayMs = i * 90;
    const lineOffsetY = i === 0 ? 0 : (i % 2 === 1 ? -12 : 12) * Math.ceil(i / 2);

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
        lineOffsetY
      );
    };

    if (delayMs === 0) {
      doLaunch();
    } else {
      setTimeout(doLaunch, delayMs);
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
    return true;
  }

  if (skillKey === 'combustion') {
    if (!state.grimoires.combustion) return false;
    if (c.combustionCdRem > 0) return false;

    c.combustionRem = 8.0;
    c.combustionCdTotal = Math.max(14, 30 * (1 - stats.cdr));
    c.combustionCdRem = c.combustionCdTotal;
    spawnFloatingText('☀️ 마력 폭주!', 'fct-proc', -45);
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
  if (state.grimoires.pyroblast && c.critStreak === 2) {
    triggerSkill('pyroblast');
  }
  if (state.grimoires.fireblast && c.fbCharges > 0) {
    if (!state.grimoires.pyroblast || c.critStreak === 1 || c.fbCharges >= c.fbMaxCharges) {
      triggerSkill('fireblast');
    }
  }
  if (!c.castingSkill && c.gcdRemaining <= 0) {
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

function triggerReadyFlash(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.remove('cd-ready-flash');
  void btn.offsetWidth;
  btn.classList.add('cd-ready-flash');
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

function renderSkillTreeUI() {
  const availSp = getAvailableSkillPoints();
  const spentSp = getSpentSkillPoints();

  document.getElementById('ui-tab-sp-badge').textContent = `${availSp} SP`;
  document.getElementById('ui-tree-sp-box').textContent = `보유: ${availSp} SP`;

  const badgesEl = document.getElementById('summon-active-badges');
  const activeChips = [];
  if (state.skillTree.fire_elem > 0) activeChips.push(`<span class="summon-chip">🔥 정령 Lv.${state.skillTree.fire_elem}</span>`);
  if (state.skillTree.phoenix > 0) activeChips.push(`<span class="summon-chip">🦅 불사조 Lv.${state.skillTree.phoenix}</span>`);
  if (state.skillTree.magma_golem > 0) activeChips.push(`<span class="summon-chip">🗿 골렘 Lv.${state.skillTree.magma_golem}</span>`);
  if (state.skillTree.multishot > 0) activeChips.push(`<span class="summon-chip">✨ ${state.skillTree.multishot + 1}연발</span>`);
  badgesEl.innerHTML = activeChips.join('');

  const container = document.getElementById('skill-tree-container');
  const tiers = [
    { tier: 1, title: 'TIER 1 : 원소 & 환수 소환', req: 0 },
    { tier: 2, title: 'TIER 2 : 전열 골렘 & 다중 탄환', req: 1 },
    { tier: 3, title: 'TIER 3 : 군단 일제사격 & 유성우', req: 3 }
  ];

  container.innerHTML = tiers
    .map((t) => {
      const tierUnlocked = spentSp >= t.req;
      const nodes = SKILL_TREE_NODES.filter((n) => n.tier === t.tier);
      const nodesHtml = nodes
        .map((n) => {
          const lv = state.skillTree[n.id] || 0;
          const isMax = lv >= n.maxLv;
          const canLearn = tierUnlocked && !isMax && availSp >= n.cost;
          return `
            <div class="st-node-card ${lv > 0 ? 'unlocked-node' : ''} ${canLearn ? 'can-learn' : ''} ${!tierUnlocked ? 'locked-tier' : ''}">
              <div class="shop-card-left">
                <div class="st-node-icon">${n.icon}</div>
                <div class="shop-info">
                  <div class="shop-title">
                    <span>${n.name}</span>
                    <span class="shop-lv-tag">${lv} / ${n.maxLv}</span>
                  </div>
                  <div class="shop-desc">${n.desc(lv)}</div>
                </div>
              </div>
              <button class="st-node-btn has-badge-anchor" data-tree-node="${n.id}" ${!canLearn ? 'disabled' : ''}>
                <span>${isMax ? '✔ 마스터' : !tierUnlocked ? `🔒 ${t.req} SP` : `습득 (${n.cost} SP)`}</span>
                <span class="noti-badge ${canLearn ? '' : 'hidden'}">!</span>
              </button>
            </div>
          `;
        })
        .join('');

      return `
        <div class="st-tier-block">
          <div class="st-tier-header">
            <span>${t.title}</span>
            <span>${tierUnlocked ? '🔓' : `🔒 ${t.req} SP`}</span>
          </div>
          <div class="st-nodes-grid">${nodesHtml}</div>
        </div>
      `;
    })
    .join('');

  updateNotificationBadges();
}

function renderShopUI() {
  const weaponBadge = document.getElementById('caster-weapon-icon');
  if (state.items.sunfire_staff > 0) weaponBadge.textContent = '🔱';
  else if (state.items.oak_wand > 0) weaponBadge.textContent = '🪄';
  else weaponBadge.textContent = '';

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

function updateSkillActionBarVisibility() {
  const btn2 = document.getElementById('skill-2');
  const icon2 = document.getElementById('icon-2');
  const charges2 = document.getElementById('charges-2');
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
  if (!state.grimoires.autocast) {
    autoBtn.className = 'auto-cast-btn locked has-badge-anchor';
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
  document.getElementById('ui-phase-num').textContent = `PHASE ${data.phase}`;
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

  document.getElementById('target-stage-tag').textContent = data.isPhaseBoss
    ? `👑 BOSS [P${data.phase}-${data.stepInPhase}]`
    : `STAGE ${data.phase}-${data.stepInPhase}`;

  // 몬스터 이미지와 그 아래 몬스터 이름 표시
  document.getElementById('dummy-emoji').textContent = data.emoji;
  const monsterNameLabel = document.getElementById('monster-name-label');
  monsterNameLabel.textContent = data.isPhaseBoss ? `👑 ${data.name}` : data.name;
  monsterNameLabel.classList.toggle('boss-label', data.isPhaseBoss);

  let rewardText = isCleared
    ? `💰 ${fmt(data.gold)} G`
    : `💰 ${fmt(data.gold + data.firstBonus)} G`;
  if (!isCleared && data.isPhaseBoss) {
    rewardText += ' + 🌟1 SP';
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
// 16. 메인 게임 루프 (60 FPS, 제한 시간 제거)
// ==========================================
let lastTime = performance.now();
let uiRefreshAccum = 0;

function gameLoop(nowMs) {
  const dt = Math.min(0.1, (nowMs - lastTime) / 1000);
  lastTime = nowMs;

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
      c.fbCharges++;
      if (c.fbCharges < c.fbMaxCharges) {
        c.fbRechargeTotal = Math.max(3.5, (9.0 * (1 - stats.cdr)) / stats.speedMult);
        c.fbRechargeRem = c.fbRechargeTotal;
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

  document.getElementById('ui-gold').textContent = fmt(state.gold);
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
    const shouldGlow2 = state.grimoires.pyroblast && c.critStreak === 1 && c.fbCharges > 0;
    document.getElementById('skill-2').classList.toggle('proc-glow', shouldGlow2);
  }

  if (state.grimoires.pyroblast) {
    setRadialSweep(document.getElementById('gcd-3'), c.critStreak === 2 ? 0 : c.gcdRemaining, c.gcdTotal, false);
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

// ==========================================
// 18. 세이브 / 로드 & 이벤트 바인딩
// ==========================================
function saveGame() {
  try {
    const payload = {
      gold: state.gold,
      currentStage: state.currentStage,
      highestClearedStage: state.highestClearedStage,
      dpsClearedStage: state.dpsClearedStage,
      maxDps: state.maxDps,
      autoAdvance: state.autoAdvance,
      autoCast: state.autoCast,
      soundOn: state.soundOn,
      bonusSkillPoints: state.bonusSkillPoints,
      skillTree: state.skillTree,
      grimoires: state.grimoires,
      items: state.items
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
    if (typeof data.currentStage === 'number') state.currentStage = data.currentStage;
    if (typeof data.highestClearedStage === 'number') state.highestClearedStage = data.highestClearedStage;
    if (typeof data.dpsClearedStage === 'number') state.dpsClearedStage = data.dpsClearedStage;
    if (typeof data.maxDps === 'number') state.maxDps = data.maxDps;
    if (typeof data.autoAdvance === 'boolean') state.autoAdvance = data.autoAdvance;
    if (typeof data.autoCast === 'boolean') state.autoCast = data.autoCast;
    if (typeof data.soundOn === 'boolean') state.soundOn = data.soundOn;
    if (typeof data.bonusSkillPoints === 'number') state.bonusSkillPoints = data.bonusSkillPoints;
    if (data.skillTree) Object.assign(state.skillTree, data.skillTree);
    if (data.grimoires) Object.assign(state.grimoires, data.grimoires);
    if (data.items) Object.assign(state.items, data.items);
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
      state.autoAdvance = false;
      document.getElementById('chk-auto-advance').checked = false;
      loadStage(state.currentStage - 1);
      saveGame();
    }
  });

  // 다음 도전 버튼: 반드시 canAdvanceToNextStage() (클리어 완료 + 요구 DPS 충족) 확인!
  document.getElementById('btn-next-stage').addEventListener('click', () => {
    if (canAdvanceToNextStage()) {
      loadStage(state.currentStage + 1);
      saveGame();
    }
  });

  document.getElementById('chk-auto-advance').addEventListener('change', (e) => {
    state.autoAdvance = e.target.checked;
    saveGame();
  });

  document.getElementById('btn-auto-cast').addEventListener('click', () => {
    if (!state.grimoires.autocast) return;
    state.autoCast = !state.autoCast;
    updateSkillActionBarVisibility();
    updateNotificationBadges();
    saveGame();
  });

  document.getElementById('tab-btn-shop').addEventListener('click', () => switchRightTab('shop'));
  document.getElementById('tab-btn-tree').addEventListener('click', () => switchRightTab('tree'));

  document.getElementById('skill-tree-container').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tree-node]');
    if (!btn) return;
    const id = btn.getAttribute('data-tree-node');
    const node = SKILL_TREE_NODES.find((n) => n.id === id);
    if (!node) return;

    const lv = state.skillTree[id] || 0;
    const availSp = getAvailableSkillPoints();
    const spentSp = getSpentSkillPoints();
    if (lv >= node.maxLv || availSp < node.cost || spentSp < node.reqTotalSp) return;

    state.skillTree[id] = lv + 1;
    playSound('proc');
    spawnFloatingText(`🌟 ${node.name} Lv.${lv + 1}!`, 'fct-proc', -42);
    saveGame();
    renderSkillTreeUI();
  });

  document.getElementById('btn-grant-test-sp').addEventListener('click', () => {
    state.bonusSkillPoints = (state.bonusSkillPoints || 0) + 1;
    playSound('proc');
    spawnFloatingText('🌟 +1 SP!', 'fct-proc', -40);
    saveGame();
    renderSkillTreeUI();
  });

  document.getElementById('btn-respec-tree').addEventListener('click', () => {
    for (const k of Object.keys(state.skillTree)) {
      state.skillTree[k] = 0;
    }
    playSound('kill');
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
    playSound('proc');
    spawnFloatingText(`📜 ${g.name}!`, 'fct-proc', -35);
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
    playSound('kill');
    saveGame();
    renderShopUI();
  });

  const soundBtn = document.getElementById('btn-sound');
  soundBtn.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    soundBtn.textContent = state.soundOn ? '🔊 사운드' : '🔇 음소거';
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
  resizeCanvas();
  initEvents();
  document.getElementById('chk-auto-advance').checked = state.autoAdvance;
  document.getElementById('btn-sound').textContent = state.soundOn ? '🔊 사운드' : '🔇 음소거';
  loadStage(state.currentStage);
  renderShopUI();
  renderSkillTreeUI();
  updateNotificationBadges();
  requestAnimationFrame(gameLoop);
});
