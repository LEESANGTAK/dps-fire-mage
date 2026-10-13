/* 다국어: 영어 사전이 모든 원문 키를 덮고, 자리표시자가 원문과 같으며, 카드·숫자 표기가 언어를 따르는지 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const { allKeys, missingKeys } = require('../scripts/i18n-keys.cjs');
const { I18N_EN } = require('../src/scripts/i18n-en.js');

// 1. 누락·미사용 키 없음
assert.deepEqual(missingKeys(), [], '영어 사전에 없는 원문이 있습니다. node scripts/i18n-keys.cjs 로 확인하세요.');
const keys = allKeys();
assert.ok(keys.size > 150);
const unused = Object.keys(I18N_EN).filter((k) => !keys.has(k));
assert.deepEqual(unused, [], '코드에서 쓰지 않는 영어 사전 항목은 지워야 합니다(구형 문구 잔재).');

// 2. 자리표시자·HTML 태그가 원문과 같습니다(번역 중 {boss}·<b> 등이 빠지면 화면이 깨집니다).
const tokens = (s) => [...s.matchAll(/\{\w+\}|<\/?\w+[^>]*>/g)].map((m) => m[0]).sort();
for (const [ko, en] of Object.entries(I18N_EN)) {
  assert.deepEqual(tokens(en).filter((t) => t[0] === '{'), [...new Set(tokens(ko).filter((t) => t[0] === '{'))].flatMap((t) => tokens(ko).filter((x) => x === t)), `자리표시자 불일치: ${ko}`);
  assert.equal(tokens(en).filter((t) => t[0] === '<').length, tokens(ko).filter((t) => t[0] === '<').length, `태그 수 불일치: ${ko}`);
  // 언어 전환 버튼 안내만은 두 언어를 함께 보여 줍니다.
  if (ko !== '언어 변경 / Change language') assert.ok(!/[가-힣]/.test(en), `영어 번역에 한글이 남아 있습니다: ${en}`);
}

// 3. 카드: JSON·내장 fallback 모두 영문 이름·설명을 가집니다.
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/roguelike-cards.json'), 'utf8'));
for (const c of cards) {
  assert.ok(c.title_en && c.desc_en, `${c.id} 카드에 영문 표기가 없습니다.`);
  assert.equal((c.desc_en.match(/<b>/g) || []).length, (c.desc.match(/<b>/g) || []).length, `${c.id} 영문 설명의 강조 태그 수가 다릅니다.`);
}
const deckSource = fs.readFileSync(path.join(__dirname, '../src/scripts/roguelike-deck.js'), 'utf8');
assert.equal((deckSource.match(/"title_en":/g) || []).length, cards.length, '내장 fallback 카드도 JSON과 같은 영문 표기를 가져야 합니다.');

// 4. 언어 선택·번역·카드 표기·숫자 단위
function load(lang, saved) {
  const storage = saved ? { DPS_FIRE_MAGE_LANG: saved } : {};
  const ctx = vm.createContext({ navigator: { languages: [lang], language: lang }, localStorage: { getItem: (k) => storage[k] ?? null, setItem() {} } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/scripts/i18n-en.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '../src/scripts/i18n.js'), 'utf8') + ';this.I=I18N;this.tr=tr;this.cardText=cardText;', ctx);
  return ctx;
}
const ko = load('ko-KR'), en = load('en-US'), saved = load('ko-KR', 'en');
assert.equal(ko.I.lang, 'ko');
assert.equal(en.I.lang, 'en');
assert.equal(saved.I.lang, 'en', '저장한 언어 선택이 시스템 언어보다 우선합니다.');
assert.equal(ko.tr('👑 {boss} 토벌 완료!', { boss: 'X' }), '👑 X 토벌 완료!');
assert.equal(en.tr('👑 {boss} 토벌 완료!', { boss: 'X' }), '👑 You defeated X!');
assert.equal(en.tr('사전에 없는 문장'), '사전에 없는 문장', '번역이 없으면 원문으로 대체합니다.');
assert.equal(en.cardText(cards[0], 'title'), cards[0].title_en);
assert.equal(ko.cardText(cards[0], 'title'), cards[0].title);
assert.equal(en.cardText({ title: '한글만' }, 'title'), '한글만', '영문이 비어 있으면 한글로 대체합니다.');
assert.equal(ko.I.formatNumber(225000), '22.50만');
assert.equal(en.I.formatNumber(225000), '225K');
assert.equal(en.I.formatNumber(41000), '41.0K');
assert.equal(en.I.formatNumber(7500000), '7.50M');
assert.equal(en.I.formatNumber(9350), '9,350');

console.log(`영어 사전 ${keys.size}개 원문 커버·자리표시자/태그 일치, 카드 ${cards.length}종 영문 표기, 언어 선택·숫자 단위 검증 통과`);
