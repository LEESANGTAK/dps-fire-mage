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
const FRAME = 1 / 30;

// 목표 처치 시간(초): 픽 전략 greedy의 중앙값 기준, 첫 클리어 약 13분 (일반 진행·카드 선택 포함 15분 내외)
const TARGET_TTK = [9, 13, 16, 19, 45, 26, 28, 30, 32, 65, 34, 36, 38, 40, 75, 42, 44, 46, 48, 90];
const STAGE_TIMEOUT_SEC = 1500;

const RARITY_SCORE = { legendary: 3, rare: 2, common: 1 };

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
  let failedAt = null;
  const st = g.run('state');
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
        const pick = policy(choices, g.run('deckManager.getActiveDeck()'), pool, rand);
        g.run(`selectAwakeningCard(${JSON.stringify(pick.id)})`);
      } else {
        g.step(FRAME);
      }
      continue;
    }

    // 자동 시전이 꺼져 있으면 사람처럼 0.25초 반응 지연으로 화염구를 누릅니다.
    const c = st.combat;
    if (!(st.grimoires.autocast && st.autoCast)) {
      if (!c.castingSkill && c.gcdRemaining <= 0) {
        reactTimer += FRAME;
        if (reactTimer >= 0.25) { g.run("triggerSkill('fireball', true)"); reactTimer = 0; }
      } else {
        reactTimer = 0;
      }
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
    dmg
  };
}

const quantile = (arr, q) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const fmtSec = (sec) => (Number.isFinite(sec) ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}` : '-');

function report(policyName) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(simulateRun(policyName, BASE_SEED + i));

  console.log(`\n=== 전략: ${policyName} (${RUNS}회) ===`);
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

  const picks = {};
  for (const r of runs) for (const [id, n] of Object.entries(r.deck)) picks[id] = (picks[id] || 0) + n / RUNS;
  console.log('런당 평균 보유: ' + Object.entries(picks).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · '));
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
