/* 데스크톱 화면 설정(창/전체화면, 창 크기) 저장소.
 * 세이브(게임 진행)와 분리해 사용자 폴더의 window-settings.json에 둡니다. 기기마다 화면이 다르므로 Steam 클라우드로 옮기지 않습니다.
 * 창 크기는 게임 화면(창 테두리 제외) 기준입니다. */
const fs = require('node:fs');
const path = require('node:path');

const WINDOW_SIZES = [
  { width: 1280, height: 800 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 }
];
const MIN_SIZE = { width: 960, height: 600 };
const DEFAULT_PREFS = { fullscreen: false, width: 1280, height: 800 };

function sanitizePrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const num = (v, min, fallback) => (Number.isFinite(v) && v >= min && v <= 10000 ? Math.round(v) : fallback);
  return {
    fullscreen: p.fullscreen === true,
    width: num(p.width, MIN_SIZE.width, DEFAULT_PREFS.width),
    height: num(p.height, MIN_SIZE.height, DEFAULT_PREFS.height)
  };
}

// 작업 영역(작업 표시줄 제외)에 들어가지 않는 크기는 줄여서 씁니다.
function fitToWorkArea(prefs, workArea) {
  if (!workArea) return { ...prefs };
  return {
    ...prefs,
    width: Math.max(MIN_SIZE.width, Math.min(prefs.width, workArea.width)),
    height: Math.max(MIN_SIZE.height, Math.min(prefs.height, workArea.height))
  };
}

// 설정 화면에 보여 줄 크기 목록. 화면에 들어가지 않는 크기는 고를 수 없게 표시합니다.
function sizeOptions(workArea) {
  return WINDOW_SIZES.map((s) => ({ ...s, fits: !workArea || (s.width <= workArea.width && s.height <= workArea.height) }));
}

function createWindowSettings(dir) {
  const file = path.join(dir, 'window-settings.json');
  function read() {
    try { return sanitizePrefs(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch (e) { return { ...DEFAULT_PREFS }; }
  }
  function write(prefs) {
    const clean = sanitizePrefs(prefs);
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(clean));
    } catch (e) { /* 화면 설정 저장 실패는 게임 진행에 영향 없음 */ }
    return clean;
  }
  return { file, read, write };
}

module.exports = { WINDOW_SIZES, MIN_SIZE, DEFAULT_PREFS, sanitizePrefs, fitToWorkArea, sizeOptions, createWindowSettings };
