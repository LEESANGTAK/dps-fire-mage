/* 페이퍼크래프트 시범 장면 전용 시간 모델. 실제 게임 수치와 저장에는 연결하지 않습니다. */
(function (root) {
  const LIMITS = Object.freeze({ projectiles: 8, particles: 24, actorFps: 12 });
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  function createState() {
    return { time: 0, duration: 1.5, casting: 0, auto: true, paused: false,
      reduced: false, release: 0, hit: 0, strongHit: false, hp: 1000,
      death: -1, modal: false, shots: 0, hits: 0, projectiles: [], particles: [], peakProjectiles: 0, peakParticles: 0 };
  }
  function shoot(s, strong = false) {
    if (s.paused || s.death >= 0 || s.modal) return false;
    s.shots++;
    s.release = strong ? 0.24 : 0.17;
    s.projectiles.push({ age: 0, life: strong ? 0.32 : 0.38, strong });
    if (s.projectiles.length > LIMITS.projectiles) s.projectiles.shift();
    s.peakProjectiles = Math.max(s.peakProjectiles, s.projectiles.length);
    return true;
  }
  function defeat(s) {
    if (s.paused || s.death >= 0 || s.modal) return;
    s.hp = 0; s.death = 0; s.casting = 0; s.release = 0;
    s.projectiles.length = 0; s.particles.length = 0;
  }
  function startCast(s) {
    if (s.paused || s.modal || s.death >= 0 || s.casting > 0) return false;
    s.casting = s.duration;
    return true;
  }
  function impact(s, strong) {
    s.hits++; s.hp = Math.max(0, s.hp - (strong ? 24 : 8));
    s.hit = 0.25; s.strongHit = strong;
    if (!s.reduced) {
      const count = strong ? 8 : 4;
      for (let i = 0; i < count; i++) s.particles.push({ age: 0, life: 0.34 + i * 0.018,
        angle: -2.7 + i * 2.35 / Math.max(1, count - 1), distance: (strong ? 80 : 45) + i * 3,
        green: true, strong });
      s.particles = s.particles.slice(-LIMITS.particles);
      s.peakParticles = Math.max(s.peakParticles, s.particles.length);
    }
    if (!s.hp) defeat(s);
  }
  function step(s, elapsed, effects = {}) {
    if (s.paused || s.modal) return;
    // 작은 고정 간격으로 처리해 발사 직후 투사체가 한 프레임만큼 앞서 출발하지 않게 합니다.
    let remaining = clamp(elapsed, 0, 0.1);
    while (remaining > 0.000001) {
      const dt = Math.min(remaining, 1 / 240); remaining -= dt; s.time += dt;
      s.release = Math.max(0, s.release - dt); s.hit = Math.max(0, s.hit - dt);
      if (s.death >= 0) {
        s.death += dt;
        if (s.death >= 1.1) { s.modal = true; return; }
        continue;
      }
      s.particles.forEach(p => p.age += dt);
      s.particles = s.particles.filter(p => p.age < p.life);
      const arrived = [];
      s.projectiles.forEach(p => { p.age += dt; if (p.age >= p.life) arrived.push(p); });
      s.projectiles = s.projectiles.filter(p => p.age < p.life);
      for (const p of arrived) { if (s.death < 0) { impact(s, p.strong); if (effects.impact) effects.impact(p); } }
      if (s.death >= 0) continue;
      if (s.casting > 0) {
        s.casting = Math.max(0, s.casting - dt);
        if (s.casting < 0.000001) { s.casting = 0; shoot(s); }
      }
      if (s.auto && s.casting === 0) startCast(s);
    }
  }
  function magePose(s) {
    if (s.release > 0.1) return 'release';
    if (s.release > 0) return 'recoil';
    return s.casting > 0 ? 'anticipation' : 'idle';
  }
  function slimePose(s) {
    if (s.hit > 0.13) return 'hit';
    if (s.hit > 0) return 'recover';
    if (s.reduced) return 'idle';
    const tick = Math.floor(s.time * LIMITS.actorFps);
    return tick % 27 >= 19 && tick % 27 <= 22 ? 'rest' : 'idle';
  }
  const api = { LIMITS, clamp, easeOut, createState, shoot, startCast, defeat, step, magePose, slimePose };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaperPreviewCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
