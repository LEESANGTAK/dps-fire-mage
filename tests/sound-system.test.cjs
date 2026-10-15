const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gameSource = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'game.js'), 'utf8');

console.log('▶ 사운드 시스템 및 전체 볼륨 UI 무결성 검증');

// 1. BGM 음원 파일 실존 확인
const expectedBgmFiles = [
  'Beneath_the_Stone_Gates.mp3',
  'Seven_Gates_of_Copper.mp3',
  'Trial_by_the_Blade.mp3'
];

expectedBgmFiles.forEach((file) => {
  const fullPath = path.join(ROOT, 'assets', 'sounds', 'bgm', file);
  assert.ok(fs.existsSync(fullPath), `BGM 파일이 존재하지 않습니다: ${file}`);
  const stats = fs.statSync(fullPath);
  assert.ok(stats.size > 100000, `BGM 파일 용량이 비정상적입니다: ${file} (${stats.size} bytes)`);
});
console.log('   ✔ 1. BGM 3종 음원 파일 디스크 존재 및 크기 검증 통과');

// 2. index.html 내 전체 볼륨 슬라이더 및 기본 볼륨 검증
assert.ok(htmlSource.includes('id="slider-master-vol"'), '전체 볼륨 슬라이더 (slider-master-vol) 마크업이 누락되었습니다.');
assert.ok(htmlSource.includes('id="ui-master-vol-val"'), '전체 볼륨 텍스트 (ui-master-vol-val) 마크업이 누락되었습니다.');
assert.ok(htmlSource.includes('id="slider-bgm-vol" min="0" max="100" step="1" value="20"'), 'BGM 슬라이더 기본값이 20%로 설정되지 않았습니다.');
assert.ok(htmlSource.includes('id="slider-sfx-vol" min="0" max="100" step="1" value="10"'), 'SFX 슬라이더 기본값이 10%로 설정되지 않았습니다.');
console.log('   ✔ 2. index.html 전체 볼륨 슬라이더 및 기본 볼륨(20%/10%) 마크업 검증 통과');

// 3. game.js 내 기본 볼륨 및 BGM_TRACKS 정의 검증
assert.ok(/masterVolume:\s*1\.0/.test(gameSource), 'game.js state에 masterVolume 기본값(1.0)이 누락되었습니다.');
assert.ok(/bgmVolume:\s*0\.2/.test(gameSource), 'game.js state에 bgmVolume 기본값(0.2)이 반영되지 않았습니다.');
assert.ok(/sfxVolume:\s*0\.1/.test(gameSource), 'game.js state에 sfxVolume 기본값(0.1)이 반영되지 않았습니다.');

expectedBgmFiles.forEach((file) => {
  assert.ok(gameSource.includes(file), `game.js BGM_TRACKS에 파일이 누락되었습니다: ${file}`);
});
console.log('   ✔ 3. game.js state 기본 볼륨 및 BGM_TRACKS 등록 검증 통과');

// 4. saveGame 및 loadGame에 masterVolume 연동 검증
assert.ok(gameSource.includes('masterVolume: state.masterVolume'), 'saveGame에 masterVolume 직렬화가 누락되었습니다.');
assert.ok(gameSource.includes('state.masterVolume = Math.max(0, Math.min(1, data.masterVolume))'), 'loadGame에 masterVolume 복원이 누락되었습니다.');
console.log('   ✔ 4. 세이브/로드 masterVolume 영속성 검증 통과');

// 5. 마도서 각성 창 오픈/닫힘 시 BGM 벽 뒤(Muffled Low-Pass) 효과 검증
assert.ok(gameSource.includes('function setBgmBehindWall'), 'setBgmBehindWall 함수가 정의되어 있어야 합니다.');
assert.ok(gameSource.includes('targetFreq = enable ? 380 : 22050'), '벽 뒤 효과 활성화 시 380Hz 로우패스 컷오프 주파수가 적용되어야 합니다.');
assert.ok(/triggerAwakeningSelection[\s\S]*?setBgmBehindWall\(true\)/.test(gameSource), '각성 창이 열릴 때 setBgmBehindWall(true)가 호출되어야 합니다.');
assert.ok(/closeAwakeningModal[\s\S]*?setBgmBehindWall\(false\)/.test(gameSource), '각성 창이 닫힐 때 setBgmBehindWall(false)가 호출되어야 합니다.');
console.log('   ✔ 5. 마도서 각성 창 BGM 벽 뒤(380Hz 로우패스 필터 & 볼륨 덕킹) 공간감 효과 검증 통과');
