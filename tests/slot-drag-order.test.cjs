/* 액션 바 슬롯 배치(드래그 앤 드롭): 순서 이동, 단축키가 위치를 따라가는지, 선호 배치가 다음 런·새로 배운 주문에 이어지는지 검증합니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const g = createHeadlessGame({ seed: 17 });
const st = g.run('state');
const learn = (s) => { st.grimoires[s] = true; return [...g.run('getActiveSpellList()')]; };

learn('fireblast');
learn('meteor');
assert.deepEqual([...g.run('getActiveSpellList()')], ['fireball', 'fireblast', 'meteor'], '기본은 습득 순서입니다.');

// 1. 메테오를 맨 앞으로: 순서와 단축키(1번 = 첫 슬롯)가 함께 바뀝니다.
assert.equal(g.run("moveSpellSlot('meteor', 0)"), true);
assert.deepEqual([...g.run('getActiveSpellList()')], ['meteor', 'fireball', 'fireblast']);
assert.equal(g.run('getActiveSpellList()[0]'), 'meteor', '숫자 1 단축키는 첫 슬롯(메테오)을 시전합니다.');
assert.equal(g.run("moveSpellSlot('meteor', 0)"), false, '같은 자리 이동은 무시합니다.');
assert.equal(g.run("moveSpellSlot('combustion', 0)"), false, '배우지 않은 주문은 옮길 수 없습니다.');
assert.deepEqual([...st.meta.slotOrder], ['meteor', 'fireball', 'fireblast'], '선호 배치로 저장됩니다.');

// 2. 새 런: 시작 주문서(메테오)를 들고 시작해도 선호 배치대로 메테오가 화염구 앞에 섭니다.
st.meta.xp = 1e9;
st.meta.startSpell = 'meteor';
g.run('restartSpeedrunRun()');
assert.deepEqual([...g.run('getActiveSpellList()')], ['meteor', 'fireball'], '선호 배치가 다음 런에 이어집니다.');

// 3. 런 중 새로 배운 주문도 선호 자리에 들어갑니다(불꽃 작렬은 화염구 뒤).
learn('fireblast');
assert.deepEqual([...g.run('getActiveSpellList()')], ['meteor', 'fireball', 'fireblast']);
// 선호 배치에 없는 주문은 맨 뒤에 붙습니다.
learn('combustion');
assert.deepEqual([...g.run('getActiveSpellList()')], ['meteor', 'fireball', 'fireblast', 'combustion']);

// 4. 세이브 정리: 알 수 없는 키·중복은 걸러냅니다.
const M = require('../src/scripts/meta-progression.js');
assert.deepEqual([...M.normalizeMeta({ slotOrder: ['meteor', 'meteor', 'hack', 'fireball'] }).slotOrder], ['meteor', 'fireball']);

console.log('슬롯 이동·단축키 위치 추종·선호 배치 저장·다음 런 유지·새 주문 선호 자리 삽입·세이브 정리 검증 통과');
