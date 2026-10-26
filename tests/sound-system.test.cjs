const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const htmlSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const gameSource = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'game.js'), 'utf8');

console.log('▶ 사운드 시스템 및 전체 볼륨 UI 무결성 검증');

// 1. BGM 음원 파일 실존 확인
const expectedBgmFiles = [
  'Beneath_the_Heavy_Crown.mp3',
  'Iron_Underneath.mp3',
  'Seven_Gates_of_Copper.mp3',
  'Trial_by_the_Blade.mp3',
  'Weight_of_the_Deep.mp3'
];

expectedBgmFiles.forEach((file) => {
  const fullPath = path.join(ROOT, 'assets', 'sounds', 'bgm', file);
  assert.ok(fs.existsSync(fullPath), `BGM 파일이 존재하지 않습니다: ${file}`);
  const stats = fs.statSync(fullPath);
  assert.ok(stats.size > 100000, `BGM 파일 용량이 비정상적입니다: ${file} (${stats.size} bytes)`);
});
console.log('   ✔ 1. BGM 5종 음원 파일 디스크 존재 및 크기 검증 통과');

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

// 5. 마도서 각성 창 오픈/닫힘 시 BGM 벽 뒤 공간감(볼륨 덕킹 & 페이드) 효과 검증
assert.ok(gameSource.includes('function setBgmBehindWall'), 'setBgmBehindWall 함수가 정의되어 있어야 합니다.');
assert.ok(gameSource.includes('isBgmBehindWallActive ? 0.35 : 1.0'), '벽 뒤 효과 활성화 시 35% 볼륨 덕킹이 적용되어야 합니다.');
assert.ok(/triggerAwakeningSelection[\s\S]*?setBgmBehindWall\(true\)/.test(gameSource), '각성 창이 열릴 때 setBgmBehindWall(true)가 호출되어야 합니다.');
assert.ok(/closeAwakeningModal[\s\S]*?setBgmBehindWall\(false\)/.test(gameSource), '각성 창이 닫힐 때 setBgmBehindWall(false)가 호출되어야 합니다.');
console.log('   ✔ 5. 마도서 각성 창 BGM 벽 뒤(35% 부드러운 볼륨 덕킹 페이드) 공간감 효과 검증 통과');

// 6. 출처 문제로 제거한 예전 효과음이 다시 들어오지 않았는지 검증(새 효과음은 다른 파일명으로 추가)
const removedSfxFiles = [
  'fireball_fly.wav', 'fireball_explosion.wav', 'fireball_explosion_critical.wav', 'item_select.wav',
  'drop_coin.mp3', 'meteor_fly.mp3', 'meteor_explosion.mp3', 'swish.mp3', 'monster_destroy.mp3',
  'Summoning the Fire Spirit.mp3', 'burning.mp3', 'fireball_ready.mp3'
];
removedSfxFiles.forEach((file) => {
  assert.ok(!gameSource.includes(file), `제거한 효과음 참조가 남아 있습니다: ${file}`);
  assert.ok(!fs.existsSync(path.join(ROOT, 'assets', 'sounds', 'sfx', file)), `제거한 효과음 파일이 남아 있습니다: ${file}`);
});
assert.ok(gameSource.includes('if (!burningLoopAudio) return;') && gameSource.includes('if (!fireballCastAudio) return;'), '반복 효과음 파일이 없을 때 건너뛰어야 합니다.');
console.log('   ✔ 6. 예전 효과음 12종 제거 및 효과음 없는 상태 안전 처리 검증 통과');
