/* 실행 파일 아이콘(build/icon.ico)의 크기 구성과 electron-builder·개발 창 연결, Steamworks 업로드용 아이콘 규격을 검증합니다. */
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

// Steamworks › 커뮤니티 및 클라이언트 아이콘: 앱 아이콘 184×184 JPG, 바로 가기 아이콘 256×256 PNG/ICO
const icons = path.join(root, 'docs', 'steam-store', 'icons');
const jpg = fs.readFileSync(path.join(icons, 'app_icon_184x184.jpg'));
assert.equal(jpg.readUInt16BE(0), 0xffd8, '앱 아이콘은 JPG여야 합니다.');
let jpgSize = null;
for (let i = 2; i < jpg.length && !jpgSize;) {
  const marker = jpg.readUInt16BE(i), len = jpg.readUInt16BE(i + 2);
  if (marker >= 0xffc0 && marker <= 0xffc3) jpgSize = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)];
  i += 2 + len;
}
assert.deepEqual(jpgSize, [184, 184], '앱 아이콘은 184×184여야 합니다.');
const png = fs.readFileSync(path.join(icons, 'shortcut_icon_256x256.png'));
assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [256, 256], '바로 가기 아이콘은 256×256이어야 합니다.');
assert.ok(fs.readFileSync(path.join(icons, 'shortcut_icon.ico')).equals(ico), '바로 가기 ico는 실행 파일 아이콘과 같아야 합니다.');

console.log(`   실행 파일 아이콘 ${sizes.join('·')}px 구성과 빌드·개발 창 연결, Steamworks 앱(184 JPG)·바로 가기(256) 아이콘 규격 검증 통과`);
