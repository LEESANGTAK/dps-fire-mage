/* 마도서 도감: 런에서 만날 수 있는 각성 카드를 빌드별로 보여 주고, 카드끼리의 연계를 표시합니다.
 * - 여는 곳: 타이틀 [📖 도감], 일시정지 메뉴 [📖 도감], 각성 카드 선택 창의 📖 버튼. 모두 이미 전투가 멈춘 상태에서 열립니다.
 *   도감 버튼은 각성 카드를 한 번이라도 만난 뒤에 나타납니다(첫 실행 화면을 비워 둠).
 * - 카드 상태: 잠김(🔒 해금 조건) · 미발견(실루엣 + ?) · 발견 · 획득한 적 있음(불꽃 도장). 런 중 보유 카드는 금색 테두리 + 겹친 횟수.
 * - 카드를 누르면 아래 칸에 설명과 연계 카드가 뜨고, 격자에서 연계 카드가 빛납니다.
 * - 연계 데이터: 카드의 links(엑셀 '연계 카드' 열). 한쪽에만 적어도 양방향으로 연결합니다(getCardLinkIds). */
const CODEX_BUILDS = [
  { id: 'all', icon: '📖', label: tr('모두') },
  { id: 'spell', icon: '📜', label: tr('주문서') },
  { id: 'crit', icon: '🎯', label: tr('치명') },
  { id: 'combustion', icon: '☀️', label: tr('폭주') },
  { id: 'rapid', icon: '⚡', label: tr('속사') },
  { id: 'summon', icon: '🔥', label: tr('정령') },
  { id: 'burn', icon: '♨️', label: tr('화상') },
  { id: 'utility', icon: '✨', label: tr('유틸') }
];

let codexOpen = false;
let codexTab = 'all';
let codexSelected = null;
let codexLinkCache = null;

function codexCards() {
  return typeof RoguelikeDeck !== 'undefined' && Array.isArray(RoguelikeDeck.CARD_POOL) ? RoguelikeDeck.CARD_POOL : [];
}

// 양방향 연계 목록. 카드 풀은 JSON 로드 때 같은 배열을 새 카드로 채우므로, 첫 카드가 바뀌면 다시 계산합니다.
function getCardLinkIds(cardId) {
  const pool = codexCards();
  if (!codexLinkCache || codexLinkCache.first !== pool[0] || codexLinkCache.size !== pool.length) {
    const map = new Map(pool.map((c) => [c.id, new Set()]));
    for (const c of pool) {
      for (const other of Array.isArray(c.links) ? c.links : []) {
        if (!map.has(other) || other === c.id) continue;
        map.get(c.id).add(other);
        map.get(other).add(c.id);
      }
    }
    codexLinkCache = { first: pool[0], size: pool.length, map };
  }
  const order = new Map(pool.map((c, i) => [c.id, i]));
  return [...(codexLinkCache.map.get(cardId) || [])].sort((a, b) => order.get(a) - order.get(b));
}

function codexActiveDeck() {
  return typeof deckManager !== 'undefined' && deckManager && typeof deckManager.getActiveDeck === 'function' ? deckManager.getActiveDeck() : {};
}

function isCodexAvailable() {
  const meta = typeof state === 'object' && state.meta;
  return Boolean(meta && ((meta.seenCards && meta.seenCards.length) || (meta.pickedCards && meta.pickedCards.length)));
}

function isCodexOpen() {
  return codexOpen;
}

// 잠긴 카드의 해금 조건(숙련도 또는 업화 단계)
function codexLockText(cardId) {
  const inferno = typeof INFERNO_CARD_UNLOCKS !== 'undefined' && INFERNO_CARD_UNLOCKS.find((u) => u.id === cardId);
  if (inferno) return tr('업화 {n}단계', { n: inferno.level });
  const mastery = typeof MASTERY_UNLOCKS !== 'undefined' && MASTERY_UNLOCKS.find((u) => u.type === 'card' && u.id === cardId);
  if (mastery) return tr('숙련도 {n}', { n: mastery.xp });
  return '';
}

// 'locked' · 'unseen' · 'seen' · 'picked'
function getCodexCardState(cardId) {
  if (typeof state === 'object' && Array.isArray(state.lockedCards) && state.lockedCards.includes(cardId)) return 'locked';
  const meta = (typeof state === 'object' && state.meta) || {};
  if ((meta.pickedCards || []).includes(cardId) || (codexActiveDeck()[cardId] || 0) > 0) return 'picked';
  if ((meta.seenCards || []).includes(cardId)) return 'seen';
  return 'unseen';
}

function codexIconHTML(card, st) {
  const icon = paperCardIconHTML(card);
  return st === 'seen' || st === 'picked' ? icon : `<span class="codex-silhouette">${icon}</span>`;
}

function renderCodexTabs() {
  const tabs = document.getElementById('codex-tabs');
  if (!tabs) return;
  tabs.innerHTML = CODEX_BUILDS.map((b) => `<button type="button" role="tab" class="codex-tab build-${b.id}${b.id === codexTab ? ' selected' : ''}" data-build="${b.id}" aria-selected="${b.id === codexTab}"><span class="codex-tab-icon">${b.icon}</span><span class="codex-tab-label">${b.label}</span></button>`).join('');
}

function renderCodexGrid() {
  const grid = document.getElementById('codex-grid');
  if (!grid) return;
  const deck = codexActiveDeck();
  const selectedLinks = codexSelected ? new Set(getCardLinkIds(codexSelected)) : null;
  const cards = codexCards().filter((c) => codexTab === 'all' || c.build === codexTab);
  grid.innerHTML = cards.map((card) => {
    const st = getCodexCardState(card.id);
    const known = st === 'seen' || st === 'picked';
    const count = deck[card.id] || 0;
    const cls = [
      'codex-cell', `rarity-${card.rarity}`, `state-${st}`,
      count > 0 ? 'owned' : '',
      codexSelected === card.id ? 'selected' : '',
      selectedLinks && selectedLinks.has(card.id) ? 'link-lit' : '',
      selectedLinks && codexSelected !== card.id && !selectedLinks.has(card.id) ? 'link-dim' : ''
    ].filter(Boolean).join(' ');
    const name = known ? cardText(card, 'title') : (st === 'locked' ? '🔒' : '???');
    const lock = st === 'locked' ? `<span class="codex-lock">${codexLockText(card.id)}</span>` : '';
    const mark = st === 'unseen' ? '<span class="codex-unknown">?</span>' : '';
    const stamp = st === 'picked' ? '<span class="codex-stamp" aria-hidden="true">🔥</span>' : '';
    const stack = count > 0 ? `<span class="codex-stack">×${count}</span>` : '';
    return `<button type="button" class="${cls}" data-card-id="${card.id}"><span class="codex-cell-icon">${codexIconHTML(card, st)}${mark}</span><span class="codex-cell-name">${name}</span>${lock}${stamp}${stack}</button>`;
  }).join('');
}

function renderCodexProgress() {
  const el = document.getElementById('codex-progress');
  if (!el) return;
  const cards = codexCards();
  const known = cards.filter((c) => ['seen', 'picked'].includes(getCodexCardState(c.id))).length;
  el.innerHTML = `<span class="codex-progress-label">${tr('발견')}</span> <b>${known}</b> / ${cards.length}`;
}

function renderCodexDetail() {
  const box = document.getElementById('codex-detail');
  if (!box) return;
  const card = codexCards().find((c) => c.id === codexSelected);
  if (!card) {
    box.innerHTML = `<p class="codex-detail-hint">${tr('카드를 누르면 설명과 연계 카드가 보입니다.')}</p>`;
    return;
  }
  const st = getCodexCardState(card.id);
  const known = st === 'seen' || st === 'picked';
  const rarity = typeof RoguelikeDeck !== 'undefined' && RoguelikeDeck.RARITY_META ? RoguelikeDeck.RARITY_META[card.rarity] : null;
  const build = CODEX_BUILDS.find((b) => b.id === card.build);
  const body = known
    ? `<div class="codex-detail-desc">${cardText(card, 'desc')}</div>`
    : `<div class="codex-detail-desc muted">${st === 'locked' ? `🔒 ${tr('{cond}에 해금', { cond: codexLockText(card.id) })}` : tr('아직 선택지에 나온 적 없는 카드입니다.')}</div>`;
  const links = getCardLinkIds(card.id);
  const deck = codexActiveDeck();
  const linkChips = links.map((id) => {
    const c = codexCards().find((x) => x.id === id);
    const s = getCodexCardState(id);
    const knownLink = s === 'seen' || s === 'picked';
    return `<button type="button" class="codex-link-chip${(deck[id] || 0) > 0 ? ' owned' : ''}" data-card-id="${id}" title="${knownLink ? cardText(c, 'title') : '???'}">${codexIconHTML(c, s)}${knownLink ? '' : '<span class="codex-unknown">?</span>'}</button>`;
  }).join('');
  box.innerHTML = `
    <div class="codex-detail-head">
      <span class="codex-detail-icon">${codexIconHTML(card, st)}</span>
      <span class="codex-detail-name">${known ? cardText(card, 'title') : '???'}</span>
      ${rarity ? `<span class="codex-detail-rarity rarity-${card.rarity}">${rarity.name}</span>` : ''}
      ${build ? `<span class="codex-detail-build build-${build.id}">${build.icon} ${build.label}</span>` : ''}
    </div>
    ${body}
    ${links.length ? `<div class="codex-detail-links"><span class="codex-links-label">🔗 ${tr('연계')}</span>${linkChips}</div>` : ''}`;
}

function renderCodex() {
  renderCodexTabs();
  renderCodexProgress();
  renderCodexGrid();
  renderCodexDetail();
}

function openCodex(from = 'pause', focusCardId = null) {
  const el = document.getElementById('codex-backdrop');
  if (!el) return false;
  codexOpen = true;
  if (focusCardId) {
    codexSelected = focusCardId;
    const card = codexCards().find((c) => c.id === focusCardId);
    if (card && codexTab !== 'all' && card.build !== codexTab) codexTab = 'all';
  }
  el.dataset.from = from;
  renderCodex();
  el.classList.remove('hidden');
  const close = document.getElementById('btn-codex-close');
  if (close && typeof close.focus === 'function') { try { close.focus({ preventScroll: true }); } catch (e) { /* 무시 */ } }
  return true;
}

function closeCodex() {
  if (!codexOpen) return false;
  codexOpen = false;
  const el = document.getElementById('codex-backdrop');
  if (el) el.classList.add('hidden');
  return true;
}

// 도감 버튼 노출(타이틀·일시정지 메뉴): 각성 카드를 한 번이라도 만난 뒤에만
function updateCodexButtons() {
  const on = isCodexAvailable();
  for (const id of ['btn-title-codex', 'btn-pause-codex']) {
    const btn = document.getElementById(id);
    if (btn) btn.hidden = !on;
  }
}

function initCodex() {
  const tabs = document.getElementById('codex-tabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.codex-tab');
      if (!tab) return;
      codexTab = tab.dataset.build;
      if (typeof playSound === 'function') playSound('item_select');
      renderCodex();
    });
  }
  const pick = (e) => {
    const cell = e.target.closest('[data-card-id]');
    if (!cell) return;
    const id = cell.dataset.cardId;
    codexSelected = codexSelected === id && cell.classList.contains('codex-cell') ? null : id;
    if (typeof playSound === 'function') playSound('item_select');
    renderCodexGrid();
    renderCodexDetail();
  };
  const grid = document.getElementById('codex-grid');
  if (grid) grid.addEventListener('click', pick);
  const detail = document.getElementById('codex-detail');
  if (detail) detail.addEventListener('click', pick);
  const close = document.getElementById('btn-codex-close');
  if (close) close.addEventListener('click', closeCodex);
  const backdrop = document.getElementById('codex-backdrop');
  if (backdrop) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeCodex(); });
  const on = (id, from) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); openCodex(from); });
  };
  on('btn-title-codex', 'title');
  on('btn-pause-codex', 'pause');
  on('btn-awakening-codex', 'awakening');
  updateCodexButtons();
}
