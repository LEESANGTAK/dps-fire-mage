# 사운드 출처·라이선스 기록

Steam 콘텐츠 설문(AI 공개)과 출시 전 권리 확인에 쓰는 기록입니다. 출처를 확인하거나 파일을 바꾸면 이 표를 함께 고칩니다.

## 판정 기준 (2026-10-25 확인)

| 출처 | 상업적 이용 | 조건 |
| --- | --- | --- |
| Gemini 음악 생성(Lyria) | 가능으로 판단 | Google 서비스 약관상 생성물 소유권을 주장하지 않고, 상업 이용을 막지 않습니다. 무료·유료 차이 없음. AI 생성물을 사람이 만든 것처럼 표기 금지. Steam AI 공개 필요 |
| ElevenLabs 효과음 | 유료 플랜: 가능 / 무료 플랜: `elevenlabs.io` 표기 시 가능 | 공식 효과음 페이지 기준. 만든 당시 플랜을 확인해야 합니다 |
| VARCO Sound (NC AI) | 유료 플랜(Lite 이상): 가능 / 무료 플랜: 불가 | 2026-10-26 확인. 아래 "VARCO Sound 약관 검토" 참고. 출처 표기 의무는 없음. Steam AI 공개 필요 |
| Fish Audio | 유료 플랜만 가능할 가능성이 큼 | 2차 자료 기준 무료 플랜은 개인·비상업 용도. 공식 약관 미확인 |
| YouTube에서 녹음한 음원 | **사용 불가** | 녹음(다운로드) 자체가 YouTube 약관에 어긋날 수 있고, 업로더가 실제 권리자인지·게임에 써도 되는 라이선스인지 알 수 없습니다. YouTube 오디오 보관함도 게임 등 YouTube 밖 사용을 공식적으로 보장하지 않습니다. 교체합니다 |

## VARCO Sound 약관 검토 (2026-10-26)

확인한 문서: [서비스 이용약관](https://terms.varco.ai/2b90435c2d7580279d4bd9b9dcd573ac)(2026-04-22 개정), [대한민국 특별약관](https://terms.varco.ai/2be0435c2d7580f99015e19a641c0f6a)(2025-12-05 시행), [요금 안내](https://varco.ai/home/ko/pricing?service=SOUND), [Sound 자주 묻는 질문](https://sound.varco.ai/#faq).

- **약관 본문만 보면 상업 이용 불가:** 제5조(서비스 이용 라이선스)는 '개인적이고 비상업적인 용도'로만 허락하고, 제12조(인공지능의 이용)는 출력값에 제5조를 적용하며 '회원 또는 회원의 회사 내부의 비즈니스 목적'으로 쓰라고 합니다.
- **유료 플랜이 예외:** 제5조 끝에 '요금표나 구매 주문에 따라 별도 라이선스를 구매하면 권리가 다를 수 있다'는 예외가 있고, 요금표의 권리 항목이 Free '상업적 이용 불가', Lite·Standard·Max '상업적 이용 가능'입니다. FAQ도 유료 플랜 생성물은 게임·영상·광고 등 상업 콘텐츠에 쓸 수 있다고 답합니다. → **유료 플랜에서 만든 소리는 게임에 써도 된다고 판단합니다.**
- **대한민국 특별약관:** 청약철회·환불·통지·준거법(대한민국 법, 중재 조항 미적용)만 바꾸고 라이선스는 건드리지 않습니다.
- **남는 위험:**
  1. 출력물의 소유권을 회원에게 준다는 조항이 없습니다. 소유가 아니라 이용 허락(라이선스)으로 봐야 합니다.
  2. **구독 해지 후에도 상업 이용 권리가 남는지** 약관·FAQ 어디에도 없습니다. 출시 뒤 구독을 끊을 계획이면 고객센터(support-ncai@ncsoft.com)에 서면으로 확인받아 답장을 보관합니다.
  3. 약관 본문의 '내부 비즈니스 목적' 문구가 판매용 게임 배포와 어긋나 보입니다. 요금표 예외로 풀린다고 보지만, 위 문의 때 'Steam에서 판매하는 게임에 포함해 배포' 가능 여부를 함께 묻습니다.
  4. 회사가 약관을 언제든 바꿀 수 있습니다. 결제 당일의 요금표·FAQ·약관 캡처를 아래 증빙에 두었습니다.
  5. 약관상 '보호되는 원본을 모방하는 콘텐츠' 생성이 금지됩니다. 프롬프트에 다른 게임 이름이나 특정 게임 소리를 흉내 내는 표현을 쓰지 않습니다.
- **증빙:** 요금표·FAQ·약관 2종을 2026-10-26에 캡처해 [license-evidence/varco-2026-10-26](license-evidence/varco-2026-10-26/README.md)에 두었습니다(결제 당일, 결제 2시간 뒤 캡처). 고객센터 답장, 소리별 생성 날짜·프롬프트는 개인 보관함에 보관합니다.
- **결제:** VARCO Sound **Lite**, 2026-10-26 21:18 KST 결제(첫 달 할인가 7,150원, 영수증 메일 수신). 영수증 원본 메일(`.eml`, 발신 서버 DKIM·SPF 검증 통과)과 PDF 사본은 저장소 밖 `D:/TakGames/_evidence/varco/`에 있습니다(개인정보라 저장소에 올리지 않고, `.gitignore`가 `.eml`을 막습니다). 다음 자동 결제는 2026-11-26이며, 해지하려면 그 전에 마이페이지 > 구독 관리에서 해지합니다.
- **생성 시점:** `meteor_explosion.wav`(21:34)·`meteor_fly.wav`(21:38) 모두 결제 이후 파일이라 유료 플랜 생성물입니다.

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

## 새 효과음 (VARCO Sound 유료 플랜)

| 파일 | 쓰이는 곳 | 길이 | 출처 | 비고 |
| --- | --- | --- | --- | --- |
| `meteor_fly.wav` | 메테오 낙하 | 5.1초(48kHz 모노) | VARCO Sound 유료 플랜, 2026-10-26 | 1.4초 지점에서 가장 커집니다. 낙하가 약 0.75~1초라 앞부분을 건너뛰고 틀어 착탄 순간에 정점이 오게 합니다(`METEOR_FLY_SFX_PEAK_SEC`). 착탄하면 멈춥니다 |
| `meteor_explosion.wav` | 메테오 폭발 | 5.2초(48kHz 모노) | VARCO Sound 유료 플랜, 2026-10-26 | 앞 무음 0.08초 중 0.06초를 건너뜁니다(`SFX_START_OFFSET`). 소리는 1.5초 안에 거의 끝납니다 |

## 예전 효과음 — **2026-10-26 전부 제거**

아래 12개(2026-09-29~10-02 추가)는 출처 문제로 파일과 코드 참조를 모두 지웠습니다. 새 효과음은 위 표에 적습니다. 출처는 2026-10-25에 개발자가 확인했습니다. 게임의 효과음 호출 지점과 효과음 볼륨 슬라이더는 남겨 두어, 새 파일을 등록하면 바로 소리가 납니다.

| 예전 파일 | 쓰이던 곳 | 길이 | 출처 | 조치 | 우선 |
| --- | --- | --- | --- | --- | --- |
| `fireball_fly.wav` | 화염구 비행 | 0.4초 | 하스스톤 마법사 영웅 능력 영상 녹음 | 제거됨 | **1** |
| `fireball_explosion.wav` | 화염구 적중 | 0.5초 | 하스스톤 영상 녹음 | 제거됨 | **1** |
| `fireball_explosion_critical.wav` | 화염구 치명타 적중 | 0.5초 | 하스스톤 영상 녹음 | 제거됨 | **1** |
| `fireball_ready.mp3` | 화염구 시전 중 반복음 | 134초(반복) | 하스스톤 영상 녹음 | 제거됨 | **1** |
| `item_select.wav` | 카드 선택 | 0.8초 | 하스스톤 영상 녹음 | 제거됨 | **1** |
| `burning.mp3` | 화상 반복음 | 75초(반복) | 모름 | 제거됨 | 2 |
| `drop_coin.mp3` | 골드 획득 | 1.1초 | 모름 | 제거됨 | 2 |
| `meteor_fly.mp3` | 메테오 낙하 | 3.0초 | 모름 | 제거됨 | 2 |
| `meteor_explosion.mp3` | 메테오 폭발 | 3.0초 | 모름(ffmpeg 변환 흔적) | 제거됨 | 2 |
| `swish.mp3` | 휘두르기 | 0.3초 | 모름 | 제거됨 | 2 |
| `monster_destroy.mp3` | 몬스터 처치 | 1.0초 | 모름 | 제거됨 | 2 |
| `Summoning the Fire Spirit.mp3` | 정령 소환 | 1.2초 | Fish Audio 무료 플랜 | 제거됨 | 2 |

- **우선 1(하스스톤 녹음 5개):** 블리자드 저작물입니다. 블리자드 IP 명칭을 뺀 것과 같은 이유로 출시 전에 반드시 교체합니다. 게임의 핵심 손맛인 화염구 소리라 플레이어가 알아챌 가능성도 큽니다.
- **우선 2:** 출처를 증명할 수 없거나(6개) 상업 이용이 막힌 무료 플랜(1개)입니다.
- 웹 빌드(GitHub Pages)에 예전 파일이 남아 있으니 웹 빌드도 다시 배포합니다.

## 새 효과음 사양 (VARCO Sound)

- **플랜:** VARCO Sound 유료 플랜에서 만듭니다(2026-10-26 결정, 처음 검토한 ElevenLabs 대신). 상업 이용 조건은 위 판정 기준 표에 확인해 적습니다.
- **기록:** 파일마다 생성 날짜·프롬프트를 아래 표의 '최종 프롬프트' 칸에 남기고, 생성 기록 화면을 캡처해 둡니다.
- **프롬프트 주의:** "Hearthstone", "Blizzard", "World of Warcraft" 같은 이름이나 특정 게임 소리를 흉내 내는 표현을 쓰지 않습니다. 결과물이 원본과 비슷하게 들리면 다시 만듭니다.
- **등록:** 새 파일을 `assets/sounds/sfx/`에 넣고 `src/scripts/game.js`의 `FIREBALL_SFX_FILES`(키별 경로), `BURNING_LOOP_SFX_FILE`·`FIREBALL_CAST_LOOP_SFX_FILE`(반복음)에 경로를 적습니다. 예전 파일 이름은 테스트가 막으니 새 이름을 씁니다(예: `fireball_fly_v2.wav`). 아래 표의 파일 칸은 쓰일 곳을 가리킵니다. 44.1kHz, 짧은 소리는 앞의 무음을 잘라 입력과 소리 사이의 지연을 없앱니다. 12개의 음량을 서로 맞춥니다(최대 -1dB 근처).
- **화풍:** 만화풍·페이퍼크래프트. 묵직한 실사 폭발보다 짧고 경쾌하며 또렷한 소리. 화염구는 초당 여러 번 터지므로 귀가 피곤하지 않게 꼬리를 짧게 합니다.
- **강약(AGENTS.md 2장):** 일반 적중 < 치명타 적중 < 메테오 폭발 순으로 무게를 키우고, 몬스터 처치는 종이가 터지는 재질감으로 따로 구분합니다.

| 파일 | 길이 | 프롬프트 초안(영어) | 최종 프롬프트 |
| --- | --- | --- | --- |
| `fireball_fly.wav` | 0.3~0.5초 | short cartoon fireball whoosh flying past, crackling flame, bright and snappy, no reverb tail | |
| `fireball_explosion.wav` | 0.4~0.6초 | small cartoon fire burst impact, soft pop with crackle, punchy and short, game hit sound | |
| `fireball_explosion_critical.wav` | 0.5~0.8초 | heavier cartoon fire explosion, sharp crack plus bass thump and sparkle, satisfying critical hit, short tail | |
| `fireball_ready.mp3` | 4~6초, **이음매 없는 반복** | magical fire energy charging in hand, steady crackling flame hum, seamless loop, no build-up or ending | |
| `burning.mp3` | 6~8초, **이음매 없는 반복** | gentle steady burning fire crackle, small flames on paper, seamless loop, calm, no pops louder than the rest | |
| `item_select.wav` | 0.5~0.8초 | magical card pick confirm, paper card flip with warm chime and tiny flame shimmer, UI sound | |
| `drop_coin.mp3` | 0.5~1초 | a few cartoon gold coins landing and clinking, bright and cheerful, short | |
| `meteor_fly.mp3` | 2~3초 | large flaming meteor falling from the sky, rising roaring whoosh that ends right before impact | |
| `meteor_explosion.mp3` | 1.5~3초 | big cartoon meteor impact explosion, deep boom with rumble and scattered debris, punchy start | |
| `swish.mp3` | 0.2~0.4초 | quick magic staff swing swish, light air whoosh | |
| `monster_destroy.mp3` | 0.8~1.2초 | cartoon paper monster bursting apart, papery crumple and puff with a satisfying pop | |
| `Summoning the Fire Spirit.mp3` | 1~1.5초 | summoning a small fire spirit, rising magical whoosh into a warm flame ignite with sparkle | |

- 반복음 2개는 VARCO Sound에 반복(loop) 옵션이 있으면 켜고, 없으면 만든 뒤 앞뒤를 겹쳐 이음매를 다듬습니다. 게임에서 몇 바퀴 돌려 이음매가 들리지 않는지 확인합니다.
