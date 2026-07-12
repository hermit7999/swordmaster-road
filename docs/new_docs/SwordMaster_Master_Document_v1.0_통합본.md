# 소드마스터의 길 — 통합 마스터 문서 v1.1

> 작성일: 2026-07-12 (v1.0) / 갱신: 2026-07-12 (v1.1 — ADR-008~010 확정 반영)
> 이 문서는 `docs/new_docs`의 GDD v0.1 ~ v3.7 및 Package01 Living Document(총 38개 문서)를 하나로 통합·정리한 것이다.
> 추후 이 문서를 기준으로 부족한 부분을 보완하여 최종 개발 기준 문서로 사용한다.
> **개발 전제**: 기존 프로토타입(TS+Vite, 판정 엔진·전투 스파이크)은 학습 자산으로 종료. 이 문서 기준으로 신규 개발한다. 단, 검증된 로직(판정 엔진 등)은 참고·이식 가능.

## 변경 이력
- v1.2 (2026-07-12): **전체 설계 완료.** Package 02~16 Living Document 작성, Sword Language Bible(패링 ✓ 확정), First 30 Minutes, 수익화 설계, 마스터 태스크 백로그(121 태스크) 완성. §18.6 진행 상태 갱신. 추가 채택: Duel=momentum 3상태(ADR-011 후보), 필드=횡스크롤(ADR-012 후보).
- v1.1 (2026-07-12): 플랫폼(ADR-008)·엔진(ADR-009)·제스처 알고리즘(ADR-010) 확정. §19 Open Questions 일부 종결.

## 설계 문서 전체 색인 (v1.2 기준 — 개발은 Master_Task_Backlog가 진행표)
- 검술: Sword_Language_Bible_v0.1
- P01: 기존 Gesture 5종 + Input_System_Spec(v3.4) + Input_Acceptance_Test_Spec + AI_Task_Spec_Input + Stage1_Final_Integration
- P02~16: SwordMaster_Package02~16 Living Documents (12개 파일)
- 경험: First_30_Minutes_Design / 수익화: Monetization_Design
- 실행: **Master_Task_Backlog_v1.0** (121 태스크, 마일스톤 M-A~M-G)

---

# 1. 프로젝트 개요

## 1.1 미션
**1인 개발자가 1년 내 완성할 수 있는 최고의 검술 액션 게임을 만든다.**
핵심은 거대한 오픈월드가 아니라 '마우스(제스처)로 검술을 직접 사용하는 재미'이다.

## 1.2 Core Vision
> 플레이어는 버튼으로 스킬을 사용하는 것이 아니라, 자신의 손으로 검술을 직접 시전한다.

## 1.3 한 줄 소개 (Pitch)
- 국문: 마우스로 검술을 직접 그리며 검성이 되어가는 액션 로그라이크.
- 영문: Draw your sword. Become the Sword Saint.

## 1.4 장르
Gesture Sword Action RPG (액션 로그라이크)
- 필드: 아케이드 액션 + 가벼운 RPG
- 보스: 검술 결투 (Duel Mode)

## 1.5 Core Identity (게임을 정의하는 5가지)
1. 손으로 직접 검술을 그린다.
2. 필드는 빠르고 시원하다.
3. 보스는 긴장감 있는 Duel Mode다.
4. 실력이 승패를 결정한다.
5. 성장은 실력을 보완한다.

이 다섯 가지를 해치는 기능은 추가하지 않는다.

## 1.6 Core Fun
- 내 손으로 검술을 직접 사용하는 재미
- 검술을 익히고 검객에서 검성으로 성장하는 재미
- 필드에서 시원하게 베는 재미
- 보스에서 긴장감 있는 결투를 하는 재미

## 1.7 Player Fantasy
최종 목표는 "검성"이 되는 것. 레벨보다 검술의 숙련이 중요하다.

## 1.8 경쟁/참고 게임 (복제 대상 아님)
- Vampire Survivors, Hades (로그라이크 구조)
- Sekiro (보스전 긴장감만 참고)
- Fruit Ninja (제스처 입력 참고)

## 1.9 차별점
왼손 이동 + 오른손 검술 제스처, 검술 중심 성장, 5분 로그라이크, 보스 결투(Duel Mode).

## 1.10 성공 기준
- "5분만 해야지" 하고 시작했는데 1시간이 지나 있는 게임.
- "마우스로 검술을 사용하는 게임은 처음이다"라는 평가.
- 플레이어가 다음 네 문장을 말하면 성공: "베는 맛이 좋다", "내 컨트롤이 늘었다", "이번 빌드 재미있다", "한 판만 더."
- Steam 목표: 긍정 평가 90% 이상, 평균 플레이타임 10시간 이상, DLC 확장 가능 구조.

---

# 2. 게임 구조 & 코어 루프

## 2.1 기본 구조
```
필드 탐험 → 몬스터 처치 → 검술 숙련 → 보스 발견 → Duel Mode 진입
→ 보스 처치 → 새 검술/성장 선택 → 다음 스테이지
```

## 2.2 일반전 : 보스전 비율 = 80 : 20
- 필드: 빠른 템포, '압도'가 목표. 일반 몬스터는 5~10초 내 처치.
- 보스: 긴장감 있는 1:1 결투.

## 2.3 플레이 세션
- 1스테이지 ≈ 5분, 5스테이지 = 한 판 약 30~40분. 로그라이크 반복 구조.

## 2.4 시간별 Core Loop
| 루프 | 목표 |
|---|---|
| 3초 | "검을 긋는 것 자체가 즐겁다" — 적 발견 → 베기 → 강한 타격감 |
| 30초 | "계속 적을 찾고 싶다" — 처치 → 작은 보상 → 다음 전투 |
| 60초 | "플레이 방식이 바뀌었다" — 성장 선택 → 새로운 전투 방식 체감 |
| 5분 | "이번 빌드 재미있다" — 일반전 → 성장 → 정예 → Duel → 승리 |
| 30~40분 | "다른 빌드도 해보고 싶다" — 5스테이지 → 최종 보스 → 영구 성장 |

## 2.5 감정 곡선 (모든 스테이지가 따르는 흐름)
호기심 → 성공 → 성장 → 긴장 → 위기(실패) → 학습 → 재도전 → 성취 → 새로운 기대

## 2.6 첫 30분 감정 설계
- 0~3분: "오, 베는 맛 좋다."
- 3~10분: "새로운 검술이 재미있다."
- 10~20분: "조금 어렵지만 할 만하다."
- 20~30분: "보스를 잡았다!"
- 30분 이후: "다른 빌드도 해보고 싶다."

## 2.7 보상 타이밍
3~10초 타격감 / 30초 작은 보상 / 1분 성장 선택 / 5분 보스 보상 / 30분 영구 성장. 보상 공백이 길어지지 않게 한다.

## 2.8 Core Loop를 깨는 요소 (발견 즉시 수정)
보상 없는 긴 전투, HP만 많은 적, 성장 체감 부족, 너무 긴 이동, 반복되는 동일 패턴.

---

# 3. 전투 시스템

## 3.1 전투 철학
목표는 적을 많이 죽이는 것이 아니라 "내 컨트롤이 좋아서 이겼다"는 감정이다.
전투 우선순위: ① 손맛 ② 가독성 ③ 컨트롤 ④ 성장 ⑤ 연출. 그래픽보다 손맛이 우선.

## 3.2 기본 전투 루프 (5~15초 반복)
적 발견 → 접근 → 검술 사용 → 적 반응 → 보상 → 다음 적

## 3.3 입력 규칙
- 이동: 왼손(조이스틱/키보드), 항상 이동 가능.
- 공격: 오른손 제스처, 입력이 끝난 순간 판정 발생. 입력은 복잡하지 않아야 한다.

## 3.4 공격 3원칙
□ 눈으로 보인다 □ 손으로 느껴진다 □ 결과가 즉시 나온다

## 3.5 히트 피드백
공격 성공 시 다음 중 최소 3가지 동시 발생: 적 경직, 타격음, 화면 흔들림, 히트스톱, 검 이펙트.

## 3.6 회피
공격을 피하는 것이 아니라 '좋은 위치를 만드는 것'. 짧고 즉각적이어야 한다.

## 3.7 패링
최고 난이도 기술. 성공 시 큰 손맛 + 기력 회복 + 반격 기회. 실패 시 큰 패널티가 아니라 위치를 잃는다.

## 3.8 그로기
많이 때려서가 아니라 정확하게 공략해서 발생: 약점 공략, 연속 성공, 패링 후 반격.

## 3.9 Duel Mode (보스전)
- 별도 모드지만 미니게임이 아니다 — 같은 조작을 더 깊게 사용하는 결투.
- 항상 1:1, 카메라는 보스 중심, 거리 조절 + 좌우 회피 + 검술 제스처.
- 필드(빠른 학살) ↔ Duel(긴장감)의 리듬 유지.
- 세키로의 긴장감은 참고하되 구현은 훨씬 단순하게.

## 3.10 전투 절대 금지
피격 이유가 불명확한 공격, 보이지 않는 판정, 과도한 랜덤성, HP만 많은 적, 오래 때려야 하는 적.

## 3.11 전투 플레이 테스트 질문 (3개 이하 YES면 재설계)
1. 첫 베기가 시원한가? 2. 적을 계속 찾게 되는가? 3. 회피를 쓰고 싶은가? 4. 패링 성공이 짜릿한가? 5. 보스를 다시 도전하고 싶은가?

---

# 4. Game Feel (게임 감각)

## 4.1 핵심 목표
검을 한 번 그었을 때 "와, 이거 계속 베고 싶다"는 느낌. 손맛은 그래픽보다 우선한다.

## 4.2 Game Feel 7요소 (동시에 동작해야 함)
입력(Input), 반응(Response), 타격감(Hit Feel), 화면(Camera), 사운드(Audio), 이펙트(FX), 보상(Reward)

## 4.3 첫 베기 원칙
즉시 반응, 선명한 검 궤적, 강한 타격음, 적의 명확한 반응, 짧은 히트스톱.

## 4.4 적 반응 원칙
모든 공격은 눈에 보이는 변화를 만든다(밀림, 자세 붕괴, 비틀거림, 그로기). HP만 감소하는 것은 금지.

## 4.5 카메라 원칙
플레이어를 방해하지 않는다. 중요한 순간만 강조, 평소에는 안정적, 보스전은 긴장감 증가. 과도한 흔들림 금지.

## 4.6 사운드 원칙
필수: 검 휘두름, 명중, 패링, 그로기, 피니시. 같은 소리를 반복하지 않는다.

## 4.7 보상/실패 원칙
- 잘했을 때만 큰 연출(완벽한 패링, 연속 콤보, 노데미지, 보스 피니시). 실력과 보상이 연결.
- 실패는 억울하면 안 된다. "게임이 잘못됐다"가 아니라 "내가 조금 늦었다"고 느껴야 한다.

## 4.8 금지 사항
긴 피격 경직, 입력 씹힘, 이유 없는 피격, 과도한 화면 효과, 적 체력만 높은 설계.

---

# 5. 검술 & 성장 시스템

## 5.1 성장 철학 — 3축 성장 구조
초기의 순수 실력 중심에서, 진입 장벽 완화를 위해 3축으로 확장 (v0.6 결정).

1. **플레이어 성장 (Skill)**: 패턴 읽기, 제스처 정확도, 회피, 거리 조절, 검술 연계. "내 컨트롤이 좋아져서 깼다."
2. **캐릭터 영구 성장 (Permanent)**: 기력/체력 증가, 패시브 해금, 검술 숙련도. 죽어도 일부 유지.
3. **장비 성장 (Equipment)**: 숫자가 아니라 플레이 스타일을 바꾼다 (발도술 사거리↑, 패링 성공 시 검기 발생 등). 공격력 +1000 같은 단순 수치는 지양. 장비는 실력을 대체하지 않고 더 빛나게 만든다.

실력 : 성장 = 약 60 : 40 (ADR-003).

## 5.2 성장의 3계층 (Progression Bible)
- **A. 영구 성장 (메타)**: 새 검파, 검술 해금, 패시브 슬롯, 시작 특성, 신규 지역/보스 도전. 목표는 "다음 플레이가 더 다양해진다."
- **B. 이번 판 성장 (로그라이크)**: 보스 처치마다 3개 선택지 (예: 발도술 강화 / 패링 특화 / 새 검술 / 검기 습득 / 기력·체력 증가). 판 종료 시 초기화.
- **C. 플레이어 성장**: 실제로 손이 익는다. "아이템이 아니라 내가 강해졌다."

## 5.3 검객 성장 단계 (초안, 명칭 변경 가능)
견습 검객 → 초급 검사 → 숙련 검사 → 검객 → 상급 검객 → 검호 → 대검호 → 검왕 → 검성 → 검신 (10단계)

원칙: 각 단계마다 반드시 새로운 플레이 요소(검술/진화/오의/검파/패시브/장비 슬롯/빌드)가 열린다. 절대로 숫자만 증가하지 않는다. 플레이어는 5~10분마다 "내 플레이 방식이 달라졌다"고 느껴야 한다.

## 5.4 검술 시스템
- 출시 버전: 기본 검술 8개, 오의 5개, 검기 3종 (Scope Bible 확정).
- 예시 검술: 횡베기, 발도술, 회전베기, 패링, 일섬.
- 검술은 Lv1→Lv5 진화 구조 (상세 설계 필요 — 미완).
- 검술을 무한히 늘리지 않는다. 필드에서 익히고 보스전에서 시험받는다.

## 5.5 검파 (유파)
- 출시: 3개 (예시: 발도류, 정검류, 쾌검류). 각 검파는 새로운 플레이 스타일 제공.
- 업데이트/DLC에서 확장 (무당, 화산, 곤륜, 닌자, 서양 롱소드, 이아이도, 쌍검, 창술 등).

## 5.6 검술 도감
가장 중요한 수집 요소: 발견 → 숙련 → 마스터 → 오의 해금. Steam 업적과 연결.

## 5.7 성장 검증 질문 (모든 성장이 통과해야 함)
□ 플레이 방식이 바뀌는가? □ 새로운 선택이 생기는가? □ 즉시 체감되는가? □ 실력을 대체하지 않는가? □ 다음 플레이가 기대되는가?

---

# 6. 적 & 보스 설계

## 6.1 핵심 철학 — 적은 선생님이다 (ADR-005)
적은 플레이어를 죽이기 위한 존재가 아니라, 새로운 검술과 전투 원리를 가르치는 스승이다. 게임 전체가 튜토리얼이어야 한다.

## 6.2 학습 구조
튜토리얼 → 쉬운 적 → 같은 기술을 요구하는 적 → 응용 적 → 미니 보스 → 보스(Duel Mode)

## 6.3 튜토리얼 단계
1단계: 이동, 기본 베기 / 2단계: 연속 베기, 거리 유지 / 3단계: 첫 검술(발도술) / 4단계: 첫 회피. 실패해도 큰 패널티 없음.

## 6.4 적 유형별 학습 목표
| 적 | 가르치는 것 |
|---|---|
| 방패병 | 패링, 공격 타이밍 (보스 전 반드시 등장) |
| 창병 | 거리 조절, 접근 타이밍 |
| 궁수 | 이동, 회피 |
| 쌍검 적 | 연속 공격 대응, 리듬 유지 |
| 검객 | 발도술 타이밍, Duel 감각 |

## 6.5 미니 보스
튜토리얼의 졸업 시험. 배운 기술 2~3가지를 동시에 요구.

## 6.6 보스 설계 원칙
- 보스는 새 기술을 가르치지 않는다. 배운 것을 '시험'하는 존재.
- 보스는 새 규칙을 만들지 않고 기존 규칙을 조합한다.
- 죽은 이유는 항상 설명 가능해야 한다.
- 패턴 수: 1보스 3개, 2보스 4개, 최종보스 최대 6개. 적은 패턴을 조합으로 난이도 구성.
- 출시 규모: 메인 보스 5명 + 미니보스 5명 (Scope Bible).

## 6.7 난이도 원칙
새로운 기술은 한 번에 하나만 요구한다. 패링+회피+발도술+검기를 동시에 처음부터 요구하지 않는다.

## 6.8 적 재미 검증 (답이 없으면 삭제)
1. 이 적은 무엇을 가르치는가? 2. 플레이어는 무엇을 연습하는가? 3. 이 적이 없으면 어떤 재미가 사라지는가?

---

# 7. 스테이지 설계 & 난이도 곡선

## 7.1 핵심 공식 (모든 스테이지가 반복)
배움 → 연습 → 응용 → 시험 → 보상

## 7.2 전체 구조 (약 30~40분)
| 스테이지 | 테마 | 핵심 학습 | 목표 성공률 |
|---|---|---|---|
| Stage 1 | 검을 배우다 | 이동, 기본 베기, 첫 검술(발도술) | 90% |
| Stage 2 | 검을 익히다 | 회피, 거리 유지, 연계 시작 | 80% |
| Stage 3 | 검을 연결하다 | 검술 연계, 첫 오의 | 70% |
| Stage 4 | 검을 응용하다 | 빌드 활용, 상황 판단 | 60% |
| Stage 5 | 검성의 시험 | 종합 시험 (새 기술 없음) | 첫 도전 30~40%, 재도전 70%+ |

한 스테이지 = 한 가지 핵심 학습. 새 요소를 여러 개 동시에 넣지 않는다.

## 7.3 난이도 철학
난이도는 플레이어를 막기 위해서가 아니라 성장을 보여주기 위해 존재한다. "억울해서 졌다"가 아니라 "다음에는 이길 수 있겠다"고 느껴야 한다.

## 7.4 실패 설계
실패는 학습 정보를 제공해야 한다. 패배 후 무엇이 문제였고 무엇을 연습해야 하는지 알 수 있어야 한다.

## 7.5 난이도 금지 사항
원인 모를 즉사, 운으로만 피하는 공격, 체력만 많은 보스, 패턴 없이 숫자만 높은 적, 튜토리얼 없이 새 규칙.

## 7.6 스테이지 체크리스트
1. 무엇을 배우는가? 2. 무엇을 연습하는가? 3. 무엇을 시험하는가? 4. 무엇을 보상으로 주는가? 5. 다음 스테이지가 기대되는가?

---

# 8. 보상 & 동기 설계

## 8.1 보상 철학
보상은 "내 선택이 옳았다"는 감정을 주는 것이다.

## 8.2 보상 5단계
| 단계 | 시점 | 내용 | 목표 |
|---|---|---|---|
| L1 즉시 | 0~3초 | 타격감, 효과음, 적 반응, 연출 | 베는 것 자체가 즐겁다 |
| L2 단기 | 30초 | 경험, 소량 재화, 회복 | 계속 적을 찾게 만든다 |
| L3 성장 | 1~5분 | 3개 선택지 (검술 진화/새 검술/패시브) | 플레이 방식이 바뀐다 |
| L4 세션 | 30~40분 | 영구 성장, 검파/보스/지역 해금 | 다음 판을 시작하게 만든다 |
| L5 장기 | 수십 시간 | 검술 마스터, 검신 칭호, 숨겨진 검술, 최고 난이도 | 오래 즐기게 만든다 |

## 8.3 보상 설계 규칙
실력이 좋을수록 큰 보상 / 운보다 선택 / 보상은 플레이 스타일을 바꾼다 / 같은 보상 반복 금지.

## 8.4 "한 판만 더"를 만드는 요소
플레이 종료 직전 최소 하나 노출: 잠긴 검술, 새 검파, 미해금 보스, 새 빌드 가능성, 다음 지역 미리보기.

## 8.5 희귀 보상
낮은 확률의 특별 보상(전설 검술, 숨겨진 보스, 특수 검파, 특별 스킨). 희귀하지만 게임을 깨뜨리지 않는다.

## 8.6 보상 금지
숫자만 큰 아이템, 의미 없는 재화, 선택 없는 성장, 무조건 강해지는 장비, Pay to Win.

---

# 9. 선택(Decision) 설계

## 9.1 철학
선택지가 많은 게임이 아니라 **의미 있는 선택이 많은 게임**. "좋은 선택 A vs 좋은 선택 B"여야 하고 정답이 하나뿐인 선택은 만들지 않는다.

## 9.2 선택의 종류
- 전투: 공격/회피/패링/기력 관리
- 성장: 기존 강화 vs 새 검술 vs 패시브 vs 생존
- 탐험: 안전한 길 vs 위험하지만 보상 큰 길
- 보스: 지금 도전 vs 성장 후 도전

## 9.3 로그라이크 선택 규칙
보상은 항상 3개 제시 (예: 발도술 중심 / 패링 중심 / 생존 중심). 세 가지 모두 끝까지 플레이 가능해야 한다.

## 9.4 리스크 vs 리워드
위험이 크면 보상도 크다. 선택 후 "잘못 골랐다"가 아니라 "아쉽지만 다른 것도 재미있었겠다"를 목표로.

## 9.5 절대 금지
무조건 정답인 선택, 함정 선택, 설명 없는 선택, 숫자만 큰 선택.

---

# 10. 플레이어 심리 & 유형

## 10.1 심리 설계 핵심
플레이어는 기능이 아니라 감정을 기억한다. 몰입(Flow)은 난이도와 실력이 균형일 때 발생.

## 10.2 실패 심리
패배 후 "타이밍이 늦었다 / 다른 검술을 써볼까 / 회피를 먼저 해보자"를 생각해야 하며, 절대 "운이 없었다 / 게임이 이상하다"를 느끼게 하면 안 된다.

## 10.3 성취감
큰 성취는 어려운 도전 극복 뒤에: 첫 패링 성공, 첫 노데미지 승리, 첫 Duel 클리어, 첫 검파 해금, 첫 검성 승급.

## 10.4 놀라움
주기적 예상 밖 경험: 숨겨진 검술, 비밀 보스, 특수 이벤트, 희귀 빌드 시너지.

## 10.5 플레이어 유형 (Archetype)
| 유형 | 목표 | 제공 콘텐츠 |
|---|---|---|
| 검술 마스터 | 실력 향상 | 숙련도 칭호, 보스 러시, 타임어택, 퍼펙트 클리어 |
| 성장가 | 계속 해금 | 메타 성장, 숨겨진 검술, 시작 특성 |
| 빌드 연구가 | 매 판 다른 조합 | 다양한 선택지, 시너지, 특수 조합 |
| 수집가 | 100% 달성 | 도감, 스킨, 칭호, 업적 |
| 탐험가 | 발견의 재미 | 비밀 방, 숨겨진 NPC, 특수 이벤트 |

- MVP는 검술 마스터 / 성장가 / 빌드 연구가 3유형에 집중. 수집가·탐험가는 업데이트/DLC.
- 플레이어 여정: 30분(성장가) → 10시간(빌드 연구가) → 30시간(검술 마스터) → 100시간+(수집가/탐험가).

## 10.6 감정 체크리스트 (모든 신규 기능)
□ 웃는 순간 □ 긴장되는 순간 □ 억울하지 않은 실패 □ 특별한 성공 □ 한 판 더 하고 싶은가

---

# 11. 상용화 & 시장 전략

## 11.1 원칙
플레이어는 **실력으로 강해지고, 콘텐츠에 돈을 쓴다.** 강함을 돈으로 팔지 않는다.

## 11.2 판매하는 것
- 신규 지역 DLC (설산, 화산, 대나무 숲, 지하궁전, 용궁, 천공성 등)
- 신규 보스 DLC
- 신규 검파(유파)와 플레이 스타일
- 신규 검술 계통 (번개/화염/얼음/암흑/풍검술)
- 꾸미기 요소 (의상, 검 외형/이펙트, 피니시 연출, 칭호, 승리 포즈 — 전투 성능 영향 없음)

## 11.3 판매하지 않는 것
Pay to Win, 능력치, 강한 검, 강한 검술 해금, 승리에 직결되는 과금.

## 11.4 장기 플레이 목표
더 좋은 검이 아니라, 더 많은 검술을 익히고 새로운 검파를 배우고 다양한 빌드를 연구하기 위해 플레이한다.

## 11.5 DLC 계획 (초안)
- DLC 1: 검파 +1, 보스 +2, 검술 +3
- DLC 2: 신규 지역, 신규 적, 신규 보스, 신규 엔딩

---

# 12. MVP & 개발 범위 (Scope)

## 12.1 출시 원칙
출시는 기능이 많을 때가 아니라 **핵심 재미가 완성되었을 때** 한다. Scope는 품질을 지키기 위한 약속이다.

## 12.2 MVP 출시 범위 (확정)
| 항목 | 범위 |
|---|---|
| 플레이 시간 | 30~40분, 반복 플레이, 엔딩 1개 |
| 스테이지 | 5개 (작은 맵) |
| 검술 | 기본 8개 + 오의 5개 + 검기 3종 |
| 검파 | 3개 (발도류/정검류/쾌검류 예시) |
| 보스 | 메인 5명 + 미니보스 5명 (보스당 핵심 패턴 3~5개) |
| 일반 적 | 10~12종 (적마다 학습 목표 1개) |
| 성장 | 영구 성장 + 로그라이크 선택 + 검술 진화 |

※ v0.7에서는 맵 3개/몬스터 8~10종/보스 3명이었으나 v2.4 Scope Bible에서 위 수치로 확정됨.

## 12.3 기능 우선순위 (Feature Priority Matrix)
- **S (없으면 게임 불성립)**: 왼손 이동, 오른손 제스처, 타격감, 히트스톱, 검 궤적, 회피, 기본 적 AI, 게임 루프, 검술 진화, 로그라이크 선택, 영구 성장
- **A (출시 필요)**: 검파 3개, 보스, 일반 몬스터, 장비 옵션, 검술 도감, 업적, 난이도 상승
- **B (출시 후 무료 업데이트)**: 신규 검술/검파/적, 챌린지 모드, 보스 러시, 하드코어, 일일 도전
- **C (DLC)**: 신규 지역/스토리/세계관/플레이 스타일/최종보스
- **X (개발 금지)**: 오픈월드, 멀티플레이, PVP, 거래소, 제작, 수백 개 장비, 복잡한 NPC 퀘스트, 펫, 하우징, 길드, MMORPG 요소

## 12.4 기능 추가 규칙 (6문 중 4개 미만 YES면 보류)
1. 재미가 증가하는가? 2. 검술 중심인가? 3. 1인 개발 가능한가? 4. 출시를 늦추지 않는가? 5. 반복 플레이를 높이는가? 6. Steam 트레일러에서 매력적인가?

## 12.5 Fun Checklist (기능 검증 5문)
① 손맛이 좋아지는가 ② 실력이 중요해지는가 ③ 성장의 의미가 있는가 ④ 1인 개발 가능한가(2~4주 구현) ⑤ Steam 차별점인가
→ 5 YES 바로 구현 / 4 YES 고려 / 3 이하 보류

## 12.6 Scope Lock (프로토타입 이후 변경 금지, 변경 시 ADR 기록)
조작 방식, Core Loop, Duel Mode, 성장 철학, 플레이 시간 목표.

## 12.7 MVP 출시 전 체크리스트
□ 손맛 좋다 □ 일반전 재미있다 □ Duel Mode 재미있다 □ 성장 선택 재미있다 □ 보스 재도전 욕구 □ 5분이 짧게 느껴진다

---

# 13. 개발 철학 & ADR (의사결정 기록)

## 13.1 Master Design Bible 10 Rules (프로젝트 헌법)
1. 검술이 가장 중요하다.
2. 손맛이 그래픽보다 중요하다.
3. 기능보다 완성도를 우선한다.
4. 1인 개발 범위를 절대 넘지 않는다 (2~4주 구현 + 유지보수 검토).
5. 실력이 가장 중요하다.
6. 성장은 실력을 보완한다 (대체하지 않는다).
7. 모든 적은 선생님이다. 보스는 시험한다.
8. 모든 스테이지는 학습 곡선이다 (배움→연습→응용→시험→보상).
9. 재미가 검증되지 않은 기능은 구현하지 않는다.
10. 출시 후 확장을 고려한다 (출시는 작게, 확장은 크게).

## 13.2 ADR 목록
| ADR | 결정 |
|---|---|
| ADR-001 | 일반전과 보스전 분리 (필드 RPG + Duel Mode) |
| ADR-002 | 한 판 5분, 5스테이지 30~40분 |
| ADR-003 | 실력 60 : 성장 40 |
| ADR-004 | 장비는 수치가 아니라 플레이 스타일을 바꾼다 |
| ADR-005 | 적은 선생님, 보스는 시험 |
| ADR-006 | 개발 우선순위: 손맛 → 일반전 → Duel → 성장 → 콘텐츠 |
| ADR-007 | 1인 개발 원칙 (재미/구현 가능/유지보수/일정 검토) |
| ADR-008 | 플랫폼 = PC+모바일 동시 (2026-07-12 확정) |
| ADR-009 | 엔진 = TypeScript + Vite + Phaser 3 (2026-07-12 확정) |
| ADR-010 | 제스처 = 벡터 기반 자체 알고리즘, 8방향 양자화 (2026-07-12 확정) |
| ADR-011 | Duel = momentum 3상태 구조 (대치/내 공세/적 공세 + 공격권 게이지) — 사용자 승인 (2026-07-12) |
| ADR-012 | 필드 = 횡스크롤 진행형 ("달리며 조우 즉시 베기") — 사용자 승인 (2026-07-12) |
| ADR-013 | 스토리 = 복수극 (몰락 검술 명가, 인물 5명 이내 — 프로토타입 트리트먼트 계승) — 사용자 확정 (2026-07-12) |

새로운 큰 결정마다 ADR 기록: ① 결정 ② 이유 ③ 기대 효과 ④ 변경 조건.

### ADR-008 — 플랫폼: PC+모바일 동시
- **결정**: 웹 우선 배포(브라우저) → Steam(Tauri/Electron 래핑) + 앱스토어(Capacitor 래핑) 순차 확장. PC=키보드(WASD)+마우스 제스처, 모바일=왼손 터치 스틱+오른손 제스처. GDD Input Spec은 양쪽을 모두 정의하므로 스펙 변경 없음.
- **이유**: 단일 코드베이스로 두 플랫폼 커버 가능(웹 스택 전제). 프로토타입에서 모바일 터치 입력(트윈스틱) 경험 확보.
- **기대 효과**: 즉시 테스트·배포 가능한 웹 빌드로 빠른 플레이테스트 루프 유지.
- **변경 조건**: 모바일 저사양 성능이 60FPS 기준을 만족하지 못할 때 재검토.
- **후속 결정 필요**: 수익화 재설계 — Steam DLC + 모바일 IAP 병행 모델 (§11 보완 필요).

### ADR-009 — 엔진: TypeScript + Vite + Phaser 3
- **결정**: 웹 표준 스택. 판정/전투 로직은 순수 TS(렌더링 비의존), 렌더링은 Phaser 3.
- **이유**: ① GDD의 AI 구현 파이프라인(Spec→구현→Unit Test→Acceptance→Review)은 텍스트 코드+헤드리스 테스트(vitest) 환경에서 가장 잘 작동 — Unity/Unreal은 에디터 GUI 의존으로 AI 자동화 어려움. ② 프로토타입에서 순수 TS 판정 엔진(테스트 118종)을 검증한 경험 — 가장 위험한 핵심 기술이 이 스택에서 이미 증명됨. ③ 새 엔진 학습 비용 = 1인 개발 최대 일정 리스크(Rule 4). ④ 요구 연출(히트스톱·화면 흔들림·검 궤적·슬로우모션)은 2D 잉크 스타일에서 웹으로 충분.
- **기대 효과**: Package 01~03의 AI Task를 그대로 vitest 기반으로 실행 가능.
- **변경 조건**: 명확한 성능/연출 한계 도달 시 멈추고 보고 후 재평가 (로직이 순수 TS라 이관 비용 통제됨).
- **약점(인지)**: 3D급 연출·고급 셰이더 한계, 모바일 저사양 프로파일링 필요.

### ADR-010 — 제스처: 벡터 기반 자체 알고리즘
- **결정**: $1 Recognizer·ML 보정 대신 벡터 기반 자체 구현. 8방향 양자화(N/NE/E/SE/S/SW/W/NW). GDD 파이프라인(Normalize→Resample 64pt→Corner 35°→Direction→Score) 및 점수 체계(Direction 50/Shape 20/Length 10/Speed 10/Corner 10, 85점 성공) 채택.
- **이유**: 프로토타입에서 벡터 기반 판정이 실기 검증됨. $1 Recognizer는 방향성 구분(예: 좌→우 vs 우→좌)이 약해 검술 게임에 부적합. 8방향이면 검술 8개+오의 5개 구분에 충분하고 오인식률 관리에 유리.
- **기대 효과**: 판정 20ms 이내, 결정론적 테스트 가능.
- **변경 조건**: 검술 수 확장으로 8방향 표현력이 부족해질 때 16방향 재검토.

## 13.3 문서 계층
Master Design Bible(최상위) → GDD / Combat / Sword Language / Boss / Enemy / UI / Audio / AI Development / Data Architecture Bible. 모든 문서는 헌법과 충돌 금지.

## 13.4 문서 작성 표준 형식 (v2.5부터)
목적 / 구현 규칙 / 데이터 구조 / 예외 처리 / 플레이 테스트 / Cross References / Open Questions

---

# 14. 프로토타입 & 재미 검증 (Core Gameplay Prototype)

3초 → 30초 → 60초 → 5분 순서로 재미를 검증한 후에만 다음 단계 진행.

| Layer | 질문 | 성공 기준 |
|---|---|---|
| 첫 3초 | 검을 그은 순간 손맛이 있는가? | "오? 베는 맛 좋은데" (검 궤적, 타격음, 히트스톱, 화면 흔들림, 피격 연출) |
| 첫 30초 | 계속 베고 싶은가? | 병사 3 → 발도술 획득 → 병사 3 → 소정예. 적을 계속 찾게 됨 |
| 첫 60초 | 성장이 체감되는가? | "강해졌다"가 아니라 "플레이 방식이 달라졌다" |
| 첫 5분 | 한 판 더 하고 싶은가? | 보스 처치 후 "다른 빌드도 해보고 싶다" |

구현 순서: 검 타격감 → 이동 → 일반 몬스터 → 검술 3개 → 성장 선택 3개 → 미니보스 → Duel Mode.

---

# 15. 데이터 아키텍처

## 15.1 원칙
로직보다 데이터 우선. 하드코딩 최소화. JSON/DataTable만 수정해도 밸런스 변경 가능. 모든 AI(Codex/Claude/GPT)가 동일한 데이터 구조 사용.

## 15.2 데이터 계층
Game → Stage / Enemy / Boss / Skill / SwordSchool / Growth / Reward / Item / Save / UI. 모든 데이터는 ID 기반 연결(문자열 이름 참조 금지). ID는 절대 변경하지 않는다.

## 15.3 공통 필드
id, name, description, version, tags, unlock_condition, debug_flag

## 15.4 주요 Schema
- **Skill**: skill_id, input_pattern, stamina_cost, cooldown, damage, hit_stop, camera/fx/audio_profile, combo_group, unlock_condition
- **Enemy**: enemy_id, hp, movement_type, attack_set(참조), weak_point, stagger_value, reward_table, ai_profile
- **Boss**: boss_id, phase_list(별도 관리), duel_profile, reward_table, intro/finish_camera
- **Stage**: stage_id, theme, enemy_spawn_table, mini_boss, boss, reward, next_stage
- **Save**: 저장 = 영구 성장, 해금, 업적, 옵션, 진행도 / 저장 안 함 = 이번 판 빌드, 현재 버프, 임시 효과
- **Gesture**: gesture_id, pattern, tolerance, unlock, animation, fx_profile, audio_profile

## 15.5 JSON 분리
skill.json / enemy.json / boss.json / reward.json / growth.json / stage.json / save.json — 한 파일 한 종류.

## 15.6 버전 정책
모든 데이터에 version 필드. 구조 변경 시 Migration 작성 + Save 호환성 검토 + ADR 기록.

---

# 16. 제스처 인식 시스템 (핵심 기술)

## 16.1 핵심 원칙
- 입력은 관대하게, 결과는 명확하게.
- 잘 그린 입력은 반드시 성공한다. 실패 원인을 플레이어가 이해할 수 있어야 한다.
- 기기 성능/해상도 차이의 영향 최소화. 동일 입력 → 항상 동일 결과.

## 16.2 인식 파이프라인
```
Touch Down → Point Buffer → 좌표 샘플링 → Noise Filter → Normalize(0~1 좌표계)
→ Resample(64 Point 권장, 32~128 허용) → Corner Detection(기본 35°)
→ Direction Vector(8방향 양자화: N NE E SE S SW W NW) → Pattern Matching
→ Score 계산 → Skill 결정
```
예: 발도술 = E → NE

## 16.3 판정 점수
Direction 50% + Shape 20% + Length 10% + Speed 10% + Corner 10%
- 85점 이상: 성공 / 70~84: 후보 / 69 이하: 실패

## 16.4 허용 오차 (초기값)
방향 ±20°, 길이 ±15%, 시간 ±25%. 판정은 시간보다 패턴 정확도 우선.

## 16.5 후보 충돌 해결 순서
① 정확도(Direction) ② Shape ③ 최근 성공률 ④ Skill Priority (또는 스킬 레벨/입력 길이/최근 사용)

## 16.6 난이도별 오차 스케일
Easy 130% / Normal 100% / Hard 80% / Nightmare 65% — 어려워지되 불공정해지지 않는다.

## 16.7 성능 요구
입력 종료 후 20ms 이내 판정. 메모리 할당 없음, GC 최소화. 샘플링 60Hz 권장(최소 30Hz), 최소 12 Point.

## 16.8 합격 기준 (Acceptance)
- 동일 제스처 1000회: 성공률 95% 이상, 오인식률 3% 이하
- 속도(느림/보통/빠름), 해상도(720p~Tablet), FPS(30/60/90/120) 모두 동일 결과
- 멀티터치(왼손 이동 + 오른손 제스처) 충돌 없음
- 잘못된 제스처: 다른 스킬 실행 금지, 크래시 없음, 명확한 실패 반환
- UX: 초보 5명 + 숙련 5명 테스트, 긍정 응답 80% 이상
- 실패 시 로그: 입력 좌표, 정규화 결과, 후보 패턴, 최종 점수, 실패 사유

## 16.9 구현 Task 분해 (AI Task Spec)
TASK-001 Point Buffer → 002 Normalize → 003 Noise Filter → 004 Resample → 005 Direction Builder → 006 Pattern Matching → 007 Score Engine → 008 Skill Resolver → 009 Debug Overlay → 010 Integration
- 각 Task는 300~800줄 이하, 단일 책임, Acceptance Test 필수.
- AI 구현 순서(불변): Spec 확인 → Schema 확인 → 구현 → Unit Test → Acceptance Test → Self Review → 다음 Task.
- Definition of Done: 코드 + Unit Test PASS + Acceptance PASS + 성능 기준 + 리뷰 완료.

## 16.10 통합 (Integration Guide)
- Gesture Engine 반환값: gesture_id, confidence, score, elapsed_time, debug_info(개발 모드). Combat은 내부 알고리즘을 몰라도 된다.
- 이벤트 흐름: Touch → Input System → Gesture Engine → Skill Resolver → Combat → Enemy Reaction → Reward → Telemetry
- 튜토리얼은 실제 판정 사용 (전용 판정 금지).
- Telemetry: 성공률, 실패율, 평균 입력 시간, 최다 실패 제스처, 난이도별 성공률 → 밸런스 조정에 활용.

---

# 17. 입력 시스템 (Input System Spec 요약)

## 17.1 구현 범위
PC 키보드/마우스, 터치 이동 영역 + 제스처 영역, 왼손 이동 + 오른손 제스처 동시 입력, 회피 입력, Input Context, Pointer Ownership, 입력 버퍼, Cancel/포커스 손실 복구, 이벤트 발행, 디버그.
(제외: 데미지, 판정, 패링 성공, 무적 시간, 적 AI, 애니메이션, 제스처 알고리즘 내부)

## 17.2 모듈 구조
```
Input/
├── Core: InputManager, InputRouter, InputContextController, InputCommandBuffer, InputEventBus
├── Devices: KeyboardMouseAdapter, TouchAdapter, DeviceActivityTracker
├── Ownership: PointerOwnershipRegistry, UIInputGate
├── Movement: MovementInputProcessor, VirtualJoystickProcessor
├── Gesture: GestureInputCollector, GestureInputBridge
├── Dodge: DodgeInputProcessor
├── Debug: InputDebugSnapshot, InputDebugOverlayBridge
└── Tests: Unit / Integration / Fixtures
```
한 파일에 여러 핵심 책임을 합치지 않는다.

## 17.3 주요 데이터 타입
RawPointerEvent, MoveCommand, GestureSession(Idle/Collecting/PendingRecognition/Completed/Canceled), DodgeCommand, BufferedCommand(Pending/Consumed/Expired/Rejected/Canceled)

## 17.4 프레임 Update 순서 (불변)
① Device Adapter Poll ② Raw Event Drain ③ UI Gate ④ Router Dispatch ⑤ Movement ⑥ Gesture ⑦ Dodge ⑧ Buffer Expire ⑨ Events Publish ⑩ Debug Snapshot

## 17.5 Pointer Ownership 상태 머신
Unowned → (UI Hit) OwnedByUI / (좌측 영역) OwnedByMovement / (우측 영역) OwnedByGesture / (회피 버튼) OwnedByDodge → Released/Canceled.
금지 전이: Movement↔Gesture 간 직접 전환, UI→Gameplay Owner, Owner 없는 Move/Up 처리.

## 17.6 Input Context 상태 머신
GameplayField / GameplayDuel / Tutorial / Menu / Pause / Dialogue / Cutscene / Result / Debug
- 전환 시: BeforeContextChange 발행 → Gesture Cancel → Owner 정책 → 이동 초기화 결정 → Buffer 정책 → 새 Context → OnInputContextChanged 발행.
- 기본 정책: Gameplay↔Gameplay는 이동 유지 + 제스처 취소 / Gameplay→Menu·Pause·Cutscene은 전체 취소 / Any→Result 전체 취소.

## 17.7 이동 알고리즘
- PC: x=right-left, y=forward-backward, 길이>1이면 정규화.
- 터치: dead_zone(0.15) 미만 무시, (distance-dead_zone)/(full_radius-dead_zone) clamp.
- 결합: 최근 활성 장치 우선, 키보드+터치 합산 금지, 장치 변경 시 OnInputDeviceChanged.

## 17.8 입력 우선순위 상수
System 100 > UI 90 > Cancel 80 > Dodge 70 > Gesture 60 > Movement 50 > Debug 10

## 17.9 InputConfig (기본값)
- 영역: movement_end_x 0.40 / buffer 0.40~0.50 / gesture_start_x 0.50
- gesture: min_points 12, max_duration_ms 1200
- buffer_ms: skill 120, dodge 100, parry 80
- limits: 동시 포인터 5, 버퍼 용량 16
- Config 검증 실패 시 안전 기본값 + 오류 로그.

## 17.10 CancelAllInput 필수 호출 지점
FocusLost, Pause Enter, Cutscene Enter, Scene Unload, App Suspend, Fatal Input Error.

## 17.11 오류 코드
INPUT-001 PointerOwnerConflict ~ INPUT-010 CancelRecoveryFailed (총 10종, 로그와 테스트 보고서에서 동일 사용).

## 17.12 결정론 & 메모리
- 모든 상태 변경은 메인 스레드. sequence_id 단조 증가, monotonic clock. 동일 입력 리플레이 = 동일 Command 순서.
- Point Buffer 풀링, 링 버퍼, 프레임당 동적 할당 금지.
- 시간 의존 로직은 IClock 추상화. Test Double: FakeClock, FakeAdapter류, FakeUIInputGate 등.

## 17.13 Acceptance 최소 검증
WASD, 가상 스틱, 이동 중 제스처, 제스처 중 이동, 회피+이동 동시, UI 터치 차단, Context 전환, 포커스 복구, Owner 충돌, 버퍼 만료, 30/60/120FPS 결정론, 장시간 메모리 안정성.

---

# 18. 개발 로드맵

## 18.1 전체 개발 순서
① 입력 ② 제스처 인식 ③ 검술 데이터 ④ 적 상태 머신 ⑤ 일반 전투 ⑥ Duel Mode ⑦ 보스 ⑧ 성장 ⑨ 저장 ⑩ UI ⑪ 사운드/FX ⑫ Steam Demo

## 18.2 16개 개발 패키지 의존성 (v3.7)
```
P01 Input Foundation
 → P02 Skill Execution
  → P03 Combat Foundation
   → P04 Enemy Foundation ∥ P05 Duel Foundation   (병렬 가능)
    → P06 Boss Content
     → P07 Progression
      → P08 Equipment & Reward
       → P09 Stage Flow
        → P10 UI/Tutorial ∥ P11 Save/Data ∥ P12 Presentation  (병렬 가능)
         → P13 Balance
          → P14 QA & Release
           → P15 Live Operation
            → P16 Final Release Review
```

## 18.3 Freeze Gate
- Gate A (P01~03): 입력/제스처/스킬/기본 전투 Acceptance 정의 완료
- Gate B (P04~06): 적/Duel/보스 상태 머신 + Schema 완료
- Gate C (P07~09): 성장/장비/보상/스테이지 연결 규칙 완료
- Gate D (P10~16): UI/Save/Presentation/Balance/QA/Release 정의 완료

## 18.4 패키지 종료 조건 (10종 산출물)
Bible / Spec / Data Schema / State Machine / Exception Rules / AI Task Breakdown / Acceptance Test / Integration Guide / Review Checklist / Definition of Done

## 18.5 Stage 1 (Package 01) 완료 기준
- 왼손 이동 + 오른손 제스처 → 검술 안정 발동
- Gesture 성공률 95%+, 오인식 3%↓, 멀티터치 정상, 60FPS 유지
- 종료 후 가능한 플레이: 이동, 제스처, 검술 발동, 적 1종 처치, 기본 손맛 검증 = **Vertical Slice 0.1**

## 18.6 현재 진행 상태 (v3.5 기준)
| 구분 | 상태 |
|---|---|
| 게임 방향 / Core Loop / 성장 / 상용화 / 데이터 구조 / Gesture 설계 | ✅ 완료 |
| Input 설계 | 🔨 진행 중 (Bible+Spec 완료, Acceptance/AI Task/Final Integration 미작성) |
| Combat / Boss / Progression 구현 명세, UI/Save | ⏳ 대기 |

## 18.7 남은 문서 작업 (즉시 순서)
1. Input System Acceptance Test Spec
2. AI Task Spec — Input System
3. Stage 1 Final Integration & Review
→ 완료 시 Package 01 종료, Package 02(Skill Execution: 검술 8개 확정, Skill State Machine, 캔슬/연계 규칙) 착수.

## 18.8 Living Document 정책 (Package01 문서에서 선언)
앞으로 새 v3.x 문서를 만들지 않는다. 패키지별 Living Document만 계속 업데이트한다 (기존 섹션 병합 + 버전 증가 + 변경 이력 기록).

---

# 19. 미결정 사항 (Open Questions 통합)

## 설계
- 검술 8개가 출시 기준으로 충분한가? 보스 5명, 검파 3개가 적절한가?
- 한 판에서 성장 선택은 몇 번이 적당한가? 희귀 선택 등장 시점? 검파 전용 선택지 해금 시점?
- 최종 보스 클리어 직후 남길 핵심 감정은? 최고 난이도의 타겟 플레이어는? 스토리와 감정 곡선의 연결 정도?
- 검술 Lv1→Lv5 진화의 구체적 내용 (미설계)
- 첫 DLC 목표 시점 (출시 후 몇 개월?)

## 기술 (✅ = v1.1에서 종결)
- ~~엔진 선택~~ → ✅ **ADR-009: TS + Vite + Phaser 3**
- ~~제스처 알고리즘 / 8방향 vs 16방향~~ → ✅ **ADR-010: 벡터 기반 자체 구현, 8방향**
- ~~플랫폼 우선순위~~ → ✅ **ADR-008: PC+모바일 동시 (웹 우선 배포)**
- ~~Unreal DataTable과 JSON 병행~~ → ✅ 웹 스택 확정으로 JSON 단독 (§15 그대로)
- 수익화 재설계: Steam DLC + 모바일 IAP 병행 모델 (ADR-008 후속)
- Localization 키 초기 분리 여부
- PC 제스처 버튼 사용자 설정, 마우스 단독 접근성 모드, 게임패드 지원 시점, Input Replay 초기 도입 여부
- 제스처 학습 모드 제공 여부, 자동 리플레이 입력 테스트, 사용자 입력 데이터셋 구축, 기기별 오차 자동 보정

---

# 20. 문서 정리 참고 사항 (통합 과정에서 발견)

1. **중복 파일**: `v1.4 (1)`, `v3.3 (1)`, `v3.4 (1)`은 원본과 동일한 복사본 — 삭제 가능.
2. **파일 내용 오류**: `SwordMaster_GDD_v3.3_Input_System_Bible.md`의 실제 내용은 v3.2 Stage 1 Development Package와 동일함. **Input System Bible 원본 내용이 별도로 존재하지 않음** (다만 v3.4 Input System Spec이 해당 내용을 포괄).
3. **결번**: v3.6 문서 없음 (v3.5 → v3.7로 건너뜀).
4. **수치 변경 이력**: MVP 범위가 v0.7(맵 3개, 보스 3명, 검술 6~8개) → v2.4 Scope Bible(스테이지 5개, 보스 5+5명, 검술 8개+오의 5+검기 3)로 확대됨. 본 문서는 v2.4 기준을 채택.
5. **검객 성장 단계**: v0.2(11단계) → v0.9(10단계)로 정리됨. 본 문서는 v0.9 채택.
6. **First 30 Minutes Design**: v0.7~0.8에서 "완료(✅)"로 표시되나 해당 문서 자체는 폴더에 없음. 내용 일부는 Psychology Bible(§2.6)에 반영되어 있으나 분 단위 상세 설계는 부재 — 보완 필요.
7. **미작성 문서** (기존 문서들이 "다음 문서"로 예고했으나 부재): Sword Language Bible(검술 개별 정의), Combat Grammar/Combat Bible Part 2(히트스톱 수치, 캔슬 규칙 등), Boss Pattern Bible, Camera Bible, Flow State Bible, Production Bible, Input Acceptance Test Spec, AI Task Spec(Input).

---

# 부록. 원본 문서 목록 (38종)

v0.1 초기 GDD / v0.2 진행 기록 / v0.3 상용화 / v0.4 Market Fit / v0.5 성장·로드맵 / v0.6 3축 성장 / v0.7 MVP / v0.8 Fun Checklist / v0.9 Progression Bible / v1.0 Enemy Teaching / v1.1 Stage Design / v1.2 Prototype Spec / v1.3 Feature Priority / v1.4 Master Design Bible / v1.5 Combat Bible P1 / v1.6 Game Feel P1 / v1.7 ADR / v1.8 Core Loop / v1.9 Difficulty Curve / v2.0 Reward & Motivation / v2.1 Player Archetype / v2.2 Psychology / v2.3 Decision Design / v2.4 Scope / v2.5 Dev Priority Matrix / v2.6 Data Architecture / v2.7 Gesture Recognition / v2.8 Gesture Algorithm / v2.9 Gesture Acceptance / v3.0 AI Task(Gesture) / v3.1 Integration(Gesture) / v3.2 Stage1 Package / v3.3 (내용=v3.2) / v3.4 Input System Spec / v3.5 Remaining Roadmap / v3.7 Dependency Map / Package01 Living Document
