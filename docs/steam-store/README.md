# Steam 스토어 페이지 자료 (출시 예정 페이지용 임시본)

| 자료 | 위치 | 상태 |
| --- | --- | --- |
| 스크린샷 6장 (1920×1080) | `screenshots/` (한국어), `screenshots-en/` (영어) | ✅ Steam 스토어의 언어별 스크린샷 칸에 각각 올립니다 |
| 캡슐·라이브러리 이미지 8종 | `capsules/` | ⚠️ 기존 원화 조합 임시본. 출시 전 전용 키아트로 교체 권장 |
| 앱·바로 가기 아이콘 | `icons/` | ✅ 실행 파일 아이콘과 같은 그림 (`npm run icon`으로 다시 만듦) |
| 소개문 (한/영) | `store-description.md` | 초안 |
| 콘텐츠 설문 답변 | `content-survey.md` | 초안. ⚠️ 사운드 출처 확인 후 제출 |

## 업로드 위치 (Steamworks › 앱 관리 › 스토어 페이지 편집 › 그래픽 자산)

| 파일 | 칸 |
| --- | --- |
| `header_capsule_920x430.png` | 헤더 캡슐 |
| `small_capsule_462x174.png` | 작은 캡슐 |
| `main_capsule_1232x706.png` | 메인 캡슐 |
| `vertical_capsule_748x896.png` | 세로 캡슐 |
| `library_capsule_600x900.png` | 라이브러리 캡슐 |
| `library_header_920x430.png` | 라이브러리 헤더 |
| `library_hero_3840x1240.png` | 라이브러리 히어로 (글자 없음) |
| `library_logo_1280x720.png` | 라이브러리 로고 (투명 PNG) |

### 커뮤니티 및 클라이언트 아이콘 (Steamworks › 앱 관리 › 그래픽 자산)

| 파일 | 칸 | 규격 |
| --- | --- | --- |
| `icons/app_icon_184x184.jpg` | 앱 아이콘 | 184×184 JPG. 라이브러리 목록·채팅 즐겨찾기·알림의 작은 자리용이라 모자·눈 위주로 꽉 채웠습니다 |
| `icons/shortcut_icon_256x256.png` | 바로 가기 아이콘 | 256×256 PNG 또는 ICO. 바탕 화면 바로 가기 |
| `icons/shortcut_icon.ico` | (구형 '클라이언트 아이콘' 칸이 보일 때) | 16~256px 여러 크기, 32×32 포함 |

- 2026-10 기준 공식 문서에는 32×32 클라이언트 아이콘 칸이 없고, 앱 아이콘과 바로 가기 아이콘 두 칸만 있습니다.
- 바로 가기 아이콘으로 앱 아이콘을 자동 생성하면 투명 부분이 검게 채워지므로, 앱 아이콘은 따로 올립니다.
- Mac 빌드를 낼 때는 'Mac Icon' 칸에 ICNS 파일이 따로 필요합니다(현재 Windows만 출시).

스크린샷은 파일 이름 순서(01→06)로 올립니다. 첫 장(최종 보스 '불의 심장' 단계)이 검색 결과·마우스 오버에 가장 많이 노출됩니다.

## 다시 만들기

```
npx electron scripts/store/capture-screenshots.cjs          # → dist/store-capture/ (장면마다 여러 프레임)
npx electron scripts/store/capture-screenshots.cjs --only=03 # 특정 장면만
npx electron scripts/store/capture-screenshots.cjs --lang=en # 영어 화면 → dist/store-capture-en/
npx electron scripts/store/render-capsules.cjs               # → dist/store-capsules/
```

- 스크린샷: 1280×720 레이아웃을 1.5배로 찍어 1920×1080을 만듭니다. 장면마다 진행 세이브를 넣고 실제 전투를 돌리므로 프레임마다 결과가 다릅니다. 가장 읽기 좋은 프레임을 골라 `screenshots/`에 복사합니다. 개발용 '밸런스 로그' 버튼은 촬영 때만 숨깁니다.
- 캡슐: `scripts/store/capsule.html` 템플릿 하나로 크기별 배치를 그립니다(전장·마법사 시전 자세·화염구·이그나르크·로고).

## 임시본의 한계 (교체 판단 근거)
- 새로 그린 일러스트가 아니라 게임 원화를 조합했습니다. 캡슐은 클릭률을 가장 크게 좌우하므로 출시 전 전용 키아트를 권장합니다.
- 라이브러리 히어로(3840px)는 원화를 약 2배 확대해 써서 가까이 보면 부드럽게 뭉개집니다.
- 로고는 Jua 글꼴로 만든 문자 로고입니다. "DPS: Fire Mage"의 콜론은 디자인상 생략했습니다.
- (해결) 각성 카드 아이콘을 종이 원화 아이콘으로 바꾼 뒤 카드 선택 스크린샷(04)을 다시 찍었습니다.
