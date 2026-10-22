/* 각성 카드가 시스템 이모지가 아닌 종이 원화 아이콘으로 그려지고, 덱 툴팁이 모든 카드 스탯을 올바른 이름·단위로 보여주는지 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');

const deckSource = read('src/scripts/roguelike-deck.js');
// 엑셀에서 동기화되는 카드 JSON까지 포함해, 새 카드를 추가하면 아이콘 지정을 빠뜨리지 않게 합니다.
const jsonCards = JSON.parse(read('src/data/roguelike-cards.json'));
const cardIds = [...new Set([...deckSource.matchAll(/"id":\s*"([a-z_]+)"/g)].map((m) => m[1]).concat((jsonCards.cards || jsonCards).map((c) => c.id)))];
assert.ok(cardIds.length >= 27, '기본 카드 목록을 읽어야 합니다.');

const context = vm.createContext({ document: { getElementById: () => null, addEventListener() {} }, console });
vm.runInContext(`${read('src/scripts/comic-monster-frames.js')}${read('src/scripts/paper-monster-frames.js')}${read('src/scripts/comic-assets.js')};this.icons=PAPER_CARD_ICONS;this.html=paperCardIconHTML;`, context);

// 1. 모든 카드에 종이 아이콘이 지정되어 있고, 시트 범위(3×2) 안의 칸을 가리킵니다.
for (const id of cardIds) {
  const entry = context.icons[id];
  assert.ok(entry, `${id} 카드의 종이 아이콘이 없습니다.`);
  assert.ok(['skills', 'stats'].includes(entry[0]) && entry[1] >= 0 && entry[1] < 6, `${id} 아이콘 좌표가 시트를 벗어납니다.`);
  const html = context.html({ id, icon: '😤' });
  assert.match(html, /class="paper-card-icon"/);
  assert.ok(!html.includes('😤'), `${id} 카드가 이모지로 그려지면 안 됩니다.`);
}
assert.equal(context.html({ id: 'unknown_card', icon: '🃏' }), '🃏', '모르는 카드는 데이터의 아이콘으로 대체합니다.');

// 2. 카드 아이콘을 그리는 세 곳(각성 모달·덱 줄·덱 툴팁)이 모두 종이 아이콘을 씁니다.
const game = read('src/scripts/game.js');
assert.equal((game.match(/paperCardIconHTML\(/g) || []).length, 3);
assert.ok(!/\$\{(card|c)\.icon\}/.test(game), '카드 이모지를 그대로 출력하는 곳이 남아 있으면 안 됩니다.');

// 3. 덱 툴팁 스탯 이름이 카드가 쓰는 모든 스탯 키를 다룹니다(밸런스 패치 v2의 정수 퍼센트 스탯).
const statKeys = new Set([...deckSource.matchAll(/"stats":\s*\{([^}]*)\}/g)].flatMap((m) => [...m[1].matchAll(/"([A-Za-z]+)":/g)].map((k) => k[1])));
const labelBlock = game.slice(game.indexOf('const statLabels = {'), game.indexOf('};', game.indexOf('const statLabels = {')));
for (const key of statKeys) assert.ok(new RegExp(`\\b${key}:`).test(labelBlock), `덱 툴팁에 ${key} 스탯 이름이 없습니다.`);
assert.ok(!/isRatio/.test(game), '치명 피해를 배율로 보고 100배 하던 구형 표기가 남아 있으면 안 됩니다.');

// 4. 모든 분류가 빌드 이름표를 가집니다(각성 카드·덱 툴팁이 getBuildLabel 하나를 함께 씀).
const labelFn = game.slice(game.indexOf('function getBuildLabel('), game.indexOf('}', game.indexOf('return names[build]')));
for (const build of new Set(JSON.parse(read('src/data/roguelike-cards.json')).map((c) => c.build))) {
  assert.ok(labelFn.includes(`${build}: tr(`), `${build} 빌드 이름표가 있어야 합니다.`);
}
assert.equal((game.match(/getBuildLabel\(/g) || []).length, 3, '각성 카드와 덱 툴팁이 같은 이름표 함수를 써야 합니다(정의 1 + 사용 2).');

console.log(`각성 카드 ${cardIds.length}종 종이 아이콘 지정·이모지 제거, 덱 툴팁 스탯 ${statKeys.size}종 표기, 분류별 빌드 이름표 검증 통과`);
