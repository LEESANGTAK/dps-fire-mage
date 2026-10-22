/* HP 바 피해 잔상(hp-trail.js): 잔상 대기·따라 줄기, 큰 한 방 조각, 연사 중에도 잔상이 줄어듦, 회복 시 즉시 맞춤,
 * 일시정지(dt 0) 중 정지, 게임 연결(마크업·스크립트 순서·새 몬스터 초기화)을 검증합니다. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { createHpTrail, HP_TRAIL } = require('../src/scripts/hp-trail.js');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const step = (t, sec, dt = 1 / 60) => { for (let s = 0; s < sec - 1e-9; s += dt) t.update(dt); return t.getTrailPct(); };

// 1. 작은 피해: 잔상은 대기 시간 동안 그대로 남았다가 HP까지 따라 줄어듭니다.
{
  const t = createHpTrail();
  assert.equal(t.setHp(97), null, '작은 피해는 큰 한 방이 아닙니다.');
  assert.equal(step(t, HP_TRAIL.HOLD_SEC - 0.05), 100, '대기 시간 동안 잔상이 남아 있어야 합니다.');
  assert.equal(step(t, 1), 97, '대기 뒤에는 HP까지 따라 줄어야 합니다.');
}

// 2. 큰 한 방(메테오): 깎인 구간을 돌려주고, 더 오래 머뭅니다.
{
  const t = createHpTrail();
  assert.deepEqual(t.setHp(70), { from: 100, to: 70 });
  assert.equal(step(t, HP_TRAIL.BIG_HOLD_SEC - 0.05), 100, '큰 한 방의 잔상은 더 오래 머뭅니다.');
  assert.equal(step(t, 1.5), 70);
  // 연사 중 큰 한 방도 그 한 방이 깎은 구간만 돌려줍니다.
  t.setHp(68);
  assert.deepEqual(t.setHp(55), { from: 68, to: 55 });
}

// 3. 쉬지 않는 연사(0.1초마다 1%): 잔상이 영영 멈춰 있지 않고 HP 가까이 따라옵니다.
{
  const t = createHpTrail();
  let hp = 100;
  for (let i = 0; i < 40; i++) { hp -= 1; t.setHp(hp); step(t, 0.1); }
  assert.ok(t.getTrailPct() - hp < 6, `연사 중에도 잔상이 따라와야 합니다(차이 ${(t.getTrailPct() - hp).toFixed(1)}%).`);
}

// 4. 회복·새 몬스터: 잔상 없이 즉시 맞춥니다.
{
  const t = createHpTrail();
  t.setHp(40);
  t.setHp(60);
  assert.equal(t.getTrailPct(), 60, '회복하면 잔상이 HP에 바로 맞아야 합니다.');
  t.setHp(30);
  t.reset(100);
  assert.equal(t.getTrailPct(), 100);
  assert.equal(t.getHpPct(), 100);
}

// 5. 일시정지(dt 0): 잔상이 멈춥니다.
{
  const t = createHpTrail();
  t.setHp(50);
  step(t, HP_TRAIL.BIG_HOLD_SEC + 0.05);
  const before = t.getTrailPct();
  for (let i = 0; i < 120; i++) t.update(0);
  assert.equal(t.getTrailPct(), before, 'dt 0이면 잔상이 움직이지 않아야 합니다.');
  assert.ok(before > 50, '대기 직후라 잔상이 아직 남아 있어야 합니다.');
}

// 6. 게임 연결: 마크업 층 순서, 스크립트 순서, 루프·새 몬스터 연결
{
  const html = read('index.html');
  const iTrail = html.indexOf('id="target-hp-trail"'), iFill = html.indexOf('id="target-hp-fill"'), iChunks = html.indexOf('id="target-hp-chunks"');
  assert.ok(iTrail > 0 && iTrail < iFill && iFill < iChunks, '잔상 → HP 칸 → 흰 조각 순서로 쌓여야 합니다.');
  assert.ok(html.indexOf('hp-trail.js') < html.indexOf('src/scripts/game.js'), 'hp-trail.js가 game.js보다 먼저 로드되어야 합니다.');
  const game = read('src/scripts/game.js');
  assert.equal((game.match(/^\s+updateHpTrailUI\(dt\);/gm) || []).length, 2, '전투 루프와 처치 여운 루프에서만 잔상 시계가 흘러야 합니다(일시정지 중 정지).');
  assert.match(game, /state\.monster\.isDying = false;\n\s*resetHpTrailUI\(\);/, '새 스테이지에서 잔상을 지워야 합니다.');
  assert.match(read('src/styles/paper-ui.css'), /prefers-reduced-motion[\s\S]*hp-big-hit \{ animation: none; \}/, '모션 줄이기에서는 눌림 연출을 끕니다.');

  // 실제 게임: 큰 한 방이 HUD를 거치면 잔상 상태에 기록됩니다.
  const g = createHeadlessGame();
  g.run('loadStage(1); updateLiveHUD();');
  g.run('state.monster.hp = state.monster.maxHp * 0.6; updateLiveHUD();');
  assert.equal(Math.round(g.run('hpTrail.getHpPct()')), 60);
  assert.equal(g.run('hpTrail.getTrailPct()'), 100, '맞은 직후 잔상은 원래 HP에 남아 있어야 합니다.');
  g.run('loadStage(2); updateLiveHUD();');
  assert.equal(g.run('hpTrail.getTrailPct()'), 100);
}

console.log('   HP 바 피해 잔상 대기·따라 줄기·큰 한 방 조각·연사 추종·회복 즉시 맞춤·일시정지 정지·게임 연결 검증 통과');
