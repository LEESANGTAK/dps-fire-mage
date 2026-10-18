/* 다음 스테이지로 넘어가면 모든 주문의 재사용 대기시간과 불꽃 작렬 충전이 처음부터 시작되는지 검증합니다. */
const assert = require('node:assert/strict');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const g = createHeadlessGame({ seed: 3 });
const st = g.run('state');
Object.assign(st.grimoires, { fireblast: true, meteor: true, combustion: true, flame_patch: true });

const c = st.combat;
c.meteorCdRem = 12;
c.combustionCdRem = 25;
c.flamePatchCdRem = 7;
c.fbCharges = 0;
c.fbRechargeRem = 5;

g.run('loadStage(state.currentStage + 1)');

assert.equal(c.meteorCdRem, 0, '메테오 쿨타임이 초기화되어야 합니다.');
assert.equal(c.combustionCdRem, 0, '마력 폭주 쿨타임이 초기화되어야 합니다.');
assert.equal(c.flamePatchCdRem, 0, '불장판 쿨타임이 초기화되어야 합니다.');
assert.equal(c.fbCharges, c.fbMaxCharges, '불꽃 작렬 충전이 가득 차야 합니다.');
assert.equal(c.fbRechargeRem, 0, '불꽃 작렬 재충전 타이머가 비워져야 합니다.');

console.log('   다음 스테이지 진입 시 메테오·마력 폭주·불장판 쿨타임과 불꽃 작렬 충전 초기화 검증 통과');
