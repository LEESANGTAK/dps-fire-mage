const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// game.js 파일 내용 분석 및 로드맵 기능 검증
const gameJsContent = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');

test('Step 1: 발화(마력 폭주) 피버 모드 및 피치업 연출 검증', () => {
  assert.ok(gameJsContent.includes('fever-mode'), '피버 모드 클래스가 정의되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('combPitch'), '발화 시 사운드 피치 조절 로직이 포함되어 있어야 합니다.');
  assert.ok(/arenaArt\.classList\.toggle\('fever-mode', c\.combustionRem > 0\)/.test(gameJsContent), '발화 중에는 전장 전체에 피버 모드가 적용되어야 합니다.');
});

test('Step 3: 최종 보스 불의 심장 보호막 기믹 및 일반 몬스터 기믹 배제 검증', () => {
  assert.ok(gameJsContent.includes('updateBossGimmick'), '보스 기믹 갱신 함수가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('boss-gimmick-badge'), '보스 기믹 뱃지 연동이 포함되어 있어야 합니다.');

  // Stage 20 최종 보스 불의 심장 실드 유지 검증
  assert.ok(gameJsContent.includes('shieldTimer'), '최종 보스 광폭화 보호막 타이머가 구현되어 있어야 합니다.');
  assert.ok(gameJsContent.includes('불의 심장'), '최종 보스 불의 심장 기믹이 구현되어 있어야 합니다.');

  // 일반 몬스터 및 중간 보스 기믹 배제 검증 (스피드런 쾌감 집중)
  assert.ok(!gameJsContent.includes('바위 갑옷 (피해 35% 감소)'), '오우거 바위 갑옷 감소 페널티가 제거되어 있어야 합니다.');
  assert.ok(!gameJsContent.includes('비룡 비상! (즉발 마법으로 격추 가능)'), '비룡 공중 회피 페널티가 제거되어 있어야 합니다.');
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
  assert.ok(gameJsContent.includes("circleEl.classList.toggle('hidden', !hasSmartAutoCast())"), '마법진은 자동 영창 카드를 얻은 뒤에만 보여야 합니다.');
  // 아트 정합성: 빛 번짐 합성 대신 오려 붙인 종이 문양
  const circleCss = stylesCssContent.slice(stylesCssContent.indexOf('.autocast-magic-circle {'), stylesCssContent.indexOf('/* 타오르는 기운'));
  assert.ok(!circleCss.includes('mix-blend-mode') && !circleCss.includes('radial-gradient'), '마법진은 화면 합성·방사형 발광 없이 종이 문양이어야 합니다.');
});

test('UX 피드백 4: 스킬 마우스 클릭 시 툴팁 즉시 닫힘 검증', () => {
  const tooltipsJsContent = fs.readFileSync(path.join(__dirname, '../src/scripts/skill-tooltips.js'), 'utf8');
  assert.ok(tooltipsJsContent.includes('pointerdown'), 'pointerdown 이벤트 리스너가 등록되어 있어야 합니다.');
  assert.ok(tooltipsJsContent.includes('dismissOnClick'), '클릭/다운 시 즉시 툴팁을 닫는 핸들러가 구현되어 있어야 합니다.');
  assert.ok(tooltipsJsContent.includes('button.blur()'), '클릭 후 포커스가 해제되어 툴팁이 화면에 고정되지 않아야 합니다.');
});
