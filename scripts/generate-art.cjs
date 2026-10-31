/**
 * scripts/generate-art.cjs
 *
 * OpenAI 이미지 API로 아트 후보를 만들고, 체크해서 고르는 비교 페이지를 만듭니다.
 * - API 키는 환경 변수 OPENAI_API_KEY에서 읽습니다. 현재 프로세스에 없으면(Windows에서 앱을 켠 뒤 등록)
 *   사용자 환경 변수에서 직접 읽습니다. 키는 출력하거나 파일에 쓰지 않습니다.
 * - 프롬프트는 기획 문서에서 읽습니다: '**공통:**' 아래 인용문 + '**A:** ...' 같은 후보 줄.
 *   문서를 고치면 프롬프트도 같이 바뀌므로 문서와 생성 기록이 어긋나지 않습니다.
 * - 결과는 .art-candidates/<세트>/ 에 저장합니다(.gitignore 대상). 생성 기록(프롬프트·모델·날짜·request-id)은
 *   그림마다 .json으로 남깁니다(출처 증빙, Steam AI 공개용). 고른 그림을 assets/로 옮기는 일은 사람이 고른 뒤에 합니다.
 *
 * 사용법: node scripts/generate-art.cjs mage-redesign [--only A,C] [--count 2] [--model gpt-image-1.5] [--quality high] [--dry-run]
 *        node scripts/generate-art.cjs mage-redesign --list-models   (계정에서 쓸 수 있는 이미지 모델 이름)
 *        node scripts/generate-art.cjs mage-redesign --edit F1 [--count 2]   (F1.png를 넣고 문서의 '**F1 수정:**' 문장대로 고친 변형을 F3.png 등으로 만듦)
 *        node scripts/generate-art.cjs mage-poses --poses F8 [--only release] [--count 3]
 *          (F8.png를 넣고 문서의 '**포즈 공통:**' + '**F8 포즈 release:**' 문장으로 포즈별 그림을 release-1.png 등으로 만듦)
 *        [--mask x0,y0,x1,y1] 편집할 사각형(픽셀)만 바꾸도록 범위를 지정합니다. 나머지는 원본을 최대한 유지합니다.
 *        node scripts/generate-art.cjs mage-redesign --page   (이미 만든 그림으로 체크 페이지만 다시 만듦)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SETS = {
  'mage-redesign': { doc: 'docs/art/MAGE_REDESIGN.md', title: '마법사 콘셉트 후보', size: '1024x1024', background: 'transparent' },
  // 고른 콘셉트(.art-candidates/mage-redesign/<원본>.png)를 넣어 포즈별 그림을 만듭니다.
  'mage-poses': { doc: 'docs/art/MAGE_REDESIGN.md', title: '마법사 포즈 후보', size: '1024x1024', background: 'transparent', sourceDir: '.art-candidates/mage-redesign' }
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const setName = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const set = SETS[setName];
if (!set) {
  console.error(`세트 이름이 필요합니다: ${Object.keys(SETS).join(', ')}`);
  process.exit(1);
}
const OUT = path.join(ROOT, '.art-candidates', setName);

function readApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  if (process.platform === 'win32') {
    try {
      const v = execFileSync('powershell', ['-NoProfile', '-Command',
        "[Environment]::GetEnvironmentVariable('OPENAI_API_KEY','User')"], { encoding: 'utf8' }).trim();
      if (v) return v;
    } catch (e) { /* 아래에서 안내 */ }
  }
  return '';
}

// 문서에서 공통 문장과 후보별 문장을 읽습니다.
function readPrompts() {
  const md = fs.readFileSync(path.join(ROOT, set.doc), 'utf8').replace(/\r\n/g, '\n');
  const common = (md.match(/\*\*공통:\*\*\s*\n+((?:>.*\n?)+)/) || [])[1];
  if (!common) throw new Error(`${set.doc}에서 '**공통:**' 인용문을 찾지 못했습니다.`);
  const base = common.split('\n').map((l) => l.replace(/^>\s?/, '').trim()).filter(Boolean).join(' ');
  const items = {};
  for (const m of md.matchAll(/^\*\*([A-Z]):\*\*\s*(.+)$/gm)) items[m[1]] = `${base} ${m[2].trim()}`;
  if (!Object.keys(items).length) throw new Error(`${set.doc}에서 후보 줄('**A:** ...')을 찾지 못했습니다.`);
  // 고른 그림을 고치는 편집 지시: '**F1 수정:** ...'
  const edits = {};
  for (const m of md.matchAll(/^\*\*([A-Z]\d+) 수정:\*\*\s*(.+)$/gm)) edits[m[1]] = m[2].trim();
  Object.defineProperty(items, 'edits', { value: edits });
  // 포즈 지시: '**포즈 공통:**' 인용문 + '**F8 포즈 release:** ...'
  const poseCommon = (md.match(/\*\*포즈 공통:\*\*\s*\n+((?:>.*\n?)+)/) || [])[1];
  const poseBase = poseCommon ? poseCommon.split('\n').map((l) => l.replace(/^>\s?/, '').trim()).filter(Boolean).join(' ') : '';
  const poses = {};
  for (const m of md.matchAll(/^\*\*([A-Z]\d+) 포즈 ([a-z]+):\*\*\s*(.+)$/gm)) {
    // atlas(여러 포즈를 한 장에)는 한 포즈용 공통 문장을 붙이지 않습니다.
    (poses[m[1]] = poses[m[1]] || {})[m[2]] = m[2] === 'atlas' ? m[3].trim() : `${poseBase} ${m[3].trim()}`.trim();
  }
  Object.defineProperty(items, 'poses', { value: poses });
  return items;
}

// 편집 범위 마스크: 사각형 안은 투명(=고칠 곳), 밖은 불투명(=유지)인 RGBA PNG를 만듭니다.
function makeMaskPng(width, height, [x0, y0, x1, y1]) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x++) {
      const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
      raw[row + 1 + x * 4 + 3] = inside ? 0 : 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8비트 RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

async function generateOne(key, model, quality, prompt, sourceFile, maskRect) {
  let res;
  if (sourceFile) {
    // 편집: 원본 그림을 넣고 지시대로 고칩니다(디자인 유지).
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', prompt);
    form.append('size', set.size);
    form.append('background', set.background);
    form.append('quality', quality);
    form.append('output_format', 'png');
    form.append('n', '1');
    form.append('image', new Blob([fs.readFileSync(sourceFile)], { type: 'image/png' }), path.basename(sourceFile));
    if (maskRect) {
      const [w, h] = set.size.split('x').map(Number);
      form.append('mask', new Blob([makeMaskPng(w, h, maskRect)], { type: 'image/png' }), 'mask.png');
    }
    res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  } else {
    res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size: set.size, background: set.background, quality, output_format: 'png', n: 1 })
    });
  }
  const requestId = res.headers.get('x-request-id') || '';
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status} ${body.error ? body.error.message : ''} (request-id ${requestId})`);
  const b64 = body.data && body.data[0] && body.data[0].b64_json;
  if (!b64) throw new Error(`응답에 그림이 없습니다 (request-id ${requestId})`);
  return { png: Buffer.from(b64, 'base64'), requestId, usage: body.usage || null, revisedPrompt: body.data[0].revised_prompt || null };
}

function writePage(prompts) {
  const files = fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort() : [];
  const notes = {};
  const md = fs.readFileSync(path.join(ROOT, set.doc), 'utf8');
  for (const m of md.matchAll(/^\| ([A-Z]) \| ([^|]+)\|/gm)) notes[m[1]] = m[2].trim();
  const cards = files.map((f) => {
    const k = f[0];
    return `<label class="c"><div class="img"><img src="${f}" alt="${f}"></div>
<div class="sm"><img src="${f}" alt="" style="height:70px"><img src="${f}" alt="" style="height:110px"><span>게임 크기 미리보기</span></div>
${f.startsWith('atlas') ? `<canvas class="anim" data-src="${f}" width="256" height="256" title="대기→준비→발사→반동 반복"></canvas>` : ''}
<div class="t"><input type="checkbox" class="pick" value="${f}">${f.replace('.png', '')}</div><div class="d">${notes[k] || ''}</div></label>`;
  }).join('\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${set.title}</title><style>
:root{--bg:#f4efe6;--card:#fffaf2;--ink:#2b2420;--muted:#7a6e64;--line:#d8cbb8;--accent:#c2462a}
@media (prefers-color-scheme:dark){:root{--bg:#1d1916;--card:#28221e;--ink:#f1e8dc;--muted:#a99c8f;--line:#4a4038;--accent:#e2683f}}
body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,"Malgun Gothic",sans-serif;padding:16px}
h1{font-size:1.3rem;margin:0 0 4px}p{color:var(--muted);margin:0 0 16px;font-size:.9rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
label.c{display:block;background:var(--card);border:2px solid var(--line);border-radius:10px;padding:10px;cursor:pointer}
label.c:has(input:checked){border-color:var(--accent)}
.img{aspect-ratio:1;background:repeating-conic-gradient(#0000 0 25%,#8882 0 50%) 0 0/20px 20px;border-radius:6px;overflow:hidden}
.img img{width:100%;height:100%;object-fit:contain}
.sm{display:flex;gap:10px;align-items:flex-end;margin-top:8px;padding:6px;border-radius:6px;background:#3a3430}.sm span{font-size:.75rem;color:#cbbfb3}
.anim{display:block;margin-top:8px;border-radius:6px}
.t{display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:600}.d{font-size:.85rem;color:var(--muted);margin-top:4px}
</style></head><body><h1>${set.title}</h1>
<p>마음에 드는 후보에 체크하세요(여러 개 가능). 어두운 띠의 작은 그림은 전투 화면 크기에 가깝게 줄인 모습입니다. 프롬프트는 ${set.doc}에 있습니다.</p>
<div class="grid">${cards || '<p>아직 그림이 없습니다.</p>'}</div>
<script>
// 2×2 아틀라스: 대기(좌상)→준비(우상)→발사(좌하)→반동(우하)을 이어 재생해 칸 사이 차이를 확인합니다.
for (const cv of document.querySelectorAll('canvas.anim')) {
  const img = new Image(); img.src = cv.dataset.src;
  const ctx = cv.getContext('2d'); const seq = [0, 0, 0, 1, 2, 3]; let i = 0;
  img.onload = () => setInterval(() => {
    const c = seq[i++ % seq.length], h = img.width / 2;
    ctx.clearRect(0, 0, 256, 256); ctx.fillStyle = '#3a3430'; ctx.fillRect(0, 0, 256, 256);
    ctx.drawImage(img, (c % 2) * h, Math.floor(c / 2) * h, h, h, 0, 0, 256, 256);
  }, 180);
}
</script></body></html>`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`체크 페이지: ${path.join(OUT, 'index.html')} (그림 ${files.length}장)`);
}

async function main() {
  const prompts = readPrompts();
  if (flag('page')) return writePage(prompts);
  if (flag('list-models')) {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${readApiKey()}` } });
    const body = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${body.error ? body.error.message : ''}`);
    console.log(body.data.map((m) => m.id).filter((id) => /image|dall/i.test(id)).sort().join(', ') || '(이미지 모델 없음)');
    return;
  }
  const editFrom = argValue('edit', '');
  if (editFrom && !prompts.edits[editFrom]) throw new Error(`${set.doc}에 '**${editFrom} 수정:**' 문장이 없습니다.`);
  if (editFrom && !fs.existsSync(path.join(OUT, `${editFrom}.png`))) throw new Error(`${editFrom}.png가 없습니다.`);
  const poseFrom = argValue('poses', '');
  if (poseFrom) {
    const table = prompts.poses[poseFrom];
    if (!table) throw new Error(`${set.doc}에 '**${poseFrom} 포즈 ...:**' 문장이 없습니다.`);
    const src = path.join(ROOT, set.sourceDir || path.relative(ROOT, OUT), `${poseFrom}.png`);
    if (!fs.existsSync(src)) throw new Error(`${src}가 없습니다.`);
    const onlyPoses = argValue('only', '').split(',').map((v) => v.trim()).filter(Boolean);
    const count = Math.max(1, Number(argValue('count', 1)) || 1);
    const model = argValue('model', 'gpt-image-1.5');
    const quality = argValue('quality', 'high');
    fs.mkdirSync(OUT, { recursive: true });
    const jobs = [];
    for (const pose of Object.keys(table).filter((k) => !onlyPoses.length || onlyPoses.includes(k))) {
      let n = 1;
      for (let i = 0; i < count; i++) {
        while (fs.existsSync(path.join(OUT, `${pose}-${n}.png`))) n++;
        jobs.push({ pose, file: `${pose}-${n}.png` });
        n++;
      }
    }
    if (flag('dry-run')) { for (const j of jobs) console.log(`${j.file}: ${table[j.pose]}`); return; }
    const key = readApiKey();
    if (!key) { console.error('OPENAI_API_KEY 환경 변수를 찾지 못했습니다.'); process.exit(1); }
    console.log(`${jobs.length}장 생성 시작 (${poseFrom} 포즈, ${model}, ${quality})`);
    let next = 0, failed = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const j = jobs[next++];
        try {
          const r = await generateOne(key, model, quality, table[j.pose], src, null);
          fs.writeFileSync(path.join(OUT, j.file), r.png);
          fs.writeFileSync(path.join(OUT, j.file.replace('.png', '.json')), JSON.stringify({
            file: j.file, pose: j.pose, editedFrom: poseFrom, model, quality, size: set.size, background: set.background,
            createdAt: new Date().toISOString(), requestId: r.requestId, usage: r.usage, prompt: table[j.pose], sourceDoc: set.doc
          }, null, 2));
          console.log(`${j.file} 완료`);
        } catch (e) { failed++; console.error(`${j.file} 실패: ${e.message}`); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
    writePage(prompts);
    if (failed) process.exitCode = 1;
    return;
  }
  const maskRect = argValue('mask', '') ? argValue('mask', '').split(',').map(Number) : null;
  if (maskRect && (maskRect.length !== 4 || maskRect.some((v) => !Number.isFinite(v)))) throw new Error('--mask는 x0,y0,x1,y1 형식입니다.');
  const only = editFrom ? [editFrom[0]] : argValue('only', '').split(',').map((s) => s.trim()).filter(Boolean);
  const keys = Object.keys(prompts).filter((k) => !only.length || only.includes(k));
  const count = Math.max(1, Number(argValue('count', 1)) || 1);
  const model = argValue('model', 'gpt-image-1.5');
  const quality = argValue('quality', 'high');
  const jobs = [];
  fs.mkdirSync(OUT, { recursive: true });
  for (const k of keys) {
    let n = 1;
    for (let i = 0; i < count; i++) {
      while (fs.existsSync(path.join(OUT, `${k}${n}.png`))) n++;
      jobs.push({ k, file: `${k}${n}.png`, from: editFrom || null });
      n++;
    }
  }
  if (flag('dry-run')) {
    for (const j of jobs) console.log(`${j.file}: ${j.from ? `[${j.from} 편집] ${prompts.edits[j.from]}` : prompts[j.k]}`);
    return;
  }
  const key = readApiKey();
  if (!key) { console.error('OPENAI_API_KEY 환경 변수를 찾지 못했습니다.'); process.exit(1); }
  console.log(`${jobs.length}장 생성 시작 (${model}, ${quality}, ${set.size})`);
  // 동시에 4개까지 요청합니다.
  let next = 0;
  let failed = 0;
  async function worker() {
    while (next < jobs.length) {
      const j = jobs[next++];
      const started = Date.now();
      try {
        const prompt = j.from ? prompts.edits[j.from] : prompts[j.k];
        const r = await generateOne(key, model, quality, prompt, j.from ? path.join(OUT, `${j.from}.png`) : null, j.from ? maskRect : null);
        fs.writeFileSync(path.join(OUT, j.file), r.png);
        fs.writeFileSync(path.join(OUT, j.file.replace('.png', '.json')), JSON.stringify({
          file: j.file, candidate: j.k, model, quality, size: set.size, background: set.background,
          createdAt: new Date().toISOString(), requestId: r.requestId, usage: r.usage,
          editedFrom: j.from, mask: j.from ? maskRect : null, prompt, revisedPrompt: r.revisedPrompt, sourceDoc: set.doc
        }, null, 2));
        console.log(`${j.file} 완료 (${((Date.now() - started) / 1000).toFixed(0)}초)`);
      } catch (e) {
        failed++;
        console.error(`${j.file} 실패: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
  writePage(prompts);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
