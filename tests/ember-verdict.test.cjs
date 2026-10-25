/* 치명 전설 '불꽃 심판': 화염구 치명타 후 3초 안에 처치하면 준비 → 다음 스테이지 처음 20초 동안 직격 치명타 피해 ×3(보스 같음).
 * 화상 같은 지속 피해는 늘지 않고, 20초(전투 시간)가 지나면 끝납니다. 추첨 규칙 플래그(보스 전설 우선 제외·보장 유지)와
 * 데이터·해금·아이콘·준비 표시 연결도 확인합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const { MASTERY_UNLOCKS } = require('../src/scripts/meta-progression.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// 1. 데이터: 치명 전설 1장, 수치는 데이터에서 조정, 첫 런에는 잠김(숙련도 해금)
const card = JSON.parse(read('src/data/roguelike-cards.json')).find((c) => c.id === 'crit_ember_verdict');
assert.ok(card, '불꽃 심판 카드가 있어야 합니다.');
assert.equal(card.rarity, 'legendary');
assert.equal(card.build, 'crit');
assert.equal(card.maxStack, 1);
assert.deepEqual(card.mechanicParams, { window: 3, duration: 20, critBonus: 2, bossCritBonus: 2, skipBossPriority: true, keepsGuarantee: true });
assert.ok(MASTERY_UNLOCKS.some((u) => u.type === 'card' && u.id === 'crit_ember_verdict'), '숙련도로 해금되어 첫 런에는 나오지 않습니다.');
assert.match(read('src/scripts/comic-assets.js'), /crit_ember_verdict:\['skills',0,'ruby'\]/);

const g = createHeadlessGame();
const setup = (stage) => g.run(`deckManager.resetDeck(state); deckManager.selectCard('crit_ember_verdict', state); loadStage(${stage}); state.combat.verdictArmed = false; state.monster.hp = state.monster.maxHp;`);
const hit = (skill, dmg, crit, dot = false) => g.run(`(() => { const before = state.monster.hp; dealDamage('${skill}', ${dmg}, ${crit}, true, ${dot}); return before - state.monster.hp; })()`);
const wait = (sec) => g.run(`state.playTimeSec = (state.playTimeSec || 0) + ${sec};`);
const finish = (skill, crit) => { g.run('state.monster.hp = 10;'); hit(skill, 50, crit); };
g.run('rollCritVariance = () => 1;'); // 치명타 피해 흔들림을 꺼서 배율만 비교

// 2. 준비: 처치 직전 3초 안에 화염구 치명타가 있었으면(막타가 무엇이든)
setup(6);
finish('meteor', true);
assert.equal(g.run('state.combat.verdictArmed'), false, '화염구 치명타 없이 처치하면 준비되지 않습니다.');
setup(6);
finish('fireball', false);
assert.equal(g.run('state.combat.verdictArmed'), false, '비치명 화염구 막타는 준비하지 않습니다.');
setup(6);
finish('fireball', true);
assert.equal(g.run('state.combat.verdictArmed'), true, '화염구 치명타 막타면 준비됩니다.');
setup(6);
hit('fireball', 100, true);
wait(2.5);
finish('ignite', false);
assert.equal(g.run('state.combat.verdictArmed'), true, '화염구 치명타 2.5초 뒤 화상이 막타여도 준비됩니다.');
setup(6);
hit('fireball', 100, true);
wait(3.5);
finish('summon_elem', false);
assert.equal(g.run('state.combat.verdictArmed'), false, '3초가 지난 뒤의 막타는 준비하지 않습니다.');
setup(6);
hit('fireball', 100, true);
g.run('loadStage(7); state.monster.hp = 10;');
hit('meteor', 50, false);
assert.equal(g.run('state.combat.verdictArmed'), false, '지난 스테이지의 화염구 치명타는 이번 스테이지 판정에 쓰지 않습니다.');

// 3. 발동: 준비된 채 다음 스테이지가 시작되면 20초 동안 직격 치명타 ×3, 비치명·지속 피해는 그대로
setup(6);
finish('fireball', true);
g.run('loadStage(7); state.monster.hp = state.monster.maxHp;');
assert.equal(g.run('state.combat.verdictArmed'), false, '스테이지가 시작되면 준비가 발동으로 바뀝니다.');
assert.ok(Math.abs(g.run('state.combat.verdictBurstUntil - state.playTimeSec') - 20) < 1e-9, '발동은 20초입니다.');
const burstCrit = hit('meteor', 100, true);
const burstPlain = hit('fireball', 100, false);
const burstDot = hit('ignite', 100, true, true);
wait(19.9);
const lateCrit = hit('fireball', 100, true);
wait(0.2);
const afterCrit = hit('fireball', 100, true);
const afterDot = hit('ignite', 100, true, true);
assert.ok(Math.abs(burstCrit / afterCrit - 3) < 0.01, `발동 중 치명타는 3배여야 합니다(${(burstCrit / afterCrit).toFixed(2)}).`);
assert.ok(Math.abs(lateCrit / afterCrit - 3) < 0.01, '20초 직전까지 유지됩니다.');
assert.ok(Math.abs(burstDot / afterDot - 1) < 0.01, '화상 같은 지속 피해는 늘지 않습니다.');
assert.ok(burstPlain > 0 && burstPlain < burstCrit, '비치명타는 늘지 않습니다.');
assert.equal(g.run('state.stats.verdictHits') >= 1, true, '발동 횟수를 기록합니다(시뮬레이터 출력).');

// 4. 보스 스테이지도 3배, 다음 스테이지로 넘어가면 남은 시간은 사라집니다
setup(9);
finish('fireball', true);
g.run('loadStage(10); state.monster.hp = state.monster.maxHp;');
const bossVerdict = hit('fireball', 100, true);
g.run('loadStage(11); state.monster.hp = state.monster.maxHp;');
const nextCrit = hit('fireball', 100, true);
assert.ok(Math.abs(bossVerdict / nextCrit - 3) < 0.01, `보스도 3배여야 합니다(${(bossVerdict / nextCrit).toFixed(2)}).`);
assert.equal(g.run('state.combat.verdictBurstUntil'), 0, '발동은 시작한 스테이지 안에서만 유지됩니다.');

// 5. 준비 표시: 준비 중엔 다음 스테이지 배율 꼬리표, 발동 중엔 남은 시간 게이지
setup(6);
finish('fireball', true);
g.run('updateEmberVerdictBadge();');
assert.equal(g.run(`document.getElementById(SPELL_ACTION_CONFIG.fireball.id).dataset.verdict`), '×3');
// 헤드리스 DOM의 classList·style은 빈 껍데기라, 이 버튼의 호출만 기록해 확인합니다.
g.run(`(() => { const b = document.getElementById(SPELL_ACTION_CONFIG.fireball.id); globalThis.__badge = {};
  b.classList.toggle = (c, on) => { __badge[c] = on; }; b.style.setProperty = (k, v) => { __badge[k] = v; }; })()`);
g.run('loadStage(7); state.monster.hp = state.monster.maxHp; state.playTimeSec += 5; updateEmberVerdictBadge();');
assert.equal(g.run(`__badge['verdict-burning']`), true, '발동 중 표시');
assert.equal(g.run(`__badge['--verdict-left']`), '75%', '남은 시간 15/20초');
g.run('state.playTimeSec += 16; updateEmberVerdictBadge();');
assert.equal(g.run(`__badge['verdict-armed']`), false, '20초가 지나면 표시가 사라집니다.');
const css = read('src/styles/paper-ui.css');
assert.match(css, /\.verdict-armed::after[\s\S]*var\(--verdict-left/, '꼬리표가 남은 시간 게이지가 됩니다.');
assert.match(css, /prefers-reduced-motion[\s\S]*\.verdict-armed \{ animation: none; \}/);
assert.match(read('src/scripts/i18n-en.js'), /'⚖️ 불꽃 심판! 치명 피해 ×\{n\}':/);

// 6. 추첨: 보스 보상의 '주력 빌드 전설 우선'에서 빠지고, 들고 있어도 보스 전설 보장이 이어집니다
g.run(`deckManager.resetDeck(state); state.deckMechanics = {}; state.grimoires = {}; state.lockedCards = [];
  deckManager.selectCard('crit_focus', state); deckManager.selectCard('crit_focus', state); deckManager.selectCard('crit_heat', state);`);
const bossDraws = g.run(`Array.from({ length: 300 }, () => deckManager.drawChoices(3, true, state).filter((c) => c.rarity === 'legendary').map((c) => c.id))`);
assert.ok(bossDraws.every((ids) => ids.length > 0), '전설이 없으면 보스 보상에 전설이 나옵니다.');
assert.ok(bossDraws.filter((ids) => !ids.includes('crit_ember_verdict')).length > 150, '치명 빌드여도 보장 전설이 불꽃 심판으로 고정되지 않습니다.');
g.run(`deckManager.selectCard('crit_ember_verdict', state);`);
const heldDraws = g.run(`Array.from({ length: 100 }, () => deckManager.drawChoices(3, true, state).some((c) => c.rarity === 'legendary'))`);
assert.ok(heldDraws.every(Boolean), '불꽃 심판을 들고 있어도 보스 전설 보장이 이어집니다.');

// 7. 카드가 없으면 아무 일도 없고, 새 런에서 준비 상태가 지워집니다.
g.run('deckManager.resetDeck(state); state.deckMechanics = {}; loadStage(6); state.monster.hp = 10;');
hit('fireball', 50, true);
assert.equal(g.run('state.combat.verdictArmed'), false, '카드가 없으면 준비되지 않습니다.');
assert.match(read('src/scripts/game.js'), /state\.combat\.streakTimer = 0;\n\s*state\.combat\.verdictArmed = false;/, '새 런에서 준비 상태를 지웁니다.');

console.log('   불꽃 심판 데이터·해금·아이콘, 처치 직전 3초 화염구 치명타로 준비, 다음 스테이지 20초 치명 피해 ×3(보스 같음·지속 피해 제외), 준비·남은 시간 표시, 보스 전설 우선 제외·보장 유지, 새 런 초기화 검증 통과');
