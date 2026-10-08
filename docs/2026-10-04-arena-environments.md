# 페이즈별 전장 — 이전 만화 원화 제작 이력

> 📌 **2026-10-09 레거시 정리 이후 상태:** 로그라이크 덱빌딩 전환으로 승천과 Stage 21 이후 무한 심연이 제거되어 게임은 Stage 20(화염 성채)에서 끝납니다.

현재 게임은 전 지역 페이퍼크래프트 배경을 사용합니다. 현재 에셋·연결·참고·검증은 루트의 `PAPER_ARENAS.md`를 기준으로 확인합니다. 아래는 2026-10-04 구현·후속 정리의 역사 기록이며 당시 제거된 조명·클릭 반응은 현재 사용하지 않습니다.

## 후속 수정: 추가 효과 제거

사용자 요청에 따라 추가 조명·빛기둥·반짝임·움직이는 꽃/톱니/불길/파편·주변 입자·광원 클릭 반응을 제거했습니다. 페이즈별 원화와 전환, 가독성을 위한 정적 암부만 유지합니다. 전환 완료 후에는 매 프레임 배경을 다시 그리지 않습니다. 미리보기 이미지도 현재 정적 배경으로 갱신했습니다. 배경 선택·전환·정적 유지 테스트 및 구문 검사가 통과했습니다. 아래는 최초 구현의 참고자료와 생성 기록입니다.

## 적용

- 1~5: 황혼의 초원, 6~10: 잿빛 폐광, 11~15: 화산 유적, 16~20: 화염 성채, 21 이후: 공허의 경계. 이전 스테이지·승천·저장 복원도 현재 스테이지에서 배경을 선택합니다. 무한 페이즈는 공허 배경을 유지합니다.
- 내장 image_gen으로 독립 원화 5개를 생성해 `assets/art/arena-{meadow,mine,ruins,citadel,void}.png`에 저장했습니다. 기존 배경은 덮어쓰지 않았습니다. 모두 1536×1024 PNG이며 브라우저 원본 비율에 맞춰 전장 전체에 렌더링합니다.
- 원화의 주변 광원 위치를 직접 확인한 뒤 테마별 조명 위치를 조정했습니다. 빛의 호흡·주변 빛기둥·발광 꽃의 흔들림·폐광의 작은 톱니 진동·불꽃과 불티·공허 파편의 부유를 Canvas로 추가했습니다. 원화 자체의 나무·광차·기둥 전체를 관절 애니메이션으로 바꾸지는 않았습니다.
- 움직임은 사인 곡선과 부드러운 보간을 사용합니다. 입자는 12~18개를 재사용 계산하며 누적하지 않습니다. 새 페이즈는 이미지 로드 후 0.9초간 전환합니다. 현재·다음 이미지만 미리 읽고 전체 캐시는 5개를 넘지 않습니다.
- 전투보다 낮은 독립 레이어이며 입력을 가리지 않습니다. 중앙 투사체 경로는 입자에서 제외했습니다. 작은 주변 광원을 누르면 짧게 빛이 반응하며 버튼·캐릭터 입력은 기존 동작을 유지합니다.
- 모달·문서 숨김에서는 배경 시간을 정지하고, 모션 감소 설정에서는 입자·소품 움직임·전환 애니메이션을 끕니다. 정적 원화와 약한 조명은 유지합니다.

## 직접 검토한 레퍼런스

- [Genevieve St-Michel의 Book of Heroes Board](https://lazypixel.artstation.com/projects/DAYKXA): 제작자 원문에서 네 모서리에 이야기와 분위기를 배치하고, 전개가 많은 게임에 단순한 보드를 사용했다는 설명을 확인했습니다. 원본 페이지의 보드 이미지와 [실제 보드 영상](https://www.youtube.com/watch?v=tfYY-sZw4P4)을 열어 0:03과 0:23의 재생 프레임을 직접 확인했습니다. 양피지 중앙의 여백, 책·두루마리·보석·금색 소품의 주변 배치와 책 문양의 발광 변화를 확인했습니다. 전체 영상의 모든 상호작용을 관찰했다고 주장하지 않습니다.
- [Robin Dao의 March of the Lich King Board](https://robindao.artstation.com/projects/WB5GyD): 원문에서 모형·텍스처·애니메이션·VFX·상태에 따른 상호작용을 제작했다는 설명을 확인했습니다. 이 페이지의 임베디드 영상은 직접 재생하지 못했으므로 시각·동작 검증의 근거로 삼지 않았습니다.
- 앞서 검토한 [Animated Fire 원본 60프레임](https://opengameart.org/sites/default/files/fire1_64.png)의 높이가 다른 불꽃과 밝은 중심을 주변 화염 표현에 재사용했습니다.
- 적용 판단: 원본의 주변 소품과 조용한 중앙이라는 구도를 횡방향 전투에 맞게 재해석했습니다. 화면 전체의 움직임 대신 위치별 짧고 작은 반응을 선택했습니다. 원본 에셋을 복제하지 않았습니다.

## 검증

- 실제 배경 제어기 테스트: 페이즈 경계·무한 구간·역주행·승천 선택, 모달 정지, 모션 감소, 로드 지연, 전환, 클릭 반응, 크기 변경, 캐시 5개 및 입자 개수 상한 통과.
- 기존 메테오·스킬 설명·마법사·몬스터 테스트와 JavaScript 구문·변경 파일 공백 검사 통과.
- 실제 배경 렌더 함수를 네이티브 Canvas에서 실행해 조명·소품·원화 합성 결과를 직접 확인했습니다. 720×480에서 120프레임 평균 약 0.2~0.3ms였으며 이 수치는 브라우저·모바일 성능 보장이 아닙니다.
- `docs/2026-10-04-arena-environments-preview.png`와 페이즈별 미리보기는 배경 렌더 검토 이미지입니다. 실제 게임 화면 캡처가 아닙니다.
- 로컬 게임 브라우저 접근은 기존 보안 제한으로 불가능하여 캐릭터·UI와 결합한 실제 화면 및 모바일 전투의 최종 검증은 하지 못했습니다.

## 최종 생성 프롬프트

내장 image_gen, `transparent_background: false`. 각 요청은 아래 머리말, 대상 문장, 공통 구도를 순서대로 연결했습니다.

머리말:

> Use case: stylized-concept. Asset type: full wide 3:2 battle arena background for hand drawn fantasy cartoon RPG.

대상별 문장:

- meadow: Twilight meadow and enchanted woodland, mossy stone path, framing roots and bushes at outer edges, distant hills, warm lantern on a wooden post at x12% y45%, blue bioluminescent flowers at x89% y65%, leafy bough at top left. Jade teal and muted ochre palette.
- mine: Abandoned fantasy mine and cave, rustic timber support beams at edges, layered purple stone cavern, quiet earthen stone combat floor, hanging copper lantern at x12% y45%, glowing blue crystal cluster at x89% y65%, small gear and minecart confined to outer edges. Muted violet slate and warm brass palette.
- ruins: Volcanic ancient ruins, broken carved pillars framing edges, distant red fissure in dark basalt cliff, dark flat stone combat floor, ember brazier at x12% y45%, molten crack at x89% y65%, tattered pennant at top left. Charcoal red and muted burnt orange palette.
- citadel: Fire lord's imposing fortress interior, heavy obsidian Gothic arches framing edges, distant dark throne chamber, large flat ash stone combat floor, gold iron brazier at x12% y45%, molten window at x89% y65%, heavy hanging iron chain at outer edge. Dark plum charcoal and rich muted ember gold palette.
- void: Otherworldly void temple, broken floating stone arches at outer edges, distant indigo cosmic rift, grounded flat purple slate combat platform, small violet crystal beacon at x12% y45%, cyan magical stone at x89% y65%, tiny floating fragments confined to edges. Indigo purple teal palette.

공통 구도:

> Composition must be side-view battle stage facing a flat wall/background, horizon and floor contact at exactly 72% image height; broad uninterrupted floor across entire width. Keep central x20%-80% and y35%-78% calm, empty and low contrast for two battling characters, not a top-down card board. Environment props only around outer edges. No characters, monsters, UI, text, numbers, logos. Thick dark plum comic ink outlines, flat cel shaded shapes, slightly textured hand painted materials matching fantasy comic assets. Dark but readable, distinctive silhouettes and depth in distant layers. Avoid center glow, busy floor patterns and highly bright lights. No copied Hearthstone props. Original art inspired only by peripheral environmental storytelling and quiet center. Landscape 3:2, opaque complete background.

