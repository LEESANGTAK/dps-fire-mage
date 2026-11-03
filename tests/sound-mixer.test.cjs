/* 효과음 믹서: 파일 음량 측정값이 최신인지, 믹스 표가 모든 소리를 덮는지, 크기 순서, 예전 크기 보존,
 * Web Audio 재생(1을 넘는 증폭·음높이·시작 위치·끊기), HTML 오디오 대체 경로, 반복음을 검증합니다. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { measureAll, render } = require('../scripts/measure-sfx-loudness.cjs');
const { SFX_LOUDNESS } = require('../src/scripts/sfx-loudness.js');
const { SFX_FILES, SFX_MIX, SFX_BUSES, sfxCueGain, createSoundMixer, dbToGain } = require('../src/scripts/sound-mixer.js');
const { createHeadlessGame } = require('../scripts/lib/headless-game.cjs');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// 1. 측정값이 지금 효과음 파일과 맞아야 합니다(파일을 바꾸고 다시 재지 않으면 크기가 어긋남).
assert.equal(read('src/scripts/sfx-loudness.js').replace(/\r\n/g, '\n'), render(measureAll()),
  'sfx-loudness.js가 효과음 파일과 다릅니다. node scripts/measure-sfx-loudness.cjs 를 실행하세요.');

// 2. 믹스 표가 실제 파일 키를 가리키고, 코드가 부르는 소리 이름이 모두 표에 있어야 합니다.
const g = createHeadlessGame({ seed: 3 });
const files = SFX_FILES;
for (const [cue, c] of Object.entries(SFX_MIX)) {
  assert.ok(files[c.sound], `${cue}: 파일 키 ${c.sound}가 없습니다.`);
  assert.ok(c.bus in SFX_BUSES, `${cue}: 모르는 무리 ${c.bus}`);
  for (const f of [].concat(files[c.sound])) assert.ok(SFX_LOUDNESS[f], `${f} 음량 측정값 없음`);
}
const game = read('src/scripts/game.js');
const cuesCalled = new Set([...game.matchAll(/playSfxCue\('([a-z_]+)'/g)].map((m) => m[1]));
for (const m of game.matchAll(/playSfxCue\(scale >= 0\.9 \? '([a-z_]+)' : '([a-z_]+)'/g)) { cuesCalled.add(m[1]); cuesCalled.add(m[2]); }
cuesCalled.add('burn_loop'); cuesCalled.add('cast_loop');
const uiKeys = [...game.slice(game.indexOf('const UI_SFX = {'), game.indexOf('const uiSfxLastAt')).matchAll(/^\s{2}([a-z_]+): \{/gm)].map((m) => m[1]);
uiKeys.forEach((k) => cuesCalled.add(k));
for (const cue of cuesCalled) assert.ok(SFX_MIX[cue], `코드가 부르는 소리 ${cue}가 믹스 표에 없습니다.`);
for (const cue of Object.keys(SFX_MIX)) assert.ok(cuesCalled.has(cue), `믹스 표의 ${cue}를 아무도 부르지 않습니다(구형 잔재).`);
assert.ok(!/playFireballSfx|FIREBALL_HIT_VOL|METEOR_SFX_VOL|getEffectiveSfxVol/.test(game), '예전 볼륨 배율이 남아 있습니다.');

// 3. 큰 사건일수록 크게: 일반 적중 < 치명타 < 메테오 폭발, UI 호버는 전투보다 작게.
assert.equal(SFX_MIX.hit.db, 0, '일반 적중이 0dB 기준');
assert.ok(SFX_MIX.hit.db < SFX_MIX.crit.db && SFX_MIX.crit.db < SFX_MIX.meteor_explosion.db);
assert.ok(SFX_MIX.card_hover.db < SFX_MIX.hit.db && SFX_MIX.button_hover.db < SFX_MIX.hit.db);

// 4. 배경음 기준 믹스(docs/design-decisions.md '배경음 기준 믹스'): 기본 설정에서 일반 적중은 배경음보다 약 4.7dB 큽니다.
//    카드 창 소리는 창이 열리면 배경음이 9dB 줄어드는 것을 감안합니다.
const P = (n) => `assets/sounds/sfx/${n}.wav`;
const overBgm = (cue) => SFX_MIX[cue].db + 4.7 + (['card_hover', 'card_deal', 'card_stamp', 'card_shuffle', 'buy_denied'].includes(cue) ? 9.1 : 0);
// 자주 나는 소리는 배경음 아래, 발사·비행은 적중보다 작게
for (const cue of ['card_hover', 'button_hover', 'prop_crystal_tap', 'prop_lantern', 'burn_loop']) assert.ok(overBgm(cue) < 0, `${cue}가 배경음보다 큽니다.`);
assert.ok(SFX_MIX.launch.db < SFX_MIX.hit.db && SFX_MIX.fireball_fly.db < SFX_MIX.hit.db, '발사·비행음이 적중음보다 큽니다.');
// 배경음에 묻히지 않게: 결정·피드백 소리는 배경음보다 5dB 넘게 작지 않음
for (const cue of ['card_stamp', 'buy_denied', 'monster_destroy', 'proc', 'run_defeat', 'enrage_tick', 'button_hover']) {
  assert.ok(overBgm(cue) >= -9, `${cue}가 배경음에 묻힙니다(${overBgm(cue).toFixed(1)}dB).`);
}
// 큰 사건도 배경음을 20dB 넘게 덮지 않음
for (const cue of Object.keys(SFX_MIX)) assert.ok(overBgm(cue) <= 20, `${cue}가 배경음보다 지나치게 큽니다.`);
// 변형 묶음은 서로 같은 크기로 맞춰집니다(원래 큰 파일은 작게, 작은 파일은 크게).
{
  const [a, b] = [P('fireball_slam_1'), P('fireball_slam_2')];
  const heard = (f) => 20 * Math.log10(sfxCueGain('hit', f, { loudness: SFX_LOUDNESS })) + SFX_LOUDNESS[f].short;
  assert.ok(Math.abs(heard(a) - heard(b)) < 0.01);
}
// 무리 조절은 그 무리 소리 전부에 더해집니다.
assert.ok(Math.abs(sfxCueGain('crit', P('fireball_hit_crit'), { loudness: SFX_LOUDNESS, buses: { ...SFX_BUSES, combat: 6 } })
  / sfxCueGain('crit', P('fireball_hit_crit'), { loudness: SFX_LOUDNESS }) - dbToGain(6)) < 1e-9);

// 믹싱 페이지(previews/sound-mixer.html): 표의 모든 소리에 이름이 있고, 장면이 없는 소리를 부르지 않습니다.
{
  const page = read('previews/sound-mixer.html');
  const labels = page.slice(page.indexOf('const CUE_LABELS = {'), page.indexOf('const LOOP_CUES'));
  for (const cue of Object.keys(SFX_MIX)) assert.ok(new RegExp(`\\b${cue}: '`).test(labels), `믹싱 페이지에 ${cue} 이름이 없습니다.`);
  const scenes = page.slice(page.indexOf('const SCENES = {'), page.indexOf('function playScene'));
  for (const m of scenes.matchAll(/\[[\d.]+, '([a-z_]+)'/g)) assert.ok(SFX_MIX[m[1]], `믹싱 페이지 장면의 ${m[1]}이 표에 없습니다.`);
  assert.ok(page.includes('../src/scripts/sound-mixer.js') && page.includes('../src/scripts/sfx-loudness.js'), '게임과 같은 믹서를 써야 합니다.');
}

// ---- 가짜 Web Audio ----
function fakeAudioContext(log) {
  const param = (v = 0) => ({ value: v, setTargetAtTime(t) { this.value = t; } });
  const node = (kind) => ({ kind, connected: [], connect(n) { this.connected.push(n); return n; }, disconnect() {} });
  return class FakeCtx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = node('dest'); log.ctx = this; }
    createDynamicsCompressor() { const n = node('limiter'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = param(); log.limiter = n; return n; }
    createGain() { const n = node('gain'); n.gain = param(1); return n; }
    createBufferSource() {
      const n = node('src'); n.playbackRate = param(1); n.loop = false;
      n.start = (when, offset) => { log.started.push({ buffer: n.buffer.name, rate: n.playbackRate.value, offset, gain: n.connected[0].gain.value, bus: n.connected[0].connected[0], loop: n.loop, node: n }); };
      n.stop = () => { log.stopped++; };
      return n;
    }
    decodeAudioData(data) { return Promise.resolve({ name: data.name, duration: 2 }); }
    resume() { this.state = 'running'; log.resumed++; return Promise.resolve(); }
  };
}
const fakeFetch = (failing = []) => (url) => (failing.includes(url)
  ? Promise.reject(new Error('blocked'))
  : Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve({ name: url }) }));
class FakeAudio {
  constructor(src) { this.src = src; this.volume = 1; this.paused = true; this.playbackRate = 1; this.currentTime = 0; FakeAudio.made.push(this); }
  cloneNode() { const c = new FakeAudio(this.src); return c; }
  play() { this.paused = false; FakeAudio.played.push(this); return Promise.resolve(); }
  pause() { this.paused = true; }
}
FakeAudio.made = []; FakeAudio.played = [];

const testFiles = { explosion: [P('fireball_slam_1'), P('fireball_slam_2')], explosion_crit: P('fireball_hit_crit'), meteor_explosion: P('meteor_explosion'), burn_loop: P('burn_loop'), card_hover: [P('card_hover_1'), P('card_hover_2')] };

(async () => {
  // 5. Web Audio: 효과음 슬라이더 20%에서도 치명타·메테오가 1에서 잘리지 않고 표의 비율을 유지합니다.
  {
    const log = { started: [], stopped: 0, resumed: 0 };
    let volume = 0.2;
    const mixer = createSoundMixer({ files: testFiles, loudness: SFX_LOUDNESS, getVolume: () => volume, random: () => 0.3, AudioContextCtor: fakeAudioContext(log), fetchFn: fakeFetch(), AudioCtor: FakeAudio });
    assert.equal(mixer.mode, 'webaudio');
    assert.deepEqual(await mixer.load(), { webAudio: 7, element: 0 });
    assert.equal(log.limiter.threshold.value, -2, '마지막 단 리미터');
    assert.equal(log.limiter.connected[0], log.ctx.destination);

    mixer.play('crit', { pitch: 1.15 });
    mixer.play('meteor_explosion');
    const [crit, meteor] = log.started;
    assert.ok(crit.gain > 1 && meteor.gain > 1, '슬라이더 20%에서 1을 넘는 크기도 그대로 냅니다.');
    assert.ok(Math.abs(20 * Math.log10(meteor.gain / crit.gain) - ((SFX_MIX.meteor_explosion.db - SFX_LOUDNESS[P('meteor_explosion')].short) - (SFX_MIX.crit.db - SFX_LOUDNESS[P('fireball_hit_crit')].short))) < 1e-6,
      '치명타와 메테오의 차이가 슬라이더와 무관하게 표대로');
    assert.equal(crit.rate, 1.15, '음높이');
    assert.equal(meteor.offset, 0.06, '메테오 폭발 앞 무음 건너뛰기');
    assert.equal(crit.bus.kind, 'gain');
    assert.equal(crit.bus.connected[0], log.limiter, '무리 → 리미터');

    // 음높이 범위 제한, 시작 위치 지정, 도중에 끊기
    const h = mixer.play('crit', { pitch: 5, offset: 0.4 });
    assert.equal(log.started[2].rate, 2.0);
    assert.equal(log.started[2].offset, 0.4);
    assert.equal(h.paused, false);
    h.pause(); h.pause();
    assert.equal(log.stopped, 1);
    assert.equal(h.paused, true);

    // 변형 묶음은 같은 파일을 연달아 고르지 않습니다.
    log.started.length = 0;
    for (let i = 0; i < 6; i++) mixer.play('hit');
    for (let i = 1; i < 6; i++) assert.notEqual(log.started[i].buffer, log.started[i - 1].buffer);

    // 음소거·슬라이더 0이면 소리를 만들지 않습니다.
    volume = 0;
    assert.equal(mixer.play('crit'), null);
    assert.equal(mixer.play('없는소리'), null);

    // 반복음: 켜면 표 크기, 끄면 0으로 미끄러지고, 소스는 하나만 만듭니다.
    volume = 0.1;
    log.started.length = 0;
    const loop = mixer.loop('burn_loop');
    loop.update(true); loop.update(true);
    assert.equal(log.started.length, 1);
    assert.equal(log.started[0].loop, true);
    const loopGain = log.started[0].node.connected[0].gain;
    assert.ok(Math.abs(loopGain.value - mixer.gainOf('burn_loop', P('burn_loop')) * 0.1) < 1e-9);
    assert.equal(loop.paused, false);
    loop.update(false);
    assert.equal(loopGain.value, 0);
    loop.update(true); loop.pause();
    assert.equal(loopGain.value, 0);
    assert.equal(loop.paused, true);

    log.ctx.state = 'suspended';
    mixer.resume();
    assert.equal(log.resumed, 1, '브라우저 첫 입력 때 다시 켬');
  }

  // 6. 파일을 못 읽으면(파일 주소 차단 등) 그 파일만 HTML 오디오로 냅니다. 이때는 1에서 잘립니다.
  {
    const log = { started: [], stopped: 0, resumed: 0 };
    FakeAudio.played.length = 0;
    const mixer = createSoundMixer({ files: testFiles, loudness: SFX_LOUDNESS, getVolume: () => 0.5, AudioContextCtor: fakeAudioContext(log), fetchFn: fakeFetch([P('fireball_hit_crit')]), AudioCtor: FakeAudio });
    assert.deepEqual(await mixer.load(), { webAudio: 6, element: 1 });
    mixer.play('crit', { pitch: 0.8 });
    assert.equal(log.started.length, 0);
    const el = FakeAudio.played.at(-1);
    assert.equal(el.src, P('fireball_hit_crit'));
    assert.equal(el.volume, 1, '대체 경로는 1에서 잘림');
    assert.equal(el.playbackRate, 0.8);
    assert.equal(el.preservesPitch, false);
    mixer.play('meteor_explosion');
    assert.equal(log.started.length, 1, '나머지 파일은 Web Audio');
  }

  // 7. Web Audio가 없는 환경(헤드리스 테스트 등): HTML 오디오로 내고, 반복음은 play/pause로 켜고 끕니다.
  {
    FakeAudio.played.length = 0;
    const mixer = createSoundMixer({ files: testFiles, loudness: SFX_LOUDNESS, getVolume: () => 0.1, AudioContextCtor: null, fetchFn: null, AudioCtor: FakeAudio });
    assert.equal(mixer.mode, 'element');
    await mixer.load();
    const snd = mixer.play('meteor_explosion');
    assert.ok(Math.abs(snd.volume - Math.min(1, mixer.gainOf('meteor_explosion', P('meteor_explosion')) * 0.1)) < 1e-9);
    assert.equal(snd.currentTime, 0.06);
    const loop = mixer.loop('burn_loop');
    loop.update(true);
    assert.equal(loop.paused, false);
    loop.pause();
    assert.equal(loop.paused, true);
  }

  // 8. 실제 게임(헤드리스): 효과음 슬라이더가 믹서 크기에 곱해지고, 음소거면 소리가 나지 않습니다.
  {
    const st = g.run('state');
    st.soundOn = true; st.masterVolume = 1; st.sfxVolume = 0.2;
    assert.equal(g.run('getSfxUserVolume()'), 0.2);
    st.soundOn = false;
    assert.equal(g.run("playSfxCue('crit')"), null);
    assert.equal(g.run('soundMixer.mode'), 'element', '헤드리스에는 Web Audio가 없어 대체 경로');
  }
  console.log('   효과음 믹서: 측정값 최신·표 범위·크기 순서·배경음 기준 크기·Web Audio 증폭·대체 경로·반복음 검증 통과');
})().catch((e) => { console.error(e); process.exit(1); });
