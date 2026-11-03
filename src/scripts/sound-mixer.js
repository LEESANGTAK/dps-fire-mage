/* 효과음 믹서: 믹스 표(dB) 한 곳에서 모든 효과음의 크기를 정하고, Web Audio로 재생합니다.
 *
 * 왜: 예전에는 효과음마다 0.32·2.66·8.0 같은 배율이 코드 곳곳에 흩어져 있었고, 파일마다 원래 크기가 달라 그 차이까지 배율에 섞여 있었습니다.
 *     게다가 HTML 오디오 볼륨은 1이 상한이라, 효과음 슬라이더를 올리면 큰 소리부터 상한에 닿아 치명타와 메테오가 같은 크기가 되는 등 순서가 무너졌습니다.
 *
 * 구조:
 *   1. 파일 음량 보정: scripts/measure-sfx-loudness.cjs가 잰 파일별 음량(SFX_LOUDNESS)으로 원래 크기 차이를 지웁니다.
 *      변형 묶음(같은 소리 2~3개)도 서로 같은 크기로 맞춰집니다.
 *   2. 믹스 표(SFX_MIX): 소리마다 '귀에 들리는 크기'를 일반 화염구 적중 = 0dB 기준으로 적습니다. +6dB ≈ 두 배 크게, -6dB ≈ 절반.
 *      무리(SFX_BUSES)별로 한꺼번에 올리고 내릴 수 있습니다.
 *   3. Web Audio: 볼륨이 1을 넘어도 잘리지 않아, 슬라이더 위치와 관계없이 표의 비율이 유지됩니다.
 *      마지막 단의 리미터가 여러 소리가 겹쳐 찢어지는 것을 막습니다.
 *   Web Audio를 못 쓰거나 파일을 못 읽으면 예전처럼 HTML 오디오로 재생합니다(이때는 1에서 잘림).
 *
 * 2026-11-03 2차 표: 배경음을 기준으로 다시 맞췄습니다(docs/design-decisions.md '배경음 기준 믹스').
 *   기본 설정(BGM 20%, 효과음 10%)에서 배경음은 약 -30.5 LUFS(scripts/measure-bgm-loudness.cjs), 일반 적중(0dB)은 그보다 약 4.7dB 큽니다.
 *   카드 창 소리는 창이 열리면 배경음이 -9dB로 줄어드는 것을 감안한 값입니다.
 * 소리 하나를 바꿀 때는 표의 그 칸만 고치세요. 큰 사건일수록 크게(일반 적중 < 치명타 < 메테오 폭발)는 테스트가 지킵니다. */

// 효과음 파일 목록(키 → 경로, 배열이면 번갈아 트는 변형 묶음). 예전 효과음은 출처 문제로 전부 제거했습니다(docs/steam-store/sound-sources.md).
// 새 효과음: 파일을 넣고 여기에 키를 적은 뒤, 아래 SFX_MIX에 소리 이름·크기를 적고, node scripts/measure-sfx-loudness.cjs로 음량을 잽니다.
const SFX_FILES = {
  // VARCO Sound 유료 플랜 생성(2026-10-26)
  meteor_fly: 'assets/sounds/sfx/meteor_fly.wav',
  meteor_explosion: 'assets/sounds/sfx/meteor_explosion.wav',
  drop_coin: 'assets/sounds/sfx/drop_coin.wav',
  // ElevenLabs Sound Effects API, Starter 유료 플랜 생성(2026-10-28, scripts/generate-sfx.cjs)
  fly: 'assets/sounds/sfx/fireball_whoosh.wav',
  // 적중음(2026-10-31 교체): 예전 'soft pop' 4종이 타격감이 없어, 날카로운 첫소리 + 낮은 쿵의 2종으로 바꿨습니다(평균 음량 서로 맞춤).
  explosion: [
    'assets/sounds/sfx/fireball_slam_1.wav',
    'assets/sounds/sfx/fireball_slam_2.wav'
  ],
  explosion_crit: 'assets/sounds/sfx/fireball_hit_crit.wav',
  item_select: 'assets/sounds/sfx/card_pick.wav',
  monster_destroy: 'assets/sounds/sfx/monster_burst.wav',
  summon_spirit: 'assets/sounds/sfx/spirit_summon.wav',
  // 강조음 2종: 축하(보상·기록·해금)와 발동(전투 중 상태 변화·시작 버튼)을 소리로 구분합니다.
  celebrate: 'assets/sounds/sfx/celebrate_chime.wav',
  proc: 'assets/sounds/sfx/proc_chime.wav',
  // 1차 추가분(2026-10-31, ElevenLabs Starter). 종류마다 2~3개를 섞어 틀고, 평균 음량은 가장 작은 후보에 맞췄습니다.
  card_hover: ['assets/sounds/sfx/card_hover_1.wav', 'assets/sounds/sfx/card_hover_2.wav'],
  card_deal: ['assets/sounds/sfx/card_deal_1.wav', 'assets/sounds/sfx/card_deal_2.wav', 'assets/sounds/sfx/card_deal_3.wav'],
  card_stamp: ['assets/sounds/sfx/card_stamp_1.wav', 'assets/sounds/sfx/card_stamp_2.wav'],
  card_shuffle: ['assets/sounds/sfx/card_shuffle_1.wav', 'assets/sounds/sfx/card_shuffle_2.wav', 'assets/sounds/sfx/card_shuffle_3.wav'],
  buy_denied: ['assets/sounds/sfx/buy_denied_1.wav', 'assets/sounds/sfx/buy_denied_2.wav', 'assets/sounds/sfx/buy_denied_3.wav'],
  enrage_tick: ['assets/sounds/sfx/enrage_tick_1.wav', 'assets/sounds/sfx/enrage_tick_2.wav'],
  run_defeat: ['assets/sounds/sfx/run_defeat_1.wav', 'assets/sounds/sfx/run_defeat_2.wav'],
  // 메뉴·창 버튼 마우스오버 '톡'(2026-10-31). 카드 호버 '슥'보다 짧고 작습니다.
  button_hover: ['assets/sounds/sfx/button_hover_1.wav', 'assets/sounds/sfx/button_hover_2.wav'],
  // 팝업 창 열림 '사락'(2026-10-31): Esc 메뉴·설정·도감이 함께 씁니다.
  popup_open: ['assets/sounds/sfx/popup_open_1.wav', 'assets/sounds/sfx/popup_open_2.wav'],
  // 배경 소품 상호작용(2026-11-02 시범). 전용 효과음을 만들기 전까지 기존 파일을 음높이만 바꿔 씁니다.
  prop_crystal_tap: ['assets/sounds/sfx/button_hover_1.wav', 'assets/sounds/sfx/button_hover_2.wav'],
  prop_crystal_break: 'assets/sounds/sfx/monster_burst.wav',
  prop_brazier: 'assets/sounds/sfx/fireball_whoosh.wav',
  prop_sigil: 'assets/sounds/sfx/celebrate_chime.wav',
  prop_lantern: ['assets/sounds/sfx/card_stamp_1.wav', 'assets/sounds/sfx/card_stamp_2.wav'],
  prop_relight: 'assets/sounds/sfx/fireball_whoosh.wav',
  prop_cart: ['assets/sounds/sfx/fireball_slam_1.wav', 'assets/sounds/sfx/fireball_slam_2.wav'],
  prop_cart_spill: 'assets/sounds/sfx/monster_burst.wav',
  prop_banner: ['assets/sounds/sfx/card_shuffle_1.wav', 'assets/sounds/sfx/card_shuffle_2.wav'],
  prop_chime: 'assets/sounds/sfx/celebrate_chime.wav',
  prop_peek: ['assets/sounds/sfx/button_hover_1.wav', 'assets/sounds/sfx/button_hover_2.wav'],
  prop_slime: ['assets/sounds/sfx/card_deal_1.wav', 'assets/sounds/sfx/card_deal_2.wav'],
  // 반복음(지속 피해 연소음, 시전 중 충전음). ElevenLabs 반복(loop) 옵션으로 생성(2026-10-28).
  // 연소음은 같은 소리를 원형으로 3겹 겹쳐 빈 구간을 채웠습니다.
  burn_loop: 'assets/sounds/sfx/burn_loop.wav',
  cast_loop: 'assets/sounds/sfx/fireball_charge_loop.wav'
};

// 무리별 추가 조절(dB). 0이면 표 그대로.
const SFX_BUSES = { combat: 0, meteor: 0, reward: 0, ui: 0, alert: 0, prop: 0 };

// 소리 이름 → { sound: 파일 키(SFX_FILES), bus, db, measure?: 'mean'(계속 깔리는 반복음), offset?: 앞 무음 건너뛰기(초) }
const SFX_MIX = {
  // 전투: 화염구
  launch: { sound: 'fly', bus: 'combat', db: -1.0 },
  fireball_fly: { sound: 'fly', bus: 'combat', db: -3.0 },
  hit: { sound: 'explosion', bus: 'combat', db: 0 },
  crit: { sound: 'explosion_crit', bus: 'combat', db: 9.0 },
  flame_patch_burst: { sound: 'explosion', bus: 'combat', db: -12.0 },
  cast_loop: { sound: 'cast_loop', bus: 'combat', db: -9.0, measure: 'mean' },
  burn_loop: { sound: 'burn_loop', bus: 'combat', db: -17.5, measure: 'mean' },
  // 메테오
  meteor_fly: { sound: 'meteor_fly', bus: 'meteor', db: 6.0 },
  meteor_fly_small: { sound: 'meteor_fly', bus: 'meteor', db: 3.5 },
  meteor_explosion: { sound: 'meteor_explosion', bus: 'meteor', db: 13.5, offset: 0.06 },
  // 보상·강조
  item_select: { sound: 'item_select', bus: 'reward', db: -10.0 },
  drop_coin: { sound: 'drop_coin', bus: 'reward', db: -7.0 },
  celebrate: { sound: 'celebrate', bus: 'reward', db: 1.0 },
  proc: { sound: 'proc', bus: 'reward', db: -4.0 },
  monster_destroy: { sound: 'monster_destroy', bus: 'reward', db: -5.0 },
  summon_spirit: { sound: 'summon_spirit', bus: 'reward', db: -4.0 },
  // 종이 재질 UI: 자주 나는 소리일수록 작게
  card_hover: { sound: 'card_hover', bus: 'ui', db: -18.0 },
  card_deal: { sound: 'card_deal', bus: 'ui', db: -16.0 },
  card_stamp: { sound: 'card_stamp', bus: 'ui', db: -12.0 },
  card_shuffle: { sound: 'card_shuffle', bus: 'ui', db: -16.0 },
  buy_denied: { sound: 'buy_denied', bus: 'ui', db: -15.0 },
  button_hover: { sound: 'button_hover', bus: 'ui', db: -13.0 },
  popup_open: { sound: 'popup_open', bus: 'ui', db: -6.0 },
  // 알림
  enrage_tick: { sound: 'enrage_tick', bus: 'alert', db: -9.0 },
  run_defeat: { sound: 'run_defeat', bus: 'alert', db: -3.0 },
  // 배경 소품: 전투 소리를 가리지 않게 작게. 부서짐·옥좌 점등·멜로디만 한 단계 크게.
  prop_crystal_tap: { sound: 'prop_crystal_tap', bus: 'prop', db: -13.0 },
  prop_crystal_break: { sound: 'prop_crystal_break', bus: 'prop', db: -9.0 },
  prop_brazier: { sound: 'prop_brazier', bus: 'prop', db: -10.0 },
  prop_sigil: { sound: 'prop_sigil', bus: 'prop', db: -3.0 },
  prop_lantern: { sound: 'prop_lantern', bus: 'prop', db: -14.0 },
  prop_relight: { sound: 'prop_relight', bus: 'prop', db: -10.0 },
  prop_cart: { sound: 'prop_cart', bus: 'prop', db: -12.0 },
  prop_cart_spill: { sound: 'prop_cart_spill', bus: 'prop', db: -9.0 },
  prop_banner: { sound: 'prop_banner', bus: 'prop', db: -14.0 },
  prop_chime: { sound: 'prop_chime', bus: 'prop', db: -7.0 },
  prop_peek: { sound: 'prop_peek', bus: 'prop', db: -14.0 },
  prop_slime: { sound: 'prop_slime', bus: 'prop', db: -12.0 }
};

// 0dB(일반 적중)가 효과음 슬라이더 100%에서 갖는 음량(LUFS). 슬라이더·저장값의 의미를 예전과 같게 두려고 정한 값입니다.
const SFX_REFERENCE_LUFS = -5.8;
// 리미터: 합쳐진 소리가 이 크기를 넘으면 눌러 찢어짐을 막습니다. 기본 슬라이더(10%)에서는 거의 닿지 않습니다.
const SFX_LIMITER = { threshold: -2, knee: 0, ratio: 20, attack: 0.003, release: 0.15 };

const dbToGain = (db) => Math.pow(10, db / 20);

// 파일 하나를 표의 크기로 낼 때 곱할 배율(효과음 슬라이더 100%, 마스터 100% 기준). 측정값이 없으면 보정 없이 표 값만 씁니다.
function sfxCueGain(cueName, filePath, { mix = SFX_MIX, buses = SFX_BUSES, loudness = {}, reference = SFX_REFERENCE_LUFS } = {}) {
  const cue = mix[cueName];
  if (!cue) return 0;
  const measured = loudness[filePath];
  const fileLevel = measured ? measured[cue.measure === 'mean' ? 'mean' : 'short'] : reference;
  return dbToGain(reference + (buses[cue.bus] || 0) + cue.db - fileLevel);
}

/* 믹서 만들기.
 * files: 파일 키 → 경로 또는 경로 배열. getVolume(): 효과음 슬라이더 × 마스터(음소거면 0). random(): 변형 고르기용 난수.
 * AudioContextCtor·fetchFn·AudioCtor는 테스트에서 가짜를 넣을 수 있게 열어 둡니다. */
function createSoundMixer(options = {}) {
  const files = options.files || SFX_FILES;
  const mix = options.mix || SFX_MIX;
  const buses = options.buses || SFX_BUSES;
  const loudness = options.loudness || (typeof SFX_LOUDNESS !== 'undefined' ? SFX_LOUDNESS : {});
  const getVolume = options.getVolume || (() => 1);
  const random = options.random || Math.random;
  const win = typeof window !== 'undefined' ? window : {};
  const AudioContextCtor = 'AudioContextCtor' in options ? options.AudioContextCtor : (win.AudioContext || win.webkitAudioContext || null);
  const fetchFn = 'fetchFn' in options ? options.fetchFn : (typeof fetch === 'function' ? fetch : null);
  const AudioCtor = 'AudioCtor' in options ? options.AudioCtor : (typeof Audio !== 'undefined' ? Audio : null);

  const pathsOf = (key) => { const src = files[key]; return src ? (Array.isArray(src) ? src : [src]) : []; };
  const gainOf = (cue, file) => sfxCueGain(cue, file, { mix, buses, loudness });

  // Web Audio 경로: 무리별 GainNode → 리미터 → 스피커
  let ctx = null, busNodes = {};
  if (AudioContextCtor) {
    try {
      ctx = new AudioContextCtor();
      const limiter = ctx.createDynamicsCompressor();
      for (const [k, v] of Object.entries(SFX_LIMITER)) if (limiter[k] && 'value' in limiter[k]) limiter[k].value = v;
      limiter.connect(ctx.destination);
      for (const bus of Object.keys(buses)) {
        const g = ctx.createGain();
        g.gain.value = 1; // 무리 조절은 sfxCueGain에 이미 들어 있음(노드는 나중의 덕킹용 자리)
        g.connect(limiter);
        busNodes[bus] = g;
      }
    } catch (e) { ctx = null; busNodes = {}; }
  }
  const buffers = {}; // 경로 → AudioBuffer (못 읽은 파일은 HTML 오디오로)
  const elements = {}; // 경로 → HTMLAudioElement 원본(대체 경로용)

  function elementFor(file) {
    if (!AudioCtor) return null;
    if (!elements[file]) {
      try { const a = new AudioCtor(file); a.preload = 'auto'; elements[file] = a; } catch (e) { return null; }
    }
    return elements[file];
  }

  function decode(data) {
    // 오래된 Safari는 콜백형만 지원
    return new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  }

  // 모든 효과음 파일을 미리 읽습니다. 실패한 파일은 HTML 오디오로 재생됩니다.
  function load() {
    const all = [...new Set(Object.values(files).flatMap((s) => (Array.isArray(s) ? s : [s])))];
    if (!ctx || !fetchFn) { all.forEach(elementFor); return Promise.resolve({ webAudio: 0, element: all.length }); }
    return Promise.all(all.map((file) => fetchFn(file)
      .then((r) => { if (r.ok === false) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then(decode)
      .then((buf) => { buffers[file] = buf; return true; })
      .catch(() => { elementFor(file); return false; })))
      .then((ok) => ({ webAudio: ok.filter(Boolean).length, element: ok.filter((x) => !x).length }));
  }

  // 브라우저는 사용자 입력 전 AudioContext를 멈춰 둡니다. 첫 입력 때 부릅니다.
  function resume() {
    if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume().catch(() => {});
  }

  const lastVariant = {};
  function pickFile(key) {
    const list = pathsOf(key);
    if (list.length <= 1) return list[0] || null;
    const last = lastVariant[key];
    let i;
    if (last === undefined) i = Math.floor(random() * list.length);
    else { i = Math.floor(random() * (list.length - 1)); if (i >= last) i++; }
    lastVariant[key] = i;
    return list[i];
  }

  const clampRate = (r) => Math.min(2.0, Math.max(0.5, r));

  // 한 번 재생. 반환: { pause(), paused } (메테오 낙하음처럼 도중에 끊을 때) 또는 소리가 안 나면 null.
  function play(cueName, { pitch = 1.0, offset } = {}) {
    const cue = mix[cueName];
    const volume = getVolume();
    if (!cue || volume <= 0) return null;
    const file = pickFile(cue.sound);
    if (!file) return null;
    const gain = gainOf(cueName, file) * volume;
    const start = Math.max(0, (offset !== undefined ? offset : cue.offset) || 0);
    const buf = buffers[file];
    if (ctx && buf && busNodes[cue.bus]) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = clampRate(pitch);
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(g);
        g.connect(busNodes[cue.bus]);
        const handle = { paused: false, pause() { if (!handle.paused) { handle.paused = true; try { src.stop(); } catch (e) { /* 이미 끝남 */ } } } };
        src.onended = () => { handle.paused = true; try { g.disconnect(); } catch (e) { /* 무시 */ } };
        src.start(0, Math.min(start, Math.max(0, buf.duration - 0.01)));
        return handle;
      } catch (e) { /* 아래 대체 경로 */ }
    }
    const base = elementFor(file);
    if (!base) return null;
    try {
      const snd = base.cloneNode();
      snd.volume = Math.min(1, gain);
      if (start) snd.currentTime = start;
      if (pitch !== 1.0 && typeof snd.playbackRate === 'number') {
        // 브라우저는 기본으로 속도만 바꾸고 음높이를 유지하므로, 꺼야 음높이가 함께 바뀝니다.
        snd.preservesPitch = false;
        snd.playbackRate = clampRate(pitch);
      }
      snd.play().catch(() => {});
      return snd;
    } catch (e) { return null; }
  }

  // 반복음(연소·충전). update(active)를 매 프레임 불러 켜고 끕니다. pause()는 일시정지 메뉴가 씁니다.
  function loop(cueName) {
    const cue = mix[cueName];
    const file = cue ? pathsOf(cue.sound)[0] : null;
    if (!file) return null;
    let src = null, g = null, el = null, playing = false;
    const target = () => gainOf(cueName, file) * getVolume();
    function startWebAudio() {
      if (src || !ctx || !buffers[file] || !busNodes[cue.bus]) return Boolean(src);
      try {
        src = ctx.createBufferSource();
        src.buffer = buffers[file];
        src.loop = true;
        g = ctx.createGain();
        g.gain.value = 0;
        src.connect(g);
        g.connect(busNodes[cue.bus]);
        src.start();
        return true;
      } catch (e) { src = null; g = null; return false; }
    }
    function update(active) {
      const vol = target();
      const on = Boolean(active) && vol > 0;
      if (startWebAudio()) {
        // 짧게 미끄러지듯 켜고 꺼 '딸깍' 잡음을 없앱니다.
        try { g.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.03); } catch (e) { g.gain.value = on ? vol : 0; }
        playing = on;
        return;
      }
      if (!el) {
        if (!AudioCtor) return;
        try { el = new AudioCtor(file); el.preload = 'auto'; el.loop = true; } catch (e) { return; }
      }
      try {
        el.volume = Math.min(1, vol);
        if (on && el.paused) el.play().catch(() => {});
        if (!on && !el.paused) el.pause();
      } catch (e) { /* 오디오 미준비 */ }
      playing = on;
    }
    return {
      update,
      pause() {
        if (g) { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.03); } catch (e) { g.gain.value = 0; } }
        if (el && !el.paused) { try { el.pause(); } catch (e) { /* 무시 */ } }
        playing = false;
      },
      get paused() { return !playing; }
    };
  }

  return {
    play,
    loop,
    load,
    resume,
    gainOf,
    get mode() { return ctx ? 'webaudio' : 'element'; },
    get loadedCount() { return Object.keys(buffers).length; }
  };
}

if (typeof module !== 'undefined') {
  module.exports = { SFX_FILES, SFX_BUSES, SFX_MIX, SFX_REFERENCE_LUFS, SFX_LIMITER, sfxCueGain, createSoundMixer, dbToGain };
}
