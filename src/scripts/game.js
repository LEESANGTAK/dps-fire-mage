/**
 * DPS: Fire Mage - 로그라이크 덱빌딩 스피드런
 * - Stage 1 ~ 20을 몬스터 1회 처치마다 자동 진행하며, 웨이브 클리어 시 마도서 각성 카드 3지선다 선택
 * - 런 단위 성장은 각성 카드 덱이 전담하고, Stage 20 최종 보스 토벌 시간을 스피드런 기록으로 남김
 */

const SAVE_KEY = 'MAGE_SLAYER_STAGE_SAVE_V7';

// 최종 보스 이름은 이곳에서만 정의합니다. 화면 문구(HTML의 .final-boss-name 포함)는 모두 이 값을 따릅니다.
const FINAL_BOSS = { name: tr('이그나르크'), title: tr('잿불의 폭군 이그나르크') };

// ==========================================
// 1. 스테이지 몬스터 데이터베이스 (5스테이지 = 1페이즈)
// ==========================================
const STAGE_MONSTERS = [
  // PHASE 1 (Stage 1 ~ 5)
  { stage: 1, name: tr('초원 풀숲 슬라임'), emoji: '🟢', hp: 500, gold: 4, firstBonus: 2 },
  { stage: 2, name: tr('푸른 늪지 슬라임'), emoji: '🔵', hp: 1050, gold: 7, firstBonus: 4 },
  { stage: 3, name: tr('들판 거대 들쥐'), emoji: '🐀', hp: 1800, gold: 12, firstBonus: 8 },
  { stage: 4, name: tr('고블린 정찰병'), emoji: '👺', hp: 2750, gold: 20, firstBonus: 14 },
  { stage: 5, name: tr('붉은송곳니 군주'), emoji: '🐗', hp: 8200, gold: 35, firstBonus: 35, enrage: 110 },

  // PHASE 2 (Stage 6 ~ 10)
  { stage: 6, name: tr('잿빛 숲 늑대'), emoji: '🐺', hp: 5700, gold: 52, firstBonus: 40 },
  { stage: 7, name: tr('놀 야수사냥꾼'), emoji: '🏹', hp: 7550, gold: 80, firstBonus: 60 },
  { stage: 8, name: tr('폐광 해골 광부'), emoji: '💀', hp: 9350, gold: 125, firstBonus: 90 },
  { stage: 9, name: tr('맹독 모래전갈'), emoji: '🦂', hp: 11800, gold: 190, firstBonus: 140 },
  { stage: 10, name: tr('동굴 오우거 대족장'), emoji: '👹', hp: 28500, gold: 300, firstBonus: 260, enrage: 160 },

  // PHASE 3 (Stage 11 ~ 15)
  { stage: 11, name: tr('화염 비늘 도마뱀'), emoji: '🦎', hp: 18600, gold: 460, firstBonus: 350 },
  { stage: 12, name: tr('심연 흡혈박쥐'), emoji: '🦇', hp: 23000, gold: 700, firstBonus: 500 },
  { stage: 13, name: tr('고대 바위 파수꾼'), emoji: '🗿', hp: 27800, gold: 1050, firstBonus: 800 },
  { stage: 14, name: tr('타락한 어둠마법사'), emoji: '🧙', hp: 33000, gold: 1600, firstBonus: 1200 },
  { stage: 15, name: tr('붉은 화염 비룡'), emoji: '🐉', hp: 75000, gold: 2500, firstBonus: 2200, enrage: 210 },

  // PHASE 4 (Stage 16 ~ 20)
  { stage: 16, name: tr('저주받은 기사단원'), emoji: '⚔️', hp: 54400, gold: 3800, firstBonus: 3000 },
  { stage: 17, name: tr('원한 서린 밴시'), emoji: '👻', hp: 69000, gold: 5800, firstBonus: 4500 },
  { stage: 18, name: tr('지하군주 거대거미'), emoji: '🕷️', hp: 92000, gold: 8800, firstBonus: 7000 },
  { stage: 19, name: tr('심연의 파멸 집행자'), emoji: '👿', hp: 109000, gold: 13500, firstBonus: 11000 },
  { stage: 20, name: FINAL_BOSS.title, emoji: '🔥', hp: 225000, gold: 22000, firstBonus: 25000, enrage: 270 }
];

const FINAL_STAGE = STAGE_MONSTERS.length;

function getStageData(stageNum) {
  const stage = Math.max(1, Math.min(FINAL_STAGE, stageNum));
  const phase = Math.ceil(stage / 5);
  const stepInPhase = ((stage - 1) % 5) + 1;
  const base = STAGE_MONSTERS[stage - 1];
  const isPhaseBoss = stepInPhase === 5;
  // 업화 단계: 체력·광폭화 시간 배율(meta-progression.js의 표). 보스 전용 규칙은 10스테이지 이후 보스에만 적용합니다.
  const mods = getInfernoModifiers(currentInfernoLevel());
  const isLateBoss = isPhaseBoss && stage >= INFERNO_LATE_BOSS_FROM_STAGE;
  return {
    ...base,
    hp: Math.round(base.hp * (isLateBoss ? mods.bossHpMult : mods.hpMult)),
    enrage: base.enrage ? Math.round(base.enrage * (stage >= INFERNO_LATE_BOSS_FROM_STAGE ? mods.enrageMult : 1)) : base.enrage,
    phase,
    stepInPhase,
    isPhaseBoss
  };
}

// state가 만들어지기 전(스크립트 로드 중)에도 안전하게 이번 런의 업화 단계를 읽습니다.
function currentInfernoLevel() {
  try { return state.infernoLevel || 0; } catch (e) { return 0; }
}

// 각성 카드 선택지 수: 보스 웨이브는 항상 3장, 일반 웨이브는 업화 5단계부터 2장.
function getAwakeningChoiceCount(isBossWave) {
  return isBossWave ? 3 : getInfernoModifiers(currentInfernoLevel()).normalChoices;
}

// ==========================================
// 2. 주문 보조 판정
// ==========================================
// 마법사 기본 능력치 (각성 카드 % 보너스의 기준값)
const BASE_SPELL_POWER = 100;
const BASE_CRIT = 5;
const BASE_CRIT_DMG = 1.5;
const CRIT_ROLL_SPREAD = 0.12; // 치명타 피해 흔들림 폭(±12%). 평균은 그대로라 밸런스는 유지하고 숫자만 매번 다르게 터집니다.
const FIREBLAST_RECHARGE = 8.0; // 불꽃 작렬 1회 충전 시간(초)
const IGNITE_DURATION = 5.0; // 화상 지속 시간(초) - 치명타 적중 시 갱신
const FLAME_PATCH_DURATION = 7.0; // 불장판 지속 시간(초)
const IGNITE_TICK = 0.85; // 화상 틱 간격(초)
const IGNITE_RATIO = 0.22; // 치명타 피해 중 화상으로 전환되는 비율

function getCombustionDuration() {
  const deckMult = (state.deckMechanics && state.deckMechanics.combustionGod) ? 2.0 : 1.0;
  return Number((5.0 * deckMult).toFixed(1));
}

// 로그라이크 마도서 각성 (Grimoire Awakening) 덱 관리자
const deckManager = (typeof RoguelikeDeck !== 'undefined') ? RoguelikeDeck.createDeckManager() : null;

// ==========================================
// 3. 게임 상태 (State)
// ==========================================
const state = {
  gold: 0,
  pendingCoinGold: 0,
  currentStage: 1,
  highestClearedStage: 0,
  playTimeSec: 0,
  totalPlayTimeSec: 0,
  totalKills: 0,
  campaignCleared: false,
  bestSpeedrunTime: null,
  bestReachedStage: 0,
  runFailed: false,
  runEndReason: null, // 끝난 런의 사유: 'enrage'(보스 광폭화) · 'abandon'(런 포기)
  // 클리어 후 콘텐츠: 이번 런의 업화 단계, 영구 진행(숙련도·해금·단계별 기록), 이번 런 숙련도 지급 여부
  infernoLevel: 0,
  meta: normalizeMeta(null),
  lockedCards: getLockedCardIds(0),
  runRewarded: false,
  autoCast: true,
  isPaused: false,
  skillAuto: {
    fireball: true,
    fireblast: true,
    combustion: true,
    meteor: true,
    flame_patch: true
  },
  soundOn: true,
  masterVolume: 1.0,
  bgmVolume: 0.2,
  sfxVolume: 0.1,

  // 최근 6초 피해량 기반 실시간 DPS (최고 DPS 기록용)
  currentDps: 0,
  lastCombatTime: 0,

  // 로그라이크 마도서 각성 (Grimoire Awakening) 런 단위 상태
  playerStatsBonus: {},
  deckMechanics: {},
  spellOrder: ['fireball'],

  // 점진적 언폴딩(Unfolding) 해금 상태
  unfolded: {
    combatStats: false,
    hallOfFame: false
  },

  // 각성 카드로 습득하는 주문서
  grimoires: {
    fireblast: false,
    meteor: false,
    combustion: false,
    flame_patch: false
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

    // 타오르는 기운 (Soft Bad-Luck Protection): 4타 연속 비치명타부터 가변 보정(+5~15%)
    pityCritStacks: 0,

    critStreak: 0,
    streakTimer: 0,
    // 열기 2스택 판정 후 두 번째 붉은 숫자가 문양에 닿기 전까지는 메테오 즉시 시전을 보류합니다(인과 순서 연출).
    meteorArmPending: false,
    meteorArmedAge: 0,
    combustionRem: 0,
    fireballCombustionSnapshot: false,

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

    // 충전형 카드: 스테이지 시작마다 다시 채워지는 충전 횟수
    quickdrawCharges: 0,
    meteorCharges: 0,

    // 페이즈 보스 광폭화까지 남은 시간 (일반 몬스터는 null)
    bossEnrageRem: null,

    elemTimer: 0,
    elemRecoil: 0,
    elemSpawnTimer: 0,
    phoenixTimer: 0,
    phoenixRecoil: 0,
    animTime: 0,

    wasOnCd: { 2: false, 3: false, 4: false, 6: false },

    // 스펠 큐: 시전·공통 대기 중에 누른 수동 스킬(화염구·메테오)과 누른 뒤 지난 시간
    queuedSkill: null,
    queuedAge: 0
  },

  dpsHistory: [],
  skillDamage: {
    fireball: { name: tr('🔥 화염구'), dmg: 0, hits: 0, crits: 0, color: '#f97316' },
    fireblast: { name: tr('💥 불꽃 작렬'), dmg: 0, hits: 0, crits: 0, color: '#fbbf24' },
    ignite: { name: tr('🩸 화상 (도트)'), dmg: 0, hits: 0, crits: 0, color: '#ff8000' },
    meteor: { name: tr('☄️ 메테오'), dmg: 0, hits: 0, crits: 0, color: '#a855f7' },
    flame_patch: { name: tr('♨️ 불장판'), dmg: 0, hits: 0, crits: 0, color: '#fb923c' },
    summon_elem: { name: tr('🔥 불의 정령'), dmg: 0, hits: 0, crits: 0, color: '#fb7185' },
    summon_phoenix: { name: tr('🦅 불사조'), dmg: 0, hits: 0, crits: 0, color: '#facc15' }
  },

  // 스피드런 결과창 전투 기록
  stats: {
    peakDps: 0,
    combustionHits: 0,
    combustionPyros: 0
  },

  // 최종 보스(Stage 20) 불의 심장 보호막 상태
  bossGimmick: {
    shield: 0,
    maxShield: 0,
    shieldTimer: 0,
    shieldTriggered: false
  }
};

// ==========================================
// 4. 플레이어 스탯 & 스테이지 진행 판정
// ==========================================
function getPlayerStats() {
  // 각성 카드 스탯은 모두 정수 퍼센트(예: spPct 15 = 주문력 +15%)로 누적됩니다.
  const bonus = state.playerStatsBonus || {};
  let crit = BASE_CRIT + (bonus.crit || 0);
  let haste = bonus.haste || 0;
  const critDmg = BASE_CRIT_DMG + (bonus.critDmg || 0) / 100;

  if (state.combat.combustionRem > 0) {
    crit = 100;
    haste += 20;
  }

  haste = Math.max(-60, haste);
  return {
    sp: BASE_SPELL_POWER * Math.max(0.1, 1 + (bonus.spPct || 0) / 100),
    crit: Math.max(0, Math.min(100, crit)),
    haste,
    critDmg,
    // 재사용 대기 감소율. 업화 단계의 '재사용 대기시간 +N%'는 음수 감소율로 들어옵니다.
    cdr: 1 - getInfernoModifiers(state.infernoLevel || 0).cooldownMult,
    speedMult: 1 + haste / 100,
    burnMult: Math.max(0, 1 + (bonus.burnPct || 0) / 100),
    spiritMult: Math.max(0, 1 + (bonus.spiritPct || 0) / 100)
  };
}

// 큰 수 표기: 한국어는 만·억, 영어는 K·M 단위(i18n.js의 I18N.formatNumber).
function fmt(num) {
  return I18N.formatNumber(num);
}

// ==========================================
// 5. 사운드 매니저 (BGM / SFX 볼륨 개별 조절 & 교차 루프 재생)
// ==========================================
// 효과음 파일 목록. 기존 효과음은 출처 문제로 전부 제거했고(docs/steam-store/sound-sources.md),
// 새 효과음은 키에 경로만 넣으면 기존 호출 지점(playSound·playFireballSfx)에서 바로 재생됩니다.
// 키: fly · explosion · explosion_crit · item_select · drop_coin · meteor_fly · meteor_explosion · swish · monster_destroy · summon_spirit
const FIREBALL_SFX_FILES = {
  // VARCO Sound 유료 플랜 생성(2026-10-26)
  meteor_fly: 'assets/sounds/sfx/meteor_fly.wav',
  meteor_explosion: 'assets/sounds/sfx/meteor_explosion.wav',
  drop_coin: 'assets/sounds/sfx/drop_coin.wav',
  // ElevenLabs Sound Effects API, Starter 유료 플랜 생성(2026-10-28, scripts/generate-sfx.cjs)
  fly: 'assets/sounds/sfx/fireball_whoosh.wav',
  explosion: 'assets/sounds/sfx/fireball_hit.wav',
  explosion_crit: 'assets/sounds/sfx/fireball_hit_crit.wav'
};
// 파일 앞부분 무음을 건너뛰어 입력·적중과 소리 사이의 지연을 없앱니다(초).
const SFX_START_OFFSET = { meteor_explosion: 0.06 };
// meteor_fly.wav가 가장 커지는 지점(초). 낙하가 이보다 짧으므로 이만큼 앞당겨 틀어 착탄 순간에 소리가 정점에 닿게 합니다.
const METEOR_FLY_SFX_PEAK_SEC = 1.4;
// 반복 재생 효과음(지속 피해 연소음, 시전 중 충전음). 비어 있으면 재생하지 않습니다.
const BURNING_LOOP_SFX_FILE = '';
const FIREBALL_CAST_LOOP_SFX_FILE = '';

const preloadedSfx = {};
function createLoopAudio(src, volume) {
  if (!src) return null;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.loop = true;
  audio.volume = volume;
  return audio;
}
const burningLoopAudio = createLoopAudio(BURNING_LOOP_SFX_FILE, 0.55);
const fireballCastAudio = createLoopAudio(FIREBALL_CAST_LOOP_SFX_FILE, 0.58);

const BGM_TRACKS = [
  { title: tr('무거운 왕관 아래에서'), src: 'assets/sounds/bgm/Beneath_the_Heavy_Crown.mp3' },
  { title: tr('도사린 강철'), src: 'assets/sounds/bgm/Iron_Underneath.mp3' },
  { title: tr('구리의 일곱 문'), src: 'assets/sounds/bgm/Seven_Gates_of_Copper.mp3' },
  { title: tr('칼날의 시련'), src: 'assets/sounds/bgm/Trial_by_the_Blade.mp3' },
  { title: tr('심연의 무게'), src: 'assets/sounds/bgm/Weight_of_the_Deep.mp3' }
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

function getEffectiveMasterVol() {
  if (!state.soundOn) return 0;
  return Math.max(0, Math.min(1, typeof state.masterVolume === 'number' ? state.masterVolume : 1.0));
}

function getEffectiveBgmVol() {
  const master = getEffectiveMasterVol();
  if (master <= 0) return 0;
  const bgm = Math.max(0, Math.min(1, typeof state.bgmVolume === 'number' ? state.bgmVolume : 0.2));
  const duckingMult = isBgmBehindWallActive ? 0.35 : 1.0;
  return Math.max(0, Math.min(1, master * bgm * duckingMult));
}

function getEffectiveSfxVol(baseVol = 0.75) {
  const master = getEffectiveMasterVol();
  if (master <= 0) return 0;
  const userSfx = Math.max(0, Math.min(1, typeof state.sfxVolume === 'number' ? state.sfxVolume : 0.1));
  return Math.max(0, Math.min(1, baseVol * userSfx * master));
}

function initBgmAudio() {
  BGM_TRACKS.forEach((track) => {
    const audio = new Audio(track.src);
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = 0.2;
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

// ==========================================
// 마도서 각성 창 진입 시 BGM 공간감 & 벽 뒤(Ducking & Muffled) 효과
// ==========================================
let isBgmBehindWallActive = false;
let bgmFadeRafId = null;

function setBgmBehindWall(enable, smooth = true) {
  isBgmBehindWallActive = enable;
  const targetVol = getEffectiveBgmVol();
  const currentAudio = (currentBgmIndex >= 0 && currentBgmIndex < bgmAudios.length) ? bgmAudios[currentBgmIndex] : null;
  if (!currentAudio) return;

  if (bgmFadeRafId) {
    cancelAnimationFrame(bgmFadeRafId);
    bgmFadeRafId = null;
  }

  if (!smooth) {
    currentAudio.volume = targetVol;
    return;
  }

  const startVol = currentAudio.volume;
  const startTime = performance.now();
  const duration = 350;

  const step = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    currentAudio.volume = startVol + (targetVol - startVol) * progress;
    if (progress < 1) {
      bgmFadeRafId = requestAnimationFrame(step);
    } else {
      currentAudio.volume = targetVol;
      bgmFadeRafId = null;
    }
  };
  bgmFadeRafId = requestAnimationFrame(step);
}

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
  if (!burningLoopAudio) return;
  const effVol = getEffectiveSfxVol(0.68);
  const isDotBurning =
    effVol > 0 && !state.monster.isDying &&
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
  if (!fireballCastAudio) return;
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
    if (SFX_START_OFFSET[kind]) snd.currentTime = SFX_START_OFFSET[kind];
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
  const masterPct = Math.round((typeof state.masterVolume === 'number' ? state.masterVolume : 1.0) * 100);
  const bgmPct = Math.round((typeof state.bgmVolume === 'number' ? state.bgmVolume : 0.2) * 100);
  const sfxPct = Math.round((typeof state.sfxVolume === 'number' ? state.sfxVolume : 0.1) * 100);

  const muteAllBtn = document.getElementById('btn-sound-mute-all');
  if (muteAllBtn) {
    const isMuted = !state.soundOn || masterPct === 0;
    muteAllBtn.textContent = !isMuted ? tr('🔊 켜짐') : tr('🔇 음소거됨');
    muteAllBtn.classList.toggle('muted', isMuted);
  }

  const masterSlider = document.getElementById('slider-master-vol');
  const masterValEl = document.getElementById('ui-master-vol-val');
  if (masterSlider) masterSlider.value = String(masterPct);
  if (masterValEl) masterValEl.textContent = state.soundOn ? `${masterPct}%` : tr('음소거');

  const bgmSlider = document.getElementById('slider-bgm-vol');
  const bgmValEl = document.getElementById('ui-bgm-vol-val');
  if (bgmSlider) bgmSlider.value = String(bgmPct);
  if (bgmValEl) bgmValEl.textContent = state.soundOn ? `${bgmPct}%` : tr('음소거');

  const sfxSlider = document.getElementById('slider-sfx-vol');
  const sfxValEl = document.getElementById('ui-sfx-vol-val');
  if (sfxSlider) sfxSlider.value = String(sfxPct);
  if (sfxValEl) sfxValEl.textContent = state.soundOn ? `${sfxPct}%` : tr('음소거');

  const bgmTrackTitleEl = document.getElementById('ui-bgm-title');
  if (bgmTrackTitleEl) {
    if (currentBgmIndex >= 0 && currentBgmIndex < BGM_TRACKS.length) {
      bgmTrackTitleEl.textContent = `🎲 ${BGM_TRACKS[currentBgmIndex].title}`;
      bgmTrackTitleEl.title = tr('현재 트랙: {title} ({n}/{total})', { title: BGM_TRACKS[currentBgmIndex].title, n: currentBgmIndex + 1, total: BGM_TRACKS.length });
    } else {
      bgmTrackTitleEl.textContent = tr('🎲 랜덤 재생');
    }
  }
}

// ==========================================
// 6. 2D 캔버스 투사체(직선 비행), 메테오 & 소환수 렌더링 엔진
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

// 배우의 발밑(전장 기준 좌표). 배우 자신에게 걸린 피격 흔들림·재등장 팝 같은 CSS 변형은 빼고 잽니다
// (부모 상자의 화면 위치 + 배우의 레이아웃 오프셋). 그래야 새 몬스터가 튀어나오는 도중 시전한
// 메테오 예고 원·불장판도 실제 바닥에 붙고, 피격 때마다 바닥 무늬가 출렁이지 않습니다.
function getActorGroundPos(id) {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const actorEl = document.getElementById(id);
  const parent = actorEl.offsetParent;
  if (parent && typeof parent.getBoundingClientRect === 'function' && typeof actorEl.offsetTop === 'number') {
    const p = parent.getBoundingClientRect();
    const left = p.left + parent.clientLeft + actorEl.offsetLeft - arena.left;
    const top = p.top + parent.clientTop + actorEl.offsetTop - arena.top;
    return { x: left + actorEl.offsetWidth * 0.5, y: top + actorEl.offsetHeight };
  }
  const actor = actorEl.getBoundingClientRect();
  return { x: actor.left - arena.left + actor.width * 0.5, y: actor.bottom - arena.top };
}

function getWandTipPos() {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const mageArt = document.getElementById('mage-art');
  if (mageArt) {
    const artRect = mageArt.getBoundingClientRect();
    // 종이 원화의 release(발사) 포즈 기준 마법봉 보석 머리(끝) 비율:
    // 원화 640x640 중 foot: [320, 1121], tip: [576, 892] -> 캔버스 내 [550, 409] -> X 85.9%, Y 63.9%
    return {
      x: (artRect.left - arena.left) + artRect.width * 0.859,
      y: (artRect.top - arena.top) + artRect.height * 0.639
    };
  }
  const muzzle = document.getElementById('mage-muzzle');
  if (muzzle) {
    const rect = muzzle.getBoundingClientRect();
    return {
      x: rect.left - arena.left,
      y: rect.top - arena.top
    };
  }
  return getCasterCenter();
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
  // 연속 적중과 폭발이 메테오 꼬리와 공유하는 풀을 무제한 채우지 않게 합니다.
  const burstCount = Math.min(count, Math.max(0, 450 - particles.length));
  for (let i = 0; i < burstCount; i++) {
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
// 6-A. 화염구 기본 비주얼 스타일 (단일 일원화)
// ==========================================
const DEFAULT_FIREBALL_STYLE = {
  colorCore: '#fde047',
  colorMid: '#f97316',
  colorEdge: 'rgba(239, 68, 68, 0)',
  ringRgb: '251, 146, 60'
};

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
    colorCore: opts.colorCore || '#ffffff',
    colorMid: opts.colorMid || '#f97316',
    colorEdge: opts.colorEdge || 'rgba(234, 88, 12, 0)',
    ringRgb: opts.ringRgb || '234, 88, 12',
    evoTier: opts.evoTier || 1,
    orbiters: opts.orbiters || 0,
    onHit: opts.onHit
  });
}

function launchProjectile(type, onHitCallback, offsetY = 0, scaleMult = 1.0) {
  // 주 탄환 및 추가 생성된 모든 화염구는 마법봉을 전방으로 뻗는 발사 제스처와 동기화됩니다.
  if (typeof beginMageGesture === 'function') {
    beginMageGesture('fireball');
  }

  // 모든 화염구의 출발점은 항상 마법봉 끝(Wand Tip)으로 고정됩니다.
  const start = getWandTipPos();
  const end = getTargetPos();

  if (scaleMult >= 0.8) {
    playFireballSfx('fly', 0.52);
  }

  // 화염구 기본 크기와 탄속 유지
  const baseRadius = 13.0;

  // 발사 시작점은 마법봉 끝에서 미세한 분산(최대 ±3px)만 부여하여 발 쪽으로 쳐지지 않게 하고,
  // 목표 지점에 offsetY를 주어 마법봉 끝 하나의 원점에서 적을 향해 부채꼴로 뻗어나가는 탄도를 형성합니다.
  const startSpreadY = Math.sign(offsetY) * Math.min(3, Math.abs(offsetY) * 0.15);

  launchCustomProjectile({
    type,
    startX: start.x,
    startY: start.y + startSpreadY,
    targetX: end.x,
    targetY: end.y + offsetY,
    duration: 0.24,
    radius: baseRadius * scaleMult,
    colorCore: DEFAULT_FIREBALL_STYLE.colorCore,
    colorMid: DEFAULT_FIREBALL_STYLE.colorMid,
    colorEdge: DEFAULT_FIREBALL_STYLE.colorEdge,
    ringRgb: DEFAULT_FIREBALL_STYLE.ringRgb,
    evoTier: 1,
    orbiters: 0,
    onHit: onHitCallback
  });
}

function launchMeteorVfx(onImpactCallback, scale = 1.0) {
  const target = getTargetPos();
  const offsetX = scale < 1 ? Math.random() * 40 - 20 : 0;
  const offsetY = scale < 1 ? Math.random() * 24 - 12 : 10;
  const fallDuration = 0.96 * Math.max(0.78, scale);

  // 지면 충돌 예고 원: 몬스터 몸 중앙이 아니라 발밑 바닥에 접지하고, 앞뒤 흔들림도 바닥 비율로 줄입니다.
  groundEffects.push({
    x: target.x + offsetX,
    y: getActorGroundPos('dummy-avatar').y + offsetY * GROUND_TILT,
    radius: 93 * scale,
    life: 0,
    maxLife: fallDuration
  });

  const meteorRadius = 51 * scale;

  // 전장 왼쪽 위 하늘에서 출현해 몬스터에게 비스듬히 떨어집니다(전장 기준 좌표).
  const startX = 64 + offsetX * 0.5;
  const startY = 88;

  const flyAudio = playFireballSfx('meteor_fly', scale >= 0.9 ? 0.82 : 0.6);
  if (flyAudio) {
    try { flyAudio.currentTime = Math.max(0, METEOR_FLY_SFX_PEAK_SEC - fallDuration); } catch (e) {}
  }

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

  // 화염구는 발사 시에만 생성합니다. 시전 중에는 준비 탄환을 그리지 않습니다.
  // 1. 불의 정령
  const elemLv = (state.deckMechanics && state.deckMechanics.spiritCount) || 0;
  if (elemLv > 0) {
    if (c.elemRecoil > 0) c.elemRecoil = Math.max(0, c.elemRecoil - dt * 5);

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

    // 소환된 정령 편대 (최대 4기까지 개별 시각화)
    const spiritCount = Math.min(4, elemLv);
    const spiritConfigs = [
      { ox: 58, oy: -68, phase: 0.0, baseSize: 48, scale: 1.0 },
      { ox: 86, oy: -46, phase: 1.3, baseSize: 40, scale: 0.88 },
      { ox: 36, oy: -96, phase: 2.6, baseSize: 36, scale: 0.80 },
      { ox: 104, oy: -82, phase: 3.9, baseSize: 34, scale: 0.75 }
    ];

    for (let sIdx = 0; sIdx < spiritCount; sIdx++) {
      const cfg = spiritConfigs[sIdx];
      const bobY = Math.sin(c.animTime * 3.5 + cfg.phase) * (6 * cfg.scale);
      const ex = casterCenter.x + cfg.ox + c.elemRecoil * (8 * cfg.scale);
      const ey = casterCenter.y + cfg.oy + bobY;

      ctx.save();
      ctx.translate(ex, ey + spawnOffsetY);
      ctx.scale(scaleX * cfg.scale, scaleY * cfg.scale);
      ctx.globalAlpha = spawnAlpha;

      const auraRadius = Math.round(28 * cfg.scale);
      const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, auraRadius);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.45, '#f97316');
      grad.addColorStop(0.8, 'rgba(239, 68, 68, 0.35)');
      grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // 정령 주변 공전 불씨
      const emberCount = 3 + sIdx;
      for (let i = 0; i < emberCount; i++) {
        const ang = c.animTime * (4 + sIdx * 0.5) + (i * Math.PI * 2) / emberCount;
        const ox = Math.cos(ang) * (20 * cfg.scale);
        const oy = Math.sin(ang) * (11 * cfg.scale);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(ox, oy, 3 * cfg.scale, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = `${Math.round(26 * cfg.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawComicAbility(ctx, 'fire-elemental', 0, 0, Math.round(cfg.baseSize * cfg.scale));

      ctx.restore();
    }
  }

  // 2. 불사조 (불사조의 가호 카드) - 협공 볼트 발사 위치(마법사 어깨 위)에 떠 있음
  if (state.deckMechanics && state.deckMechanics.phoenixAwake) {
    if (c.phoenixRecoil > 0) c.phoenixRecoil = Math.max(0, c.phoenixRecoil - dt * 5);
    const bobX = Math.cos(c.animTime * 2.8) * 5;
    const bobY = Math.sin(c.animTime * 4.2) * 7;
    const px = casterCenter.x + 45 + bobX + c.phoenixRecoil * 10;
    const py = casterCenter.y - 45 + bobY;

    const grad = ctx.createRadialGradient(px, py, 4, px, py, 30);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#facc15');
    grad.addColorStop(0.8, 'rgba(234, 179, 8, 0.3)');
    grad.addColorStop(1, 'rgba(234, 179, 8, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.fill();
    drawComicSummon(ctx, 12, px, py, 42);
  }

  // 3. 불장판: 몬스터 발밑 바닥(#ground-vfx-canvas, 몬스터 뒤 레이어)이 붉게 달아올라 갈라지는 균열 무늬
  if (c.flamePatchRem > 0) {
    const fx = targetCenter.x;
    const fy = getActorGroundPos('dummy-avatar').y; // 실제 접지 위치
    const fadeAlpha = Math.min(1, c.flamePatchRem / 0.6);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 몬스터 몸집에 맞춰 넓혀, 큰 보스도 발밑 양옆으로 균열이 삐져나오게 합니다.
    const artEl = document.getElementById('dummy-emoji');
    const artW = (artEl && artEl.offsetWidth) || 160;
    const patchW = Math.max(220, Math.min(340, artW * 1.4));
    gCtx.save();
    gCtx.globalAlpha = fadeAlpha;
    drawFlamePatchCracks(gCtx, fx, fy, patchW, c.animTime, FLAME_PATCH_DURATION - c.flamePatchRem, reduced);
    gCtx.restore();
    // 불티는 균열 위 한 점에서 피어오릅니다.
    if (!reduced && dt > 0 && particles.length < 180 && Math.random() < Math.min(1, dt * 6)) {
      const p = flamePatchEmberPoint(fx, fy, patchW);
      particles.push({x:p.x,y:p.y,vx:(Math.random()-.5)*18,vy:-45,
        radius:2,life:0,maxLife:.4,colorCore:'#fef08a',colorEdge:'#ea580c'});
    }
  }

  // 4. 충격파 (지면 flat 충격파는 바닥 캔버스에, 공중 충격파는 전면 캔버스에 렌더링)
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
    targetCtx.scale(1, sw.flat ? GROUND_TILT : 0.85);
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
    gCtx.scale(1, GROUND_TILT);
    gCtx.beginPath();
    gCtx.arc(0, 0, g.radius, 0, Math.PI * 2);
    gCtx.strokeStyle = `rgba(251, 191, 36, ${alpha * 0.9})`;
    // 바닥에 칠한 선이라 눕히면 앞뒤(위아래)가 가늘어집니다. 가장 가는 곳도 보이도록 굵기를 넉넉히 둡니다.
    gCtx.lineWidth = 5;
    gCtx.stroke();
    gCtx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.28})`;
    gCtx.fill();
    // 내부 수축 타겟 링 연출
    gCtx.beginPath();
    gCtx.arc(0, 0, g.radius * (1 - prog * 0.65), 0, Math.PI * 2);
    gCtx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.65})`;
    gCtx.lineWidth = 3;
    gCtx.stroke();
    gCtx.restore();
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.progress += dt / p.duration;

    if (p.progress >= 1) {
      // 일반 화염구의 타격은 짧은 불꽃 꽃잎 + 작은 불씨로 유지합니다.
      spawnFireballImpact(particles, p,
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
      spawnParticles(
        p.targetX,
        p.targetY,
        4,
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
      const desiredBurst = reducedMeteor ? 6 : Math.round(30 * m.scale);
      if (particles.length + desiredBurst > 450) {
        let freed = 0;
        // 비행 중인 다른 메테오의 생생한 꼬리는 보호하고, 이미 수명이 많이 지난 파티클을 우선 정리
        for (let pIdx = 0; pIdx < particles.length && freed < desiredBurst; pIdx++) {
          const pt = particles[pIdx];
          const isOld = !pt.meteorTrail || (typeof pt.life === 'number' && typeof pt.maxLife === 'number' && pt.life / pt.maxLife >= 0.55);
          if (isOld) {
            particles.splice(pIdx, 1);
            pIdx--;
            freed++;
          }
        }
      }
      const burstCount = Math.min(desiredBurst, Math.max(0, 450 - particles.length));
      spawnParticles(m.targetX, m.targetY, burstCount, '#ffe4a0', '#e8592f', 1.8 * m.scale);
      if (!reducedMeteor) spawnMeteorRockDebris(m.targetX, m.targetY, m.scale);
      if (!reducedMeteor && shockwaves.length <= 28) {
        shockwaves.push({
          x: m.targetX,
          y: getActorGroundPos('dummy-avatar').y, // 바닥 충격파는 발밑에 접지
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
      playSound('meteor_impact', m.scale >= 1.1 ? 1.06 : 1.0);
      if (m.onImpact) m.onImpact();
      meteors.splice(i, 1);
      continue;
    }

    const pose = getMeteorPose(m);
    emitMeteorTrail(m, pose, meteorDt, particles, reducedMeteor, meteors.length);
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

  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    // 보상 선택 중 운석과 꼬리의 시간축을 함께 멈춰 잔상이 증발하지 않게 합니다.
    const particleDt = pt.meteorTrail ? meteorDt : dt;
    pt.life += particleDt;
    // 음수 life는 방출 대기 시간입니다(소각 경계를 따라 순차적으로 피어오르는 불씨 등).
    if (pt.life < 0) continue;
    if (pt.life >= pt.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * particleDt;
    pt.y += pt.vy * particleDt;
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
    if (pt.meteorTrail) {
      if (typeof drawMeteorParticle === 'function') {
        drawMeteorParticle(ctx, pt, particleDt);
      }
      continue;
    }
    if (pt.fireTrail) {
      drawFireTrail(ctx, pt, dt);
      continue;
    }
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
// 7. 플로팅 텍스트 (와우 스타일 포물선 궤적 & 크리티컬 스케일 펀치)
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
    if (oldest && oldest.heatSigil !== null && oldest.heatSigil !== undefined) {
      setHeatSigilAwaiting(oldest.heatSigil, false);
      if (oldest.heatSigil === 1) armMeteorInstant(false);
    }
    if (oldest && oldest.el) oldest.el.remove();
  }

  const pos = extraOpts.anchor === 'caster' ? getCasterCenter() : getTargetPos();
  const isCrit = styleClass === 'fct-crit';
  const isDot = styleClass === 'fct-dot';
  const isNormal = styleClass === 'fct-normal';
  const isGold = styleClass === 'fct-gold';
  const isBig = Boolean(extraOpts.isBig);

  const heatSigil = isCrit && Number.isInteger(extraOpts.heatSigil) && !prefersReducedMotion() ? extraOpts.heatSigil : null;
  const el = document.createElement('div');
  el.className = `fct-item ${styleClass}${isCrit ? ' crit-flash' : ''}${isCrit && isBig ? ' fct-big-crit' : ''}${heatSigil !== null ? ' fct-heat' : ''}`;
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
    flashed: isCrit,
    heatSigil
  };
  if (heatSigil !== null) {
    // 도착 전까지 대상 문양은 꺼진 상태로 두고, 비행 시간만큼 수명을 늘립니다.
    item.maxLife = HEAT_ABSORB.end;
    setHeatSigilAwaiting(heatSigil, true);
  }

  applyFloatingTextTransform(item);
  layer.appendChild(el);
  floatingTexts.push(item);
  return item;
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
    // proc / gold
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

  if (f.absorbScale !== undefined) scale *= f.absorbScale;

  let opacity = 1.0;
  if (f.heatSigil !== null && f.heatSigil !== undefined) {
    // 문양에 닿기 직전(마지막 15%)에만 살짝 사라져, 흡수 순간 불씨와 자연스럽게 이어집니다.
    const raw = (f.life - HEAT_ABSORB.fly) / (HEAT_ABSORB.end - HEAT_ABSORB.fly);
    opacity = raw > 0.85 ? Math.max(0, 1 - (raw - 0.85) / 0.15) : 1;
  } else if (f.type === 'crit') {
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
// 7-A. 캔디크러시 스타일 골드 동전 곡선 비행 흡수 연출
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
  const sourceEl = document.getElementById('dummy-emoji') || document.getElementById('dummy-avatar');
  const goldPillEl = document.getElementById('pill-gold') || document.getElementById('ui-gold');

  if (!layer || !sourceEl || !goldPillEl) {
    state.pendingCoinGold = 0;
    return;
  }

  // 쓰러진 몬스터의 몸통 한가운데에서 튀어나와 상단 골드 재화로 날아갑니다.
  const startRect = sourceEl.getBoundingClientRect();
  const endRect = goldPillEl.getBoundingClientRect();

  const baseStartX = startRect.left + startRect.width * 0.5;
  const baseStartY = startRect.top + startRect.height * 0.55;
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

    const startX = baseStartX + (Math.random() * 20 - 10);
    const startY = baseStartY + (Math.random() * 16 - 8);

    // 캔디크러시 스타일 3차 베지어 곡선: 몬스터 몸에서 위·양옆으로 톡 튀어 흩어졌다가,
    // 호를 그리며 상단 골드 UI로 빨려 들어갑니다.
    const curveSide = i % 2 === 0 ? -1 : 1;
    const spreadFactor = 1 + (i % 3) * 0.3;
    const cp1X = startX + curveSide * (58 * spreadFactor) + (Math.random() * 24 - 12);
    const cp1Y = startY - 70 - (i % 3) * 22 - Math.random() * 18;

    const cp2X = (startX + endX) * 0.5 + curveSide * (40 * spreadFactor) + (Math.random() * 18 - 9);
    const cp2Y = Math.min(startY, endY) - 24 - (i % 2) * 18;

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
      // 몬스터가 쓰러지는 순간을 본 뒤 하나씩 다다다닥 튀어나옵니다(개수와 상관없이 0.36초 안에 모두 출발).
      delay: 0.08 + i * (0.36 / coinCount),
      life: 0,
      // 몬스터 → 상단 재화까지 먼 거리라 눈으로 따라갈 수 있게 조금 길게, 처치 여운(1.2초) 안에 모두 도착합니다.
      duration: 0.7 + (i % 3) * 0.04,
      share,
      started: false
    });
  }
}

// 광폭화 남은 시간 보상(캔디크러시 Sugar Crush 응용): 보스를 빨리 잡을수록 남은 시간이 골드로 바뀝니다.
// 골드 = 보스 처치 골드 × goldMult × (남은 시간 / 제한 시간). 골드는 각성 카드 다시 뽑기에 쓰이므로, 빨리 잡으면 보스 전설을 고를 기회가 늘어납니다.
// 최종 보스는 런이 끝나 골드를 쓸 곳이 없어 제외합니다.
// 연출 순서(Sugar Crush처럼 먼저 크게 알리고, 그다음 바꿔 준다). 플레이어가 확실히 인지하도록 넉넉한 호흡으로 갑니다:
//   0~1.9초 보스 격파 도장·처치 동전 → 숨 고르기 → bannerMs 축하 배너("대단해요! 번개 같은 처치!")
//   → drainStartMs부터 타이머 조각이 동전으로. 첫 동전은 천천히 하나씩, 간격이 매번 줄어 마지막엔 다다다닥 몰아칩니다.
//   → 마지막 동전이 닿을 때 "+골드" 꼬리표 → endPadMs 뒤 각성 카드 창. 보상이 없으면 평소처럼 1.9초 뒤 카드 창.
const ENRAGE_TIME_BONUS = {
  goldMult: 2,
  secPerChunk: 10, minChunks: 3, maxChunks: 10, // 남은 10초마다 동전 1개(3~10개)
  bannerMs: 2400, drainStartMs: 3600,
  firstGapMs: 450, gapDecay: 0.62, minGapMs: 70, // 동전 출발 간격: 450 → 279 → 173 → 107 → 70 …
  firstFlyMs: 1000, minFlyMs: 550, flyDecay: 0.7, // 첫 동전은 천천히 날고, 뒤로 갈수록 빨리 빨려 들어감
  endPadMs: 900
};

function getTimeBonusChunks(remainingSec) {
  const cfg = ENRAGE_TIME_BONUS;
  return Math.max(cfg.minChunks, Math.min(cfg.maxChunks, Math.ceil((Number(remainingSec) || 0) / cfg.secPerChunk)));
}

// 동전마다 출발 시각과 비행 시간(ms, 처치 기준). 처음엔 느리게 하나씩, 점점 빠르게.
function getTimeBonusSchedule(remainingSec) {
  const cfg = ENRAGE_TIME_BONUS;
  const list = [];
  let at = cfg.drainStartMs;
  for (let i = 0; i < getTimeBonusChunks(remainingSec); i++) {
    const fly = Math.max(cfg.minFlyMs, Math.round(cfg.firstFlyMs * Math.pow(cfg.flyDecay, i)));
    list.push({ at, fly });
    at += Math.max(cfg.minGapMs, Math.round(cfg.firstGapMs * Math.pow(cfg.gapDecay, i)));
  }
  return list;
}

// 마지막 동전이 골드 칸에 닿는 시각(ms, 처치 기준)
function getTimeBonusLandMs(remainingSec) {
  return Math.max(...getTimeBonusSchedule(remainingSec).map((p) => p.at + p.fly));
}

// 보상이 있는 보스전의 처치 여운 길이(ms): 축하 연출이 끝난 뒤 카드 창을 엽니다.
function getTimeBonusBeatMs(remainingSec) {
  return getTimeBonusLandMs(remainingSec) + ENRAGE_TIME_BONUS.endPadMs;
}

function getEnrageTimeBonus(stageNum, remainingSec) {
  const data = getStageData(stageNum);
  if (!data || !data.isPhaseBoss || !data.enrage || stageNum >= FINAL_STAGE) return 0;
  const ratio = Math.max(0, Math.min(1, (Number(remainingSec) || 0) / data.enrage));
  return Math.round(data.gold * ENRAGE_TIME_BONUS.goldMult * ratio);
}

// 남은 타이머가 조각조각 끊겨 나가며(초가 뚝뚝 줄고) 조각마다 동전이 골드 칸으로 날아갑니다. 도착음은 한 음씩 높아집니다.
// 골드 자체는 처치 순간 이미 지급했고, 이 연출은 보여 주기만 합니다(pendingBonusGold로 숫자가 동전 도착에 맞춰 오름).
function spawnEnrageTimeBonus(bonus, remainingSec) {
  const c = state.combat;
  const timer = document.getElementById('boss-enrage-timer');
  if (!(bonus > 0) || !timer) return;
  const cfg = ENRAGE_TIME_BONUS;
  const schedule = getTimeBonusSchedule(remainingSec);
  const chunks = schedule.length;
  const secPerStep = remainingSec / chunks;
  const share = Math.floor(bonus / chunks);
  const landMs = getTimeBonusLandMs(remainingSec);
  state.pendingBonusGold = (state.pendingBonusGold || 0) + bonus;
  c.timeBonusDraining = true; // 처치 순간부터 타이머는 멈춰 보이고, 위험 점멸도 끕니다.
  scheduleKillBeat(() => {
    timer.classList.add('time-bonus');
    showTimeBonusBanner(remainingSec, landMs - cfg.bannerMs + 500);
  }, cfg.bannerMs);
  schedule.forEach((p, i) => {
    scheduleKillBeat(() => {
      c.bossEnrageRem = Math.max(0, remainingSec - secPerStep * (i + 1));
      launchTimeBonusCoin(timer, i === chunks - 1 ? bonus - share * (chunks - 1) : share, 1 + i * 0.07, i, p.fly);
    }, p.at);
  });
  scheduleKillBeat(() => showTimeBonusTag(timer, bonus), landMs);
}

// 축하 배너: 보스 격파 도장이 사라진 뒤 화면 가운데에 묵직하게 찍히고, 색종이가 터집니다. holdMs 뒤 위로 빠지며 사라집니다.
function showTimeBonusBanner(remainingSec, holdMs) {
  const arena = document.getElementById('combat-arena');
  if (!arena || typeof arena.insertAdjacentHTML !== 'function') return;
  const old = arena.querySelector('.time-bonus-banner');
  if (old) old.remove();
  arena.insertAdjacentHTML('beforeend', `<div class="time-bonus-banner" aria-live="polite"><b>${tr('대단해요! 번개 같은 처치!')}</b><span>${tr('남은 {sec}초를 선물로 드려요 🎁', { sec: Math.floor(remainingSec) })}</span></div>`);
  const banner = arena.querySelector('.time-bonus-banner');
  setTimeout(() => banner && banner.classList.add('leaving'), holdMs);
  setTimeout(() => banner && banner.isConnected && banner.remove(), holdMs + 600);
  const pos = getTargetPos();
  spawnParticles(pos.x - 60, pos.y - 90, 26, '#fde047', '#f472b6', 1.2);
  spawnParticles(pos.x + 60, pos.y - 90, 26, '#a7f3d0', '#fb923c', 1.2);
  playSound('proc', 1.1);
  triggerArenaShake('sm');
}

function launchTimeBonusCoin(timer, share, pitch, index, flyMs = 600) {
  const layer = document.getElementById('coin-fx-layer');
  const fill = document.getElementById('boss-enrage-fill');
  const goldPillEl = document.getElementById('pill-gold') || document.getElementById('ui-gold');
  if (!layer || !goldPillEl || typeof document.createElement !== 'function') {
    state.pendingBonusGold = Math.max(0, (state.pendingBonusGold || 0) - share);
    return;
  }
  const from = (fill || timer).getBoundingClientRect();
  const to = goldPillEl.getBoundingClientRect();
  const startX = from.left + from.width; // 막대가 줄어드는 오른쪽 끝에서 튀어나옴
  const startY = from.top + from.height * 0.5;
  const endX = to.left + to.width * 0.5;
  const endY = to.top + to.height * 0.5;
  const el = document.createElement('div');
  el.className = 'flying-gold-coin';
  el.style.opacity = '0';
  layer.appendChild(el);
  const side = index % 2 === 0 ? -1 : 1;
  flyingCoins.push({
    el, startX, startY,
    cp1X: startX + side * 34, cp1Y: startY - 60 - (index % 3) * 14,
    cp2X: (startX + endX) * 0.5 + side * 30, cp2Y: Math.min(startY, endY) - 30,
    endX, endY, delay: 0, life: 0, duration: flyMs / 1000, share, pitch, bonus: true, started: false
  });
  const spark = timer.querySelector('.enrage-track');
  if (spark) {
    spark.classList.remove('bonus-tick');
    void spark.offsetWidth;
    spark.classList.add('bonus-tick');
  }
}

function showTimeBonusTag(timer, bonus) {
  const old = timer.querySelector('.time-bonus-tag');
  if (old) old.remove();
  timer.insertAdjacentHTML('beforeend', `<div class="time-bonus-tag" aria-label="${tr('남은 시간 보너스')}">⏳ +${fmt(bonus)} 🎉</div>`);
  playSound('proc', 1.35);
  const pill = document.getElementById('pill-gold');
  if (pill) {
    pill.classList.remove('time-bonus-pop');
    void pill.offsetWidth;
    pill.classList.add('time-bonus-pop');
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

      if (c.bonus) {
        state.pendingBonusGold = Math.max(0, (state.pendingBonusGold || 0) - c.share);
      } else {
        state.pendingCoinGold = Math.max(0, (state.pendingCoinGold || 0) - c.share);
        if (!flyingCoins.some((f) => !f.bonus)) state.pendingCoinGold = 0;
      }
      triggerGoldPillPulse();
      if (c.pitch && state.soundOn) playFireballSfx('drop_coin', 0.92, c.pitch);
      else playSound('drop_coin');
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

    const rotDeg = rawT * 360;
    c.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) scale(${scale.toFixed(3)}) rotate(${rotDeg.toFixed(1)}deg)`;
  }
}

// 열기 치명타 숫자 흡수 타이밍(초): 도장 찍기(0~0.27) 후 읽을 시간을 주고, 짧게 움츠렸다가 가속하며 문양으로 날아갑니다.
const HEAT_ABSORB = { windup: 0.35, fly: 0.43, end: 0.75 };

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getHeatSigilEl(index) {
  const sigils = document.getElementById('heat-sigils');
  return sigils ? sigils.children[index] || null : null;
}

function setHeatSigilAwaiting(index, on) {
  const sigil = getHeatSigilEl(index);
  if (sigil) sigil.classList.toggle('heat-awaiting', on);
}

// 열기 문양의 중심(전투 영역 좌표). 숨겨져 있으면 null.
function getHeatSigilPos(index) {
  const sigil = getHeatSigilEl(index);
  const arenaEl = document.getElementById('combat-arena');
  if (!sigil || !arenaEl || sigil.offsetParent === null) return null;
  const r = sigil.getBoundingClientRect(), a = arenaEl.getBoundingClientRect();
  return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height / 2 };
}

// 열기 소멸 연출 타이밍(초): 숫자가 도착해 칸이 켜진 모습을 보여준 뒤 식기까지의 숨
const HEAT_EXTINGUISH = { holdAfterArrival: 0.35 };

// 켜져 있던 열기 문양 count칸이 식어 꺼지는 연출(회색으로 부풀며 꺼짐 + 연기).
// 아직 숫자가 날아가는 칸은 숫자가 도착해 잠깐 켜진 뒤 꺼지도록 예약해, '채워짐 → 식음' 순서를 지킵니다.
function extinguishHeatSigils(count) {
  if (!count || typeof document === 'undefined') return;
  for (let i = 0; i < count; i++) {
    // 지금의 열기와 연결된 숫자는 그 칸으로 날아가는 가장 최근 숫자입니다.
    const flying = floatingTexts.findLast((f) => f.heatSigil === i);
    if (flying) {
      flying.extinguishOnArrival = true;
      continue;
    }
    playHeatSigilExtinguish(i);
  }
}

function playHeatSigilExtinguish(index) {
  const sigil = getHeatSigilEl(index);
  if (!sigil) return;
  sigil.classList.remove('heat-hold', 'heat-absorb', 'heat-extinguish');
  if (prefersReducedMotion()) return;
  void sigil.offsetWidth;
  sigil.classList.add('heat-extinguish');
  setTimeout(() => sigil.classList.remove('heat-extinguish'), 600);
  const pos = getHeatSigilPos(index);
  if (pos) spawnParticles(pos.x, pos.y - 4, 6, '#e5e7eb', '#6b7280', 0.45);
}

// 숫자가 문양에 닿는 순간: 문양 점등 + 찌그러졌다 튀는 흡수 반동 + 붉은 불씨
function onHeatSigilAbsorbed(f) {
  setHeatSigilAwaiting(f.heatSigil, false);
  if (f.extinguishOnArrival) {
    // 날아오는 동안 열기가 이미 식었다면: 도착해 잠깐 켜진 모습을 보여준 뒤 식어 꺼집니다.
    const sigil = getHeatSigilEl(f.heatSigil);
    if (sigil) {
      sigil.classList.remove('heat-absorb');
      void sigil.offsetWidth;
      sigil.classList.add('heat-absorb', 'heat-hold');
    }
    const pos = getHeatSigilPos(f.heatSigil);
    if (pos) spawnParticles(pos.x, pos.y, 8, '#ffd0c4', '#ef2b2b', 0.7);
    setTimeout(() => playHeatSigilExtinguish(f.heatSigil), HEAT_EXTINGUISH.holdAfterArrival * 1000);
    return;
  }
  if (f.heatSigil === 1) armMeteorInstant(false);
  const sigil = getHeatSigilEl(f.heatSigil);
  if (sigil) {
    sigil.classList.remove('heat-absorb');
    void sigil.offsetWidth;
    sigil.classList.add('heat-absorb');
  }
  const pos = getHeatSigilPos(f.heatSigil);
  if (pos) spawnParticles(pos.x, pos.y, 8, '#ffd0c4', '#ef2b2b', 0.7);
}

// 머무름 이후의 열기 숫자 위치·크기: 반대 방향으로 살짝 움츠렸다가(예비 동작) 위로 휘는 곡선을 따라 가속 비행
function updateHeatAbsorbMotion(f) {
  if (!f.flyFrom) f.flyFrom = { x: f.x, y: f.y };
  const target = getHeatSigilPos(f.heatSigil) || f.flyTo || f.flyFrom;
  f.flyTo = target;
  const from = f.flyFrom;
  if (f.life < HEAT_ABSORB.fly) {
    const p = (f.life - HEAT_ABSORB.windup) / (HEAT_ABSORB.fly - HEAT_ABSORB.windup);
    const pull = Math.sin(p * Math.PI) * 10;
    const dx = target.x - from.x, dy = target.y - from.y, len = Math.hypot(dx, dy) || 1;
    f.x = from.x - (dx / len) * pull;
    f.y = from.y - (dy / len) * pull;
    f.absorbScale = 1 - 0.12 * Math.sin(p * Math.PI * 0.5);
    return;
  }
  const raw = Math.min(1, (f.life - HEAT_ABSORB.fly) / (HEAT_ABSORB.end - HEAT_ABSORB.fly));
  const t = raw * raw * raw; // 묵직한 가속(ease-in)
  const ctrl = { x: (from.x + target.x) / 2, y: Math.min(from.y, target.y) - 70 };
  const u = 1 - t;
  f.x = u * u * from.x + 2 * u * t * ctrl.x + t * t * target.x;
  f.y = u * u * from.y + 2 * u * t * ctrl.y + t * t * target.y;
  f.absorbScale = 0.88 - 0.6 * t;
}

function updateFloatingTexts(dt) {
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.life += dt;
    if (f.life >= f.maxLife) {
      if (f.heatSigil !== null && f.heatSigil !== undefined) onHeatSigilAbsorbed(f);
      f.el.remove();
      floatingTexts.splice(i, 1);
      continue;
    }

    if (f.heatSigil !== null && f.heatSigil !== undefined && f.life >= HEAT_ABSORB.windup) {
      if (f.flashed) {
        f.flashed = false;
        f.el.classList.remove('crit-flash');
      }
      updateHeatAbsorbMotion(f);
      applyFloatingTextTransform(f);
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
// 7-B. 플레이테스트 텔레메트리 (Playtest Telemetry Logger) 시스템
// ==========================================
const playtestTelemetry = {
  sessionId: 'run_' + Date.now(),
  sessionStartTime: Date.now(),
  stageRecords: [],
  // 처치 시간은 모달 일시정지를 제외한 실제 전투 시간(state.playTimeSec) 기준으로 측정
  currentStageStart: 0,
  currentStageDamage: 0,
  currentStageHits: 0,
  currentStageCrits: 0,
  stageStartStats: null,

  onStageStart(stageNum) {
    this.currentStageStart = state.playTimeSec || 0;
    this.currentStageDamage = 0;
    this.currentStageHits = 0;
    this.currentStageCrits = 0;
    this.stageStartStats = typeof getPlayerStats === 'function' ? { ...getPlayerStats() } : null;
  },

  onDamage(dmg, isCrit) {
    this.currentStageDamage += dmg;
    this.currentStageHits++;
    if (isCrit) this.currentStageCrits++;
  },

  onStageDefeat(stageNum) {
    const elapsedSec = (state.playTimeSec || 0) - this.currentStageStart;
    const stageData = getStageData(stageNum);
    const avgDps = elapsedSec > 0 ? Math.round(this.currentStageDamage / elapsedSec) : 0;
    const critRate = this.currentStageHits > 0
      ? Number(((this.currentStageCrits / this.currentStageHits) * 100).toFixed(1))
      : 0;

    const deckSummary = {};
    if (typeof deckManager !== 'undefined' && deckManager) {
      Object.assign(deckSummary, deckManager.getActiveDeck());
    }

    this.stageRecords.push({
      stage: stageNum,
      name: stageData.name,
      hp: stageData.hp,
      ttkSec: Number(elapsedSec.toFixed(2)),
      avgDps,
      critRate,
      sp: Math.round(this.stageStartStats?.sp || 0),
      crit: Number((this.stageStartStats?.crit || 0).toFixed(1)),
      haste: Number((this.stageStartStats?.haste || 0).toFixed(1)),
      deck: deckSummary
    });
  },

  onRunFailed(stageNum) {
    this.failedStage = stageNum;
  },

  generateReport() {
    const elapsedTotalSec = Math.round((Date.now() - this.sessionStartTime) / 1000);
    const totalMin = Math.floor(elapsedTotalSec / 60);
    const totalSec = elapsedTotalSec % 60;
    const currentStage = (typeof state !== 'undefined' && state.currentStage) || 1;
    const highestStage = (typeof state !== 'undefined' && Math.max(state.highestClearedStage || 0, currentStage)) || currentStage;
    const stats = typeof getPlayerStats === 'function' ? getPlayerStats() : {};
    const deck = (typeof deckManager !== 'undefined' && deckManager) ? deckManager.getActiveDeck() : {};

    let report = `======================================================\n`;
    report += `🔥 DPS: Fire Mage 플레이테스트 밸런스 리포트\n`;
    report += `======================================================\n\n`;
    report += `[📌 세션 요약]\n`;
    report += `- 총 플레이 시간: ${totalMin}분 ${totalSec}초\n`;
    report += `- 현재 스테이지: STAGE ${currentStage} (최고 돌파: STAGE ${highestStage})\n`;
    if (this.failedStage) report += `- 런 결과: STAGE ${this.failedStage} 보스 광폭화로 실패\n`;
    report += `- 최종 보유 골드: ${Math.round(state?.gold || 0).toLocaleString()} G\n`;
    report += `- 최종 스탯: 주문력 ${Math.round(stats.sp || 0)} | 치명타 ${Number((stats.crit || 0).toFixed(1))}% | 가속 ${Number((stats.haste || 0).toFixed(1))}%\n\n`;

    report += `[📊 스테이지별 실측 전투 로그 (TTK & DPS)]\n`;
    report += `단계 | 몬스터 이름           | 몬스터 HP  | 처치 소요시간 | 평균 DPS   | 치명타율\n`;
    report += `-----|-----------------------|------------|---------------|------------|---------\n`;

    if (this.stageRecords.length === 0) {
      report += `(아직 클리어된 스테이지 기록이 없습니다. 몬스터를 처치하면 누적됩니다.)\n`;
    } else {
      this.stageRecords.forEach((r) => {
        const sPad = String(r.stage).padStart(2, ' ');
        const nPad = r.name.padEnd(12, ' ');
        const hpPad = String(r.hp.toLocaleString()).padStart(10, ' ');
        const ttkPad = String(r.ttkSec + 's').padStart(13, ' ');
        const dpsPad = String(r.avgDps.toLocaleString()).padStart(10, ' ');
        const critPad = String(r.critRate + '%').padStart(8, ' ');
        report += `${sPad}   | ${nPad} | ${hpPad} | ${ttkPad} | ${dpsPad} | ${critPad}\n`;
      });
    }

    report += `\n[🃏 최종 보유 각성 카드 덱 목록]\n`;
    const cardEntries = Object.entries(deck);
    if (cardEntries.length === 0) {
      report += `- 보유 카드 없음 (기본 화염구)\n`;
    } else {
      cardEntries.forEach(([cardId, count]) => {
        const cardDef = (typeof RoguelikeDeck !== 'undefined') ? RoguelikeDeck.CARD_POOL.find(c => c.id === cardId) : null;
        const name = cardDef ? cardDef.title : cardId;
        const rarity = cardDef ? cardDef.rarity : 'unknown';
        report += `- [${rarity.toUpperCase()}] ${name}: ${count}장\n`;
      });
    }

    report += `\n[💥 스킬별 누적 피해 점유율]\n`;
    const skillsArr = Object.values(state?.skillDamage || {}).filter(s => s.dmg > 0);
    const totalDmg = skillsArr.reduce((a, b) => a + b.dmg, 0);
    if (totalDmg > 0) {
      skillsArr.sort((a, b) => b.dmg - a.dmg);
      skillsArr.forEach(s => {
        const pct = ((s.dmg / totalDmg) * 100).toFixed(1);
        report += `- ${s.name}: ${Math.round(s.dmg).toLocaleString()} (${pct}%) [${s.hits || 0}타]\n`;
      });
    } else {
      report += `- 기록된 피해량 없음\n`;
    }

    report += `\n[📋 JSON 덤프 (AI 분석용)]\n\`\`\`json\n`;
    report += JSON.stringify({
      sessionStartTime: this.sessionStartTime,
      highestStage,
      gold: state?.gold,
      stats: { sp: stats.sp, crit: stats.crit, haste: stats.haste },
      activeDeck: deck,
      stageRecords: this.stageRecords
    }, null, 2);
    report += `\n\`\`\`\n`;

    return report;
  },

  async copyToClipboard() {
    const report = this.generateReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        const ta = document.createElement('textarea');
        ta.value = report;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (typeof spawnFloatingText === 'function') {
        spawnFloatingText('📋 밸런스 로그가 클립보드에 복사되었습니다!', 'fct-proc', -60, { isBig: true });
      }
      if (typeof showUnfoldToast === 'function') {
        showUnfoldToast('📋 밸런스 로그 복사 완료!', 'AI 에이전트 채팅창에 붙여넣어(Ctrl+V) 밸런스 피드백을 전달해주세요.');
      }
      return true;
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      return false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.playtestTelemetry = playtestTelemetry;
}

// ==========================================
// 8. 스테이지 설정 및 몬스터 처치 처리
// ==========================================
// 연출 호흡(처치 여운·카드 선택 여운) 동안 전투와 스피드런 시계만 멈춥니다. 모달 정지(isPaused)와 달리
// 마법사 호흡·사망 잔상·골드 비행은 계속 흘러, 플레이어가 결과를 눈으로 끝까지 따라갈 수 있습니다.
const KILL_BEAT_MS = { normal: 1200, boss: 1900, final: 2000 };
const ENTRY_BEAT_MS = 500; // 카드 창이 닫힌 뒤 다음 몬스터가 자리 잡을 때까지
let combatHeld = false;
let combatHoldTimer = null;
let killBeatTimers = [];

function isCombatHeld() {
  return combatHeld;
}

// ms를 주면 그 뒤 자동으로 풀리고, 생략하면 releaseCombatHold()까지 유지합니다.
function holdCombat(ms) {
  combatHeld = true;
  if (combatHoldTimer) clearTimeout(combatHoldTimer);
  combatHoldTimer = typeof ms === 'number' ? setTimeout(releaseCombatHold, ms) : null;
}

function releaseCombatHold() {
  combatHeld = false;
  if (combatHoldTimer) clearTimeout(combatHoldTimer);
  combatHoldTimer = null;
}

function scheduleKillBeat(fn, ms) {
  const id = setTimeout(() => {
    killBeatTimers = killBeatTimers.filter((t) => t !== id);
    fn();
  }, ms);
  killBeatTimers.push(id);
}

function cancelKillBeat() {
  killBeatTimers.forEach((id) => clearTimeout(id));
  killBeatTimers = [];
  releaseCombatHold();
}

// 처치 순간 시전 중이던 주문을 거둬, 마법사가 빈 자리에 헛손질하지 않고 숨을 고르게 합니다.
function settleMageForKillBeat() {
  const c = state.combat;
  c.castingSkill = null;
  c.castRemaining = 0;
  if (typeof clearQueuedSkill === 'function') clearQueuedSkill();
  updateCastingLoopSound();
}

// 스테이지 돌파 도장: 처치 직후 한 번 '쾅' 찍혀 이번 승리를 감정적으로 매듭짓습니다.
function spawnStageClearStamp(stageNum, isBoss) {
  const arena = document.getElementById('combat-arena');
  if (!arena || typeof arena.insertAdjacentHTML !== 'function') return;
  const old = arena.querySelector('.clear-stamp');
  if (old) old.remove();
  const phase = Math.floor((stageNum - 1) / 5) + 1;
  const wave = ((stageNum - 1) % 5) + 1;
  const text = isBoss ? tr('👑 보스 격파!') : tr('STAGE {phase}-{wave} 돌파!', { phase, wave });
  arena.insertAdjacentHTML('beforeend', `<div class="clear-stamp${isBoss ? ' boss' : ''}" aria-hidden="true"><span>${text}</span></div>`);
  const stamp = arena.querySelector('.clear-stamp');
  if (!stamp) return;
  stamp.addEventListener('animationend', () => stamp.remove(), { once: true });
  setTimeout(() => stamp.isConnected && stamp.remove(), isBoss ? 2200 : 1600);
}
// 모든 주문의 재사용 대기시간을 비우고 불꽃 작렬 충전을 가득 채웁니다. 대기 중이던 버튼만 준비 완료 번쩍임을 보여줍니다.
function resetSpellCooldowns() {
  const c = state.combat;
  if (c.fbCharges < c.fbMaxCharges) triggerReadyFlash('skill-2');
  c.fbCharges = c.fbMaxCharges;
  c.fbRechargeRem = 0;
  for (const [key, slot] of [['meteorCdRem', 3], ['combustionCdRem', 4], ['flamePatchCdRem', 6]]) {
    if (c[key] > 0) triggerReadyFlash(`skill-${slot}`);
    c[key] = 0;
    c.wasOnCd[slot] = false;
  }
}

function loadStage(stageNum) {
  state.currentStage = Math.max(1, Math.min(FINAL_STAGE, stageNum));
  playtestTelemetry.onStageStart(state.currentStage);
  const data = getStageData(state.currentStage);
  if (arenaEnvironment) arenaEnvironment.setStage(state.currentStage);
  state.monster.maxHp = data.hp;
  state.monster.hp = data.hp;
  state.monster.isDying = false;
  resetHpTrailUI();
  // 사망 잔상 동안 숨겨 둔 원본 몬스터를 새 스테이지 몬스터로 다시 노출합니다.
  const dummyAvatar = document.getElementById('dummy-avatar');
  if (dummyAvatar && dummyAvatar.dataset) delete dummyAvatar.dataset.dead;
  if (data.isPhaseBoss) {
    state.currentBossFightStartTime = performance.now() / 1000;
  } else {
    state.currentBossFightStartTime = null;
  }

  // 들불(전설): 쓰러진 적에게 남은 화상이 사라지지 않고 다음 적에게 번집니다.
  const carriesIgnite = !!(state.deckMechanics && state.deckMechanics.igniteCarryOver) && state.combat.ignitePool >= 5;
  if (carriesIgnite) {
    state.combat.igniteRem = IGNITE_DURATION;
    state.combat.igniteTickTimer = 0;
    spawnFloatingText(tr('🌋 들불이 번집니다!'), 'fct-proc', -55);
  } else {
    state.combat.ignitePool = 0;
    state.combat.igniteRem = 0;
  }
  state.combat.meteorBurnRem = 0;
  state.combat.lastFireballCritAt = null; // 불꽃 심판 판정은 스테이지 안에서만
  // 불꽃 심판: 준비된 채 스테이지가 시작되면 지금부터 duration초(전투 시간 기준, 연출·카드 선택 중엔 멈춤) 동안 치명 피해 증가
  const verdictCfg = state.deckMechanics && state.deckMechanics.emberVerdict;
  state.combat.verdictBurstUntil = 0;
  if (verdictCfg && state.combat.verdictArmed) {
    state.combat.verdictArmed = false;
    state.combat.verdictBurstUntil = (state.playTimeSec || 0) + verdictCfg.duration;
    addRunStat('verdictHits', 1);
    showEmberVerdictBurst(getEmberVerdictMult());
  }
  updateBurningLoopSound();

  // 새 적마다 주문 재사용 대기시간과 불꽃 작렬 충전을 처음부터 시작합니다.
  resetSpellCooldowns();

  // 충전형 카드: 스테이지 시작마다 충전 횟수를 다시 채움
  const mech = state.deckMechanics || {};
  state.combat.quickdrawCharges = mech.quickdrawCharges || 0;
  state.combat.meteorCharges = mech.meteorCharges || 0;

  // 페이즈 보스 광폭화 제한 시간
  state.combat.bossEnrageRem = data.isPhaseBoss ? data.enrage : null;
  state.combat.enrageIntroChecked = false;
  state.combat.timeBonusDraining = false;
  state.pendingBonusGold = 0; // 연출이 끊겨도(새로고침·타이틀) 다음 스테이지 골드 표시가 어긋나지 않게
  const enrageTimerEl = document.getElementById('boss-enrage-timer');
  if (enrageTimerEl) {
    enrageTimerEl.classList.remove('time-bonus');
    const tag = enrageTimerEl.querySelector && enrageTimerEl.querySelector('.time-bonus-tag');
    if (tag) tag.remove();
  }
  state.bestReachedStage = Math.max(state.bestReachedStage || 0, state.currentStage);

  // 최종 보스 불의 심장 보호막 상태 초기화
  state.bossGimmick = {
    shield: 0,
    maxShield: 0,
    shieldTimer: 0,
    shieldTriggered: false
  };

  updateStageUI();
}

function respawnMonsterPop() {
  const dummyEl = document.getElementById('dummy-avatar');
  if (!dummyEl) return;
  dummyEl.className = 'dummy-avatar';
  void dummyEl.offsetWidth;
  dummyEl.classList.add('respawn-pop');
  const dummyEmoji = document.getElementById('dummy-emoji');
  if (dummyEmoji) dummyEmoji.className = 'dummy-emoji';
}

function onMonsterKilled() {
  if (state.monster.isDying) return;
  state.monster.isDying = true;

  const data = getStageData(state.currentStage);
  const isFirstClear = state.currentStage > state.highestClearedStage;
  const isFinalBossKill = state.currentStage === FINAL_STAGE;
  const isFirstFinalBossKill = isFinalBossKill && !state.campaignCleared;
  let totalGold = data.gold;

  state.totalKills = (state.totalKills || 0) + 1;
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
        // 보스 토벌 신기록 경신 연출 (단축 축하 팡파르)
        spawnFloatingText(tr('⚡ 보스 기록 단축! -{diff}초 ({dur}s)', { diff: diff.toFixed(2), dur: duration.toFixed(2) }), 'fct-crit', -70, { isBig: true });
        triggerSpeedrunRecordFlash();
        playSound('proc', 1.25);
      }
    } else {
      if (!state.bossClearTimes) state.bossClearTimes = {};
      state.bossClearTimes[state.currentStage] = duration;
      state.stats.lastBossKillDiff = null;
    }
  }

  if (isFirstClear) {
    state.highestClearedStage = state.currentStage;
    totalGold += data.firstBonus;
  }

  // 광폭화 남은 시간 보상: 지급은 지금, 연출은 처치 여운 동안(spawnEnrageTimeBonus)
  const timeBonusRemaining = data.isPhaseBoss ? Math.max(0, state.combat.bossEnrageRem || 0) : 0;
  const timeBonus = getEnrageTimeBonus(state.currentStage, timeBonusRemaining);
  if (timeBonus > 0) {
    state.gold += timeBonus;
    addRunStat('timeBonusGold', timeBonus);
  }

  state.gold += totalGold;

  if (isFinalBossKill) {
    state.campaignCleared = true;
    awardRunMastery(true);
    const curTime = state.playTimeSec || 0;
    state.stats = state.stats || {};
    state.stats.lastSpeedrunTime = curTime;
    const prevBest = state.bestSpeedrunTime || null;
    state.stats.prevBestSpeedrunTime = prevBest;
    const isNewRecord = !prevBest || curTime < prevBest;
    state.stats.isNewSpeedrunRecord = isNewRecord;
    if (isNewRecord) {
      state.bestSpeedrunTime = curTime;
      state.meta.bestTimes[state.infernoLevel] = curTime;
      triggerSpeedrunRecordFlash();
      spawnFloatingText(tr('🏆 {boss} 스피드런 신기록! ({time})', { boss: FINAL_BOSS.name, time: formatSpeedrunTime(curTime) }), 'fct-crit', -90, { isBig: true });
    }
  }

  // 처치 여운: 전투·시계를 멈추고 사망 연출 → 돌파 도장 → 골드 흡수 → 보상 창 순으로 한 박자씩 보여 줍니다.
  holdCombat();
  settleMageForKillBeat();
  checkAndTriggerUnfolds(false);
  scheduleKillBeat(() => {
    spawnStageClearStamp(state.currentStage, data.isPhaseBoss);
    if (data.isPhaseBoss) playSound('proc');
  }, 140);

  // 골드는 쓰러진 몬스터에서 튀어나와 상단 골드 재화(#pill-gold)로 곡선 비행 흡수!
  spawnGoldCoinFlight(totalGold, isFirstClear || data.isPhaseBoss);
  spawnEnrageTimeBonus(timeBonus, timeBonusRemaining);

  const pos = getTargetPos();
  // 재질에 맞는 사망 여운. 생물까지 유리처럼 조각내지 않습니다.
  spawnMaterialDeath(state.currentStage, data.isPhaseBoss);
  if (data.isPhaseBoss) {
    triggerArenaShake('lg');
  } else {
    triggerArenaShake('sm'); // 일반 몬스터 토벌 시에도 경쾌한 마이크로 셰이크
  }

  // 몬스터 처치 파열 효과음 및 화염 파열 파티클 방출
  playSound('monster_destroy', data.isPhaseBoss ? 0.9 : 1.05);
  spawnParticles(pos.x, pos.y, data.isPhaseBoss ? 28 : 16, '#ffedd5', '#ea580c', data.isPhaseBoss ? 1.6 : 1.3);

  // 처치 순간 미세 히트스탑 (타격 손맛)
  mageGesture.hitStop = data.isPhaseBoss ? 0.08 : 0.04;

  playtestTelemetry.onStageDefeat(state.currentStage);

  if (isFinalBossKill) {
    // 최종 보스 대폭발 & 드라마틱 여운: 결과창 전까지 소각 잔상이 멈추지 않고 끝까지 타오르게 합니다.
    playSound('proc');
    spawnFloatingText(
      isFirstFinalBossKill ? tr('👑 {boss} 최초 토벌!', { boss: FINAL_BOSS.title }) : tr('👑 {boss} 토벌 완료!', { boss: FINAL_BOSS.title }),
      'fct-crit',
      -60,
      { isBig: true }
    );

    scheduleKillBeat(() => {
      state.isPaused = true;
      releaseCombatHold();
      openVictoryModal(isFirstFinalBossKill);
    }, KILL_BEAT_MS.final);

    saveGame();
    return;
  }

  // 웨이브 클리어 ➔ 사망·골드 여운(보스는 더 길게) ➔ 마도서 각성 3지선다
  // 남은 시간 보상이 있으면 축하 연출이 끝날 때까지 카드 창을 늦춥니다.
  const beatMs = timeBonus > 0 ? getTimeBonusBeatMs(timeBonusRemaining) : (data.isPhaseBoss ? KILL_BEAT_MS.boss : KILL_BEAT_MS.normal);
  const clearedStage = state.currentStage;
  scheduleKillBeat(() => {
    triggerAwakeningSelection(clearedStage, data.isPhaseBoss, () => {
      loadStage(clearedStage + 1);
      respawnMonsterPop();
      saveGame();
    });
  }, beatMs);
  saveGame();
}

// ==========================================
// 9. 데미지 적용 & 연쇄 치명타(몰아치는 열기) 판정
// ==========================================
let lastHeavyKnockbackTime = 0;
let hitDirectionCounter = 0;
let lastDotShiverTime = 0;

// 치명타 한 방마다 피해 배율을 1 ± CRIT_ROLL_SPREAD 안에서 고르게 뽑습니다.
function rollCritVariance() {
  return 1 + (Math.random() * 2 - 1) * CRIT_ROLL_SPREAD;
}

function dealDamage(skillKey, rawDamage, isCrit, canTriggerStreak = true, isDotTick = false, isCombustionCast = false) {
  // 치명타 직격만 흔듭니다. 화상 같은 지속 피해 틱은 일정한 리듬을 유지합니다.
  if (isCrit && !isDotTick) rawDamage *= rollCritVariance();
  // 로그라이크 덱: 불꽃 심판 — 지난 스테이지 처치 직전 화염구 치명타가 있었으면, 이번 스테이지 첫 duration초 동안
  // 모든 직격 치명타 피해 +critBonus(보스 +bossCritBonus). 화상 같은 지속 피해는 제외합니다.
  const verdict = state.deckMechanics && state.deckMechanics.emberVerdict;
  if (verdict && isCrit && !isDotTick && (state.playTimeSec || 0) < (state.combat.verdictBurstUntil || 0)) {
    rawDamage *= getEmberVerdictMult();
  }
  const isCombustingEffective = Boolean((state.combat && state.combat.combustionRem > 0) || isCombustionCast);

  // 3-1. 최종 보스(Stage 20) 전용 기믹 판정
  // (일반 몬스터 및 중간 보스 기믹은 로그라이크 덱빌딩 코어 루프와 스피드런 집중을 위해 전면 배제)
  const bg = state.bossGimmick;
  if (state.currentStage === FINAL_STAGE && bg && bg.shield > 0) {
    // Phase 4 최종 보스: 불의 심장 보호막 우선 흡수
    bg.shield -= Math.round(rawDamage);
    if (bg.shield <= 0) {
      bg.shield = 0;
      bg.shieldTimer = 0;
      triggerArenaShake('lg');
      playSound('meteor_impact');
      spawnFloatingText(tr('💥 불의 심장 파괴! 화염 역류!'), 'fct-crit', -50, { isBig: true });
      rawDamage *= 1.5;
    }
  }

  // 로그라이크 덱: 진홍의 마력 폭주 (발화 중 모든 공격 피해 150% 증폭 = 2.5배)
  if (isCombustingEffective && state.deckMechanics && state.deckMechanics.combustionGod) {
    rawDamage *= 2.5;
  }

  // 로그라이크 덱: 잿더미 군단장 (소환수 1기당 마법사 주문 피해량 +30% 증폭)
  if (state.deckMechanics && state.deckMechanics.cinderLord) {
    let activeMinions = state.deckMechanics.spiritCount || 0;
    if (state.deckMechanics.phoenixAwake) {
      activeMinions += 1;
    }
    if (activeMinions > 0) {
      rawDamage *= (1 + activeMinions * 0.3);
    }
  }

  // 로그라이크 덱: 처형인의 불꽃 (적 체력 40% 이하 시 모든 피해량 +70% 증폭)
  if (state.deckMechanics && state.deckMechanics.executionerMult) {
    const execMult = state.deckMechanics.executionerMult;
    if (state.monster && state.monster.maxHp > 0 && (state.monster.hp / state.monster.maxHp) <= 0.4) {
      rawDamage *= (1 + execMult);
    }
  }

  const dmg = Math.max(1, Math.round(rawDamage));
  if (isCrit && !isDotTick && canTriggerStreak) mageGesture.hitStop = 0.03;
  const now = performance.now() / 1000;
  const willKill = state.monster.hp - dmg <= 0;

  state.lastCombatTime = now;
  state.dpsHistory.push({ time: now, amount: dmg });
  playtestTelemetry.onDamage(dmg, isCrit);

  // 스피드런 결과창 전투 기록 (발화 타격 수는 효과음 피치 빌드업에도 사용)
  if (!state.stats) state.stats = {};
  if (isCombustingEffective) {
    state.stats.combustionHits = (state.stats.combustionHits || 0) + 1;
  }

  if (state.skillDamage[skillKey]) {
    state.skillDamage[skillKey].dmg += dmg;
    state.skillDamage[skillKey].hits = (state.skillDamage[skillKey].hits || 0) + 1;
    if (isCrit) {
      state.skillDamage[skillKey].crits = (state.skillDamage[skillKey].crits || 0) + 1;
    }
  }

  // 최근 6초 피해량으로 실시간 DPS와 최고 DPS 기록 갱신
  const windowSec = 6.0;
  const sumDmg = state.dpsHistory
    .filter((entry) => now - entry.time <= windowSec)
    .reduce((acc, e) => acc + e.amount, 0);
  state.currentDps = Math.round(sumDmg / windowSec);
  if (state.currentDps > (state.stats.peakDps || 0)) {
    state.stats.peakDps = state.currentDps;
  }

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
      'hit-fireblast', 'knockback-pyro', 'knockback-meteor', 'burn-shiver', 'respawn-pop'
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

  let heatTextItem = null;
  if (isDotTick || skillKey === 'ignite') {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-dot', 5);
  } else if (isCrit) {
    // 몰아치는 열기를 채우는 치명타(0→1, 1→2)는 붉은 숫자로 띄운 뒤 해당 열기 문양으로 빨려 들어갑니다.
    // 열기 판정 자체는 아래에서 즉시 갱신하고, 문양의 점등만 숫자가 도착할 때까지 미룹니다(연출 전용).
    const heatSigil = canTriggerStreak && state.grimoires.meteor && state.combat.critStreak < 2 ? state.combat.critStreak : null;
    heatTextItem = spawnFloatingText(`${fmt(dmg)}`, 'fct-crit', -8, { isBig: isBigSkill, heatSigil });
    if (!isDotTick && skillKey !== 'meteor') {
      // 연속 치명타(몰아치는 열기) 콤보 피치 빌드업:
      // 1타 크리: 1.0 (예열) ➔ 2타 크리: 1.15 (몰열 완성 쾌감)
      const streakPitch = (state.combat && state.combat.critStreak >= 1) ? 1.15 : 1.0;
      playSound('crit', streakPitch);
    }
    if (isCombustingEffective) {
      spawnParticles(targetPos.x, targetPos.y, 12, '#fef08a', '#ea580c', 1.6);
    }
  } else {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-normal', 0);
    if (skillKey !== 'meteor') {
      // 반복 타격 피로도를 줄이기 위한 미세한 피치 변조 (0.97~1.03)
      playSound('hit', 0.97 + Math.random() * 0.06);
    }
  }

  // 들불(전설): 치명타가 아닌 적중도 기본 비율로 화상을 남깁니다.
  const igniteOnAllHits = !!(state.deckMechanics && state.deckMechanics.igniteOnAllHits);
  if (!isCrit && igniteOnAllHits && !isDotTick && skillKey !== 'ignite') {
    state.combat.ignitePool += dmg * IGNITE_RATIO;
    state.combat.igniteRem = IGNITE_DURATION;
  }

  if (isCrit && !isDotTick && skillKey !== 'ignite') {
    // 화상은 '남은 피해량' 풀: 치명타마다 피해의 일정 비율이 더해지고 지속 시간이 갱신되며, 틱마다 나눠 소모됩니다.
    const igniteRatioMult = (state.deckMechanics && state.deckMechanics.igniteRatioMult) || 1;
    state.combat.ignitePool += dmg * IGNITE_RATIO * igniteRatioMult;
    state.combat.igniteRem = IGNITE_DURATION;

    // 로그라이크 덱: 불사조의 가호 (치명타 시 10% 확률로 전 스킬 쿨다운 즉시 리셋)
    if (state.deckMechanics && (state.deckMechanics.phoenixReset || state.deckMechanics.phoenix_reset) && Math.random() < 0.1) {
      resetSpellCooldowns();
      spawnFloatingText(tr('🪶 불사조의 가호! 전 스킬 쿨다운 초기화!'), 'fct-proc', -55, { isBig: true, anchor: 'caster' });
      playSound('proc');
    }
  }

  // 타오르는 기운 (Soft Bad-Luck Protection): 메인 화염구의 연속 비치명타 스택 갱신 및 치명타 시 즉시 리셋
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
        maybeShowFireblastHint();
      } else if (state.combat.critStreak === 1) {
        state.combat.critStreak = 2;
        state.combat.streakTimer = 12.0;
        // 열기 판정은 지금 확정하되, 두 번째 붉은 숫자가 문양에 닿을 때 '메테오 준비'를 켭니다.
        if (heatTextItem && heatTextItem.heatSigil === 1) {
          state.combat.meteorArmPending = true;
        } else {
          state.combat.meteorArmPending = true;
          armMeteorInstant(true);
        }
      }
    } else if (skillKey === 'fireball') {
      if (state.combat.critStreak === 1) {
        state.combat.critStreak = 0;
        addRunStat('heatCooled', 1);
        // 규칙: 열기 1칸에서 치명타가 아닌 화염구가 꽂히면 열기가 식습니다. 그 순간을 문양에서 보여줍니다.
        extinguishHeatSigils(1);
      }
    }
  }

  // 불꽃 심판: 화염구 치명타 시각을 기억해 두고, 막타가 그로부터 window초 안이면 준비합니다(막타가 화상·정령이어도).
  if (verdict && skillKey === 'fireball' && isCrit && !isDotTick) state.combat.lastFireballCritAt = state.playTimeSec || 0;
  state.monster.hp = Math.max(0, state.monster.hp - dmg);
  if (state.monster.hp <= 0 && !state.monster.isDying) {
    const sinceCrit = (state.playTimeSec || 0) - (state.combat.lastFireballCritAt ?? -Infinity);
    if (verdict && sinceCrit <= verdict.window) state.combat.verdictArmed = true;
    onMonsterKilled();
  }
}

// ==========================================
// 10. 소환수 공격 및 스폰 연출 로직
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
  const lv = (state.deckMechanics && state.deckMechanics.spiritCount) || 0;
  if (lv <= 0) return;
  const casterCenter = getCasterCenter();
  const target = getTargetPos();
  state.combat.elemRecoil = 1.0;

  const spiritConfigs = [
    { ox: 58, oy: -68 },
    { ox: 86, oy: -46 },
    { ox: 36, oy: -96 },
    { ox: 104, oy: -82 }
  ];
  const count = Math.min(4, lv);

  for (let i = 0; i < count; i++) {
    const cfg = spiritConfigs[i];
    const delay = i * 0.05;
    setTimeout(() => {
      launchCustomProjectile({
        type: 'elem_bolt',
        startX: casterCenter.x + cfg.ox,
        startY: casterCenter.y + cfg.oy,
        targetX: target.x,
        targetY: target.y,
        duration: 0.24,
        radius: 8,
        colorCore: '#fef08a',
        colorMid: '#fb7185',
        onHit: () => {
          const st = getPlayerStats();
          const isCrit = Math.random() * 100 < st.crit;
          const totalBase = st.sp * (0.45 * lv) * st.spiritMult;
          const hitBase = totalBase / count;
          const finalDmg = isCrit ? hitBase * st.critDmg : hitBase;
          dealDamage('summon_elem', finalDmg, isCrit, false);
        }
      });
    }, delay * 1000);
  }
}

function firePhoenixAttack() {
  if (!(state.deckMechanics && state.deckMechanics.phoenixAwake)) return;
  const casterCenter = getCasterCenter();
  const target = getTargetPos();
  state.combat.phoenixRecoil = 1.0;

  launchCustomProjectile({
    type: 'phoenix_bolt',
    startX: casterCenter.x + 45,
    startY: casterCenter.y - 45,
    targetX: target.x,
    targetY: target.y,
    duration: 0.26,
    radius: 12,
    colorCore: '#ffffff',
    colorMid: '#facc15',
    onHit: () => {
      const st = getPlayerStats();
      const dmg = st.sp * 0.65 * st.critDmg * st.spiritMult;
      dealDamage('summon_phoenix', dmg, true, true);
    }
  });
}

// ==========================================
// 11. 마법사 스킬 시전 로직
// ==========================================
function fireSpellProjectile(type, baseMult, isCombustingSnapshot = false) {
  const isCombustingAtLaunch = Boolean(isCombustingSnapshot || (state.combat && state.combat.combustionRem > 0));

  launchProjectile(type, () => {
    const st = getPlayerStats();
    const isCombustEffective = Boolean(isCombustingAtLaunch || (state.combat && state.combat.combustionRem > 0));
    // 타오르는 기운 (Soft Bad-Luck Protection): 1~3타는 순수 치명타율(0%), 4타 이상 연속 비치명타부터 5~15% 가변 난수 보정
    const pityBonus = (state.combat.pityCritStacks || 0) >= 4
      ? (5 + Math.random() * 10)
      : 0;
    const effectiveCrit = isCombustEffective ? 100 : Math.min(100, st.crit + pityBonus);
    // 메테오를 처음 배운 런: 열기 2칸이 한 번 완성될 때까지 화염구는 치명타로 꽂혀 연계를 직접 보여 줍니다.
    const heatTutorialCrit = type === 'fireball' && state.heatTutorial && state.grimoires.meteor;
    const isCrit = heatTutorialCrit || effectiveCrit >= 100 || Math.random() * 100 < effectiveCrit;
    const base = st.sp * baseMult;
    const finalDmg = isCrit ? base * st.critDmg : base;
    dealDamage(type, finalDmg, isCrit, true, false, isCombustEffective);

    // 로그라이크 덱: 분열 화염구 메커니즘 (작은 불씨 2개가 분열되어 각각 40% 피해 타격)
    if (type === 'fireball' && state.deckMechanics && state.deckMechanics.splitFireball) {
      const splitCount = Math.min(6, state.deckMechanics.splitFireball * 2);
      for (let s = 0; s < splitCount; s++) {
        setTimeout(() => {
          const splitOffsetY = (s % 2 === 0 ? -14 : 14) * (Math.floor(s / 2) + 1);
          launchProjectile(
            'fireball',
            () => {
              const splitSt = getPlayerStats();
              const splitCrit = Math.random() * 100 < splitSt.crit;
              const splitBase = splitSt.sp * 0.4;
              const splitDmg = splitCrit ? splitBase * splitSt.critDmg : splitBase;
              dealDamage('fireball', splitDmg, splitCrit, false, false, isCombustEffective);
            },
            splitOffsetY,
            0.55
          );
        }, (s + 1) * 65);
      }
    }
  }, 0, 1.0);
}

function triggerSkill(skillKey, isManual = false) {
  if (typeof isCombatHeld === 'function' && isCombatHeld()) return false;
  if ((typeof isMenuPaused === 'function' && isMenuPaused()) || (typeof isTitleOpen === 'function' && isTitleOpen())) return false; // 일시정지 메뉴·타이틀 화면
  const stats = getPlayerStats();
  const c = state.combat;

  if (skillKey === 'fireball') {
    if (c.castingSkill || c.gcdRemaining > 0) return false;

    // 충전형 카드 [속사 장전]: 충전이 남아 있으면 시전 없이 즉시 발사
    if (c.quickdrawCharges > 0) {
      c.quickdrawCharges--;
      fireSpellProjectile('fireball', 1.0, c.combustionRem > 0);
      beginMageGesture('fireball');
      c.gcdTotal = 0.25;
      c.gcdRemaining = c.gcdTotal;
      return true;
    }

    // 수동 조작 시 발화 중 캐스팅 속도 25% 가속
    const manualSpeedBonus = (isManual && c.combustionRem > 0) ? 1.25 : 1.0;
    const isGatling = Boolean(state.deckMechanics && state.deckMechanics.gatlingMode);
    const baseCast = isGatling ? 0.30 : 1.5;
    const minCast = isGatling ? 0.12 : 0.35;
    const castTime = Math.max(minCast, baseCast / (stats.speedMult * manualSpeedBonus));
    c.fireballCombustionSnapshot = Boolean(c.combustionRem > 0);
    c.castingSkill = 'fireball';
    c.castTotal = castTime;
    c.castRemaining = castTime;
    const baseGcd = isGatling ? 0.30 : 1.2;
    const minGcd = isGatling ? 0.12 : 0.4;
    c.gcdTotal = Math.max(minGcd, baseGcd / (stats.speedMult * manualSpeedBonus));
    c.gcdRemaining = c.gcdTotal;
    updateCastingLoopSound();
    return true;
  }

  if (skillKey === 'fireblast') {
    if (!state.grimoires.fireblast) return false;
    if (c.fbCharges <= 0) return false;

    c.fbCharges--;
    if (c.fbRechargeRem <= 0) {
      c.fbRechargeTotal = Math.max(3.5, (FIREBLAST_RECHARGE * (1 - stats.cdr)) / stats.speedMult);
      c.fbRechargeRem = c.fbRechargeTotal;
    }

    const pos = getTargetPos();
    spawnParticles(pos.x, pos.y, 20, '#fef08a', '#f97316', 1.15);
    let dmg = stats.sp * 1.2 * stats.critDmg;
    if (isManual) {
      dmg *= 1.35; // 수동 작렬 기본 35% 증폭
      if (c.combustionRem > 0) {
        dmg *= 1.5; // 발화 중 수동 작렬 콤보 추가 50% 증폭! (총 2배 이상)
      }
    }
    dealDamage('fireblast', dmg, true, true);
    beginMageGesture('fireblast');
    return true;
  }

  if (skillKey === 'combustion') {
    if (!state.grimoires.combustion) return false;
    if (c.combustionCdRem > 0) return false;

    c.combustionRem = getCombustionDuration();
    beginMageGesture('combustion');
    c.combustionCdTotal = Math.max(14, 30 * (1 - stats.cdr));
    c.combustionCdRem = c.combustionCdTotal;
    playSound('proc');
    return true;
  }

  if (skillKey === 'meteor') {
    if (!state.grimoires.meteor) return false;
    // 몰열은 일반 쿨타임과 화염구 시전을 방해하지 않는 즉시 연계입니다.
    if (isMeteorInstantReady()) {
      c.critStreak = 0;
      c.streakTimer = 0;
      addRunStat('instantMeteors', 1);
      releaseMeteor(isManual);
      return true;
    }
    // 두 번째 열기 숫자가 날아가는 중이면 곧 즉시 시전이 되므로 느린 일반 시전을 시작하지 않습니다.
    if (c.meteorArmPending) return false;
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
    if (!state.grimoires.flame_patch) return false;
    if (c.flamePatchCdRem > 0) return false;

    const patchCdMult = (state.deckMechanics && state.deckMechanics.patchCooldownMult) || 1;
    c.flamePatchCdTotal = Math.max(4.5, 10 * patchCdMult * (1 - stats.cdr));
    c.flamePatchCdRem = c.flamePatchCdTotal;
    c.flamePatchRem = FLAME_PATCH_DURATION;
    c.flamePatchTickTimer = 0;

    const target = getTargetPos();
    const fx = target.x;
    const fy = getActorGroundPos('dummy-avatar').y; // 발밑 바닥(불장판 균열 중심과 같은 높이)
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
    const tickDmg = getFlamePatchTickDamage(stats) * (isManual ? 1.25 : 1.0);
    dealDamage('flame_patch', tickDmg, false, false, true);
    updateBurningLoopSound();
    return true;
  }

  return false;
}

function getFlamePatchTickDamage(stats) {
  const patchBonus = (state.deckMechanics && state.deckMechanics.patchDamageBonus) || 0;
  return stats.sp * 0.5 * (1 + patchBonus) * stats.burnMult;
}

function releaseMeteor(isManual = false) {
  beginMageGesture('meteor');
  const isCombustingAtLaunch = Boolean(state.combat && state.combat.combustionRem > 0);
  if (isCombustingAtLaunch) {
    if (!state.stats) state.stats = {};
    state.stats.combustionPyros = (state.stats.combustionPyros || 0) + 1;
  }
  // 충전형 카드 [잠열 충전]: 발사 순간 충전을 소모해 피해 증폭
  let chargeMult = 1;
  if (state.combat.meteorCharges > 0) {
    state.combat.meteorCharges--;
    chargeMult += (state.deckMechanics && state.deckMechanics.meteorChargeBonus) || 1.5;
  }
  launchMeteorVfx(() => {
    const stats = getPlayerStats();
    const isCombustEffective = Boolean(isCombustingAtLaunch || (state.combat && state.combat.combustionRem > 0));
    const effectiveCrit = isCombustEffective ? 100 : stats.crit;
    const isCrit = effectiveCrit >= 100 || Math.random() * 100 < effectiveCrit;
    let damage = stats.sp * 3.2 * (isCrit ? stats.critDmg : 1);
    const meteorBuffCount = (state.deckMechanics && state.deckMechanics.meteorBuff) || 0;
    if (meteorBuffCount > 0) {
      damage *= (1 + 0.6 * meteorBuffCount); // 태양석 메테오: 스택당 +60% 피해 증폭
    }
    if (isManual) {
      damage *= 1.6; // 수동 몰열 폭딜: 60% 추가 증폭!
    }
    damage *= chargeMult;
    // 메테오 자체는 소비한 몰열을 다시 충전하지 않습니다.
    dealDamage('meteor', damage, isCrit, false, false, isCombustEffective);
    state.combat.meteorBurnRem = 6;
  }, isManual ? 1.2 : 1.0);
}

function finishCast(skillKey) {
  if (skillKey === 'fireball') {
    const isCombusting = Boolean((state.combat.combustionRem > 0) || state.combat.fireballCombustionSnapshot);
    state.combat.fireballCombustionSnapshot = false;
    fireSpellProjectile('fireball', 1.0, isCombusting);

    // 로그라이크 덱: 일제 협공 사격 (화염구 발사 시 소환 정령 동시 발사)
    if (state.deckMechanics && state.deckMechanics.synchronizedFire) {
      fireElementalAttack();
    }

    // 화염구 시전 완료 직후 몰열(치명타 2연속)이 켜져 있고 자동 시전이 켜져 있다면 지체 없이 메테오 즉시 발사 연계!
    if (isMeteorInstantReady() && state.combat.meteorArmedAge >= METEOR_AUTO_BEAT && isSkillAutoActive('meteor')) {
      triggerSkill('meteor');
    }
  } else if (skillKey === 'meteor') {
    const c = state.combat;
    const meteorBuffCount = (state.deckMechanics && state.deckMechanics.meteorBuff) || 0;
    if (meteorBuffCount > 0) {
      c.meteorCdTotal = Math.max(4, (18 * Math.pow(0.5, meteorBuffCount)) * (1 - getPlayerStats().cdr));
    } else {
      c.meteorCdTotal = Math.max(8, 18 * (1 - getPlayerStats().cdr));
    }
    c.meteorCdRem = c.meteorCdTotal;
    releaseMeteor();
  }
}

// 메테오 준비 완료가 보인 뒤 자동 시전이 쏘기까지의 숨(초). '두 칸이 찼다 → 준비 → 발사'를 눈으로 따라가게 합니다.
const METEOR_AUTO_BEAT = 0.3;

// 메테오 즉시 시전 가능 = 열기 2스택 판정 + 두 번째 붉은 숫자의 문양 도착(무장)
function isMeteorInstantReady() {
  const c = state.combat;
  return Boolean(state.grimoires.meteor && c.critStreak === 2 && !c.meteorArmPending);
}

// 무장 순간: 준비 효과음·버튼 섬광·열기 문양 두 칸 동시 발광. skipBeat=true면 자동 시전도 바로 쏩니다(날아가는 숫자가 없을 때).
function armMeteorInstant(skipBeat) {
  const c = state.combat;
  if (!c.meteorArmPending || c.critStreak !== 2) {
    c.meteorArmPending = false;
    return;
  }
  c.meteorArmPending = false;
  state.heatTutorial = false;
  c.meteorArmedAge = skipBeat ? METEOR_AUTO_BEAT : 0;
  playSound('proc');
  triggerReadyFlash('skill-3');
  const sigils = typeof document !== 'undefined' ? document.getElementById('heat-sigils') : null;
  if (sigils && sigils.classList) {
    sigils.classList.remove('heat-ready-burst');
    void sigils.offsetWidth;
    sigils.classList.add('heat-ready-burst');
  }
}

// 스펠 큐(MMO식 입력 예약): 다른 시전·공통 대기 중에 누른 수동 스킬을 버리지 않고 기억했다가,
// 현재 시전이 끝나는 즉시 자동 시전보다 먼저 발동합니다. 화염구 자동·메테오 수동 조합에서
// 자동 화염구가 시전 틈을 계속 차지해 메테오 단축키가 먹지 않던 문제를 막습니다.
const SPELL_QUEUE_WINDOW = 3.0; // 초. 이보다 오래 기다린 입력은 버립니다(가장 긴 시전보다 깁니다).

function requestManualSkill(skillKey) {
  if ((typeof isMenuPaused === 'function' && isMenuPaused()) || (typeof isTitleOpen === 'function' && isTitleOpen())) return false; // 일시정지 메뉴·타이틀 화면
  const c = state.combat;
  if (triggerSkill(skillKey, true)) {
    if (c.queuedSkill === skillKey) clearQueuedSkill();
    return true;
  }
  // 시전·공통 대기 때문에만 막힌 경우에 예약합니다(쿨타임·미습득은 예약하지 않음).
  const blockedByCast = Boolean(c.castingSkill) || c.gcdRemaining > 0 || (skillKey === 'meteor' && c.meteorArmPending);
  const ready = skillKey === 'fireball' || (skillKey === 'meteor' && state.grimoires.meteor && (c.meteorCdRem <= 0 || c.meteorArmPending));
  if (blockedByCast && ready) {
    c.queuedSkill = skillKey;
    c.queuedAge = 0;
    setQueuedSkillUI(skillKey);
  }
  return false;
}

function processQueuedSkill(dt) {
  const c = state.combat;
  if (!c.queuedSkill) return;
  c.queuedAge += dt;
  if (c.queuedAge > SPELL_QUEUE_WINDOW) {
    clearQueuedSkill();
    return;
  }
  if (c.queuedSkill === 'meteor' && c.meteorArmPending) return; // 열기 숫자 도착(무장) 대기
  const instantMeteor = c.queuedSkill === 'meteor' && isMeteorInstantReady();
  if (!instantMeteor && (c.castingSkill || c.gcdRemaining > 0)) return;
  const skill = c.queuedSkill;
  clearQueuedSkill();
  triggerSkill(skill, true);
}

function clearQueuedSkill() {
  state.combat.queuedSkill = null;
  state.combat.queuedAge = 0;
  setQueuedSkillUI(null);
}

// 예약된 스킬 버튼에 고리를 둘러 입력이 접수됐음을 보여줍니다.
function setQueuedSkillUI(skillKey) {
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  document.querySelectorAll('.skill-btn.skill-queued').forEach((btn) => btn.classList.remove('skill-queued'));
  if (skillKey) {
    const btn = document.querySelector(`.skill-btn[data-skill="${skillKey}"]`);
    if (btn) btn.classList.add('skill-queued');
  }
}

// 화염구만 기본 자동 시전입니다. 나머지 주문(불꽃 작렬·메테오·마력 폭주·불장판)은
// 전설 카드 '자동 영창'을 얻어야 자동으로 돌고, 그 전까지는 직접 눌러 연계합니다.
function hasSmartAutoCast() {
  return Boolean(state.deckMechanics && state.deckMechanics.smartAutoCast);
}

function canSkillAutoCast(skillKey) {
  return skillKey === 'fireball' || hasSmartAutoCast();
}

function isSkillAutoActive(skillKey) {
  if (!state.autoCast) return false;
  if (!canSkillAutoCast(skillKey)) return false;
  if (!state.skillAuto) return true;
  return state.skillAuto[skillKey] !== false;
}

// 최적 시전 순서. 게임은 자동 시전 중인 주문에만 쓰고,
// 시뮬레이터는 수동 주문을 사람이 반응 지연을 두고 누르는 모습을 흉내 낼 때 canCast·isManual을 바꿔 씁니다.
function runSmartAutoCast(canCast = isSkillAutoActive, isManual = false) {
  if (!isManual && !state.autoCast) return;
  const c = state.combat;

  if (state.grimoires.combustion && canCast('combustion') && c.combustionCdRem <= 0) {
    triggerSkill('combustion', isManual);
  }
  if (state.grimoires.flame_patch && canCast('flame_patch') && c.flamePatchCdRem <= 0) {
    triggerSkill('flame_patch', isManual);
  }

  // 1. 몰아치는 열기 (즉시 시전 메테오): 몰열 2스택 상태라면 최우선 발사!
  if (canCast('meteor') && isMeteorInstantReady() && c.meteorArmedAge >= METEOR_AUTO_BEAT) {
    triggerSkill('meteor', isManual);
  }

  // 2. 불꽃 작렬 (확정 치명타): 1스택일 때 즉시 2스택 완성 유도 또는 완충 시 즉시 소모
  if (state.grimoires.fireblast && canCast('fireblast') && c.fbCharges > 0) {
    if (!state.grimoires.meteor || c.critStreak === 1 || c.fbCharges >= c.fbMaxCharges) {
      triggerSkill('fireblast', isManual);
    }
  }

  // 3. 일반 화염구 기본 시전. 즉시 메테오는 화염구 시전 중에도 그 위로 떨어지므로, 열기 2칸이어도 화염구를 쉬지 않습니다.
  //    (지금 시작한 화염구는 메테오가 열기를 소비한 뒤 꽂혀 다음 열기 1칸으로 이어집니다)
  if (canCast('fireball') && !c.castingSkill && c.gcdRemaining <= 0) {
    triggerSkill('fireball', false);
  }
}

function toggleSkillAuto(skillKey) {
  if (!state.skillAuto) {
    state.skillAuto = { fireball: true, fireblast: true, combustion: true, meteor: true, flame_patch: true };
  }
  // 자동 영창이 없으면 화염구 말고는 자동으로 돌릴 수 없습니다(수동 주문을 우클릭해도 아무 일 없음).
  if (!canSkillAutoCast(skillKey)) return;
  state.skillAuto[skillKey] = !state.skillAuto[skillKey];
  playSound('item_select');
  const isAuto = state.skillAuto[skillKey];
  const nameMap = {
    fireball: tr('화염구'),
    fireblast: tr('불꽃 작렬'),
    meteor: tr('메테오'),
    combustion: tr('마력 폭주'),
    flame_patch: tr('불장판')
  };
  const skillName = nameMap[skillKey] || skillKey;
  spawnFloatingText(`${skillName}: ${isAuto ? tr('🤖 자동') : tr('✋ 수동')}`, isAuto ? 'fct-normal' : 'fct-crit', -35, { anchor: 'caster' });
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

  for (const [key, btn] of Object.entries(autoMap)) {
    if (!btn) continue;
    // 자동 영창 전의 수동 주문: AUTO 배지와 수동 테두리 없이 그냥 누르는 버튼입니다.
    if (!canSkillAutoCast(key)) {
      const stale = btn.querySelector('.skill-auto-badge');
      if (stale) stale.remove();
      btn.classList.remove('manual-mode-active');
      continue;
    }
    const isAuto = state.skillAuto ? state.skillAuto[key] !== false : true;
    let badge = btn.querySelector('.skill-auto-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'skill-auto-badge';
      badge.setAttribute('title', tr('자동/수동 전환 (클릭 또는 우클릭)'));
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleSkillAuto(key);
      });
      btn.appendChild(badge);
    }
    if (badge) {
      badge.classList.toggle('is-auto', isAuto);
      badge.classList.toggle('is-manual', !isAuto);
      badge.textContent = isAuto ? 'AUTO' : tr('수동');
      badge.setAttribute('aria-label', isAuto ? tr('자동 시전 모드') : tr('수동 시전 모드'));
    }
    btn.classList.toggle('manual-mode-active', !isAuto);
  }
}

// ==========================================
// 12. 시계방향 쿨타임 오버레이 헬퍼
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
// 13. 앱 알림 스타일 느낌표(!) 배지 통합 관리
// ==========================================
function setBadge(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('hidden', !visible);
}

function updateNotificationBadges() {
  const c = state.combat;

  // 1. 자동 시전 버튼 (!) 배지: 꺼져 있을 때 표시
  setBadge('badge-auto-cast', !state.autoCast);

  // 2. 스킬 액션바 (!) 배지: 수동 조작 중이거나 즉시 발사 프록이 떴을 때
  const manualMode = !state.autoCast;
  // 주문별로 '지금 직접 눌러야 하는가'를 봅니다(자동 영창 전에는 화염구 외 주문이 모두 수동).
  const manualSkill = (key) => !isSkillAutoActive(key);
  setBadge('badge-skill-1', manualMode && !c.castingSkill && c.gcdRemaining <= 0 && state.dpsHistory.length === 0);
  setBadge(
    'badge-skill-2',
    state.grimoires.fireblast && c.fbCharges > 0 && (c.critStreak === 1 || (manualSkill('fireblast') && c.fbCharges >= 2))
  );
  setBadge('badge-skill-3', isMeteorInstantReady());
  setBadge('badge-skill-4', manualSkill('combustion') && state.grimoires.combustion && c.combustionCdRem <= 0);
  setBadge('badge-skill-6', manualSkill('flame_patch') && state.grimoires.flame_patch && c.flamePatchCdRem <= 0);
}

// ==========================================
// 14. 타오르는 기운 (Heating Up Pity) 효과 UI
// ==========================================
function updatePityCritBadgeUI() {
  const btn = document.getElementById('skill-1');
  const stacks = (state.combat && state.combat.pityCritStacks) || 0;
  if (!btn) return;
  // 4타 연속 비치명타부터 불운 방지 가변 보정이 작동하므로 이때 버튼 활성 효과 적용
  if (stacks >= 4) {
    btn.classList.add('heating-pity-active');
  } else {
    btn.classList.remove('heating-pity-active');
  }
}

// ==========================================
// 15. 시스템 언폴딩 & 스킬 액션바
// ==========================================
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
  unfoldToastTimer = setTimeout(hideUnfoldToast, 3200);
}

function hideUnfoldToast() {
  if (unfoldToastTimer) clearTimeout(unfoldToastTimer);
  unfoldToastTimer = null;
  const toastEl = document.getElementById('unfold-toast');
  if (toastEl) toastEl.classList.add('hidden');
}

// 자동 영창 획득: 모달이 닫힌 직후 주문 칸마다 AUTO 배지가 왼쪽부터 차례로 튀어나옵니다.
function triggerAutoGrimoireUnfold() {
  // 발밑 마법진이 종이를 펼치듯 튀어 오르며 처음 깔립니다.
  const circleEl = document.getElementById('autocast-magic-circle');
  if (circleEl) {
    circleEl.classList.remove('mc-unfold');
    void circleEl.offsetWidth;
    circleEl.classList.add('mc-unfold');
  }
  const badges = [...document.querySelectorAll('.skill-btn:not(#skill-1) .skill-auto-badge')].filter((b) => b.offsetParent !== null);
  badges.forEach((badge, i) => {
    badge.classList.remove('auto-unfold');
    void badge.offsetWidth;
    badge.style.animationDelay = `${0.35 + i * 0.12}s`;
    badge.classList.add('auto-unfold');
  });
}

// 메테오 연계 시연: 세이브에서 메테오를 처음 배운 순간 한 번만, 전투를 멈추고 '치명 → 치명 → 즉시 메테오'를
// 아이콘·열기 문양 애니메이션으로 보여 줍니다. 닫으면 이번 런의 첫 열기 2칸이 보장되어 바로 직접 겪어 봅니다.
const COMBO_COACH_DISMISS_DELAY = 900; // ms. 카드를 고른 클릭이 시연을 바로 닫지 않도록 기다립니다.
let finishComboCoach = null; // 열려 있는 시연을 즉시 닫는 함수(밸런스 시뮬레이터가 '클릭'을 대신할 때 사용)

function dismissMeteorComboCoach() {
  if (typeof finishComboCoach !== 'function') return false;
  finishComboCoach();
  return true;
}

function startMeteorComboCoach() {
  const tips = state.meta.tips;
  if (!tips || tips.meteorCombo) return false;
  tips.meteorCombo = true;
  state.heatTutorial = true;
  saveGame();

  const arena = document.getElementById('combat-arena');
  if (!arena || typeof arena.insertAdjacentHTML !== 'function') return true;
  state.isPaused = true;
  const step2Icon = state.grimoires.fireblast ? '💥' : '🔥';
  const step2Name = state.grimoires.fireblast ? tr('불꽃 작렬') : tr('화염구');
  arena.insertAdjacentHTML('beforeend', `
    <div class="combo-coach" id="combo-coach" role="dialog" aria-modal="true" aria-label="${tr('메테오 연계')}">
      <div class="cc-card">
        <div class="cc-title">☄️ ${tr('메테오 연계')}</div>
        <div class="cc-row">
          <span class="cc-step cc-s1"><span class="cc-icon">🔥</span><span class="cc-name">${tr('화염구')}</span><b>${tr('치명타')}</b></span>
          <span class="cc-arrow cc-a1">➜</span>
          <span class="cc-step cc-s2"><span class="cc-icon">${step2Icon}</span><span class="cc-name">${step2Name}</span><b>${tr('치명타')}</b></span>
          <span class="cc-arrow cc-a2">➜</span>
          <span class="cc-step cc-s3"><span class="cc-icon">☄️</span><span class="cc-name">${tr('메테오')}</span><b>${tr('즉시·무료')}</b></span>
        </div>
        <div class="cc-sigils" aria-hidden="true"><i></i><i></i></div>
        ${state.grimoires.fireblast ? `<div class="cc-note">💥 ${tr('불꽃 작렬은 항상 치명타')}</div>` : ''}
        <div class="cc-tap">${tr('클릭하여 계속')}</div>
      </div>
    </div>`);
  const coach = document.getElementById('combo-coach');
  if (!coach) {
    state.isPaused = false;
    return true;
  }
  playSound('proc', 0.8);
  const openedAt = Date.now();
  const finish = () => {
    finishComboCoach = null;
    coach.removeEventListener('click', close);
    window.removeEventListener('keydown', onKey, true);
    coach.classList.add('cc-out');
    setTimeout(() => coach.remove(), 260);
    state.isPaused = false;
  };
  const close = () => {
    if (Date.now() - openedAt < COMBO_COACH_DISMISS_DELAY) return;
    finish();
  };
  finishComboCoach = finish;
  const onKey = (event) => {
    if (['Enter', ' ', 'Escape'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  coach.addEventListener('click', close);
  window.addEventListener('keydown', onKey, true);
  return true;
}

// 열기 1칸이 켜진 순간, 불꽃 작렬을 손으로 쓰는 플레이어에게 '지금!' 말풍선을 세이브 전체에서 몇 번만 띄웁니다.
function maybeShowFireblastHint() {
  const tips = state.meta.tips;
  const c = state.combat;
  if (!tips || tips.fireblastHint >= FIREBLAST_HINT_MAX) return false;
  if (!state.grimoires.fireblast || !state.grimoires.meteor || c.fbCharges <= 0 || isSkillAutoActive('fireblast')) return false;
  tips.fireblastHint += 1;
  saveGame();
  const btn = document.getElementById(SPELL_ACTION_CONFIG.fireblast.id);
  if (!btn || typeof btn.insertAdjacentHTML !== 'function') return true;
  const old = btn.querySelector('.fb-hint');
  if (old) old.remove();
  btn.insertAdjacentHTML('beforeend', `<span class="fb-hint" aria-hidden="true">${tr('지금!')}</span>`);
  const hint = btn.querySelector('.fb-hint');
  setTimeout(() => hint && hint.remove(), 1800);
  return true;
}

// 광폭화 타이머 안내: 처음 ENRAGE_INTRO_MAX번의 보스전에서, 타이머 왼쪽에 종이 쪽지를 잠깐 걸고 타이머를 빛냅니다.
// 실패 조건이라는 '사실'이라 글로 알려 주되, 익숙해진 뒤에는 막대만 남깁니다.
function maybeShowEnrageIntro() {
  const c = state.combat;
  if (c.enrageIntroChecked) return false;
  if (typeof isTitleOpen === 'function' && isTitleOpen()) return false;
  if (state.isPaused || (typeof isMenuPaused === 'function' && isMenuPaused())) return false;
  c.enrageIntroChecked = true;
  const tips = state.meta && state.meta.tips;
  if (!tips || (tips.enrageIntro || 0) >= ENRAGE_INTRO_MAX) return false;
  tips.enrageIntro = (tips.enrageIntro || 0) + 1;
  saveGame();
  const timer = document.getElementById('boss-enrage-timer');
  if (!timer || typeof timer.insertAdjacentHTML !== 'function') return true;
  const old = timer.querySelector('.enrage-intro');
  if (old) old.remove();
  timer.insertAdjacentHTML('beforeend', `<div class="enrage-intro" role="note"><b>${tr('광폭화!')}</b><span>${tr('0초가 되면 런 실패!')}</span></div>`);
  timer.classList.add('intro-glow');
  const note = timer.querySelector('.enrage-intro');
  setTimeout(() => {
    if (note) note.classList.add('leaving');
    setTimeout(() => { if (note) note.remove(); timer.classList.remove('intro-glow'); }, 380);
  }, 4000);
  return true;
}

// 불꽃 심판 치명 피해 배율(1 + 보너스). stage를 주면 그 스테이지 기준(준비 표시는 다음 스테이지 배율을 보여 줌)
function getEmberVerdictMult(stage = state.currentStage) {
  const v = (state.deckMechanics && state.deckMechanics.emberVerdict) || {};
  const data = getStageData(Math.min(FINAL_STAGE, stage));
  return 1 + ((data && data.isPhaseBoss ? v.bossCritBonus : v.critBonus) || 0);
}

// 스테이지 시작 순간 발동 연출(강타급): 문구·흔들림·불씨. 피해 규칙은 연출과 무관하게 즉시 적용됩니다.
function showEmberVerdictBurst(mult) {
  spawnFloatingText(tr('⚖️ 불꽃 심판! 치명 피해 ×{n}', { n: mult }), 'fct-proc', -55, { isBig: true });
  triggerArenaShake('sm');
  const pos = getTargetPos();
  spawnParticles(pos.x, pos.y, 24, '#fff7d6', '#dc2626', 1.5);
  playSound('proc', 1.1);
}

// 화염구 버튼 표시(사실만): 준비되면 불씨 테두리 + 다음 스테이지 배율 꼬리표,
// 발동 중에는 같은 꼬리표가 남은 시간만큼 붉게 차 있다가 줄어드는 게이지가 됩니다.
function updateEmberVerdictBadge() {
  const btn = document.getElementById(SPELL_ACTION_CONFIG.fireball.id);
  if (!btn || !btn.classList) return;
  const v = state.deckMechanics && state.deckMechanics.emberVerdict;
  const armed = Boolean(v && state.combat.verdictArmed);
  const left = v ? (state.combat.verdictBurstUntil || 0) - (state.playTimeSec || 0) : 0;
  const burning = Boolean(v && left > 0);
  btn.classList.toggle('verdict-armed', armed || burning);
  btn.classList.toggle('verdict-burning', burning);
  if (!btn.dataset || !(armed || burning)) return;
  btn.dataset.verdict = `×${getEmberVerdictMult(armed ? state.currentStage + 1 : state.currentStage)}`;
  if (btn.style && btn.style.setProperty) btn.style.setProperty('--verdict-left', `${Math.round((burning ? left / v.duration : 1) * 100)}%`);
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

  // 1. 첫 각성 카드 획득 시: 치명타/시전속도 스탯 알약 개방
  const hasAnyCard = Boolean(deckManager && Object.keys(deckManager.getActiveDeck()).length > 0);
  if (!u.combatStats && hasAnyCard) {
    u.combatStats = true;
    changed = true;
    triggerUnfoldPop('pill-crit');
    triggerUnfoldPop('pill-haste');
  }

  // 2. Stage 20(최종 보스) 클리어 시: 타이틀 화면의 명예의 전당(스피드런 기록) 버튼 개방(title-screen.js가 표시)
  if (!u.hallOfFame && state.campaignCleared) {
    u.hallOfFame = true;
    changed = true;
  }

  applyUnfoldedVisibility();
  if (changed && !silent) {
    saveGame();
  }
}

function applyUnfoldedVisibility() {
  const u = state.unfolded;
  const pillCrit = document.getElementById('pill-crit');
  const pillHaste = document.getElementById('pill-haste');
  if (pillCrit) pillCrit.classList.toggle('unfold-hidden', !u.combatStats);
  if (pillHaste) pillHaste.classList.toggle('unfold-hidden', !u.combatStats);
}

const SPELL_ACTION_CONFIG = {
  fireball: { id: 'skill-1', icon: '🔥', name: tr('화염구') },
  fireblast: { id: 'skill-2', icon: '💥', name: tr('불꽃 작렬') },
  meteor: { id: 'skill-3', icon: '☄️', name: tr('메테오') },
  combustion: { id: 'skill-4', icon: '☀️', name: tr('마력 폭주') },
  flame_patch: { id: 'skill-6', icon: '♨️', name: tr('불장판') }
};

function getActiveSpellList() {
  state.spellOrder = state.spellOrder || ['fireball'];
  // 새로 습득한 주문: 플레이어가 드래그로 정한 선호 배치(meta.slotOrder)가 있으면 그 자리에, 없으면 단축키 뒤쪽에 추가
  const pref = state.meta && Array.isArray(state.meta.slotOrder) ? state.meta.slotOrder : [];
  ['fireblast', 'meteor', 'combustion', 'flame_patch'].forEach((s) => {
    if (state.grimoires[s] && !state.spellOrder.includes(s)) insertSpellByPreference(s, pref);
  });
  return state.spellOrder.filter((s) => s === 'fireball' || state.grimoires[s]);
}

// 선호 배치에서 s보다 뒤에 오는 주문 중, 이미 슬롯에 있는 첫 주문 바로 앞에 넣습니다.
function insertSpellByPreference(s, pref) {
  const order = state.spellOrder;
  const p = pref.indexOf(s);
  const idx = p === -1 ? -1 : order.findIndex((k) => pref.includes(k) && pref.indexOf(k) > p);
  if (idx === -1) order.push(s);
  else order.splice(idx, 0, s);
}

// 액션 바 슬롯 이동(드래그 앤 드롭): 주문을 toIndex 자리로 옮기고, 다음 런에도 이어지도록 선호 배치로 저장합니다.
function moveSpellSlot(skillKey, toIndex) {
  const active = getActiveSpellList();
  const from = active.indexOf(skillKey);
  const to = Math.max(0, Math.min(active.length - 1, toIndex));
  if (from === -1 || from === to) return false;
  active.splice(from, 1);
  active.splice(to, 0, skillKey);
  state.spellOrder = active.concat(state.spellOrder.filter((k) => !active.includes(k)));
  if (state.meta) state.meta.slotOrder = active.concat((state.meta.slotOrder || []).filter((k) => !active.includes(k)));
  return true;
}

function updateSkillActionBarVisibility() {
  checkAndTriggerUnfolds(true);

  const activeSpells = getActiveSpellList();

  // 모든 스킬 버튼을 순회하며 해금 여부 및 동적 단축키 번호[1, 2, 3...] 부여
  Object.entries(SPELL_ACTION_CONFIG).forEach(([skillKey, conf]) => {
    const btn = document.getElementById(conf.id);
    if (!btn) return;
    const activeIndex = activeSpells.indexOf(skillKey);
    const isUnlocked = activeIndex !== -1;

    btn.classList.toggle('hidden-slot', !isUnlocked);
    btn.classList.toggle('locked-skill', !isUnlocked);

    if (isUnlocked) {
      const hotkeyNum = activeIndex + 1;
      btn.style.order = String(hotkeyNum);
      btn.setAttribute('data-hotkey', String(hotkeyNum));

      const hotkeyEl = btn.querySelector('.skill-hotkey');
      if (hotkeyEl) {
        hotkeyEl.textContent = String(hotkeyNum);
      }
      btn.setAttribute('title', `[${hotkeyNum}] ${conf.name}`);
    } else {
      btn.style.order = '99';
    }
  });

  const charges2 = document.getElementById('charges-2');
  const hasFireblast = Boolean(state.grimoires && state.grimoires.fireblast);
  if (charges2) {
    charges2.style.display = hasFireblast ? 'block' : 'none';
    charges2.textContent = (state.combat && state.combat.fbCharges > 0) ? state.combat.fbCharges : '';
  }

  const btn3 = document.getElementById('skill-3');
  const hasMeteor = Boolean(state.grimoires && state.grimoires.meteor);
  if (btn3 && !hasMeteor) {
    btn3.classList.remove('proc-glow');
  }

  const autoBtn = document.getElementById('btn-auto-cast');
  const autoBtnText = document.getElementById('btn-auto-cast-text');
  if (autoBtn) {
    if (state.autoCast) {
      autoBtn.className = 'auto-cast-btn active has-badge-anchor';
      if (autoBtnText) autoBtnText.textContent = tr('🤖 자동: ON');
    } else {
      autoBtn.className = 'auto-cast-btn has-badge-anchor';
      if (autoBtnText) autoBtnText.textContent = tr('🤖 자동: OFF');
    }
  }

  updateAutoCastMagicCircle();
  updateSkillAutoUI();
}

// 발밑 마법진은 전설 카드 '자동 영창'을 얻은 순간부터 나타나, 모든 주문이 스스로 영창됨을 보여 줍니다.
function updateAutoCastMagicCircle() {
  const circleEl = document.getElementById('autocast-magic-circle');
  if (!circleEl) return;
  circleEl.classList.toggle('hidden', !hasSmartAutoCast());
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
  const monsterFrame = document.getElementById('monster-frame');
  monsterFrame.classList.toggle('boss-frame', data.isPhaseBoss);

  // 스테이지 진행은 가운데 진척도 UI가 보여 줍니다. 업화 배지는 스피드런 시간 옆에 둡니다.
  if (typeof updateInfernoBadge === 'function') updateInfernoBadge();

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

  renderSpeedrunTimer(state.playTimeSec);

  updateBossGimmick(0);
  updateNotificationBadges();
  updateDoomProgressUI();
}

// ==========================================
// 15-A. 최종 보스 세계 멸망 저지 진척도 UI 시스템
// ==========================================
function updateDoomProgressUI(stageNum) {
  const currentStage = Math.max(1, Math.min(FINAL_STAGE, stageNum !== undefined ? stageNum : state.currentStage));
  const trackerEl = document.getElementById('doom-tracker');
  if (!trackerEl) return;

  const pct = Math.min(100, Math.round((currentStage / FINAL_STAGE) * 100));
  const isFinalBattle = currentStage === FINAL_STAGE;

  // 1. 스테이지 텍스트 갱신
  const stageDispEl = document.getElementById('doom-stage-display');
  if (stageDispEl) {
    stageDispEl.textContent = isFinalBattle
      ? tr('🔥 최종 결전 {n}/{n}', { n: FINAL_STAGE })
      : `STAGE ${currentStage} / ${FINAL_STAGE}`;
  }

  // 2. 게이지 바 & 마법사 핀 위치 동기화
  const fillEl = document.getElementById('doom-track-fill');
  if (fillEl) {
    fillEl.style.width = `${pct}%`;
  }
  const casterPinEl = document.getElementById('doom-caster-pin');
  if (casterPinEl) {
    casterPinEl.style.left = `${pct}%`;
  }

  // 3. 페이즈 보스 핀 클리어 상태 갱신
  const p1Pin = trackerEl.querySelector('.pin-p1');
  if (p1Pin) p1Pin.classList.toggle('cleared', currentStage > 5);
  const p2Pin = trackerEl.querySelector('.pin-p2');
  if (p2Pin) p2Pin.classList.toggle('cleared', currentStage > 10);
  const p3Pin = trackerEl.querySelector('.pin-p3');
  if (p3Pin) p3Pin.classList.toggle('cleared', currentStage > 15);

  // 4. 스토리 툴팁 내 남은 여정 텍스트 갱신
  const remainEl = document.getElementById('doom-remain-text');
  if (remainEl) {
    remainEl.textContent = isFinalBattle
      ? tr('🔥 {boss} 강림! 지금 세계를 구원하십시오!', { boss: FINAL_BOSS.name })
      : tr('남은 여정: {n} 스테이지', { n: FINAL_STAGE - currentStage });
  }

  // 5. 20스테이지 최종 보스전 강조 발광
  trackerEl.classList.toggle('doom-final-battle', isFinalBattle);
}

function triggerSpeedrunRecordFlash() {
  const box = document.querySelector('.speedrun-stat-box');
  if (!box) return;
  box.classList.remove('record-flash');
  void box.offsetWidth;
  box.classList.add('record-flash');
  setTimeout(() => box.classList.remove('record-flash'), 1400);
}

// ==========================================
// 15-B. 최종 보스 불의 심장 보호막 기믹
// ==========================================
function updateBossGimmick(dt) {
  const bg = state.bossGimmick;
  if (!bg) return;
  const stage = state.currentStage;
  const badge = document.getElementById('boss-gimmick-badge');

  // 최종 보스(Stage 20) 불의 심장 보호막만 최종 관문으로 유지
  // (일반 몬스터 및 중간 보스는 덱 시너지 집중을 위해 불필요한 기믹 배지 완전 제거)
  // 보호막이 펼쳐진 동안 가슴의 불의 심장이 빠르게 고동쳐 파괴 대상을 눈으로 알려줍니다.
  const actor = document.getElementById('dummy-avatar');
  const heartState = stage === FINAL_STAGE && bg.shield > 0 ? 'shield' : '';
  if (actor && actor.dataset && (actor.dataset.heart || '') !== heartState) {
    if (heartState) actor.dataset.heart = heartState; else delete actor.dataset.heart;
  }

  if (stage === FINAL_STAGE) {
    if (bg.shield > 0) {
      bg.shieldTimer -= dt;
      if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('gimmick-shield');
        badge.textContent = tr('🌋 용암 보호막 ({hp} / {sec}s)', { hp: fmt(bg.shield), sec: Math.max(0, bg.shieldTimer).toFixed(1) });
      }
      if (bg.shieldTimer <= 0) {
        bg.shield = 0;
        bg.shieldTimer = 0;
        state.monster.hp = Math.min(state.monster.maxHp, state.monster.hp + Math.round(state.monster.maxHp * getInfernoModifiers(state.infernoLevel).shieldHeal));
        triggerArenaShake('lg');
        playSound('meteor_impact');
        spawnFloatingText(tr('⚠️ 보호막 폭발! {boss} 체력 회복!', { boss: FINAL_BOSS.name }), 'fct-normal', -35);
      }
    } else {
      if (state.monster.hp <= state.monster.maxHp * 0.3 && !bg.shieldTriggered && !state.monster.isDying) {
        bg.shieldTriggered = true;
        bg.shield = Math.round(state.monster.maxHp * 0.12 * getInfernoModifiers(state.infernoLevel).shieldMult);
        bg.maxShield = bg.shield;
        bg.shieldTimer = getInfernoModifiers(state.infernoLevel).shieldSec;
        triggerArenaShake('lg');
        playSound('proc');
        spawnFloatingText(tr('🌋 불의 심장 전개! {sec}초 내 보호막을 파괴하세요!', { sec: Math.round(bg.shieldTimer) }), 'fct-crit', -50, { isBig: true });
      }
      if (badge && bg.shield <= 0) badge.classList.add('hidden');
    }
  } else {
    if (badge) badge.classList.add('hidden');
  }
}

// ==========================================
// 16. Stage 20(최종 보스) 토벌 스피드런 결과 모달
// ==========================================
// 스피드런 기록은 ms까지 표기합니다(MM:SS.mmm). 소수점 아래는 버림이라 기록이 실제보다 빨라 보이지 않습니다.
function splitSpeedrunTime(sec) {
  const totalMs = Math.max(0, Math.floor((sec || 0) * 1000 + 1e-6));
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor(totalMs / 1000) % 60;
  return {
    main: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
    ms: `.${String(totalMs % 1000).padStart(3, '0')}`
  };
}

function formatSpeedrunTime(sec) {
  const t = splitSpeedrunTime(sec);
  return t.main + t.ms;
}

// 전투 HUD 타이머: 매 프레임 호출되므로 마크업은 한 번만 만들고 바뀐 글자만 갱신합니다.
// ms 자리는 작고 흐리게 두어 초 단위 가독성은 지키면서 숫자가 흘러가는 긴장감만 더합니다.
function renderSpeedrunTimer(sec) {
  const el = document.getElementById('ui-speedrun-timer');
  if (!el) return;
  let mainEl = el.querySelector('.speedrun-main');
  let msEl = el.querySelector('.speedrun-ms');
  if (!mainEl || !msEl) {
    el.textContent = '';
    mainEl = document.createElement('span');
    mainEl.className = 'speedrun-main';
    msEl = document.createElement('span');
    msEl.className = 'speedrun-ms';
    el.append(mainEl, msEl);
  }
  const t = splitSpeedrunTime(sec);
  if (mainEl.textContent !== t.main) mainEl.textContent = t.main;
  if (msEl.textContent !== t.ms) msEl.textContent = t.ms;
}

function formatPlayTime(sec) {
  const totalSec = Math.max(0, Math.floor(sec || 0));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return tr('{h}시간 {m}분 {s}초', { h: hrs, m: mins, s: secs });
  }
  return tr('{m}분 {s}초', { m: mins, s: secs });
}

// ==========================================
// 로그라이크 마도서 각성 (Grimoire Awakening) UI 및 제어 함수군
// ==========================================
let awakeningOnComplete = null;
let isCurrentAwakeningBoss = false;

function showDeckTooltip(card, targetEl) {
  const tooltip = document.getElementById('deck-vampire-tooltip');
  if (!tooltip || !card) return;

  // 최신 CARD_POOL에서 실시간 카드 정보 동기화 (F5 및 엑셀 수정 실시간 반영)
  const liveCard = (deckManager && deckManager.CARD_POOL.find(c => c.id === card.id)) || card;
  const title = cardText(liveCard, 'title') || cardText(card, 'title');
  const icon = liveCard.icon || card.icon;
  const rarity = liveCard.rarity || card.rarity;
  const build = liveCard.build || card.build;
  const maxStack = liveCard.maxStack || card.maxStack || 1;
  const desc = cardText(liveCard, 'desc') || cardText(card, 'desc');
  const stats = liveCard.stats || card.stats;

  const rarityMeta = (typeof RoguelikeDeck !== 'undefined' && RoguelikeDeck.RARITY_META[rarity]) || { name: rarity, color: '#94a3b8' };
  const buildLabel = getBuildLabel(build);
  const isMax = card.count >= maxStack;
  const stackLabel = isMax ? 'MAX' : tr('중첩 {n} / {max}', { n: card.count, max: maxStack });

  // 누적 스탯 칩 계산
  let statsHtml = '';
  if (stats && typeof stats === 'object') {
    const chips = [];
    // 카드 스탯은 모두 정수 퍼센트입니다(밸런스 패치 v2).
    const statLabels = {
      spPct: tr('주문력'),
      haste: tr('시전 속도'),
      crit: tr('치명타율'),
      critDmg: tr('치명 피해'),
      spiritPct: tr('소환수 피해'),
      burnPct: tr('지속 피해')
    };
    for (const [key, val] of Object.entries(stats)) {
      const totalVal = typeof val === 'number' ? val * card.count : val;
      const unit = '%';
      const sign = (typeof totalVal === 'number' && totalVal > 0) ? '+' : '';
      chips.push(`<span class="vtt-stat-chip">${statLabels[key] || key} ${sign}${totalVal}${unit} ${tr('(누적)')}</span>`);
    }
    if (chips.length > 0) {
      statsHtml = `<div class="vtt-stats">${chips.join('')}</div>`;
    }
  }

  tooltip.innerHTML = `
    <div class="vtt-header">
      <span class="vtt-icon">${paperCardIconHTML(liveCard)}</span>
      <div class="vtt-title-box">
        <span class="vtt-title">${title}</span>
        <div class="vtt-meta-row">
          <span class="vtt-rarity-pill ${rarity}">${rarityMeta.name}</span>
          <span class="vtt-build-tag">${buildLabel}</span>
        </div>
      </div>
      <span class="vtt-stack-pill ${isMax ? 'is-max' : ''}">${stackLabel}</span>
    </div>
    <div class="vtt-divider"></div>
    <div class="vtt-desc">${desc}</div>
    ${statsHtml}
  `;

  tooltip.classList.remove('hidden');

  // 위치 계산 (세로 슬롯 기준: 슬롯의 우측에 바로 배치하여 가림 방지)
  if (targetEl && targetEl.getBoundingClientRect) {
    const rect = targetEl.getBoundingClientRect();
    const ttWidth = 270;

    // 기본은 슬롯 우측에 10px 띄워서 표시
    let left = rect.right + 10;
    if (left + ttWidth > window.innerWidth - 12) {
      // 오른쪽 화면을 넘어가면 슬롯 왼쪽으로 배치
      left = Math.max(10, rect.left - ttWidth - 10);
    }

    let top = rect.top;
    // 화면 하단을 넘어가면 위로 올리기
    if (top + 180 > window.innerHeight) {
      top = Math.max(10, window.innerHeight - 190);
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
}

function hideDeckTooltip() {
  const tooltip = document.getElementById('deck-vampire-tooltip');
  if (tooltip) {
    tooltip.classList.add('hidden');
  }
}

function renderDeckStripUI() {
  const container = document.getElementById('deck-strip-container');
  const cardsEl = document.getElementById('deck-strip-cards');
  if (!container || !cardsEl || !deckManager) return;

  // 주문서(액티브 스킬 및 자동시전 마법진)는 하단 스킬바에 이미 배치되므로, 좌상단 덱 스트립에서는 패시브 파워업 카드만 표시
  const allCards = deckManager.getActiveCards();
  const passiveCards = allCards.filter(c => !c.spellKey && !c.id.startsWith('spell_'));

  const countEl = document.getElementById('ui-deck-count');
  if (countEl) countEl.textContent = passiveCards.reduce((a, b) => a + (b.count || 1), 0);

  if (passiveCards.length === 0) {
    container.classList.add('hidden');
    cardsEl.innerHTML = '';
    hideDeckTooltip();
    return;
  }

  container.classList.remove('hidden');
  cardsEl.innerHTML = '';

  passiveCards.forEach((c) => {
    const slot = document.createElement('div');
    const rarityClass = `rarity-${c.rarity}`;
    slot.className = `vampire-deck-slot ${rarityClass}`;
    slot.setAttribute('data-card-id', c.id);

    const isMax = (c.count >= (c.maxStack || 1));
    const badgeText = isMax ? 'MAX' : (c.count > 1 ? `x${c.count}` : '');
    const badgeHtml = badgeText ? `<span class="vampire-deck-badge ${isMax ? 'is-max' : ''}">${badgeText}</span>` : '';

    slot.innerHTML = `
      <span class="vampire-deck-icon">${paperCardIconHTML(c)}</span>
      ${badgeHtml}
    `;

    slot.addEventListener('mouseenter', () => showDeckTooltip(c, slot));
    slot.addEventListener('mouseleave', () => hideDeckTooltip());
    slot.addEventListener('click', () => showDeckTooltip(c, slot));

    cardsEl.appendChild(slot);
  });
}

// 전역 함수 등록 및 JSON 파일 비동기 로드 시 실시간 갱신 연동
if (typeof window !== 'undefined') {
  window.renderDeckStripUI = renderDeckStripUI;
  window.addEventListener('deck-cards-updated', () => {
    if (typeof renderDeckStripUI === 'function') {
      renderDeckStripUI();
    }
  });
}

// 각성 창 연출 타이밍(ms). 카드는 한 장씩 펼쳐지고, 다 펼쳐지기 전 클릭(전투 중 연타의 잔여 입력)은 받지 않습니다.
const AWAKENING_DEAL = { first: 320, step: 140, lock: 900, rerollFirst: 40, rerollLock: 450, reducedLock: 250 };
const AWAKENING_EXIT_MS = { normal: 650, legendary: 950, reduced: 200 };
let awakeningModalOpen = false;
let awakeningExiting = false;
let awakeningInputLockUntil = 0;

function prefersReducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function lockAwakeningInput(ms) {
  awakeningInputLockUntil = performance.now() + (prefersReducedMotion() ? AWAKENING_DEAL.reducedLock : ms);
}

function isAwakeningInputLocked() {
  return awakeningExiting || performance.now() < awakeningInputLockUntil;
}

function triggerAwakeningSelection(stageNum, isBossWave = false, onComplete = null) {
  if (!deckManager) {
    releaseCombatHold();
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  awakeningOnComplete = onComplete;
  isCurrentAwakeningBoss = isBossWave;
  state.isPaused = true;
  awakeningModalOpen = true;
  awakeningExiting = false;

  const modal = document.getElementById('awakening-modal-backdrop');
  const titleEl = document.getElementById('awakening-modal-title');
  const subEl = document.querySelector('.awakening-modal-subtitle');

  if (titleEl) {
    titleEl.textContent = isBossWave ? tr('👑 마도서 대각성 (Greater Awakening)') : tr('🔥 마도서 각성 (Grimoire Awakening)');
  }

  if (subEl) {
    subEl.textContent = isBossWave
      ? tr('강력한 페이즈 보스를 물리치고 최고위 마력이 개방되었습니다! (희귀/전설 카드 확정 출현)')
      : tr('고대 화염의 마력이 개방되었습니다. 이번 런을 이끌 각성 카드를 1장 선택하세요!');
  }

  const choices = deckManager.drawChoices(getAwakeningChoiceCount(isBossWave), isBossWave, state);
  renderAwakeningChoicesUI(choices, isBossWave);
  updateRerollButtonUI();
  lockAwakeningInput(AWAKENING_DEAL.lock);

  if (modal) {
    modal.classList.remove('hidden', 'is-exiting');
    // 다시 열 때도 펼침 연출이 처음부터 재생되도록 애니메이션을 다시 겁니다.
    modal.classList.remove('is-dealing');
    void modal.offsetWidth;
    modal.classList.add('is-dealing');
    playSound('proc');
    setBgmBehindWall(true);
  }
}

// 카드 빌드 배지 이름(각성 카드·덱 툴팁). 도감 탭(codex.js)은 짧은 이름을 따로 씁니다.
function getBuildLabel(build) {
  const names = {
    spell: tr('📜 고대 주문서'),
    crit: tr('🎯 극치명 누킹'),
    combustion: tr('☀️ 폭주 극딜'),
    rapid: tr('⚡ 속사 머신건'),
    summon: tr('🔥 정령 군단'),
    burn: tr('♨️ 화상 확산'),
    utility: tr('✨ 유틸리티')
  };
  return names[build] || tr('특수');
}

function renderAwakeningChoicesUI(choices, isBossWave = false, firstDelayMs = AWAKENING_DEAL.first) {
  // 도감: 선택지에 나온 카드는 '발견'으로 남깁니다(다시 뽑기로 나온 카드 포함).
  if (Array.isArray(choices) && recordCardsSeen(state.meta, choices.map((c) => c && c.id))) saveGame();
  const container = document.getElementById('awakening-cards-container');
  if (!container || !deckManager) return;

  const activeDeck = deckManager.getActiveDeck();

  container.innerHTML = choices.map((card, i) => {
    const rarityClass = `rarity-${card.rarity}`;
    const rarityMeta = (typeof RoguelikeDeck !== 'undefined' && RoguelikeDeck.RARITY_META[card.rarity]) || { name: tr('일반') };
    const currentCount = activeDeck[card.id] || 0;
    const stackBadge = currentCount > 0 ? `<div class="card-stack-badge">${tr('보유: {n}/{max}', { n: currentCount, max: card.maxStack })}</div>` : '';

    const buildBadgeText = getBuildLabel(card.build);
    // 연계·주력 빌드 표시는 일부러 두지 않습니다. 어떤 카드가 덱과 맞물리는지는 플레이어가 직접 따져 봅니다(AGENTS.md 1부 4장).

    return `
      <div class="awakening-card ${rarityClass}" data-card-id="${card.id}" style="--deal-delay:${firstDelayMs + i * AWAKENING_DEAL.step}ms">
        <div class="card-rarity-badge">${rarityMeta.name}</div>
        ${stackBadge}
        <div class="card-icon">${paperCardIconHTML(card)}</div>
        <div class="card-name">${cardText(card, 'title')}</div>
        <div class="card-build-tag">${buildBadgeText}</div>
        <div class="card-desc">${cardText(card, 'desc')}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.awakening-card').forEach((cardEl) => {
    cardEl.addEventListener('click', () => {
      if (isAwakeningInputLocked()) return;
      const cardId = cardEl.getAttribute('data-card-id');
      if (cardId) selectAwakeningCard(cardId);
    });
  });
}

function selectAwakeningCard(cardId) {
  if (!deckManager || awakeningExiting) return;
  const success = deckManager.selectCard(cardId, state);
  if (!success) return;
  recordCardPicked(state.meta, cardId); // 도감: 고른 적 있는 카드

  const card = (typeof RoguelikeDeck !== 'undefined') ? RoguelikeDeck.CARD_POOL.find((c) => c.id === cardId) : null;
  playSound('fireball_impact');
  // 카드 효과(주문 해금·덱 반영)는 고르는 순간 바로 적용하고, 눈에 보이는 공개 연출만 창이 닫힌 뒤로 미룹니다.
  updateSkillActionBarVisibility();
  renderDeckStripUI();
  updateLiveHUD();

  // 획득 사실은 덱 트레이·주문 슬롯 팝으로 보여 주고, 몬스터를 가리는 문구는 띄우지 않습니다.
  const reveal = () => {
    if (cardId === 'spell_fireblast') triggerUnfoldPop('skill-2');
    else if (cardId === 'spell_meteor') triggerUnfoldPop('skill-3');
    else if (cardId === 'spell_combustion') triggerUnfoldPop('skill-4');
    else if (cardId === 'spell_flame_patch') triggerUnfoldPop('skill-6');
    else if (cardId === 'sum_spirit') triggerFireSpiritSpawn();
    if (cardId === 'util_auto_grimoire') triggerAutoGrimoireUnfold();
    if (card && card.rarity === 'legendary') {
      triggerArenaShake('md');
      const caster = getCasterCenter();
      spawnParticles(caster.x, caster.y, 22, '#fef08a', '#ea580c', 1.5);
    }
  };
  const cb = typeof awakeningOnComplete === 'function' ? awakeningOnComplete : null;
  awakeningOnComplete = null;

  const finish = () => {
    closeAwakeningModal();
    reveal();
    if (cardId === 'spell_meteor') startMeteorComboCoach();
    if (cb) cb();
  };

  if (!awakeningModalOpen) {
    finish();
    return;
  }
  // 고른 카드가 빛나며 남고 나머지는 물러난 뒤 창이 닫힙니다. 그동안 전투는 멈춘 채로 둡니다.
  holdCombat();
  playAwakeningExit(cardId, card && card.rarity === 'legendary', () => {
    finish();
    holdCombat(ENTRY_BEAT_MS);
  });
}

function playAwakeningExit(cardId, isLegendary, done) {
  awakeningExiting = true;
  const modal = document.getElementById('awakening-modal-backdrop');
  const container = document.getElementById('awakening-cards-container');
  if (container && typeof container.querySelectorAll === 'function') {
    container.querySelectorAll('.awakening-card').forEach((el) => {
      const chosen = el.getAttribute('data-card-id') === cardId;
      el.classList.add(chosen ? 'is-chosen' : 'is-dismissed');
    });
  }
  if (modal) {
    modal.classList.toggle('exit-legendary', Boolean(isLegendary));
    modal.classList.add('is-exiting');
  }
  if (isLegendary) playSound('proc', 1.15);
  const ms = prefersReducedMotion() ? AWAKENING_EXIT_MS.reduced : (isLegendary ? AWAKENING_EXIT_MS.legendary : AWAKENING_EXIT_MS.normal);
  setTimeout(done, ms);
}

// 리롤 기준 비용 = 방금 처치한 스테이지의 기본 처치 골드 (최소 10G) × 업화 단계 배율
function getRerollBaseCost() {
  return Math.round(Math.max(10, getStageData(state.currentStage).gold) * getInfernoModifiers(state.infernoLevel).rerollMult);
}

function updateRerollButtonUI() {
  const btn = document.getElementById('btn-reroll-cards');
  const costEl = document.getElementById('ui-reroll-cost');
  const goldEl = document.getElementById('ui-awakening-gold-amount');
  const goldBox = document.getElementById('ui-awakening-player-gold');
  if (!btn || !costEl || !deckManager) return;

  const cost = deckManager.getRerollCost(getRerollBaseCost());
  costEl.textContent = `💰 ${fmt(cost)} G`;

  const currentGold = Math.floor(state.gold || 0);
  if (goldEl) {
    goldEl.textContent = `${fmt(currentGold)} G`;
  }

  const canAfford = (state.gold >= cost);
  btn.disabled = !canAfford;
  btn.classList.toggle('disabled', !canAfford);
  btn.style.opacity = canAfford ? '1' : '0.5';
  btn.style.cursor = canAfford ? 'pointer' : 'not-allowed';

  if (goldBox) {
    goldBox.classList.toggle('insufficient', !canAfford);
  }
}

function handleAwakeningReroll() {
  if (!deckManager || isAwakeningInputLocked()) return;
  const result = deckManager.reroll(state, isCurrentAwakeningBoss, getRerollBaseCost(), getAwakeningChoiceCount(isCurrentAwakeningBoss));
  if (!result.success) {
    spawnFloatingText(tr('💰 리롤에 필요한 골드가 부족합니다!'), 'fct-normal', -40);
    return;
  }

  playSound('fireball_launch');
  triggerArenaShake('sm');
  updateLiveHUD();
  updateRerollButtonUI();
  renderAwakeningChoicesUI(result.choices, isCurrentAwakeningBoss, AWAKENING_DEAL.rerollFirst);
  // 새 카드는 펼침 연출(.is-dealing)로 다시 한 장씩 뒤집혀 들어옵니다.
  lockAwakeningInput(AWAKENING_DEAL.rerollLock);
}

function closeAwakeningModal() {
  const modal = document.getElementById('awakening-modal-backdrop');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('is-dealing', 'is-exiting');
  }
  awakeningModalOpen = false;
  awakeningExiting = false;
  state.isPaused = false;
  setBgmBehindWall(false);
}

function initAwakeningModalEvents() {
  const rerollBtn = document.getElementById('btn-reroll-cards');
  if (rerollBtn) {
    rerollBtn.addEventListener('click', handleAwakeningReroll);
  }

  const skipBtn = document.getElementById('btn-skip-cards');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      if (isAwakeningInputLocked()) return;
      closeAwakeningModal();
      holdCombat(ENTRY_BEAT_MS);
      if (typeof awakeningOnComplete === 'function') {
        const cb = awakeningOnComplete;
        awakeningOnComplete = null;
        cb();
      }
    });
  }
}

function openVictoryModal(isFirstVictory = false) {
  const modal = document.getElementById('victory-modal');
  const grid = document.getElementById('victory-stats-grid');
  const titleEl = document.getElementById('victory-modal-title');
  const subEl = document.getElementById('victory-modal-subtitle');
  if (!modal || !grid) return;

  // 마도서 숙련도 연출과 새 런 설정(meta-ui.js). 패배 창도 이 함수를 거쳐 같은 영역을 씁니다.
  // 새 런 설정 칸은 타이틀 화면과 함께 쓰므로, 결과창 자리로 되돌려 붙입니다.
  if (typeof mountRunSetup === 'function') mountRunSetup('results');
  if (typeof renderRunProgress === 'function') {
    renderRunProgress();
    renderRunSetup();
    initRunSetupEvents();
  }

  const stats = getPlayerStats();
  modal.classList.remove('defeat-mode');
  document.getElementById('victory-crown-badge').textContent = '👑 VICTORY · SPEEDRUN COMPLETE';
  document.getElementById('btn-speedrun-retry').textContent = tr('⚡ 다시 스피드런 도전하기 (기록 갱신)');
  if (isFirstVictory) {
    titleEl.textContent = tr('👑 {boss} 최초 토벌 완료!', { boss: FINAL_BOSS.title });
    subEl.textContent = tr('불타는 심연의 지배자를 물리쳤습니다! 다시 도전해 스피드런 기록을 단축해 보세요.');
  } else {
    titleEl.textContent = tr('🏆 {boss} 스피드런 기록실', { boss: FINAL_BOSS.name });
    subEl.textContent = tr('새 런을 시작해 더 빠른 토벌 기록에 도전하세요!');
  }

  const lastDur = state.stats?.lastBossKillDuration;
  const lastDiff = state.stats?.lastBossKillDiff;
  let durStr = tr('측정 없음');
  if (typeof lastDur === 'number' && lastDur > 0) {
    if (typeof lastDiff === 'number' && lastDiff > 0.1) {
      durStr = `${tr('{n}초', { n: lastDur.toFixed(1) })} <span style="color:#4ade80; font-weight:800;">${tr('(-{n}초 단축! ⚡)', { n: lastDiff.toFixed(1) })}</span>`;
    } else {
      durStr = tr('{n}초', { n: lastDur.toFixed(1) });
    }
  }

  // 스피드런 이번 도전 vs 역대 최단시간 비교 대시보드 갱신
  const currentValEl = document.getElementById('speedrun-current-val');
  const bestValEl = document.getElementById('speedrun-best-val');
  const resultTagEl = document.getElementById('speedrun-result-tag');
  const diffBannerEl = document.getElementById('speedrun-diff-banner');
  const diffTextEl = document.getElementById('speedrun-diff-text');

  const curSpeedrun = state.stats?.lastSpeedrunTime ?? state.playTimeSec ?? 0;
  const bestSpeedrun = state.bestSpeedrunTime ?? curSpeedrun;
  const prevBest = state.stats?.prevBestSpeedrunTime;
  const isNewRec = Boolean(state.stats?.isNewSpeedrunRecord || (!prevBest && curSpeedrun > 0) || (curSpeedrun > 0 && curSpeedrun <= bestSpeedrun));

  if (currentValEl) {
    currentValEl.textContent = formatSpeedrunTime(curSpeedrun);
  }
  if (bestValEl) {
    bestValEl.textContent = formatSpeedrunTime(bestSpeedrun);
  }

  if (diffBannerEl && diffTextEl) {
    diffBannerEl.classList.remove('record', 'slower');
    if (isNewRec && prevBest && prevBest > curSpeedrun) {
      const diffSec = (prevBest - curSpeedrun).toFixed(1);
      diffBannerEl.classList.add('record');
      diffTextEl.innerHTML = tr('🎉 <b>스피드런 신기록 수립!</b> 이전 최단시간보다 <b>-{n}초</b> 단축! ⚡', { n: diffSec });
      if (resultTagEl) {
        resultTagEl.textContent = '👑 NEW RECORD';
        resultTagEl.style.background = '#ea580c';
      }
    } else if (isNewRec && !prevBest) {
      diffBannerEl.classList.add('record');
      diffTextEl.innerHTML = tr('🌟 <b>{boss} 최초 토벌 기록 수립!</b> 다시 도전하여 기록을 단축해보세요!', { boss: FINAL_BOSS.name });
      if (resultTagEl) {
        resultTagEl.textContent = '🌟 FIRST CLEAR';
        resultTagEl.style.background = '#d97706';
      }
    } else {
      const diffSec = Math.max(0, curSpeedrun - bestSpeedrun).toFixed(1);
      diffBannerEl.classList.add('slower');
      diffTextEl.innerHTML = tr('⏱️ 역대 최단시간 대비 <b>+{n}초</b> 지연 (다음 회차에서 기록 갱신에 도전하세요!)', { n: diffSec });
      if (resultTagEl) {
        resultTagEl.textContent = '⚡ CHALLENGE';
        resultTagEl.style.background = '#475569';
      }
    }
  }

  grid.innerHTML = `
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('보스 처치 시간')}</span>
      <span class="victory-stat-val cyan">${durStr}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('발화 중 몰열 메테오')}</span>
      <span class="victory-stat-val gold">${tr('☄️ {n}회 폭딜', { n: state.stats?.combustionPyros || 0 })}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('최고 달성 DPS')}</span>
      <span class="victory-stat-val gold">${tr('{n} /초', { n: fmt(state.stats?.peakDps || 0) })}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('최종 주문 공격력')}</span>
      <span class="victory-stat-val cyan">${fmt(stats.sp)}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('누적 토벌 몬스터')}</span>
      <span class="victory-stat-val">${tr('{n} 마리', { n: fmt(state.totalKills || 0) })}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('누적 원정 시간')}</span>
      <span class="victory-stat-val">${formatPlayTime(state.totalPlayTimeSec || state.playTimeSec)}</span>
    </div>
  `;

  // 스킬별 누적 딜 지분 미니 바 렌더링
  const logsBarsEl = document.getElementById('victory-logs-bars');
  if (logsBarsEl) {
    const skillsArr = Object.values(state.skillDamage).filter((s) => s.dmg > 0);
    const totalDmg = skillsArr.reduce((a, b) => a + b.dmg, 0);
    if (totalDmg > 0) {
      skillsArr.sort((a, b) => b.dmg - a.dmg);
      logsBarsEl.innerHTML = skillsArr.slice(0, 4).map((s) => {
        const pct = ((s.dmg / totalDmg) * 100).toFixed(1);
        const hits = s.hits || 0;
        const crits = s.crits || 0;
        const critPct = hits > 0 ? ((crits / hits) * 100).toFixed(0) : 0;
        return `
          <div class="victory-log-bar-row">
            <div class="victory-log-bar-fill" style="width:${pct}%; background:${s.color};"></div>
            <span>${s.name} ${tr('({hits}타 · 크리 {pct}%)', { hits, pct: critPct })}</span>
            <span style="color:#fbbf24;">${fmt(s.dmg)} (${pct}%)</span>
          </div>
        `;
      }).join('');
    } else {
      logsBarsEl.innerHTML = `<div style="color:#64748b; font-size:0.75rem; text-align:center;">${tr('전투 기록 집계 중...')}</div>`;
    }
  }

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

// 런이 끝날 때(최종 보스 토벌·광폭화 실패) 한 번만 숙련도를 지급하고,
// 해금된 최고 단계로 최종 보스를 쓰러뜨렸다면 다음 업화 단계를 엽니다. 결과창이 lastRun으로 연출합니다.
function awardRunMastery(finalKilled) {
  const meta = state.meta;
  if (state.runRewarded) return meta.lastRun;
  const xpBefore = meta.xp;
  const gained = getRunMasteryXp({ clearedStage: state.highestClearedStage, finalKilled, infernoLevel: state.infernoLevel, finalStage: FINAL_STAGE });
  meta.xp = xpBefore + gained;
  const had = new Set(getUnlocksAt(xpBefore).map((u) => `${u.type}:${u.id}`));
  const newUnlocks = getUnlocksAt(meta.xp).filter((u) => !had.has(`${u.type}:${u.id}`)).map((u) => ({ type: u.type, id: u.id }));
  let newInferno = null;
  if (finalKilled && state.infernoLevel >= meta.infernoUnlocked && meta.infernoUnlocked < INFERNO_MAX) {
    meta.infernoUnlocked += 1;
    meta.infernoSelected = meta.infernoUnlocked; // 새로 열린 단계를 다음 런 기본값으로 둡니다.
    newInferno = meta.infernoUnlocked;
  }
  // 새로 열린 시작 주문서는 다음 런 기본값으로 둡니다. 칩을 따로 누르지 않아도 방금 해금한 주문서로 런이 달라집니다.
  // (업화 단계로 잠긴 주문서—예: 업화 2단계 전 마력 폭주—는 고를 수 없으므로 기본값으로 두지 않습니다.)
  const usableSpells = getUnlockedStartSpells(meta.xp, meta.infernoUnlocked);
  const newStartSpell = newUnlocks.filter((u) => u.type === 'start' && usableSpells.includes(u.id)).pop();
  if (newStartSpell) meta.startSpell = newStartSpell.id;
  meta.lastRun = { gained, xpBefore, xpAfter: meta.xp, newUnlocks, newInferno, infernoLevel: state.infernoLevel, shown: false };
  state.runRewarded = true;
  state.lockedCards = getLockedCardIds(meta.xp, meta.infernoUnlocked);
  return meta.lastRun;
}

// ==========================================
// 패배 원인 진단: 결과창에 '왜 졌는지'를 한 줄(+아이콘 지표)로 보여 줍니다.
// ==========================================
function createRunDiagnosticStats() {
  return { instantMeteors: 0, heatCooled: 0, meteorMissed: 0, combustionIdle: 0, fireblastCapped: 0 };
}

function addRunStat(key, amount) {
  if (!state.stats) state.stats = {};
  state.stats[key] = (state.stats[key] || 0) + amount;
}

// 진단 기준(위에서부터 먼저 맞는 하나만 고릅니다). 초 단위 기준은 런 전체 누적입니다.
const DEFEAT_DIAG = {
  combustionIdleSec: 20, // 마력 폭주가 이만큼 쉬었으면 지적
  heatCooled: 4,         // 열기 1칸이 이만큼 식었고
  fireblastCappedSec: 10, // 그동안 불꽃 작렬 충전이 가득 차 놀고 있었으면 지적
  lowCrit: 20,           // 메테오가 한 번도 즉시 시전되지 않았고 치명타 확률이 이보다 낮으면 지적
  closeHpPct: 15         // 보스 체력이 이 이하로 남았으면 '아깝다'
};

// 남은 보스 체력(%)과 런 통계로 가장 큰 패배 원인 하나와, 가진 주문에 해당하는 지표 칩을 고릅니다.
function diagnoseDefeat(hpLeftPct) {
  const s = state.stats || {};
  const g = state.grimoires || {};
  const n = (key) => Math.round(s[key] || 0);
  const chips = [];
  if (g.meteor) {
    chips.push({ icon: '☄️', label: tr('즉시 메테오'), value: tr('{n}회', { n: n('instantMeteors') }), bad: n('instantMeteors') === 0 });
    chips.push({ icon: '💨', label: tr('식은 열기'), value: tr('{n}회', { n: n('heatCooled') }), bad: n('heatCooled') >= DEFEAT_DIAG.heatCooled });
    if (n('meteorMissed') > 0) chips.push({ icon: '⌛', label: tr('놓친 메테오'), value: tr('{n}회', { n: n('meteorMissed') }), bad: true });
  }
  if (g.combustion) chips.push({ icon: '☀️', label: tr('마력 폭주 대기'), value: tr('{n}초', { n: n('combustionIdle') }), bad: n('combustionIdle') >= DEFEAT_DIAG.combustionIdleSec });
  if (g.fireblast) chips.push({ icon: '💥', label: tr('불꽃 작렬 충전 가득'), value: tr('{n}초', { n: n('fireblastCapped') }), bad: n('fireblastCapped') >= DEFEAT_DIAG.fireblastCappedSec });

  let cause;
  if (g.meteor && n('meteorMissed') > 0) {
    cause = { key: 'meteor_missed', icon: '☄️', text: tr('준비된 메테오를 {n}번 놓쳤습니다 · 열기 2칸이 켜지면 바로 메테오를 쓰세요', { n: n('meteorMissed') }) };
  } else if (g.combustion && n('combustionIdle') >= DEFEAT_DIAG.combustionIdleSec) {
    cause = { key: 'combustion_idle', icon: '☀️', text: tr('마력 폭주가 {n}초 동안 쉬었습니다 · 쿨이 돌면 바로 쓰세요', { n: n('combustionIdle') }) };
  } else if (g.meteor && g.fireblast && n('heatCooled') >= DEFEAT_DIAG.heatCooled && n('fireblastCapped') >= DEFEAT_DIAG.fireblastCappedSec) {
    cause = { key: 'heat_cooled', icon: '💥', text: tr('열기가 {n}번 식었습니다 · 열기 1칸일 때 불꽃 작렬을 쓰세요', { n: n('heatCooled') }) };
  } else if (g.meteor && n('instantMeteors') === 0 && getPlayerStats().crit < DEFEAT_DIAG.lowCrit) {
    cause = { key: 'low_crit', icon: '🎯', text: tr('치명타 확률이 낮아 메테오 연계가 한 번도 터지지 않았습니다 · 치명타 카드를 노려 보세요') };
  } else if (hpLeftPct <= DEFEAT_DIAG.closeHpPct) {
    cause = { key: 'close', icon: '🔥', text: tr('보스 체력 {n}%만 남았습니다 · 화력 카드 한 장 차이입니다', { n: hpLeftPct }) };
  } else {
    cause = { key: 'firepower', icon: '📖', text: tr('화력이 모자랐습니다 · 한 계열 카드를 몰아 빌드를 완성해 보세요') };
  }
  return { cause, chips };
}

function renderDefeatCause(hpLeftPct) {
  const box = document.getElementById('defeat-cause');
  if (!box) return null;
  const { cause, chips } = diagnoseDefeat(hpLeftPct);
  box.innerHTML = `
    <div class="dc-line"><span class="dc-icon">${cause.icon}</span><span class="dc-text">${cause.text}</span></div>
    ${chips.length ? `<div class="dc-chips">${chips.map((chip) => `<span class="dc-chip${chip.bad ? ' bad' : ''}"><span class="dc-chip-icon">${chip.icon}</span><span class="dc-chip-label">${chip.label}</span><b>${chip.value}</b></span>`).join('')}</div>` : ''}`;
  box.dataset.cause = cause.key;
  box.hidden = false;
  box.classList.remove('dc-pop');
  void box.offsetWidth;
  box.classList.add('dc-pop');
  return cause.key;
}

function failRunByEnrage() {
  if (state.runFailed) return;
  state.runFailed = true;
  state.runEndReason = 'enrage';
  state.isPaused = true;
  playtestTelemetry.onRunFailed(state.currentStage);
  triggerArenaShake('lg');
  playSound('monster_destroy', 0.7);
  spawnFloatingText(tr('💀 광폭화! 런 실패'), 'fct-crit', -60, { isBig: true });
  awardRunMastery(false);
  saveGame();

  // 패배 순간을 1.2초간 인지할 여운을 둔 뒤 결과창 개방
  setTimeout(() => openDefeatModal('enrage'), 1200);
}

// 일시정지 메뉴 › [🏳️ 런 포기]: 지금까지 깬 스테이지만큼 숙련도를 받고 패배 결과창으로 갑니다(광폭화 실패와 같은 보상 규칙).
function abandonRun() {
  if (state.runFailed || state.runRewarded || state.isPaused) return false;
  state.runFailed = true;
  state.runEndReason = 'abandon';
  state.isPaused = true;
  cancelKillBeat();
  playtestTelemetry.onRunFailed(state.currentStage);
  awardRunMastery(false);
  saveGame();
  openDefeatModal('abandon');
  return true;
}

// reason: 'enrage'(보스 광폭화) · 'abandon'(일시정지 메뉴에서 포기)
function openDefeatModal(reason = 'enrage') {
  openVictoryModal(false);
  const modal = document.getElementById('victory-modal');
  const grid = document.getElementById('victory-stats-grid');
  if (!modal || !grid) return;
  modal.classList.add('defeat-mode');

  const data = getStageData(state.currentStage);
  const hpLeftPct = state.monster.maxHp > 0 ? Math.ceil((state.monster.hp / state.monster.maxHp) * 100) : 0;
  const bestStage = getStageData(Math.max(1, state.bestReachedStage || state.currentStage));
  document.getElementById('victory-crown-badge').textContent = tr('💀 DEFEAT · 보스 광폭화');
  document.getElementById('victory-modal-title').textContent = tr('{boss} 광폭화', { boss: data.name });
  document.getElementById('victory-modal-subtitle').textContent = tr('STAGE {phase}-{step} 보스를 제한 시간 안에 쓰러뜨리지 못했습니다. 새 런에서 다른 빌드를 시도해 보세요!', { phase: data.phase, step: data.stepInPhase });
  document.getElementById('btn-speedrun-retry').textContent = tr('⚡ 새 런 시작');
  if (reason === 'abandon') {
    document.getElementById('victory-crown-badge').textContent = tr('🏳️ 런 포기');
    document.getElementById('victory-modal-title').textContent = tr('STAGE {phase}-{step}에서 포기', { phase: data.phase, step: data.stepInPhase });
    document.getElementById('victory-modal-subtitle').textContent = tr('깬 스테이지만큼 숙련도를 얻었습니다. 새 런에서 다른 빌드를 시도해 보세요!');
    const cause = document.getElementById('defeat-cause');
    if (cause) cause.hidden = true;
  } else {
    renderDefeatCause(hpLeftPct);
  }

  grid.innerHTML = `
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('도달 스테이지')}</span>
      <span class="victory-stat-val cyan">STAGE ${data.phase}-${data.stepInPhase} 👑</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('보스 남은 체력')}</span>
      <span class="victory-stat-val gold">${hpLeftPct}%</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('최고 도달 기록')}</span>
      <span class="victory-stat-val gold">STAGE ${bestStage.phase}-${bestStage.stepInPhase}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('최고 달성 DPS')}</span>
      <span class="victory-stat-val gold">${tr('{n} /초', { n: fmt(state.stats?.peakDps || 0) })}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('이번 런 시간')}</span>
      <span class="victory-stat-val">${formatSpeedrunTime(state.playTimeSec)}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">${tr('누적 토벌 몬스터')}</span>
      <span class="victory-stat-val">${tr('{n} 마리', { n: fmt(state.totalKills || 0) })}</span>
    </div>
  `;
}

function closeVictoryModal() {
  const modal = document.getElementById('victory-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('defeat-mode');
  }
  state.isPaused = false;

  // 보스 토벌 후 몬스터가 없는 상태라면 정상 소환
  if (state.monster.hp <= 0) {
    loadStage(state.currentStage);
  }
}

function restartSpeedrunRun() {
  closeVictoryModal();
  cancelKillBeat();
  state.isPaused = false;

  // 1. 스피드런 및 스테이지 진행도 완전 초기화 (단계별 최단시간은 meta.bestTimes에 보존)
  state.currentStage = 1;
  state.highestClearedStage = 0;
  state.gold = 0;
  state.playTimeSec = 0;
  state.campaignCleared = false;
  state.runFailed = false;
  state.runEndReason = null;
  if (typeof closeTitleScreen === 'function') closeTitleScreen(); // 결과창·타이틀 어디서 시작해도 타이틀은 걷힙니다.

  // 업화 단계·해금 카드·단계별 최고 기록: 결과창에서 고른 값으로 새 런을 엽니다.
  const meta = state.meta;
  state.infernoLevel = Math.min(meta.infernoSelected, meta.infernoUnlocked);
  state.lockedCards = getLockedCardIds(meta.xp, meta.infernoUnlocked);
  state.bestSpeedrunTime = meta.bestTimes[state.infernoLevel] ?? null;
  state.runRewarded = false;

  // 2. 주문서 완전 초기화 (기본 화염구 1개로 시작, 자동 시전 설정은 플레이어 선택 유지)
  state.grimoires = {
    fireblast: false,
    meteor: false,
    combustion: false,
    flame_patch: false
  };
  state.spellOrder = ['fireball'];
  state.heatTutorial = false;
  state.skillAuto = {
    fireball: true,
    fireblast: true,
    meteor: true,
    combustion: true,
    flame_patch: true
  };

  // 3. 로그라이크 각성 덱 초기화
  if (deckManager) {
    deckManager.resetDeck(state);
    renderDeckStripUI();
  }
  state.playerStatsBonus = {};
  state.deckMechanics = {};

  // 숙련도로 연 시작 주문서를 고른 경우 첫 스테이지부터 그 주문을 들고 시작합니다.
  const startCard = meta.startSpell && START_SPELL_CARDS[meta.startSpell];
  if (startCard && deckManager && !state.lockedCards.includes(startCard)) {
    deckManager.selectCard(startCard, state);
    renderDeckStripUI();
  }

  // 4. 런 단위 전투 기록 초기화 (결과창 · 밸런스 로그가 이번 런만 집계하도록)
  // 패배 원인 진단용 카운터: 즉시 메테오·식은 열기(1칸)·놓친 메테오 준비(2칸)·마력 폭주 쉰 시간·불꽃 작렬 충전 가득 시간
  state.stats = { peakDps: 0, combustionHits: 0, combustionPyros: 0, ...createRunDiagnosticStats() };
  for (const k of Object.keys(state.skillDamage)) {
    state.skillDamage[k].dmg = 0;
    state.skillDamage[k].hits = 0;
    state.skillDamage[k].crits = 0;
  }
  playtestTelemetry.stageRecords = [];
  playtestTelemetry.failedStage = null;

  // 5. 언폴딩 상태 초반으로 리셋 (명예의 전당은 기록이 남아 있으므로 유지)
  state.unfolded.combatStats = false;

  // 6. 전투 상태 초기화
  state.combat.castingSkill = null;
  state.combat.castRemaining = 0;
  clearQueuedSkill();
  state.combat.gcdRemaining = 0;
  state.combat.critStreak = 0;
  state.combat.streakTimer = 0;
  state.combat.verdictArmed = false;
  state.combat.meteorArmPending = false;
  state.combat.igniteRem = 0;
  state.combat.ignitePool = 0;
  state.combat.meteorBurnRem = 0;
  state.combat.flamePatchRem = 0;
  state.combat.elemTimer = 0;
  state.combat.phoenixTimer = 0;

  projectiles.length = 0;
  meteors.length = 0;
  particles.length = 0;
  shockwaves.length = 0;
  groundEffects.length = 0;
  rockDebris.length = 0;

  const s3 = document.getElementById('skill-3');
  if (s3) s3.classList.remove('proc-glow');

  // 7. 연출: 황금빛 스파크 & 1-1 새로 로드
  playSound('proc');
  const casterCenter = getCasterCenter();
  spawnParticles(casterCenter.x, casterCenter.y, 36, '#fef08a', '#ea580c', 1.8);
  triggerArenaShake('md');

  spawnFloatingText(tr('⚡ 스피드런 새 런 시작! (Stage 1-1 · 타이머 00:00)'), 'fct-proc', -55, { isBig: true });

  loadStage(1);
  checkAndTriggerUnfolds(true);
  updateSkillActionBarVisibility();
  saveGame();
  updateLiveHUD();

  renderSpeedrunTimer(0);
  updateNotificationBadges();
}

// ==========================================
// 17. 메인 게임 루프 (60 FPS)
// ==========================================
let lastTime = performance.now();
let uiRefreshAccum = 0;

function gameLoop(nowMs) {
  // 경과 시간은 0~0.1초로 제한합니다(첫 프레임 시각이 기준 시각보다 앞서면 음수가 되어 연출 시간이 거꾸로 흐름).
  const dt = Math.max(0, Math.min(0.1, (nowMs - lastTime) / 1000));
  lastTime = Math.max(lastTime, nowMs);
  // Esc 일시정지 메뉴(pause-menu.js): 모달 정지보다 강하게 전부 멈춥니다. 투사체·파티클·전장 애니메이션도 마지막 장면에서 멈춥니다.
  if (typeof isMenuPaused === 'function' && isMenuPaused()) {
    requestAnimationFrame(gameLoop);
    return;
  }
  if (arenaEnvironment) {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    arenaEnvironment.update(dt, state.isPaused || document.hidden, reduced);
  }

  if (typeof isTitleOpen === 'function' && isTitleOpen()) {
    // 타이틀 화면: 전투·쿨다운·스피드런 시계는 멈추고, 마법사 호흡과 전장 배경만 흐릅니다.
    try {
      updateMageMotion(dt, false);
      updateAndDrawVfx(dt);
    } catch (e) {}
    requestAnimationFrame(gameLoop);
    return;
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

  if (isCombatHeld()) {
    // 연출 호흡: 전투·쿨다운·스피드런 시계는 멈추고, 마법사 호흡과 사망 잔상·골드 비행은 계속 흐릅니다.
    try {
      updateBurningLoopSound();
      updateMageMotion(dt, false);
      updateAndDrawVfx(dt);
      updateLiveHUD();
      updateHpTrailUI(dt); // 처치 여운 동안에도 마지막 한 방의 잔상이 줄어드는 걸 보여 줍니다.
    } catch (e) {}
    requestAnimationFrame(gameLoop);
    return;
  }

  state.playTimeSec = (state.playTimeSec || 0) + dt;
  state.totalPlayTimeSec = (state.totalPlayTimeSec || 0) + dt;
  renderSpeedrunTimer(state.playTimeSec);

  const c = state.combat;
  const stats = getPlayerStats();

  updateBossGimmick(dt);

  // 페이즈 보스 광폭화: 제한 시간 안에 처치하지 못하면 런 실패
  if (c.bossEnrageRem !== null && c.bossEnrageRem !== undefined && !state.monster.isDying) {
    c.bossEnrageRem = Math.max(0, c.bossEnrageRem - dt);
    if (c.bossEnrageRem <= 0) {
      failRunByEnrage();
      requestAnimationFrame(gameLoop);
      return;
    }
  }

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

  // 로그라이크 덱 소환수 공격 주기 (마법사 시전 속도에 비례)
  if (state.deckMechanics && state.deckMechanics.spiritCount > 0) {
    c.elemTimer += dt * stats.speedMult;
    if (c.elemTimer >= 1.3) {
      c.elemTimer -= 1.3;
      fireElementalAttack();
    }
  }

  if (state.deckMechanics && state.deckMechanics.phoenixAwake) {
    c.phoenixTimer += dt * stats.speedMult;
    if (c.phoenixTimer >= 2.4) {
      c.phoenixTimer -= 2.4;
      firePhoenixAttack();
    }
  }

  if (state.grimoires.fireblast && c.fbCharges < c.fbMaxCharges) {
    c.fbRechargeRem -= dt;
    if (c.fbRechargeRem <= 0) {
      const prevCharges = c.fbCharges;
      c.fbCharges++;
      if (c.fbCharges < c.fbMaxCharges) {
        c.fbRechargeTotal = Math.max(3.5, (FIREBLAST_RECHARGE * (1 - stats.cdr)) / stats.speedMult);
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
  // 진단: 쓸 수 있는데 쉬고 있는 시간(마력 폭주 쿨 완료, 불꽃 작렬 충전 가득)
  if (state.grimoires.combustion && c.combustionCdRem <= 0 && c.combustionRem <= 0) addRunStat('combustionIdle', dt);
  if (state.grimoires.fireblast && c.fbCharges >= c.fbMaxCharges) addRunStat('fireblastCapped', dt);
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
    if (c.meteorCdRem === 0 && c.wasOnCd[3]) {
      triggerReadyFlash('skill-3');
      c.wasOnCd[3] = false;
    } else {
      c.wasOnCd[3] = true;
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
    if (c.critStreak === 2 && !c.meteorArmPending) c.meteorArmedAge += dt;
    // 안전장치: 날아가던 두 번째 열기 숫자가 사라졌다면 바로 무장합니다.
    if (c.meteorArmPending && !floatingTexts.some((f) => f.heatSigil === 1)) armMeteorInstant(true);
    if (c.streakTimer <= 0) {
      addRunStat(c.critStreak === 2 ? 'meteorMissed' : 'heatCooled', 1);
      extinguishHeatSigils(c.critStreak);
      c.critStreak = 0;
      c.meteorArmPending = false;
    }
  }

  if (c.igniteRem > 0) {
    c.igniteRem = Math.max(0, c.igniteRem - dt);
    c.igniteTickTimer += dt;
    // 남은 틱 수로 풀을 나눠 소모하고, 지속 시간이 끝나면 남은 피해를 한 번에 정산합니다.
    if (c.igniteTickTimer >= IGNITE_TICK || c.igniteRem <= 0) {
      c.igniteTickTimer = c.igniteRem <= 0 ? 0 : c.igniteTickTimer - IGNITE_TICK;
      const ticksLeft = c.igniteRem <= 0 ? 1 : Math.max(1, Math.ceil(c.igniteRem / IGNITE_TICK));
      const tickBase = c.ignitePool / ticksLeft;
      c.ignitePool -= tickBase;
      if (tickBase * stats.burnMult >= 1) {
        dealDamage('ignite', tickBase * stats.burnMult, false, false, true);
      }
    }
  }

  if (c.meteorBurnRem > 0) {
    c.meteorBurnRem = Math.max(0, c.meteorBurnRem - dt);
    c.meteorBurnTickTimer += dt;
    if (c.meteorBurnTickTimer >= 0.85) {
      c.meteorBurnTickTimer -= 0.85;
      dealDamage('meteor', stats.sp * 0.35 * stats.burnMult, false, false, true);
    }
  }

  if (c.flamePatchRem > 0) {
    c.flamePatchRem = Math.max(0, c.flamePatchRem - dt);
    c.flamePatchTickTimer += dt;
    if (c.flamePatchTickTimer >= 0.5) {
      c.flamePatchTickTimer -= 0.5;
      dealDamage('flame_patch', getFlamePatchTickDamage(stats), false, false, true);
    }
  }

  try {
    updateCastingLoopSound();
    updateBurningLoopSound();
    processQueuedSkill(dt);
    runSmartAutoCast();
    updateMageMotion(dt, false);
    updateAndDrawVfx(dt);
    updateLiveHUD();
    updateHpTrailUI(dt);
  } catch (loopErr) {
    console.error('gameLoop internal error:', loopErr);
  }

  uiRefreshAccum += dt;
  if (uiRefreshAccum >= 0.25) {
    uiRefreshAccum = 0;
    try {
      updatePeriodicUI();
    } catch (e) {}
  }

  requestAnimationFrame(gameLoop);
}

// ==========================================
// 18. 실시간 HUD 업데이트
// ==========================================
// HP 바 피해 잔상(hp-trail.js). 시계는 전투가 흐르는 동안의 dt로만 갑니다(updateHpTrailUI).
const hpTrail = typeof createHpTrail === 'function' ? createHpTrail() : null;
const HP_CHUNK_MAX = 3; // 동시에 번쩍이는 흰 조각 상한(연속 큰 한 방에도 화면 공해 방지)

// 큰 한 방이 깎은 구간을 흰 조각으로 번쩍이고, HP 바를 한 번 눌렀다 튕깁니다.
function showHpBigHitChunk(hit) {
  const layer = document.getElementById('target-hp-chunks');
  if (!layer || !hit || typeof document.createElement !== 'function') return;
  while (layer.children && layer.children.length >= HP_CHUNK_MAX && layer.firstChild) layer.removeChild(layer.firstChild);
  const chunk = document.createElement('div');
  chunk.className = 'hp-chunk';
  chunk.style.left = `${hit.to}%`;
  chunk.style.width = `${hit.from - hit.to}%`;
  layer.appendChild(chunk);
  setTimeout(() => { if (chunk.parentNode) chunk.parentNode.removeChild(chunk); }, 450);
  const bar = document.getElementById('target-hp-bar');
  if (bar && !prefersReducedMotion()) {
    bar.classList.remove('hp-big-hit');
    void bar.offsetWidth; // 연속 큰 한 방에도 눌림 연출을 처음부터 다시 재생
    bar.classList.add('hp-big-hit');
  }
}

function updateHpTrailUI(dt) {
  if (!hpTrail) return;
  const trail = document.getElementById('target-hp-trail');
  if (trail) trail.style.width = `${hpTrail.update(dt)}%`;
}

// 새 몬스터: 잔상과 흰 조각을 지웁니다.
function resetHpTrailUI() {
  if (!hpTrail) return;
  hpTrail.reset(100);
  const layer = document.getElementById('target-hp-chunks');
  if (layer) layer.innerHTML = '';
  const trail = document.getElementById('target-hp-trail');
  if (trail) trail.style.width = '100%';
}

function updateLiveHUD() {
  const stats = getPlayerStats();
  const c = state.combat;

  // 골드 동전이 곡선 비행하여 상단 알약 UI에 하나씩 닿을 때마다 숫자가 차르륵 올라가도록 표시!
  // 남은 시간 보너스(pendingBonusGold)는 처치 동전과 따로 셉니다. 처치 동전이 다 닿아도 보너스 동전이 날아오기 전까지는 숫자에 넣지 않습니다.
  const pendingGold = Math.min(state.gold, Math.max(0, state.pendingCoinGold || 0) + Math.max(0, state.pendingBonusGold || 0));
  const displayedGold = Math.max(0, Math.round(state.gold - pendingGold));
  document.getElementById('ui-gold').textContent = fmt(displayedGold);

  updatePityCritBadgeUI();
  document.getElementById('ui-sp').textContent = fmt(stats.sp);
  document.getElementById('ui-crit').textContent = `${stats.crit.toFixed(1)}%`;
  document.getElementById('ui-haste').textContent = `+${stats.haste.toFixed(0)}%`;

  const hpPct = Math.max(0, Math.min(100, (state.monster.hp / state.monster.maxHp) * 100));
  document.getElementById('target-hp-fill').style.width = `${hpPct}%`;
  updateEmberVerdictBadge();
  const bigHit = hpTrail ? hpTrail.setHp(hpPct) : null;
  if (bigHit) showHpBigHitChunk(bigHit);
  document.getElementById('target-hp-text').textContent = `${fmt(state.monster.hp)} / ${fmt(state.monster.maxHp)}`;
  document.getElementById('target-hp-pct').textContent = `${hpPct.toFixed(0)}%`;

  const casterAvatar = document.getElementById('caster-avatar');
  const combBg = document.getElementById('combustion-bg');
  const isMeteorReady =
    c.castingSkill === 'meteor' || isMeteorInstantReady();

  casterAvatar.classList.toggle('casting-active', Boolean(c.castingSkill) && !isMeteorReady);
  casterAvatar.classList.toggle('pyro-ready-mode', isMeteorReady);
  casterAvatar.classList.toggle('combustion-mode', c.combustionRem > 0);
  combBg.classList.toggle('active', c.combustionRem > 0);

  // 발화(마력 폭주) 피버 모드 & 연계 신호는 실제 치명타와 발화 상태를 그대로 따라갑니다.
  const arenaArt = document.getElementById('combat-arena');
  arenaArt.classList.toggle('fever-mode', c.combustionRem > 0);
  arenaArt.classList.toggle('art-combustion', c.combustionRem > 0);
  arenaArt.classList.toggle('art-hot-streak', isMeteorInstantReady());
  const heatSigils = document.getElementById('heat-sigils');
  heatSigils.hidden = !state.grimoires.meteor;
  heatSigils.dataset.heat = String(c.critStreak);
  heatSigils.setAttribute('aria-label', tr('연속 치명타 {n}회', { n: c.critStreak }));
  document.getElementById('skill-2').classList.toggle('art-followup', Boolean(state.grimoires.meteor && c.critStreak === 1 && c.fbCharges > 0));
  document.getElementById('skill-4').classList.toggle('art-active', c.combustionRem > 0);

  const castFill = document.getElementById('castbar-fill');
  const castWrapper = castFill ? castFill.parentElement : null;
  const castName = document.getElementById('castbar-name');
  const castTime = document.getElementById('castbar-time');
  if (castWrapper) castWrapper.classList.toggle('pyro-cast', isMeteorReady);
  if (castFill) castFill.classList.toggle('pyro-cast', isMeteorReady);

  const isGatlingActive = Boolean(state.deckMechanics && state.deckMechanics.gatlingMode);
  if (c.castingSkill) {
    const progress = ((c.castTotal - c.castRemaining) / c.castTotal) * 100;
    castFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    if (c.castingSkill === 'meteor') {
      castName.textContent = tr('☄️ 메테오 시전 중');
    } else if (isMeteorReady) {
      castName.textContent = isGatlingActive ? tr('⚡ 화염 기관총 (☄️메테오 장전됨!)') : tr('🔥 화염구 (☄️메테오 장전됨!)');
    } else if (isGatlingActive) {
      castName.textContent = tr('⚡ 화염 기관총 난사!');
    } else {
      castName.textContent = tr('🔥 화염구');
    }
    castTime.textContent = isGatlingActive ? `${c.castRemaining.toFixed(2)}s` : `${c.castRemaining.toFixed(1)}s`;
  } else if (isMeteorInstantReady()) {
    castFill.style.width = '100%';
    castName.textContent = tr('☄️ 메테오 준비 완료!');
    castTime.textContent = tr('즉시 발사!');
  } else {
    castFill.style.width = '0%';
    castName.textContent = state.autoCast ? tr('🤖 자동 시전 중') : tr('대기 중');
    castTime.textContent = '';
  }

  const buffRow = document.getElementById('player-buffs');
  let buffsHtml = '';
  if (c.combustionRem > 0) {
    buffsHtml += `<div class="buff-chip combustion">${tr('☀️ 마력 폭주 ({sec}s)', { sec: c.combustionRem.toFixed(1) })}</div>`;
  }
  buffRow.innerHTML = buffsHtml;

  // 충전형 카드의 남은 충전은 해당 스킬 버튼 위 배지로 표시
  setStageChargeBadge('skill-1', c.quickdrawCharges, '🎇', tr('속사 장전: 시전 없이 즉시 발사'));
  setStageChargeBadge('skill-3', c.meteorCharges, '🔋', tr('잠열 충전: 메테오 피해 증폭'));

  const enrageEl = document.getElementById('boss-enrage-timer');
  if (enrageEl) {
    const enrageActive = c.bossEnrageRem !== null && c.bossEnrageRem !== undefined;
    enrageEl.classList.toggle('hidden', !enrageActive);
    if (enrageActive) {
      maybeShowEnrageIntro();
      const enrageTotal = getStageData(state.currentStage).enrage || 1;
      enrageEl.classList.toggle('danger', c.bossEnrageRem <= 10 && !c.timeBonusDraining);
      document.getElementById('boss-enrage-time').textContent = `${Math.ceil(c.bossEnrageRem)}s`;
      document.getElementById('boss-enrage-fill').style.width = `${Math.max(0, Math.min(100, (c.bossEnrageRem / enrageTotal) * 100))}%`;
    }
  }

  const debuffRow = document.getElementById('target-debuffs');
  let debuffHtml = '';
  if (c.igniteRem > 0 && c.ignitePool >= 5) {
    debuffHtml += `<div class="debuff-chip">${tr('🩸 화상 {dmg} ({sec}s)', { dmg: fmt(c.ignitePool * stats.burnMult), sec: c.igniteRem.toFixed(1) })}</div>`;
  }
  if (c.flamePatchRem > 0) {
    debuffHtml += `<div class="debuff-chip">${tr('🔥 불장판 ({sec}s)', { sec: c.flamePatchRem.toFixed(1) })}</div>`;
  }
  if (c.meteorBurnRem > 0) {
    debuffHtml += `<div class="debuff-chip">${tr('☄️ 연소 ({sec}s)', { sec: c.meteorBurnRem.toFixed(1) })}</div>`;
  }
  debuffRow.innerHTML = debuffHtml;

  // 몸에 붙은 종이 불꽃: 화상·연소 중 걸린 개수만큼(최대 2개) 몸 가운데 살짝 오른쪽 발밑부터 왼쪽으로 번지며 타오릅니다.
  // 불장판은 바닥 균열 무늬로만 보여 주고 몸에 불꽃을 붙이지 않습니다.
  const burnStatus = document.getElementById('burn-status');
  if (burnStatus) {
    const burnLevel = String((c.igniteRem > 0 && c.ignitePool >= 5 ? 1 : 0) + (c.meteorBurnRem > 0 ? 1 : 0));
    if (burnStatus.dataset.level !== burnLevel) burnStatus.dataset.level = burnLevel;
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
    const isMeteorProc = isMeteorInstantReady();
    btn3.classList.toggle('proc-glow', isMeteorProc);
    if (state.grimoires.meteor) {
      setRadialSweep(document.getElementById('gcd-3'), isMeteorProc ? 0 : c.gcdRemaining, c.gcdTotal, false);
    }
  }

  if (state.grimoires.combustion) {
    setRadialSweep(document.getElementById('cd-4'), c.combustionCdRem, c.combustionCdTotal, true);
  }

  if (state.grimoires.meteor) {
    setRadialSweep(document.getElementById('cd-3'), isMeteorInstantReady() ? 0 : c.meteorCdRem, c.meteorCdTotal, true);
  }

  if (state.grimoires.flame_patch) {
    setRadialSweep(document.getElementById('cd-6'), c.flamePatchCdRem, c.flamePatchCdTotal, true);
  }
}

function setStageChargeBadge(btnId, count, icon, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  let badge = btn.querySelector('.skill-stage-charge');
  if (!badge) {
    if (!count) return;
    badge = document.createElement('span');
    badge.className = 'skill-stage-charge';
    btn.appendChild(badge);
  }
  badge.classList.toggle('hidden', !count);
  if (count) {
    const text = `${icon}${count}`;
    if (badge.textContent !== text) {
      badge.textContent = text;
      badge.setAttribute('aria-label', tr('{label} {n}회', { label, n: count }));
      // 충전이 소모될 때마다 작게 튕기는 피드백
      badge.classList.remove('charge-pop');
      void badge.offsetWidth;
      badge.classList.add('charge-pop');
    }
  }
}

function updatePeriodicUI() {
  // 6초 DPS 측정 창 밖의 오래된 피해 기록 정리
  const now = performance.now() / 1000;
  state.dpsHistory = state.dpsHistory.filter((entry) => now - entry.time <= 6.0);

  renderSpeedrunTimer(state.playTimeSec);

  updateNotificationBadges();
}

// ==========================================
// 19. 세이브 / 로드 & 이벤트 바인딩
// ==========================================
function saveGame() {
  try {
    const payload = {
      gold: state.gold,
      currentStage: state.currentStage,
      highestClearedStage: state.highestClearedStage,
      playTimeSec: state.playTimeSec,
      totalPlayTimeSec: state.totalPlayTimeSec || state.playTimeSec,
      totalKills: state.totalKills,
      campaignCleared: state.campaignCleared,
      bestSpeedrunTime: state.bestSpeedrunTime || null,
      bestReachedStage: state.bestReachedStage || 0,
      runFailed: state.runFailed,
      runEndReason: state.runEndReason,
      infernoLevel: state.infernoLevel,
      runRewarded: state.runRewarded,
      meta: state.meta,
      bossClearTimes: state.bossClearTimes,
      autoCast: state.autoCast,
      skillAuto: state.skillAuto,
      soundOn: state.soundOn,
      masterVolume: state.masterVolume,
      bgmVolume: state.bgmVolume,
      sfxVolume: state.sfxVolume,
      motionPref: typeof getMotionPref === 'function' ? getMotionPref() : 'system',
      unfolded: state.unfolded,
      grimoires: state.grimoires,
      stats: state.stats,
      spellOrder: state.spellOrder || ['fireball'],
      activeDeck: deckManager ? deckManager.getActiveDeck() : {}
    };
    saveStorage.write(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

// 저장 데이터는 현재 시스템에 필요한 필드만 복원하고, 제거된 구형 시스템 필드는 무시합니다.
function loadGame() {
  try {
    const raw = saveStorage.read(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.spellOrder)) state.spellOrder = [...data.spellOrder];
    if (typeof data.gold === 'number') state.gold = data.gold;
    if (typeof data.currentStage === 'number') state.currentStage = Math.max(1, Math.min(FINAL_STAGE, data.currentStage));
    if (typeof data.highestClearedStage === 'number') state.highestClearedStage = Math.min(FINAL_STAGE, data.highestClearedStage);
    if (typeof data.playTimeSec === 'number') state.playTimeSec = data.playTimeSec;
    if (typeof data.totalPlayTimeSec === 'number') state.totalPlayTimeSec = data.totalPlayTimeSec;
    else if (typeof data.playTimeSec === 'number') state.totalPlayTimeSec = data.playTimeSec;
    if (typeof data.totalKills === 'number') state.totalKills = data.totalKills;
    if (typeof data.campaignCleared === 'boolean') state.campaignCleared = data.campaignCleared;
    if (typeof data.bestSpeedrunTime === 'number') state.bestSpeedrunTime = data.bestSpeedrunTime;
    if (typeof data.bestReachedStage === 'number') state.bestReachedStage = data.bestReachedStage;
    if (typeof data.runFailed === 'boolean') state.runFailed = data.runFailed;
    if (data.runEndReason === 'enrage' || data.runEndReason === 'abandon') state.runEndReason = data.runEndReason;
    // 영구 진행: 구형 세이브의 bestSpeedrunTime은 0단계 기록으로 옮깁니다.
    state.meta = normalizeMeta(data.meta, data.bestSpeedrunTime);
    state.infernoLevel = Math.min(clampInferno(data.infernoLevel), state.meta.infernoUnlocked);
    state.runRewarded = data.runRewarded === true;
    state.lockedCards = getLockedCardIds(state.meta.xp, state.meta.infernoUnlocked);
    state.bestSpeedrunTime = state.meta.bestTimes[state.infernoLevel] ?? null;
    if (data.bossClearTimes) state.bossClearTimes = Object.assign({}, data.bossClearTimes);
    if (typeof data.autoCast === 'boolean') state.autoCast = data.autoCast;
    if (data.skillAuto) Object.assign(state.skillAuto, data.skillAuto);
    if (typeof data.soundOn === 'boolean') state.soundOn = data.soundOn;
    if (typeof data.masterVolume === 'number') state.masterVolume = Math.max(0, Math.min(1, data.masterVolume));
    if (typeof data.bgmVolume === 'number') state.bgmVolume = Math.max(0, Math.min(1, data.bgmVolume));
    if (typeof data.sfxVolume === 'number') state.sfxVolume = Math.max(0, Math.min(1, data.sfxVolume));
    if (typeof data.motionPref === 'string' && typeof setMotionPref === 'function') setMotionPref(data.motionPref);
    if (data.unfolded) {
      for (const key of Object.keys(state.unfolded)) {
        if (typeof data.unfolded[key] === 'boolean') state.unfolded[key] = data.unfolded[key];
      }
    }
    if (data.grimoires) {
      for (const key of Object.keys(state.grimoires)) {
        if (typeof data.grimoires[key] === 'boolean') state.grimoires[key] = data.grimoires[key];
      }
    }
    if (data.stats) {
      for (const key of ['peakDps', 'combustionHits', 'combustionPyros', 'lastBossKillDuration', 'lastBossKillDiff', 'lastSpeedrunTime', 'prevBestSpeedrunTime', 'isNewSpeedrunRecord']) {
        if (data.stats[key] !== undefined) state.stats[key] = data.stats[key];
      }
    }
    if (data.activeDeck && deckManager) {
      deckManager.restoreDeck(data.activeDeck, state);
    }
    saveGame();
  } catch (e) {}
}

function initEvents() {
  initSkillTooltips();
  if (typeof initActionBarDrag === 'function') initActionBarDrag();
  document.getElementById('dummy-avatar').addEventListener('click', () => {
    if (isMeteorInstantReady()) {
      requestManualSkill('meteor');
    } else {
      requestManualSkill('fireball');
    }
  });

  document.querySelectorAll('.skill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skill = btn.getAttribute('data-skill');
      requestManualSkill(skill);
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const skill = btn.getAttribute('data-skill');
      if (skill) {
        toggleSkillAuto(skill);
      }
    });
  });

  window.addEventListener('keydown', (e) => {
    // 숫자키 1~6 입력 시 현재 활성화된 스킬 순서(동적 단축키)에 따라 발동
    const keyMatch = e.code.match(/^(?:Digit|Numpad)([1-6])$/) || (e.key && e.key.match(/^([1-6])$/));
    if (keyMatch) {
      const slotIndex = parseInt(keyMatch[1], 10) - 1;
      const activeSpells = getActiveSpellList();
      if (slotIndex >= 0 && slotIndex < activeSpells.length) {
        requestManualSkill(activeSpells[slotIndex]);
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
      requestManualSkill(skill);
    }
  });

  document.getElementById('btn-auto-cast').addEventListener('click', () => {
    state.autoCast = !state.autoCast;
    updateSkillActionBarVisibility();
    updateNotificationBadges();
    saveGame();
  });

  const speedrunRetryBtn = document.getElementById('btn-speedrun-retry');
  if (speedrunRetryBtn) {
    speedrunRetryBtn.addEventListener('click', () => {
      playSound('proc');
      restartSpeedrunRun();
    });
  }

  const victoryCloseBtn = document.getElementById('btn-victory-close');
  if (victoryCloseBtn) {
    victoryCloseBtn.addEventListener('click', () => {
      playSound('item_select');
      closeVictoryModal();
    });
  }

  // 사운드 조절은 설정 화면(settings-menu.js)의 사운드 묶음에 있습니다.
  const muteAllBtn = document.getElementById('btn-sound-mute-all');
  const masterSlider = document.getElementById('slider-master-vol');
  const bgmSlider = document.getElementById('slider-bgm-vol');
  const sfxSlider = document.getElementById('slider-sfx-vol');

  if (muteAllBtn) {
    muteAllBtn.addEventListener('click', () => {
      state.soundOn = !state.soundOn;
      if (state.soundOn && state.masterVolume === 0) {
        state.masterVolume = 1.0;
      }
      updateSoundUI();
      updateBgmPlayback();
      updateCastingLoopSound();
      updateBurningLoopSound();
      saveGame();
    });
  }

  if (masterSlider) {
    masterSlider.addEventListener('input', () => {
      state.masterVolume = Math.max(0, Math.min(1, Number(masterSlider.value) / 100));
      if (state.masterVolume > 0 && !state.soundOn) {
        state.soundOn = true;
      }
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

  // 플레이테스트 밸런스 텔레메트리 클립보드 복사 이벤트
  // 밸런스 로그(플레이테스트 텔레메트리)는 웹 플레이테스트와 개발 실행용입니다. Steam 배포 빌드에서는 버튼을 없앱니다.
  if (window.desktopApp && window.desktopApp.isPackaged) {
    ['btn-export-telemetry', 'btn-victory-export-telemetry'].forEach((id) => document.getElementById(id)?.remove());
  }
  const exportTelemetryBtn = document.getElementById('btn-export-telemetry');
  if (exportTelemetryBtn) {
    exportTelemetryBtn.addEventListener('click', () => playtestTelemetry.copyToClipboard());
  }

  const victoryExportBtn = document.getElementById('btn-victory-export-telemetry');
  if (victoryExportBtn) {
    victoryExportBtn.addEventListener('click', () => playtestTelemetry.copyToClipboard());
  }

  // 로그라이크 마도서 각성 모달 이벤트 초기화
  initAwakeningModalEvents();

  // 최종 보스 토벌 트래커 및 스토리 툴팁 이벤트 초기화
  initDoomTrackerEvents();
}

// HTML 정적 문구 속 최종 보스 이름을 FINAL_BOSS 한 곳의 정의와 동기화합니다.
function applyFinalBossNames() {
  document.querySelectorAll('.final-boss-name').forEach((el) => { el.textContent = FINAL_BOSS.name; });
}

function initDoomTrackerEvents() {
  const trackerEl = document.getElementById('doom-tracker');
  if (!trackerEl) return;

  trackerEl.addEventListener('click', (e) => {
    trackerEl.classList.toggle('story-open');
  });

  document.addEventListener('click', (e) => {
    if (!trackerEl.contains(e.target)) {
      trackerEl.classList.remove('story-open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      trackerEl.classList.remove('story-open');
    }
  });
}

// ==========================================
// 20. 초기화 실행
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  applyFinalBossNames();
  // 세이브가 없으면 첫 실행: 타이틀에 [시작] 하나만 보여 줍니다.
  const hadSave = Boolean(saveStorage.read(SAVE_KEY));
  loadGame();
  const environmentCanvas = document.getElementById('arena-environment-canvas');
  const arena = document.getElementById('combat-arena');
  if (environmentCanvas) {
    arenaEnvironment = createArenaEnvironment(environmentCanvas, arena);
  }
  checkAndTriggerUnfolds(true);
  updateSoundUI();
  updateSkillActionBarVisibility();
  resizeCanvas();
  initEvents();
  if (typeof initPauseMenu === 'function') initPauseMenu();
  if (typeof initSettingsMenu === 'function') initSettingsMenu();
  if (typeof initCodex === 'function') initCodex();
  updateBgmPlayback();
  loadStage(state.currentStage);
  updatePityCritBadgeUI();
  updateSkillAutoUI();
  renderDeckStripUI();
  updateDoomProgressUI(state.currentStage);
  updateNotificationBadges();
  // 끝난 런의 결과창은 타이틀의 [이어하기]가 엽니다(결과를 아직 못 봤을 때).
  if (typeof initTitleScreen === 'function') {
    initTitleScreen(hadSave);
    openTitleScreen();
  } else if (state.runFailed) {
    state.isPaused = true;
    openDefeatModal(state.runEndReason || 'enrage');
  }
  requestAnimationFrame(gameLoop);
});
