/* 치명 전설 '불꽃 심판': 화염구 치명타로 마무리하면 준비 → 다음 스테이지 첫 화염구 치명타 8배(보스 4배) 후 소모.
 * 화염구가 아닌 막타·비치명 막타는 준비하지 않고, 비치명 화염구는 소모하지 않습니다. 데이터·해금·아이콘 연결도 확인합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const { MASTERY_UNLOCKS } = require('../src/scripts/meta-progression.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// 1. 데이터: 치명 전설 1장, 배율은 데이터에서 조정, 첫 런에는 잠김(숙련도 해금)
const card = JSON.parse(read('src/data/roguelike-cards.json')).find((c) => c.id === 'crit_ember_verdict');
assert.ok(card, '불꽃 심판 카드가 있어야 합니다.');
assert.equal(card.rarity, 'legendary');
assert.equal(card.build, 'crit');
assert.equal(card.maxStack, 1);
assert.deepEqual(card.mechanicParams, { mult: 8, bossMult: 4 });
assert.ok(MASTERY_UNLOCKS.some((u) => u.type === 'card' && u.id === 'crit_ember_verdict'), '숙련도로 해금되어 첫 런에는 나오지 않습니다.');
assert.match(read('src/scripts/comic-assets.js'), /crit_ember_verdict:\['skills',0,'ruby'\]/);

const g = createHeadlessGame();
const setup = (stage) => g.run(`deckManager.resetDeck(state); deckManager.selectCard('crit_ember_verdict', state); loadStage(${stage}); state.combat.verdictArmed = false; state.monster.hp = state.monster.maxHp;`);
const hit = (skill, dmg, crit) => g.run(`(() => { const before = state.monster.hp; dealDamage('${skill}', ${dmg}, ${crit}); return before - state.monster.hp; })()`);
g.run('rollCritVariance = () => 1;'); // 치명타 피해 흔들림을 꺼서 배율만 비교

// 2. 준비: 화염구 치명타 막타만
setup(6);
g.run('state.monster.hp = 10;');
hit('meteor', 50, true);
assert.equal(g.run('state.combat.verdictArmed'), false, '화염구가 아닌 막타는 준비하지 않습니다.');
setup(6);
g.run('state.monster.hp = 10;');
hit('fireball', 50, false);
assert.equal(g.run('state.combat.verdictArmed'), false, '비치명 화염구 막타는 준비하지 않습니다.');
setup(6);
g.run('state.monster.hp = 10;');
hit('fireball', 50, true);
assert.equal(g.run('state.combat.verdictArmed'), true, '화염구 치명타 막타면 준비됩니다.');

// 3. 발동: 다음 스테이지 첫 화염구 치명타 ×8, 비치명은 소모하지 않음, 한 번 쓰면 끝
g.run('loadStage(7); state.monster.isDying = false; state.monster.hp = state.monster.maxHp;');
assert.equal(g.run('state.combat.verdictArmed'), true, '스테이지가 바뀌어도 준비 상태는 이어집니다.');
const plainHit = hit('fireball', 100, false);
assert.equal(g.run('state.combat.verdictArmed'), true, '비치명 화염구는 준비를 소모하지 않습니다.');
const verdictHit = hit('fireball', 100, true);
assert.equal(g.run('state.combat.verdictArmed'), false, '첫 치명타에서 소모됩니다.');
const normalCrit = hit('fireball', 100, true);
assert.ok(Math.abs(verdictHit / normalCrit - 8) < 0.01, `일반 스테이지는 8배여야 합니다(${(verdictHit / normalCrit).toFixed(2)}).`);
assert.ok(plainHit > 0);

// 4. 보스 스테이지는 4배
setup(9);
g.run('state.monster.hp = 10;');
hit('fireball', 50, true);
g.run('loadStage(10); state.monster.isDying = false; state.monster.hp = state.monster.maxHp;');
const bossVerdict = hit('fireball', 100, true);
const bossCrit = hit('fireball', 100, true);
assert.ok(Math.abs(bossVerdict / bossCrit - 4) < 0.01, `보스는 4배여야 합니다(${(bossVerdict / bossCrit).toFixed(2)}).`);

// 5. 카드가 없으면 아무 일도 없고, 새 런에서 준비 상태가 지워집니다.
g.run('deckManager.resetDeck(state); state.deckMechanics = {}; loadStage(6); state.monster.hp = 10;');
hit('fireball', 50, true);
assert.equal(g.run('state.combat.verdictArmed'), false, '카드가 없으면 준비되지 않습니다.');
assert.match(read('src/scripts/game.js'), /state\.combat\.streakTimer = 0;\n\s*state\.combat\.verdictArmed = false;/, '새 런에서 준비 상태를 지웁니다.');
assert.match(read('src/styles/paper-ui.css'), /prefers-reduced-motion[\s\S]*\.verdict-armed \{ animation: none; \}/);

console.log('   불꽃 심판 데이터·해금·아이콘, 화염구 치명타 막타 준비, 다음 스테이지 첫 치명타 8배(보스 4배)·1회 소모, 새 런 초기화 검증 통과');
