# 사운드 출처·라이선스 기록

Steam 콘텐츠 설문(AI 공개)과 출시 전 권리 확인에 쓰는 기록입니다. 출처를 확인하거나 파일을 바꾸면 이 표를 함께 고칩니다.

## 판정 기준 (2026-10-25 확인)

| 출처 | 상업적 이용 | 조건 |
| --- | --- | --- |
| Gemini 음악 생성(Lyria) | 가능으로 판단 | Google 서비스 약관상 생성물 소유권을 주장하지 않고, 상업 이용을 막지 않습니다. 무료·유료 차이 없음. AI 생성물을 사람이 만든 것처럼 표기 금지. Steam AI 공개 필요 |
| ElevenLabs 효과음 | 유료 플랜: 가능 / 무료 플랜: `elevenlabs.io` 표기 시 가능 | 공식 효과음 페이지 기준. 만든 당시 플랜을 확인해야 합니다 |
| Fish Audio | 유료 플랜만 가능할 가능성이 큼 | 2차 자료 기준 무료 플랜은 개인·비상업 용도. 공식 약관 미확인 |
| YouTube에서 녹음한 '무료 음원' | **위험** | 녹음(다운로드) 자체가 YouTube 약관에 어긋날 수 있고, 업로더가 실제 권리자인지·게임에 써도 되는 라이선스인지 알 수 없습니다. YouTube 오디오 보관함도 게임 등 YouTube 밖 사용을 공식적으로 보장하지 않습니다. **교체 권장** |

## BGM (5곡, `assets/sounds/bgm/`)

| 파일 | 게임 내 제목 | 출처 | 상태 |
| --- | --- | --- | --- |
| `Beneath_the_Heavy_Crown.mp3` | 무거운 왕관 아래에서 | Gemini(유료 구독), 2026-10-15~16 | ✅ |
| `Iron_Underneath.mp3` | 도사린 강철 | Gemini | ✅ |
| `Seven_Gates_of_Copper.mp3` | 구리의 일곱 문 | Gemini | ✅ |
| `Trial_by_the_Blade.mp3` | | Gemini | ✅ |
| `Weight_of_the_Deep.mp3` | | Gemini | ✅ |

- 생성 대화: https://gemini.google.com/app/140aebd05f9e2221 (개발자 계정으로 로그인해야 열림).
- 예전 BGM(Tavern Whimsy, Suno 무료 플랜)은 상업 이용이 막혀 있어 위 5곡으로 교체했습니다.
- **증빙 보관:** Gemini 대화 기록은 활동 기록 자동 삭제 설정에 따라 사라질 수 있습니다. 대화 화면 캡처(프롬프트·생성 날짜가 보이게)와 원본 음원 파일을 `docs/` 밖 개인 보관함에 따로 보관합니다.

## 효과음 (12개, `assets/sounds/sfx/`, 모두 2026-09-29~10-02 추가)

파일 안 태그에서 찾은 단서와 크기를 적었습니다. **출처 칸은 개발자가 채웁니다.**

| 파일 | 쓰이는 곳 | 단서 | 출처 | 조치 |
| --- | --- | --- | --- | --- |
| `fireball_fly.wav` | 화염구 비행 | 0.4초, 이름 태그만 | ? | |
| `fireball_explosion.wav` | 화염구 적중 | 0.5초, 이름 태그만 | ? | |
| `fireball_explosion_critical.wav` | 화염구 치명타 적중 | 0.5초, 이름 태그만 | ? | |
| `fireball_ready.mp3` | 화염구 시전 | **4.2MB**(효과음치고 매우 김) | ? | 녹음본이면 교체 |
| `burning.mp3` | 화상 반복음 | **2.9MB**(긴 반복 음원) | ? | 녹음본이면 교체 |
| `item_select.wav` | 카드 선택 | 0.8초, 이름 태그만 | ? | |
| `drop_coin.mp3` | 골드 획득 | 태그 없음 | ? | |
| `meteor_fly.mp3` | 메테오 낙하 | 태그 없음 | ? | |
| `meteor_explosion.mp3` | 메테오 폭발 | ffmpeg(Lavf) 변환 흔적 | ? | 녹음·변환본이면 교체 |
| `swish.mp3` | 휘두르기 | 태그 없음 | ? | |
| `monster_destroy.mp3` | 몬스터 처치 | 태그 없음 | ? | |
| `Summoning the Fire Spirit.mp3` | 정령 소환 | **fish.audio 작업 태그** | Fish Audio로 추정 | 만든 당시 플랜 확인 |

- ElevenLabs로 만든 효과음은 만든 당시 플랜이 무료였다면 크레딧에 `elevenlabs.io`를 표기하거나, 유료 플랜에서 다시 만듭니다.
- YouTube에서 녹음한 효과음은 권리 확인이 거의 불가능하므로 교체합니다. 대체 출처 후보는 ElevenLabs 유료 플랜 재생성, 상업 이용이 명시된 효과음 묶음(예: Kenney 오디오 팩 CC0, Sonniss GDC 무료 묶음), Freesound의 CC0 음원입니다. 쓴 묶음의 라이선스 파일은 저장소에 함께 둡니다.
