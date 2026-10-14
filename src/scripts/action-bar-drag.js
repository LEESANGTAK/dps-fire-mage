/* 액션 바 슬롯 드래그 앤 드롭: 주문 버튼을 끌어 배치를 바꿉니다. 단축키 번호(1, 2, 3…)는 바뀐 위치를 따라갑니다.
 * - 포인터 이벤트로 구현해 마우스·터치 모두 동작합니다(HTML5 드래그는 모바일 터치를 지원하지 않음).
 * - 8px 이상 움직여야 드래그가 시작되고, 그 전에는 평소처럼 클릭으로 시전됩니다. 드롭 직후의 클릭은 시전하지 않습니다.
 * - 드래그 중에는 집은 슬롯이 떠올라 포인터를 따라오고, 나머지 슬롯은 실시간으로 비켜서며(FLIP) 놓일 자리를 보여줍니다.
 * - 순서 변경·저장은 game.js의 moveSpellSlot(선호 배치 meta.slotOrder)이 맡습니다. */
const SLOT_DRAG = { threshold: 8, shiftMs: 180, settleMs: 320 };

function initActionBarDrag() {
  const bar = document.getElementById('action-bar');
  if (!bar || bar.dataset.dragBound) return;
  bar.dataset.dragBound = '1';

  let press = null; // { btn, skill, pointerId, startX, startY, grabOffset }
  let dragging = false;
  let suppressClick = false;

  const visibleSlots = () => [...bar.querySelectorAll('.skill-btn:not(.hidden-slot)')]
    .sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0));

  // 레이아웃 기준 위치(드래그 중 적용한 transform을 뺀 원래 자리)
  const baseCenterX = (btn) => {
    const r = btn.getBoundingClientRect();
    const shift = Number(btn.dataset.dragShift || 0);
    return r.left + r.width / 2 - shift;
  };

  // 순서가 바뀔 때 다른 슬롯들이 새 자리로 부드럽게 미끄러지게 합니다(FLIP).
  function reorderWithFlip(skill, toIndex) {
    const others = visibleSlots().filter((b) => b !== press.btn);
    const before = new Map(others.map((b) => [b, b.getBoundingClientRect().left]));
    if (!moveSpellSlot(skill, toIndex)) return;
    updateSkillActionBarVisibility();
    for (const b of others) {
      const dx = before.get(b) - b.getBoundingClientRect().left;
      if (!dx) continue;
      b.style.transition = 'none';
      b.style.transform = `translateX(${dx}px)`;
      void b.offsetWidth;
      b.style.transition = `transform ${SLOT_DRAG.shiftMs}ms cubic-bezier(0.16, 1, 0.3, 1)`;
      b.style.transform = '';
    }
  }

  function followPointer(clientX) {
    const btn = press.btn;
    const shift = clientX - press.grabOffset - (baseCenterX(btn));
    btn.dataset.dragShift = String(shift);
    btn.style.transform = `translateX(${shift.toFixed(1)}px) translateY(-8px) scale(1.12) rotate(-2deg)`;
  }

  function targetIndexAt(clientX) {
    const slots = visibleSlots();
    let index = 0;
    for (const b of slots) {
      if (b === press.btn) continue;
      if (clientX > baseCenterX(b)) index++;
    }
    return index;
  }

  bar.addEventListener('pointerdown', (event) => {
    const btn = event.target.closest('.skill-btn');
    if (!btn || btn.classList.contains('hidden-slot') || (event.pointerType === 'mouse' && event.button !== 0)) return;
    press = { btn, skill: btn.dataset.skill, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, grabOffset: 0 };
  });

  window.addEventListener('pointermove', (event) => {
    if (!press || event.pointerId !== press.pointerId) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < SLOT_DRAG.threshold) return;
      dragging = true;
      const btn = press.btn;
      press.grabOffset = press.startX - baseCenterX(btn);
      btn.classList.add('slot-dragging');
      bar.classList.add('slot-drag-active');
      const tooltip = document.getElementById('skill-tooltip');
      if (tooltip) tooltip.hidden = true;
      try { btn.setPointerCapture(event.pointerId); } catch (e) { /* 이미 해제된 포인터 */ }
      if (typeof playSound === 'function') playSound('item_select', 1.2);
    }
    event.preventDefault();
    const to = targetIndexAt(event.clientX);
    const from = getActiveSpellList().indexOf(press.skill);
    if (to !== from) reorderWithFlip(press.skill, to);
    followPointer(event.clientX);
  });

  const finish = (event) => {
    if (!press || (event && event.pointerId !== press.pointerId)) return;
    const btn = press.btn;
    if (dragging) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      // 손을 놓으면 새 자리로 탄력 있게 내려앉습니다.
      btn.classList.remove('slot-dragging');
      btn.style.transition = `transform ${SLOT_DRAG.settleMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
      btn.style.transform = '';
      delete btn.dataset.dragShift;
      setTimeout(() => { btn.style.transition = ''; }, SLOT_DRAG.settleMs);
      bar.classList.remove('slot-drag-active');
      if (typeof playSound === 'function') playSound('item_select', 0.9);
      if (typeof saveGame === 'function') saveGame();
    }
    press = null;
    dragging = false;
  };
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);

  // 드롭 직후 같은 버튼에서 발생하는 클릭은 시전하지 않습니다(캡처 단계에서 차단).
  bar.addEventListener('click', (event) => {
    if (!suppressClick) return;
    event.stopPropagation();
    event.preventDefault();
    suppressClick = false;
  }, true);
}

if (typeof module !== 'undefined') module.exports = { initActionBarDrag };
