/* 세이브 저장소 추상화. 데스크톱(Electron) 빌드는 사용자 폴더의 파일, 웹 빌드는 localStorage에 저장합니다.
 * 데스크톱 첫 실행 때 같은 키의 localStorage 세이브가 있으면 파일로 옮겨 진행도를 잃지 않게 합니다. */
const saveStorage = (() => {
  const desktop = typeof window !== 'undefined' && window.desktopSave ? window.desktopSave : null;
  function local(method, ...args) {
    try { return typeof localStorage !== 'undefined' ? localStorage[method](...args) : null; } catch (e) { return null; }
  }
  return {
    isDesktop: Boolean(desktop),
    read(key) {
      if (!desktop) return local('getItem', key);
      const saved = desktop.read(key);
      if (saved != null) return saved;
      const legacy = local('getItem', key);
      if (legacy) { desktop.write(key, legacy); local('removeItem', key); }
      return legacy || null;
    },
    write(key, value) {
      if (desktop) desktop.write(key, value);
      else local('setItem', key, value);
    },
    remove(key) {
      if (desktop) desktop.remove(key);
      local('removeItem', key);
    }
  };
})();
if (typeof module !== 'undefined') module.exports = { saveStorage };
