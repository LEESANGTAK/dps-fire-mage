# 판타지 만화 스타일과 시전 동작

내장 이미지 생성 도구로 제작했습니다. 원본은 `assets/art/comic-*.png`에 저장합니다.

## 구현

일반 화염구와 불꽃 작렬은 대기 그림의 소매·손·지팡이 영역을 분리해 어깨를 중심으로 작게 회전합니다. 몸과 발은 고정하며 준비 각도 약 4도, 발사 목표 각도 약 10도로 제한합니다. 감쇠 스프링으로 준비·발사·반동을 연결하고, 반복 발사는 목표 각도만 갱신하므로 초고속 시전에서도 회전량이 누적되지 않습니다. 원본 한 장을 분할한 간단한 관절 방식으로, 새로 그린 전 프레임 애니메이션은 아닙니다.

거대 화염구는 준비 / 기모으기 / 발사 / 반동 포즈를 사용하고 발화는 강화 자세를 사용합니다. 몰열 준비는 기존 광채 UI로 표시해 치명타마다 몸 자세가 바뀌는 시각적 피로를 줄입니다. 추가 탄환은 동작을 재시작하지 않습니다. 실제 팔 각도로 계산한 지팡이 끝이 투사체 출발점이며 모달 중 동작 시간은 정지합니다.

아틀라스의 실제 발 픽셀과 지팡이 끝을 기준으로 Canvas에 정렬합니다. 모든 포즈가 같은 발 원점을 사용하고, 두 배우를 배경 바닥선에 고정합니다. 수평 띠 변형으로 발은 고정한 채 상체와 옷·모자에 관성 차이를 주며, 짧은 포즈 혼합과 스프링으로 전환을 연결합니다. 모션 감소 설정은 탄성 변형과 혼합을 제거하고 상태별 포즈는 유지합니다.

## 애니메이션 12원칙 적용

| 원칙 | 적용 |
|---|---|
| 스쿼시·스트레치 | 발 원점을 기준으로 몸의 가로 압축과 세로 복원 |
| 사전 동작 | 실제 시전 진행률에 맞춘 수축·기모으기 |
| 스테이징 | 같은 바닥선, 배우 사이의 빈 공간, 상태 신호 분리 |
| 직진법·포즈법 | 6개 핵심 포즈와 매 프레임 물리 변형을 함께 사용 |
| 팔로스루·오버래핑 | 몸보다 느린 옷·모자 스프링과 투사체 잔상 |
| 슬로우 인·아웃 | 감쇠 스프링, 비등속 투사체 가속 |
| 호 | 화염구 상향 곡선, 상체의 곡선 변형 |
| 보조 동작 | 발을 들지 않는 미세 호흡과 시전 준비 불꽃 |
| 타이밍 | 발사·반동·복귀 구간, 치명타의 0.03초 시각적 멈춤 |
| 과장 | 거대 화염구의 1.45배 몸 반응과 큰 투사체 |
| 견고한 형태 | 포즈별 동일한 원본 축척, 발과 지팡이 끝 기준 정렬 |
| 매력 | 선택한 만화풍의 굵은 실루엣과 각진 불꽃 형태 유지 |

마지막 두 원칙과 스테이징은 디자인 기준이며 별도의 물리 알고리즘을 의미하지 않습니다. 일반 시전의 팔만 단일 관절로 분리하며, 강화 포즈는 아틀라스를 사용합니다. 시각적 멈춤은 배우에만 적용하고 피해량·쿨다운 계산은 유지합니다.

화염구 비행·시전 준비·타격 표식을 만화풍 이미지로 통일했습니다. 기존 화염구는 이모지가 아니라 원형 그라데이션이었으며, 이모지 타격 표식도 제거했습니다. 소환수와 후반 콘텐츠의 기존 이모지는 이번 범위에 포함되지 않습니다.

배경·초반 슬라임·핵심 스킬 아이콘도 ②의 만화풍으로 변경했습니다. 후반 몬스터·장비·특성은 아직 기존 아트입니다. 피해량·시전시간·세이브 형식은 바꾸지 않습니다.

## 검증

- `node mage-motion.test.cjs`: 시전시간 0.4 / 1.5 / 2.5초, 몰열, 발사 우선순위, 반동, 복귀, 발화, 일시정지 및 재개
- 브라우저 실제 클릭으로 준비 → 기모으기 → 발사 → 반동 → 대기 순서 확인
- 몰열 즉시 발사와 발화 상태, 모바일 390픽셀 배치, 브라우저 오류 확인

## 생성 프롬프트 원문

### animationPrompt

Use case: stylized-concept. Production animation sprite atlas, exactly 3 columns by 2 rows, 1536x1024, six equal 512x512 cells, transparent background, NO text, labels, lines, borders or scenery. Reference is only for character design and bold ink comic STYLE. Extract the tiny red bent-hat mage from the reference and depict SAME character in six clear key poses, full body facing RIGHT in every cell. Thick ink outlines, flat plum shadow and burnt coral robes, bone cuffs, black featureless face with two yellow eyes, angular oversized bent pointed hat, tiny boots, crooked short staff with amber tip. Keep exactly same scale, foot baseline at 87 percent of each cell, centered pelvis at 43 percent width, complete hat and staff inside each cell, generous transparent margin. Row 1 left IDLE: upright relaxed, staff diagonally forward, sleeves low. Row 1 middle ANTICIPATION: crouch deeply on bent knees, lean back, elbow and staff pulled back close to chest, hat folding backward, robe compressed. Row 1 right CHARGE: leaning back, raised elbow, staff drawn back, tiny gathered flame held close, intense coiled posture. Row 2 left RELEASE: knees straight, lunge upper body forward, arm sleeve visibly extended horizontally toward RIGHT, staff thrust to right, open hand, NO projectile beyond staff tip. Row 2 middle RECOIL: elbow folding inward, torso pushed backward, knees bent, hat and coat tails trailing toward right, visibly different from release. Row 2 right HOT STREAK: wide rooted stance, raised staff and free hand holding compact molten flame, ready powerful pose. All six must have distinctly different arm, staff and torso poses, NOT merely translated copies. Maintain graphic handmade indie fantasy comic style, not glossy digital painting. Transparent alpha throughout empty space.

### animationRefinePrompt

Edit the provided 3x2 six-pose mage animation atlas into a clean production sprite sheet. Preserve the exact character, flat comic ink style and the six poses in the same order. CRITICAL CORRECTIONS: truly transparent background, remove ALL ambient colored halos; each pose MUST fit completely inside its own 512x512 cell, including the staff, with at least 50 pixels empty margin on every side. Reduce all characters to equal scale so the full release arm and staff are NOT clipped and do NOT spill into neighboring cells. Align every pair of feet at exactly y=440 within its own cell, including bottom row, and align body pelvis at x=240 within each cell. Keep same head size in all poses, no stretching. Exactly 1536x1024 canvas, 3 columns 2 rows; no visible grid or labels. All six are same right-facing red hooded bent-hat mage. Preserve different arm poses: idle, crouched anticipation, pulled-back charge, fully extended rightward release, recoiling folded arm, upright hot-streak raised staff. Every cell must have clean transparent empty edges. Production sprite atlas, no scenery, no text.

### comicArenaPrompt

Production landscape background 1536x1024 for a compact combat game. Use reference ONLY for bold ink fantasy comic STYLE. Empty dark dueling alcove with broad angular charcoal-plum stone blocks, few rough cracks, dusty lavender stone floor at lower half, subtle arch shapes far back. No characters, NO UI, no text, no spells. Quiet negative space at center and lower half for mage and slime. Thick hand-inked contours, flat cel colors, only 3 muted values, subtle print grain. No ornate trim, no braziers, no bright focal points, no realistic lighting, no detailed brick pattern. Foreground floor visibly flatter and simpler than reference so fire reads strongly.

### comicSlimePrompt

Production single full-body green slime sprite on transparent background. Use reference as STYLE and slime design reference. Squat rubbery pear-shaped slime facing LEFT, angry chunky eyebrows, two pale yellow eyes, single crooked ivory tooth, mottled olive green body, lime highlights, deep plum outlines, flat cel shapes, thick expressive ink line, hand drawn indie fantasy comic, restrained print grain. Centered complete body and droplets in frame with generous empty margins. NO scenery UI letters or frame, no glossy painted rendering. 1024x1024.

### comicIconPrompt

Production square 2x2 spell icon atlas, four equal cells, no grid, text, labels or frames. Use reference only for thick hand inked fantasy comic style. Top left orange fireball with jagged ivory core; top right yellow angular explosive burst; bottom left red molten boulder with bold black rocky shape; bottom right sharp orange phoenix silhouette. Flat 2-3 cel colors per icon, plum-black quiet background, chunky graphic shapes readable at 48px, sparse subtle print grain, no realistic lighting or glossy volumetric bloom. Same distinctive hand-drawn language as the mage reference. 1024x1024.

## 화염구 로딩 수정

노란 마름모는 이미지 로딩 전 대체 도형이었습니다. 투명 여백을 실행 중 픽셀 읽기로 찾던 로직은 파일 실행 등의 환경에서 실패하면 계속 대체 도형을 보여줄 수 있었습니다. 원본의 영역 `[119, 324, 1294, 387]`을 미리 지정해 픽셀 읽기를 제거하고, 이미지의 실제 로딩 완료 여부로 그립니다. 노란 도형은 제거했습니다. 로딩 오류는 콘솔에 표시합니다. 로컬 서버에서 실제 비행 이미지와 팔 시전 자세를 확인했으며, 픽셀 읽기가 불가능한 환경 및 0.02초 시전 입력을 회귀 검증했습니다.
