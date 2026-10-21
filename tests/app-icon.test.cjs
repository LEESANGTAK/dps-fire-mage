/* 실행 파일 아이콘(build/icon.ico)의 크기 구성과 electron-builder·개발 창 연결을 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.join(__dirname, '..');

// ICO 헤더: 예약 0, 형식 1(아이콘), 항목 수 → 항목마다 너비·높이 1바이트(0은 256px)
const ico = fs.readFileSync(path.join(root, 'build', 'icon.ico'));
assert.equal(ico.readUInt16LE(0), 0);
assert.equal(ico.readUInt16LE(2), 1, 'ICO 형식이어야 합니다.');
const sizes = [];
for (let i = 0; i < ico.readUInt16LE(4); i++) {
  const w = ico[6 + i * 16] || 256, h = ico[7 + i * 16] || 256;
  assert.equal(w, h, '정사각형 아이콘이어야 합니다.');
  sizes.push(w);
}
for (const need of [16, 24, 32, 48, 256]) {
  assert.ok(sizes.includes(need), `Windows 최소 아이콘 크기 ${need}px가 빠졌습니다 (현재 ${sizes.join(', ')}).`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.build.win.icon, 'build/icon.ico', 'electron-builder가 실행 파일에 아이콘을 넣어야 합니다.');
assert.ok(fs.existsSync(path.join(root, 'build', 'icon.png')), '개발 실행 창 아이콘(build/icon.png)이 필요합니다.');
assert.match(fs.readFileSync(path.join(root, 'electron', 'main.cjs'), 'utf8'), /icon:\s*app\.isPackaged \? undefined : path\.join\(__dirname, '\.\.', 'build', 'icon\.png'\)/);

console.log(`   실행 파일 아이콘 ${sizes.join('·')}px 구성과 빌드·개발 창 연결 검증 통과`);
