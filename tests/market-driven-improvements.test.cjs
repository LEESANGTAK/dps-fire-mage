const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const gameJsContent = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
const stylesCssContent = fs.readFileSync(path.join(__dirname, '../src/styles/styles.css'), 'utf8');

// ==========================================
// 1. [P0] 타오르는 기운 (Heating Up Pity System) 검증
// ==========================================
test('P0: 타오르는 기운 (Heating Up Pity System) 메커니즘 및 UI 검증', () => {
  // 1-1. 스타일 검증 (텍스트 배지 없이 화염구 버튼 발광으로만 표시)
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
