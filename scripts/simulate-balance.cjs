/**
 * scripts/simulate-balance.cjs
 *
 * DPS: Fire Mage 실측형 밸런스 시뮬레이터
 * - scripts/lib/headless-game.cjs로 실제 game.js 전투 코드를 그대로 실행합니다. (간이 수식 모델 아님)
 * - 픽 전략(policy)별로 Stage 1~20 런을 반복하여 스테이지별 처치 시간, 총 런 시간, 보스 광폭화 실패율,
 *   카드 픽 분포와 스킬별 피해 점유율을 집계합니다.
 *
 * 사용법: node scripts/simulate-balance.cjs [--runs 20] [--policy greedy|random|rapid|crit|summon|burn|all] [--seed 1]
 *        node scripts/simulate-balance.cjs --calibrate [--runs 30] [--policy greedy]
 *        클리어 후 콘텐츠: [--level 0~8] [--locked] [--start fireblast|meteor|combustion|flame_patch]
 *          --level 업화 단계, --locked 숙련도 0(전설 카드 잠김, 첫 런 조건), --start 시작 주문서
 *          --xp N 숙련도 경험치 지정(예: --xp 4 --start fireblast = 5스테이지 보스에서 실패한 첫 런 다음의 두 번째 런)
 *        수동 판단 비교: [--hold-combustion] 마력 폭주를 보스(5·10·15·20)까지 아낌, [--no-auto-grimoire] 자동 영창을 추첨에서 빼 수동 판단을 유지
 *        전설 카드 비교: [--force-legendary 카드ID] 첫 보스 보상에서 해당 전설을 강제로 고름(같은 시드로 카드별 비교)
 *        업화 규칙 시험: [--rules '[{"level":4,"bossHpPct":40}]'] 단계별 규칙 값을 덮어써서 비교
 *   --calibrate: 스테이지마다 몬스터 체력을 무한으로 두고 목표 처치 시간(TARGET_TTK) 동안의 실제 DPS를 측정해
 *                "목표 시간에 맞는 HP = 중앙값 DPS x 목표 시간"을 제안합니다.
 */
const { createHeadlessGame } = require('./lib/headless-game.cjs');

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const RUNS = Number(argValue('runs', 20));
const POLICY = argValue('policy', 'all');
const BASE_SEED = Number(argValue('seed', 1));
const CALIBRATE = args.includes('--calibrate');
// 클리어 후 콘텐츠: --level 업화 단계(0~8), --locked 숙련도 0(첫 런처럼 전설 카드 잠김), --start 시작 주문서
const LEVEL = Number(argValue('level', 0));
const LOCKED = args.includes('--locked');
const START_SPELL = argValue('start', '');
const XP = args.includes('--xp') ? Number(argValue('xp', 0)) : null;
// 마력 폭주를 일반 몬스터에 쓰지 않고 보스 스테이지까지 아끼는 수동 판단(자동 영창으로 자동이 된 주문에는 적용되지 않음)
const HOLD_COMBUSTION = args.includes('--hold-combustion');
const NO_AUTO_GRIMOIRE = args.includes('--no-auto-grimoire');
// 전설 카드 단독 비교: 첫 전설 선택 기회(보스 보상)에 이 카드를 강제로 고릅니다. 같은 시드로 카드별 힘을 비교할 때 씁니다.
const FORCE_LEGENDARY = argValue('force-legendary', '');
// 업화 규칙 시험: '[{"level":4,"bossHpPct":40}]'처럼 단계별 값을 덮어씁니다(meta-progression.js는 그대로 두고 비교할 때 사용).
const RULE_OVERRIDES = JSON.parse(argValue('rules', '[]'));
const FRAME = 1 / 30;

// 목표 처치 시간(초): 픽 전략 greedy의 중앙값 기준, 첫 클리어 약 13분 (일반 진행·카드 선택 포함 15분 내외)
const TARGET_TTK = [9, 13, 16, 19, 45, 26, 28, 30, 32, 65, 34, 36, 38, 40, 75, 42, 44, 46, 48, 90];
const STAGE_TIMEOUT_SEC = 1500;

const RARITY_SCORE = { legendary: 3, rare: 2, common: 1 };

// 수동 주문(불꽃 작렬·메테오·마력 폭주·불장판)을 사람이 판단해 누르는 간격(초). 평균 반응 지연은 0.2초입니다.
const MANUAL_SPELL_REACT = 0.4;

// 카드 3장 중 하나를 고르는 전략
const POLICIES = {
  // 사람이 흔히 하는 선택: 주문서 우선 → 높은 등급 → 이미 모은 빌드와 같은 계열
  greedy(choices, deck, pool, rand) {
    const buildCount = {};
    for (const [id, n] of Object.entries(deck)) {
      const c = pool.find((x) => x.id === id);
      if (c) buildCount[c.build] = (buildCount[c.build] || 0) + n;
    }
    return maxBy(choices, (c) => (c.spellKey ? 100 : 0) + RARITY_SCORE[c.rarity] * 10 + (buildCount[c.build] || 0) + rand() * 0.1);
  },
  // 아무 생각 없이 고르는 하한선
  random(choices, deck, pool, rand) {
    return choices[Math.floor(rand() * choices.length)];
  }
};
// 특정 빌드에 올인하는 전략 (해당 빌드 카드 → 주문서 → 등급 순)
for (const build of ['rapid', 'crit', 'summon', 'burn']) {
  POLICIES[build] = (choices, deck, pool, rand) =>
    maxBy(choices, (c) => (c.build === build ? 200 : 0) + (c.spellKey ? 50 : 0) + RARITY_SCORE[c.rarity] * 10 + rand() * 0.1);
}

function maxBy(list, score) {
  let best = list[0];
  let bestScore = -Infinity;
  for (const item of list) {
    const s = score(item);
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return best;
}

function simulateRun(policyName, seed) {
  const g = createHeadlessGame({ seed });
  const rand = g.context.Math.random;
  const policy = POLICIES[policyName];
  const pool = g.run('RoguelikeDeck.CARD_POOL');
  const stages = [];
  let stageStartPlay = 0;
  let lastCleared = 0;
  let reactTimer = 0;
  let manualSpellTimer = 0;
  let failedAt = null;
  // 전설 카드를 고른 스테이지(카드별 영향 분석용)
  const legendaryAt = {};
  const st = g.run('state');
  // 런 조건: 업화 단계·카드 잠금·시작 주문서를 실제 게임의 새 런과 같은 경로(restartSpeedrunRun)로 적용합니다.
  st.meta.infernoUnlocked = LEVEL;
  st.meta.infernoSelected = LEVEL;
  st.meta.xp = XP !== null ? XP : LOCKED ? 0 : 1e9;
  // 메테오 연계 시연·첫 열기 보장은 세이브에서 처음 메테오를 얻을 때만 나옵니다. 첫 런(--locked)만 처음으로 봅니다.
  st.meta.tips.meteorCombo = !LOCKED;
  st.meta.startSpell = START_SPELL || null;
  if (RULE_OVERRIDES.length) {
    const rules = g.run('INFERNO_RULES');
    for (const o of RULE_OVERRIDES) {
      const rule = rules.find((r) => r.level === o.level);
      if (rule) Object.assign(rule, o);
    }
  }
  g.run('restartSpeedrunRun()');
  if (NO_AUTO_GRIMOIRE) st.lockedCards.push('util_auto_grimoire');
  const calib = [];
  let calibStage = 0;
  let calibDamageStart = 0;
  const totalDamage = () => Object.values(st.skillDamage).reduce((a, s) => a + s.dmg, 0);

  while (true) {
    if (st.runFailed) { failedAt = st.currentStage; break; }
    if (st.campaignCleared && st.isPaused) break;

    if (st.isPaused) {
      const choices = g.run('deckManager.getCurrentChoices()');
      if (choices.length > 0) {
        let pick = policy(choices, g.run('deckManager.getActiveDeck()'), pool, rand);
        if (FORCE_LEGENDARY && Object.keys(legendaryAt).length === 0 && choices.some((c) => c.rarity === 'legendary')) {
          pick = pool.find((c) => c.id === FORCE_LEGENDARY) || pick;
        }
        if (pick.rarity === 'legendary' && !(pick.id in legendaryAt)) legendaryAt[pick.id] = st.currentStage;
        g.run(`selectAwakeningCard(${JSON.stringify(pick.id)})`);
      } else if (!g.run('dismissMeteorComboCoach()')) {
        g.step(FRAME);
      }
      continue;
    }

    // 자동 시전이 꺼져 있으면 사람처럼 0.25초 반응 지연으로 화염구를 누릅니다.
    const c = st.combat;
    if (!st.autoCast) {
      if (!c.castingSkill && c.gcdRemaining <= 0) {
        reactTimer += FRAME;
        if (reactTimer >= 0.25) { g.run("triggerSkill('fireball', true)"); reactTimer = 0; }
      } else {
        reactTimer = 0;
      }
    }

    // 자동 영창(전설) 전에는 화염구 외 주문이 수동입니다. 사람이 화면을 보고 누르듯
    // MANUAL_SPELL_REACT초마다 한 번 최적 순서로 판단해 누릅니다(평균 반응 지연 = 그 절반).
    manualSpellTimer += FRAME;
    if (manualSpellTimer >= MANUAL_SPELL_REACT) {
      manualSpellTimer = 0;
      const holdCombustion = HOLD_COMBUSTION && st.currentStage % 5 !== 0;
      g.run(`runSmartAutoCast((k) => k !== 'fireball' && !isSkillAutoActive(k) && !(${holdCombustion} && k === 'combustion'), true)`);
    }

    // 보정 모드: 스테이지 시작 시 체력을 무한으로 바꾸고 목표 시간 동안의 DPS만 측정
    if (CALIBRATE && calibStage !== st.currentStage && !st.monster.isDying) {
      calibStage = st.currentStage;
      st.monster.maxHp = 1e15;
      st.monster.hp = 1e15;
      st.combat.bossEnrageRem = null;
      calibDamageStart = totalDamage();
    }

    g.step(FRAME);

    if (CALIBRATE && !st.monster.isDying && st.playTimeSec - stageStartPlay >= TARGET_TTK[st.currentStage - 1]) {
      calib.push({ stage: st.currentStage, dps: (totalDamage() - calibDamageStart) / (st.playTimeSec - stageStartPlay) });
      st.monster.hp = 0;
      g.run('onMonsterKilled()');
    }

    if (st.highestClearedStage > lastCleared) {
      lastCleared = st.highestClearedStage;
      stages.push({ stage: lastCleared, ttk: st.playTimeSec - stageStartPlay });
      stageStartPlay = st.playTimeSec;
    } else if (st.playTimeSec - stageStartPlay > STAGE_TIMEOUT_SEC) {
      failedAt = st.currentStage;
      break;
    }
  }

  const dmg = {};
  for (const [k, s] of Object.entries(st.skillDamage)) if (s.dmg > 0) dmg[k] = s.dmg;
  return {
    stages,
    calib,
    failedAt,
    totalSec: st.playTimeSec,
    deck: g.run('deckManager.getActiveDeck()'),
    // 런 끝의 주력 빌드(주문서·유틸리티 제외, 2장 이상). 빌드 가중 추첨이 한 빌드로 쏠리는지 확인합니다.
    mainBuild: g.run('typeof deckManager.getMainBuilds === "function" ? deckManager.getMainBuilds().main : null'),
    legendaryAt,
    dmg
  };
}

const quantile = (arr, q) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const fmtSec = (sec) => {
  if (!Number.isFinite(sec)) return '-';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function report(policyName) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(simulateRun(policyName, BASE_SEED + i));
  // --verbose: 런마다 시드·총 시간·돌파 스테이지·실패 위치를 출력합니다.
  if (args.includes('--verbose')) runs.forEach((r, i) => console.log(`  run seed ${BASE_SEED + i}: ${fmtSec(r.totalSec)} · 돌파 ${r.stages.length} · 실패 ${r.failedAt ?? '-'} · 스테이지별(초) ${r.stages.map((s) => Math.round(s.ttk)).join(' ')}`));

  console.log(`\n=== 전략: ${policyName} (${RUNS}회) · 업화 ${LEVEL}단계 · ${LOCKED ? '카드 잠김(첫 런)' : '전체 해금'}${START_SPELL ? ` · 시작 ${START_SPELL}` : ''}${XP !== null ? ` · 숙련도 ${XP}` : ''}${HOLD_COMBUSTION ? ' · 마력 폭주 보스까지 보존' : ''}${NO_AUTO_GRIMOIRE ? ' · 자동 영창 제외' : ''}${FORCE_LEGENDARY ? ` · 첫 전설 ${FORCE_LEGENDARY}` : ''}${RULE_OVERRIDES.length ? ` · 규칙 ${JSON.stringify(RULE_OVERRIDES)}` : ''} ===`);
  console.log('단계 | 처치 시간 p25 / 중앙 / p75 (초) | 도달률');
  for (let stage = 1; stage <= 20; stage++) {
    const ttks = runs.map((r) => r.stages.find((s) => s.stage === stage)).filter(Boolean).map((s) => s.ttk);
    const reach = runs.filter((r) => r.stages.some((s) => s.stage >= stage) || (r.failedAt && r.failedAt >= stage)).length;
    const boss = stage % 5 === 0 ? '👑' : '  ';
    console.log(`${String(stage).padStart(2)}${boss} | ${quantile(ttks, 0.25).toFixed(1).padStart(6)} / ${quantile(ttks, 0.5).toFixed(1).padStart(6)} / ${quantile(ttks, 0.75).toFixed(1).padStart(6)} | ${Math.round((reach / RUNS) * 100)}%`);
  }
  const cleared = runs.filter((r) => !r.failedAt);
  const totals = cleared.map((r) => r.totalSec);
  console.log(`클리어 ${cleared.length}/${RUNS}  런 시간 p25 ${fmtSec(quantile(totals, 0.25))} / 중앙 ${fmtSec(quantile(totals, 0.5))} / p75 ${fmtSec(quantile(totals, 0.75))}`);
  const fails = runs.filter((r) => r.failedAt).map((r) => r.failedAt);
  if (fails.length) console.log(`실패 스테이지: ${fails.sort((a, b) => a - b).join(', ')}`);

  const share = {};
  for (const r of runs) {
    const total = Object.values(r.dmg).reduce((a, b) => a + b, 0) || 1;
    for (const [k, v] of Object.entries(r.dmg)) share[k] = (share[k] || 0) + v / total / RUNS;
  }
  console.log('피해 점유율: ' + Object.entries(share).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(' · '));

  const mains = {};
  for (const r of runs) { const k = r.mainBuild || '없음'; mains[k] = (mains[k] || 0) + 1; }
  console.log('런 끝 주력 빌드: ' + Object.entries(mains).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((v / RUNS) * 100)}%`).join(' · '));

  const picks = {};
  for (const r of runs) for (const [id, n] of Object.entries(r.deck)) picks[id] = (picks[id] || 0) + n / RUNS;
  console.log('런당 평균 보유: ' + Object.entries(picks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · '));

  // 전설 카드 영향: 그 카드를 얻은 런과 못 얻은 런의 클리어 시간 중앙값 비교 (차이가 크면 해당 카드 하나가 런을 좌우한다는 뜻)
  const legendaryIds = [...new Set(runs.flatMap((r) => Object.keys(r.legendaryAt)))].sort();
  if (legendaryIds.length) {
    console.log('전설 카드 영향 (클리어 런 시간 중앙값): 보유 n / 미보유 n · 획득 스테이지 중앙');
    for (const id of legendaryIds) {
      const withIt = cleared.filter((r) => id in r.legendaryAt);
      const without = cleared.filter((r) => !(id in r.legendaryAt));
      const pickStage = quantile(runs.filter((r) => id in r.legendaryAt).map((r) => r.legendaryAt[id]), 0.5);
      console.log(`  ${id.padEnd(24)} ${fmtSec(quantile(withIt.map((r) => r.totalSec), 0.5))} (${withIt.length}) / ${fmtSec(quantile(without.map((r) => r.totalSec), 0.5))} (${without.length}) · ${pickStage}스테이지`);
    }
    // 개별 카드보다 "전설을 몇 장, 언제 얻었나"가 런 시간을 가르는지 확인
    const byCount = {};
    for (const r of cleared) {
      const early = Object.values(r.legendaryAt).filter((s) => s <= 10).length;
      const key = early >= 2 ? '2+' : String(early);
      (byCount[key] = byCount[key] || []).push(r.totalSec);
    }
    console.log('10스테이지까지 얻은 전설 수별 런 시간 중앙값: ' + ['0', '1', '2+'].filter((k) => byCount[k]).map((k) => `${k}장 ${fmtSec(quantile(byCount[k], 0.5))} (${byCount[k].length})`).join(' · '));
  }
  return runs;
}

function calibrate(policyName) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(simulateRun(policyName, BASE_SEED + i));
  console.log(`\n=== HP 보정: 전략 ${policyName} (${RUNS}회) ===`);
  console.log('단계 | 목표(초) | DPS p25 / 중앙 / p75 | 제안 HP');
  const suggested = [];
  for (let stage = 1; stage <= 20; stage++) {
    const dps = runs.map((r) => r.calib.find((c) => c.stage === stage)).filter(Boolean).map((c) => c.dps);
    const hp = Math.round(quantile(dps, 0.5) * TARGET_TTK[stage - 1]);
    suggested.push(hp);
    console.log(`${String(stage).padStart(2)}${stage % 5 === 0 ? '👑' : '  '} | ${String(TARGET_TTK[stage - 1]).padStart(6)} | ${Math.round(quantile(dps, 0.25)).toLocaleString().padStart(8)} / ${Math.round(quantile(dps, 0.5)).toLocaleString().padStart(8)} / ${Math.round(quantile(dps, 0.75)).toLocaleString().padStart(8)} | ${hp.toLocaleString()}`);
  }
  console.log('제안 HP 배열: ' + JSON.stringify(suggested));
}

if (CALIBRATE) {
  calibrate(POLICY === 'all' ? 'greedy' : POLICY);
  process.exit(0);
}

const names = POLICY === 'all' ? Object.keys(POLICIES) : [POLICY];
for (const name of names) {
  if (!POLICIES[name]) { console.error(`알 수 없는 전략: ${name}`); process.exit(1); }
  report(name);
}
