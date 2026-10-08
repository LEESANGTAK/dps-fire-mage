/**
 * scripts/simulate-balance.cjs
 * 
 * DPS: Fire Mage 성장 곡선 및 밸런스 벤치마크 헤드리스 시뮬레이터
 * - 스테이지 1~20 전투 루프를 1,000회 몬테카를로 시뮬레이션
 * - 스테이지별 TTK(처치 시간), 초당 DPS, 카드 획득 분포(일반/희귀/전설) 통계 도출
 * - 주의: game.js 전투 코드를 실행하지 않는 간이 수식 모델이므로 절대 수치보다 곡선 비교 용도로 사용합니다.
 */

const { createDeckManager, CARD_POOL, RARITY } = require('../src/scripts/roguelike-deck.js');

// 1. 스테이지 몬스터 데이터 (game.js 기준)
const STAGE_MONSTERS = [
  { stage: 1, name: '초원 풀숲 슬라임', hp: 50, gold: 4, firstBonus: 2 },
  { stage: 2, name: '푸른 늪지 슬라임', hp: 110, gold: 7, firstBonus: 4 },
  { stage: 3, name: '들판 거대 들쥐', hp: 240, gold: 12, firstBonus: 8 },
  { stage: 4, name: '고블린 정찰병', hp: 480, gold: 20, firstBonus: 14 },
  { stage: 5, name: '붉은송곳니 군주', hp: 1000, gold: 35, firstBonus: 35 },
  { stage: 6, name: '잿빛 숲 늑대', hp: 2400, gold: 52, firstBonus: 40 },
  { stage: 7, name: '놀 야수사냥꾼', hp: 4000, gold: 80, firstBonus: 60 },
  { stage: 8, name: '폐광 해골 광부', hp: 6600, gold: 125, firstBonus: 90 },
  { stage: 9, name: '맹독 모래전갈', hp: 10800, gold: 190, firstBonus: 140 },
  { stage: 10, name: '동굴 오우거 대족장', hp: 18500, gold: 300, firstBonus: 260 },
  { stage: 11, name: '화염 비늘 도마뱀', hp: 29000, gold: 460, firstBonus: 350 },
  { stage: 12, name: '심연 흡혈박쥐', hp: 46000, gold: 700, firstBonus: 500 },
  { stage: 13, name: '고대 바위 파수꾼', hp: 74000, gold: 1050, firstBonus: 800 },
  { stage: 14, name: '타락한 어둠마법사', hp: 118000, gold: 1600, firstBonus: 1200 },
  { stage: 15, name: '붉은 화염 비룡', hp: 195000, gold: 2500, firstBonus: 2200 },
  { stage: 16, name: '저주받은 기사단원', hp: 310000, gold: 3800, firstBonus: 3000 },
  { stage: 17, name: '원한 서린 밴시', hp: 490000, gold: 5800, firstBonus: 4500 },
  { stage: 18, name: '지하군주 거대거미', hp: 780000, gold: 8800, firstBonus: 7000 },
  { stage: 19, name: '심연의 파멸수호병', hp: 1250000, gold: 13500, firstBonus: 11000 },
  { stage: 20, name: '화염군주 라그나로스', hp: 2100000, gold: 22000, firstBonus: 25000 }
];

// 단일 런 시뮬레이션
function simulateSingleRun() {
  const deckManager = createDeckManager();
  const state = {
    currentStage: 1,
    grimoires: {},
    playerStatsBonus: {},
    deckMechanics: {}
  };

  const stageResults = [];

  for (let sIdx = 0; sIdx < STAGE_MONSTERS.length; sIdx++) {
    const stageData = STAGE_MONSTERS[sIdx];
    const isBoss = (sIdx + 1) % 5 === 0;

    // 1. 현재 플레이어 스탯 계산
    let totalSp = 10;
    let totalCrit = 5;
    let totalHaste = 0;
    let totalCritDmg = 1.5;

    // 카드 보너스 합산
    totalSp += state.playerStatsBonus.sp || 0;
    totalCrit += state.playerStatsBonus.crit || 0;
    totalCrit = Math.min(100, totalCrit);
    totalCritDmg += state.playerStatsBonus.critDmg || 0;
    totalHaste += state.playerStatsBonus.haste || 0;

    const hasteMult = 1 + totalHaste / 100;

    // 화염구 시전 시간 (초)
    const isGatling = Boolean(state.deckMechanics && state.deckMechanics.gatlingMode);
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
      deckSize: Object.values(deckManager.getActiveDeck()).reduce((a, b) => a + b, 0)
    });

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
    dpsList: []
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
    });
  }

  console.log(`[📊 스테이지별 평균 전투 지표]`);
  console.log(`단계 | 몬스터 이름           | 체력       | 평균 DPS    | 평균 TTK   | 최단 TTK`);
  console.log(`-----|-----------------------|------------|-------------|------------|---------`);

  stageAggregates.forEach((agg, idx) => {
    const m = STAGE_MONSTERS[idx];
    const avgTtk = (agg.ttks.reduce((a, b) => a + b, 0) / iterations).toFixed(1);
    const minTtk = Math.min(...agg.ttks).toFixed(1);
    const avgDps = Math.round(agg.dpsList.reduce((a, b) => a + b, 0) / iterations);

    const stagePad = String(m.stage).padStart(2, ' ');
    const namePad = m.name.padEnd(12, ' ');
    const hpPad = String(m.hp.toLocaleString()).padStart(10, ' ');
    const dpsPad = String(avgDps.toLocaleString()).padStart(11, ' ');
    const ttkPad = String(avgTtk + 's').padStart(10, ' ');
    const minPad = String(minTtk + 's').padStart(8, ' ');

    console.log(`${stagePad}   | ${namePad} | ${hpPad} | ${dpsPad} | ${ttkPad} | ${minPad}`);
  });

  const totalCards = totalCommon + totalRare + totalLegend;
  console.log(`\n[🃏 런당 평균 카드 획득 분포 (전체 평균 ${(totalCards / iterations).toFixed(1)}장)]`);
  console.log(`- 일반 (Common):     ${(totalCommon / iterations).toFixed(1)}장 (${((totalCommon / totalCards) * 100).toFixed(1)}%)`);
  console.log(`- 희귀 (Rare):       ${(totalRare / iterations).toFixed(1)}장 (${((totalRare / totalCards) * 100).toFixed(1)}%)`);
  console.log(`- 전설 (Legendary):  ${(totalLegend / iterations).toFixed(1)}장 (${((totalLegend / totalCards) * 100).toFixed(1)}%)`);
  console.log(`======================================================\n`);
}

runBenchmark(1000);
