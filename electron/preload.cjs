/* 렌더러(게임)에 노출하는 최소한의 데스크톱 API. Node 전체가 아니라 세이브 3종만 엽니다.
 * read·remove는 동기(부팅 시 즉시 복원, 초기화 직후 새로고침 순서 보장), write는 비동기입니다. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopSave', {
  read: (key) => ipcRenderer.sendSync('save:read', key),
  write: (key, value) => ipcRenderer.send('save:write', key, value),
  remove: (key) => ipcRenderer.sendSync('save:remove', key)
});
