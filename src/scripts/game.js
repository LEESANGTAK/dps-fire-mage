/**
 * DPS: Fire Mage - 로그라이크 덱빌딩 스피드런
 * - Stage 1 ~ 20을 몬스터 1회 처치마다 자동 진행하며, 웨이브 클리어 시 마도서 각성 카드 3지선다 선택
 * - 런 단위 성장은 각성 카드 덱이 전담하고, Stage 20 라그나로스 토벌 시간을 스피드런 기록으로 남김
 */

const SAVE_KEY = 'MAGE_SLAYER_STAGE_SAVE_V7';

// ==========================================
// 1. 스테이지 몬스터 데이터베이스 (5스테이지 = 1페이즈)
// ==========================================
const STAGE_MONSTERS = [
  // PHASE 1 (Stage 1 ~ 5)
  { stage: 1, name: '초원 풀숲 슬라임', emoji: '🟢', hp: 500, gold: 4, firstBonus: 2 },
  { stage: 2, name: '푸른 늪지 슬라임', emoji: '🔵', hp: 1050, gold: 7, firstBonus: 4 },
  { stage: 3, name: '들판 거대 들쥐', emoji: '🐀', hp: 1800, gold: 12, firstBonus: 8 },
  { stage: 4, name: '고블린 정찰병', emoji: '👺', hp: 2750, gold: 20, firstBonus: 14 },
  { stage: 5, name: '붉은송곳니 군주', emoji: '🐗', hp: 8200, gold: 35, firstBonus: 35, enrage: 110 },

  // PHASE 2 (Stage 6 ~ 10)
  { stage: 6, name: '잿빛 숲 늑대', emoji: '🐺', hp: 5700, gold: 52, firstBonus: 40 },
  { stage: 7, name: '놀 야수사냥꾼', emoji: '🏹', hp: 7550, gold: 80, firstBonus: 60 },
  { stage: 8, name: '폐광 해골 광부', emoji: '💀', hp: 9350, gold: 125, firstBonus: 90 },
  { stage: 9, name: '맹독 모래전갈', emoji: '🦂', hp: 11800, gold: 190, firstBonus: 140 },
  { stage: 10, name: '동굴 오우거 대족장', emoji: '👹', hp: 28500, gold: 300, firstBonus: 260, enrage: 160 },

  // PHASE 3 (Stage 11 ~ 15)
  { stage: 11, name: '화염 비늘 도마뱀', emoji: '🦎', hp: 18600, gold: 460, firstBonus: 350 },
  { stage: 12, name: '심연 흡혈박쥐', emoji: '🦇', hp: 23000, gold: 700, firstBonus: 500 },
  { stage: 13, name: '고대 바위 파수꾼', emoji: '🗿', hp: 27800, gold: 1050, firstBonus: 800 },
  { stage: 14, name: '타락한 어둠마법사', emoji: '🧙', hp: 33000, gold: 1600, firstBonus: 1200 },
  { stage: 15, name: '붉은 화염 비룡', emoji: '🐉', hp: 75000, gold: 2500, firstBonus: 2200, enrage: 210 },

  // PHASE 4 (Stage 16 ~ 20)
  { stage: 16, name: '저주받은 기사단원', emoji: '⚔️', hp: 54400, gold: 3800, firstBonus: 3000 },
  { stage: 17, name: '원한 서린 밴시', emoji: '👻', hp: 69000, gold: 5800, firstBonus: 4500 },
  { stage: 18, name: '지하군주 거대거미', emoji: '🕷️', hp: 92000, gold: 8800, firstBonus: 7000 },
  { stage: 19, name: '심연의 파멸수호병', emoji: '👿', hp: 109000, gold: 13500, firstBonus: 11000 },
  { stage: 20, name: '화염군주 라그나로스', emoji: '🔥', hp: 225000, gold: 22000, firstBonus: 25000, enrage: 270 }
];

const FINAL_STAGE = STAGE_MONSTERS.length;

function getStageData(stageNum) {
  const stage = Math.max(1, Math.min(FINAL_STAGE, stageNum));
  const phase = Math.ceil(stage / 5);
  const stepInPhase = ((stage - 1) % 5) + 1;
  return {
    ...STAGE_MONSTERS[stage - 1],
    phase,
    stepInPhase,
    isPhaseBoss: stepInPhase === 5
  };
}

// ==========================================
// 2. 주문 보조 판정
// ==========================================
// 마법사 기본 능력치 (각성 카드 % 보너스의 기준값)
const BASE_SPELL_POWER = 100;
const BASE_CRIT = 5;
const BASE_CRIT_DMG = 1.5;
const FIREBLAST_RECHARGE = 8.0; // 불꽃 작렬 1회 충전 시간(초)
const IGNITE_DURATION = 5.0; // 화상 지속 시간(초) - 치명타 적중 시 갱신
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
  bgmVolume: 0.4,
  sfxVolume: 0.8,

  // 최근 6초 피해량 기반 실시간 DPS (최고 DPS 기록용)
  currentDps: 0,
  lastCombatTime: 0,

  // 로그라이크 마도서 각성 (Grimoire Awakening) 런 단위 상태
  playerStatsBonus: {},
  deckMechanics: {},
  spellOrder: ['fireball'],

  // 점진적 언폴딩(Unfolding) 해금 상태
  unfolded: {
    awakening: false,
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
    summon_phoenix: { name: '🦅 불사조', dmg: 0, hits: 0, crits: 0, color: '#facc15' }
  },

  // 스피드런 결과창 전투 기록
  stats: {
    peakDps: 0,
    combustionHits: 0,
    combustionPyros: 0
  },

  // 최종 보스(Stage 20 라그나로스) 불의 심장 보호막 상태
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
    cdr: 0,
    speedMult: 1 + haste / 100,
    burnMult: Math.max(0, 1 + (bonus.burnPct || 0) / 100),
    spiritMult: Math.max(0, 1 + (bonus.spiritPct || 0) / 100)
  };
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
// 5. 사운드 매니저 (BGM / SFX 볼륨 개별 조절 & 교차 루프 재생)
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
  { title: '선술집의 변덕 A', src: 'assets/sounds/bgm/Tavern Whimsy.mp3' },
  { title: '선술집의 변덕 B', src: 'assets/sounds/bgm/Tavern Whimsy (1).mp3' }
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

function getActorGroundPos(id) {
  const arena = document.getElementById('combat-arena').getBoundingClientRect();
  const actor = document.getElementById(id).getBoundingClientRect();
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

      if (sIdx === 0) {
        ctx.font = 'bold 10px Pretendard, sans-serif';
        ctx.fillStyle = '#fed7aa';
        ctx.fillText(elemLv > 1 ? `불의 정령 x${elemLv}` : `불의 정령`, 0, Math.round(24 * cfg.scale));
      }

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

  // 3. 불장판 (몬스터 이미지 뒤쪽/발밑 바닥 레이어 #ground-vfx-canvas 에 1.5배 넓어진 화염 지대 렌더링!)
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
    if (oldest && oldest.el) oldest.el.remove();
  }

  const pos = extraOpts.anchor === 'caster' ? getCasterCenter() : getTargetPos();
  const isCrit = styleClass === 'fct-crit';
  const isDot = styleClass === 'fct-dot';
  const isNormal = styleClass === 'fct-normal';
  const isGold = styleClass === 'fct-gold';
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
  const rewardEl = document.getElementById('target-reward');
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

      state.pendingCoinGold = Math.max(0, (state.pendingCoinGold || 0) - c.share);
      if (flyingCoins.length === 0) {
        state.pendingCoinGold = 0;
      }
      triggerGoldPillPulse();
      playSound('drop_coin');
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
function loadStage(stageNum) {
  state.currentStage = Math.max(1, Math.min(FINAL_STAGE, stageNum));
  playtestTelemetry.onStageStart(state.currentStage);
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

  // 충전형 카드: 스테이지 시작마다 충전 횟수를 다시 채움
  const mech = state.deckMechanics || {};
  state.combat.quickdrawCharges = mech.quickdrawCharges || 0;
  state.combat.meteorCharges = mech.meteorCharges || 0;

  // 페이즈 보스 광폭화 제한 시간
  state.combat.bossEnrageRem = data.isPhaseBoss ? data.enrage : null;
  state.bestReachedStage = Math.max(state.bestReachedStage || 0, state.currentStage);

  // 라그나로스 불의 심장 보호막 상태 초기화
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
  const isRagnarosKill = state.currentStage === FINAL_STAGE;
  const isFirstRagnarosKill = isRagnarosKill && !state.campaignCleared;
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
        spawnFloatingText(`⚡ 보스 기록 단축! -${diff.toFixed(2)}초 (${duration.toFixed(2)}s)`, 'fct-crit', -70, { isBig: true });
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

    if (data.isPhaseBoss) {
      spawnFloatingText('👑 보스 격파!', 'fct-proc', -60);
      playSound('proc');
    }
  }

  state.gold += totalGold;

  if (isRagnarosKill) {
    state.campaignCleared = true;
    const curTime = state.playTimeSec || 0;
    state.stats = state.stats || {};
    state.stats.lastSpeedrunTime = curTime;
    const prevBest = state.bestSpeedrunTime || null;
    state.stats.prevBestSpeedrunTime = prevBest;
    const isNewRecord = !prevBest || curTime < prevBest;
    state.stats.isNewSpeedrunRecord = isNewRecord;
    if (isNewRecord) {
      state.bestSpeedrunTime = curTime;
      triggerSpeedrunRecordFlash();
      spawnFloatingText(`🏆 라그나로스 스피드런 신기록! (${formatSpeedrunTime(curTime)})`, 'fct-crit', -90, { isBig: true });
    }
  }

  checkAndTriggerUnfolds(false);

  // 골드는 상단 배너(#target-reward)에서 #pill-gold로 곡선 비행 흡수!
  spawnGoldCoinFlight(totalGold, isFirstClear || data.isPhaseBoss);

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

  if (isRagnarosKill) {
    // 하스스톤 스타일 라그나로스 대폭발 & 드라마틱 여운 (Breathing Room)
    state.isPaused = true;
    playSound('proc');
    spawnFloatingText(
      isFirstRagnarosKill ? '👑 화염군주 라그나로스 최초 토벌!' : '👑 화염군주 라그나로스 토벌 완료!',
      'fct-crit',
      -60,
      { isBig: true }
    );

    // 1.3초간 보스 파괴 연출과 진동 여운을 감상할 충분한 호흡을 둔 뒤 스피드런 결과 모달 개방!
    setTimeout(() => {
      openVictoryModal(isFirstRagnarosKill);
    }, 1300);

    saveGame();
    return;
  }

  // 웨이브 클리어 ➔ 0.6초 피격/사망 여운 후 마도서 각성 3지선다 카드 선택 트리거!
  const clearedStage = state.currentStage;
  setTimeout(() => {
    triggerAwakeningSelection(clearedStage, data.isPhaseBoss, () => {
      loadStage(clearedStage + 1);
      const nextData = getStageData(state.currentStage);
      spawnFloatingText(
        nextData.isPhaseBoss ? '👑 보스 구역 자동 진입!' : '🚀 다음 도전 자동 진입!',
        'fct-proc',
        -50
      );
      respawnMonsterPop();
      saveGame();
    });
  }, 600);
  saveGame();
}

// ==========================================
// 9. 데미지 적용 & 연쇄 치명타(몰아치는 열기) 판정
// ==========================================
let lastHeavyKnockbackTime = 0;
let hitDirectionCounter = 0;
let lastDotShiverTime = 0;

function dealDamage(skillKey, rawDamage, isCrit, canTriggerStreak = true, isDotTick = false, isCombustionCast = false) {
  const isCombustingEffective = Boolean((state.combat && state.combat.combustionRem > 0) || isCombustionCast);

  // 3-1. 최종 보스(Stage 20 라그나로스) 전용 기믹 판정
  // (일반 몬스터 및 중간 보스 기믹은 로그라이크 덱빌딩 코어 루프와 스피드런 집중을 위해 전면 배제)
  const bg = state.bossGimmick;
  if (state.currentStage === FINAL_STAGE && bg && bg.shield > 0) {
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

  if (isDotTick || skillKey === 'ignite') {
    spawnFloatingText(`${fmt(dmg)}`, 'fct-dot', 5);
  } else if (isCrit) {
    spawnFloatingText(`${fmt(dmg)}!`, 'fct-crit', -8, { isBig: isBigSkill });
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

  if (isCrit && !isDotTick && skillKey !== 'ignite') {
    // 화상은 '남은 피해량' 풀: 치명타마다 피해의 일정 비율이 더해지고 지속 시간이 갱신되며, 틱마다 나눠 소모됩니다.
    const igniteRatioMult = (state.deckMechanics && state.deckMechanics.igniteRatioMult) || 1;
    state.combat.ignitePool += dmg * IGNITE_RATIO * igniteRatioMult;
    state.combat.igniteRem = IGNITE_DURATION;

    // 로그라이크 덱: 불사조의 가호 (치명타 시 15% 확률로 전 스킬 쿨다운 즉시 리셋)
    if (state.deckMechanics && (state.deckMechanics.phoenixReset || state.deckMechanics.phoenix_reset) && Math.random() < 0.15) {
      state.combat.fbCharges = state.combat.fbMaxCharges;
      state.combat.fbRechargeRem = 0;
      state.combat.meteorCdRem = 0;
      state.combat.combustionCdRem = 0;
      state.combat.flamePatchCdRem = 0;
      spawnFloatingText('🪶 불사조의 가호! 전 스킬 쿨다운 초기화!', 'fct-proc', -55, { isBig: true, anchor: 'caster' });
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
    const isCrit = effectiveCrit >= 100 || Math.random() * 100 < effectiveCrit;
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
    if (c.critStreak === 2) {
      c.critStreak = 0;
      c.streakTimer = 0;
      releaseMeteor(isManual);
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
    if (!state.grimoires.flame_patch) return false;
    if (c.flamePatchCdRem > 0) return false;

    const patchCdMult = (state.deckMechanics && state.deckMechanics.patchCooldownMult) || 1;
    c.flamePatchCdTotal = Math.max(4.5, 10 * patchCdMult * (1 - stats.cdr));
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
    if (state.combat.critStreak === 2 && isSkillAutoActive('meteor') && state.grimoires.meteor) {
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

function isSkillAutoActive(skillKey) {
  if (!state.autoCast) return false;
  if (!state.skillAuto) return true;
  return state.skillAuto[skillKey] !== false;
}

function runSmartAutoCast() {
  if (!state.autoCast) return;
  const c = state.combat;

  if (state.grimoires.combustion && isSkillAutoActive('combustion') && c.combustionCdRem <= 0) {
    triggerSkill('combustion', false);
  }
  if (state.grimoires.flame_patch && isSkillAutoActive('flame_patch') && c.flamePatchCdRem <= 0) {
    triggerSkill('flame_patch', false);
  }

  // 1. 몰아치는 열기 (즉시 시전 메테오): 몰열 2스택 상태라면 최우선 발사!
  if (state.grimoires.meteor && isSkillAutoActive('meteor') && c.critStreak === 2) {
    triggerSkill('meteor', false);
  }

  // 2. 불꽃 작렬 (확정 치명타): 1스택일 때 즉시 2스택 완성 유도 또는 완충 시 즉시 소모
  if (state.grimoires.fireblast && isSkillAutoActive('fireblast') && c.fbCharges > 0) {
    if (!state.grimoires.meteor || c.critStreak === 1 || c.fbCharges >= c.fbMaxCharges) {
      triggerSkill('fireblast', false);
    }
  }

  // 3. 일반 화염구 기본 시전 (몰열 2스택 대기 중이 아닐 때)
  if (
    isSkillAutoActive('fireball') &&
    !c.castingSkill &&
    c.gcdRemaining <= 0 &&
    !(state.grimoires.meteor && c.critStreak === 2)
  ) {
    triggerSkill('fireball', false);
  }
}

function toggleSkillAuto(skillKey) {
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

  for (const [key, btn] of Object.entries(autoMap)) {
    if (!btn) continue;
    const isAuto = state.skillAuto ? state.skillAuto[key] !== false : true;
    let badge = btn.querySelector('.skill-auto-badge');
    if (!badge) {
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
      badge.classList.toggle('is-auto', isAuto);
      badge.classList.toggle('is-manual', !isAuto);
      badge.textContent = isAuto ? 'AUTO' : '수동';
      badge.setAttribute('aria-label', `${isAuto ? '자동' : '수동'} 시전 모드`);
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
  setBadge('badge-skill-1', manualMode && !c.castingSkill && c.gcdRemaining <= 0 && state.dpsHistory.length === 0);
  setBadge(
    'badge-skill-2',
    state.grimoires.fireblast && c.fbCharges > 0 && (c.critStreak === 1 || (manualMode && c.fbCharges >= 2))
  );
  setBadge('badge-skill-3', state.grimoires.meteor && c.critStreak === 2);
  setBadge('badge-skill-4', manualMode && state.grimoires.combustion && c.combustionCdRem <= 0);
  setBadge('badge-skill-6', manualMode && state.grimoires.flame_patch && c.flamePatchCdRem <= 0);
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

  // 1. 첫 몬스터 처치 또는 첫 골드 획득 시: 마도서 각성 시스템 개방 안내
  if (!u.awakening && (state.gold >= 4 || state.highestClearedStage >= 1)) {
    u.awakening = true;
    changed = true;
    if (!silent) {
      showUnfoldToast('🔥 마도서 각성 시스템 개방!', '웨이브를 돌파할 때마다 3장의 각성 카드를 선택하여 나만의 빌드를 완성하세요!');
    }
  }

  // 2. 첫 각성 카드 획득 시: 치명타/시전속도 스탯 알약 개방
  const hasAnyCard = Boolean(deckManager && Object.keys(deckManager.getActiveDeck()).length > 0);
  if (!u.combatStats && hasAnyCard) {
    u.combatStats = true;
    changed = true;
    triggerUnfoldPop('pill-crit');
    triggerUnfoldPop('pill-haste');
  }

  // 3. Stage 20(화염군주 라그나로스) 클리어 시: 상단 명예의 전당(스피드런 기록) 버튼 개방
  if (!u.hallOfFame && state.campaignCleared) {
    u.hallOfFame = true;
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
  const pillCrit = document.getElementById('pill-crit');
  const pillHaste = document.getElementById('pill-haste');
  const hallBtn = document.getElementById('btn-hall-of-fame');
  if (pillCrit) pillCrit.classList.toggle('unfold-hidden', !u.combatStats);
  if (pillHaste) pillHaste.classList.toggle('unfold-hidden', !u.combatStats);
  if (hallBtn) hallBtn.classList.toggle('unfold-hidden', !u.hallOfFame);
}

const SPELL_ACTION_CONFIG = {
  fireball: { id: 'skill-1', icon: '🔥', name: '화염구' },
  fireblast: { id: 'skill-2', icon: '💥', name: '불꽃 작렬' },
  meteor: { id: 'skill-3', icon: '☄️', name: '메테오' },
  combustion: { id: 'skill-4', icon: '☀️', name: '마력 폭주' },
  flame_patch: { id: 'skill-6', icon: '♨️', name: '불장판' }
};

function getActiveSpellList() {
  state.spellOrder = state.spellOrder || ['fireball'];
  // 새로 습득한 주문은 습득 순서대로 단축키 뒤쪽에 추가
  ['fireblast', 'meteor', 'combustion', 'flame_patch'].forEach((s) => {
    if (state.grimoires[s] && !state.spellOrder.includes(s)) {
      state.spellOrder.push(s);
    }
  });
  return state.spellOrder.filter((s) => s === 'fireball' || state.grimoires[s]);
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
      if (autoBtnText) autoBtnText.textContent = '🤖 자동: ON';
    } else {
      autoBtn.className = 'auto-cast-btn has-badge-anchor';
      if (autoBtnText) autoBtnText.textContent = '🤖 자동: OFF';
    }
  }

  updateAutoCastMagicCircle();
  updateSkillAutoUI();
}

function updateAutoCastMagicCircle() {
  const circleEl = document.getElementById('autocast-magic-circle');
  if (!circleEl) return;
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
  const isCleared = state.currentStage <= state.highestClearedStage;
  const monsterFrame = document.getElementById('monster-frame');
  monsterFrame.classList.toggle('boss-frame', data.isPhaseBoss);

  const stageBanner = document.getElementById('arena-stage-banner');
  if (stageBanner) {
    stageBanner.classList.toggle('boss-banner', data.isPhaseBoss);
  }

  document.getElementById('target-stage-tag').textContent = data.isPhaseBoss
    ? `👑 BOSS [STAGE ${data.phase}-${data.stepInPhase}]`
    : `STAGE ${data.phase}-${data.stepInPhase}`;

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

  const dispGold = isCleared ? data.gold : data.gold + data.firstBonus;
  document.getElementById('target-reward').textContent = `💰 ${fmt(dispGold)} G`;

  const timerEl = document.getElementById('ui-speedrun-timer');
  if (timerEl) {
    timerEl.textContent = formatSpeedrunTime(state.playTimeSec);
  }

  updateBossGimmick(0);
  updateNotificationBadges();
  updateRagnarosProgressUI();
}

// ==========================================
// 15-A. 라그나로스 세계 멸망 저지 진척도 UI 시스템
// ==========================================
function updateRagnarosProgressUI(stageNum) {
  const currentStage = Math.max(1, Math.min(FINAL_STAGE, stageNum !== undefined ? stageNum : state.currentStage));
  const trackerEl = document.getElementById('ragnaros-doom-tracker');
  if (!trackerEl) return;

  const pct = Math.min(100, Math.round((currentStage / FINAL_STAGE) * 100));
  const isFinalBattle = currentStage === FINAL_STAGE;

  // 1. 스테이지 텍스트 갱신
  const stageDispEl = document.getElementById('ragnaros-stage-display');
  if (stageDispEl) {
    stageDispEl.textContent = isFinalBattle
      ? `STAGE ${FINAL_STAGE} / ${FINAL_STAGE} (🔥최종 결전!)`
      : `STAGE ${currentStage} / ${FINAL_STAGE}`;
  }

  // 2. 게이지 바 & 마법사 핀 위치 동기화
  const fillEl = document.getElementById('ragnaros-track-fill');
  if (fillEl) {
    fillEl.style.width = `${pct}%`;
  }
  const casterPinEl = document.getElementById('ragnaros-caster-pin');
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
  const remainEl = document.getElementById('ragnaros-remain-text');
  if (remainEl) {
    remainEl.textContent = isFinalBattle
      ? `🔥 불의 군주 강림! 지금 세계를 구원하십시오!`
      : `남은 여정: ${FINAL_STAGE - currentStage} 스테이지`;
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
// 15-B. 최종 보스(라그나로스) 불의 심장 보호막 기믹
// ==========================================
function updateBossGimmick(dt) {
  const bg = state.bossGimmick;
  if (!bg) return;
  const stage = state.currentStage;
  const badge = document.getElementById('boss-gimmick-badge');

  // 최종 보스(Stage 20 라그나로스) 불의 심장 보호막만 최종 관문으로 유지
  // (일반 몬스터 및 중간 보스는 덱 시너지 집중을 위해 불필요한 기믹 배지 완전 제거)
  if (stage === FINAL_STAGE) {
    if (bg.shield > 0) {
      bg.shieldTimer -= dt;
      if (badge) {
        badge.classList.remove('hidden');
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
  } else {
    if (badge) badge.classList.add('hidden');
  }
}

// ==========================================
// 16. Stage 20(화염군주 라그나로스) 토벌 스피드런 결과 모달
// ==========================================
function formatSpeedrunTime(sec) {
  const total = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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
  const title = liveCard.title || card.title;
  const icon = liveCard.icon || card.icon;
  const rarity = liveCard.rarity || card.rarity;
  const build = liveCard.build || card.build;
  const maxStack = liveCard.maxStack || card.maxStack || 1;
  const desc = liveCard.desc || card.desc || '';
  const stats = liveCard.stats || card.stats;

  const rarityMeta = (typeof RoguelikeDeck !== 'undefined' && RoguelikeDeck.RARITY_META[rarity]) || { name: rarity, color: '#94a3b8' };
  const buildNames = {
    rapid: '⚡ 속사 머신건',
    crit: '🎯 극치명 누킹',
    summon: '🔥 정령 군단',
    utility: '✨ 유틸리티'
  };
  const buildLabel = buildNames[build] || build;
  const isMax = card.count >= maxStack;
  const stackLabel = isMax ? 'MAX' : `중첩 ${card.count} / ${maxStack}`;

  // 누적 스탯 칩 계산
  let statsHtml = '';
  if (stats && typeof stats === 'object') {
    const chips = [];
    const statLabels = {
      sp: '주문력',
      haste: '가속도',
      crit: '치명타율',
      critDmg: '치명피해',
      goldBonus: '골드보너스'
    };
    for (const [key, val] of Object.entries(stats)) {
      // 치명피해·골드보너스는 배율(0.6 = +60%)로 저장되므로 백분율로 환산해 표시
      const isRatio = key === 'critDmg' || key === 'goldBonus';
      const totalVal = typeof val === 'number' ? Math.round(val * card.count * (isRatio ? 100 : 1) * 10) / 10 : val;
      const unit = (key === 'sp') ? '' : '%';
      const sign = (typeof totalVal === 'number' && totalVal > 0) ? '+' : '';
      chips.push(`<span class="vtt-stat-chip">${statLabels[key] || key} ${sign}${totalVal}${unit} (누적)</span>`);
    }
    if (chips.length > 0) {
      statsHtml = `<div class="vtt-stats">${chips.join('')}</div>`;
    }
  }

  tooltip.innerHTML = `
    <div class="vtt-header">
      <span class="vtt-icon">${icon}</span>
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
      <span class="vampire-deck-icon">${c.icon}</span>
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

function triggerAwakeningSelection(stageNum, isBossWave = false, onComplete = null) {
  if (!deckManager) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  awakeningOnComplete = onComplete;
  isCurrentAwakeningBoss = isBossWave;
  state.isPaused = true;

  const modal = document.getElementById('awakening-modal-backdrop');
  const tagEl = document.getElementById('awakening-wave-tag');
  const titleEl = document.getElementById('awakening-modal-title');
  const subEl = document.querySelector('.awakening-modal-subtitle');

  if (tagEl) {
    const phase = Math.floor((stageNum - 1) / 5) + 1;
    const wave = ((stageNum - 1) % 5) + 1;
    tagEl.textContent = isBossWave ? `👑 STAGE ${stageNum} 보스 돌파 특별 보상` : `STAGE ${phase}-${wave} 돌파 보상`;
    tagEl.className = isBossWave ? 'awakening-wave-tag boss' : 'awakening-wave-tag';
  }

  if (titleEl) {
    titleEl.textContent = isBossWave ? '👑 마도서 대각성 (Greater Awakening)' : '🔥 마도서 각성 (Grimoire Awakening)';
  }

  if (subEl) {
    subEl.textContent = isBossWave
      ? '강력한 페이즈 보스를 물리치고 최고위 마력이 개방되었습니다! (희귀/전설 카드 확정 출현)'
      : '고대 화염의 마력이 개방되었습니다. 이번 런을 이끌 각성 카드를 1장 선택하세요!';
  }

  const choices = deckManager.drawChoices(3, isBossWave, state);
  renderAwakeningChoicesUI(choices, isBossWave);
  updateRerollButtonUI();

  if (modal) {
    modal.classList.remove('hidden');
    playSound('proc');
  }
}

function renderAwakeningChoicesUI(choices, isBossWave = false) {
  const container = document.getElementById('awakening-cards-container');
  if (!container || !deckManager) return;

  const activeDeck = deckManager.getActiveDeck();

  container.innerHTML = choices.map((card) => {
    const rarityClass = `rarity-${card.rarity}`;
    const rarityMeta = (typeof RoguelikeDeck !== 'undefined' && RoguelikeDeck.RARITY_META[card.rarity]) || { name: '일반' };
    const currentCount = activeDeck[card.id] || 0;
    const stackBadge = currentCount > 0 ? `<div class="card-stack-badge">보유: ${currentCount}/${card.maxStack}</div>` : '';

    let buildBadgeText = '특수';
    if (typeof RoguelikeDeck !== 'undefined') {
      if (card.build === RoguelikeDeck.BUILD.RAPID) buildBadgeText = '⚡ 속사 머신건';
      else if (card.build === RoguelikeDeck.BUILD.CRIT) buildBadgeText = '🎯 극치명 누킹';
      else if (card.build === RoguelikeDeck.BUILD.SUMMON) buildBadgeText = '🔥 정령 군단';
      else if (card.build === RoguelikeDeck.BUILD.UTILITY) buildBadgeText = '✨ 유틸리티';
    }

    return `
      <div class="awakening-card ${rarityClass}" data-card-id="${card.id}">
        <div class="card-rarity-badge">${rarityMeta.name}</div>
        ${stackBadge}
        <div class="card-icon">${card.icon}</div>
        <div class="card-name">${card.title}</div>
        <div class="card-build-tag">${buildBadgeText}</div>
        <div class="card-desc">${card.desc}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.awakening-card').forEach((cardEl) => {
    cardEl.addEventListener('click', () => {
      const cardId = cardEl.getAttribute('data-card-id');
      if (cardId) selectAwakeningCard(cardId);
    });
  });
}

function selectAwakeningCard(cardId) {
  if (!deckManager) return;
  const success = deckManager.selectCard(cardId, state);
  if (!success) return;

  const card = (typeof RoguelikeDeck !== 'undefined') ? RoguelikeDeck.CARD_POOL.find((c) => c.id === cardId) : null;
  playSound('fireball_impact');
  if (card) {
    spawnFloatingText(`✨ [${card.title}] 각성 획득!`, 'fct-proc', -60, { isBig: true });
  }

  if (cardId === 'spell_fireblast') triggerUnfoldPop('skill-2');
  else if (cardId === 'spell_meteor') triggerUnfoldPop('skill-3');
  else if (cardId === 'spell_combustion') triggerUnfoldPop('skill-4');
  else if (cardId === 'spell_flame_patch') triggerUnfoldPop('skill-6');
  else if (cardId === 'sum_spirit') triggerFireSpiritSpawn();

  updateSkillActionBarVisibility();
  closeAwakeningModal();
  renderDeckStripUI();
  updateLiveHUD();

  if (typeof awakeningOnComplete === 'function') {
    const cb = awakeningOnComplete;
    awakeningOnComplete = null;
    cb();
  }
}

// 리롤 기준 비용 = 방금 처치한 스테이지의 기본 처치 골드 (최소 10G)
function getRerollBaseCost() {
  return Math.max(10, getStageData(state.currentStage).gold);
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
  if (!deckManager) return;
  const result = deckManager.reroll(state, isCurrentAwakeningBoss, getRerollBaseCost());
  if (!result.success) {
    spawnFloatingText('💰 리롤에 필요한 골드가 부족합니다!', 'fct-normal', -40);
    return;
  }

  playSound('fireball_launch');
  triggerArenaShake('sm');
  updateLiveHUD();
  updateRerollButtonUI();
  renderAwakeningChoicesUI(result.choices, isCurrentAwakeningBoss);

  const container = document.getElementById('awakening-cards-container');
  if (container) {
    container.classList.remove('cards-shuffle-pop');
    void container.offsetWidth;
    container.classList.add('cards-shuffle-pop');
  }
}

function closeAwakeningModal() {
  const modal = document.getElementById('awakening-modal-backdrop');
  if (modal) modal.classList.add('hidden');
  state.isPaused = false;
}

function initAwakeningModalEvents() {
  const rerollBtn = document.getElementById('btn-reroll-cards');
  if (rerollBtn) {
    rerollBtn.addEventListener('click', handleAwakeningReroll);
  }

  const skipBtn = document.getElementById('btn-skip-cards');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      closeAwakeningModal();
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

  const stats = getPlayerStats();
  modal.classList.remove('defeat-mode');
  document.getElementById('victory-crown-badge').textContent = '👑 VICTORY · SPEEDRUN COMPLETE';
  document.getElementById('btn-speedrun-retry').textContent = '⚡ 다시 스피드런 도전하기 (기록 갱신)';
  if (isFirstVictory) {
    titleEl.textContent = '👑 화염군주 라그나로스 최초 토벌 완료!';
    subEl.textContent = '불타는 심연의 지배자를 물리쳤습니다! 다시 도전해 스피드런 기록을 단축해 보세요.';
  } else {
    titleEl.textContent = '🏆 라그나로스 스피드런 기록실';
    subEl.textContent = '새 런을 시작해 더 빠른 토벌 기록에 도전하세요!';
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
      diffTextEl.innerHTML = `🎉 <b>스피드런 신기록 수립!</b> 이전 최단시간보다 <b>-${diffSec}초</b> 단축! ⚡`;
      if (resultTagEl) {
        resultTagEl.textContent = '👑 NEW RECORD';
        resultTagEl.style.background = '#ea580c';
      }
    } else if (isNewRec && !prevBest) {
      diffBannerEl.classList.add('record');
      diffTextEl.innerHTML = `🌟 <b>라그나로스 최초 토벌 기록 수립!</b> 다시 도전하여 기록을 단축해보세요!`;
      if (resultTagEl) {
        resultTagEl.textContent = '🌟 FIRST CLEAR';
        resultTagEl.style.background = '#d97706';
      }
    } else {
      const diffSec = Math.max(0, curSpeedrun - bestSpeedrun).toFixed(1);
      diffBannerEl.classList.add('slower');
      diffTextEl.innerHTML = `⏱️ 역대 최단시간 대비 <b>+${diffSec}초</b> 지연 (다음 회차에서 기록 갱신에 도전하세요!)`;
      if (resultTagEl) {
        resultTagEl.textContent = '⚡ CHALLENGE';
        resultTagEl.style.background = '#475569';
      }
    }
  }

  grid.innerHTML = `
    <div class="victory-stat-item">
      <span class="victory-stat-label">보스 처치 시간</span>
      <span class="victory-stat-val cyan">${durStr}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">발화 중 몰열 메테오</span>
      <span class="victory-stat-val gold">☄️ ${state.stats?.combustionPyros || 0}회 폭딜</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">최고 달성 DPS</span>
      <span class="victory-stat-val gold">${fmt(state.stats?.peakDps || 0)} /초</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">최종 주문 공격력</span>
      <span class="victory-stat-val cyan">${fmt(stats.sp)}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">누적 토벌 몬스터</span>
      <span class="victory-stat-val">${fmt(state.totalKills || 0)} 마리</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">누적 원정 시간</span>
      <span class="victory-stat-val">${formatPlayTime(state.totalPlayTimeSec || state.playTimeSec)}</span>
    </div>
  `;

  // WarcraftLogs 스킬별 누적 딜 지분 미니 바 렌더링
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
            <span>${s.name} (${hits}타 · 크리 ${critPct}%)</span>
            <span style="color:#fbbf24;">${fmt(s.dmg)} (${pct}%)</span>
          </div>
        `;
      }).join('');
    } else {
      logsBarsEl.innerHTML = '<div style="color:#64748b; font-size:0.75rem; text-align:center;">전투 기록 집계 중...</div>';
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

function failRunByEnrage() {
  if (state.runFailed) return;
  state.runFailed = true;
  state.isPaused = true;
  playtestTelemetry.onRunFailed(state.currentStage);
  triggerArenaShake('lg');
  playSound('monster_destroy', 0.7);
  spawnFloatingText('💀 광폭화! 런 실패', 'fct-crit', -60, { isBig: true });
  saveGame();

  // 패배 순간을 1.2초간 인지할 여운을 둔 뒤 결과창 개방
  setTimeout(() => openDefeatModal(), 1200);
}

function openDefeatModal() {
  openVictoryModal(false);
  const modal = document.getElementById('victory-modal');
  const grid = document.getElementById('victory-stats-grid');
  if (!modal || !grid) return;
  modal.classList.add('defeat-mode');

  const data = getStageData(state.currentStage);
  const hpLeftPct = state.monster.maxHp > 0 ? Math.ceil((state.monster.hp / state.monster.maxHp) * 100) : 0;
  const bestStage = getStageData(Math.max(1, state.bestReachedStage || state.currentStage));
  document.getElementById('victory-crown-badge').textContent = '💀 DEFEAT · 보스 광폭화';
  document.getElementById('victory-modal-title').textContent = `${data.name} 광폭화`;
  document.getElementById('victory-modal-subtitle').textContent = `STAGE ${data.phase}-${data.stepInPhase} 보스를 제한 시간 안에 쓰러뜨리지 못했습니다. 새 런에서 다른 빌드를 시도해 보세요!`;
  document.getElementById('btn-speedrun-retry').textContent = '⚡ 새 런 시작';

  grid.innerHTML = `
    <div class="victory-stat-item">
      <span class="victory-stat-label">도달 스테이지</span>
      <span class="victory-stat-val cyan">STAGE ${data.phase}-${data.stepInPhase} 👑</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">보스 남은 체력</span>
      <span class="victory-stat-val gold">${hpLeftPct}%</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">최고 도달 기록</span>
      <span class="victory-stat-val gold">STAGE ${bestStage.phase}-${bestStage.stepInPhase}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">최고 달성 DPS</span>
      <span class="victory-stat-val gold">${fmt(state.stats?.peakDps || 0)} /초</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">이번 런 시간</span>
      <span class="victory-stat-val">${formatSpeedrunTime(state.playTimeSec)}</span>
    </div>
    <div class="victory-stat-item">
      <span class="victory-stat-label">누적 토벌 몬스터</span>
      <span class="victory-stat-val">${fmt(state.totalKills || 0)} 마리</span>
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
  state.isPaused = false;

  // 1. 스피드런 및 스테이지 진행도 완전 초기화 (역대 최단시간 bestSpeedrunTime은 보존)
  state.currentStage = 1;
  state.highestClearedStage = 0;
  state.gold = 0;
  state.playTimeSec = 0;
  state.campaignCleared = false;
  state.runFailed = false;

  // 2. 주문서 완전 초기화 (기본 화염구 1개로 시작, 자동 시전 설정은 플레이어 선택 유지)
  state.grimoires = {
    fireblast: false,
    meteor: false,
    combustion: false,
    flame_patch: false
  };
  state.spellOrder = ['fireball'];
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

  // 4. 런 단위 전투 기록 초기화 (결과창 · 밸런스 로그가 이번 런만 집계하도록)
  state.stats = { peakDps: 0, combustionHits: 0, combustionPyros: 0 };
  for (const k of Object.keys(state.skillDamage)) {
    state.skillDamage[k].dmg = 0;
    state.skillDamage[k].hits = 0;
    state.skillDamage[k].crits = 0;
  }
  playtestTelemetry.stageRecords = [];
  playtestTelemetry.failedStage = null;

  // 5. 언폴딩 상태 초반으로 리셋 (명예의 전당은 기록이 남아 있으므로 유지)
  state.unfolded.awakening = false;
  state.unfolded.combatStats = false;

  // 6. 전투 상태 초기화
  state.combat.castingSkill = null;
  state.combat.castRemaining = 0;
  state.combat.gcdRemaining = 0;
  state.combat.critStreak = 0;
  state.combat.streakTimer = 0;
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

  spawnFloatingText('⚡ 스피드런 새 런 시작! (Stage 1-1 · 타이머 00:00)', 'fct-proc', -55, { isBig: true });

  loadStage(1);
  checkAndTriggerUnfolds(true);
  updateSkillActionBarVisibility();
  saveGame();
  updateLiveHUD();

  const timerEl = document.getElementById('ui-speedrun-timer');
  if (timerEl) {
    timerEl.textContent = formatSpeedrunTime(0);
  }
  updateNotificationBadges();
}

// ==========================================
// 17. 메인 게임 루프 (60 FPS)
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
  state.totalPlayTimeSec = (state.totalPlayTimeSec || 0) + dt;

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
    if (c.streakTimer <= 0) {
      c.critStreak = 0;
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
      updatePeriodicUI();
    } catch (e) {}
  }

  requestAnimationFrame(gameLoop);
}

// ==========================================
// 18. 실시간 HUD 업데이트
// ==========================================
function updateLiveHUD() {
  const stats = getPlayerStats();
  const c = state.combat;

  // 골드 동전이 곡선 비행하여 상단 알약 UI에 하나씩 닿을 때마다 숫자가 차르륵 올라가도록 표시!
  const pendingGold = Math.min(state.gold, Math.max(0, state.pendingCoinGold || 0));
  const displayedGold = Math.max(0, Math.round(state.gold - pendingGold));
  document.getElementById('ui-gold').textContent = fmt(displayedGold);

  updatePityCritBadgeUI();
  document.getElementById('ui-sp').textContent = fmt(stats.sp);
  document.getElementById('ui-crit').textContent = `${stats.crit.toFixed(1)}%`;
  document.getElementById('ui-haste').textContent = `+${stats.haste.toFixed(0)}%`;

  const hpPct = Math.max(0, Math.min(100, (state.monster.hp / state.monster.maxHp) * 100));
  document.getElementById('target-hp-fill').style.width = `${hpPct}%`;
  document.getElementById('target-hp-text').textContent = `${fmt(state.monster.hp)} / ${fmt(state.monster.maxHp)}`;
  document.getElementById('target-hp-pct').textContent = `${hpPct.toFixed(0)}%`;

  const casterAvatar = document.getElementById('caster-avatar');
  const combBg = document.getElementById('combustion-bg');
  const isMeteorReady =
    c.castingSkill === 'meteor' || (state.grimoires.meteor && c.critStreak === 2);

  casterAvatar.classList.toggle('casting-active', Boolean(c.castingSkill) && !isMeteorReady);
  casterAvatar.classList.toggle('pyro-ready-mode', isMeteorReady);
  casterAvatar.classList.toggle('combustion-mode', c.combustionRem > 0);
  combBg.classList.toggle('active', c.combustionRem > 0);

  // 발화(마력 폭주) 피버 모드 & 연계 신호는 실제 치명타와 발화 상태를 그대로 따라갑니다.
  const arenaArt = document.getElementById('combat-arena');
  arenaArt.classList.toggle('fever-mode', c.combustionRem > 0);
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

  const isGatlingActive = Boolean(state.deckMechanics && state.deckMechanics.gatlingMode);
  if (c.castingSkill) {
    const progress = ((c.castTotal - c.castRemaining) / c.castTotal) * 100;
    castFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    if (c.castingSkill === 'meteor') {
      castName.textContent = '☄️ 메테오 시전 중';
    } else if (isMeteorReady) {
      castName.textContent = isGatlingActive ? '⚡ 화염 기관총 (☄️메테오 장전됨!)' : '🔥 화염구 (☄️메테오 장전됨!)';
    } else if (isGatlingActive) {
      castName.textContent = '⚡ 화염 기관총 난사!';
    } else {
      castName.textContent = '🔥 화염구';
    }
    castTime.textContent = isGatlingActive ? `${c.castRemaining.toFixed(2)}s` : `${c.castRemaining.toFixed(1)}s`;
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

  // 충전형 카드의 남은 충전은 해당 스킬 버튼 위 배지로 표시
  setStageChargeBadge('skill-1', c.quickdrawCharges, '🎇', '속사 장전: 시전 없이 즉시 발사');
  setStageChargeBadge('skill-3', c.meteorCharges, '🔋', '잠열 충전: 메테오 피해 증폭');

  const enrageEl = document.getElementById('boss-enrage-timer');
  if (enrageEl) {
    const enrageActive = c.bossEnrageRem !== null && c.bossEnrageRem !== undefined;
    enrageEl.classList.toggle('hidden', !enrageActive);
    if (enrageActive) {
      const enrageTotal = getStageData(state.currentStage).enrage || 1;
      enrageEl.classList.toggle('danger', c.bossEnrageRem <= 10);
      document.getElementById('boss-enrage-time').textContent = `${Math.ceil(c.bossEnrageRem)}s`;
      document.getElementById('boss-enrage-fill').style.width = `${Math.max(0, Math.min(100, (c.bossEnrageRem / enrageTotal) * 100))}%`;
    }
  }

  const debuffRow = document.getElementById('target-debuffs');
  let debuffHtml = '';
  if (c.igniteRem > 0 && c.ignitePool >= 5) {
    debuffHtml += `<div class="debuff-chip">🩸 화상 ${fmt(c.ignitePool * stats.burnMult)} (${c.igniteRem.toFixed(1)}s)</div>`;
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
      badge.setAttribute('aria-label', `${label} ${count}회`);
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

  const timerEl = document.getElementById('ui-speedrun-timer');
  if (timerEl) {
    timerEl.textContent = formatSpeedrunTime(state.playTimeSec);
  }

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
      bossClearTimes: state.bossClearTimes,
      autoCast: state.autoCast,
      skillAuto: state.skillAuto,
      soundOn: state.soundOn,
      bgmVolume: state.bgmVolume,
      sfxVolume: state.sfxVolume,
      unfolded: state.unfolded,
      grimoires: state.grimoires,
      stats: state.stats,
      spellOrder: state.spellOrder || ['fireball'],
      activeDeck: deckManager ? deckManager.getActiveDeck() : {}
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

// 저장 데이터는 현재 시스템에 필요한 필드만 복원하고, 제거된 구형 시스템 필드는 무시합니다.
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
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
    if (data.bossClearTimes) state.bossClearTimes = Object.assign({}, data.bossClearTimes);
    if (typeof data.autoCast === 'boolean') state.autoCast = data.autoCast;
    if (data.skillAuto) Object.assign(state.skillAuto, data.skillAuto);
    if (typeof data.soundOn === 'boolean') state.soundOn = data.soundOn;
    if (typeof data.bgmVolume === 'number') state.bgmVolume = Math.max(0, Math.min(1, data.bgmVolume));
    if (typeof data.sfxVolume === 'number') state.sfxVolume = Math.max(0, Math.min(1, data.sfxVolume));
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
  document.getElementById('dummy-avatar').addEventListener('click', () => {
    if (state.grimoires.meteor && state.combat.critStreak === 2) {
      triggerSkill('meteor', true);
    } else {
      triggerSkill('fireball', true);
    }
  });

  document.querySelectorAll('.skill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const skill = btn.getAttribute('data-skill');
      triggerSkill(skill, true);
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
        triggerSkill(activeSpells[slotIndex], true);
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
      triggerSkill(skill, true);
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

  const hallBtn = document.getElementById('btn-hall-of-fame');
  if (hallBtn) {
    hallBtn.addEventListener('click', () => {
      playSound('item_select');
      openVictoryModal(false);
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

  // 플레이테스트 밸런스 텔레메트리 클립보드 복사 이벤트
  const exportTelemetryBtn = document.getElementById('btn-export-telemetry');
  if (exportTelemetryBtn) {
    exportTelemetryBtn.addEventListener('click', () => playtestTelemetry.copyToClipboard());
  }

  const victoryExportBtn = document.getElementById('btn-victory-export-telemetry');
  if (victoryExportBtn) {
    victoryExportBtn.addEventListener('click', () => playtestTelemetry.copyToClipboard());
  }

  document.getElementById('btn-reset-save').addEventListener('click', () => {
    if (confirm('처음부터 다시 시작하시겠습니까?')) {
      localStorage.removeItem(SAVE_KEY);
      location.reload();
    }
  });

  // 로그라이크 마도서 각성 모달 이벤트 초기화
  initAwakeningModalEvents();

  // 라그나로스 토벌 트래커 및 스토리 툴팁 이벤트 초기화
  initRagnarosTrackerEvents();
}

function initRagnarosTrackerEvents() {
  const trackerEl = document.getElementById('ragnaros-doom-tracker');
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
  updateBgmPlayback();
  loadStage(state.currentStage);
  updatePityCritBadgeUI();
  updateSkillAutoUI();
  renderDeckStripUI();
  updateRagnarosProgressUI(state.currentStage);
  updateNotificationBadges();
  if (state.runFailed) {
    state.isPaused = true;
    openDefeatModal();
  }
  requestAnimationFrame(gameLoop);
});
