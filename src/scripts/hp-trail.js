/* HP 바 피해 잔상: 실제 HP 칸은 맞는 순간 바로 줄고, 잃은 구간은 밝은 잔상으로 잠깐 남았다가 따라 줄어듭니다.
 * - 큰 한 방(최대 체력의 BIG_HIT_PCT% 이상, 예: 메테오): 그 한 방이 깎은 구간만 흰 조각으로 번쩍여 "얼마나 깎였는지" 보이게 합니다.
 * - 쉬지 않고 맞는 연사: 잔상 대기는 '잔상이 HP를 따라잡은 뒤 첫 피해'에만 걸고, 이어지는 작은 피해로는 늘리지 않습니다.
 *   (격투 게임은 콤보가 끝날 때 잔상이 줄지만, 이 게임은 연사가 끊이지 않아 그 규칙이면 잔상이 영영 줄지 않습니다.)
 * - 시계는 게임 루프가 넘겨주는 dt로만 흐르므로, 일시정지 중에는 잔상도 멈춥니다.
 * - 회복·새 몬스터로 HP가 오르면 잔상은 즉시 HP에 맞춥니다. */
(function (root) {
  const HP_TRAIL = {
    HOLD_SEC: 0.2,        // 첫 피해 뒤 잔상이 머무는 시간
    BIG_HOLD_SEC: 0.33,   // 큰 한 방 뒤 잔상이 머무는 시간(흰 조각을 눈으로 읽을 시간)
    BIG_HIT_PCT: 6,       // 한 번에 최대 체력의 이 비율(%) 이상 깎이면 큰 한 방
    DRAIN_TAU_SEC: 0.08,  // 잔상이 따라 줄어드는 속도(지수 감쇠 시간 상수)
    MIN_DRAIN_PCT: 60     // 잔상이 줄어드는 최소 속도(%/초) — 끝자락이 질질 끌리지 않게
  };

  function createHpTrail() {
    let trailPct = 100;
    let lastPct = 100;
    let clock = 0;
    let holdUntil = 0;

    // 피해·회복 반영. 큰 한 방이면 { from, to }(잃은 구간, %)를 돌려줍니다.
    function setHp(pct) {
      const p = Math.max(0, Math.min(100, Number(pct) || 0));
      let bigHit = null;
      if (p >= lastPct) {
        if (p > lastPct) trailPct = p; // 회복·새 몬스터: 잔상 없이 바로 맞춤
      } else {
        const caughtUp = trailPct - lastPct < 0.05;
        if (caughtUp) holdUntil = Math.max(holdUntil, clock + HP_TRAIL.HOLD_SEC);
        if (lastPct - p >= HP_TRAIL.BIG_HIT_PCT) {
          bigHit = { from: lastPct, to: p };
          holdUntil = Math.max(holdUntil, clock + HP_TRAIL.BIG_HOLD_SEC);
        }
      }
      lastPct = p;
      if (trailPct < p) trailPct = p;
      return bigHit;
    }

    // dt(초)만큼 시간을 흘려 잔상을 줄입니다.
    function update(dt) {
      const step = Math.max(0, Number(dt) || 0);
      clock += step;
      if (clock < holdUntil || trailPct <= lastPct) return trailPct;
      const gap = trailPct - lastPct;
      const drop = Math.max(HP_TRAIL.MIN_DRAIN_PCT * step, gap * (1 - Math.exp(-step / HP_TRAIL.DRAIN_TAU_SEC)));
      trailPct = Math.max(lastPct, trailPct - drop);
      return trailPct;
    }

    // 새 몬스터 등장 때 잔상을 지웁니다.
    function reset(pct = 100) {
      lastPct = trailPct = Math.max(0, Math.min(100, Number(pct) || 0));
      holdUntil = clock;
    }

    return { setHp, update, reset, getTrailPct: () => trailPct, getHpPct: () => lastPct };
  }

  const api = { HP_TRAIL, createHpTrail };
  if (typeof module === 'object' && module.exports) module.exports = api;
  Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
