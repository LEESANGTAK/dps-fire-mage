# 푸른 정수와 스킬 설명 팝업

## 적용

- 정수 전용 투명 PNG: `assets/art/comic-essence.png`. 내장 image_gen 도구로 새로 제작했습니다. 1254×1254 RGBA이며 투명 배경을 확인했습니다.
- 푸른 구체를 상단 정수 재화, 마법부여 재화·구매 비용, 보상 안내, 치명타 정수 추출, 정수 획득 비행에 적용했습니다. 화염 스킬 아이콘은 유지합니다. 기존 곡선 흡수와 펄스 연출을 유지하며 비행 구체 안의 중복 화염 표시를 제거했습니다.
- 불꽃 작렬 숫자는 남은 충전 횟수입니다. 숫자 배경 대비를 높이고 팝업에 현재/최대 충전과 순차 충전 시간을 안내합니다.
- 6개 스킬의 마우스 오버·키보드 포커스 팝업을 구현했습니다. 시전시간·쿨타임·피해량·고유 특징을 현재 능력치와 숙련·특성 기준으로 계산합니다. 몰열·충전 상태는 표시 중 갱신합니다.
- 상세 정보는 160ms 머문 뒤 필요한 순간에만 표시합니다. 팝업으로 마우스를 옮겨도 유지하고 Escape로 닫습니다. 화면 가장자리 위치를 제한하고 모달·스크롤·창 크기 변경 시 닫습니다. 모션 감소 설정에서는 등장 애니메이션을 끕니다.

## 직접 확인한 레퍼런스

- https://opengameart.org/content/200-magic-orbs-psionic-dew
  - 제작자 설명의 부분 투명 구체와 배경별 표시 차이를 확인했습니다.
  - 원본 https://opengameart.org/sites/default/files/hjm-magic_orbs_1-alpha.png 를 브라우저에서 열어 청록·청색 구체의 밝은 내부 핵과 둥근 윤곽을 직접 확인했습니다. 정수에는 작은 크기에서도 읽히는 넓은 소용돌이와 명암을 사용합니다. 원본은 복제하지 않았습니다.
- https://opengameart.org/content/health-and-mana-orb
  - 설명과 원본 https://opengameart.org/sites/default/files/mana_orb_0.png 를 직접 열어 검토했습니다. 원본은 내용물이 채워진 파란 구체가 아니라 원형 UI 틀이었으므로 구체 색상 레퍼런스로 사용하지 않았습니다.
- https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
  - 원문에서 지연 표시, 포커스·호버, 팝업 위에 머물 때 유지, Escape 종료, tooltip 역할과 aria-describedby 관계를 확인해 적용했습니다. 해당 문서는 작업 중인 패턴임을 확인했습니다.
- 시각 스타일은 기존 특성 설명 패널의 어두운 바탕과 밝은 글자·금색 테두리를 재사용합니다.

## 최종 생성 프롬프트

Use case: stylized-concept. Asset type: single inventory currency icon for DPS Fire Mage, a hand inked fantasy comic game. Primary request: ONE blue glowing magical essence sphere, spherical cobalt blue outer shell and luminous cyan-white inner core, a few broad curved turquoise energy swirls INSIDE the sphere. Dark navy/plum bold ink contour, crisp flat cel shading, small bright highlight at upper left. Centered round silhouette occupies 85% of square, generous transparent edge for restrained halo. High legibility at 18-24px, simple 3-4 broad tonal shapes; no dense texture. True transparent background. No flame shape, no fireball tail, no orange, no text, no border, no pedestal, no extra objects. A new original design, not copying reference art. Output square PNG.

## 검증

- 생성 이미지의 구체 실루엣·내부 푸른빛·투명 배경을 직접 확인했습니다.
- 스킬 실행 함수를 사용해 6종 스킬의 시전시간·쿨타임·직접 피해 수치가 설명과 일치하는지 일반·강화 능력치 조합으로 검사했습니다. 숙련 증폭·몰열 즉시 시전·충전 설명을 검사했습니다.
- 정수 토큰이 화염 스킬과 다른 전용 이미지로 변환되는지 검사했습니다. 기존 마법사·몬스터·이미지 검사와 구문·공백 검사를 실행했습니다.
- 모의 DOM으로 호버 지연·팝업으로 이동 시 유지·Escape 종료·포커스 유지·터치 호버 무시·화면 가장자리 위치 제한·종료 후 갱신 타이머 정리를 검사했습니다.
- 브라우저 로컬 파일 접근 제한으로 실제 게임의 팝업 배치·호버 동작·모바일 화면·정수 비행에 대한 육안 확인은 미검증입니다.
