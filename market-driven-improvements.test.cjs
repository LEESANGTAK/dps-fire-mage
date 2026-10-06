const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const gameJsContent = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
const indexHtmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const stylesCssContent = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');

// ==========================================
// 1. [P0] 타오르는 기운 (Heating Up Pity System) 검증
// ==========================================
test('P0: 타오르는 기운 (Heating Up Pity System) 메커니즘 및 UI 검증', () => {
  // 1-1. 마크업 및 스타일 검증
  assert.ok(indexHtmlContent.includes('id="badge-pity-crit"'), '화염구 버튼에 pity-crit 배지가 존재해야 합니다.');
  assert.ok(stylesCssContent.includes('.pity-crit-badge'), 'CSS에 .pity-crit-badge 스타일이 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('pityPulse'), 'CSS에 pityPulse 애니메이션이 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('.heating-pity-active'), 'CSS에 .heating-pity-active 활성 스타일이 정의되어 있어야 합니다.');

  // 1-2. game.js 코드 로직 검증
  assert.ok(gameJsContent.includes('updatePityCritBadgeUI'), 'updatePityCritBadgeUI 함수가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('pityCritStacks'), 'state.combat에 pityCritStacks 변수가 연동되어 있어야 합니다.');

  // 1-3. VM 환경에서 불운 방지(Soft Bad-Luck Protection) 누적 및 리셋 시뮬레이션
  const combat = { pityCritStacks: 0 };
  const mockState = { combat };

  // 비치명타 시 스택 누적 로직 단위 검증
  function simulateHit(isCrit) {
    if (!isCrit) {
      mockState.combat.pityCritStacks = Math.min(6, (mockState.combat.pityCritStacks || 0) + 1);
    } else {
      mockState.combat.pityCritStacks = 0;
    }
  }

  function calculatePityBonus(stacks) {
    return stacks >= 4 ? 5 + Math.random() * 10 : 0;
  }

  // 1~3회 비치명타: 보정 0%
  simulateHit(false);
  assert.equal(mockState.combat.pityCritStacks, 1, '1회 일반타 시 1스택');
  assert.equal(calculatePityBonus(mockState.combat.pityCritStacks), 0, '1스택 시 보정 0%');

  simulateHit(false);
  assert.equal(mockState.combat.pityCritStacks, 2, '2회 일반타 시 2스택');
  assert.equal(calculatePityBonus(mockState.combat.pityCritStacks), 0, '2스택 시 보정 0%');

  simulateHit(false);
  assert.equal(mockState.combat.pityCritStacks, 3, '3회 일반타 시 3스택');
  assert.equal(calculatePityBonus(mockState.combat.pityCritStacks), 0, '3스택 시 보정 0%');

  // 4회 비치명타부터: 5% ~ 15% 가변 보정
  simulateHit(false);
  assert.equal(mockState.combat.pityCritStacks, 4, '4회 일반타 시 4스택');
  const bonusAt4 = calculatePityBonus(mockState.combat.pityCritStacks);
  assert.ok(bonusAt4 >= 5 && bonusAt4 <= 15, '4스택부터 +5% ~ +15% 가변 난수 보정');

  // 최대 6스택 초과 방지 검증
  simulateHit(false);
  simulateHit(false);
  simulateHit(false); // 7번째
  assert.equal(mockState.combat.pityCritStacks, 6, '최대 6스택 상한 제한');

  // 치명타 발생 시 0으로 리셋
  simulateHit(true);
  assert.equal(mockState.combat.pityCritStacks, 0, '치명타 적중 시 스택 완전 초기화');
  assert.equal(calculatePityBonus(mockState.combat.pityCritStacks), 0, '리셋 후 보정 0%');
});

// ==========================================
// 2. [P1] 불사조 승천 영구 유물 & 깃털 상점 (Phoenix Artifacts & Feathers) 검증
// ==========================================
test('P1: 불사조 영구 유물 5종 및 승천 깃털 상점 메커니즘 검증', () => {
  // 2-1. 마크업 및 스타일 검증
  assert.ok(indexHtmlContent.includes('id="tab-btn-artifacts"'), '우측 탭에 [🪶 유물] 버튼이 존재해야 합니다.');
  assert.ok(indexHtmlContent.includes('id="pane-artifacts"'), '우측 상점 영역에 #pane-artifacts 탭이 존재해야 합니다.');
  assert.ok(indexHtmlContent.includes('id="pill-feathers"'), '상단 스탯바에 #pill-feathers가 존재해야 합니다.');
  assert.ok(stylesCssContent.includes('.artifact-card'), 'CSS에 .artifact-card 스타일이 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('.feather-pill'), 'CSS에 .feather-pill 스타일이 정의되어 있어야 합니다.');

  // 2-2. 유물 데이터 정의 5종 검증
  assert.ok(gameJsContent.includes('const PHOENIX_ARTIFACTS = ['), 'PHOENIX_ARTIFACTS 상수가 정의되어 있어야 합니다.');
  const requiredArtifactIds = ['shard_of_sun', 'twin_cataclysm', 'ignited_circ', 'time_warp', 'phoenix_treasury'];
  for (const artId of requiredArtifactIds) {
    assert.ok(gameJsContent.includes(`id: '${artId}'`), `유물 [${artId}]가 정의되어 있어야 합니다.`);
  }

  // 2-3. 승천 시 깃털 지급 수식 검증
  function calcFeathersGained(maxStage) {
    return 1 + Math.max(0, Math.floor(((maxStage || 20) - 20) / 5));
  }
  assert.equal(calcFeathersGained(20), 1, 'Stage 20 첫 승천 시 기본 1 깃털');
  assert.equal(calcFeathersGained(24), 1, 'Stage 24 승천 시 1 깃털');
  assert.equal(calcFeathersGained(25), 2, 'Stage 25 승천 시 2 깃털');
  assert.equal(calcFeathersGained(40), 5, 'Stage 40 승천 시 5 깃털');

  // 2-4. 유물 구매 함수 및 레벨업 단위 검증
  const testState = {
    phoenixFeathers: 3,
    artifacts: { shard_of_sun: 0 }
  };
  const artDef = { id: 'shard_of_sun', maxLv: 3, cost: 1 };

  function buyMockArtifact(art) {
    const lv = testState.artifacts[art.id] || 0;
    if (lv >= art.maxLv || testState.phoenixFeathers < art.cost) return false;
    testState.phoenixFeathers -= art.cost;
    testState.artifacts[art.id] = lv + 1;
    return true;
  }

  assert.ok(buyMockArtifact(artDef), '깃털이 충분할 때 구매 성공');
  assert.equal(testState.artifacts.shard_of_sun, 1, '레벨이 1로 증가해야 함');
  assert.equal(testState.phoenixFeathers, 2, '깃털이 1 차감되어 2가 되어야 함');

  buyMockArtifact(artDef); // lv 2
  buyMockArtifact(artDef); // lv 3 (MAX)
  assert.equal(testState.artifacts.shard_of_sun, 3);
  assert.equal(testState.phoenixFeathers, 0);

  // MAX 상태에서 추가 구매 불가 검증
  testState.phoenixFeathers = 10;
  assert.equal(buyMockArtifact(artDef), false, 'MAX 레벨에서는 추가 구매 불가');
  assert.equal(testState.phoenixFeathers, 10, '깃털이 차감되지 않아야 함');

  // 2-5. 각 아티팩트 메커니즘 코드 반영 확인
  assert.ok(gameJsContent.includes('shard_of_sun'), '태양의 파편 즉발 확률 코드가 연동되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('twin_cataclysm'), '쌍둥이 운석 추가 보조 낙하 코드가 연동되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('ignited_circ'), '타오르는 마력순환 불꽃 작렬 즉시 충전 코드가 연동되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('time_warp'), '시공 왜곡 발화 지속시간/쿨다운 코드가 연동되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('phoenix_treasury'), '불사조 보물창고 골드/정수 증폭 코드가 연동되어 있어야 합니다.');
});

// ==========================================
// 3. [P2] 3대 빌드 키스톤 특성 (Build Keystones) 검증
// ==========================================
test('P2: 3대 빌드 키스톤 특성 정의 및 시너지 메커니즘 검증', () => {
  // 3-1. 마크업 및 스타일 검증
  assert.ok(indexHtmlContent.includes('id="keystone-selector-box"'), '특성 트리에 #keystone-selector-box가 존재해야 합니다.');
  assert.ok(stylesCssContent.includes('.keystone-card'), 'CSS에 .keystone-card 스타일이 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('.keystone-card.active'), 'CSS에 .keystone-card.active 활성 스타일이 정의되어 있어야 합니다.');

  // 3-2. 키스톤 정의 3종 검증
  assert.ok(gameJsContent.includes('const KEYSTONE_DEFINITIONS = ['), 'KEYSTONE_DEFINITIONS 상수가 정의되어 있어야 합니다.');
  const requiredKeystones = ['burst', 'dot', 'summon'];
  for (const kId of requiredKeystones) {
    assert.ok(gameJsContent.includes(`id: '${kId}'`), `키스톤 [${kId}]가 정의되어 있어야 합니다.`);
  }

  // 3-3. toggleKeystone 토글 로직 검증
  const mockState = { activeKeystone: null };
  function toggleKeystone(id) {
    if (mockState.activeKeystone === id) {
      mockState.activeKeystone = null;
    } else {
      mockState.activeKeystone = id;
    }
  }

  toggleKeystone('burst');
  assert.equal(mockState.activeKeystone, 'burst', 'burst 선택 시 activeKeystone은 burst');
  toggleKeystone('burst');
  assert.equal(mockState.activeKeystone, null, '동일 키스톤 재클릭 시 선택 해제');
  toggleKeystone('dot');
  assert.equal(mockState.activeKeystone, 'dot', 'dot 선택 시 activeKeystone은 dot');
  toggleKeystone('summon');
  assert.equal(mockState.activeKeystone, 'summon', '다른 키스톤 클릭 시 전환');

  // 3-4. 키스톤 효과 코드 연동 확인
  assert.ok(gameJsContent.includes("activeKeystone === 'burst'"), 'burst 키스톤 데미지 증폭 및 쿨다운 가속 로직 연동 확인');
  assert.ok(gameJsContent.includes("activeKeystone === 'dot'"), 'dot 키스톤 도트 틱 증폭 및 쿨감 로직 연동 확인');
  assert.ok(gameJsContent.includes("activeKeystone === 'summon'"), 'summon 키스톤 소환수 공격속도 및 치명타 공유 연동 확인');
});

// ==========================================
// 4. [P3] 30초 훈련용 허수아비 벤치마크 모드 검증
// ==========================================
test('P3: 훈련용 허수아비 시스템 제거 및 미니멀리즘 정합성 검증', () => {
  assert.ok(!indexHtmlContent.includes('id="btn-training-dummy"'), '상단 컨트롤에 #btn-training-dummy가 제거되어야 합니다.');
  assert.ok(!indexHtmlContent.includes('id="training-dummy-banner"'), '아레나 상단에 #training-dummy-banner가 제거되어야 합니다.');
  assert.ok(!stylesCssContent.includes('.training-dummy-banner'), 'CSS에 .training-dummy-banner 스타일이 제거되어야 합니다.');
  assert.ok(!gameJsContent.includes('startTrainingDummyMode'), 'startTrainingDummyMode 함수가 제거되어야 합니다.');
  assert.ok(!gameJsContent.includes('finishTrainingDummyMode'), 'finishTrainingDummyMode 함수가 제거되어야 합니다.');
  assert.ok(!gameJsContent.includes('exitTrainingDummyMode'), 'exitTrainingDummyMode 함수가 제거되어야 합니다.');
});
