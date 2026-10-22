/* 클리어 후 콘텐츠: 업화 단계(난이도)와 마도서 숙련도(실패해도 쌓이는 영구 해금).
 * 수치는 모두 이 파일의 표에서 조절합니다. 게임 로직(game.js)과 밸런스 시뮬레이터가 같은 표를 씁니다.
 *
 * - 업화 단계(Inferno, 0~8): 현재 해금된 최고 단계로 최종 보스를 쓰러뜨리면 다음 단계가 열립니다.
 *   단계 규칙은 누적됩니다(3단계 = 1·2·3단계 규칙 모두 적용). 스피드런 기록은 단계별로 따로 남깁니다.
 * - 마도서 숙련도(Mastery): 런이 끝날 때(클리어·실패 모두) 돌파한 스테이지만큼 경험치를 얻고,
 *   누적 경험치가 기준을 넘을 때마다 전설 카드·시작 주문서가 차례로 영구 해금됩니다.
 * - 업화 해금 카드: 너무 강해 첫 클리어 전부터 나오면 난이도를 무너뜨리는 카드는 업화 단계에 처음 도달할 때
 *   영구 해금됩니다(이후 0단계 런 포함 모든 런에서 등장). */

const INFERNO_MAX = 8;

// level 단계에서 새로 더해지는 규칙. 효과 값은 앞 단계와 합산됩니다.
// 광폭화 단축과 보스 체력 증가는 빌드가 갖춰진 10스테이지 이후 보스에만 적용해, 초반 보스에서 런이 허무하게 끝나지 않게 합니다(시뮬레이터 실측 근거).
const INFERNO_LATE_BOSS_FROM_STAGE = 10;
const INFERNO_RULES = [
  { level: 1, text: '몬스터 체력 +15%', hpPct: 15 },
  { level: 2, text: '10스테이지 이후 보스 광폭화 시간 -30%', enragePct: -30 },
  { level: 3, text: '카드 다시 뽑기 비용 +50%', rerollPct: 50 },
  { level: 4, text: '10스테이지 이후 보스 체력 +20%', bossHpPct: 20 },
  { level: 5, text: '일반 웨이브 각성 카드 선택지 3장 → 2장', normalChoices: -1 },
  { level: 6, text: '주문 재사용 대기시간 +30%', cooldownPct: 30 },
  { level: 7, text: '불의 심장 보호막 +150%, 제한 시간 10초 → 6초, 못 깨면 회복 10% → 30%', shieldPct: 150, shieldSecPct: -40, shieldHealPct: 20 },
  { level: 8, text: '모든 몬스터 체력 +10% 추가', hpPct: 10 }
];

// 런 종료 경험치: 돌파한 일반 스테이지 1, 페이즈 보스(5·10·15) 3, 최종 보스 10. 업화 단계마다 +25%.
const MASTERY_XP = { perStage: 1, phaseBoss: 3, finalBoss: 10, perInfernoPct: 25 };

// 누적 경험치 기준과 해금 보상(순서대로 열림). card=각성 카드 풀에 추가, start=런 시작 시 고를 수 있는 주문서.
// 첫 해금(4)은 5스테이지 보스에서 실패한 첫 런도 받는 경험치입니다. 두 번째 런이 첫 런과 똑같이 시작하지 않게 합니다.
// 들불(10)은 가장 약한 전설(첫 보스 강제 선택 9:30, docs/2026-10-15-legendary-balance.md)이라, 업화 3단계로 옮긴 화염 기관총 대신
// 두세 번째 런의 '새 장난감'으로 둡니다. 전설이 하나라도 열리면 보스 보상 전설 보장도 그때부터 켜집니다.
const MASTERY_UNLOCKS = [
  { xp: 4, type: 'start', id: 'fireblast' },
  { xp: 10, type: 'card', id: 'burn_wildfire' },
  // 피해를 올리는 전설(정령: 잿더미 군단장)을 편의 전설(자동 영창)보다 먼저 열어, '전설 중심으로 짜는' 경험을 앞당깁니다(개편안 2.6).
  { xp: 35, type: 'card', id: 'sum_cinder_lord' },
  { xp: 45, type: 'card', id: 'util_auto_grimoire' },
  { xp: 70, type: 'start', id: 'flame_patch' },
  { xp: 140, type: 'start', id: 'meteor' },
  { xp: 190, type: 'card', id: 'crit_crimson_frenzy' },
  { xp: 250, type: 'card', id: 'util_phoenix_reborn' },
  { xp: 320, type: 'start', id: 'combustion' }
];

// 업화 단계에 처음 도달(infernoUnlocked)하면 영구 해금되는 카드. 마력 폭주·화염 기관총은 0~1단계 난이도를 무너뜨릴 만큼 강해
// 첫 클리어 이후의 보상으로 둡니다. 마력 폭주 시작 주문서도 카드가 열린 뒤에만 고를 수 있습니다.
const INFERNO_CARD_UNLOCKS = [
  { level: 2, type: 'card', id: 'spell_combustion' },
  { level: 3, type: 'card', id: 'rapid_gatling' }
];

// 열기 1칸일 때 불꽃 작렬 칸에 '지금!' 말풍선을 띄우는 횟수(세이브 전체 기준)
const FIREBLAST_HINT_MAX = 3;
// 광폭화 타이머 안내 쪽지: 처음 이 횟수의 보스전에서만 보여 줍니다.
const ENRAGE_INTRO_MAX = 2;

// 시작 주문서 → 해당 주문서 카드 ID
const START_SPELL_CARDS = { fireblast: 'spell_fireblast', meteor: 'spell_meteor', combustion: 'spell_combustion', flame_patch: 'spell_flame_patch' };

function clampInferno(level) {
  return Math.max(0, Math.min(INFERNO_MAX, Math.floor(Number(level) || 0)));
}

// 해당 단계까지 누적된 규칙을 배율로 바꿉니다.
function getInfernoModifiers(level) {
  const lv = clampInferno(level);
  const sum = { hpPct: 0, bossHpPct: 0, enragePct: 0, rerollPct: 0, normalChoices: 0, shieldPct: 0, cooldownPct: 0, shieldSecPct: 0, shieldHealPct: 0 };
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
    shieldMult: 1 + sum.shieldPct / 100,
    shieldSec: Math.max(3, 10 * (1 + sum.shieldSecPct / 100)),
    // 불의 심장을 제한 시간 안에 못 깨면 최종 보스가 회복하는 체력 비율(기본 10%)
    shieldHeal: (10 + sum.shieldHealPct) / 100,
    cooldownMult: 1 + sum.cooldownPct / 100
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

// 아직 숙련도·업화 단계로 열지 못한 카드(각성 카드 추첨에서 제외)
function getLockedCardIds(xp, infernoUnlocked = 0) {
  return MASTERY_UNLOCKS.filter((u) => u.type === 'card' && xp < u.xp).map((u) => u.id)
    .concat(INFERNO_CARD_UNLOCKS.filter((u) => clampInferno(infernoUnlocked) < u.level).map((u) => u.id));
}

// 해당 업화 단계에 도달하며 새로 열리는 카드
function getInfernoCardUnlocks(level) {
  return INFERNO_CARD_UNLOCKS.filter((u) => u.level === clampInferno(level));
}

// 아직 열리지 않은 다음 업화 해금 카드(결과창 예고용)
function getNextInfernoCardUnlock(infernoUnlocked) {
  return INFERNO_CARD_UNLOCKS.find((u) => u.level > clampInferno(infernoUnlocked)) || null;
}

function getUnlockedStartSpells(xp, infernoUnlocked = 0) {
  const locked = getLockedCardIds(xp, infernoUnlocked);
  return getUnlocksAt(xp).filter((u) => u.type === 'start' && !locked.includes(START_SPELL_CARDS[u.id])).map((u) => u.id);
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
  const startSpell = getUnlockedStartSpells(xp, unlocked).includes(meta.startSpell) ? meta.startSpell : null;
  // 액션 바 선호 배치(드래그 앤 드롭): 알려진 주문 키만, 중복 없이
  const slotKeys = ['fireball', 'fireblast', 'meteor', 'combustion', 'flame_patch'];
  const slotOrder = Array.isArray(meta.slotOrder) ? meta.slotOrder.filter((k, i, a) => slotKeys.includes(k) && a.indexOf(k) === i) : [];
  // 한 번만 보여 주는 안내: 메테오 연계 시연(본 적 있음), 불꽃 작렬 '지금!' 말풍선·광폭화 타이머 쪽지(보여 준 횟수)
  const rawTips = meta.tips && typeof meta.tips === 'object' ? meta.tips : {};
  const tips = {
    meteorCombo: rawTips.meteorCombo === true,
    fireblastHint: Math.max(0, Math.min(FIREBLAST_HINT_MAX, Math.floor(Number(rawTips.fireblastHint) || 0))),
    enrageIntro: Math.max(0, Math.min(ENRAGE_INTRO_MAX, Math.floor(Number(rawTips.enrageIntro) || 0)))
  };
  // 도감: 선택지에 한 번이라도 나온 카드(seenCards)와 고른 적 있는 카드(pickedCards). 문자열 ID만, 중복 없이.
  const idList = (v) => (Array.isArray(v) ? v.filter((id, i, a) => typeof id === 'string' && id && a.indexOf(id) === i) : []);
  return {
    xp,
    slotOrder,
    tips,
    seenCards: idList(meta.seenCards),
    pickedCards: idList(meta.pickedCards),
    infernoUnlocked: unlocked,
    infernoSelected: Math.min(unlocked, clampInferno(meta.infernoSelected)),
    startSpell,
    bestTimes,
    lastRun: meta.lastRun && typeof meta.lastRun === 'object' ? meta.lastRun : null
  };
}

// 도감 기록: 새로 추가된 ID 수를 돌려줍니다(0이면 저장할 것 없음).
function recordCardsSeen(meta, ids) {
  if (!meta || !Array.isArray(meta.seenCards)) return 0;
  let added = 0;
  for (const id of ids || []) {
    if (typeof id === 'string' && id && !meta.seenCards.includes(id)) { meta.seenCards.push(id); added++; }
  }
  return added;
}

function recordCardPicked(meta, id) {
  if (!meta || !Array.isArray(meta.pickedCards) || typeof id !== 'string' || !id) return false;
  recordCardsSeen(meta, [id]);
  if (meta.pickedCards.includes(id)) return false;
  meta.pickedCards.push(id);
  return true;
}

if (typeof module !== 'undefined') {
  module.exports = {
    INFERNO_MAX, INFERNO_LATE_BOSS_FROM_STAGE, INFERNO_RULES, MASTERY_XP, MASTERY_UNLOCKS, INFERNO_CARD_UNLOCKS, START_SPELL_CARDS, FIREBLAST_HINT_MAX, ENRAGE_INTRO_MAX,
    clampInferno, getInfernoModifiers, getRunMasteryXp, getUnlocksAt, getMasteryProgress,
    getLockedCardIds, getInfernoCardUnlocks, getNextInfernoCardUnlock, getUnlockedStartSpells, normalizeMeta,
    recordCardsSeen, recordCardPicked
  };
}
