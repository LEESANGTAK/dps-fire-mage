# Steamworks 콘텐츠 설문 답변 초안

> Steamworks › 앱 관리 › 콘텐츠 설문(Content Survey)에 옮겨 적는 초안입니다. 제출은 계정 소유자가 직접 합니다.
> ⚠️ 표시는 **사용자 확인이 필요한 항목**입니다. 확인 전에는 제출하지 마세요.

## 1. 일반 콘텐츠
- 장르: 로그라이트(액션), 스피드런, 카드 선택, 싱글플레이
- 사용자 제작 콘텐츠(UGC), 채팅, 온라인 기능: 없음
- 실제 돈으로 사는 아이템·확률형 유료 상품(루트박스): 없음. 게임 내 골드는 카드 다시 뽑기에만 쓰이며 현금 거래가 없습니다.

## 2. 성인 콘텐츠
| 항목 | 답변 | 근거 |
| --- | --- | --- |
| 잦은 폭력 또는 유혈 | 아니오 (권장) | 만화풍 판타지 몬스터와의 마법 전투. 피·신체 훼손 없음. 처치된 몬스터는 불에 타 사라지는 만화 연출 |
| 일반 성인 콘텐츠 | 아니오 | |
| 성적 콘텐츠 / 성인 전용 성적 콘텐츠 | 아니오 | |
| 노골적 비속어 | 아니오 | |

"콘텐츠 설명" 칸 예시(영문):
> Cartoon fantasy combat against monsters using fire magic. Defeated monsters burn away in a stylized papercraft effect. No blood, gore, or realistic violence.

## 3. AI 생성 콘텐츠 공개 (필수)

### 사전 생성 콘텐츠(Pre-Generated): **예**
프로젝트 문서(`docs/art/PAPER_MONSTERS.md`, `PAPER_ARENAS.md`, `ART_CONCEPT_PROMPTS.md`, `FIREBALL_ART_PROMPT.md` 등)에 이미지 생성 도구로 원화를 만든 기록과 프롬프트가 남아 있습니다.

공개 문구 초안(영문, 스토어 페이지에 그대로 노출됩니다):
> Character, monster, background, and spell-effect artwork was created with the help of generative AI image tools, then selected, edited, and integrated by the developer (cleanup, compositing, and in-game animation). ⚠️[Music and sound effects were created with AI audio tools.] No AI content is generated while the game is running.

⚠️ **사운드 출처:** 파일별 기록은 `sound-sources.md`에 있습니다.
- BGM 5곡은 Gemini로 만들었으므로 대괄호 문장의 음악 부분은 남깁니다.
- 효과음은 ElevenLabs·Fish Audio로 만든 것과 YouTube에서 녹음한 것이 섞여 있습니다. YouTube 녹음본을 교체하고 남은 효과음이 모두 AI 도구 생성물이면 대괄호 문장을 그대로 둡니다. 효과음 묶음(라이선스 음원)이 섞이면 "Music and some sound effects were created with AI audio tools."처럼 고칩니다.

### 실시간 생성 콘텐츠(Live-Generated): **아니오**
게임 실행 중 AI가 콘텐츠를 만드는 기능이 없습니다.

참고: 코드 작성에 AI 코딩 도우미를 쓴 것은 플레이어가 보는 콘텐츠가 아니므로, 2026년 1월 개정 기준으로 공개 대상이 아니라는 해석이 있습니다(2차 출처). 제출 시점의 설문 문구를 확인해 판단하세요.

## 4. 함께 확인할 권리 관계
- 폰트: Jua, 나눔고딕 — SIL Open Font License(상업적 이용 가능, `assets/fonts/*-OFL.txt` 동봉).
- 최종 보스: 블리자드 IP(라그나로스) 요소 제거 완료 — 이름 '잿불의 폭군 이그나르크', 망치 제거.
