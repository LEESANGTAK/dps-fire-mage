# 판타지 만화 UI·에셋 교체 기록

## 적용

- 굵은 잉크 테두리, 어두운 가죽 패널, 양피지 상점 카드, 주황색 행동 버튼.
- 제목·수치에는 Jua, 본문에는 Nanum Gothic을 로컬 파일로 제공. 각 폰트 OFL 동봉.
- 기존 슬라임 2종 유지. 캠페인 나머지 18종과 심연 일반·보스 2종을 만화 원화로 교체.
- 장비·재화·소환물용 16칸 시트와 기존 스킬 시트를 UI·캔버스에 연결. 메뉴는 잉크 선 SVG.
- 동적으로 갱신되는 상점·스킬 트리 텍스트도 아이콘으로 치환.
- 기존 몬스터별 대기·피격·사망 연출에 새 이미지를 연결. 별도 관절 원화는 아님.

## 작업 전 참고자료

- https://www.darkestdungeon.com/darkest-dungeon/ — 공식 페이지를 브라우저에서 직접 확인. 두꺼운 잉크, 낮은 채도의 어두운 패널, 제한된 강조색을 관찰. 이 게임의 기존 만화 캐릭터에 맞춰 밝은 양피지 카드로 조정.
- https://github.com/google/fonts/tree/main/ofl/jua — 제목용 한글 폰트 및 OFL 출처.
- https://github.com/google/fonts/tree/main/ofl/nanumgothic — 긴 설명의 가독성을 위한 본문 폰트 및 OFL 출처.
- https://github.com/neodgm/neodgm — 픽셀 폰트 후보를 검토했지만 현재 손그림 만화와 질감이 달라 채택하지 않음.

## 파일

- assets/art/comic-monsters-atlas.png: 최초 생성 원본.
- assets/art/comic-monsters-clean.png: 투명 배경 정리본, 실제 런타임 사용.
- assets/art/comic-equipment-atlas.png: 16종 아이콘 원본 및 런타임 사용.
- comic-monster-frames.js: 주요 알파 연결 윤곽의 영역·클립 메타데이터. 이미지 자체를 재가공하지 않음.
- assets/fonts/Jua-Regular.ttf, NanumGothic-Regular.ttf: 로컬 폰트.

## 검증과 범위

- JavaScript 구문 검사, 기존 시전 및 20종 몬스터 모션 검증 통과.
- 실제 게임에서 두 한글 폰트 로드, 동적 아이콘 표시, 콘솔 오류 없음 확인.
- 비교 페이지에서 쥐 이미지의 이웃 셀 침범 제거 및 화염 보스 표시 확인.
- 브라우저의 모바일 뷰포트 요청이 실제 크기에 반영되지 않아 모바일 실기기 검증은 미완료.
- 체크·화살표 같은 단순 상태 기호는 유지. 모든 장면의 배경을 새로 그린 작업은 아님.

## 이미지 생성

내장 imagegen으로 생성. 기존 만화 마법사 원화를 참고 이미지로 사용.
아래는 실제 전달한 원문 프롬프트.

### 몬스터 원본

Production sprite atlas for the existing indie fantasy comic game. Reference only the thick dark-plum ink outlines and flat red mage comic style in the supplied image. NEW atlas, exactly 5 columns and 4 rows, twenty completely isolated full-body enemies facing LEFT, 1536x1024 landscape transparent canvas, equal cells, generous transparent margins, NO grids labels text scenery halos or shadows. Baseline each character feet at 88% of its own cell height. Restrained angular shapes, expressive handmade contours, 2-3 cel shadow values, no glossy AI painting. Each full body entirely in its own cell. Order row1: giant brown rat, green goblin scout with dagger, russet tusked boar lord, gray wolf, spotted gnoll archer. Row2: skeleton miner holding pickaxe, venomous yellow scorpion, large purple cave ogre chief, orange scaled lizard, purple flying vampire bat. Row3: ancient bulky stone guardian, dark hooded violet sorcerer, red winged wyvern, cursed armored knight holding sword, pale spectral banshee. Row4: giant purple black spider, red horned demon guard, fire elemental lord with molten hammer, small violet void warrior, large cosmic void overlord. All twenty readable silhouettes and complete bodies, each only one character, strong differentiated proportions; monsters have comparable visible heights in cells. No slime and no player mage in output.

### 장비·재화 시트

A production equipment and UI icon atlas for an indie fantasy comic game. Match the reference thick dark plum ink contours, angular flat cel colors, restrained paper grain. Exactly 4 columns and 4 rows, 16 completely isolated icons, generous margins, transparent background, no text letters grid frames scenery glow. Row1: crooked wooden wand with amber star tip, copper ring with red ruby, brown leather casting gloves, violet crystal orb. Row2: red rune staff with trident top, antique brass pocket hourglass, firelord angular gold crown, ancient chalice with tiny flame. Row3: thick leather spellbook with clasp, stack of 3 gold coins, orange flame essence crystal, violet arcane eye. Row4: orange phoenix with spread wings, chunky lava stone golem head, yellow lightning bolt, molten meteor. Each cell one centered readable icon, same relative size, 1024x1024 square. Handmade thick ink contours and only 2-3 cel values, NOT glossy painterly rendering. No mage character, no background plate.

### 몬스터 투명 배경 정리

Remove ALL colored background, ambient light, glow and halos from this exact 5x4 monster atlas. Keep all twenty creatures at EXACT same position and size, same image dimensions, same grid order. Preserve thick comic outlines and colors inside every creature. Empty space between creatures must be fully transparent alpha 0, not tinted or gradient. No shadows or backdrop. Do not add, remove, redraw, move, resize any character. Repair boundary spill so every full creature belongs only to its own cell with a tiny clear gap, especially dragon wings and ogre club. Production background extraction, exactly same atlas layout.
