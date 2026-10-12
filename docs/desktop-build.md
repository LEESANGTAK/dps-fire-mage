# 데스크톱(Steam) 빌드 — Electron 래퍼 + 파일 세이브

웹 빌드(`index.html`)를 그대로 Electron으로 감싸고, 세이브만 브라우저 저장소 대신 사용자 폴더의 파일로 저장합니다. 웹(GitHub Pages) 빌드는 기존처럼 localStorage를 씁니다.

## 실행과 빌드

| 명령 | 용도 |
| --- | --- |
| `npm run desktop` | 개발 실행 (F12 개발자 도구) |
| `npm run desktop:smoke` | 창 없이 부팅 → 저장 → 파일 확인 → 새로고침 복원을 검증하고 `SMOKE_RESULT` JSON 출력 |
| `npm run dist:win` | Steam 업로드용 폴더 빌드 → `dist/win-unpacked/` (`DPS Fire Mage.exe`) |

패키징된 실행 파일도 `"DPS Fire Mage.exe" --smoke-test`로 같은 검증을 할 수 있습니다. 빌드에서 `previews/`, `docs/`, `tests/`, `scripts/`, `assets/art/concepts/`는 제외됩니다.

## 구조

- `electron/main.cjs`: 창(1280×800, 최소 960×600), F11·Alt+Enter 전체화면, 게임 밖 이동·새 창 차단, 단일 실행, 창 닫기 직전 마지막 저장.
- `electron/preload.cjs`: 렌더러에 `window.desktopSave`(read·write·remove)만 노출합니다. `contextIsolation`·`sandbox` 사용, `nodeIntegration` 끔.
- `electron/save-store.cjs`: 파일 저장소. 임시 파일에 쓴 뒤 교체(원자적 쓰기), 직전 정상본을 `.bak`으로 보존, 본 파일이 깨지면 백업에서 복구, 250ms 단위로 모아 쓰고 종료 시 남은 쓰기를 마칩니다.
- `src/scripts/save-storage.js`: 게임이 쓰는 저장 API. 데스크톱이면 파일, 웹이면 localStorage를 씁니다. 데스크톱 첫 실행 때 같은 키의 localStorage 세이브가 있으면 파일로 옮깁니다.

## 세이브 위치와 Steam 자동 클라우드

- Windows: `%APPDATA%\DPS Fire Mage\saves\MAGE_SLAYER_STAGE_SAVE_V7.json` (+ `.bak`)
- 경로는 앱 이름과 무관하게 `main.cjs`에서 고정합니다. 이름을 바꾸면 기존 세이브와 클라우드 경로가 끊기므로 바꾸지 않습니다.
- Steamworks › 앱 관리 › Steam Cloud › 자동 클라우드 설정: 루트 `WinAppDataRoaming`, 하위 디렉터리 `DPS Fire Mage/saves`, 패턴 `*.json`, 재귀 없음. (`.bak`은 로컬 복구용이라 동기화하지 않습니다.)

## 남은 출시 작업

- Steamworks SDK 연동(업적·오버레이·클라우드 API): `steamworks.js` 등 네이티브 모듈 도입 시 `npm run dist:win`의 네이티브 재빌드 단계를 확인합니다.
- 실행 파일 아이콘(`build.win.icon`, 256×256 ico) — 현재 기본 Electron 아이콘.
- 코드 서명 인증서(미서명 시 Windows SmartScreen 경고).
- 해상도·창 모드 옵션 UI, 스팀덱(1280×800) 실기 확인.
