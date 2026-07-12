# AI Task Spec — Input System v1.0

> 작성일: 2026-07-12 | Package 01 마감 문서 2/3
> 상위: Input System Spec(v3.4), Input Acceptance Test Spec(v1.0), ADR-009(TS+Vite+Phaser 3)
> AI(Claude/Codex/GPT)가 동일한 방식으로 Input System을 구현하도록 작업 단위를 정의한다.
> Gesture 인식 내부는 AI Task Spec — Gesture(v3.0)가 담당. 본 문서는 입력 계층만.

---

# 구현 원칙 (v3.0과 동일)

- 한 Task = 300~800줄 이하, 단일 책임, Unit Test 필수.
- 모든 로직은 순수 TS (Phaser/DOM 비의존) — 브라우저 이벤트는 Adapter에서만 접촉.
- 시간은 IClock 주입 (performance.now 래핑 + FakeClock).
- AI 실행 순서(불변): Spec 확인 → 기존 코드 분석 → 구현 → Unit Test → Acceptance 연계 → Self Review → 커밋 후보. 테스트 실패 시 다음 Task 진행 금지.

# 기술 컨텍스트 (웹 스택 확정 사항)

- 이벤트 소스: Pointer Events API 단일화 (`pointerdown/move/up/cancel`) — touch/mouse 이벤트 직접 사용 금지 (장치 통합).
- 캔버스: `touch-action: none`, 컨텍스트 메뉴·브라우저 제스처 차단은 TASK-201에서 처리.
- 좌표 정규화: 0~1, devicePixelRatio 무관.
- 테스트: vitest, Fake Adapter로 헤드리스 실행 (CI 재현 가능).

---

# 작업 순서

## TASK-201 : InputTypes + InputConfig
- 목표: RawPointerEvent, MoveCommand, GestureSession, DodgeCommand, BufferedCommand, Context/Owner enum, 오류 코드(INPUT-001~010), 우선순위 상수 정의. InputConfig 로더(유효성 검사 실패 시 안전 기본값 + 로그).
- 완료: 타입 컴파일 + Config 검증 Unit Test PASS
- 의존: 없음

## TASK-202 : IClock + InputEventBus
- 목표: monotonic clock 추상화(FakeClock 포함), 타입 세이프 이벤트 버스, 이벤트 발행 순서 보장(§13: Context→Cancel→Release→GestureEnd→Dodge→Move→Device→Debug).
- 완료: 발행 순서 Unit Test PASS
- 의존: 201

## TASK-203 : Device Adapters
- 목표: KeyboardMouseAdapter + TouchAdapter(Pointer Events 기반), sequence_id 단조 증가, timestamp 부여, is_over_ui 판정, 브라우저 제스처 차단(touch-action, preventDefault 정책), FocusLost/visibilitychange/pointercancel → Raw 이벤트 변환.
- 완료: FakeDOM 이벤트 주입 Unit Test + TC-152 PASS
- 의존: 201, 202

## TASK-204 : PointerOwnershipRegistry
- 목표: pointer_id별 Owner 할당/해제, 금지 전이 차단, 중복 감지(INPUT-001), 무주공산 이벤트 처리(INPUT-002/003), 디버그 조회.
- 완료: TC-110~113 대응 Unit Test PASS
- 의존: 201

## TASK-205 : InputContextController
- 목표: Context 상태 머신(GameplayField/Duel/Tutorial/Menu/Pause/Dialogue/Cutscene/Result/Debug), 전환 유효성(INPUT-005), 전환 시 Cancel 정책 실행, Before/After 이벤트.
- 완료: TC-120~123 대응 Unit Test PASS
- 의존: 202, 204

## TASK-206 : InputRouter + UIInputGate
- 목표: UI 우선 검사 → Context 확인 → Owner 결정 → Processor 분배. 좌/우 영역 분기(movement_end_x 0.40 / gesture_start_x 0.50, 버퍼 구간 0.40~0.50 규칙 포함). 중복 입력 차단.
- 완료: 라우팅 Unit Test + TC-105 PASS
- 의존: 203, 204, 205

## TASK-207 : MovementInputProcessor
- 목표: 키보드(WASD/화살표) + 가상 스틱 결합, dead_zone(0.15)/full_radius(0.90), 정규화, 최근 활성 장치 우선 규칙, MoveCommand 발행, OnInputDeviceChanged.
- 완료: TC-100~101 대응 Unit Test PASS
- 의존: 206

## TASK-208 : GestureInputCollector
- 목표: GestureSession 수명주기(Idle→Collecting→PendingRecognition→Completed/Canceled), Point Buffer 풀링, min_points(12)/max_duration(1200ms) 검사, Gesture Engine(Package 01 기존 모듈)으로 전달, Cancel 사유 기록.
- 완료: TC-102~103, 113 대응 Unit Test PASS
- 의존: 206
- 참고: 패링 유효창 내 SE 단독 → 패링 실패 처리(TC-106)는 Skill Resolver 측 규칙 — GestureInputBridge에 유효창 플래그 전달만 구현.

## TASK-209 : DodgeInputProcessor + InputCommandBuffer
- 목표: DodgeCommand 생성, 버퍼(시간 제한·우선순위·중복 거부·용량 16·만료 이벤트), TryConsume(Executable/TemporaryBlocked/PermanentRejected).
- 완료: TC-104, 140~142 대응 Unit Test PASS
- 의존: 206

## TASK-210 : CancelAllInput + 생명주기 복구
- 목표: §12 명세 구현(이동 리셋, 제스처 취소, 버퍼 취소, Owner 전체 해제, 홀드 키 클리어). 호출 지점 연결: blur, visibilitychange, Pause/Cutscene 진입, 씬 언로드. 백그라운드 복귀 시 타임스탬프 점프 감지 → 버퍼 전체 만료.
- 완료: TC-130~133 대응 Unit Test PASS
- 의존: 207, 208, 209

## TASK-211 : InputManager (조립) + Update 순서
- 목표: 전체 모듈 초기화·수명주기, §5 Update 순서 10단계 고정, 외부 읽기 전용 상태 제공.
- 완료: 전체 파이프라인 통합 Unit Test (Raw 주입 → Command 출력) PASS
- 의존: 201~210 전부

## TASK-212 : InputDebugSnapshot + Overlay Bridge
- 목표: 현재 Context/Owner/버퍼/이동 벡터/활성 제스처 조회, 개발 모드 한정 상세 데이터, Phaser 오버레이 연결 인터페이스.
- 완료: Snapshot Unit Test PASS
- 의존: 211

## TASK-213 : 결정론 리플레이 + Acceptance 실행
- 목표: Raw Event 녹화/재생 도구, TC-150~152 자동화, Input Acceptance Test Spec 전체 자동 TC 실행 + 리포트 생성.
- 완료: 자동 TC 100% PASS + 성능 기준(§9) 충족
- 의존: 211, 212

---

# 산출물 (Task마다)
Source / Unit Test / Test Report / Review Report / 변경 로그

# Definition of Done
□ 코드 완료 □ Unit Test PASS □ Acceptance 자동 TC PASS □ 성능 기준 충족 □ Self Review 완료

# Cross References
- Input System Spec (v3.4) — 모듈 구조·알고리즘·오류 코드의 원 명세
- Input Acceptance Test Spec (v1.0) — TC 번호 매핑
- AI Task Spec — Gesture (v3.0) — TASK-001~010 (제스처 내부, 선행 완료 가능)
- Stage 1 Final Integration (본 패키지 3/3)

# Open Questions
1. TASK-203에서 Pointer Events 미지원 구형 브라우저 폴백 필요 여부 (지원 브라우저 정책 확정 필요 — 기본: 미지원)
2. 리플레이 도구(TASK-213)를 QA 패키지(P14)까지 유지·확장할지
