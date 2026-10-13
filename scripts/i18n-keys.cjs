/**
 * scripts/i18n-keys.cjs
 * 번역이 필요한 한국어 원문 키를 모두 모읍니다(영어 사전 누락 검사·번역 작업용).
 * - JS: tr('…') / t('…') 첫 인자 문자열(자리표시자 포함 원문)
 * - HTML: 텍스트 노드, title·aria-label·placeholder, data-i18n-html 요소의 innerHTML 전체
 * 사용법: node scripts/i18n-keys.cjs            → 영어 사전에 없는 키 목록 출력
 *         node scripts/i18n-keys.cjs --all      → 전체 키 목록 출력
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const KO = /[가-힣]/;
const normalize = (text) => String(text).replace(/\s+/g, ' ').trim();

function jsKeys() {
  const dir = path.join(ROOT, 'src', 'scripts');
  const keys = new Set();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && !f.startsWith('i18n'))) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of source.matchAll(/\b(?:tr|t)\(\s*(['`])((?:\\.|(?!\1).)*?)\1/g)) {
      if (KO.test(m[2])) keys.add(m[2].replace(/\\'/g, "'"));
    }
    // 표 데이터의 화면 문구(meta-progression.js 업화 규칙 text)는 tr(rule.text)로 번역됩니다.
    if (file === 'meta-progression.js') for (const m of source.matchAll(/\btext:\s*'([^']*)'/g)) keys.add(m[1]);
  }
  return keys;
}

function htmlKeys() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
  const keys = new Set();
  // data-i18n-html 요소는 innerHTML 전체가 하나의 키입니다. 같은 태그가 안에 중첩될 수 있어 깊이를 세어 닫는 태그를 찾습니다.
  let open;
  const opener = /<(\w+)([^>]*\sdata-i18n-html[^>]*)>/g;
  while ((open = opener.exec(html))) {
    const tag = open[1], from = open.index + open[0].length;
    const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'g');
    tagRe.lastIndex = from;
    let depth = 1, m;
    while (depth && (m = tagRe.exec(html))) depth += m[1] ? -1 : 1;
    const inner = html.slice(from, m.index);
    if (KO.test(inner)) keys.add(normalize(inner));
    html = html.slice(0, from) + html.slice(m.index);
    opener.lastIndex = from;
  }
  for (const m of html.matchAll(/\s(?:title|aria-label|placeholder)="([^"]*)"/g)) if (KO.test(m[1])) keys.add(normalize(m[1]));
  for (const m of html.matchAll(/>([^<]+)</g)) if (KO.test(m[1])) keys.add(normalize(m[1]));
  return keys;
}

function allKeys() {
  return new Set([...jsKeys(), ...htmlKeys()]);
}

function missingKeys() {
  const { I18N_EN } = require(path.join(ROOT, 'src', 'scripts', 'i18n-en.js'));
  return [...allKeys()].filter((k) => !Object.prototype.hasOwnProperty.call(I18N_EN, k));
}

if (require.main === module) {
  const list = process.argv.includes('--all') ? [...allKeys()] : missingKeys();
  for (const key of list) console.log(JSON.stringify(key));
  console.error(`${list.length}개`);
}
module.exports = { jsKeys, htmlKeys, allKeys, missingKeys, normalize };
