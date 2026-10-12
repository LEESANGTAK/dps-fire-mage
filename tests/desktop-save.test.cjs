/* 데스크톱 파일 세이브(원자적 쓰기·백업 복구·키 검증)와 웹/데스크톱 세이브 추상화를 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), vm = require('node:vm');
const { createSaveStore } = require('../electron/save-store.cjs');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dps-save-'));
try {
  const store = createSaveStore(path.join(dir, 'saves'));
  const file = path.join(dir, 'saves', 'SLOT.json');

  // 1. 첫 실행: 세이브 없음
  assert.equal(store.read('SLOT'), null);

  // 2. 쓰기는 모아 두었다가 flush 시 디스크에 기록되며, 그 전에도 최신 값을 읽을 수 있습니다.
  store.write('SLOT', JSON.stringify({ gold: 1 }));
  store.write('SLOT', JSON.stringify({ gold: 2 }));
  assert.equal(JSON.parse(store.read('SLOT')).gold, 2, '아직 쓰지 않은 최신 값을 돌려줘야 합니다.');
  store.flushSync();
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).gold, 2);
  assert.ok(!fs.existsSync(`${file}.tmp`), '임시 파일이 남으면 안 됩니다.');

  // 3. 다음 쓰기 때 직전 정상 세이브가 백업으로 남습니다.
  store.write('SLOT', JSON.stringify({ gold: 3 }));
  store.flushSync();
  assert.equal(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')).gold, 2);

  // 4. 본 파일이 깨지면(쓰기 도중 전원 차단 등) 백업에서 복구합니다.
  fs.writeFileSync(file, '{"gold": 3, "trunc');
  assert.equal(JSON.parse(store.read('SLOT')).gold, 2, '깨진 세이브 대신 백업을 읽어야 합니다.');
  // 깨진 본 파일은 백업으로 덮어쓰지 않습니다(정상 백업 보존).
  store.write('SLOT', JSON.stringify({ gold: 4 }));
  store.flushSync();
  assert.equal(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')).gold, 2);
  assert.equal(JSON.parse(store.read('SLOT')).gold, 4);

  // 5. 잘못된 값·경로 탈출 키는 거부합니다.
  assert.throws(() => store.write('SLOT', 'not json'));
  assert.throws(() => store.write('../evil', '{}'));
  assert.throws(() => store.read('a/b'));

  // 6. 초기화: 본 파일·백업·대기 중 쓰기를 모두 지웁니다.
  store.write('SLOT', JSON.stringify({ gold: 5 }));
  store.remove('SLOT');
  store.flushSync();
  assert.equal(store.read('SLOT'), null, '초기화 후에는 백업으로도 되살아나면 안 됩니다.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// 7. 렌더러 추상화: 웹은 localStorage, 데스크톱은 파일 API를 쓰고 기존 localStorage 세이브를 옮깁니다.
const source = fs.readFileSync(path.join(__dirname, '../src/scripts/save-storage.js'), 'utf8');
function makeLocal(initial) {
  const data = Object.assign({}, initial);
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: k => { delete data[k]; } };
}
{
  const localStorage = makeLocal();
  const ctx = vm.createContext({ window: {}, localStorage });
  vm.runInContext(`${source};this.s=saveStorage;`, ctx);
  assert.equal(ctx.s.isDesktop, false);
  ctx.s.write('K', '{"a":1}');
  assert.equal(ctx.s.read('K'), '{"a":1}');
  ctx.s.remove('K');
  assert.equal(ctx.s.read('K'), null);
}
{
  const files = {};
  const desktopSave = { read: k => files[k] ?? null, write: (k, v) => { files[k] = v; }, remove: k => { delete files[k]; } };
  const localStorage = makeLocal({ K: '{"legacy":true}' });
  const ctx = vm.createContext({ window: { desktopSave }, localStorage });
  vm.runInContext(`${source};this.s=saveStorage;`, ctx);
  assert.equal(ctx.s.isDesktop, true);
  assert.equal(ctx.s.read('K'), '{"legacy":true}', '데스크톱 첫 실행은 기존 브라우저 세이브를 이어받습니다.');
  assert.equal(files.K, '{"legacy":true}', '이어받은 세이브는 파일로 옮겨집니다.');
  assert.equal(localStorage.getItem('K'), null, '옮긴 뒤 브라우저 세이브는 지워 중복 복원을 막습니다.');
  ctx.s.write('K', '{"b":2}');
  assert.equal(files.K, '{"b":2}');
  ctx.s.remove('K');
  assert.equal(ctx.s.read('K'), null);
}

// 8. 게임은 localStorage를 직접 쓰지 않고 saveStorage만 거치며, 스크립트 순서상 game.js보다 먼저 로드됩니다.
const game = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(!/localStorage\./.test(game), 'game.js는 saveStorage를 거쳐 저장해야 합니다.');
assert.ok(html.indexOf('save-storage.js') > 0 && html.indexOf('save-storage.js') < html.indexOf('src/scripts/game.js'));

// 9. 데스크톱 보안 기본값: 렌더러에 Node를 열지 않습니다.
const main = fs.readFileSync(path.join(__dirname, '../electron/main.cjs'), 'utf8');
for (const flag of ['contextIsolation: true', 'nodeIntegration: false', 'sandbox: true']) assert.ok(main.includes(flag), `${flag}가 필요합니다.`);

console.log('데스크톱 파일 세이브 원자적 쓰기·백업 복구·키 검증, 웹/데스크톱 저장소 전환·이관, 보안 기본값 검증 통과');
