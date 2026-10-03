/* 스킬 설명은 현재 장비·숙련·특성을 반영하고 전투 판정은 변경하지 않습니다. */
function buildSkillDetails(skill, stats, combat, tree, mastery = 1, duration = 2) {
  const seconds = n => `${Number(n.toFixed(2))}초`;
  const damage = (mult, crit = false) => Math.max(1, Math.round(stats.sp * mult * mastery * (crit ? stats.critDmg : 1)));
  const hit = mult => `일반 ${damage(mult).toLocaleString('ko-KR')} · 치명타 ${damage(mult, true).toLocaleString('ko-KR')}`;
  const gcd = seconds(Math.max(.5, 1.2 / stats.speedMult));
  const definitions = {
    fireball: { name:'화염구', cast:seconds(Math.max(.4,1.5/stats.speedMult)), cooldown:`없음 · 공통 대기 ${gcd}`, damage:hit(1), feature:'치명타를 연속으로 적중시켜 몰아치는 열기를 준비합니다. 피해량은 주 탄환 1발 기준입니다.' },
    fireblast: { name:'불꽃 작렬', cast:'즉시 · 시전 중 사용 가능', cooldown:`1회 충전 ${seconds(Math.max(3.5,9*(1-stats.cdr)/stats.speedMult))}`, damage:`확정 치명타 ${damage(.85,true).toLocaleString('ko-KR')}`, feature:`항상 치명타로 적중합니다. 버튼 숫자는 남은 충전 횟수입니다 (${combat.fbCharges}/${combat.fbMaxCharges}). 충전은 한 번에 1회씩 회복됩니다.` },
    pyroblast: { name:'거대 화염구', cast:combat.critStreak===2?'즉시 · 몰아치는 열기 활성':`${seconds(Math.max(.7,2.5/stats.speedMult))} · 몰열 시 즉시`, cooldown:`없음 · 일반 시전 공통 대기 ${gcd}`, damage:hit(1.75), feature:'2연속 치명타로 몰아치는 열기가 켜지면 즉시 발사하며 소환물의 동시 공격을 유도합니다. 일반 시전은 진행 중인 화염구를 교체합니다. 피해량은 주 탄환 1발 기준입니다.' },
    combustion: { name:'마력 폭주', cast:'즉시', cooldown:seconds(Math.max(14,30*(1-stats.cdr))), damage:'직접 피해 없음', feature:`${seconds(duration)} 동안 치명타 확률 100%와 가속 +20%를 얻습니다. 현재 장비와 숙련에 따라 지속시간이 증가합니다.` },
    meteor: { name:'메테오', cast:'즉시 · 낙하 1초 후 적중', cooldown:seconds(Math.max(8,18*(1-stats.cdr))), damage:hit(3.2), feature:`적중 후 6초간 연소합니다. 0.85초마다 일반 ${damage(.35).toLocaleString('ko-KR')}의 추가 피해를 줍니다.` },
    flame_patch: { name:'불장판', cast:'즉시', cooldown:seconds(Math.max(4.5,10*(1-stats.cdr))), damage:`매 틱 ${damage(.4*Math.max(1,tree.flame_patch||0)*(1+(tree.magma_golem||0)*.15)*(stats.igniteMult||1)).toLocaleString('ko-KR')}`, feature:'7초간 지속됩니다. 사용 즉시 첫 피해를 주고 이후 0.5초마다 피해를 줍니다. 특성 단계·골렘 특성·화상 피해 강화가 적용됩니다.' }
  };
  return definitions[skill];
}

function initSkillTooltips() {
  const popup = document.getElementById('skill-tooltip');
  let owner = null, showTimer = null, hideTimer = null, refreshTimer = null;
  const hide = () => {
    clearTimeout(showTimer); clearTimeout(hideTimer); clearInterval(refreshTimer);
    if (owner) owner.removeAttribute('aria-describedby');
    owner = null; popup.hidden = true;
  };
  const position = () => {
    const rect = owner.getBoundingClientRect();
    const width = popup.offsetWidth, height = popup.offsetHeight;
    popup.style.left = `${Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2))}px`;
    const above = rect.top-height-10;
    popup.style.top = `${Math.max(8,Math.min(innerHeight-height-8,above>=8?above:rect.bottom+10))}px`;
  };
  const refresh = () => {
    if (!owner || owner.classList.contains('hidden-slot') || document.querySelector('.modal-backdrop:not(.hidden),.victory-modal-backdrop:not(.hidden)')) { hide(); return; }
    const skill = owner.dataset.skill;
    const detail = buildSkillDetails(skill,getPlayerStats(),state.combat,state.skillTree,getSkillMasteryMult(skill),getCombustionDuration());
    const html = `<strong class="skill-tooltip-name">${detail.name}</strong><dl><div><dt>시전</dt><dd>${detail.cast}</dd></div><div><dt>쿨타임</dt><dd>${detail.cooldown}</dd></div><div><dt>피해량</dt><dd>${detail.damage}</dd></div></dl><p>${detail.feature}</p><small>피해량은 현재 능력치 기준 · 추가 탄환·별도 화상 제외</small>`;
    if (popup.innerHTML !== html) popup.innerHTML = html;
    position();
  };
  const show = button => {
    hide(); owner = button;
    popup.hidden = false; owner.setAttribute('aria-describedby','skill-tooltip');
    refresh();
    if (owner) refreshTimer = setInterval(refresh,200);
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{if(document.activeElement!==owner)hide();},120);
  };
  document.querySelectorAll('.skill-btn').forEach(button => {
    const name=button.querySelector('.skill-name').textContent;
    button.removeAttribute('title'); button.setAttribute('aria-label',name);
    button.addEventListener('pointerenter',event => {
      if(event.pointerType==='touch') return;
      clearTimeout(hideTimer); clearTimeout(showTimer); showTimer=setTimeout(()=>show(button),160);
    });
    button.addEventListener('pointerleave',() => { clearTimeout(showTimer); scheduleHide(); });
    button.addEventListener('focus',()=>show(button));
    button.addEventListener('blur',scheduleHide);
  });
  popup.addEventListener('pointerenter',()=>clearTimeout(hideTimer));
  popup.addEventListener('pointerleave',scheduleHide);
  window.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  window.addEventListener('resize',hide);
  window.addEventListener('scroll',hide,true);
}

if (typeof module !== 'undefined') module.exports = { buildSkillDetails };
