/* 배경음(mp3) 음량 측정. 효과음 측정(measure-sfx-loudness.cjs)과 같은 K-가중으로 재고, 곡 전체 적분 음량(BS.1770 게이트)도 냅니다.
 * mp3 디코드에 Chromium이 필요해 Electron으로 실행합니다:
 *   npx electron scripts/measure-bgm-loudness.cjs
 * 효과음 믹스 표(sound-mixer.js)는 이 값(곡 평균 약 -16.5 LUFS, 기본 BGM 20%면 약 -30.5)을 기준으로 맞췄습니다.
 * 배경음을 바꾸면 다시 재서 docs/design-decisions.md의 믹싱 항목과 비교하세요. */
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const dir = require('node:path').join(__dirname, '..', 'assets', 'sounds', 'bgm');

const pageCode = `
(async (files) => {
  function biquad(x, [b0,b1,b2], [,a1,a2]) { const y=new Float64Array(x.length); let x1=0,x2=0,y1=0,y2=0;
    for (let i=0;i<x.length;i++){const v=b0*x[i]+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=x[i];y2=y1;y1=v;y[i]=v;} return y; }
  const lufs = (ms) => -0.691 + 10*Math.log10(Math.max(ms,1e-12));
  const out = {};
  for (const f of files) {
    const buf = await (await fetch(f.url)).arrayBuffer();
    const ctx = new OfflineAudioContext(2, 48000, 48000);
    const ab = await ctx.decodeAudioData(buf);
    const n = ab.length, ch = ab.numberOfChannels;
    const mono = new Float64Array(n);
    for (let c=0;c<ch;c++){const d=ab.getChannelData(c); for(let i=0;i<n;i++) mono[i]+=d[i]/ch;}
    const k = biquad(biquad(mono,[1.53512485958697,-2.69169618940638,1.19839281085285],[1,-1.69065929318241,0.73248077421585]),[1,-2,1],[1,-1.99004745483398,0.99007225036621]);
    const sq = new Float64Array(n+1); for (let i=0;i<n;i++) sq[i+1]=sq[i]+k[i]*k[i];
    const win=(w,h)=>{const W=Math.round(48000*w),H=Math.round(48000*h),r=[];for(let s=0;s+W<=n;s+=H) r.push((sq[s+W]-sq[s])/W);return r;};
    // 적분 음량: 400ms 블록, 75% 겹침, 절대 -70 / 상대 -10 게이트
    const blocks = win(0.4,0.1);
    let g = blocks.filter(b=>lufs(b)>-70); const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
    const rel = lufs(avg(g))-10; g = g.filter(b=>lufs(b)>rel);
    const st = win(3,0.1).map(lufs).sort((a,b)=>a-b);
    const m100 = win(0.1,0.01).map(lufs).sort((a,b)=>a-b);
    const pct=(a,p)=>a[Math.min(a.length-1,Math.floor(a.length*p))];
    let peak=0; for(let c=0;c<ch;c++){const d=ab.getChannelData(c); for(let i=0;i<n;i++) peak=Math.max(peak,Math.abs(d[i]));}
    out[f.name] = { integrated:+lufs(avg(g)).toFixed(1), mean:+lufs(sq[n]/n).toFixed(1), shortTerm3sMax:+st[st.length-1].toFixed(1), shortTerm3sP50:+pct(st,0.5).toFixed(1), m100max:+m100[m100.length-1].toFixed(1), m100p95:+pct(m100,0.95).toFixed(1), peak:+(20*Math.log10(peak)).toFixed(1), seconds:+(n/48000).toFixed(0) };
  }
  return out;
})`;

app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } });
  await w.loadURL('about:blank');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => ({ name: f, url: 'file:///' + path.join(dir, f).replace(/\\/g, '/') }));
  try {
    const r = await w.webContents.executeJavaScript(pageCode + '(' + JSON.stringify(files) + ')');
    console.log(JSON.stringify(r, null, 1));
  } catch (e) { console.error('ERR', e); }
  app.quit();
});
