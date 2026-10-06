/* 외형·재질별 연출 데이터. 게임의 피해·재생성 시간과 독립적으로 작동합니다. */
const monsterMotionProfiles = [
  ['slime', .14, 8, 4.3, 'puddle'], ['slime', .12, 7, 5.1, 'puddle'],
  ['small-beast', .025, 11, 2.9, 'fall'], ['humanoid', .018, 8, 4.7, 'fall'],
  ['beast', .02, 6, 5.9, 'fall'], ['beast', .02, 10, 3.8, 'fall'],
  ['humanoid', .018, 8, 4.1, 'fall'], ['bone', 0, 7, 5.8, 'bones'],
  ['carapace', 0, 5, 3.1, 'curl'], ['heavy', .012, 4, 6.4, 'fall'],
  ['reptile', .015, 6, 4.6, 'curl'], ['flying', .01, 10, 2.7, 'drop'],
  ['stone', 0, 2, 8.2, 'crumble'], ['caster', .012, 7, 5.7, 'dissolve'],
  ['dragon', .012, 4, 7.1, 'drop'], ['armor', 0, 3, 6.7, 'collapse'],
  ['spirit', 0, 5, 5.4, 'dissolve'], ['carapace', 0, 6, 3.7, 'curl'],
  ['heavy', .012, 4, 6.9, 'dissolve'], ['fire', 0, 3, 3.2, 'extinguish']
];
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
function spawnMaterialDeath(stage, boss) {
  const arena = document.getElementById('combat-arena');
  const source = document.getElementById('dummy-emoji');
  if (!arena || !source) return;
  const p = getMonsterMotionProfile(stage);
  const rect = source.getBoundingClientRect(), base = arena.getBoundingClientRect();
  // 즉시 재생성되는 다음 몬스터와 별도의 잔상으로 여운을 남깁니다.
  while (arena.querySelectorAll('.material-death').length >= 3) arena.querySelector('.material-death').remove();
  const ghost = source.cloneNode(false);
  ghost.removeAttribute('id'); ghost.removeAttribute('aria-label'); ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = source.textContent;
  ghost.className = 'material-death'; ghost.dataset.death = p.death;
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
  arena.appendChild(ghost);
  ghost.addEventListener('animationend', () => ghost.remove(), {once:true});
  // 안전 정리 시간도 모달 정지를 존중해 사망 여운이 창 뒤에서 사라지지 않도록 합니다.
  let elapsed = 0, previous = performance.now();
  function retireGhost() {
    if (ghost.isConnected === false) return;
    const now = performance.now();
    if (!arena.classList || !arena.classList.contains('living-paused')) elapsed += now - previous;
    previous = now;
    if (elapsed >= 1100) ghost.remove();
    else setTimeout(retireGhost, 100);
  }
  setTimeout(retireGhost, 100);
  if (p.death === 'puddle') {
    const foot = getActorGroundPos('dummy-avatar');
    spawnSlimeSplash(particles, rect.left-base.left+rect.width/2, rect.top-base.top+rect.height/2,
      foot.y, source.dataset.variant === 'blue', true, performance.now()/1000+.1, typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
      {x:rect.left-base.left,y:rect.top-base.top,width:rect.width});
  }
  if (['bones','crumble','collapse','extinguish','dissolve'].includes(p.death)) {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const rigid = ['bones','crumble','collapse'].includes(p.death);
    const available = Math.max(0, 48-particles.filter(pt=>pt.materialDeath).length);
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
if(typeof module !== 'undefined') module.exports = {getMonsterMotionProfile,monsterMotionProfiles};
