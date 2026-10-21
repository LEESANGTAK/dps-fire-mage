/* 모션 줄이기 설정(설정 화면 › 게임 › 모션 줄이기).
 * - 'system': OS의 동작 줄이기 설정(prefers-reduced-motion)을 따릅니다(기본값).
 * - 'reduce': OS와 무관하게 항상 줄입니다.  'full': OS가 줄이기여도 모든 연출을 보여 줍니다.
 * 게임 코드는 여러 곳에서 matchMedia('(prefers-reduced-motion: reduce)')와 CSS @media로 이 값을 읽습니다.
 * 그 호출부를 하나하나 바꾸지 않도록, 이 파일이 가장 먼저 로드되어
 *   1) matchMedia의 모션 질의에 선택값으로 답하고,
 *   2) 스타일시트의 @media (prefers-reduced-motion: …) 조건을 선택값에 맞게 켜고 끕니다. */
const MOTION_PREFS = ['system', 'reduce', 'full'];
let motionPref = 'system';

const nativeMatchMedia = typeof matchMedia === 'function' ? matchMedia.bind(typeof window !== 'undefined' ? window : globalThis) : null;
const MOTION_QUERY = /\(\s*prefers-reduced-motion\s*:\s*(reduce|no-preference)\s*\)/i;

function getMotionPref() {
  return motionPref;
}

// OS 설정을 따르지 않을 때 '(prefers-reduced-motion: reduce)'가 참인지
function forcedReduceMatches() {
  return motionPref === 'reduce';
}

function isReducedMotion() {
  if (motionPref !== 'system') return forcedReduceMatches();
  return Boolean(nativeMatchMedia && nativeMatchMedia('(prefers-reduced-motion: reduce)').matches);
}

if (nativeMatchMedia && typeof window !== 'undefined') {
  window.matchMedia = function matchMediaWithMotionPref(query) {
    const m = motionPref !== 'system' && typeof query === 'string' && query.match(MOTION_QUERY);
    if (!m) return nativeMatchMedia(query);
    const matches = m[1].toLowerCase() === 'reduce' ? forcedReduceMatches() : !forcedReduceMatches();
    return { matches, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false };
  };
}

// 스타일시트의 모션 조건을 선택값에 맞게 다시 씁니다. 원래 조건은 처음 본 순간 기억해 두었다가 'system'에서 되돌립니다.
const originalMotionMedia = new WeakMap();
function applyMotionPrefToStyles() {
  if (typeof document === 'undefined' || !document.styleSheets) return;
  const truthy = '(min-width: 0px)';
  const falsy = 'not all';
  const visit = (rules) => {
    for (const rule of rules) {
      if (rule.media && rule.cssRules) {
        if (!originalMotionMedia.has(rule)) originalMotionMedia.set(rule, rule.media.mediaText);
        const original = originalMotionMedia.get(rule);
        const m = original.match(MOTION_QUERY);
        if (m) {
          let next = original;
          if (motionPref !== 'system') {
            const on = m[1].toLowerCase() === 'reduce' ? forcedReduceMatches() : !forcedReduceMatches();
            // 단일 조건이면 통째로 켜고 끄고, 'and'로 묶인 조건이면 모션 부분만 항상 참/거짓으로 바꿉니다.
            next = original.trim().match(/^\(\s*prefers-reduced-motion[^)]*\)$/i)
              ? (on ? 'all' : falsy)
              : (on ? original.replace(MOTION_QUERY, truthy) : falsy);
          }
          if (rule.media.mediaText !== next) rule.media.mediaText = next;
        }
        visit(rule.cssRules);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try { visit(sheet.cssRules); } catch (e) { /* 읽을 수 없는 외부 스타일시트는 건너뜀 */ }
  }
}

function setMotionPref(next) {
  if (!MOTION_PREFS.includes(next)) return false;
  motionPref = next;
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.toggle('motion-reduced', isReducedMotion());
  }
  applyMotionPrefToStyles();
  return true;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', applyMotionPrefToStyles);
}
