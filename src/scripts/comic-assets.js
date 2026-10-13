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
 util_power:['stats',3], util_executioner:['stats',4,'crimson'], util_glass_cannon:['stats',1], util_phoenix_reborn:['stats',2]
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
 if(stage<=2){el.style.cssText='';el.style.width=`${baseHeight*growth*1.55}px`;el.style.height=el.style.width;el.style.bottom=`${-baseHeight*growth*1.55*.1252}px`;el.dataset.art='slime';el.dataset.variant=stage===2?'blue':'';if(typeof configurePaperSlime==='function')configurePaperSlime(el,baseHeight*growth*1.55,stage);return;}
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
for (const key of ['fire-elemental','flame-patch','combustion']) {
  if (typeof Image === 'undefined') continue;
  const image = new Image();
  image.src = `assets/art/comic-${key}.png`;
  comicAbilityImages[key] = image;
}
function drawComicAbility(painter,key,x,y,width,height=width) {
  const image = comicAbilityImages[key];
  if (!image || !image.complete || !image.naturalWidth) return;
  if(key === 'flame-patch') {
    // 검은 돌바닥을 화면에 덮지 않고, 기존 소멸 알파를 곱해 반투명한 불빛만 합성한다.
    const ground = y + height * .25;
    const flameHeight = height * .7;
    painter.save();
    const fade = painter.globalAlpha;
    // 얇은 바닥 윤곽은 밝은 배경에서도 활성 영역을 알아볼 수 있게 한다.
    painter.globalAlpha = fade * .22;
    painter.strokeStyle = '#e49b4b';
    painter.lineWidth = 1.5;
    painter.beginPath();
    painter.ellipse(x, ground, width * .44, height * .1, 0, 0, Math.PI * 2);
    painter.stroke();
    painter.globalAlpha = fade * .5;
    painter.globalCompositeOperation = 'screen';
    painter.filter = 'blur(0.45px)';
    painter.drawImage(image, x - width / 2, ground - flameHeight * .75, width, flameHeight);
    painter.restore();
    return;
  }
  painter.drawImage(image,x-width/2,y-height/2,width,height);
}
