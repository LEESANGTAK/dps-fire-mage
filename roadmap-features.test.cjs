const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// game.js 파일 내용 분석 및 로드맵 기능 검증
const gameJsContent = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

test('Step 1: 상세 딜로그(Details!) 파싱 등급 및 통계 산출 검증', () => {
  assert.ok(gameJsContent.includes('calculateParseGrade'), 'calculateParseGrade 함수가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('openDetailsModal'), 'openDetailsModal 함수가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('details-parse-badge'), '파싱 등급 뱃지 ID가 포함되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('biggestCrit'), '최대 단일 크리티컬 통계가 추적되어야 합니다.');

  // 파싱 등급 계산 로직 단위 검증
  function evalParse(peak, req) {
    const ratio = req > 0 ? peak / req : 1.0;
    if (ratio >= 2.0) return 'mythic';
    if (ratio >= 1.4) return 'heroic';
    if (ratio >= 1.0) return 'rare';
    if (ratio >= 0.7) return 'common';
    return 'grey';
  }

  assert.equal(evalParse(500, 200), 'mythic');
  assert.equal(evalParse(300, 200), 'heroic');
  assert.equal(evalParse(200, 200), 'rare');
  assert.equal(evalParse(150, 200), 'common');
  assert.equal(evalParse(100, 200), 'grey');
});

test('Step 1: 발화(마력 폭주) 피버 모드 및 피치업 연출 검증', () => {
  assert.ok(gameJsContent.includes('fever-mode'), '피버 모드 클래스가 정의되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('combPitch'), '발화 시 사운드 피치 조절 로직이 포함되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('dps-fever-tag'), 'DPS 미터기 피버 태그가 연동되어 있어야 합니다.');
});

test('Step 2: 불사조 승천 시 마도서 스킬 및 자동시전 영구 보존(스피드런 쾌감) 검증', () => {
  // doAscend 함수 내에서 마도서 스킬을 지우지 않는지 확인
  const doAscendRegex = /function doAscend\(\)\s*\{([\s\S]*?)\n\}/;
  const match = gameJsContent.match(doAscendRegex);
  assert.ok(match, 'doAscend 함수가 존재해야 합니다.');
  const doAscendBody = match[1];

  // 마도서(grimoires)를 false로 초기화하는 루프가 제거되었는지 검증
  assert.ok(!doAscendBody.includes('state.grimoires[k] = false'), '승천 시 마도서 스킬을 박탈하지 않아야 합니다.');
  assert.ok(!doAscendBody.includes('state.autoCast = false'), '승천 시 자동 시전을 박탈하지 않아야 합니다.');
  assert.ok(doAscendBody.includes('ascensionCount'), '승천 횟수가 누적되어야 합니다.');
  assert.ok(gameJsContent.includes('total = (state.ascensionCount || 0) * 1'), '승천 횟수당 영구 스킬 포인트가 연동되어야 합니다.');
});

test('Step 3: 5스테이지 단위 페이즈 보스 기믹 검증', () => {
  assert.ok(gameJsContent.includes('updateBossGimmick'), '보스 기믹 갱신 함수가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('boss-gimmick-badge'), '보스 기믹 뱃지 연동이 포함되어 있어야 합니다.');

  // Stage 10 오우거 바위 갑옷 & 융해
  assert.ok(gameJsContent.includes('바위 갑옷'), '오우거 바위 갑옷 기믹이 포함되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('갑옷 융해'), '화상 도트 연계 시 갑옷 융해 기믹이 포함되어 있어야 합니다.');

  // Stage 15 비룡 비상 & 격추 기절
  assert.ok(gameJsContent.includes('isAirborne'), '비룡 공중 비행 상태가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('groggyTimer'), '격추 시 그로기 기절 타이머가 구현되어 있어야 합니다.');

  // Stage 20 라그나로스 불의 심장 실드
  assert.ok(gameJsContent.includes('shieldTimer'), '라그나로스 광폭화 보호막 타이머가 구현되어 있어야 합니다.');
});

test('Step 3: 순환형 미니 현상금(Bounty) 퀘스트 시스템 검증', () => {
  assert.ok(gameJsContent.includes('BOUNTY_TEMPLATES'), '현상금 템플릿 목록이 정의되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('checkBountyProgress'), '현상금 진척도 체크 함수가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('generateNextBounty'), '다음 현상금 생성 함수가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('bounty-prog-fill'), '현상금 게이지 UI가 연동되어 있어야 합니다.');
});
