# 전투 아트 1차 적용

내장 이미지 생성 도구로 제작했습니다. 원본은 `assets/art/`에 보관합니다.

- `fire-mage.png`: 투명 배경 화염 마법사
- `slime.png`: 투명 배경 초반 슬라임 (2스테이지는 색상 변형)
- `skill-atlas.png`: 핵심 스킬 4종, 2×2 배열
- `arena.png`: 어두운 석조 전장

치명타 1회는 불꽃 작렬, 2회는 거대 화염구, 발화는 마법사와 전장 발광을 강조합니다. 게임 수치와 저장 형식은 유지합니다. 후속 몬스터·장비·특성·상점 아이콘은 기존 이모지입니다.

## 생성 프롬프트

### 스킬
Create a production game asset: a square 2 by 2 sprite atlas with exactly four equal square cells, no gutters, no text, no borders. Painterly collectible fantasy card-game art reminiscent of Hearthstone, chunky silhouettes, hand painted rich brushwork. Top left: a single orange fireball moving diagonally on dark burgundy. Top right: explosive gold-white fire burst with sharp radial impact on dark brown. Bottom left: enormous molten red meteor with black rocky core and streaming flame on dark crimson. Bottom right: a regal phoenix of white gold fire with spread wings on dark plum. Icons must each read clearly at 48 pixels, central composition, strong distinct silhouettes, quiet dark corners. Output 1024x1024.

### 마법사
Production game character sprite, full body centered, transparent background. Original elderly fire mage, painterly Hearthstone-like collectible fantasy card illustration, exaggerated chunky proportions, expressive determined face, swept silver beard, dark crimson and indigo robes with aged brass trim, sturdy boots, holding a carved staff with glowing amber crystal, other hand cupping a small fireball toward the right. Three-quarter view facing right, readable bold silhouette, warm fire rim lighting, hand painted brushwork, no frame, no lettering, no scenery, generous empty transparent margins, all feet and staff inside frame. 1024x1024.

### 슬라임
Production game monster sprite full body centered on transparent background. A mischievous emerald green grassland slime, painterly Hearthstone-like fantasy card illustration, chunky pear shaped jelly body, expressive squinting amber eyes, tiny toothy grin, a few grass blades and pebble embedded in jelly, translucent emerald highlights, low wide silhouette, facing left toward enemy mage, glossy hand-painted brushwork, no frame, no text, no scenery, all body inside frame with empty margins. 1024x1024.

### 배경
Production background plate for fantasy browser combat game, landscape 1536x1024. Painterly Hearthstone-inspired hand painted magical arena: ancient circular stone courtyard at dusk, distant ruined archways, dark blue misty forest, small warm braziers at outer edges, subtle worn arcane carvings in floor, rich stylized brushwork, chunky carved architecture. Wide quiet empty central and lower-middle combat space for two characters and fire projectiles. Background subdued low contrast deep navy teal and warm brown, brighter light only at far edges. No characters, no UI, no text, no cards, no logos.

## 검증 및 제한

JavaScript 구문, Git 공백, 실제 시전 및 몰열·발화 상태를 확인했습니다. 모바일 배치를 별도로 조정했습니다. 원본 PNG 총 약 8MB로 최초 로딩 비용이 있습니다.
