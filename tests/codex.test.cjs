/* 마도서 도감: 연계 데이터(엑셀·JSON·내장 대체 데이터 일치, 양방향), 발견·획득 기록과 세이브, 카드 상태 판정,
 * 도감 버튼 노출 조건, 각성 카드의 '보유 카드와 연계' 표시, 마크업 연결을 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const { normalizeMeta, recordCardsSeen, recordCardPicked } = require('../src/scripts/meta-progression.js');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// 1. 연계 데이터: 모든 카드가 연계를 1개 이상 갖고, 대상은 실제 카드이며, 서로를 가리킵니다(양방향 저장).
const cards = JSON.parse(read('src/data/roguelike-cards.json'));
const ids = new Set(cards.map((c) => c.id));
for (const c of cards) {
  assert.ok(Array.isArray(c.links) && c.links.length > 0, `${c.id}: 연계 카드가 하나도 없습니다.`);
  for (const other of c.links) {
    assert.ok(ids.has(other), `${c.id}: 없는 카드(${other})와 연계되어 있습니다.`);
    assert.notEqual(other, c.id, `${c.id}: 자기 자신과 연계할 수 없습니다.`);
    assert.ok(cards.find((x) => x.id === other).links.includes(c.id), `${c.id} ↔ ${other}: 연계가 한쪽에만 적혀 있습니다.`);
  }
}
// 내장 대체 데이터(file:// 실행용)도 같은 연계를 갖습니다.
const deckSrc = read('src/scripts/roguelike-deck.js');
for (const c of cards) {
  const block = deckSrc.slice(deckSrc.indexOf(`"id": "${c.id}"`));
  const linksText = block.slice(block.indexOf('"links": ['), block.indexOf(']', block.indexOf('"links": [')));
  for (const other of c.links) assert.ok(linksText.includes(`"${other}"`), `내장 대체 데이터의 ${c.id} 연계에 ${other}가 없습니다(node scripts/sync-card-fallback.cjs).`);
}
// 엑셀 파이프라인: 열 정의와 양방향 변환이 있습니다.
assert.match(read('scripts/card_columns.py'), /\("연계 카드\(links\)", "links"/);
assert.match(read('scripts/sync_excel_to_cards.py'), /card\["links"\]/);
assert.match(read('scripts/export_cards_to_excel.py'), /key == 'links'/);

// 2. 발견·획득 기록: 중복 없이, 고른 카드는 발견에도 포함됩니다. 구형 세이브는 빈 목록입니다.
const meta = normalizeMeta(null);
assert.deepEqual([meta.seenCards, meta.pickedCards], [[], []]);
assert.equal(recordCardsSeen(meta, ['rapid_spark', 'crit_focus', 'rapid_spark']), 2);
assert.equal(recordCardsSeen(meta, ['rapid_spark']), 0);
assert.equal(recordCardPicked(meta, 'sum_spirit'), true);
assert.equal(recordCardPicked(meta, 'sum_spirit'), false);
assert.ok(meta.seenCards.includes('sum_spirit'), '고른 카드는 발견 목록에도 있어야 합니다.');
assert.deepEqual(normalizeMeta({ seenCards: ['a', 'a', 3, ''], pickedCards: 'x' }).seenCards, ['a']);
assert.deepEqual(normalizeMeta({ pickedCards: 'x' }).pickedCards, []);

// 3. 게임 안: 선택지에 나온 카드는 발견, 고른 카드는 획득으로 남고 세이브에 저장됩니다.
const g = createHeadlessGame({ seed: 21 });
const st = g.run('state');
st.lockedCards = [];
assert.equal(g.run('isCodexAvailable()'), false, '각성 카드를 만나기 전에는 도감 버튼이 없습니다.');
g.run("triggerAwakeningSelection(1, false, () => {})");
const offered = g.run('deckManager.getCurrentChoices().map((c) => c.id)');
assert.ok(offered.length > 0);
for (const id of offered) assert.ok(st.meta.seenCards.includes(id), `선택지에 나온 ${id}가 발견으로 남아야 합니다.`);
assert.equal(g.run('isCodexAvailable()'), true);
g.run(`selectAwakeningCard('${offered[0]}')`);
assert.ok(st.meta.pickedCards.includes(offered[0]), '고른 카드가 획득으로 남아야 합니다.');
g.run('saveGame()');
const saved = JSON.parse(g.run('saveStorage.read(SAVE_KEY)'));
assert.ok(saved.meta.pickedCards.includes(offered[0]) && saved.meta.seenCards.length >= offered.length, '도감 기록이 세이브에 저장되어야 합니다.');

// 4. 카드 상태 판정: 잠김 > 획득/보유 > 발견 > 미발견
st.lockedCards = ['burn_wildfire'];
assert.equal(g.run("getCodexCardState('burn_wildfire')"), 'locked');
assert.equal(g.run(`getCodexCardState('${offered[0]}')`), 'picked');
const unseen = cards.map((c) => c.id).find((id) => !st.meta.seenCards.includes(id) && id !== 'burn_wildfire');
assert.equal(g.run(`getCodexCardState('${unseen}')`), 'unseen');
assert.equal(g.run("codexLockText('burn_wildfire')"), g.run("tr('숙련도 {n}', { n: 10 })"));
assert.equal(g.run("codexLockText('rapid_gatling')"), g.run("tr('업화 {n}단계', { n: 3 })"));

// 5. 양방향 연계: 한쪽에만 적혀 있어도 서로 연결합니다.
g.run("RoguelikeDeck.CARD_POOL[0].links = ['util_power']; codexLinkCache = null;");
const first = g.run('RoguelikeDeck.CARD_POOL[0].id');
assert.ok(g.run(`getCardLinkIds('util_power')`).includes(first), '연계는 양방향이어야 합니다.');
g.run('codexLinkCache = null;');

// 6. 각성 카드에는 연계·주력 빌드 표시를 두지 않습니다. 덱과 맞물리는지는 플레이어가 직접 따져 봅니다(AGENTS.md 1부 4장).
//    메테오(연계 상대)와 속사 카드 2장(주력 빌드)을 가진 덱에서도 선택지 카드에 아무 표시가 붙지 않아야 합니다.
g.run("deckManager.resetDeck(state); deckManager.selectCard('spell_meteor', state); deckManager.selectCard('rapid_split', state); deckManager.selectCard('rapid_quickdraw', state);");
g.run("renderAwakeningChoicesUI(['crit_meteor_storm', 'util_power'].map((id) => RoguelikeDeck.CARD_POOL.find((c) => c.id === id)), false)");
const rendered = String(g.run("document.getElementById('awakening-cards-container').innerHTML"));
const cardsHtml = rendered.split('class="awakening-card ');
assert.ok(cardsHtml.some((h) => h.includes('data-card-id="crit_meteor_storm"')), '선택지가 그려져야 합니다.');
assert.ok(!/card-link-tag|has-link|main-build/.test(rendered), '각성 카드에 연계 아이콘·주력 빌드 띠가 붙으면 안 됩니다.');
assert.ok(!/linked-owned/.test(read('src/scripts/codex.js')), '도감도 보유 카드의 연계 상대를 저절로 깜빡이게 하지 않습니다(카드를 눌러 직접 찾아봄).');

// 7. 마크업·연결: 세 진입 버튼, 도감 창, 스크립트 순서, Esc가 도감을 먼저 닫음
const html = read('index.html');
for (const id of ['codex-backdrop', 'codex-tabs', 'codex-grid', 'codex-detail', 'btn-codex-close', 'btn-title-codex', 'btn-pause-codex', 'btn-awakening-codex']) {
  assert.ok(html.includes(`id="${id}"`), `${id} 요소가 필요합니다.`);
}
assert.ok(html.indexOf('codex.js') < html.indexOf('src/scripts/game.js'));
assert.match(read('src/scripts/pause-menu.js'), /isCodexOpen\(\)\) \{\s*closeCodex\(\);/);

console.log('   도감 연계 데이터(양방향·엑셀·대체 데이터), 발견·획득 기록과 세이브, 카드 상태, 도감 버튼 조건, 각성 카드 연계 표시 없음 검증 통과');
