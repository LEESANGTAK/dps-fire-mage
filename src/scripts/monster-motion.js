/* 외형·재질별 연출 데이터. 게임의 피해·재생성 시간과 독립적으로 작동합니다.
 * 하이브리드 사망: 생물형(짐승·인간형·갑각·파충류·비행·용·마법사)은 발끝부터 타오르는 'burn',
 * 슬라임(녹아 퍼짐)·해골/돌/갑옷(부서짐)·영체(흩어짐)·화염 정령(꺼짐)은 재질 고유 연출을 유지합니다. */
const monsterMotionProfiles = [
  ['slime', .14, 8, 4.3, 'puddle'], ['slime', .12, 7, 5.1, 'puddle'],
  ['small-beast', .025, 11, 2.9, 'burn'], ['humanoid', .018, 8, 4.7, 'burn'],
  ['beast', .02, 6, 5.9, 'burn'], ['beast', .02, 10, 3.8, 'burn'],
  ['humanoid', .018, 8, 4.1, 'burn'], ['bone', 0, 7, 5.8, 'bones'],
  ['carapace', 0, 5, 3.1, 'burn'], ['heavy', .012, 4, 6.4, 'burn'],
  ['reptile', .015, 6, 4.6, 'burn'], ['flying', .01, 10, 2.7, 'burn'],
  ['stone', 0, 2, 8.2, 'crumble'], ['caster', .012, 7, 5.7, 'burn'],
  ['dragon', .012, 4, 7.1, 'burn'], ['armor', 0, 3, 6.7, 'collapse'],
  ['spirit', 0, 5, 5.4, 'dissolve'], ['carapace', 0, 6, 3.7, 'burn'],
  ['heavy', .012, 4, 6.9, 'burn'], ['fire', 0, 3, 3.2, 'extinguish']
];
// 소각 시간(초). 발끝→정수리까지 눈으로 따라갈 여운을 주되 다음 몬스터 등장을 오래 가리지 않는 범위입니다.
const BURN_DURATION = { normal: .9, boss: 1.3 };
function getMonsterMotionProfile(stage) {
  const [kind, squash, recoil, period, death] = monsterMotionProfiles[stage - 1] || ['spirit', 0, 5, 6.3, 'dissolve'];
  return { kind, squash, recoil, period, death };
}
function configureMonsterMotion(stage) {
  const actor = document.getElementById('dummy-avatar');
  if (!actor) return;
  const p = getMonsterMotionProfile(stage);
  actor.dataset.motion = p.kind;
  if(typeof configureComicMonster === 'function') configureComicMonster(stage);
  actor.style.setProperty('--material-squash', p.squash);
  actor.style.setProperty('--idle-period', `${p.period}s`);
  actor.style.setProperty('--idle-phase', `${-(stage % 5) * .47}s`);
}
function prepareMonsterHit(stage, heavy, direction, dot) {
  const actor = document.getElementById('dummy-avatar');
  if (!actor) return;
  const p = getMonsterMotionProfile(stage);
  if (stage <= 2 && typeof beginPaperSlimeHit === 'function') beginPaperSlimeHit(heavy, direction, dot);
  actor.style.setProperty('--hit-distance', `${p.recoil * (dot ? .18 : heavy ? 1.6 : 1)}px`);
  actor.style.setProperty('--hit-angle', `${(direction ? -1 : 1) * (p.kind === 'stone' ? .5 : heavy ? 5 : 2)}deg`);
  actor.style.setProperty('--hit-duration', `${heavy ? .32 : .22}s`);
  actor.style.setProperty('--hit-squash', String(actor.dataset.paper === 'true' ? 0 : p.kind === 'slime' ? p.squash * (heavy ? 1.25 : 1) : Math.min(.025, p.squash * (heavy ? 1.25 : 1))));
}
// 사망 잔상용 원화 복제. 소각 층(불테두리·그을림)도 같은 윤곽을 써야 하므로 공용으로 분리합니다.
function buildDeathVisual(source, rect, base, death) {
  const ghost = source.cloneNode(false);
  ghost.removeAttribute('id'); ghost.removeAttribute('aria-label'); ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = source.textContent;
  ghost.className = 'material-death'; ghost.dataset.death = death;
  Object.assign(ghost.style, {left:`${rect.left-base.left}px`,top:`${rect.top-base.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,fontSize:getComputedStyle(source).fontSize});
  if (source.dataset.art === 'slime') {
    if (source.dataset.paper === 'true') {
      ghost.textContent = '';
      const surface = source.querySelector('canvas');
      if (surface) {
        const copy = document.createElement('canvas');
        copy.width = surface.width; copy.height = surface.height; copy.className = 'paper-slime-canvas';
        copy.getContext('2d').drawImage(surface, 0, 0); ghost.appendChild(copy);
      }
      ghost.style.background = 'none'; ghost.dataset.death = 'paper-puddle';
    } else ghost.style.backgroundImage = 'url(assets/art/comic-slime.png)';
    ghost.style.filter = source.dataset.variant === 'blue' ? 'hue-rotate(85deg)' : 'none';
    ghost.style.fontSize = '0';
  }
  if (source.dataset.paper === 'true' && source.dataset.art === 'monster') {
    // 사망용 외곽과 원화 윤곽을 분리해 접힘 중 옆 몬스터가 비치지 않도록 합니다.
    const sprite = source.cloneNode(false);
    sprite.removeAttribute('id'); sprite.className = 'paper-death-sprite';
    Object.assign(sprite.style, {position:'static',bottom:'auto',animation:'none',transform:'none'});
    ghost.textContent = ''; ghost.appendChild(sprite);
    ghost.style.background = 'none'; ghost.style.clipPath = 'none';
    ghost.dataset.paper = 'true';
  }
  return ghost;
}
function removeDeathGhost(ghost) {
  ghost.remove();
  (ghost.burnLayers || []).forEach(layer => layer.remove());
}
function spawnMaterialDeath(stage, boss) {
  const arena = document.getElementById('combat-arena');
  const source = document.getElementById('dummy-emoji');
  if (!arena || !source) return;
  const p = getMonsterMotionProfile(stage);
  const rect = source.getBoundingClientRect(), base = arena.getBoundingClientRect();
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const burnDur = boss ? BURN_DURATION.boss : BURN_DURATION.normal;
  // 즉시 재생성되는 다음 몬스터와 별도의 잔상으로 여운을 남깁니다.
  while (arena.querySelectorAll('.material-death').length >= 3) removeDeathGhost(arena.querySelector('.material-death'));
  const ghost = buildDeathVisual(source, rect, base, p.death);
  // 잔상이 연출을 넘겨받는 순간 원본은 숨깁니다. 다음 스테이지 로드 전까지 같은 자리에 멀쩡한 원화가 남아
  // 소각/낙하 잔상과 겹쳐 두 장처럼 보이는 문제를 막습니다(loadStage에서 해제).
  const actor = document.getElementById('dummy-avatar');
  if (actor && actor.dataset) actor.dataset.dead = 'true';
  if (p.death === 'burn') {
    // 아래층부터 불테두리(발광) → 그을림 → 원화 순으로 겹칩니다. 세 층의 마스크 경계가 조금씩 어긋나
    // 타오르는 경계에 실루엣 모양의 불띠와 탄 자국이 생깁니다.
    ghost.style.setProperty('--burn-dur', `${burnDur}s`);
    ghost.burnLayers = [];
    if (!reduced) {
      const glowWrap = document.createElement('div');
      glowWrap.className = 'burn-layer burn-glow-wrap';
      Object.assign(glowWrap.style, {left:ghost.style.left,top:ghost.style.top,width:ghost.style.width,height:ghost.style.height});
      glowWrap.style.setProperty('--burn-dur', `${burnDur}s`);
      const glow = buildDeathVisual(source, rect, base, 'burn');
      glow.className = 'burn-glow'; Object.assign(glow.style, {left:'0px',top:'0px'});
      glowWrap.appendChild(glow);
      const char = buildDeathVisual(source, rect, base, 'burn');
      char.className = 'burn-layer burn-char';
      char.style.setProperty('--burn-dur', `${burnDur}s`);
      for (const layer of [glowWrap, char]) {
        arena.appendChild(layer);
        layer.addEventListener('animationend', () => layer.remove(), {once:true});
        ghost.burnLayers.push(layer);
      }
    }
  }
  arena.appendChild(ghost);
  ghost.addEventListener('animationend', () => removeDeathGhost(ghost), {once:true});
  // 안전 정리 시간도 모달 정지를 존중해 사망 여운이 창 뒤에서 사라지지 않도록 합니다.
  const lifetime = p.death === 'burn' ? burnDur * 1000 + 250 : 1100;
  let elapsed = 0, previous = performance.now();
  function retireGhost() {
    if (ghost.isConnected === false) return;
    const now = performance.now();
    if (!arena.classList || !arena.classList.contains('living-paused')) elapsed += now - previous;
    previous = now;
    if (elapsed >= lifetime) removeDeathGhost(ghost);
    else setTimeout(retireGhost, 100);
  }
  setTimeout(retireGhost, 100);
  if (p.death === 'puddle') {
    const foot = getActorGroundPos('dummy-avatar');
    spawnSlimeSplash(particles, rect.left-base.left+rect.width/2, rect.top-base.top+rect.height/2,
      foot.y, source.dataset.variant === 'blue', true, performance.now()/1000+.1, reduced,
      {x:rect.left-base.left,y:rect.top-base.top,width:rect.width});
  }
  if (reduced) return;
  const available = Math.max(0, 48-particles.filter(pt=>pt.materialDeath).length);
  if (p.death === 'burn') {
    // 불씨는 타오르는 경계 높이에서 순차적으로 피어오릅니다. 음수 life는 방출 대기 시간입니다.
    const count = Math.min(available, boss ? 16 : 10);
    for (let i = 0; i < count; i++) {
      const k = (i + Math.random()) / count; // 발끝(0) → 정수리(1)
      particles.push({
        materialDeath:true, x:rect.left-base.left+rect.width*(.28+Math.random()*.44),
        y:rect.top+rect.height-base.top-rect.height*k, life:-burnDur*(.05+.83*k), maxLife:.4+Math.random()*.3,
        vx:(Math.random()-.5)*50, vy:-70-Math.random()*70, radius:1.6+Math.random()*2.2,
        colorCore:'#fff1b8', colorEdge:Math.random()<.35?'#5b4636':'#ff7a1a'
      });
    }
    return;
  }
  if (['bones','crumble','collapse','extinguish','dissolve'].includes(p.death)) {
    const rigid = ['bones','crumble','collapse'].includes(p.death);
    for(let i=0;i<Math.min(available,boss?16:9);i++) particles.push({
      materialDeath:true, materialChip:rigid, x:rect.left-base.left+rect.width*(.25+Math.random()*.5),
      y:rect.top-base.top+rect.height*(.3+Math.random()*.5),
      vx:(Math.random()-.5)*120, vy:rigid?-50-Math.random()*80:-40-Math.random()*70,
      radius:rigid?3+Math.random()*4:2+Math.random()*3, life:0,maxLife:.35+Math.random()*.25,
      colorCore:p.kind==='bone'?'#ede2bb':p.kind==='stone'?'#9b8a76':p.kind==='armor'?'#afbbc5':p.kind==='fire'?'#ffcd65':'#b490df',
      colorEdge:p.kind==='fire'?'#e87625':rigid?'#675e59':'#725095'
    });
  }
}
if(typeof module !== 'undefined') module.exports = {getMonsterMotionProfile,monsterMotionProfiles,BURN_DURATION};
