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
 spell_meteor:['skills',2], crit_meteor_storm:['skills',2,'blaze'], crit_meteor_charge:['skills',2,'charge'],
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

/* 불장판: 화상 불꽃(.paper-flame)과 같은 '오려 붙인 종이 불꽃'을 그을린 종이 바닥 위에 세웁니다.
 * 납작한 3색 종이(주황·진홍 밑단·노랑 속불), 크림색 오림 테두리, 3포즈를 끊어 바꾸는 종이 인형식 일렁임.
 * 빛 번짐(블러·화면 합성) 없이 호출자의 소멸 알파만 곱합니다. */
const PAPER_FLAME_SHAPE = [[.5,0],[.62,.22],[.74,.1],[.77,.38],[.92,.28],[.97,.62],[.87,.87],[.66,1],[.34,1],[.13,.87],[.03,.62],[.09,.34],[.24,.45],[.27,.16],[.4,.3]];
const PAPER_FLAME_BAND = [[0,.7],[.3,.62],[.5,.74],[.72,.6],[1,.7],[1,1],[0,1]];
const PAPER_FLAME_CORE = [[.5,.3],[.6,.52],[.7,.45],[.73,.72],[.63,.92],[.37,.92],[.27,.72],[.31,.49],[.42,.56]];
const PAPER_FLAME_POSES = [[1,1,0],[.9,1.12,-.1],[1.07,.9,.09]]; // [가로, 세로, 기울기] — CSS paper-flame-flick과 같은 3포즈
// 바닥 위 불꽃 배치(타원 가로 반지름 대비 x, 앞뒤 줄, 크기, 일렁임 위상). 가운데는 몬스터가 서 있어 양옆을 키웁니다.
const FLAME_PATCH_TONGUES = [
  [-.78, 0, .62, .1], [-.38, 0, .74, .55], [.12, 0, .66, .3], [.6, 0, .78, .8],
  [-.6, 1, .92, .65], [-.12, 1, .7, .2], [.36, 1, .84, .9], [.84, 1, .64, .45]
];
// 그을린 종이 바닥의 오린 가장자리(고정 요철: 프레임마다 떨리지 않게)
const FLAME_PATCH_EDGE = [1, .9, 1.04, .94, 1, .86, .98, 1.05, .92, 1, .9, 1.03, .95, .88, 1.02, .97];

function tracePaperShape(painter, points, x, y, w, h) {
  painter.beginPath();
  points.forEach(([px, py], i) => {
    const sx = x + (px - .5) * w, sy = y - (1 - py) * h;
    if (i === 0) painter.moveTo(sx, sy); else painter.lineTo(sx, sy);
  });
  painter.closePath();
}

function drawPaperFlame(painter, x, groundY, height, pose) {
  const [sx, sy, skew] = PAPER_FLAME_POSES[pose];
  const w = height * .74 * sx, h = height * sy;
  painter.save();
  painter.translate(x, groundY);
  painter.transform(1, 0, skew, 1, 0, 0);
  // 오린 종이의 크림색 테두리와 아래로 떨어지는 짧은 그림자
  painter.fillStyle = '#0000006b';
  tracePaperShape(painter, PAPER_FLAME_SHAPE, 1.5, 2, w, h); painter.fill();
  painter.lineJoin = 'round';
  painter.lineWidth = 2.2;
  painter.strokeStyle = '#fff0c5';
  tracePaperShape(painter, PAPER_FLAME_SHAPE, 0, 0, w, h); painter.stroke();
  painter.fillStyle = '#f26a1b'; painter.fill();
  painter.save();
  painter.clip();
  painter.fillStyle = '#c8321b';
  tracePaperShape(painter, PAPER_FLAME_BAND, 0, 0, w, h); painter.fill();
  painter.restore();
  painter.fillStyle = '#ffd36b';
  tracePaperShape(painter, PAPER_FLAME_CORE, 0, 0, w, h); painter.fill();
  painter.restore();
}

function drawPaperFlamePatch(painter, x, groundY, width, time, reduced = false) {
  const rx = width * .46, ry = width * .1;
  painter.save();
  // 1. 그을린 종이 바닥: 가장자리를 오린 짙은 갈색 종이 + 안쪽 잉걸 종이, 크림색 오림선
  painter.beginPath();
  FLAME_PATCH_EDGE.forEach((k, i) => {
    const a = (i / FLAME_PATCH_EDGE.length) * Math.PI * 2;
    const px = x + Math.cos(a) * rx * k, py = groundY + Math.sin(a) * ry * k;
    if (i === 0) painter.moveTo(px, py); else painter.lineTo(px, py);
  });
  painter.closePath();
  painter.fillStyle = '#2a1712cc';
  painter.fill();
  painter.lineWidth = 1.5;
  painter.strokeStyle = '#fff0c599';
  painter.stroke();
  painter.beginPath();
  painter.ellipse(x, groundY, rx * .62, ry * .55, 0, 0, Math.PI * 2);
  painter.fillStyle = '#9a2d14bb';
  painter.fill();
  // 2. 종이 불꽃: 뒷줄(작고 높게) → 앞줄 순서로 세우고, 0.5초마다 포즈를 끊어 바꿉니다.
  const step = reduced ? 0 : Math.floor(time * 2);
  const base = Math.min(56, width * .24);
  for (const [ox, row, size, phase] of FLAME_PATCH_TONGUES) {
    const pose = reduced ? 0 : (step + Math.round(phase * 3)) % 3;
    const fy = groundY + (row === 0 ? -ry * .45 : ry * .35);
    drawPaperFlame(painter, x + ox * rx, fy, base * size * (row === 0 ? .82 : 1), pose);
  }
  painter.restore();
}
