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

  await t.test('1. UI 버튼 마크업 검증 (헤더, 승리 모달)', () => {
    assert.ok(html.includes('id="btn-export-telemetry"'), '상단 헤더에 밸런스 로그 복사 버튼이 있어야 합니다.');
    assert.ok(html.includes('id="btn-victory-export-telemetry"'), '승리 모달에 밸런스 로그 복사 버튼이 있어야 합니다.');
  });

  await t.test('2. 카드 풀 구성 검증 (빌드별 등급 분포, 상위호환 중복 금지)', () => {
    assert.equal(cardsJson.length, 28, '카드 풀은 밸런스 패치 v2의 27종 + 자동 영창(전설) 28종이어야 합니다.');

    // 분류(개편안 2.1): 주문서·유틸리티는 빌드 판정 밖의 축이고, 나머지 5개가 계획하는 빌드입니다.
    const builds = new Set(cardsJson.map(c => c.build));
    assert.deepEqual([...builds].sort(), ['burn', 'combustion', 'crit', 'rapid', 'spell', 'summon', 'utility']);
    assert.ok(cardsJson.filter(c => c.spellKey).every(c => c.build === 'spell'), '주문서 카드는 모두 주문서 분류여야 합니다.');
    // 계획 빌드는 초반에 잡을 일반 카드와 빌드를 완성할 희귀/전설 카드를 함께 가집니다.
    // 예외(개편안 2.4): 폭주는 업화 2단계에 열리는 작은 빌드라 일반 카드가 없고, 치명 전설은 폭주로 옮겨 출시 후 새로 추가합니다.
    const EXCEPT = { combustion: ['common'], crit: ['legendary'] };
    for (const build of ['crit', 'combustion', 'rapid', 'summon', 'burn']) {
      const cards = cardsJson.filter(c => c.build === build);
      for (const rarity of ['common', 'rare', 'legendary']) {
        if ((EXCEPT[build] || []).includes(rarity)) continue;
        assert.ok(cards.some(c => c.rarity === rarity), `${build} 빌드에 ${rarity} 카드가 있어야 합니다.`);
      }
    }
    // 수치만 올리는 일반 카드는 3번까지 겹칩니다(겹치기로 선택지를 채우지 않도록).
    for (const c of cardsJson.filter(c => c.stats && !c.mechanic && !c.spellKey && c.rarity === 'common')) {
      assert.ok(c.maxStack <= 3, `${c.id}: 수치 카드 겹치기는 3번까지입니다.`);
    }

    // 순수 스탯 카드끼리 모든 스탯이 같거나 높은 '완전 상위호환'이 있으면 선택지가 무의미해집니다.
    const statCards = cardsJson.filter(c => c.stats && !c.mechanic && !c.spellKey);
    for (const a of statCards) {
      for (const b of statCards) {
        if (a === b) continue;
        const keys = new Set([...Object.keys(a.stats), ...Object.keys(b.stats)]);
        const dominates = [...keys].every(k => (a.stats[k] || 0) >= (b.stats[k] || 0));
        assert.ok(!dominates, `[${a.id}]가 [${b.id}]를 완전히 상위호환합니다.`);
      }
    }

    // 조건부 일시 파워업: 충전형과 대가형 카드가 모두 존재해야 합니다.
    assert.ok(cardsJson.some(c => /_charge$/.test(c.mechanic || '')), '충전형 카드가 있어야 합니다.');
    assert.ok(statCards.some(c => Object.values(c.stats).some(v => v < 0)), '이득과 손해가 함께 있는 대가형 카드가 있어야 합니다.');

    // 쓸모없던 골드 카드와 자동 시전 카드는 카드 풀에서 제외되어야 합니다.
    for (const id of ['util_gold_greed', 'common_bounty_hunter', 'spell_autocast']) {
      assert.ok(!cardsJson.some(c => c.id === id), `[${id}]는 카드 풀에서 제거되어야 합니다.`);
    }
  });

  await t.test('3. game.js 내 playtestTelemetry 객체 및 리포트 파싱 검증', () => {
    assert.ok(gameJs.includes('const playtestTelemetry = {'), 'playtestTelemetry 객체가 정의되어 있어야 합니다.');
    assert.ok(gameJs.includes('onStageStart('), 'onStageStart 메서드가 구현되어 있어야 합니다.');
    assert.ok(gameJs.includes('onStageDefeat('), 'onStageDefeat 메서드가 구현되어 있어야 합니다.');
    assert.ok(gameJs.includes('generateReport()'), 'generateReport 메서드가 구현되어 있어야 합니다.');
    assert.ok(gameJs.includes('copyToClipboard()'), 'copyToClipboard 메서드가 구현되어 있어야 합니다.');
  });
});
