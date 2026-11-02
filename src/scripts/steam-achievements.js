/* Steam 업적 목록과, 게임 사건을 업적 해제 요청으로 바꾸는 얇은 층.
 * 업적 API 이름(id)은 Steamworks 파트너 사이트에 같은 이름으로 등록해야 합니다. 이름·설명(ko/en)은 등록할 때 옮겨 적는 원본입니다.
 * 실제 해제는 데스크톱 빌드의 window.desktopSteam(electron/preload.cjs)만 합니다. 브라우저 실행이나 Steam 없이 실행하면 아무 일도 하지 않습니다.
 * 보상은 업적뿐이며 전투 수치·골드에는 영향이 없습니다. */
const STEAM_ACHIEVEMENTS = [
  { id: 'ACH_PROP_CRYSTAL', propEvent: 'crystal-break', ko: '수정 깨는 자', en: 'Crystal Breaker', descKo: '폐광의 수정을 깨뜨렸다.', descEn: 'Shattered a crystal in the mine.' },
  { id: 'ACH_PROP_LANTERN', propEvent: 'lantern-relight', ko: '꺼지지 않는 불', en: 'Undying Flame', descKo: '폐광 랜턴을 꺼뜨렸다가 다시 붙였다.', descEn: 'Knocked out a mine lantern and watched it relight.' },
  { id: 'ACH_PROP_CART', propEvent: 'cart-spill', ko: '탈선', en: 'Derailed', descKo: '폐광 광차의 광석을 쏟았다.', descEn: 'Spilled the ore from a mine cart.' },
  { id: 'ACH_PROP_SIGIL', propEvent: 'citadel-sigil', ko: '옥좌의 불', en: 'Throne Ablaze', descKo: '성채의 큰 화로를 모두 키워 옥좌를 밝혔다.', descEn: 'Stoked every great brazier and lit the throne.' },
  { id: 'ACH_PROP_BANNER', propEvent: 'banner-burnt', ko: '잿빛 깃발', en: 'Ashen Banner', descKo: '화산 폐허의 깃발을 끝까지 태웠다.', descEn: 'Burned a ruined banner to the pole.' },
  { id: 'ACH_PROP_MELODY', propEvent: 'void-melody', ko: '공허의 선율', en: 'Void Melody', descKo: '공허 수정으로 멜로디를 완성했다.', descEn: 'Played a full melody on the void crystals.' },
  { id: 'ACH_PROP_SLIME', propEvent: 'slime-pop', ko: '누가 거기 있니?', en: "Who's There?", descKo: '아치 속 눈을 깨워 새끼 슬라임을 불러냈다.', descEn: 'Woke the eyes in the arch and out popped a slime.' },
  // 위 업적이 모두 해제되면 메인 프로세스가 Steam의 해제 상태를 보고 판정합니다(세이브에 따로 기록하지 않음).
  { id: 'ACH_PROP_ALL', requires: ['ACH_PROP_CRYSTAL', 'ACH_PROP_LANTERN', 'ACH_PROP_CART', 'ACH_PROP_SIGIL', 'ACH_PROP_BANNER', 'ACH_PROP_MELODY', 'ACH_PROP_SLIME'], ko: '호기심 많은 마법사', en: 'Curious Mage', descKo: '배경 소품의 큰 반응을 모두 찾았다.', descEn: 'Found every big scenery reaction.' }
];
// 해제 정보는 Steamworks에서 '숨김 업적'으로 등록합니다. 목록에 조건이 보이면 우연히 발견하는 재미가 공략표가 됩니다.
const STEAM_ACHIEVEMENTS_HIDDEN = true;

// 사건 이름 → 업적 id. 작은 반응(crystal-hit, brazier-flare 등)은 업적이 없습니다.
const PROP_EVENT_ACHIEVEMENTS = Object.fromEntries(STEAM_ACHIEVEMENTS.filter((a) => a.propEvent).map((a) => [a.propEvent, a.id]));

// unlock(id): 해제 요청 함수(데스크톱이면 desktopSteam.unlockAchievement). 없으면 아무 일도 하지 않습니다.
// 한 번 요청한 업적은 이 실행 동안 다시 보내지 않습니다(같은 소품을 계속 깨도 IPC가 쌓이지 않게).
function createAchievementReporter(unlock) {
  const sent = new Set();
  const send = typeof unlock === 'function' ? unlock : null;
  return {
    onPropEvent(name) {
      const id = PROP_EVENT_ACHIEVEMENTS[name];
      if (!id || !send || sent.has(id)) return false;
      sent.add(id);
      try { send(id); } catch (e) { return false; }
      return true;
    }
  };
}

// 렌더러(게임)에서 쓰는 기본 보고기. 브라우저 실행에는 desktopSteam이 없어 아무 일도 하지 않습니다.
function createDesktopAchievementReporter(win) {
  const steam = win && win.desktopSteam;
  return createAchievementReporter(steam && typeof steam.unlockAchievement === 'function' ? (id) => steam.unlockAchievement(id) : null);
}

if (typeof module !== 'undefined') {
  module.exports = { STEAM_ACHIEVEMENTS, STEAM_ACHIEVEMENTS_HIDDEN, PROP_EVENT_ACHIEVEMENTS, createAchievementReporter, createDesktopAchievementReporter };
}
