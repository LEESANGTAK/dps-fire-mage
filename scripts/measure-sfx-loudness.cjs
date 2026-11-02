/* 효과음 파일 음량 측정 → src/scripts/sfx-loudness.js 생성.
 *
 *   node scripts/measure-sfx-loudness.cjs          파일을 다시 재서 생성 파일을 덮어씁니다(효과음을 바꾸거나 추가한 뒤 실행).
 *   node scripts/measure-sfx-loudness.cjs --check  생성 파일이 지금 파일들과 맞는지만 확인합니다(테스트가 씀).
 *
 * 측정: 귀의 감도를 흉내 낸 K-가중(ITU-R BS.1770, 48kHz 계수)을 건 뒤
 *   - short: 100ms 창 중 가장 큰 구간의 음량(LUFS 단위). 짧은 타격음·UI 소리의 '세게 들리는 정도'.
 *   - mean:  파일 전체 평균 음량. 반복음(연소·충전)처럼 계속 깔리는 소리에 씁니다.
 *   - peak:  최대 표본값(dBFS). 증폭 시 찢어짐 여유를 볼 때 씁니다.
 * 믹스 표(src/scripts/sound-mixer.js)는 이 값으로 파일마다 원래 크기 차이를 지우고, 표에 적힌 크기로 맞춥니다. */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SFX_DIR = path.join(ROOT, 'assets', 'sounds', 'sfx');
const OUT = path.join(ROOT, 'src', 'scripts', 'sfx-loudness.js');

function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: WAV가 아닙니다.`);
  let o = 12, fmt = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(o + 8), channels: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') {
      if (!fmt || fmt.format !== 1 || fmt.bits !== 16) throw new Error(`${file}: 16비트 PCM만 지원합니다.`);
      const frames = Math.floor(size / (2 * fmt.channels));
      const out = new Float64Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.channels; c++) s += b.readInt16LE(o + 8 + (i * fmt.channels + c) * 2) / 32768;
        out[i] = s / fmt.channels;
      }
      return { rate: fmt.rate, samples: out };
    }
    o += 8 + size + (size & 1);
  }
  throw new Error(`${file}: data 구간이 없습니다.`);
}

function biquad(x, [b0, b1, b2], [, a1, a2]) {
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

const lufs = (meanSquare) => -0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-12));
const round = (v) => Math.round(v * 10) / 10;

function measure(file) {
  const { rate, samples } = readWav(file);
  if (rate !== 48000) throw new Error(`${file}: 48kHz만 지원합니다(K-가중 계수가 48kHz용).`);
  const shelf = biquad(samples, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
  const k = biquad(shelf, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  let peak = 0, total = 0;
  for (let i = 0; i < samples.length; i++) { peak = Math.max(peak, Math.abs(samples[i])); total += k[i] * k[i]; }
  const win = Math.round(rate * 0.1), hop = Math.round(rate * 0.01);
  let best = 0;
  if (k.length <= win) best = total / Math.max(1, k.length);
  else {
    let acc = 0;
    for (let i = 0; i < win; i++) acc += k[i] * k[i];
    best = acc;
    for (let start = hop; start + win <= k.length; start += hop) {
      for (let i = start - hop; i < start; i++) acc -= k[i] * k[i];
      for (let i = start + win - hop; i < start + win; i++) acc += k[i] * k[i];
      best = Math.max(best, acc);
    }
    best /= win;
  }
  return { short: round(lufs(best)), mean: round(lufs(total / Math.max(1, k.length))), peak: round(20 * Math.log10(Math.max(peak, 1e-6))) };
}

function measureAll() {
  const result = {};
  for (const name of fs.readdirSync(SFX_DIR).filter((f) => f.endsWith('.wav')).sort()) {
    result[`assets/sounds/sfx/${name}`] = measure(path.join(SFX_DIR, name));
  }
  return result;
}

function render(table) {
  const lines = Object.entries(table).map(([k, v]) => `  '${k}': { short: ${v.short}, mean: ${v.mean}, peak: ${v.peak} }`);
  return `/* 자동 생성 파일: node scripts/measure-sfx-loudness.cjs (직접 고치지 마세요).
 * 효과음 파일별 음량. short = 가장 큰 100ms 구간(LUFS), mean = 파일 전체 평균(LUFS), peak = 최대 표본(dBFS). */
const SFX_LOUDNESS = {
${lines.join(',\n')}
};
if (typeof module !== 'undefined') module.exports = { SFX_LOUDNESS };
`;
}

if (require.main === module) {
  const text = render(measureAll());
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    if (now !== text) { console.error('sfx-loudness.js가 효과음 파일과 맞지 않습니다. node scripts/measure-sfx-loudness.cjs 를 실행하세요.'); process.exit(1); }
    console.log('sfx-loudness.js 최신');
  } else {
    fs.writeFileSync(OUT, text);
    console.log(`${OUT} 생성`);
  }
}

module.exports = { measure, measureAll, render };
