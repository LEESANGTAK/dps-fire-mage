/* 효과음 연결 검증: 코드가 부르는 효과음 이름이 모두 실제로 재생되는지(등록 안 된 이름은 소리 없이 지나감),
 * 종이 재질 UI 소리의 연타 방지, 광폭화 마지막 10초 째깍을 확인합니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const game = read('src/scripts/game.js');

// 1. 모든 playSound('이름') 호출이 playSound가 처리하는 이름이어야 합니다.
const scripts = fs.readdirSync(path.join(__dirname, '../src/scripts')).filter((f) => f.endsWith('.js'));
const called = new Set();
for (const f of scripts) {
  for (const m of read(`src/scripts/${f}`).matchAll(/playSound\('([a-z_]+)'/g)) called.add(m[1]);
}
const body = game.slice(game.indexOf('function playSound('), game.indexOf('function updateSoundUI('));
const handled = new Set([...body.matchAll(/type === '([a-z_]+)'/g)].map((m) => m[1]));
const uiBlock = game.slice(game.indexOf('const UI_SFX = {'), game.indexOf('const uiSfxLastAt'));
for (const m of uiBlock.matchAll(/^\s{2}([a-z_]+): \{/gm)) handled.add(m[1]);
const unknown = [...called].filter((t) => !handled.has(t));
assert.deepEqual(unknown, [], `처리하지 않는 효과음 이름을 부르면 소리가 나지 않습니다: ${unknown.join(', ')}`);

// 2. UI 소리 파일이 모두 있어야 합니다.
for (const m of game.matchAll(/'(assets\/sounds\/sfx\/(?:card_|buy_|enrage_|run_)[a-z_0-9]+\.wav)'/g)) {
  assert.ok(fs.existsSync(path.join(__dirname, '..', m[1])), `${m[1]} 파일이 없습니다.`);
}

// 3. 연타 방지: 호버음은 최소 간격 안에서 두 번 나지 않습니다.
const g = createHeadlessGame({ seed: 2 });
const st = g.run('state');
st.soundOn = true;
st.sfxVolume = 0.5;
g.run('window.__played = []; const __orig = playFireballSfx; playFireballSfx = (k, v, p) => { window.__played.push([k, p]); return null; };');
g.run("uiSfxLastAt.card_hover = -Infinity; playSound('card_hover'); playSound('card_hover');");
assert.equal(g.run("window.__played.filter((x) => x[0] === 'card_hover').length"), 1, '최소 간격 안의 두 번째 호버음은 내지 않습니다.');
const p = g.run("window.__played.find((x) => x[0] === 'card_hover')[1]");
assert.ok(p >= 0.95 && p <= 1.05, '호버음 음높이 흔들림은 ±5% 안이어야 합니다.');

// 4. 광폭화 째깍: 10초부터 숫자가 바뀔 때마다 한 번, 10초 넘게 남았거나 보상 연출 중에는 없음.
g.run('window.__played = []; lastEnrageTickSec = null;');
const c = st.combat;
c.timeBonusDraining = false;
for (const rem of [12.0, 10.4, 10.0, 9.95, 9.4, 3.0]) {
  c.bossEnrageRem = rem;
  g.run('uiSfxLastAt.enrage_tick = -Infinity; tickEnrageWarning(state.combat);'); // 실제로는 1초 간격이라 최소 간격에 걸리지 않음
}
const ticks = g.run("window.__played.filter((x) => x[0] === 'enrage_tick')");
// 표시 숫자(올림): 12 · 11 · 10 · 10 · 10 · 3 → 10과 3에서 한 번씩
assert.equal(ticks.length, 2, '표시 숫자가 10초 이하로 바뀔 때마다 한 번씩만 울려야 합니다.');
assert.equal(ticks[0][1], 1.0);
assert.ok(ticks[1][1] > 1.1, '마지막 3초는 음높이를 올립니다.');
g.run('window.__played = []; lastEnrageTickSec = null; state.combat.timeBonusDraining = true; state.combat.bossEnrageRem = 5; tickEnrageWarning(state.combat); state.combat.timeBonusDraining = false;');
assert.equal(g.run("window.__played.length"), 0, '남은 시간 보상 연출 중에는 째깍을 내지 않습니다.');

console.log('   UI 효과음 이름 연결·파일 존재·호버 연타 방지·광폭화 째깍 검증 통과');
