# 마스터 태스크 백로그 v1.0 — 개발 실행 계획

> 작성일: 2026-07-12
> **이 문서가 개발의 단일 진행표다.** 전체 설계(Package 01~16)를 121개 개발 태스크로 분류했다.
> 개발은 이 표의 순서대로, **한 번에 한 태스크씩** 진행한다.

---

# 1. 태스크 실행 규칙 (모든 태스크 공통)

한 태스크의 사이클 (AI Task Spec 공통 규칙):
```
① 해당 패키지 Living Document의 태스크 항목 확인
② 기존 코드 분석 → ③ 구현 (300~800줄 이내, 단일 책임)
④ Unit Test 작성·통과 → ⑤ 관련 Acceptance TC 실행
⑥ Self Review → ⑦ 커밋 + 백로그 상태 갱신 (□→✅)
```
- 테스트 실패 상태로 다음 태스크 진행 금지.
- 태스크 완료마다 이 문서의 체크박스를 갱신한다 (진행률의 단일 출처).
- 설계 변경이 필요해지면: 구현 중단 → 해당 Living Document 개정 + ADR → 재개.

# 2. 마일스톤 구조

| 마일스톤 | 내용 | 포함 태스크 | 완료 판정 |
|---|---|---|---|
| **M-A** Vertical Slice 0.1 | 이동+제스처+검술 3종+더미 적 | GES 10 + INP 13 + 통합 3 | Stage1 Final Integration §5 |
| **M-B** 전투 코어 | 검술 8종+오의+전투 규칙 | SKL 8 + CBT 8 | Gate A |
| **M-C** 적과 결투 | 적 12종+Duel+보스 5+5 | ENM 7 + DUL 7 + BOS 7 | Gate B |
| **M-D** 게임 루프 | 성장+장비+스테이지 5개 | PRG 8 + EQP 6 + STG 7 | Gate C — **첫 완주 가능 빌드** |
| **M-E** 제품화 | UI+저장+연출 | UI 8 + SAV 6 + PRS 7 | 데모 후보 빌드 |
| **M-F** 데모 출시 | 밸런스+QA+웹 데모 공개 | BAL 6 + QA 1~4 | 웹 데모 라이브 |
| **M-G** 정식 출시 | 패키징+운영+최종 리뷰 | QA 5~7 + LIV 3 + REL 3 | Gate D + Freeze |

# 3. 전체 태스크 목록 (실행 순서)

## M-A: Vertical Slice 0.1 (26 태스크) — 2026-07-12 코드 완료 (실기 검증 대기)
프로젝트: `game/` 폴더. 테스트 83종 전체 PASS. 판정 성능 0.12ms/회 (요구 20ms).

✅ GES-01 Point Buffer          ✅ GES-02 Normalize          ✅ GES-03 Noise Filter
✅ GES-04 Resample              ✅ GES-05 Direction Builder  ✅ GES-06 Pattern Matching
✅ GES-07 Score Engine          ✅ GES-08 Skill Resolver     ✅ GES-09 Debug (데이터부)
✅ GES-10 Gesture Integration   — 43 테스트 PASS. 발도술 왕복 오인 해결(splitByReversal), 짧은/느린 획 하드 게이트 추가
✅ INP-01 Types+Config          ✅ INP-02 Clock+EventBus     ✅ INP-03 Device Adapters
✅ INP-04 Pointer Ownership     ✅ INP-05 Context Controller ✅ INP-06 Router+UI Gate
✅ INP-07 Movement Processor    ✅ INP-08 Gesture Collector  ✅ INP-09 Dodge+Command Buffer
✅ INP-10 CancelAll+생명주기    ✅ INP-11 InputManager 조립  ✅ INP-12 Debug Snapshot
✅ INP-13 결정론 리플레이+Acceptance — 34 테스트 PASS (FPS 30/60/120 결정론 포함)
✅ ITG-01 Input↔Gesture 연결 — 6 테스트 PASS (TC-106 패링 오발 방지 포함)
✅ ITG-02 Phaser 테스트 씬 + 더미 적 — 코드 완료 (브라우저 실행은 아래 실기 절차)
□ ITG-03 Stage 1 Acceptance 실기 — **사용자 게이트**: 폰/PC 실플레이 + 패링 ✓ 실측

### 개발 노트 (M-A)
- 테스트 러너 = **node:test** (`node --experimental-strip-types --test`) — 의존성 0. vitest 대체 (샌드박스 npm 차단 + 도구 경량화. package.json 반영됨).
- 실기 절차: `cd game && npm install && npm run dev` → 브라우저. 폰 테스트는 같은 네트워크에서 `npm run dev -- --host`.
- 미검증 항목(사용자 환경 필요): `npm run typecheck`(tsc), Phaser 씬 픽셀, 폰 멀티터치 실감.

## M-B: 전투 코어 (16) — 2026-07-12 코드 완료 (손맛 실기 대기)
✅ SKL-01 스키마+로더  ✅ SKL-02 Grade 판정  ✅ SKL-03 State Machine  ✅ SKL-04 Stamina
✅ SKL-05 실행 파이프라인  ✅ SKL-06 오의 판정  ✅ SKL-07 검기 게이지  ✅ SKL-08 데이터(16종)+Acceptance
✅ CBT-01 히트 기하  ✅ CBT-02 Hit 파이프라인  ✅ CBT-03 Damage Formula  ✅ CBT-04 Poise/그로기
✅ CBT-05 Hit Reaction  ✅ CBT-06 콤보  ✅ CBT-07 피격/회피  ✅ CBT-08 이벤트+Acceptance
— 테스트 52종 PASS (누적 135). 테스트 씬을 실데이터 전투로 교체 (더미 3종: 잡병/방패병/중갑귀).
— 수정 이력: 가드브레이크·그로기 동시 발생 시 반응 우선순위 확정 (dead > guard_break > groggy).
**→ Gate A 리뷰: 사용자 손맛 판정 대기** (검술 8종·오의 연계·검기 발동·방패/자세 기믹)

## M-C: 적과 결투 (21) — 2026-07-12 코드 완료 (보스전 실기 대기)
✅ ENM-01 스키마+12종 데이터  ✅ ENM-02 State Machine  ✅ ENM-03 Telegraph(노랑700/빨강500 린트)
✅ ENM-04 토큰/협동(동시2·빨강1)  ✅ ENM-05 기믹(가드/슈퍼아머)  ✅ ENM-06 데이터 검증  ✅ ENM-07 Acceptance
✅ DUL-01 Duel FSM(momentum)  ✅ DUL-02 공격권 게이지  ✅ DUL-03 자세/난무  ✅ DUL-04 연쇄 패링(60/70/85/100)
✅ DUL-05 거리 존  ✅ DUL-06 진입/종료(Context 연동)  ✅ DUL-07 Acceptance
✅ BOS-01 패턴 스키마+검증  ✅ BOS-02 선택기(결정론 RNG·2연속 금지)  ✅ BOS-03 Phase  ✅ BOS-04 B1 노병 상세
✅ BOS-05 미니보스 프레임  ⚠ BOS-06 B2~5+M2~5 — 구조·데이터 입력 완료, 기믹 상세는 초안(스토리 확정 후 보강)
□ BOS-07 보상 연결 — PRG-04(M-D) 선행 필요로 이월
— 테스트 30종 PASS (누적 165). 씬: 필드(적 AI 3종+실전 패링) + B키 Duel Mode(B1).
— 설계 결정: 연쇄 패링은 적 공세 중 누진 유지, 공격권은 패턴 종료 시 부여 (P05 §5 개정 반영 필요)
**→ Gate B 리뷰: 사용자 보스전 판정 대기** (BOS-04 게이트: 첫 보스전이 재미있는가 + 패링 ✓ 실전 실측)

## M-D: 게임 루프 (21) — 2026-07-12 1차 통과분 완료 (S1 완주 가능 빌드)
✅ PRG-01 스키마(12옵션 풀)  ✅ PRG-02 3택 생성(축2+·중복0·만렙 제외·보스 레어 보장)  ✅ PRG-03 효과 적용
□ PRG-04 검술 진화(Lv2~5)  □ PRG-05 수련점/메타  □ PRG-06 승급  □ PRG-07 검파  □ PRG-08 사망 정산(간이: 사인+골드 소실 표시만 구현)
□ EQP-01~03, 05 (장비/드랍/상점 — 미착수)  ✅ EQP-04 골드(처치 보상·HUD·소실)
✅ STG-01 S1 데이터+러너  ✅ STG-02 횡스크롤 필드(스크롤 카메라·전진 제한)  ✅ STG-03 스포너(웨이브 트리거)
✅ STG-04 휴지(회복)  □ STG-05 체크포인트(현재: 런 전체 재시작)  ✅ STG-06 S1 조립  □ STG-07 S2~5
— 테스트 9종 PASS (누적 174). 보스전 연출 추가: 등장(줌+타이틀+입력 잠금), 타격 '!', 처치 슬로우+줌, 결과 화면, 피격 넉백, 합성 SFX 10종.
**→ Gate C 1차 리뷰: S1 완주 실기** (남은 M-D 2차: 진화/메타/장비/상점/체크포인트/S2~5)

### M-D 2차 (2026-07-12 완료분)
✅ PRG-04 검술 진화 — range_mul 시스템 (사거리/범위가 실제 변하는 진화 옵션 3종: 신속·검풍·광풍)
✅ PRG-05/06 수련점·승급 — MetaState(localStorage 영구 저장, 승급 10단계, 시작 특성: 숙련검사+HP20/검객+100G)
✅ PRG-08 사망 정산 — 사인 + [C=체크포인트 부활 / R=런 포기·정산] + 클리어 정산(승급 표시)
✅ STG-05 체크포인트 — 섹션 시작 부활, 런 빌드·골드 유지 (P09 §6)
✅ STG-07(부분) S2 대나무 숲 — 궁수/쾌검/쌍검 + 사냥꾼 + B2 홍련 무희, 스테이지 체인(E=다음)
— 테스트 10종 추가 (누적 184). 잔여: EQP 장비/상점, PRG-07 검파, S3~5.

### M-D 3차 (2026-07-12 완료) — **Gate C 달성: 5스테이지 완주 가능**
✅ STG-07 S3 폐성(B3 거암)·S4 설원(B4 무영)·S5 검성봉(B5 흑월 3Phase) — 체인 S1→S5, 적 12종 전원 등장
✅ PRG-07 검파 3종 — 런 시작 선택 (발도류/정검류/쾌검류, 강화 방향 차등)
✅ EQP-05 상점 — 휴식처: 회복약 80G/숫돌(스테이지 피해+20%) 100G/비전서(레어 성장) 150G
✅ 버그: 한글 폰트 명시(글리프 깨짐), 와이드 화면 가로 획 상한, 사망=스테이지 처음부터, 타이틀=횡베기로 시작
— 테스트 누적 188. 잔여: EQP 장비 슬롯(무기/호구/비전 — 드랍형), Gate C 실기 리뷰(완주 30~40분 실측)

## M-E: 제품화 (21) — 1차 착수 (2026-07-12)
✅(1차) PRS-03/04 일부 — 검격 리그(스킬 타이밍 동기화 팔/검 스윙: 준비→휘두름→복귀, 16종 프로파일), 적 예고 젖힘/타격 내지르기 자세, 달리기 자세
✅(1차) PRS-05 일부 — 합성 SFX 10종 (정식 에셋 교체 전 임시)
✅(1차) UI-04 일부 — 타이틀 씬 (탭하여 시작=AudioContext 게이트, 승급·수련점 표시)
잔여 ↓
□ UI-01 HUD  □ UI-02 판정 피드백  □ UI-03 3택/상점  □ UI-04 타이틀/결과/일시정지
□ UI-05 수련의 방/도감  □ UI-06 설정  □ UI-07 튜토리얼  □ UI-08 Acceptance
□ SAV-01 스키마/체크섬  □ SAV-02 이중 슬롯  □ SAV-03 저장 시점  □ SAV-04 런 스냅샷
□ SAV-05 마이그레이션  □ SAV-06 Backend 추상화+Acceptance
□ PRS-01 이벤트 프로파일  □ PRS-02 카메라  □ PRS-03 검 궤적  □ PRS-04 VFX
□ PRS-05 오디오  □ PRS-06 아트 1차  □ PRS-07 Acceptance   (UI/SAV/PRS 병렬 가능)

## M-F: 데모 출시 (10)
□ BAL-01 balance.json 통합  □ BAL-02 봇 시뮬  □ BAL-03 절대값 확정  □ BAL-04 난이도 3단
□ BAL-05 사용 분포  □ BAL-06 실기 튜닝 R1
□ QA-01 CI  □ QA-02 황금 리플레이  □ QA-03 텔레메트리  □ QA-04 대시보드
**→ 웹 데모 공개 + First 30 Minutes 실기 검증**

## M-G: 정식 출시 (13)
□ QA-05 Tauri(Steam)  □ QA-06 Capacitor(모바일)  □ QA-07 릴리스 체크리스트
□ LIV-01 핫픽스 파이프라인  □ LIV-02 패치노트  □ LIV-03 운영 런북
□ REL-01 Gate 리포트  □ REL-02 Open Question 정리  □ REL-03 Freeze 선언
(+ 스토리/대본, 스토어 자산, 가격 확정 — 사용자 참여 태스크)

# 4. 병렬 규칙

- 기본은 순차. 병렬 허용 구간: ENM∥DUL (M-C), UI∥SAV∥PRS (M-E), 문서·아트는 상시 병행.
- 1인+AI 체제에선 "한 세션 = 한 태스크"를 권장 — 컨텍스트 오염 방지.

# 5. 사용자(디렉터) 판정 지점

| 시점 | 판정 내용 |
|---|---|
| ITG-03 | 패링 ✓ 실측 — 불성립 시 Bible 재개정 |
| SKL-08 | 검술 8종 손맛 |
| BOS-04 | 첫 보스전 재미 |
| STG-06 | S1 5분 체감 |
| UI-07 | 튜토리얼 무막힘 |
| BAL-06 | 난이도 곡선 |
| M-F | 데모 공개 승인 |
| M-G | 가격·출시 승인 |

# 6. 진행 현황

- 설계: Package 01~16 전체 완료 (2026-07-12) ✅
- 개발: 미착수 — 다음 작업 = **GES-01**

# Cross References
전 패키지 Living Documents / Stage1 Final Integration / 마스터 문서 v1.1
