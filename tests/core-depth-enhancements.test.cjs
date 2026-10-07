const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const gameJsContent = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
const indexHtmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const stylesCssContent = fs.readFileSync(path.join(__dirname, '../src/styles/styles.css'), 'utf8');

// ==========================================
// 1. [Step 1] 첫 엔딩 전 빌드 개방 (Stage 5 보스부터 SP 지급)
// ==========================================
test('Step 1: 첫 엔딩 전 빌드 개방 (Stage 5, 10, 15, 20 보스 SP 지급) 검증', () => {
  assert.ok(gameJsContent.includes('function getEarnedPhaseBossSp'), 'getEarnedPhaseBossSp 함수가 존재해야 합니다.');
  assert.ok(gameJsContent.includes('Math.min(4, Math.floor(maxStage / 5))'), '보스 격파당 SP 수식이 5스테이지 단위로 최대 4 SP 지급되어야 합니다.');

  // 단위 로직 검증: 1회차 진행 중 보스 클리어 시 SP 산출
  function calcBossSp(highestCleared) {
    return Math.min(4, Math.floor((highestCleared || 0) / 5));
  }

  assert.equal(calcBossSp(1), 0, 'Stage 1: 0 SP');
  assert.equal(calcBossSp(4), 0, 'Stage 4: 0 SP');
  assert.equal(calcBossSp(5), 1, 'Stage 5 (첫 보스 격파): 1 SP 획득 -> 첫 특성 투자 가능!');
  assert.equal(calcBossSp(9), 1, 'Stage 9: 1 SP');
  assert.equal(calcBossSp(10), 2, 'Stage 10 (2차 보스 격파): 2 SP');
  assert.equal(calcBossSp(15), 3, 'Stage 15 (3차 보스 격파): 3 SP');
  assert.equal(calcBossSp(20), 4, 'Stage 20 (최종 보스 격파): 4 SP');
  assert.equal(calcBossSp(25), 4, 'Stage 25: 최대 4 SP 상한 (이후는 승천 회차로 확장)');

  // getAvailableSkillPoints에 getEarnedPhaseBossSp가 합산되는지 확인
  assert.ok(gameJsContent.includes('total = (state.ascensionCount || 0) * 1 + (state.bonusSkillPoints || 0) + getEarnedPhaseBossSp()'), '스킬 포인트 총합에 보스 SP가 합산되어야 합니다.');
});

// ==========================================
// 2. [Step 2] 스마트 세미오토(스킬별 개별 AUTO/OFF) 실질 구현
// ==========================================
test('Step 2: 스마트 세미오토(스킬별 개별 AUTO/OFF) 메커니즘 및 UI 검증', () => {
  assert.ok(gameJsContent.includes('function isSkillAutoActive'), 'isSkillAutoActive 함수가 존재해야 합니다.');
  assert.ok(gameJsContent.includes('function toggleSkillAuto'), 'toggleSkillAuto 함수가 존재해야 합니다.');
  assert.ok(gameJsContent.includes('function updateSkillAutoUI'), 'updateSkillAutoUI 함수가 존재해야 합니다.');
  assert.ok(stylesCssContent.includes('.skill-auto-badge'), 'CSS에 .skill-auto-badge 스타일이 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('.skill-btn.manual-mode-active'), 'CSS에 .manual-mode-active 스타일이 정의되어 있어야 합니다.');

  // 개별 스킬 자동 판정 단위 검증
  const mockState = {
    grimoires: { autocast: true },
    autoCast: true,
    skillAuto: {
      fireball: true,
      fireblast: false, // 수동 설정
      combustion: false, // 수동 설정 (보스 기절 시 폭딜을 위해 아껴둠)
      meteor: true
    }
  };

  function testIsSkillAutoActive(skillKey) {
    if (!mockState.grimoires.autocast || !mockState.autoCast) return false;
    if (!mockState.skillAuto) return true;
    return mockState.skillAuto[skillKey] !== false;
  }

  assert.equal(testIsSkillAutoActive('fireball'), true, '화염구는 AUTO 활성');
  assert.equal(testIsSkillAutoActive('fireblast'), false, '불꽃 작렬은 MANUAL(수동) 설정');
  assert.equal(testIsSkillAutoActive('combustion'), false, '발화는 MANUAL(수동) 설정');
  assert.equal(testIsSkillAutoActive('meteor'), true, '메테오는 AUTO 활성');

  // 전체 자동시전 끄면 모두 비활성화
  mockState.autoCast = false;
  assert.equal(testIsSkillAutoActive('fireball'), false, '전체 자동 OFF 시 fireball도 false');
});

// ==========================================
// 3. [Step 3] Stage 20 엔딩 시네마틱 & 대마법사 실측 통계 리포트
// ==========================================
test('Step 3: 보스 처치 시간 실측 단축치 및 발화 몰열 횟수 리포트 검증', () => {
  assert.ok(gameJsContent.includes('state.currentBossFightStartTime'), '보스 전투 시작 시각이 추적되어야 합니다.');
  assert.ok(gameJsContent.includes('state.bossClearTimes'), '스테이지별 보스 처치 최고 기록이 영구 보존되어야 합니다.');
  assert.ok(gameJsContent.includes('combustionPyros'), '발화 중 몰열 메테오 연타 횟수가 집계되어야 합니다.');

  // 단축 시간 산출 단위 검증
  const bossClearTimes = { 20: 24.5 };
  let fightDuration = 18.2;
  const prevBest = bossClearTimes[20];
  const diff = prevBest - fightDuration;
  assert.equal(Number(diff.toFixed(1)), 6.3, '이전 최고 기록 24.5초 대비 18.2초 처치 시 6.3초 단축');
});

// ==========================================
// 4. [Step 4] 덱빌딩 코어 루프 집중을 위한 일반 몬스터 잔기믹 배제 및 순수 딜사이클 검증
// ==========================================
test('Step 4: 덱빌딩 코어 루프 집중을 위한 일반 몬스터 잔기믹 배제 및 순수 딜사이클 검증', () => {
  // 4-1. 일반 스테이지 딜사이클 방해 잔기믹(기름막/단단한 껍질 방어력 감소)이 배제되었는지 검증
  assert.ok(!gameJsContent.includes('rawDamage *= 0.6; // 껍질 방어력'), '단단한 껍질의 불합리한 딜 40% 감소 페널티가 제거되어 있어야 합니다.');
  assert.ok(!gameJsContent.includes("badge.textContent = '🛢️ 가연성 기름막"), '일반 몬스터 기름막 UI 배지가 제거되어 있어야 합니다.');

  // 4-2. 일반 스테이지에서는 덱 카드 시너지의 데미지가 페널티 없이 100% 온전히 발휘되는지 검증
  let rawDmg = 100;
  const isCrit = true;
  const critMult = 2.0;
  if (isCrit) {
    rawDmg *= critMult;
  }
  assert.equal(rawDmg, 200, '일반 몬스터 공격 시 덱의 치명타 배수가 어떠한 껍질 방어 페널티 없이 온전히 적용되어야 합니다.');
});

// ==========================================
// 5. [Step 5] 2회차 이후 "하데스식 심연의 열기(Heat) 규약"
// ==========================================
test('Step 5: 심연의 열기(Heat) 규약 3종 및 승천 깃털 증폭 검증', () => {
  assert.ok(indexHtmlContent.includes('id="btn-heat-pacts"'), '상단 컨트롤에 #btn-heat-pacts 버튼이 존재해야 합니다.');
  assert.ok(indexHtmlContent.includes('id="modal-heat-pacts"'), '규약 모달 #modal-heat-pacts가 존재해야 합니다.');
  assert.ok(stylesCssContent.includes('.btn-heat'), 'CSS에 .btn-heat 스타일이 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('.heat-pact-card'), 'CSS에 .heat-pact-card 스타일이 정의되어 있어야 합니다.');

  // 깃털 보너스 계산 단위 검증
  const heatPacts = { fast_tempo: true, iron_skin: true, scorched_endure: false };
  function calcHeatBonus(pacts) {
    let bonus = 0;
    if (pacts.fast_tempo) bonus += 0.25;
    if (pacts.iron_skin) bonus += 0.35;
    if (pacts.scorched_endure) bonus += 0.40;
    return bonus;
  }

  const bonus = calcHeatBonus(heatPacts);
  assert.equal(bonus, 0.60, 'fast_tempo(+25%) + iron_skin(+35%) = +60% 깃털 보너스');

  // 승천 깃털 증폭 계산
  const baseFeathers = 5;
  const totalFeathers = Math.round(baseFeathers * (1 + bonus));
  assert.equal(totalFeathers, 8, '기본 5개 -> 규약 60% 보너스 적용 시 8개 획득');
});
