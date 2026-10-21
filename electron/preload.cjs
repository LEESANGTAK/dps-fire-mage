/* 렌더러(게임)에 노출하는 최소한의 데스크톱 API. Node 전체가 아니라 세이브 3종, 배포 빌드 여부, 게임 종료만 엽니다.
 * read·remove는 동기(부팅 시 즉시 복원, 초기화 직후 새로고침 순서 보장), write는 비동기입니다. */
const { contextBridge, ipcRenderer } = require('electron');

// 배포(Steam) 빌드 여부: 개발용 UI(밸런스 로그 등)를 숨기는 데 씁니다.
// quit: 일시정지 메뉴의 [게임 종료]. 창 닫기와 같은 경로(마지막 저장 → 디스크 기록 → 종료)를 탑니다.
contextBridge.exposeInMainWorld('desktopApp', {
  isPackaged: ipcRenderer.sendSync('app:is-packaged') === true,
  quit: () => ipcRenderer.send('app:quit')
});

contextBridge.exposeInMainWorld('desktopSave', {
  read: (key) => ipcRenderer.sendSync('save:read', key),
  write: (key, value) => ipcRenderer.send('save:write', key, value),
  remove: (key) => ipcRenderer.sendSync('save:remove', key)
});
