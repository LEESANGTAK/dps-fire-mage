# 몰열 메테오와 전용 스킬 이미지

> 📌 **2026-10-09 레거시 정리 이후 상태:** 로그라이크 덱빌딩 전환으로 주문서·스킬 연마·장비 강화 패널과 특성 트리가 제거되었습니다. 전용 스킬 이미지는 액션바·소환물·바닥 효과에서만 사용합니다.

## 적용

- 거대 화염구를 제거하고 메테오를 3번 슬롯·160G 주문서로 이전했습니다. 후기 중복 주문서와 5번 슬롯은 제거했습니다. 불장판은 기존 6번 키를 유지합니다.
- 열기 2회 충전 시 메테오를 즉시 호출합니다. 화염구 시전·공통 대기·일반 메테오 쿨타임을 유지하며 몰열만 소비합니다. 메테오의 치명타로 몰열을 다시 충전하지 않습니다. 자동 시전은 몰열 메테오를 우선하고 일반 화염구를 유지합니다.
- 일반 메테오는 기본 2.5초 시전, 18초 쿨타임입니다. 가속·쿨타임 감소를 반영합니다. 운석 낙하 후 3.2배 주문 피해와 6초 연소를 유지합니다. 기존 거대 화염구의 해금·연마 보너스·자동 설정을 한 번만 이전합니다.
- 주문서·스킬 연마·장비 강화 패널은 남은 높이를 동일하게 배분하고 각 목록만 스크롤합니다. 미해금 패널은 기존 규칙대로 숨깁니다.
- 불의 정령·불장판·마력 폭주에는 각각 독립 PNG를 제작했습니다. 특성·연마·액션바·소환물·바닥 효과의 해당 위치에 적용했습니다. 명칭은 불사조로 통일했습니다.
- 불장판 원화는 몬스터 뒤 바닥 레이어에 배치합니다. 작은 호흡 변화·마지막 0.6초 페이드·초당 최대 12회 불티 생성 확률·전체 파티클 180개 제한을 적용했습니다. 모션 감소 시 호흡과 추가 불티를 끕니다. 정령은 기존 원화 변형·부유 모션을 사용하며 신규 관절 프레임 애니메이션은 아닙니다.

## 직접 확인한 레퍼런스

- [Antifarea의 정령 포함 RPG 스프라이트](https://opengameart.org/content/twelve-16x18-rpg-character-sprites-including-npcs-and-elementals): 제작자 설명과 [원본 시트](https://opengameart.org/sites/default/files/charsets_12_m-f_characters_3rdsheet_by_antifarea.png)를 열어 정령의 세로 몸체·팔·다리·방향별 실루엣을 확인했습니다. 눈과 두 팔이 있는 몸체를 적용해 구형 투사체와 구분했습니다.
- [BenHickling의 Animated fire](https://opengameart.org/content/animated-fire): 제작자 설명의 64×64·60프레임 정보와 [원본 연속 프레임](https://opengameart.org/sites/default/files/fire1_64.png)을 확인했습니다. 밝은 중심·붉은 외곽·불꽃 높이의 차이·분리된 불씨를 불장판 원화에 반영했습니다. 실제 재생 영상은 보지 않았습니다.
- [Spell Icon Collection](https://opengameart.org/content/spell-icon-collection-part-1): 제작자 설명과 [Burning hands 원본](https://opengameart.org/sites/default/files/burning-hands.png)을 열어 손 중심의 화염 마법 실루엣을 확인했습니다. 마력 폭주에는 장갑 낀 주먹과 방사형 불꽃 고리를 사용했습니다. 새 이미지에 새·날개·불사조는 없습니다.
- 원본 에셋은 복제하지 않았습니다. 세 원화는 내장 image_gen으로 새로 생성했습니다.

## 파일과 생성 프롬프트

- `assets/art/comic-fire-elemental.png`: 1254×1254 RGBA.
- `assets/art/comic-flame-patch.png`: 1536×1024 RGBA.
- `assets/art/comic-combustion.png`: 1254×1254 RGBA.
- `docs/2026-10-04-spell-art-preview.png`: 66px 아이콘·48px 정령·230×150px 바닥 원화의 Canvas 검토 이미지.

모든 요청에 `transparent_background: true`를 사용했습니다. 실제 공통 프롬프트:

> Create one standalone transparent PNG game asset, square canvas, centered with generous transparent margin, no text, no numbers, no border. Hand drawn fantasy cartoon game style, bold dark plum ink outlines, clean cel shaded orange/red flames and pale yellow hot cores, readable silhouette at 64 pixels.

각각 이어 붙인 대상 문장:

- 정령: A small sentient fire elemental character: upright dancing tapered flame torso, two distinct flame arms and hands, mischievous glowing eyes, broad shoulder silhouette, grounded lower flame feet. Full body, not a fireball, no projectile trail.
- 불장판: A broad low oval patch of burning ground seen in 3/4 perspective: charred cracked dark rock ellipse with molten orange cracks and several staggered upward licking flames. Wide horizontal silhouette, no sphere, no meteor or character.
- 마력 폭주: A fantasy spell icon showing a single mage gauntleted clenched fist bursting with surging magical flame, surrounded by a radial broken ring of orange fire and sharp sparks. Strong central hand silhouette. No bird, wings, phoenix, projectile or fireball.

세 요청의 공통 마무리 문장:

> Original illustration. References studied: Antifarea's elemental sprite silhouettes, BenHickling's animated fire sheet flame taper and white hot core, Warlock's Gauntlet burning hands icon hand-centered magical power. Reinterpret only these broad observations, do not copy. Crisp finished asset.

## 검증과 한계

- 실제 스킬 함수를 실행해 몰열 소비·시전 보존·쿨타임 중 사용·중복 소비 차단·일반 시전·연소·메테오 열기 재충전 금지를 검증했습니다.
- 기존 투자 이전을 여러 연마 단계에서 검증했고 두 번 이전해도 값이 변하지 않음을 확인했습니다.
- 5종 스킬 설명과 실제 시전·쿨타임·피해량 비교, 호버·포커스 팝업, 마법사 시전·모달 정지, 몬스터 20종 모션 및 크기 테스트가 통과했습니다.
- PNG 투명 채널과 축소 표시를 직접 확인했습니다. 원화는 구형 탄환·불사조와 실루엣이 다릅니다.
- 브라우저의 로컬 게임 접근이 보안 제한으로 차단되어 실제 게임 화면의 패널 높이·저속/고속 연속 시전·원화 배치 전체 검증은 하지 못했습니다. Canvas 원화 검토와 실행 함수 테스트 범위를 구분합니다.
