# 참고 이미지 기반 메테오 고도화

## 적용

- 사용자 첨부 이미지의 거친 암석 덩어리·어두운 표면·밝은 용암 균열·길고 밝은 화염 꼬리를 우선 반영했습니다. 둥근 광채와 단색 다각형을 전용 원화로 교체했습니다.
- 내장 image_gen으로 투명 원화 `assets/art/comic-meteor.png`(1536×1024 RGBA)를 새로 제작했습니다. 전투·메테오 스킬 버튼·주문서·연마·피해량 아이콘에 적용했습니다. 기존 이미지 파일은 덮어쓰지 않았습니다.
- 원화는 오른쪽을 향하게 생성하고 실제 궤적의 접선에 맞춰 회전합니다. 암석을 계속 회전시키지 않아 꼬리가 진행 방향 앞으로 돌아가지 않습니다. 완만한 호와 가속을 사용하며 낙하 시간 0.96초와 적중 시점의 피해 판정은 유지합니다.
- 암석 중심을 원화 가로 78%·세로 57%로 측정해 도착 위치에 맞췄습니다. 앞쪽 암석과 뒤쪽 꼬리를 분리해 꼬리에만 약한 잔상을 추가했습니다.
- 불씨는 시간 기준 생성, 최대 48개·전체 입자 220개 기준으로 제한했습니다. 충돌 파편도 최대 48개입니다. 일반 충돌 화염은 30개 기준으로 줄였고, 화면 흔들림은 작은 자동 운석에서 제외하며 큰 운석도 최소 0.3초 간격으로 제한합니다.
- 모션 감소 설정에서는 꼬리 입자·충돌 파편·충격파·추가 화면 흔들림을 생략하고 적중 불씨를 6개로 줄입니다. 모달 중 운석·예고 마법진·파편 시간을 정지하여 팝업 뒤에서 운석 피해가 발생하지 않게 했습니다.
- 스킬 피해량·몰열 조건·일반 쿨타임은 변경하지 않았습니다. 배경 조명·움직임 제거 요청도 유지했습니다.

## 확인한 참고자료

- 사용자 첨부 `codex-clipboard-07562f57-0aa3-40e8-af55-5b40db287ac7.png`를 직접 열어 검토했습니다. 거친 어두운 돌이 발광에 가려지지 않고, 붉은 균열에서 꼬리의 노란 중심으로 이어지는 명암을 반영했습니다. 게임 방향에 맞춰 좌우 방향을 재해석했습니다.
- [Tiny Speck / Esthar의 Meteor (Glitch)](https://opengameart.org/content/meteor-glitch): 제작자 설명의 11프레임 구성과 [정적 원본](https://opengameart.org/sites/default/files/meteor0021.png), [GIF 미리보기](https://opengameart.org/sites/default/files/Untitled-3.gif)를 브라우저에서 직접 열었습니다. 앞쪽 돌·뒤쪽으로 좁아지는 불꽃·분리된 불씨를 확인했습니다. GIF 화면 캡처를 검토했으며 전체 연속 재생의 타이밍을 검증했다고 주장하지 않습니다.
- 앞서 직접 확인한 [Animated Fire 60프레임 시트](https://opengameart.org/sites/default/files/fire1_64.png)의 불꽃 높이 변화와 끝에서 떨어지는 불씨 형태를 재사용했습니다. 원본 에셋을 복제하지 않았습니다.

## 검증

- 실제 렌더 함수를 Canvas에서 실행해 낙하 30%·65%·92% 자세와 화염 꼬리 방향을 확인했습니다. `docs/2026-10-04-meteor-preview.png`는 배경과 합성한 렌더 검토 이미지입니다.
- 궤적의 출발·도착·가속, 꼬리 전용 잔상, 이미지 미로딩 대체 그림, 30/60/144Hz 입자 제한, 파편 상한, 적중 콜백 1회, 모달 낙하·피해 정지, 모션 감소 시 충돌 분기를 테스트했습니다.
- 기존 메테오 연계·스킬 설명·마법사·몬스터·배경 테스트 및 JavaScript 구문·공백 검사 통과.
- 실제 브라우저 게임 화면의 캐릭터·UI와 결합한 저속/고속 연속 시전 및 성능 검증은 기존 로컬 접근 보안 제한으로 수행하지 못했습니다. 원화 렌더와 실행 함수 검증 범위를 구분합니다.

## 최종 프롬프트

내장 image_gen, `transparent_background: true`, 사용자 첨부 파일을 참고 이미지로 제공했습니다.

> Use case: stylized-concept. Create one ORIGINAL standalone transparent PNG projectile sprite for a fantasy comic RPG meteor, inspired by the provided reference image as a material and silhouette reference only. Do not reproduce its background or photographic style. HORIZONTAL orientation: meteor rock points and travels to the RIGHT, blazing tail stretches LEFT behind it. A hefty irregular elongated jagged dark basalt boulder in the right half, with visibly dark charcoal/plum rock facets, rugged craters, bright branching orange molten cracks and a few yellow-white fissure cores. Rock must remain opaque dark and clearly identifiable, not a fireball or a smooth round ball. A long tapered plume of turbulent gold/yellow/orange flames streams left from its rear, with 3 broad readable flame tongues, red-orange edges and sparse small detached embers. Thick dark plum cartoon outlines, clean cel shaded fantasy hand painted art matching game sprites. Entire sprite centered with transparent margins on ALL sides, landscape 3:2 canvas, rock impact center at about 73% width and 50% height. Visible rock about one third of overall sprite width. No ground, explosion, motion streak background, scenery, smoke cloud, text, numbers, border or UI. User reference dark rock and molten cracks have highest priority. Web reference observed Glitch meteor: distinct leading stone with tapered trailing flames, used only as broad shape guidance. Deliver crisp full asset with genuine alpha transparency.

