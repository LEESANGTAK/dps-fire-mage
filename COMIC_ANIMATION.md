# 현재 전투 아트와 시전 동작

## 현재 구현

2026-10-06부터 실제 `index.html`은 페이퍼크래프트 마법사와 22가지 몬스터 모습을 사용합니다. 마법사는 대기·준비·발사·반동 4포즈이며 발화는 대기 원화와 기존 오라를 조합합니다. 발과 지팡이 끝은 `paper-art.js` 좌표를 기준으로 고정합니다. 일반·강화 시전 모두 실제 발사 사건에서 원화를 즉시 교체하고 피해·쿨다운 계산을 지연하지 않습니다. 전신 스프링·팔 분할 회전·포즈 혼합은 현재 사용하지 않습니다.

마법사 대기는 12fps로 유지하는 작은 회전, 슬라임은 4포즈 교체, 나머지 몬스터는 재질에 맞는 종이 원화의 자세 유지·반동입니다. 모달 중 모션은 정지하고 모션 감소 설정에서는 보조 움직임을 줄입니다. 원화가 실제로 찢어지거나 관절별 중간 프레임이 있는 방식은 아닙니다.

화염구·착탄·불씨 꼬리와 점액 파티클은 `combat-art.js`의 기존 렌더러를 유지합니다. 종이 화염구로 바꾸지 않았습니다. 측면 점액 분출은 기존 사용자 스케치와 원화 윤곽을 유지하며 도트 피해에는 큰 반응을 반복하지 않습니다.

새 종이 원화·프롬프트·참고 조사·검증의 현재 기록은 `PAPERCRAFT_PREVIEW.md`, `PAPER_MONSTERS.md`, `PAPER_ARENAS.md`, `PAPER_UI.md`에 있습니다. 몬스터 재질 분기는 `MONSTER_MOTION.md`를 참고합니다.

## 적용 원칙

| 원칙 | 현재 적용 |
|---|---|
| 사전 동작·포즈법 | 준비 → 실제 발사 → 반동, 네 원화 교체 |
| 타이밍 | 원화 자세는 유지하지만 발사·피해 판정은 즉시 연결 |
| 스테이징·견고한 형태 | 동일 발 원점과 포즈 축척, 안정적인 정보 UI |
| 팔로스루·호 | 기존 화염 꼬리와 비등속 곡선 투사체 |
| 재질·과장 | 슬라임 포즈 탄성과 단단한 종이 배우의 반동 구분 |
| 보조 동작 | 작은 정지 자세 변경, 모달·모션 감소 준수 |

## 검증

`mage-motion.test.cjs`는 저속·고속 시전 포즈, 즉시 발사 우선순위, 지팡이 끝·접지, 정지·재개와 기존 화염 파티클 상한을 확인합니다. 실제 게임의 종이 마법사·몬스터 연결은 `PAPER_MONSTERS.md`의 화면 기록에 구분해 기록합니다.

## 이전 만화 원화 제작 기록

아래 프롬프트는 보관 중인 `comic-*.png`의 제작 이력입니다. 현재 종이 마법사와 몬스터의 렌더링 규칙을 설명하는 문서가 아닙니다. 기존 장비·상점 원화는 계속 사용합니다. 전투 스킬 버튼과 상단 상태 아이콘은 `PAPER_UI.md`의 종이 아틀라스로 교체했습니다. 화염 VFX 원화와 파티클은 계속 유지합니다.

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
