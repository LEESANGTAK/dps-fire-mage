/* 다국어(한국어·영어) 지원.
 * - 원문(한국어)을 그대로 키로 쓰는 방식입니다: tr('보스 격파!') → 영어 사전(I18N_EN)에 있으면 영어, 없으면 한국어.
 *   수치는 {이름} 자리표시자로 넘깁니다: tr('{n}초', { n: 3 }).
 * - 정적 HTML은 시작 시 applyStaticI18n이 텍스트 노드·title·aria-label을 원문 일치로 바꾸고,
 *   인라인 태그가 섞인 문장은 data-i18n-html 요소의 innerHTML 전체를 원문 키로 바꿉니다.
 * - 언어: 저장된 선택 → OS/브라우저 언어(ko*면 한국어, 그 외 영어). 전환 버튼은 저장 후 새로고침합니다. */
const I18N_LANG_KEY = 'DPS_FIRE_MAGE_LANG';
const I18N_LANGS = ['ko', 'en'];

const I18N = (() => {
  function detectLang() {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(I18N_LANG_KEY) : null;
      if (typeof saved === 'string' && I18N_LANGS.includes(saved)) return saved;
    } catch (e) { /* 저장소 접근 불가 → 시스템 언어 */ }
    const nav = typeof navigator !== 'undefined' ? ((navigator.languages && navigator.languages[0]) || navigator.language) : null;
    // 브라우저 언어를 알 수 없는 환경(Node 시뮬레이터·테스트)은 원문인 한국어로 둡니다.
    if (typeof nav !== 'string' || !nav) return 'ko';
    return /^ko\b/i.test(nav) ? 'ko' : 'en';
  }
  const lang = detectLang();
  const dict = () => (lang === 'en' && typeof I18N_EN !== 'undefined' ? I18N_EN : null);
  const normalize = (text) => String(text).replace(/\s+/g, ' ').trim();

  function translate(source, params) {
    const table = dict();
    let text = table && Object.prototype.hasOwnProperty.call(table, source) ? table[source] : source;
    if (params) text = text.replace(/\{(\w+)\}/g, (m, key) => (Object.prototype.hasOwnProperty.call(params, key) ? params[key] : m));
    return text;
  }

  // 정적 HTML: 원문과 정확히 일치하는 텍스트만 바꾸고 앞뒤 공백은 보존합니다.
  function applyStatic(root) {
    const table = dict();
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
    if (!table || !root) return;
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = normalize(el.innerHTML);
      if (Object.prototype.hasOwnProperty.call(table, key)) el.innerHTML = table[key];
      el.setAttribute('data-i18n-done', '');
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.parentElement || node.parentElement.closest('script,style,[data-i18n-done]')) continue;
      const key = normalize(node.nodeValue);
      if (!key || !Object.prototype.hasOwnProperty.call(table, key)) continue;
      const lead = node.nodeValue.match(/^\s*/)[0], trail = node.nodeValue.match(/\s*$/)[0];
      node.nodeValue = lead + table[key] + trail;
    }
    root.querySelectorAll('[title],[aria-label],[placeholder]').forEach((el) => {
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        const value = el.getAttribute(attr);
        if (value && Object.prototype.hasOwnProperty.call(table, normalize(value))) el.setAttribute(attr, table[normalize(value)]);
      }
    });
  }

  function setLang(next) {
    if (!I18N_LANGS.includes(next) || next === lang) return;
    try { localStorage.setItem(I18N_LANG_KEY, next); } catch (e) { /* 저장 불가 시 이번 실행만 유지되지 않음 */ }
    location.reload();
  }

  // 큰 수 표기: 한국어는 만·억 단위, 영어는 K·M·B 단위.
  function formatNumber(num) {
    if (num < 1000) return Math.round(num).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US');
    if (num < 10000) return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const step = lang === 'ko' ? 10000 : 1000;
    const units = lang === 'ko' ? ['', '만', '억', '조', '경'] : ['', 'K', 'M', 'B', 'T'];
    let unitIdx = 0, val = num;
    while (val >= step && unitIdx < units.length - 1) { val /= step; unitIdx++; }
    const digits = lang === 'ko' ? (val >= 100 ? 1 : 2) : (val >= 100 ? 0 : val >= 10 ? 1 : 2);
    return `${val.toFixed(digits)}${units[unitIdx]}`;
  }

  return { lang, t: translate, applyStatic, setLang, formatNumber, normalize };
})();
const tr = I18N.t;
// 카드 이름·설명: 영어일 때 title_en/desc_en(엑셀 '영문' 열)을 쓰고, 비어 있으면 한글로 대체합니다.
function cardText(card, field) {
  if (!card) return '';
  const en = I18N.lang === 'en' ? card[`${field}_en`] : '';
  return en || card[field] || '';
}

if (typeof document !== 'undefined' && document.body) {
  I18N.applyStatic(document.body);
}
if (typeof module !== 'undefined') module.exports = { I18N, tr, cardText };
