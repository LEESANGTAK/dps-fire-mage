# 판타지 만화 스타일과 시전 동작

내장 이미지 생성 도구로 제작했습니다. 원본은 `assets/art/comic-*.png`에 저장합니다.

## 구현

마법사 6포즈 아틀라스를 게임 시간에 맞춰 재생합니다. 대기 / 준비 / 기모으기 / 발사 / 반동 / 몰열입니다. 팔·지팡이·옷자락은 각 포즈에서 다르게 그려져 있습니다. 독립된 관절 리깅이나 전 프레임 손그림 애니메이션은 아닙니다.

시전 진행률로 준비와 기모으기를 나누며, 실제 주 탄환 발사 함수에서 발사 자세로 즉시 전환합니다. 추가 탄환은 동작을 재시작하지 않습니다. 발사 후 반동과 복귀 시간을 게임 루프에서 관리해 모달 중 정지합니다. 몰열과 발화는 강화된 별도 자세를 사용합니다. 지팡이 끝이 투사체 출발점입니다.

아틀라스 생성 결과의 발 높이와 발사 포즈 폭을 CSS에서 보정했습니다. 반동 칸에 걸친 옆 포즈는 클리핑으로 제거합니다. 모션 감소 설정은 탄성 변형을 줄이되 시전 상태를 표현하는 포즈는 유지합니다.

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
