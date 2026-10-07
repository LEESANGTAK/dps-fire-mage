/**
 * scripts/simulate-balance.cjs
 * 
 * DPS: Fire Mage 성장 곡선 및 밸런스 벤치마크 헤드리스 시뮬레이터
 * - 스테이지 1~20 전투 루프를 1,000회 몬테카를로 시뮬레이션
 * - 스테이지별 TTK(처치 시간), 초당 DPS, 카드 획득 분포(일반/희귀/전설) 통계 도출
 */

const { createDeckManager, CARD_POOL, RARITY } = require('../src/scripts/roguelike-deck.js');

// 1. 스테이지 몬스터 데이터 (game.js 기준)
const STAGE_MONSTERS = [
  { stage: 1, name: '초원 풀숲 슬라임', hp: 50, timeLimit: 25, gold: 4, firstBonus: 2 },
  { stage: 2, name: '푸른 늪지 슬라임', hp: 110, timeLimit: 25, gold: 7, firstBonus: 4 },
  { stage: 3, name: '들판 거대 들쥐', hp: 240, timeLimit: 25, gold: 12, firstBonus: 8 },
  { stage: 4, name: '고블린 정찰병', hp: 480, timeLimit: 25, gold: 20, firstBonus: 14 },
  { stage: 5, name: '붉은송곳니 군주', hp: 1000, timeLimit: 28, gold: 35, firstBonus: 35 },
  { stage: 6, name: '잿빛 숲 늑대', hp: 2400, timeLimit: 25, gold: 52, firstBonus: 40 },
  { stage: 7, name: '놀 야수사냥꾼', hp: 4000, timeLimit: 25, gold: 80, firstBonus: 60 },
  { stage: 8, name: '폐광 해골 광부', hp: 6600, timeLimit: 25, gold: 125, firstBonus: 90 },
  { stage: 9, name: '맹독 모래전갈', hp: 10800, timeLimit: 25, gold: 190, firstBonus: 140 },
  { stage: 10, name: '동굴 오우거 대족장', hp: 18500, timeLimit: 28, gold: 300, firstBonus: 260 },
  { stage: 11, name: '화염 비늘 도마뱀', hp: 29000, timeLimit: 25, gold: 460, firstBonus: 350 },
  { stage: 12, name: '심연 흡혈박쥐', hp: 46000, timeLimit: 25, gold: 700, firstBonus: 500 },
  { stage: 13, name: '고대 바위 파수꾼', hp: 74000, timeLimit: 25, gold: 1050, firstBonus: 800 },
  { stage: 14, name: '타락한 어둠마법사', hp: 118000, timeLimit: 25, gold: 1600, firstBonus: 1200 },
  { stage: 15, name: '붉은 화염 비룡', hp: 195000, timeLimit: 30, gold: 2500, firstBonus: 2200 },
  { stage: 16, name: '저주받은 기사단원', hp: 310000, timeLimit: 25, gold: 3800, firstBonus: 3000 },
  { stage: 17, name: '원한 서린 밴시', hp: 490000, timeLimit: 25, gold: 5800, firstBonus: 4500 },
  { stage: 18, name: '지하군주 거대거미', hp: 780000, timeLimit: 25, gold: 8800, firstBonus: 7000 },
  { stage: 19, name: '심연의 파멸수호병', hp: 1250000, timeLimit: 25, gold: 13500, firstBonus: 11000 },
  { stage: 20, name: '화염군주 라그나로스', hp: 2100000, timeLimit: 32, gold: 22000, firstBonus: 25000 }
];

// 장비 목록
const EQUIPMENT_LIST = [
  { id: 'oak_wand', baseCost: 8, costScale: 1.35, effect: (lv) => ({ sp: lv * 2 }) },
  { id: 'ruby_ring', baseCost: 22, costScale: 1.38, effect: (lv) => ({ crit: lv * 1.5, sp: lv * 2 }) },
  { id: 'swift_gloves', baseCost: 60, costScale: 1.4, effect: (lv) => ({ haste: lv * 3, sp: lv * 4 }) },
  { id: 'flame_orb', baseCost: 160, costScale: 1.42, effect: (lv) => ({ critDmg: lv * 0.08, sp: lv * 9 }) },
  { id: 'sunfire_staff', baseCost: 450, costScale: 1.45, effect: (lv) => ({ sp: lv * 22, crit: lv * 1.5 }) },
  { id: 'chrono_watch', baseCost: 1250, costScale: 1.48, effect: (lv) => ({ cdr: lv * 0.03, haste: lv * 3, sp: lv * 55 }) },
  { id: 'firelord_crown', baseCost: 3600, costScale: 1.5, effect: (lv) => ({ sp: lv * 140, critDmg: lv * 0.12 }) },
  { id: 'arcane_grail', baseCost: 11000, baseCost: 11000, costScale: 1.55, effect: (lv) => ({ sp: lv * 380, bonusPct: lv * 0.06 }) }
];

// 단일 런 시뮬레이션
function simulateSingleRun() {
  const deckManager = createDeckManager();
  const state = {
    gold: 0,
    currentStage: 1,
    grimoires: {},
    playerStatsBonus: {},
    deckMechanics: {},
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
    skillMastery: {}
  };

  const stageResults = [];

  for (let sIdx = 0; sIdx < STAGE_MONSTERS.length; sIdx++) {
    const stageData = STAGE_MONSTERS[sIdx];
    const isBoss = (sIdx + 1) % 5 === 0;

    // 장비 업그레이드 (가능한 가장 싼 장비부터 순차 구매)
    let boughtAny = true;
    while (boughtAny) {
      boughtAny = false;
      for (const eq of EQUIPMENT_LIST) {
        const lv = state.items[eq.id] || 0;
        const cost = Math.round(eq.baseCost * Math.pow(eq.costScale, lv));
        if (state.gold >= cost) {
          state.gold -= cost;
          state.items[eq.id] = lv + 1;
          boughtAny = true;
          break;
        }
      }
    }

    // 1. 현재 플레이어 스탯 계산
    let totalSp = 10;
    let totalCrit = 5;
    let totalHaste = 0;
    let totalCritDmg = 1.5;

    // 장비 효과 합산
    for (const eq of EQUIPMENT_LIST) {
      const lv = state.items[eq.id] || 0;
      if (lv > 0) {
        const eff = eq.effect(lv);
        if (eff.sp) totalSp += eff.sp;
        if (eff.crit) totalCrit += eff.crit;
        if (eff.haste) totalHaste += eff.haste;
        if (eff.critDmg) totalCritDmg += eff.critDmg;
      }
    }

    // 카드 보너스 합산
    totalSp += state.playerStatsBonus.sp || 0;
    totalCrit += state.playerStatsBonus.crit || 0;
    totalCrit = Math.min(100, totalCrit);
    totalCritDmg += state.playerStatsBonus.critDmg || 0;
    totalHaste += state.playerStatsBonus.haste || 0;

    const hasteMult = 1 + totalHaste / 100;

    // 화염구 시전 시간 (초)
    const isGatling = Boolean(state.deckMechanics && state.deckMechanics.gatling);
    const fireballCastTime = isGatling ? 0.3 : Math.max(0.4, 1.8 / hasteMult);
    const fireballDamage = totalSp * 1.5;

    // 초당 화염구 DPS
    const critRate = totalCrit / 100;
    const avgFireballHit = fireballDamage * (1 - critRate) + fireballDamage * totalCritDmg * critRate;
    let dps = avgFireballHit / fireballCastTime;

    // 분열 화염구 효과
    if (state.deckMechanics && state.deckMechanics.splitFireball) {
      dps += (avgFireballHit * 0.4 * 2 * state.deckMechanics.splitFireball) / fireballCastTime;
    }

    // 소환수 DPS
    const spirits = (state.deckMechanics && state.deckMechanics.extraSpirits) || 0;
    if (spirits > 0) {
      const spiritHit = totalSp * 0.45;
      const spiritDps = (spiritHit / 1.3) * spirits;
      dps += spiritDps;
    }

    // 보조 마법(불꽃 작렬, 메테오) DPS 간이 추산
    if (state.grimoires.fireblast) {
      dps += (totalSp * 2.2 * totalCritDmg) / 8.0;
    }
    if (state.grimoires.meteor) {
      const meteorInterval = isGatling ? 2.5 : 5.0;
      dps += (totalSp * 5.0 * (1 + (critRate * (totalCritDmg - 1)))) / meteorInterval;
    }

    // 처형인 효과 (체력 40% 이하 시 70% 증폭) -> 평균 약 28% DPS 증가
    if (state.deckMechanics && state.deckMechanics.executionerMult) {
      dps *= (1 + state.deckMechanics.executionerMult * 0.4);
    }

    dps = Math.max(1, dps);

    // TTK (처치 시간)
    const ttk = stageData.hp / dps;

    stageResults.push({
      stage: stageData.stage,
      hp: stageData.hp,
      dps: Math.round(dps),
      ttk: Number(ttk.toFixed(2)),
      timeout: ttk > stageData.timeLimit,
      deckSize: Object.values(deckManager.getActiveDeck()).reduce((a, b) => a + b, 0)
    });

    // 스테이지 클리어 보상 (골드 보너스 반영)
    const goldBonus = 1 + (state.playerStatsBonus.goldBonus || 0);
    state.gold += Math.round((stageData.gold + stageData.firstBonus) * goldBonus);

    // 카드 3지선다 뽑기 & 무작위 1장 선택
    const choices = deckManager.drawChoices(3, isBoss, state);
    if (choices.length > 0) {
      choices.sort((a, b) => {
        const score = { [RARITY.LEGENDARY]: 3, [RARITY.RARE]: 2, [RARITY.COMMON]: 1 };
        return (score[b.rarity] || 1) - (score[a.rarity] || 1);
      });
      deckManager.selectCard(choices[0].id, state);
    }
  }

  // 획득한 카드 등급별 집계
  const activeDeck = deckManager.getActiveDeck();
  let commonCards = 0;
  let rareCards = 0;
  let legendCards = 0;

  for (const [cardId, count] of Object.entries(activeDeck)) {
    const cardDef = CARD_POOL.find(c => c.id === cardId);
    if (!cardDef) continue;
    if (cardDef.rarity === RARITY.COMMON) commonCards += count;
    else if (cardDef.rarity === RARITY.RARE) rareCards += count;
    else if (cardDef.rarity === RARITY.LEGENDARY) legendCards += count;
  }

  return {
    stageResults,
    cardCounts: { common: commonCards, rare: rareCards, legendary: legendCards }
  };
}

// 벤치마크 실행
function runBenchmark(iterations = 1000) {
  console.log(`\n======================================================`);
  console.log(`🔥 DPS: Fire Mage 밸런스 시뮬레이터 (${iterations}회 몬테카를로 런)`);
  console.log(`======================================================\n`);

  const stageAggregates = STAGE_MONSTERS.map(() => ({
    ttks: [],
    dpsList: [],
    timeouts: 0
  }));

  let totalCommon = 0;
  let totalRare = 0;
  let totalLegend = 0;

  for (let i = 0; i < iterations; i++) {
    const run = simulateSingleRun();
    totalCommon += run.cardCounts.common;
    totalRare += run.cardCounts.rare;
    totalLegend += run.cardCounts.legendary;

    run.stageResults.forEach((sr, idx) => {
      stageAggregates[idx].ttks.push(sr.ttk);
      stageAggregates[idx].dpsList.push(sr.dps);
      if (sr.timeout) stageAggregates[idx].timeouts++;
    });
  }

  console.log(`[📊 스테이지별 평균 전투 지표]`);
  console.log(`단계 | 몬스터 이름           | 체력       | 평균 DPS    | 평균 TTK   | 최단 TTK | 제한시간 | 타임아웃률`);
  console.log(`-----|-----------------------|------------|-------------|------------|----------|----------|-----------`);

  stageAggregates.forEach((agg, idx) => {
    const m = STAGE_MONSTERS[idx];
    const avgTtk = (agg.ttks.reduce((a, b) => a + b, 0) / iterations).toFixed(1);
    const minTtk = Math.min(...agg.ttks).toFixed(1);
    const avgDps = Math.round(agg.dpsList.reduce((a, b) => a + b, 0) / iterations);
    const timeoutRate = ((agg.timeouts / iterations) * 100).toFixed(1) + '%';

    const stagePad = String(m.stage).padStart(2, ' ');
    const namePad = m.name.padEnd(12, ' ');
    const hpPad = String(m.hp.toLocaleString()).padStart(10, ' ');
    const dpsPad = String(avgDps.toLocaleString()).padStart(11, ' ');
    const ttkPad = String(avgTtk + 's').padStart(10, ' ');
    const minPad = String(minTtk + 's').padStart(8, ' ');
    const limitPad = String(m.timeLimit + 's').padStart(8, ' ');
    const timeoutPad = String(timeoutRate).padStart(9, ' ');

    console.log(`${stagePad}   | ${namePad} | ${hpPad} | ${dpsPad} | ${ttkPad} | ${minPad} | ${limitPad} | ${timeoutPad}`);
  });

  const totalCards = totalCommon + totalRare + totalLegend;
  console.log(`\n[🃏 런당 평균 카드 획득 분포 (전체 평균 ${(totalCards / iterations).toFixed(1)}장)]`);
  console.log(`- 일반 (Common):     ${(totalCommon / iterations).toFixed(1)}장 (${((totalCommon / totalCards) * 100).toFixed(1)}%)`);
  console.log(`- 희귀 (Rare):       ${(totalRare / iterations).toFixed(1)}장 (${((totalRare / totalCards) * 100).toFixed(1)}%)`);
  console.log(`- 전설 (Legendary):  ${(totalLegend / iterations).toFixed(1)}장 (${((totalLegend / totalCards) * 100).toFixed(1)}%)`);
  console.log(`======================================================\n`);
}

runBenchmark(1000);
