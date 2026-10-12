/* 데스크톱(Electron) 파일 세이브 저장소. Electron에 의존하지 않는 순수 Node 모듈이라 단위 테스트가 가능합니다.
 * - 원자적 쓰기: 임시 파일에 쓴 뒤 rename으로 교체해, 쓰는 도중 꺼져도 세이브가 반쯤 잘리지 않습니다.
 * - 백업: 교체 직전의 정상 세이브를 .bak으로 보존하고, 본 파일이 깨졌으면 백업에서 복구합니다.
 * - 직렬화: 같은 키의 쓰기는 마지막 값만 남겨 순서대로 처리하고, 종료 시 flushSync로 남은 쓰기를 마칩니다. */
const fs = require('node:fs');
const path = require('node:path');

const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isValidJson(text) {
  if (typeof text !== 'string' || !text) return false;
  try { JSON.parse(text); return true; } catch (e) { return false; }
}

function createSaveStore(dir) {
  const pending = new Map(); // key -> 아직 디스크에 쓰지 않은 최신 값
  let timer = null;

  function fileFor(key) {
    if (!KEY_PATTERN.test(String(key))) throw new Error(`허용되지 않는 세이브 키: ${key}`);
    return path.join(dir, `${key}.json`);
  }

  function writeNow(key, value) {
    const file = fileFor(key);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, value, 'utf8');
    // 지금 본 파일이 정상이면 백업으로 남겨, 새 값에 문제가 있어도 직전 진행도로 돌아갈 수 있게 합니다.
    if (fs.existsSync(file) && isValidJson(fs.readFileSync(file, 'utf8'))) fs.copyFileSync(file, `${file}.bak`);
    fs.renameSync(tmp, file);
  }

  function flushSync() {
    if (timer) { clearTimeout(timer); timer = null; }
    for (const [key, value] of pending) {
      pending.delete(key);
      try { writeNow(key, value); } catch (e) { console.error('[save-store] 쓰기 실패', key, e); }
    }
  }

  return {
    dir,
    read(key) {
      if (pending.has(key)) return pending.get(key);
      const file = fileFor(key);
      for (const candidate of [file, `${file}.bak`]) {
        try {
          const text = fs.readFileSync(candidate, 'utf8');
          if (isValidJson(text)) return text;
        } catch (e) { /* 파일 없음 → 다음 후보 */ }
      }
      return null;
    },
    // 게임은 사건마다 자주 저장하므로 짧게 모아 한 번에 씁니다. 값은 JSON 문자열만 받습니다.
    write(key, value) {
      fileFor(key);
      if (!isValidJson(value)) throw new Error('세이브 값은 올바른 JSON 문자열이어야 합니다.');
      pending.set(key, value);
      if (!timer) timer = setTimeout(flushSync, 250);
    },
    remove(key) {
      const file = fileFor(key);
      pending.delete(key);
      for (const candidate of [file, `${file}.bak`, `${file}.tmp`]) {
        try { fs.unlinkSync(candidate); } catch (e) { /* 이미 없음 */ }
      }
    },
    flushSync
  };
}

module.exports = { createSaveStore, isValidJson };
