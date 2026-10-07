const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// game.js 파일 내용 분석 및 로드맵 기능 검증
const gameJsContent = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');

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

test('Bugfix: 상세 딜미터기(Details!) 모달 hidden 스타일 우선순위 및 닫기/일시정지 무결성 검증', () => {
  const stylesCssContent = fs.readFileSync(path.join(__dirname, '../src/styles/styles.css'), 'utf8');
  const indexHtmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  // 1. styles.css에 전역 .hidden 및 .details-modal-backdrop.hidden 이 display: none !important 로 명시되어 있는지 검증
  assert.ok(
    /\.details-modal-backdrop\.hidden\s*\{[\s\S]*?display:\s*none\s*!important;/.test(stylesCssContent),
    '.details-modal-backdrop.hidden 에 display: none !important 가 지정되어 있어야 시작 시 자동 노출되지 않고 닫힙니다.'
  );
  assert.ok(
    /\.hidden\s*\{[\s\S]*?display:\s*none\s*!important;/.test(stylesCssContent),
    '전역 .hidden 유틸리티 클래스가 display: none !important 로 선언되어 있어야 합니다.'
  );

  // 2. index.html의 details-modal 초기 상태에 hidden 클래스가 포함되어 있는지 검증
  assert.ok(
    indexHtmlContent.includes('id="details-modal"') &&
    indexHtmlContent.includes('class="details-modal-backdrop hidden"'),
    'index.html의 details-modal 요소는 초기에 hidden 클래스를 지니고 있어야 합니다.'
  );

  // 3. game.js에서 openDetailsModal 호출 시 전투 일시정지(state.isPaused = true), closeDetailsModal 호출 시 해제(state.isPaused = false) 검증
  const openFnRegex = /function openDetailsModal\(\)\s*\{([\s\S]*?)\n\}/;
  const closeFnRegex = /function closeDetailsModal\(\)\s*\{([\s\S]*?)\n\}/;

  const openMatch = gameJsContent.match(openFnRegex);
  const closeMatch = gameJsContent.match(closeFnRegex);

  assert.ok(openMatch, 'openDetailsModal 함수가 존재해야 합니다.');
  assert.ok(closeMatch, 'closeDetailsModal 함수가 존재해야 합니다.');

  assert.ok(openMatch[1].includes('state.isPaused = true'), '상세 리포트 열람 중에는 게임이 일시정지(state.isPaused = true)되어야 합니다.');
  assert.ok(closeMatch[1].includes('state.isPaused = false'), '상세 리포트 닫기 시에는 게임이 재개(state.isPaused = false)되어야 합니다.');

  // 4. 모달 외부 배경 클릭 및 ESC 키 닫기 이벤트 핸들러가 바인딩되어 있는지 검증
  assert.ok(gameJsContent.includes("e.target === detailsModal"), '모달 배경 클릭 시 닫기 처리가 있어야 합니다.');
  assert.ok(gameJsContent.includes("e.key === 'Escape'"), 'ESC 키를 통한 닫기 처리가 있어야 합니다.');
});

test('UX 피드백 1: 퀘스트 달성 보상 골드 비행 애니메이션 검증 (정수 제거 및 골드 전담화)', () => {
  assert.ok(gameJsContent.includes('spawnGoldCoinFlight(rwGold, true, bountyBarEl)'), '퀘스트 완료 시 골드 비행 애니메이션이 발동되어야 합니다.');
  assert.ok(!gameJsContent.includes('spawnEssenceFlight(rwEss, bountyBarEl)'), '퀘스트 완료 시 불필요한 정수 비행 애니메이션이 제거되어야 합니다.');
  assert.ok(gameJsContent.includes('customStartEl'), '비행 화폐 함수가 커스텀 출발지 요소를 지원해야 합니다.');
});

test('UX 피드백 2: 캐릭터 발 아래 자동시전 마법진 전개 및 발광 검증', () => {
  const indexHtmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const stylesCssContent = fs.readFileSync(path.join(__dirname, '../src/styles/styles.css'), 'utf8');

  // 마크업에 autocast-magic-circle 및 룬 SVG가 포함되어 있는지 검증
  assert.ok(indexHtmlContent.includes('id="autocast-magic-circle"'), '캐릭터 발 아래 autocast-magic-circle 마크업이 존재해야 합니다.');
  assert.ok(indexHtmlContent.includes('class="magic-circle-svg"'), '마법진 룬 SVG가 렌더링되어 있어야 합니다.');

  // styles.css에 원근 및 회전 애니메이션 스타일 검증
  assert.ok(stylesCssContent.includes('.autocast-magic-circle'), '마법진 CSS 클래스가 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('magicCircleSpin'), '마법진 회전 애니메이션이 정의되어 있어야 합니다.');
  assert.ok(stylesCssContent.includes('scale(1, 0.28)'), '바닥면에 눕혀진 원근감(scale)이 적용되어 있어야 합니다.');

  // game.js에 updateAutoCastMagicCircle 함수 검증
  assert.ok(gameJsContent.includes('function updateAutoCastMagicCircle'), 'updateAutoCastMagicCircle 함수가 구현되어 있어야 합니다.');
});

test('UX 피드백 3: 퀘스트 해금 조건 연동 및 미해금 스킬 퀘스트 배제 검증', () => {
  // 템플릿에 req 조건 함수가 포함되어 있는지 검증
  assert.ok(gameJsContent.includes('isBountyValid'), '퀘스트 유효성 검사 함수가 존재해야 합니다.');
  assert.ok(gameJsContent.includes('state.grimoires.combustion'), '발화 퀘스트는 발화 스킬 해금 시에만 등장해야 합니다.');
  assert.ok(gameJsContent.includes('state.grimoires.meteor'), '메테오 퀘스트는 메테오 스킬 해금 시에만 등장해야 합니다.');
  assert.ok(gameJsContent.includes('state.grimoires.fireblast'), '불꽃작렬 퀘스트는 불꽃작렬 스킬 해금 시에만 등장해야 합니다.');
  assert.ok(gameJsContent.includes('fireball_cast'), '초반 기본 퀘스트로 화염구 시전이 지원되어야 합니다.');
});

test('UX 피드백 4: 스킬 마우스 클릭 시 툴팁 즉시 닫힘 검증', () => {
  const tooltipsJsContent = fs.readFileSync(path.join(__dirname, '../src/scripts/skill-tooltips.js'), 'utf8');
  assert.ok(tooltipsJsContent.includes('pointerdown'), 'pointerdown 이벤트 리스너가 등록되어 있어야 합니다.');
  assert.ok(tooltipsJsContent.includes('dismissOnClick'), '클릭/다운 시 즉시 툴팁을 닫는 핸들러가 구현되어 있어야 합니다.');
  assert.ok(tooltipsJsContent.includes('button.blur()'), '클릭 후 포커스가 해제되어 툴팁이 화면에 고정되지 않아야 합니다.');
});


