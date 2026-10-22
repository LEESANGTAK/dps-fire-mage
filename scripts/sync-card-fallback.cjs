/**
 * scripts/sync-card-fallback.cjs
 *
 * src/data/roguelike-cards.json을 roguelike-deck.js의 내장 fallback(DEFAULT_CARDS_RAW)에 그대로 복사합니다.
 * (file://로 index.html을 직접 열면 JSON fetch가 막혀 fallback 카드가 사용되므로 두 데이터가 항상 같아야 합니다.)
 *
 * 사용법: node scripts/sync-card-fallback.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const jsonPath = path.join(root, 'src', 'data', 'roguelike-cards.json');
const deckPath = path.join(root, 'src', 'scripts', 'roguelike-deck.js');

const cards = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const rawSource = fs.readFileSync(deckPath, 'utf8');
// 줄바꿈(CRLF/LF)과 상관없이 블록을 찾고, 저장할 때는 원래 줄바꿈으로 되돌립니다.
const crlf = rawSource.includes('\r\n');
const source = rawSource.replace(/\r\n/g, '\n');
const startToken = '  const DEFAULT_CARDS_RAW = ';
const start = source.indexOf(startToken);
const end = source.indexOf('\n  ];\n', start);
if (start < 0 || end < 0) {
  console.error('DEFAULT_CARDS_RAW 블록을 찾지 못했습니다.');
  process.exit(1);
}
const literal = JSON.stringify(cards, null, 2).split('\n').map((line, i) => (i ? `  ${line}` : line)).join('\n');
const next = source.slice(0, start) + startToken + literal + ';\n' + source.slice(end + '\n  ];\n'.length);
fs.writeFileSync(deckPath, crlf ? next.replace(/\n/g, '\r\n') : next);
console.log(`내장 fallback 카드 ${cards.length}종을 roguelike-cards.json과 동기화했습니다.`);
