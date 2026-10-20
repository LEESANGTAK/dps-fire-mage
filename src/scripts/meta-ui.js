/* 클리어 후 콘텐츠 화면: 결과창의 숙련도 진행·해금 연출, 새 런 설정(업화 단계·시작 주문서), 전투 화면의 업화 배지.
 * 수치·규칙은 meta-progression.js, 지급·적용은 game.js(awardRunMastery·restartSpeedrunRun)가 맡고 이 파일은 보여주기만 합니다. */
const META_SPELL_NAMES = { fireblast: '불꽃 작렬', meteor: '메테오', combustion: '마력 폭주', flame_patch: '불장판' };
// 연출 타이밍(ms): 결과창이 뜬 뒤 숨을 고르고 → 막대가 차고 → 해금이 하나씩 튀어나옵니다.
const META_REVEAL = { gainDelay: 450, fillMs: 900, unlockGap: 380 };

function metaFindCard(id) {
  return typeof RoguelikeDeck !== 'undefined' ? RoguelikeDeck.CARD_POOL.find((c) => c.id === id) : null;
}

// 해금 보상 한 칸의 겉모습. tipCard는 마우스를 올렸을 때 설명을 띄울 카드 ID입니다.
function metaUnlockView(unlock) {
  if (unlock.type === 'card') {
    const card = metaFindCard(unlock.id);
    const rarity = card && typeof RoguelikeDeck !== 'undefined' ? RoguelikeDeck.RARITY_META[card.rarity] : null;
    return { icon: paperCardIconHTML(card || { id: unlock.id }), name: card ? cardText(card, 'title') : unlock.id, kind: tr('{rarity} 카드', { rarity: rarity ? rarity.name : tr('전설') }), tipCard: unlock.id };
  }
  return { icon: paperCardIconHTML({ id: START_SPELL_CARDS[unlock.id] }), name: tr(META_SPELL_NAMES[unlock.id]), kind: tr('시작 주문서'), tipCard: START_SPELL_CARDS[unlock.id], tipNote: tr('런을 시작할 때부터 이 주문을 들고 시작합니다.') };
}

// 마우스 오버(터치는 탭) 설명에 쓰는 속성. 결과창 스크롤 영역에 잘리지 않도록 화면 위 툴팁 하나가 받아서 띄웁니다.
function metaTipAttrs(view, focusable = true) {
  if (!view.tipCard) return '';
  return `${focusable ? ' tabindex="0"' : ''} data-tip-card="${view.tipCard}"${view.tipNote ? ` data-tip-note="${view.tipNote}"` : ''}`;
}

function metaCardTipHTML(cardId, note) {
  const card = metaFindCard(cardId);
  if (!card) return '';
  const rarity = typeof RoguelikeDeck !== 'undefined' ? RoguelikeDeck.RARITY_META[card.rarity] : null;
  return `<div class="mt-head"><span class="mt-icon">${paperCardIconHTML(card)}</span><span class="mt-title"><b>${cardText(card, 'title')}</b>`
    + `${rarity ? `<small class="mt-rarity rarity-${card.rarity}">${rarity.name}</small>` : ''}</span></div>`
    + `<div class="mt-desc">${cardText(card, 'desc')}</div>${note ? `<div class="mt-note">${note}</div>` : ''}`;
}

function showMetaTip(target) {
  const tip = document.getElementById('meta-tip');
  const html = metaCardTipHTML(target.dataset.tipCard, target.dataset.tipNote);
  if (!tip || !html) return;
  tip.innerHTML = html;
  tip.hidden = false;
  // 기준 칸 위에 띄우고, 위가 모자라면 아래로. 좌우는 화면 안으로 붙입니다.
  const r = target.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight, margin = 8;
  const left = Math.max(margin, Math.min(innerWidth - w - margin, r.left + r.width / 2 - w / 2));
  const above = r.top - h - 10;
  tip.style.left = `${left}px`;
  tip.style.top = `${above >= margin ? above : Math.min(innerHeight - h - margin, r.bottom + 10)}px`;
  tip.classList.remove('mt-pop');
  void tip.offsetWidth;
  tip.classList.add('mt-pop');
}

function hideMetaTip() {
  const tip = document.getElementById('meta-tip');
  if (tip) tip.hidden = true;
}

// 결과창 안의 해금 칸에 마우스를 올리거나(포커스·탭) 내리면 설명을 띄우고 닫습니다. 한 번만 위임해 둡니다.
function initMetaTipEvents() {
  const modal = document.getElementById('victory-modal');
  if (!modal || modal.dataset.tipBound) return;
  modal.dataset.tipBound = '1';
  if (!document.getElementById('meta-tip')) {
    document.body.insertAdjacentHTML('beforeend', '<div class="meta-tip" id="meta-tip" role="tooltip" hidden></div>');
  }
  const targetOf = (event) => event.target && event.target.closest && event.target.closest('[data-tip-card]');
  modal.addEventListener('pointerover', (event) => { const t = targetOf(event); if (t) showMetaTip(t); });
  modal.addEventListener('pointerout', (event) => { const t = targetOf(event); if (t && !t.contains(event.relatedTarget)) hideMetaTip(); });
  modal.addEventListener('focusin', (event) => { const t = targetOf(event); if (t) showMetaTip(t); });
  modal.addEventListener('focusout', hideMetaTip);
  modal.addEventListener('scroll', hideMetaTip, true);
}

function metaNextHtml(progress, xp) {
  if (!progress.next) return `<span class="rp-done">✨ ${tr('모든 해금 완료')}</span>`;
  const view = metaUnlockView(progress.next);
  return `<span class="rp-next-icon"${metaTipAttrs(view)}>${view.icon}</span><span class="rp-next-text">${tr('다음 해금')}: <b>${view.name}</b> <small>${view.kind}</small></span>`
    + `<span class="rp-next-xp">${xp - progress.prevXp} / ${progress.next.xp - progress.prevXp} XP</span>`;
}

function metaUnlockChip(view, extraClass = '') {
  return `<div class="rp-unlock ${extraClass}"${metaTipAttrs(view)}><span class="rp-unlock-icon">${view.icon}</span><span class="rp-unlock-text"><b>${view.name}</b><small>🔓 ${view.kind} · ${tr('영구 해금')}</small></span></div>`;
}

// 결과창 숙련도: 이번 런 보상이 아직 연출되지 않았으면(lastRun.shown=false) 막대를 채우고 해금을 하나씩 보여줍니다.
function renderRunProgress() {
  const box = document.getElementById('run-progress');
  if (!box || typeof state === 'undefined') return;
  initMetaTipEvents();
  hideMetaTip();
  const meta = state.meta;
  const last = meta.lastRun;
  const fresh = Boolean(last && !last.shown);
  const before = getMasteryProgress(fresh ? last.xpBefore : meta.xp);
  const after = getMasteryProgress(meta.xp);
  box.hidden = false;
  box.innerHTML = `
    <div class="rp-head">
      <span class="rp-title">📖 ${tr('마도서 숙련도')} <b class="rp-level">Lv.${before.level}</b></span>
      ${fresh ? `<span class="rp-gain">+${last.gained} XP</span>` : ''}
    </div>
    <div class="rp-bar"><div class="rp-fill" style="width:${(before.ratio * 100).toFixed(1)}%"></div></div>
    <div class="rp-next">${metaNextHtml(fresh ? before : after, fresh ? last.xpBefore : meta.xp)}</div>
    <div class="rp-unlocks"></div>`;
  if (!fresh) return;

  last.shown = true;
  if (typeof saveGame === 'function') saveGame();
  const fill = box.querySelector('.rp-fill');
  const levelEl = box.querySelector('.rp-level');
  const unlocksEl = box.querySelector('.rp-unlocks');
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduced ? 0 : ms));
  const setFill = (ratio, animate) => {
    fill.style.transition = animate && !reduced ? `width ${META_REVEAL.fillMs}ms cubic-bezier(0.16, 1, 0.3, 1)` : 'none';
    fill.style.width = `${(ratio * 100).toFixed(1)}%`;
  };

  (async () => {
    await wait(META_REVEAL.gainDelay);
    if (after.level > before.level) {
      // 다음 해금 기준을 넘었으면 막대를 끝까지 채운 뒤 해금을 하나씩 공개하고, 새 구간에서 다시 채웁니다.
      setFill(1, true);
      await wait(META_REVEAL.fillMs);
      for (const unlock of last.newUnlocks) {
        unlocksEl.insertAdjacentHTML('beforeend', metaUnlockChip(metaUnlockView(unlock)));
        if (typeof playSound === 'function') playSound('proc', 1.1);
        await wait(META_REVEAL.unlockGap);
      }
      levelEl.textContent = `Lv.${after.level}`;
      levelEl.classList.add('rp-level-up');
      setFill(0, false);
      void fill.offsetWidth;
      setFill(after.ratio, true);
    } else {
      setFill(after.ratio, true);
    }
    box.querySelector('.rp-next').innerHTML = metaNextHtml(after, meta.xp);
    if (last.newInferno) {
      await wait(META_REVEAL.unlockGap);
      unlocksEl.insertAdjacentHTML('beforeend', metaUnlockChip({ icon: '<span class="rp-flame">🔥</span>', name: tr('업화 {n}단계', { n: last.newInferno }), kind: tr('업화 단계') }, 'rp-unlock-inferno'));
      if (typeof playSound === 'function') playSound('proc', 0.9);
      // 이 업화 단계에 처음 도달해 열린 강력한 카드
      for (const unlock of getInfernoCardUnlocks(last.newInferno)) {
        await wait(META_REVEAL.unlockGap);
        const view = metaUnlockView(unlock);
        view.kind = tr('업화 {n}단계 해금 카드', { n: last.newInferno });
        unlocksEl.insertAdjacentHTML('beforeend', metaUnlockChip(view, 'rp-unlock-inferno'));
        if (typeof playSound === 'function') playSound('proc', 1.2);
      }
    }
    renderRunSetup();
  })();
}

// 새 런 설정: 업화 단계와 시작 주문서. 고를 것이 생긴 뒤에만 펼칩니다.
function renderRunSetup() {
  const box = document.getElementById('run-setup');
  if (!box || typeof state === 'undefined') return;
  const meta = state.meta;
  const spells = getUnlockedStartSpells(meta.xp, meta.infernoUnlocked);
  if (meta.infernoUnlocked <= 0 && spells.length === 0) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  box.hidden = false;
  const sel = Math.min(meta.infernoSelected, meta.infernoUnlocked);
  let html = '';

  if (meta.infernoUnlocked > 0) {
    const pips = Array.from({ length: INFERNO_MAX }, (_, i) => {
      const lv = i + 1;
      const cls = lv <= sel ? 'lit' : lv <= meta.infernoUnlocked ? 'open' : 'locked';
      return `<button type="button" class="rs-pip ${cls}" data-level="${lv}" ${lv > meta.infernoUnlocked ? 'disabled' : ''} title="${tr('업화 {n}단계', { n: lv })}">${lv > meta.infernoUnlocked ? '🔒' : '🔥'}</button>`;
    }).join('');
    const rules = INFERNO_RULES.filter((r) => r.level <= sel)
      .map((r) => `<li class="${r.level === sel ? 'rs-rule-new' : ''}">${tr(r.text)}</li>`).join('');
    const best = meta.bestTimes[sel];
    html += `
      <div class="rs-row rs-inferno">
        <span class="rs-label">🔥 ${tr('업화 단계')}</span>
        <button type="button" class="rs-pip rs-zero ${sel === 0 ? 'lit' : 'open'}" data-level="0" title="${tr('기본 난이도')}">0</button>
        ${pips}
      </div>
      <ul class="rs-rules">${rules || `<li>${tr('기본 난이도')}</li>`}</ul>
      ${metaNextInfernoCardHtml(meta.infernoUnlocked)}
      <div class="rs-best">🏆 ${tr('이 단계 최고 기록')}: <b>${best ? formatSpeedrunTime(best) : tr('기록 없음')}</b></div>`;
  }

  if (spells.length > 0) {
    const chip = (id, inner, title) => `<button type="button" class="rs-spell ${meta.startSpell === id ? 'on' : ''}" data-spell="${id || ''}" aria-pressed="${meta.startSpell === id}" aria-label="${title}"${id ? metaTipAttrs(metaUnlockView({ type: 'start', id }), false) : ` title="${title}"`}>${inner}</button>`;
    html += `
      <div class="rs-row rs-start">
        <span class="rs-label">📖 ${tr('시작 주문서')}</span>
        ${chip(null, '✕', tr('없음'))}
        ${spells.map((id) => chip(id, paperCardIconHTML({ id: START_SPELL_CARDS[id] }), tr(META_SPELL_NAMES[id]))).join('')}
      </div>`;
  }
  box.innerHTML = html;
}

// 다음 업화 단계에서 열릴 강력한 카드 예고(다음 런의 목표). 마우스를 올리면 설명이 뜹니다.
function metaNextInfernoCardHtml(infernoUnlocked) {
  const next = getNextInfernoCardUnlock(infernoUnlocked);
  if (!next) return '';
  const view = metaUnlockView(next);
  return `<div class="rs-next-card"${metaTipAttrs(view)}><span class="rs-next-icon">${view.icon}</span>`
    + `<span>🔒 ${tr('업화 {n}단계 도달 시 해금', { n: next.level })}: <b>${view.name}</b></span></div>`;
}

// 설정 클릭은 한 번만 위임해 둡니다(결과창을 다시 열어도 중복 등록되지 않음).
function initRunSetupEvents() {
  const box = document.getElementById('run-setup');
  if (!box || box.dataset.bound) return;
  box.dataset.bound = '1';
  box.addEventListener('click', (event) => {
    const meta = state.meta;
    const pip = event.target.closest('.rs-pip');
    const spell = event.target.closest('.rs-spell');
    if (pip && !pip.disabled) {
      meta.infernoSelected = Math.min(meta.infernoUnlocked, clampInferno(pip.dataset.level));
    } else if (spell) {
      meta.startSpell = spell.dataset.spell || null;
    } else {
      return;
    }
    if (typeof playSound === 'function') playSound('item_select');
    renderRunSetup();
    if (typeof saveGame === 'function') saveGame();
  });
}

// 전투 화면 스테이지 표시 옆 업화 배지(0단계에서는 숨김)
function updateInfernoBadge() {
  const badge = document.getElementById('inferno-badge');
  if (!badge || typeof state === 'undefined') return;
  const lv = state.infernoLevel || 0;
  badge.hidden = lv <= 0;
  badge.textContent = `🔥${lv}`;
  badge.title = tr('업화 {n}단계', { n: lv });
}

if (typeof module !== 'undefined') module.exports = { renderRunProgress, renderRunSetup, updateInfernoBadge, metaUnlockView, metaCardTipHTML };
