const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Telemetry & Card Pool 무결성 검증', async (t) => {
  const htmlPath = path.join(__dirname, '../index.html');
  const gameJsPath = path.join(__dirname, '../src/scripts/game.js');
  const cardsJsonPath = path.join(__dirname, '../src/data/roguelike-cards.json');

  const html = fs.readFileSync(htmlPath, 'utf8');
  const gameJs = fs.readFileSync(gameJsPath, 'utf8');
  const cardsJson = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));

  await t.test('1. UI 버튼 마크업 검증 (헤더, 상세 딜로그, 승리 모달)', () => {
    assert.ok(html.includes('id="btn-export-telemetry"'), '상단 헤더에 밸런스 로그 복사 버튼이 있어야 합니다.');
    assert.ok(html.includes('id="btn-details-export-telemetry"'), '상세 전투 분석 모달에 밸런스 로그 복사 버튼이 있어야 합니다.');
    assert.ok(html.includes('id="btn-victory-export-telemetry"'), '승리 모달에 밸런스 로그 복사 버튼이 있어야 합니다.');
  });

  await t.test('2. 카드 풀 확장 데이터 규격 검증 (총 29종, 일반 카드 풀 풍부화)', () => {
    assert.equal(cardsJson.length, 29, '확장된 카드 풀은 총 29종이어야 합니다.');
    
    const commonCards = cardsJson.filter(c => c.rarity === 'common');
    const rareCards = cardsJson.filter(c => c.rarity === 'rare');
    const legendCards = cardsJson.filter(c => c.rarity === 'legendary');

    assert.ok(commonCards.length >= 15, `일반 카드는 최소 15종 이상이어야 합니다. (현재: ${commonCards.length}종)`);
    assert.ok(rareCards.length >= 8, `희귀 카드는 최소 8종 이상이어야 합니다. (현재: ${rareCards.length}종)`);
    assert.ok(legendCards.length >= 5, `전설 카드는 최소 5종 이상이어야 합니다. (현재: ${legendCards.length}종)`);

    // 신규 추가된 일반 카드들 확인
    const expectedNewIds = [
      'common_ember_spark',
      'common_pyro_flow',
      'common_quick_cast',
      'common_keen_eye',
      'common_blazing_heat',
      'common_flame_affinity',
      'common_spirit_vitality',
      'common_iron_will',
      'common_bounty_hunter',
      'common_cinder_spark'
    ];

    expectedNewIds.forEach(id => {
      assert.ok(cardsJson.some(c => c.id === id), `신규 일반 카드 [${id}]가 등록되어 있어야 합니다.`);
    });
  });

  await t.test('3. game.js 내 playtestTelemetry 객체 및 리포트 파싱 검증', () => {
    assert.ok(gameJs.includes('const playtestTelemetry = {'), 'playtestTelemetry 객체가 정의되어 있어야 합니다.');
    assert.ok(gameJs.includes('onStageStart('), 'onStageStart 메서드가 구현되어 있어야 합니다.');
    assert.ok(gameJs.includes('onStageDefeat('), 'onStageDefeat 메서드가 구현되어 있어야 합니다.');
    assert.ok(gameJs.includes('generateReport()'), 'generateReport 메서드가 구현되어 있어야 합니다.');
    assert.ok(gameJs.includes('copyToClipboard()'), 'copyToClipboard 메서드가 구현되어 있어야 합니다.');
  });
});
