# Input System Acceptance Test Spec v1.0

> 작성일: 2026-07-12 | Package 01 마감 문서 1/3
> 상위: Input System Spec(v3.4), 통합 마스터 문서 v1.1 (ADR-008/009: PC+모바일, TS+Vite+Phaser 3)
> 구현 방법은 자유지만 아래 테스트를 모두 통과해야 Input System을 '완료'로 인정한다.
> Gesture 인식 자체의 합격 기준은 Gesture Acceptance Test Spec(v2.9)이 담당 — 이 문서는 입력 계층(수집·라우팅·소유권·버퍼·컨텍스트)만 다룬다.

---

# 1. 테스트 원칙

- 구현이 아니라 결과를 검증한다. 모든 TC는 PASS/FAIL이 객관적이어야 한다.
- 자동 테스트(vitest + Fake Adapter/Clock) 우선, 실기 테스트는 자동으로 불가능한 항목만.
- 동일 Raw Event 시퀀스 리플레이 = 동일 Command 시퀀스 (결정론).

# 2. 실행 환경 매트릭스

| 구분 | 대상 |
|---|---|
| 브라우저 | Chrome(데스크톱/안드로이드), Safari(iOS), Edge |
| 입력 장치 | 키보드+마우스(PC), 멀티터치(폰/태블릿) |
| FPS | 30 / 60 / 120 (FakeClock 시뮬레이션) |
| 해상도 | 720p, 1080p, 1440p, 모바일 세로 금지(가로 고정) |

---

# 3. 기능 테스트

## TC-100 PC 이동
- 입력: WASD/화살표 각 방향 + 대각(W+D 등) + 상충(A+D 동시)
- PASS: 벡터 정확(대각 정규화 길이 1), 상충 시 0, 키 릴리즈 즉시 반영

## TC-101 터치 가상 스틱
- 입력: 좌측 영역 터치다운 → 드래그(dead_zone 안/밖/full_radius 밖)
- PASS: dead_zone 내 (0,0), 경계 밖 clamp=1, 터치 해제 즉시 (0,0)

## TC-102 이동 중 제스처 (핵심)
- 입력: 왼손 스틱 유지 + 오른손 제스처(횡베기 E) 동시
- PASS: 이동 벡터 유지된 채 GestureSession 정상 완료. 상호 간섭 0

## TC-103 제스처 중 이동 변경
- 입력: 제스처 Collecting 중 왼손 스틱 방향 전환
- PASS: 이동 즉시 반영, 제스처 포인트 오염 없음

## TC-104 회피 입력
- 입력: 회피 + 이동 동시 / 제스처 직후 회피 (버퍼 100ms 내)
- PASS: DodgeCommand가 버퍼에 등록·우선순위(70)로 소비. 이동/제스처 취소 없음

## TC-105 UI 차단
- 입력: 버튼(UI) 위 터치다운 → 드래그로 게임 영역 진입
- PASS: OwnedByUI 유지, Movement/Gesture로 전이 금지 (금지 전이 §6)
- **[프로토타입 교훈]** 표시 전용 오버레이(패널·토스트·궤적 연출)는 `pointer-events: none` — 화면 전체가 제스처 영역이어야 함. 오버레이가 터치를 삼키면 FAIL

## TC-106 패링 유효창 내 SE 단독 입력
- 입력: 패링 유효창 활성 상태에서 `SE` 단독 제스처
- PASS: 사선베기 미실행, 패링 시도(실패)로 처리 (Sword Language Bible §2.8 조건 4)

# 4. Pointer Ownership 테스트

## TC-110 소유권 기본
- 입력: 좌측 터치(A) + 우측 터치(B) + UI 터치(C) 동시 3점
- PASS: A=Movement, B=Gesture, C=UI. 각 pointer_id 독립 관리

## TC-111 소유권 충돌
- 입력: 이미 Gesture 소유 중인 pointer_id로 중복 Down 이벤트 주입
- PASS: INPUT-001 로그, 크래시 없음, 기존 세션 유지

## TC-112 무주공산 이벤트
- 입력: Owner 없는 pointer_id의 Move/Up 주입
- PASS: INPUT-002/003 로그 후 무시, 상태 오염 없음

## TC-113 제스처 중 제3 터치
- 입력: 이동+제스처 중 화면 우측에 세 번째 터치
- PASS: GestureAlreadyActive(INPUT-004) — 기존 제스처 보호, 새 세션 시작 금지

# 5. Context 전환 테스트

## TC-120 Gameplay → Pause → 복귀
- PASS: Pause 진입 시 전체 Cancel(이동 0, 제스처 Canceled), 복귀 시 새 입력만 허용(홀드 중이던 키 무시)

## TC-121 Field → Duel 전환
- PASS: 이동 입력 유지, 진행 중 제스처만 취소 (기본 정책 §7)

## TC-122 유효하지 않은 전환
- 입력: Result → GameplayDuel 직접 전환 시도
- PASS: INPUT-005 로그, 전환 거부

## TC-123 전환 중 이벤트 순서
- PASS: BeforeContextChange → Cancel → OnInputContextChanged 순서 보장 (이벤트 발행 순서 §13)

# 6. 포커스/생명주기 테스트 (웹 특화)

## TC-130 포커스 손실
- 입력: 제스처+이동 중 blur 이벤트 (탭 전환/알림)
- PASS: CancelAllInput 실행, 복귀 후 유령 입력(눌린 채 고정된 키·터치) 0건

## TC-131 백그라운드 탭
- 입력: document.hidden=true 상태 전환
- PASS: 입력 상태 안전 초기화. **[프로토타입 교훈]** RAF 정지 상태에서 이벤트 누적으로 인한 폭주 없음 — 복귀 시 타임스탬프 점프를 감지해 버퍼 전체 만료 처리

## TC-132 화면 회전/리사이즈
- 입력: 제스처 중 orientationchange/resize
- PASS: 진행 중 세션 Cancel(사유 기록), 정규화 좌표계 즉시 갱신, 다음 입력 정상

## TC-133 포인터 이탈
- 입력: 마우스가 캔버스 밖으로 나갔다 복귀 / 터치가 화면 가장자리에서 끊김(pointercancel)
- PASS: RawPointerCancel 경로로 정상 취소, Owner 해제

# 7. Command Buffer 테스트

## TC-140 만료
- PASS: skill 120ms / dodge 100ms / parry 80ms 경과 시 Expired 처리·이벤트 발행

## TC-141 우선순위 소비
- 입력: Dodge(70)와 Gesture(60) 동시 대기
- PASS: Dodge 먼저 소비

## TC-142 중복/초과
- PASS: 동일 sequence_id 거부(INPUT-006), 용량 16 초과 시 최저 우선순위·최고령 제거(INPUT-007)

# 8. 결정론 테스트

## TC-150 FPS 독립
- 입력: 동일 Raw Event 시퀀스를 30/60/120FPS FakeClock으로 재생
- PASS: 발생 Command 시퀀스 동일 (타임스탬프 제외 완전 일치)

## TC-151 리플레이
- 입력: 녹화된 Raw Event 100개 시퀀스 2회 재생
- PASS: Command 순서·내용 완전 동일

## TC-152 sequence_id / clock
- PASS: sequence_id 단조 증가, timestamp는 performance.now() 기반 monotonic

# 9. 성능/메모리 테스트

- 입력 이벤트 처리: 프레임당 예산 2ms 이내 (60FPS 기준)
- 10분 연속 난타 입력: 힙 증가 없음(풀링 검증), GC 스파이크로 인한 프레임 드랍 0
- 포인터 이벤트 폭주(초당 1000+ 주입): 프레임당 처리 상한 작동, 크래시 없음

# 10. 실기 테스트 (자동 불가 항목)

기기: 안드로이드 폰 1대 + iPhone 1대 + PC 1대 (최소)

□ 왼손 이동 + 오른손 제스처가 자연스러운가 (10분 플레이)
□ 입력 씹힘 체감 0건
□ 화면 전체가 제스처 영역으로 동작 (모든 UI 위에서 긋기 통과)
□ 패링 ✓가 예고 시간 내에 물리적으로 가능한가 (Sword Language Bible §2.8 조건 1 실측)
□ 브라우저 제스처 간섭 없음 (당겨서 새로고침, 뒤로가기 스와이프, 더블탭 줌 — touch-action/CSS로 차단 확인)

# 11. 완료 조건

- 자동 TC 전부 PASS (CI에서 재현 가능)
- 실기 체크리스트 전부 통과
- 치명적 버그 0, 오류 코드 로그 규격 일치
- 성능 기준 충족

# Cross References
- Input System Spec (v3.4) §22 Acceptance 연결 기준
- Gesture Acceptance Test Spec (v2.9)
- Sword Language Bible v0.1 §2.8 (패링 조건), §6 (충돌 매트릭스)
- AI Task Spec — Input System (본 패키지 2/3)

# Open Questions
1. iOS Safari의 pointercancel 동작 편차 — 실기에서 확인 후 예외 규칙 추가 여부
2. 게임패드 지원 시점 (마스터 문서 §19 미결 유지)
