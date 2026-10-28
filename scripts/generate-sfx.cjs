/**
 * scripts/generate-sfx.cjs
 *
 * ElevenLabs 효과음 API로 효과음 후보를 만들고, 비교용 청취 페이지를 만듭니다.
 * - API 키는 환경 변수 ELEVENLABS_API_KEY에서 읽습니다. Windows에서 앱을 켠 뒤에 등록해
 *   현재 프로세스에 없으면 사용자 환경 변수에서 직접 읽습니다. 키는 출력하거나 파일에 쓰지 않습니다.
 * - 결과는 .sfx-candidates/<이름>/ 에 저장합니다(.gitignore 대상). 고르고 난 후보 폴더는 _done/ 으로 옮기면
 *   청취 페이지에서 빠지고 생성 기록(meta.json)은 남습니다. 마음에 드는 후보를
 *   assets/sounds/sfx/ 로 옮기는 일은 사람이 듣고 고른 뒤에 합니다.
 * - Starter 플랜은 44.1kHz wav를 받을 수 없어(Pro 이상) 48kHz wav로 받습니다. 응답은 스테레오라 모노로 합칩니다.
 * - 후처리: 앞 무음 자르기(입력과 소리 사이 지연 제거), 짧은 소리는 꼬리 무음 자르기와 페이드아웃,
 *   최대 음량을 -1dB로 맞춤. 반복음(loop)은 이음매를 지키려고 자르지 않고 음량만 맞춥니다.
 * - 생성 기록(프롬프트·모델·날짜·응답 request-id)은 후보마다 meta.json에 남깁니다(출처 증빙).
 *
 * 사용법: node scripts/generate-sfx.cjs --list
 *        node scripts/generate-sfx.cjs fireball_fly fireball_explosion [--count 4] [--models v2,v3]
 *        node scripts/generate-sfx.cjs --page          (이미 만든 후보로 청취 페이지만 다시 만듦)
 *        node scripts/generate-sfx.cjs burning --densify  (이미 만든 반복음 후보에 채우기만 적용, 크레딧 없음)
 *        [--prompt "..."] 이름 하나에 프롬프트를 덮어써서 시험, [--duration 0.6], [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.sfx-candidates');
const SAMPLE_RATE = 48000;
const TARGET_PEAK_DB = -1;

// 프롬프트에는 다른 게임 이름이나 특정 게임 소리를 흉내 내는 표현을 쓰지 않습니다(docs/steam-store/sound-sources.md).
const STYLE = 'cartoon paper-craft game sound effect, mono, clean, no music, no voice';
const SOUNDS = {
  fireball_fly: {
    use: '화염구 비행', duration: 0.5,
    prompt: 'short cartoon fireball whoosh flying past, crackling flame, bright and snappy, no reverb tail'
  },
  fireball_explosion: {
    use: '화염구 적중', duration: 0.5,
    prompt: 'small cartoon fire burst impact, soft pop with crackle, punchy and short, game hit sound'
  },
  fireball_explosion_critical: {
    use: '화염구 치명타 적중', duration: 0.8,
    prompt: 'heavier cartoon fire explosion, sharp crack plus bass thump and sparkle, satisfying critical hit, short tail'
  },
  fireball_ready: {
    use: '화염구 시전 중 반복음', duration: 5, loop: true,
    prompt: 'magical fire energy charging in hand, steady crackling flame hum, seamless loop, no build-up or ending'
  },
  burning: {
    use: '화상 반복음', duration: 7, loop: true, densify: 3,
    prompt: 'gentle steady burning fire crackle, small flames on paper, seamless loop, calm, no pops louder than the rest'
  },
  item_select: {
    use: '카드 선택', duration: 0.7,
    prompt: 'magical card pick confirm, paper card flip with warm chime and tiny flame shimmer, UI sound'
  },
  swish: {
    use: '휘두르기', duration: 0.5,
    prompt: 'quick magic staff swing swish, light air whoosh'
  },
  monster_destroy: {
    use: '몬스터 처치', duration: 1.0,
    prompt: 'cartoon paper monster bursting apart, papery crumple and puff with a satisfying pop'
  },
  summon_spirit: {
    use: '정령 소환', duration: 1.3,
    prompt: 'summoning a small fire spirit, rising magical whoosh into a warm flame ignite with sparkle'
  }
};
const MODELS = { v2: 'eleven_text_to_sound_v2', v3: 'eleven_text_to_sound_v3' };

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const VALUE_FLAGS = ['count', 'models', 'prompt', 'duration'];
const names = args.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes((args[i - 1] || '').replace(/^--/, '')));

function readApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  if (process.platform === 'win32') {
    try {
      const v = execFileSync('powershell', ['-NoProfile', '-Command',
        "[Environment]::GetEnvironmentVariable('ELEVENLABS_API_KEY','User')"], { encoding: 'utf8' }).trim();
      if (v) return v;
    } catch (e) { /* 아래에서 안내 */ }
  }
  throw new Error('ELEVENLABS_API_KEY 환경 변수를 찾지 못했습니다.');
}

async function requestSound({ text, duration, loop, model, apiKey }) {
  // 응답은 스테레오입니다. 헤더가 있는 wav로 받아 채널 수를 읽고 모노로 합칩니다.
  const res = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=wav_${SAMPLE_RATE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
    body: JSON.stringify({ text, duration_seconds: duration, loop: Boolean(loop), prompt_influence: 0.5, model_id: model })
  });
  if (!res.ok) throw new Error(`API 오류 ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  let o = 12, fmt = null, data = null;
  while (o + 8 <= buf.length) {
    const id = buf.toString('ascii', o, o + 4);
    const size = buf.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { ch: buf.readUInt16LE(o + 10), rate: buf.readUInt32LE(o + 12), bits: buf.readUInt16LE(o + 22) };
    if (id === 'data') { data = { start: o + 8, size: Math.min(size, buf.length - o - 8) }; break; }
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16 || fmt.rate !== SAMPLE_RATE) {
    throw new Error(`예상하지 못한 wav 형식: ${JSON.stringify(fmt)}`);
  }
  const frames = Math.floor(data.size / (2 * fmt.ch));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.ch; c++) sum += buf.readInt16LE(data.start + (i * fmt.ch + c) * 2);
    samples[i] = sum / fmt.ch / 32768;
  }
  return { samples, requestId: res.headers.get('request-id') || res.headers.get('x-request-id') || null };
}

// 반복음 채우기: 모델이 불 소리를 '드문드문 튀는 소리'로 만드는 경향이 있어, 같은 소리를 시작 위치만
// 원형으로 돌려 여러 겹 겹치고(반복 구간 안에서 돌리므로 이음매 유지) 튀는 소리를 부드럽게 누릅니다.
function densifyLoop(samples, layers) {
  const n = samples.length;
  const out = new Float32Array(n);
  for (let k = 0; k < layers; k++) {
    const shift = Math.floor((n * k) / layers);
    for (let i = 0; i < n; i++) out[i] += samples[(i + shift) % n];
  }
  const sorted = Array.from(out, Math.abs).sort((a, b) => a - b);
  const knee = sorted[Math.floor(sorted.length * 0.99)] || 1;
  for (let i = 0; i < n; i++) out[i] = knee * Math.tanh(out[i] / knee);
  return out;
}

const toDb = (a) => (a > 0 ? 20 * Math.log10(a) : -Infinity);
const peakOf = (s) => s.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

// 앞 무음(-45dB 미만)을 자르되 2ms는 남겨 어택이 잘리지 않게 합니다.
function processSamples(samples, opts) {
  const { loop } = opts;
  let out = samples;
  const stats = { rawSec: samples.length / SAMPLE_RATE, rawPeakDb: toDb(peakOf(samples)) };
  if (!loop) {
    const peak = peakOf(out) || 1;
    const headThr = peak * Math.pow(10, -45 / 20);
    const tailThr = peak * Math.pow(10, -50 / 20);
    let first = out.findIndex((v) => Math.abs(v) > headThr);
    if (first < 0) first = 0;
    let last = out.length - 1;
    while (last > first && Math.abs(out[last]) < tailThr) last--;
    const start = Math.max(0, first - Math.round(SAMPLE_RATE * 0.002));
    out = out.slice(start, last + 1);
    stats.headTrimMs = Math.round((start / SAMPLE_RATE) * 1000);
    const fade = Math.min(out.length, Math.round(SAMPLE_RATE * 0.02));
    for (let i = 0; i < fade; i++) out[out.length - fade + i] *= 1 - (i + 1) / fade;
  }
  if (loop && opts.densify) out = densifyLoop(out, opts.densify);
  const gain = Math.pow(10, TARGET_PEAK_DB / 20) / (peakOf(out) || 1);
  out = out.map((v) => v * gain);
  stats.sec = out.length / SAMPLE_RATE;
  return { samples: out, stats };
}

function writeWav(file, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SAMPLE_RATE, 24); h.writeUInt32LE(SAMPLE_RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

function buildPage() {
  if (!fs.existsSync(OUT_DIR)) return null;
  const groups = fs.readdirSync(OUT_DIR, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => {
    const dir = path.join(OUT_DIR, d.name);
    const metas = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
      .sort((a, b) => a.file.localeCompare(b.file));
    return { name: d.name, use: (SOUNDS[d.name] || {}).use || '', metas };
  });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 소리를 페이지 안에 넣어, 파일 하나만 열어도(정적 사본 미리보기 포함) 재생되게 합니다.
  const dataUri = (g, m) => `data:audio/wav;base64,${fs.readFileSync(path.join(OUT_DIR, g.name, m.file)).toString('base64')}`;
  const rows = groups.map((g) => `
  <section><h2>${esc(g.name)} <small>${esc(g.use)}</small></h2>
  ${g.metas.map((m) => `<div class="row">
    <b>${esc(m.file)}</b>
    <audio controls preload="auto" src="${dataUri(g, m)}"${m.loop ? ' loop' : ''}></audio>
    ${m.loop ? '' : `<button data-src="${dataUri(g, m)}">연사 ×6</button>`}
    <span class="meta">${esc(m.modelShort)} · ${m.stats.sec.toFixed(2)}초 · 원본 ${m.stats.rawPeakDb.toFixed(1)}dB${m.stats.headTrimMs ? ` · 앞 ${m.stats.headTrimMs}ms 자름` : ''}</span>
    <div class="prompt">${esc(m.prompt)}</div></div>`).join('')}
  </section>`).join('');
  const html = `<!doctype html><meta charset="utf-8"><title>효과음 후보</title>
<style>body{font:14px system-ui,sans-serif;margin:16px;max-width:900px;background:#fff;color:#222}
h2 small{font-weight:normal;color:#777}.row{padding:8px 0;border-bottom:1px solid #eee}
.row b{display:inline-block;min-width:90px}audio{vertical-align:middle;height:32px}
.meta{color:#666;margin-left:8px}.prompt{color:#999;font-size:12px;margin-top:2px}button{margin-left:6px}</style>
<h1>효과음 후보</h1><p>모든 후보는 최대 음량 -1dB로 맞췄습니다. "연사 ×6"은 초당 6회 연속 재생으로 귀 피로를 확인합니다.</p>
${rows}
<script>document.querySelectorAll('button[data-src]').forEach(b=>b.onclick=()=>{for(let i=0;i<6;i++)setTimeout(()=>{const a=new Audio(b.dataset.src);a.volume=0.7;a.play()},i*166)})</script>`;
  const file = path.join(OUT_DIR, 'index.html');
  fs.writeFileSync(file, html);
  return file;
}

async function main() {
  if (flag('list')) {
    for (const [k, v] of Object.entries(SOUNDS)) console.log(`${k.padEnd(28)} ${v.use} · ${v.duration}초${v.loop ? ' · 반복' : ''}`);
    return;
  }
  if (flag('page')) { console.log('청취 페이지:', buildPage()); return; }
  if (flag('densify')) {
    for (const name of names) {
      const cfg = SOUNDS[name];
      const dir = path.join(OUT_DIR, name);
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.wav') && !x.includes('_dense'))) {
        const raw = fs.readFileSync(path.join(dir, f));
        const x = new Float32Array((raw.length - 44) >> 1);
        for (let i = 0; i < x.length; i++) x[i] = raw.readInt16LE(44 + i * 2) / 32768;
        const { samples, stats } = processSamples(x, { loop: true, densify: cfg.densify || 3 });
        const outFile = f.replace(/\.wav$/, '_dense.wav');
        writeWav(path.join(dir, outFile), samples);
        const meta = JSON.parse(fs.readFileSync(path.join(dir, f.replace(/\.wav$/, '.json')), 'utf8'));
        fs.writeFileSync(path.join(dir, outFile.replace(/\.wav$/, '.json')), JSON.stringify({ ...meta, file: outFile, densify: cfg.densify || 3, stats: { ...meta.stats, ...stats } }, null, 2));
        console.log(`${name}/${outFile}`);
      }
    }
    console.log('청취 페이지:', buildPage());
    return;
  }
  if (!names.length) throw new Error('만들 효과음 이름을 적어 주세요(--list로 목록 확인).');
  const unknown = names.filter((n) => !SOUNDS[n]);
  if (unknown.length) throw new Error(`모르는 이름: ${unknown.join(', ')}`);

  const count = Number(argValue('count', 4));
  const models = argValue('models', 'v2,v3').split(',').map((m) => m.trim());
  const apiKey = flag('dry-run') ? '' : readApiKey();
  const date = new Date().toISOString();

  for (const name of names) {
    const cfg = SOUNDS[name];
    const prompt = argValue('prompt', null) || cfg.prompt;
    const duration = Number(argValue('duration', cfg.duration));
    const text = `${prompt}, ${STYLE}`;
    const dir = path.join(OUT_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    const existing = fs.readdirSync(dir).filter((f) => f.endsWith('.wav')).length;
    for (let i = 0; i < count; i++) {
      const modelShort = models[i % models.length];
      const model = MODELS[modelShort] || modelShort;
      // 반복음은 loop 옵션이 v2에서만 되므로 v2로 고정합니다.
      const useModel = cfg.loop ? MODELS.v2 : model;
      const file = `${String(existing + i + 1).padStart(2, '0')}_${cfg.loop ? 'v2' : modelShort}.wav`;
      if (flag('dry-run')) { console.log(`[dry-run] ${name}/${file} ${useModel} ${duration}초: ${text}`); continue; }
      const { samples, requestId } = await requestSound({ text, duration, loop: cfg.loop, model: useModel, apiKey });
      const { samples: out, stats } = processSamples(samples, cfg);
      writeWav(path.join(dir, file), out);
      fs.writeFileSync(path.join(dir, file.replace(/\.wav$/, '.json')), JSON.stringify({
        file, name, prompt: text, model: useModel, modelShort: cfg.loop ? 'v2' : modelShort, duration, loop: Boolean(cfg.loop),
        generatedAt: date, requestId, service: 'ElevenLabs Sound Effects API (Starter 유료 플랜)', stats
      }, null, 2));
      console.log(`${name}/${file} ${stats.sec.toFixed(2)}초 (원본 ${stats.rawSec.toFixed(2)}초, ${stats.rawPeakDb.toFixed(1)}dB)`);
    }
  }
  if (!flag('dry-run')) console.log('청취 페이지:', buildPage());
}

main().catch((e) => { console.error(e.message); process.exit(1); });
