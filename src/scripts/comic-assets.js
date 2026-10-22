/* UI의 장식 이모지를 이미지 아이콘으로 바꾸되 버튼의 텍스트와 동작은 유지합니다. */
const comicIconMap = {
 '🪄':0,'💍':1,'🧤':2,'🔮':3,'🔱':4,'⏳':5,'👑':6,'🏆':7,'📜':8,'📖':8,'🤖':8,'💰':9,'🪙':9,'💎':10,'👁️':11,'✨':11,'🦅':12,'🗿':13,'⚡':14,'☄️':'meteor',
 '🔥':'s0','💥':'s1','🌋':'s2','☀️':'combustion','🩸':'s0','🟠':'s0','🔵':10,'🧞':'fire-elemental','♨️':'flame-patch'
};
const comicVectorMap = {
 '🛒':'M5 8h14l-1 12H6z M8 8V5h8v3',
 '🌳':'M12 4v16 M5 9h14 M5 9V5 M19 9V5 M5 17h14 M5 17v3 M19 17v3',
 '🛠️':'M5 4l15 15 M4 20L20 4 M3 3l5 1-4 4z',
 '🔒':'M6 10h12v11H6z M8 10V6a4 4 0 018 0v4',
 '🔓':'M6 10h12v11H6z M9 10V6a4 4 0 018 0',
 '🗑️':'M5 7h14 M8 7V4h8v3 M6 7l1 14h10l1-14 M10 10v8 M14 10v8',
 '🔊':'M4 9h4l5-4v14l-5-4H4z M17 8q5 4 0 8',
 '🔇':'M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6',
 '⚔️':'M4 3l17 18 M20 3L3 20 M3 3h4 M20 3h-4 M3 16l5 5 M16 17l5-5',
 '🎯':'M12 3a9 9 0 100 18a9 9 0 000-18 M12 7a5 5 0 100 10a5 5 0 000-10 M12 10v4',
 '🔔':'M6 17V9a6 6 0 0112 0v8 M4 17h16 M10 21h4',
 '🌟':'M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z',
 '🧙':'M3 18l9-15 7 15 M3 18h18 M7 20h10'
};
const comicTokens = Object.keys({...comicIconMap,...comicVectorMap}).sort((a,b)=>b.length-a.length);
const comicTokenPattern = new RegExp(comicTokens.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
function comicIconHTML(token) {
 const dedicated = comicIconMap[token];
 if(['fire-elemental','flame-patch','combustion','meteor'].includes(dedicated)) return `<span class="comic-icon" data-sheet="${dedicated}" aria-hidden="true"></span>`;
 if(comicVectorMap[token]) return `<svg class="comic-vector" viewBox="0 0 24 24" aria-hidden="true"><path d="${comicVectorMap[token]}"/></svg>`;
 const key=comicIconMap[token];if(key===undefined)return token;
 const spell=typeof key==='string';const index=spell?Number(key.slice(1)):key;const cols=spell?2:4;
 return `<span class="comic-icon" aria-hidden="true" data-sheet="${spell?'spell':'equipment'}" style="background-position:${index%cols/(cols-1)*100}% ${Math.floor(index/cols)/(cols-1)*100}%"></span>`;
}
// 각성 카드 아이콘: 시스템 이모지 대신 종이 원화 아이콘 시트(3×2)를 카드 ID로 고릅니다.
// 카드 데이터(엑셀·JSON)의 icon 이모지는 그대로 두고, 화면에서만 종이 아이콘으로 바꿔 그립니다.
// tone은 같은 원화를 쓰는 카드끼리 대가형·전설 등을 색으로 구분합니다.
const PAPER_CARD_ICONS = {
 rapid_spark:['stats',5], rapid_split:['skills',0], rapid_overload:['stats',5,'cursed'], rapid_quickdraw:['skills',0,'charge'], rapid_gatling:['skills',0,'blaze'],
 spell_fireblast:['skills',1], crit_focus:['stats',4], crit_heat:['skills',1,'blaze'], crit_reckless:['stats',4,'cursed'],
 spell_meteor:['skills',2], crit_meteor_storm:['skills',2,'blaze'], crit_meteor_charge:['skills',2,'charge'], crit_ember_verdict:['skills',0,'ruby'],
 spell_combustion:['skills',3], crit_crimson_frenzy:['skills',3,'ruby'],
 sum_spirit:['skills',5], sum_fury:['skills',5,'blaze'], sum_volley:['skills',5,'charge'], sum_pact:['skills',5,'cursed'], sum_cinder_lord:['skills',5,'crimson'],
 burn_ignite:['stats',2,'blaze'], spell_flame_patch:['skills',4], burn_spread:['skills',4,'charge'], burn_wildfire:['skills',4,'crimson'],
 util_power:['stats',3], util_executioner:['stats',4,'crimson'], util_glass_cannon:['stats',1], util_phoenix_reborn:['stats',2], util_auto_grimoire:['stats',3,'blaze']
};
function paperCardIconHTML(card) {
 const entry = card && PAPER_CARD_ICONS[card.id];
 if(!entry) return (card && card.icon) || '🃏';
 const [sheet,index,tone] = entry;
 return `<span class="paper-card-icon" data-sheet="${sheet}"${tone?` data-tone="${tone}"`:''} style="background-position:${index%3*50}% ${Math.floor(index/3)*100}%" aria-hidden="true"></span>`;
}
function decorateComicUI(root) {
 if(!root || (root.nodeType!==1 && root.nodeType!==3))return;
 if(root.nodeType===1 && root.closest('script,style,canvas,.dummy-emoji,.material-death,.comic-icon,.comic-vector,.skill-icon'))return;
 const nodes=[];if(root.nodeType===3)nodes.push(root);else{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(w.nextNode())nodes.push(w.currentNode);}
 for(const node of nodes){if(!node.parentElement || node.parentElement.closest('script,style,canvas,.dummy-emoji,.material-death,.comic-icon,.comic-vector,.skill-icon'))continue;
  const text=node.nodeValue;comicTokenPattern.lastIndex=0;if(!comicTokenPattern.test(text))continue;
  comicTokenPattern.lastIndex=0;const fragment=document.createDocumentFragment();let cursor=0;
  for(const match of text.matchAll(comicTokenPattern)){fragment.append(text.slice(cursor,match.index));const host=document.createElement('span');host.innerHTML=comicIconHTML(match[0]);fragment.append(...host.childNodes);cursor=match.index+match[0].length;}fragment.append(text.slice(cursor));node.replaceWith(fragment);
 }
}
const comicEquipment = typeof Image!=='undefined'?new Image():null;
if(comicEquipment)comicEquipment.src='assets/art/comic-equipment-atlas.png';
function drawComicSummon(painter,index,x,y,size){
 if(!comicEquipment || !comicEquipment.complete || !comicEquipment.naturalWidth)return;
 const cell=comicEquipment.naturalWidth/4;
 painter.drawImage(comicEquipment,index%4*cell,Math.floor(index/4)*cell,cell,cell,x-size/2,y-size/2,size,size);
}
// 일반 몬스터는 단계별로 성장하고 보스는 별도의 큰 실루엣을 사용한다.
function getComicMonsterGrowth(stage) {
 if(stage<=2)return stage===1?.62:.72;
 return stage%5===0?Math.min(2.8,1.4+stage*.07):Math.min(2.05,.82+stage*.052);
}
function configureComicMonster(stage){
 const el=document.getElementById('dummy-emoji');if(!el)return;
 const avatar=document.getElementById('dummy-avatar');
 // 공통 접지 틀은 유지하고 원화만 단계와 보스 여부에 맞춰 확대합니다.
 const baseHeight=avatar?avatar.clientHeight:126;
 const growth=getComicMonsterGrowth(stage);
 const stageBox=document.getElementById('target-stage-box');
 if(stageBox && stageBox.dataset)stageBox.dataset.monsterSize=stage>2 && stage%5===0?'boss':'normal';
 el.dataset.monsterStage=String(stage);
 // 화상 불꽃(.burn-status)이 원화 크기에 맞춰 몸에 붙도록 실제 원화 폭·높이를 넘깁니다.
 const setArtBox=(w,h)=>{if(avatar && avatar.style && avatar.style.setProperty){avatar.style.setProperty('--art-w',`${w}px`);avatar.style.setProperty('--art-h',`${h}px`);}};
 if(stage<=2){const s=baseHeight*growth*1.55;setArtBox(s*.6,s*.62);el.style.cssText='';el.style.width=`${baseHeight*growth*1.55}px`;el.style.height=el.style.width;el.style.bottom=`${-baseHeight*growth*1.55*.1252}px`;el.dataset.art='slime';el.dataset.variant=stage===2?'blue':'';if(typeof configurePaperSlime==='function')configurePaperSlime(el,baseHeight*growth*1.55,stage);return;}
 el.dataset.paper='true';if(avatar && avatar.dataset)avatar.dataset.paper='true';
 if(typeof paperSlimeMotion!=='undefined')paperSlimeMotion.stage=0;
 if(el.replaceChildren)el.replaceChildren();
 const frame=typeof getPaperMonsterFrame==='function'?getPaperMonsterFrame(stage):COMIC_MONSTER_FRAMES[Math.min(stage-3,stage%5===0?19:18)];if(!frame)return;
 el.textContent='';el.dataset.art='monster';el.dataset.variant='';el.style.bottom='0px';
 const arena=document.getElementById('combat-arena');
 const roomHeight=arena && arena.clientHeight>=300?arena.clientHeight*.52:Infinity;
 const roomWidth=arena && arena.clientWidth>=300?arena.clientWidth*(arena.clientWidth<=480?.5:.48):Infinity;
 const height=Math.min(baseHeight*growth,roomHeight,roomWidth*frame.h/frame.w);
 if(stageBox && stageBox.style && stageBox.style.setProperty)stageBox.style.setProperty('--monster-half-width',`${height*frame.w/frame.h/2}px`);
 const scale=height/frame.h;
 setArtBox(frame.w*scale,height);
 el.style.clipPath=frame.clip;el.style.width=`${frame.w*scale}px`;el.style.height=`${height}px`;
 el.style.backgroundImage=`url('${frame.sheet || 'assets/art/comic-monsters-clean.png'}')`;
 el.style.backgroundSize=`${(frame.size || COMIC_MONSTER_SIZE)[0]*scale}px ${(frame.size || COMIC_MONSTER_SIZE)[1]*scale}px`;
 el.style.backgroundPosition=`${-frame.x*scale}px ${-frame.y*scale}px`;
 // 최종 보스의 불의 심장: 원화와 함께 피격 반동을 받도록 원화 요소 안에 둡니다.
 if(frame.core && document.createElement){const core=document.createElement('span');core.className='boss-heart-core';core.setAttribute('aria-hidden','true');core.style.left=`${frame.core.x*100}%`;core.style.top=`${frame.core.y*100}%`;el.appendChild(core);}
}
if(typeof window!=='undefined')window.addEventListener('resize',()=>{const el=document.getElementById('dummy-emoji');if(el && el.dataset.monsterStage)configureComicMonster(Number(el.dataset.monsterStage));});
if(typeof document!=='undefined'){
 document.addEventListener('DOMContentLoaded',()=>{
 decorateComicUI(document.body);
 const observer=new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')decorateComicUI(record.target);else for(const node of record.addedNodes)decorateComicUI(node);}});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true});
 });
}

const comicAbilityImages = {};
for (const key of ['fire-elemental','combustion']) {
  if (typeof Image === 'undefined') continue;
  const image = new Image();
  image.src = `assets/art/comic-${key}.png`;
  comicAbilityImages[key] = image;
}
function drawComicAbility(painter,key,x,y,width,height=width) {
  const image = comicAbilityImages[key];
  if (!image || !image.complete || !image.naturalWidth) return;
  painter.drawImage(image,x-width/2,y-height/2,width,height);
}

/* 불장판: 몬스터 발밑 바닥이 붉게 달아올라 갈라지는 균열(프랙탈 가지) 무늬.
 * 위에서 내려다본 단위 원판 좌표로 균열 나무를 한 번만 만들고(고정 시드: 프레임마다 떨리지 않음),
 * 그리는 순간 바닥 원근(세로 GROUND_TILT배)으로 눕힙니다. 앞쪽(화면 아래)은 굵게, 뒤쪽은 가늘게.
 * 시전 직후 중심에서 바깥으로 0.35초 동안 금이 번져 나가고, 이후 열기가 중심→바깥으로 맥동합니다. */
// 전장 바닥 눕힘 비율(세로/가로). 바닥에 깔리는 모든 원·무늬(불장판·메테오 예고 원·바닥 충격파)가 같은 값을 써야 투시가 맞습니다.
// 자동 시전 마법진(CSS scale(1, .28))과 거의 같은 바닥면입니다.
const GROUND_TILT = .32;
const FLAME_PATCH_GROW = .35; // 균열이 끝까지 번지는 시간(초)
let flamePatchCracks = null;

function buildFlamePatchCracks(seed = 7) {
  let s = seed >>> 0 || 1;
  const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const segs = [];
  const joints = []; // 이웃 가지끼리 잇는 짧은 균열(그물·셀 모양)의 후보 마디
  // 가지 하나: 곧게 뻗다가 날카롭게 꺾이는 갈지자 균열. 일정 확률로 옆 가지를 칩니다(세대가 내려갈수록 가늘고 짧게).
  const grow = (x, y, angle, len, width, dist, gen, trunk) => {
    const heading = angle;
    for (let step = 0; step < 14 && len > .03; step++) {
      const stride = .07 + rand() * .07;
      // 원래 방향을 기억해 크게 휘지 않고, 마디마다 좌우로 날카롭게 꺾습니다.
      angle = heading + (rand() - .5) * 1.1 + (step % 2 ? .22 : -.22);
      const nx = x + Math.cos(angle) * stride, ny = y + Math.sin(angle) * stride;
      if (nx * nx + ny * ny > 1) break;
      segs.push({ x1: x, y1: y, x2: nx, y2: ny, w: width, d: dist, gen });
      x = nx; y = ny; dist += stride; len -= stride; width *= .88;
      if (gen > 0 || step > 1) joints.push({ x, y, d: dist, w: width, trunk });
      if (gen < 2 && rand() < .26) grow(x, y, heading + (rand() < .5 ? -1 : 1) * (.7 + rand() * .5), len * .6, width * .7, dist, gen + 1, trunk);
    }
  };
  const trunks = 7;
  for (let i = 0; i < trunks; i++) grow(0, 0, (i / trunks) * Math.PI * 2 + rand() * .5, .9 + rand() * .2, 1, 0, 0, i);
  // 다른 가지의 가까운 마디를 꺾인 두 마디로 이어 갈라진 바닥의 그물 무늬를 만듭니다.
  for (let i = 0; i < joints.length; i++) {
    const a = joints[i];
    if (rand() > .35) continue;
    let best = null, bestDist = .3;
    for (const b of joints) {
      if (b.trunk === a.trunk) continue;
      const dd = Math.hypot(a.x - b.x, a.y - b.y);
      if (dd < bestDist && dd > .06) { best = b; bestDist = dd; }
    }
    if (!best) continue;
    const mx = (a.x + best.x) / 2 + (rand() - .5) * bestDist * .5, my = (a.y + best.y) / 2 + (rand() - .5) * bestDist * .5;
    const w = Math.min(a.w, best.w) * .7, d = Math.min(a.d, best.d) + .02;
    segs.push({ x1: a.x, y1: a.y, x2: mx, y2: my, w, d, gen: 3 }, { x1: mx, y1: my, x2: best.x, y2: best.y, w, d: d + .05, gen: 3 });
  }
  return segs;
}

function getFlamePatchCracks() {
  if (!flamePatchCracks) flamePatchCracks = buildFlamePatchCracks();
  return flamePatchCracks;
}

// 균열 위의 한 점(불티가 피어오를 자리)을 화면 좌표로 돌려줍니다.
function flamePatchEmberPoint(x, groundY, width, r = Math.random()) {
  const segs = getFlamePatchCracks();
  const seg = segs[Math.floor(r * segs.length) % segs.length];
  const rx = width / 2;
  return { x: x + seg.x2 * rx, y: groundY + seg.y2 * rx * GROUND_TILT };
}

function drawFlamePatchCracks(painter, x, groundY, width, time, age = 99, reduced = false) {
  const rx = width / 2, ry = rx * GROUND_TILT;
  const fade = painter.globalAlpha;
  painter.save();
  // 1. 달아오른 바닥: 바닥에 눕힌 원형 그을음(중심은 검붉게, 가장자리는 바닥에 녹아듦)
  painter.save();
  painter.translate(x, groundY);
  painter.scale(1, GROUND_TILT);
  const heat = painter.createRadialGradient(0, 0, 0, 0, 0, rx);
  heat.addColorStop(0, '#6a1006b3');
  heat.addColorStop(.55, '#3a0a0573');
  heat.addColorStop(1, '#2a080400');
  painter.fillStyle = heat;
  painter.beginPath();
  painter.arc(0, 0, rx, 0, Math.PI * 2);
  painter.fill();
  painter.restore();
  // 2. 균열: 바깥 열기(넓고 옅게) → 붉은 몸통 → 노란 심지 순서로 겹칩니다.
  const reach = reduced ? 9 : Math.min(9, (age / FLAME_PATCH_GROW) * 1.25);
  const unit = width / 230;
  painter.lineCap = 'round';
  painter.lineJoin = 'round';
  const passes = [[3.6, '#e0260f', .22], [1.6, '#f0461c', .95], [.55, '#ffcf5a', 1]];
  for (const [mult, color, alpha] of passes) {
    painter.strokeStyle = color;
    for (const seg of getFlamePatchCracks()) {
      if (seg.d > reach) continue;
      const t = Math.min(1, (reach - seg.d) / .08); // 번지는 끝은 선분 일부만
      const sx = seg.x1, sy = seg.y1;
      const ex = sx + (seg.x2 - sx) * t, ey = sy + (seg.y2 - sy) * t;
      const radial = Math.min(1, Math.hypot(ex, ey));
      const near = .78 + .3 * ((ey + 1) / 2); // 화면 아래(가까운 쪽)일수록 굵게
      const pulse = reduced ? .85 : .62 + .38 * Math.sin(time * 5 - seg.d * 7);
      painter.globalAlpha = fade * alpha * (1 - radial * radial * .55) * (mult < 1 ? pulse : .7 + .3 * pulse);
      painter.lineWidth = Math.max(.6, 4.2 * unit * seg.w * near * mult);
      painter.beginPath();
      painter.moveTo(x + sx * rx, groundY + sy * ry);
      painter.lineTo(x + ex * rx, groundY + ey * ry);
      painter.stroke();
    }
  }
  painter.restore();
}
