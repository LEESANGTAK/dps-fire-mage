/* 클리어 후 콘텐츠: 업화 단계(난이도)와 마도서 숙련도(실패해도 쌓이는 영구 해금).
 * 수치는 모두 이 파일의 표에서 조절합니다. 게임 로직(game.js)과 밸런스 시뮬레이터가 같은 표를 씁니다.
 *
 * - 업화 단계(Inferno, 0~8): 현재 해금된 최고 단계로 최종 보스를 쓰러뜨리면 다음 단계가 열립니다.
 *   단계 규칙은 누적됩니다(3단계 = 1·2·3단계 규칙 모두 적용). 스피드런 기록은 단계별로 따로 남깁니다.
 * - 마도서 숙련도(Mastery): 런이 끝날 때(클리어·실패 모두) 돌파한 스테이지만큼 경험치를 얻고,
 *   누적 경험치가 기준을 넘을 때마다 전설 카드·시작 주문서가 차례로 영구 해금됩니다. */

const INFERNO_MAX = 8;

// level 단계에서 새로 더해지는 규칙. 효과 값은 앞 단계와 합산됩니다.
// 광폭화 단축과 보스 체력 증가는 빌드가 갖춰진 10스테이지 이후 보스에만 적용해, 초반 보스에서 런이 허무하게 끝나지 않게 합니다(시뮬레이터 실측 근거).
const INFERNO_LATE_BOSS_FROM_STAGE = 10;
const INFERNO_RULES = [
  { level: 1, text: '몬스터 체력 +15%', hpPct: 15 },
  { level: 2, text: '10스테이지 이후 보스 광폭화 시간 -10%', enragePct: -10 },
  { level: 3, text: '카드 다시 뽑기 비용 +50%', rerollPct: 50 },
  { level: 4, text: '10스테이지 이후 보스 체력 +20%', bossHpPct: 20 },
  { level: 5, text: '일반 웨이브 각성 카드 선택지 3장 → 2장', normalChoices: -1 },
  { level: 6, text: '10스테이지 이후 보스 광폭화 시간 -10% 추가', enragePct: -10 },
  { level: 7, text: '최종 보스 불의 심장 보호막 +50%', shieldPct: 50 },
  { level: 8, text: '모든 몬스터 체력 +20% 추가', hpPct: 20 }
];

// 런 종료 경험치: 돌파한 일반 스테이지 1, 페이즈 보스(5·10·15) 3, 최종 보스 10. 업화 단계마다 +25%.
const MASTERY_XP = { perStage: 1, phaseBoss: 3, finalBoss: 10, perInfernoPct: 25 };

// 누적 경험치 기준과 해금 보상(순서대로 열림). card=각성 카드 풀에 추가, start=런 시작 시 고를 수 있는 주문서.
const MASTERY_UNLOCKS = [
  { xp: 10, type: 'card', id: 'rapid_gatling' },
  { xp: 25, type: 'start', id: 'fireblast' },
  { xp: 45, type: 'card', id: 'sum_cinder_lord' },
  { xp: 70, type: 'start', id: 'flame_patch' },
  { xp: 100, type: 'card', id: 'burn_wildfire' },
  { xp: 140, type: 'start', id: 'meteor' },
  { xp: 190, type: 'card', id: 'crit_crimson_frenzy' },
  { xp: 250, type: 'card', id: 'util_phoenix_reborn' },
  { xp: 320, type: 'start', id: 'combustion' }
];

// 시작 주문서 → 해당 주문서 카드 ID
const START_SPELL_CARDS = { fireblast: 'spell_fireblast', meteor: 'spell_meteor', combustion: 'spell_combustion', flame_patch: 'spell_flame_patch' };

function clampInferno(level) {
  return Math.max(0, Math.min(INFERNO_MAX, Math.floor(Number(level) || 0)));
}

// 해당 단계까지 누적된 규칙을 배율로 바꿉니다.
function getInfernoModifiers(level) {
  const lv = clampInferno(level);
  const sum = { hpPct: 0, bossHpPct: 0, enragePct: 0, rerollPct: 0, normalChoices: 0, shieldPct: 0 };
  for (const rule of INFERNO_RULES) {
    if (rule.level > lv) break;
    for (const key of Object.keys(sum)) if (typeof rule[key] === 'number') sum[key] += rule[key];
  }
  return {
    level: lv,
    hpMult: 1 + sum.hpPct / 100,
    bossHpMult: (1 + sum.hpPct / 100) * (1 + sum.bossHpPct / 100),
    enrageMult: Math.max(0.5, 1 + sum.enragePct / 100),
    rerollMult: 1 + sum.rerollPct / 100,
    normalChoices: Math.max(2, 3 + sum.normalChoices),
    shieldMult: 1 + sum.shieldPct / 100
  };
}

// 런 종료 경험치. clearedStage = 이번 런에서 쓰러뜨린 마지막 스테이지(0이면 하나도 못 깸).
function getRunMasteryXp({ clearedStage = 0, finalKilled = false, infernoLevel = 0, finalStage = 20 } = {}) {
  const cleared = Math.max(0, Math.min(finalStage, Math.floor(clearedStage)));
  const phaseBosses = Math.floor(Math.min(cleared, finalStage - 1) / 5);
  const normalStages = cleared - phaseBosses - (finalKilled ? 1 : 0);
  const base = normalStages * MASTERY_XP.perStage + phaseBosses * MASTERY_XP.phaseBoss + (finalKilled ? MASTERY_XP.finalBoss : 0);
  return Math.round(base * (1 + clampInferno(infernoLevel) * MASTERY_XP.perInfernoPct / 100));
}

function getUnlocksAt(xp) {
  return MASTERY_UNLOCKS.filter((u) => xp >= u.xp);
}

// 숙련도 단계 = 받은 해금 수. 다음 해금까지의 진행도도 함께 돌려줍니다.
function getMasteryProgress(xp) {
  const level = getUnlocksAt(xp).length;
  const next = MASTERY_UNLOCKS[level] || null;
  const prevXp = level > 0 ? MASTERY_UNLOCKS[level - 1].xp : 0;
  return {
    level,
    next,
    prevXp,
    ratio: next ? Math.max(0, Math.min(1, (xp - prevXp) / (next.xp - prevXp))) : 1
  };
}

// 아직 숙련도로 열지 못한 카드(각성 카드 추첨에서 제외)
function getLockedCardIds(xp) {
  return MASTERY_UNLOCKS.filter((u) => u.type === 'card' && xp < u.xp).map((u) => u.id);
}

function getUnlockedStartSpells(xp) {
  return getUnlocksAt(xp).filter((u) => u.type === 'start').map((u) => u.id);
}

// 저장 데이터의 meta 블록을 안전한 기본값으로 정리합니다(구형 세이브 이관 포함).
function normalizeMeta(raw, legacyBestTime) {
  const meta = raw && typeof raw === 'object' ? raw : {};
  const bestTimes = {};
  if (meta.bestTimes && typeof meta.bestTimes === 'object') {
    for (const [k, v] of Object.entries(meta.bestTimes)) if (typeof v === 'number' && v > 0) bestTimes[clampInferno(k)] = v;
  }
  // meta가 없던 구형 세이브의 최단 기록은 0단계(기본 난이도) 기록입니다.
  if (!raw && typeof legacyBestTime === 'number' && legacyBestTime > 0) bestTimes[0] = legacyBestTime;
  const xp = Math.max(0, Math.floor(Number(meta.xp) || 0));
  // 구형 세이브로 이미 최종 보스를 쓰러뜨린 플레이어는 업화 1단계를 열어 둡니다.
  const unlocked = Math.max(clampInferno(meta.infernoUnlocked), bestTimes[0] && !raw ? 1 : 0);
  const startSpell = getUnlockedStartSpells(xp).includes(meta.startSpell) ? meta.startSpell : null;
  // 액션 바 선호 배치(드래그 앤 드롭): 알려진 주문 키만, 중복 없이
  const slotKeys = ['fireball', 'fireblast', 'meteor', 'combustion', 'flame_patch'];
  const slotOrder = Array.isArray(meta.slotOrder) ? meta.slotOrder.filter((k, i, a) => slotKeys.includes(k) && a.indexOf(k) === i) : [];
  return {
    xp,
    slotOrder,
    infernoUnlocked: unlocked,
    infernoSelected: Math.min(unlocked, clampInferno(meta.infernoSelected)),
    startSpell,
    bestTimes,
    lastRun: meta.lastRun && typeof meta.lastRun === 'object' ? meta.lastRun : null
  };
}

if (typeof module !== 'undefined') {
  module.exports = {
    INFERNO_MAX, INFERNO_LATE_BOSS_FROM_STAGE, INFERNO_RULES, MASTERY_XP, MASTERY_UNLOCKS, START_SPELL_CARDS,
    clampInferno, getInfernoModifiers, getRunMasteryXp, getUnlocksAt, getMasteryProgress,
    getLockedCardIds, getUnlockedStartSpells, normalizeMeta
  };
}
