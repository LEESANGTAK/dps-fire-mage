# 페이퍼크래프트 전투 UI

## 적용 범위

- 실제 `index.html`에서 `paper-ui.css?v=paper-ui-1`을 기존 아트 CSS 뒤에 읽는다.
- 상단 상태 아이콘 6종: 골드, 정수, 불사조 깃털, 주문 공격력, 치명타, 시전속도.
- 전투 버튼 5종: 화염구, 불꽃 작렬, 메테오, 마력 폭주, 불장판. 마력 폭주는 보라색으로 분리한다.
- 상단 바, 상태 패널, 전투 미터, 스킬 프레임, 이름표, 체력·시전바에 무광 종이 테두리와 작은 겹침 그림자를 적용한다.
- 숫자와 게이지 내부는 저질감·고대비로 유지한다. 기존 쿨다운·전체 대기시간 레이어와 몰열 SVG 레이어는 변경하지 않는다.
- 일반 버튼의 기존 눌림/복귀 탄성을 유지한다. 모션 감소에서는 추가 움직임과 몰열 추적 애니메이션을 멈추며, 전투 정지 중 몰열 추적도 정지한다.
- 실제 게임에서 체력바와 시전바의 겹침을 발견해 접지선에 하단 UI 여유 공간을 확보한다. 위치 변경 후 투사체는 기존 DOM 발사점 계산을 계속 사용한다.
- `game.js`, 화염 투사체·파티클, 소환수 원화, 상점 장비 아이콘과 해금 조건은 변경하지 않았다. 화염 정령 아이콘은 같은 아틀라스의 확장용 칸이며 현재 게임 버튼에 새 기능으로 노출하지 않는다.

## 레퍼런스와 반영

1. [Nintendo 공식 화면 02](https://www.nintendo.com/ph/switch/aruu/img/cal_img02.jpg): 원본 이미지를 브라우저에서 직접 확인했다. 밝고 단순한 안내 패널과 두꺼운 색 테두리가 입체 배경 위에서도 읽힌다. 이 게임에서는 어두운 종이 판과 얇은 황토 테두리로 재해석했다.
2. [Nintendo 공식 화면 04](https://www.nintendo.com/ph/switch/aruu/img/cal_img04.jpg): 원본 이미지를 직접 확인했다. 접힌 면의 큰 색 구획과 종이 면 사이 그림자를 아이콘의 층과 실루엣에 반영했다. 해당 화면에는 HUD가 없으므로 전투 UI 레이아웃의 참고로 주장하지 않는다.
3. [Dsource 컷아웃 제작](https://www.dsource.in/course/cut-out-animation/cutout-manual-method/stages/production): 앞선 페이퍼 아트 작업에서 확인한 제작 사진·설명을 재사용했다. 조각 단위의 분리와 겹침 그림자만 가져오고 UI 문자를 흔들거나 접지는 않는다.

참고 게임의 에셋은 복제하지 않았다. 이번 작업에서 재생 영상을 확인했다고 주장하지 않는다.

## 신규 원화

두 PNG는 생성 원본을 픽셀 편집 없이 복사했다. 모두 1536×1024, 3열×2행 정사각 셀이다. CSS `background-size:300% 200%`와 좌표 0/50/100%, 0/100%로 선택한다.

- `assets/art/paper-ui-skills-v1.png`: 위 행 화염구/불꽃 작렬/메테오, 아래 행 마력 폭주/불장판/확장용 화염 정령.
- `assets/art/paper-ui-stats-v1.png`: 위 행 골드/정수/깃털, 아래 행 주문 공격력/치명타/시전속도.

### 스킬 아틀라스 생성 프롬프트

Create a production game UI icon atlas, landscape 1536x1024, exact seamless regular grid 3 columns x 2 rows, six equal square cells with NO gutters and NO borders or text. Each cell has the SAME flat solid dark wine charcoal background #241b22. Center a large readable hand-cut colored cardstock collage symbol within each cell, 14% margin around symbol. Warm dark fantasy papercraft like handcrafted board game pieces, angular layered cut paper edges, subtle paper grain, small offset occlusion shadows between layers, no photorealism or metallic shine or luminous particle glow. Distinct bold silhouettes readable at 48px. Top left: orange fireball flying diagonally toward upper right with cream hot core and red trailing paper flames. Top middle: explosive orange yellow radial fire burst, pointed starburst shape. Top right: dark charcoal meteor rock with orange fissures and broad trailing red flames diagonally descending toward lower left. Bottom left: purple arcane overload, violet flame crown wrapped around cream-purple diamond core, purple identity distinct from orange fire skills. Bottom middle: broad low horizontal patch of three orange flames over a dark crimson ground ellipse. Bottom right: small orange fire elemental silhouette, flame head and chunky raised arms. Preserve exact row/column ordering, no labels, no characters from existing franchises, no extra symbols, no icon crossing cells.

### 상태 아틀라스 생성 프롬프트

Production papercraft fantasy game status icon atlas. Exact regular 3 columns x 2 rows of square cells, landscape 1536x1024. NO text, NO grid lines or frames. All six cells identical flat dark charcoal wine #241b22 background. Each bold clean symbol occupies middle 65% of its cell and stays strictly inside. Layered matte hand-cut colored cardstock, angular cut edges, a few large overlapping shapes, very subtle grain, small offset shadow between layers. Must read clearly at 20px. Top row left to right: stack of three gold coins with simple cream highlight and dark ochre paper sides; cyan blue diamond-shaped essence crystal; orange crimson phoenix feather curved upward. Bottom row left to right: violet magical orb in short brown wand mount for spell power; red and cream angular eight-point critical hit burst; golden yellow lightning bolt. Same craft aesthetic and frontal visual weight. No photorealistic metal shine, no luminous bloom, no complex tiny details, no letters, no numbers, no extra symbols.

## 검증

- 실제 HTTP `index.html`: 종이 UI·아이콘 로드, 자동 시전 ON/OFF, 화염구 수동 입력과 피해·시전 진행, 콘솔 오류 없음.
- 실제 390px 화면: 문서 가로 넘침 없음(`scrollWidth=384`, 뷰포트 390), 체력바 하단 529.66px/시전바 상단 556.84px로 겹침 없음.
- `paper-ui-preview.html`: 실제 게임의 버튼 마크업과 같은 CSS를 쓰는 독립 비교 화면. 스킬 5종, 몰열, 쿨다운 숫자·방사형 차폐, 활성, 잠금, 체력/시전, 모션 감소 표시를 확인했다. 진행 데이터나 게임 로직은 읽거나 저장하지 않는다.
- 아트 관련 기존 테스트 6개(`comic-assets`, `mage-motion`, `monster-motion`, `paper-monster-frames`, `arena-environment`, `paper-preview`) 통과.
- 신규 동작 로직이 없어 CSS를 그대로 따라 쓰는 단위 테스트는 추가하지 않았다. 잠금·몰열·폭주·후반 스킬 상태는 비교 화면에서 시각적으로 검증했고, 실제 후반 플레이의 모든 조합을 재현하지는 않았다.
- 브라우저 정책상 `file://` 실행은 직접 검증하지 못했다. 신규 CSS와 PNG는 모두 상대 경로이며 HTTP 실행에서 검증했다.

검증 화면: `docs/paper-ui-states.jpg`, `docs/paper-ui-game.jpg`.


## 2026-10-07 보조 UI 위치 수정

- 사용자 첨부 이미지의 파란 상자·화살표를 최우선 배치 참고로 사용했다. 재질·동작은 새로 제작하지 않아 위에서 직접 확인한 종이 UI 참고자료를 재사용했다.
- 열기를 캐릭터 머리 위, 장비 목록을 캐릭터 왼쪽 몸 높이, 디버프를 몬스터 오른쪽 몸 높이에 배치했다.
- 인라인 `.caster-eq-icon`의 자동 크기에 자식 아이콘의 100% 크기가 의존해 폭이 0이 되는 문제를 명시적 아이콘 영역으로 수정했다. 장비 원화 자체는 변경하지 않았다.
- 390px에서는 장비 칸을 22px로 줄여 왼쪽 잘림을 방지하고 디버프 68px 영역을 확보했다. 디버프 옆에 겹치던 다음 도전·자동 진행 조작은 체력 아래 한 줄로 이동했다.
- `paper-ui-layout-preview.html`은 실제 게임 HTML·CSS와 장비 7종, 디버프 3종, 마법사 4포즈, 일반·대형 몬스터를 비교한다. 전투 및 저장 로직은 실행하지 않는다. `paper-ui-layout-mobile.html`의 390px iframe으로 좁은 뷰포트를 확인했다.
- 실제 HTTP 게임에서 완드를 구매한 뒤 장비 아이콘과 왼쪽 배치를 확인했다. 비교 화면에서는 7종 모두 정상 크기이며 준비·발사·대기 포즈와 대형 몬스터의 배치를 확인했다. 콘솔 오류 없음.
- 관련 기존 테스트 3개(comic-assets, mage-motion, monster-motion) 통과. `game.js` 변경 없음. `file://` 직접 실행 및 모든 기기 조합은 별도로 검증하지 않았다.
- 검증 화면: `docs/paper-ui-layout.jpg`.

## 2026-10-07 중복 정보 정리

사용자 첨부 이미지의 파란 상자에 있던 소환물·불장판·연발 상태 배지는 숨기고 캐릭터 이름표는 HTML에서 제거했다. 소환물 옆 기존 이름·레벨과 캐릭터의 접근성 이름은 유지한다. `game.js`가 갱신하는 `summon-active-badges` 요소는 숨긴 채 남겨 널 참조를 방지한다. 신규 원화나 움직임 제작은 없으며 배치 기준은 사용자 첨부 이미지다.

## 2026-10-07 전장 상단 정보 분산

- 사용자 배치 요구를 기준으로 기존 종이 UI 재질을 유지했다. PHASE·단계 진행 숫자·도트는 화면과 접근성 트리에서 숨기되 기존 게임 갱신 대상 ID는 보존한다.
- 기존 스피드런 DOM을 DPS 패널에서 전장 중앙 상단으로 옮겼다. 복제하지 않아 시간 갱신과 기록 달성 연출이 같은 요소에서 작동한다.
- STAGE·처치 보상·보스 기믹은 왼쪽 가장자리, 현상금은 오른쪽 가장자리에 배치한다. 640px 이하에서는 시간을 첫 행 중앙에 두고 좌우 정보를 다음 행에 나눠 넘침을 방지한다.
- 실제 HTTP 게임 화면 및 390px 비교 프레임 확인. 스테이지 변경 후 PHASE 숨김 유지, 스피드런 시간 갱신, 관련 ID 중복·누락 없음, 콘솔 오류 없음. game.js 변경 없음. 실제 후반 기록 달성 연출은 이번 검증에서 재현하지 않았다.
- 검증 화면: docs/paper-ui-header.jpg.
