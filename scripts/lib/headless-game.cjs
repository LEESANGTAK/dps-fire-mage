/**
 * scripts/lib/headless-game.cjs
 *
 * 브라우저 없이 실제 게임 스크립트(index.html과 같은 순서)를 Node vm에서 실행하는 헤드리스 실행기.
 * - DOM·캔버스·오디오는 아무 동작도 하지 않는 스텁으로 대체하고, 전투 판정 코드는 수정 없이 그대로 사용합니다.
 * - performance.now / setTimeout / requestAnimationFrame을 가상 시계로 교체해 수십 분짜리 런을 수 초 만에 재현합니다.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT_ORDER = [
  'meteor-art', 'combat-art', 'paper-art', 'mage-motion', 'comic-monster-frames', 'paper-monster-frames',
  'comic-assets', 'monster-motion', 'skill-tooltips', 'arena-environment', 'roguelike-deck', 'game'
];

// 어떤 속성 접근·호출·연산에도 조용히 응답하는 범용 스텁
function createStub(store = {}) {
  const fn = function stub() { return createStub(); };
  return new Proxy(fn, {
    get(target, key) {
      if (key === Symbol.toPrimitive) return () => 0;
      if (key === 'then') return undefined; // Promise로 오인되지 않도록
      if (key in store) return store[key];
      if (key === 'classList') return (store.classList = { add() {}, remove() {}, toggle() {}, contains: () => false });
      if (key === 'style') return (store.style = { setProperty() {}, removeProperty() {}, getPropertyValue: () => '' });
      if (key === 'dataset') return (store.dataset = {});
      if (key === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 600, bottom: 540, width: 600, height: 540, x: 0, y: 0 });
      if (key === 'querySelectorAll') return () => [];
      if (key === 'children' || key === 'childNodes') return [];
      if (/^(client|offset|scroll)(Width|Height|Left|Top)$/.test(String(key))) return 500;
      if (key === 'width' || key === 'height') return 500;
      return createStub();
    },
    set(target, key, value) { store[key] = value; return true; },
    apply() { return createStub(); },
    construct() { return createStub(); }
  });
}

function createHeadlessGame({ seed } = {}) {
  let now = 1000;
  let timerId = 0;
  const timers = [];
  const elements = new Map();

  // 재현 가능한 난수 (seed 지정 시)
  let rand = Math.random;
  if (typeof seed === 'number') {
    let s = seed >>> 0 || 1;
    rand = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const SimMath = Object.create(Math);
  SimMath.random = rand;

  const storage = {};
  const documentStub = createStub({
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createStub({ id }));
      return elements.get(id);
    },
    querySelector() { return createStub(); },
    querySelectorAll() { return []; },
    createElement() { return createStub(); },
    addEventListener() {},
    dispatchEvent() {},
    hidden: false
  });

  const context = {
    console,
    Math: SimMath,
    JSON, Number, String, Boolean, Object, Array, Date, Map, Set, RegExp, Error, Promise, Symbol, Infinity, NaN,
    parseInt, parseFloat, isNaN, isFinite,
    require,
    __dirname: path.join(ROOT, 'src', 'scripts'),
    document: documentStub,
    localStorage: { getItem: (k) => storage[k] ?? null, setItem: (k, v) => { storage[k] = String(v); }, removeItem: (k) => { delete storage[k]; } },
    performance: { now: () => now },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: (fn, ms = 0) => { timers.push({ id: ++timerId, at: now + Math.max(0, ms), fn }); return timerId; },
    clearTimeout: (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: () => 0,
    clearInterval: () => {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    Audio: function Audio() { return createStub({ play: () => ({ catch() {} }), pause() {}, paused: true }); },
    Image: function Image() { return createStub({ complete: false }); },
    CustomEvent: function CustomEvent() {},
    KeyboardEvent: function KeyboardEvent() {},
    confirm: () => false,
    navigator: {},
    location: { reload() {} },
    innerWidth: 1280,
    innerHeight: 800
  };
  context.window = context;
  context.addEventListener = () => {};
  context.dispatchEvent = () => {};
  vm.createContext(context);

  for (const name of SCRIPT_ORDER) {
    const code = fs.readFileSync(path.join(ROOT, 'src', 'scripts', `${name}.js`), 'utf8');
    vm.runInContext(code, context, { filename: `${name}.js` });
  }

  const run = (code) => vm.runInContext(code, context);

  function fireDueTimers() {
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    while (timers.length && timers[0].at <= now) {
      const t = timers.shift();
      t.fn();
    }
  }

  /** dtSec만큼 가상 시간을 진행하며 실제 gameLoop를 프레임 단위로 실행 */
  function step(dtSec = 1 / 30) {
    now += dtSec * 1000;
    fireDueTimers();
    run(`gameLoop(${now})`);
  }

  // DOMContentLoaded 초기화와 같은 순서로 게임을 시작
  run('loadGame(); checkAndTriggerUnfolds(true); updateSkillActionBarVisibility(); loadStage(state.currentStage); lastTime = performance.now();');

  return { context, run, step, get now() { return now; }, timers };
}

module.exports = { createHeadlessGame };
