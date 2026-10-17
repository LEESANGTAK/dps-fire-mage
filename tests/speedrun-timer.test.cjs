/* 스피드런 시간: ms까지(MM:SS.mmm) 버림으로 표시되고, 전투 중에는 매 프레임 HUD 타이머가 갱신되는지 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const g = createHeadlessGame({ seed: 3 });
assert.equal(g.run('formatSpeedrunTime(0)'), '00:00.000');
assert.equal(g.run('formatSpeedrunTime(754.3219)'), '12:34.321');
assert.equal(g.run('formatSpeedrunTime(59.9996)'), '00:59.999', '반올림하면 기록이 실제보다 늦어 보이므로 버림합니다.');
assert.equal(g.run('formatSpeedrunTime(0.1 + 0.2)'), '00:00.300', '부동소수 오차로 1ms가 깎이면 안 됩니다.');
assert.equal(g.run('formatSpeedrunTime(-5)'), '00:00.000');

const game = fs.readFileSync(path.join(__dirname, '../src/scripts/game.js'), 'utf8');
const loop = game.slice(game.indexOf('function gameLoop('), game.indexOf('function gameLoop(') + 2000);
assert.ok(/state\.playTimeSec = [^\n]+\n[^\n]+\n\s*renderSpeedrunTimer\(state\.playTimeSec\);/.test(loop), '시간이 흐르는 프레임마다 HUD 타이머를 갱신해야 ms가 흘러갑니다.');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(html.includes('<span class="speedrun-ms">.000</span>'), 'HUD 초기 표시도 ms 자리를 가집니다.');

console.log('스피드런 시간 ms 표기(버림·오차 보정)·매 프레임 HUD 갱신 검증 통과');
