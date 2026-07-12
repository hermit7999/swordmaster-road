
# SwordMaster GDD v3.4
# Input System Spec v1.0

> 목적
>
> 이 문서는 `Input System Bible`을 실제 구현 가능한 모듈, 상태 머신,
> 이벤트 흐름, 데이터 구조, 의사코드, 파일 책임 단위로 구체화한다.
>
> 구현자는 이 문서만으로 Stage 1의 입력 기반 시스템을 작성할 수 있어야 한다.

---

# 1. 구현 범위

본 Spec의 구현 범위는 다음과 같다.

- PC 키보드/마우스 입력
- 터치 이동 영역과 제스처 영역
- 왼손 이동과 오른손 제스처 동시 입력
- 회피 입력
- Input Context
- Pointer Ownership
- 입력 버퍼
- Cancel 및 포커스 손실 복구
- 입력 이벤트 발행
- 디버그 상태 조회

본 Spec에서 제외한다.

- 스킬 데미지
- 공격 판정
- 패링 성공 판정
- 회피 무적 시간
- 적 AI
- 애니메이션 실행
- 제스처 패턴 판별 알고리즘 내부

---

# 2. 권장 모듈 구조

```text
Input/
├── Core/
│   ├── InputManager
│   ├── InputRouter
│   ├── InputContextController
│   ├── InputCommandBuffer
│   └── InputEventBus
│
├── Devices/
│   ├── KeyboardMouseAdapter
│   ├── TouchAdapter
│   └── DeviceActivityTracker
│
├── Ownership/
│   ├── PointerOwnershipRegistry
│   └── UIInputGate
│
├── Movement/
│   ├── MovementInputProcessor
│   └── VirtualJoystickProcessor
│
├── Gesture/
│   ├── GestureInputCollector
│   └── GestureInputBridge
│
├── Dodge/
│   └── DodgeInputProcessor
│
├── Debug/
│   ├── InputDebugSnapshot
│   └── InputDebugOverlayBridge
│
└── Tests/
    ├── Unit/
    ├── Integration/
    └── Fixtures/
```

---

# 3. 책임 분리

## 3.1 InputManager

책임:

- 입력 시스템 수명주기 관리
- 각 모듈 초기화
- Update 순서 관리
- CancelAllInput 호출
- 외부 시스템에 읽기 전용 상태 제공

비책임:

- 원시 장치 이벤트 직접 해석
- 제스처 패턴 판별
- 스킬 실행 여부 결정

---

## 3.2 Device Adapter

책임:

- 엔진 원시 입력을 공통 이벤트로 변환
- 장치 고유 좌표와 버튼 상태 수집
- timestamp와 sequence_id 생성

출력 이벤트:

```text
RawPointerDown
RawPointerMove
RawPointerUp
RawPointerCancel
RawKeyDown
RawKeyUp
RawAxisChanged
RawFocusLost
RawFocusGained
RawDeviceDisconnected
```

---

## 3.3 InputRouter

책임:

- UI 우선 검사
- 현재 Input Context 확인
- Pointer Owner 결정
- 적절한 Processor로 입력 전달
- 중복 입력 차단

---

## 3.4 InputContextController

책임:

- 현재 Context 유지
- Context 전환 유효성 검사
- Context 변경 이벤트 발행
- 전환 시 Cancel 정책 실행

---

## 3.5 PointerOwnershipRegistry

책임:

- pointer_id별 Owner 저장
- Pointer Down 시 소유권 할당
- Pointer Up/Cancel 시 해제
- 중복 할당 감지
- 디버그 조회 제공

---

## 3.6 MovementInputProcessor

책임:

- 키보드/가상 스틱 입력 결합
- Dead Zone 처리
- 벡터 정규화
- MoveCommand 발행
- 이동 상태 유지

---

## 3.7 GestureInputCollector

책임:

- GestureStart/Update/End 수집
- Point Buffer 관리
- Gesture Cancel
- Gesture Recognition 모듈로 입력 전달

---

## 3.8 DodgeInputProcessor

책임:

- 회피 요청 입력 수집
- DodgeCommand 생성
- 입력 버퍼에 요청 등록

비책임:

- 실제 회피 가능 여부 판정
- 무적 시간 처리
- 스태미너 소비

---

## 3.9 InputCommandBuffer

책임:

- 시간 제한 명령 저장
- 우선순위 기반 조회
- 소비/만료/폐기 처리
- 디버그 조회 제공

---

# 4. 공통 데이터 타입

## 4.1 RawPointerEvent

```text
RawPointerEvent
- event_type
- pointer_id
- screen_x
- screen_y
- normalized_x
- normalized_y
- timestamp_ms
- sequence_id
- device_type
- pressure
- is_over_ui
```

---

## 4.2 MoveCommand

```text
MoveCommand
- vector_x
- vector_y
- magnitude
- timestamp_ms
- sequence_id
- device_type
```

---

## 4.3 GestureSession

```text
GestureSession
- pointer_id
- started_at_ms
- last_updated_at_ms
- source_device
- start_region
- points[]
- status
- cancel_reason
```

status:

```text
Idle
Collecting
PendingRecognition
Completed
Canceled
```

---

## 4.4 DodgeCommand

```text
DodgeCommand
- direction_x
- direction_y
- timestamp_ms
- sequence_id
- device_type
```

---

## 4.5 BufferedCommand

```text
BufferedCommand
- command_id
- command_type
- payload
- created_at_ms
- expires_at_ms
- priority
- source_sequence_id
- state
```

state:

```text
Pending
Consumed
Expired
Rejected
Canceled
```

---

# 5. Update 순서

매 프레임 다음 순서를 유지한다.

```text
1. Device Adapter Poll
2. Raw Event Queue Drain
3. UI Gate Evaluation
4. Input Router Dispatch
5. Movement State Update
6. Gesture Session Update
7. Dodge Request Update
8. Command Buffer Expire
9. Input Events Publish
10. Debug Snapshot Update
```

Update 순서는 임의로 변경하지 않는다.

---

# 6. Pointer Ownership 상태 머신

## 상태

```text
Unowned
OwnedByUI
OwnedByMovement
OwnedByGesture
OwnedByDodge
Released
Canceled
```

## 전이

```text
Unowned
 ├─ UI Hit → OwnedByUI
 ├─ Left Region → OwnedByMovement
 ├─ Right Region → OwnedByGesture
 └─ Dodge Button → OwnedByDodge
```

종료:

```text
Owned → PointerUp → Released → Registry Remove
Owned → PointerCancel → Canceled → Registry Remove
Owned → ContextChange → Canceled → Registry Remove
Owned → FocusLost → Canceled → Registry Remove
```

## 금지 전이

- OwnedByMovement → OwnedByGesture
- OwnedByGesture → OwnedByMovement
- OwnedByUI → Gameplay Owner
- Owner 없는 Move/Up 이벤트 처리

---

# 7. Input Context 상태 머신

## 상태

```text
GameplayField
GameplayDuel
Tutorial
Menu
Pause
Dialogue
Cutscene
Result
Debug
```

## 주요 전이

```text
GameplayField → Pause
GameplayDuel → Pause
Pause → 이전 Gameplay Context
GameplayField → GameplayDuel
GameplayDuel → Result
Any → Cutscene
Cutscene → 지정 복귀 Context
Any → Debug
```

## 전환 규칙

Context 전환 시:

1. active_context 변경 전 `BeforeContextChange` 발행
2. 현재 Gesture Cancel
3. Pointer Owner 정책 적용
4. 이동 벡터 초기화 여부 결정
5. command buffer 유지/폐기 정책 적용
6. 새 Context 설정
7. `OnInputContextChanged` 발행

기본 정책:

- Gameplay ↔ Gameplay: 이동 입력 유지 가능, Gesture는 취소
- Gameplay → Menu/Pause/Cutscene: 전체 취소
- Menu/Pause → Gameplay: 새 입력만 허용
- Any → Result: 전체 취소

---

# 8. 이동 입력 알고리즘

## 8.1 PC 이동

```text
x = right - left
y = forward - backward
vector = normalize_if_length_gt_1(x, y)
```

## 8.2 터치 이동

```text
delta = current_touch - joystick_origin
distance = length(delta)
direction = normalize(delta)

if distance < dead_zone:
    output = (0, 0)
else:
    normalized_magnitude =
        clamp((distance - dead_zone) / (full_input_radius - dead_zone), 0, 1)

output = direction * normalized_magnitude
```

## 8.3 입력 결합 규칙

MVP 기본:

- 가장 최근 활성 장치의 이동 입력을 사용
- 키보드와 터치 이동을 동시에 합산하지 않음
- 장치가 바뀌면 OnInputDeviceChanged 발행

---

# 9. 제스처 세션 알고리즘

## 9.1 시작

의사코드:

```text
function TryStartGesture(rawEvent):
    if context does not allow gesture:
        return rejected

    if rawEvent.is_over_ui:
        return rejected

    if activeGesture exists:
        return rejected

    if not IsGestureStartRegion(rawEvent.position):
        return rejected

    ownerRegistry.Assign(rawEvent.pointer_id, Gesture)

    activeGesture = new GestureSession
    activeGesture.status = Collecting
    activeGesture.points.Add(rawEvent.point)

    Publish(OnGestureStarted)
```

## 9.2 갱신

```text
function UpdateGesture(rawEvent):
    if ownerRegistry.Get(rawEvent.pointer_id) != Gesture:
        return

    if activeGesture is null:
        log ownership mismatch
        return

    if timestamp exceeds max duration:
        CancelGesture(MaxDurationExceeded)
        return

    activeGesture.points.Add(rawEvent.point)
    Publish(OnGestureUpdated)
```

## 9.3 종료

```text
function EndGesture(rawEvent):
    if owner != Gesture:
        return

    if point count < minimum:
        CancelGesture(TooFewPoints)
        return

    activeGesture.status = PendingRecognition
    SendToGestureRecognizer(activeGesture)
    ownerRegistry.Release(pointer_id)
    Publish(OnGestureEnded)
```

## 9.4 Cancel

```text
function CancelGesture(reason):
    if activeGesture is null:
        return

    activeGesture.status = Canceled
    activeGesture.cancel_reason = reason
    activeGesture.points.ClearOrReturnToPool()
    activeGesture = null

    Publish(OnGestureCanceled(reason))
```

---

# 10. Command Buffer 알고리즘

## 10.1 추가

```text
function Enqueue(command):
    remove expired commands

    if duplicate sequence_id exists:
        reject duplicate

    if buffer is full:
        remove lowest-priority oldest command

    add command
```

## 10.2 소비

```text
function TryConsume(canExecute):
    remove expired commands

    candidates = pending commands
        sorted by priority desc, created_at asc

    for command in candidates:
        result = canExecute(command)

        if result == Executable:
            mark Consumed
            remove
            return command

        if result == TemporaryBlocked:
            continue

        if result == PermanentRejected:
            mark Rejected
            remove

    return none
```

## 10.3 만료

```text
if current_time >= expires_at:
    state = Expired
    remove
    Publish(BufferExpired)
```

---

# 11. 입력 우선순위 상수

```text
System = 100
UI = 90
Cancel = 80
Dodge = 70
Gesture = 60
Movement = 50
Debug = 10
```

이 값은 데이터화하되, 런타임 중 임의 변경하지 않는다.

---

# 12. CancelAllInput 명세

```text
function CancelAllInput(reason):
    Publish(BeforeInputCancel)

    movementProcessor.Reset()
    gestureCollector.Cancel(reason)
    commandBuffer.CancelAll(reason)
    ownershipRegistry.ReleaseAll()
    deviceAdapters.ClearHeldState()

    runtimeState.movement_vector = (0,0)
    runtimeState.active_gesture = null

    Publish(AfterInputCancel)
```

필수 호출 지점:

- FocusLost
- Pause Enter
- Cutscene Enter
- Scene Unload
- Application Suspend
- Fatal Input Error

---

# 13. 이벤트 발행 순서

동일 프레임에 여러 이벤트가 발생하면 다음 순서를 지킨다.

```text
1. Context Change
2. Cancel
3. Pointer Release
4. Gesture End
5. Dodge Request
6. Move Changed
7. Device Changed
8. Debug Snapshot
```

이 순서는 테스트 가능한 결정론을 위해 유지한다.

---

# 14. 파일 책임 예시

엔진 독립형 이름 기준:

```text
InputManager.*
InputRouter.*
InputContextController.*
PointerOwnershipRegistry.*
InputCommandBuffer.*
KeyboardMouseAdapter.*
TouchAdapter.*
MovementInputProcessor.*
VirtualJoystickProcessor.*
GestureInputCollector.*
DodgeInputProcessor.*
InputEvents.*
InputTypes.*
InputConfig.*
InputDebugSnapshot.*
```

한 파일에 여러 핵심 책임을 합치지 않는다.

---

# 15. 구성 데이터

## InputConfig 예시

```json
{
  "version": 1,
  "regions": {
    "movement_end_x": 0.40,
    "buffer_start_x": 0.40,
    "buffer_end_x": 0.50,
    "gesture_start_x": 0.50
  },
  "movement": {
    "dead_zone": 0.15,
    "full_input_radius": 0.90
  },
  "gesture": {
    "min_points": 12,
    "max_duration_ms": 1200
  },
  "buffer_ms": {
    "skill": 120,
    "dodge": 100,
    "parry": 80
  },
  "limits": {
    "max_simultaneous_pointers": 5,
    "command_buffer_capacity": 16
  }
}
```

Config 유효성 검사 실패 시 안전 기본값을 사용하고 오류 로그를 남긴다.

---

# 16. 오류 코드

```text
INPUT-001 PointerOwnerConflict
INPUT-002 UnknownPointerMove
INPUT-003 UnknownPointerRelease
INPUT-004 GestureAlreadyActive
INPUT-005 InvalidContextTransition
INPUT-006 DuplicateSequence
INPUT-007 CommandBufferOverflow
INPUT-008 DeviceStateMismatch
INPUT-009 InvalidConfig
INPUT-010 CancelRecoveryFailed
```

오류 코드는 로그와 테스트 보고서에서 동일하게 사용한다.

---

# 17. 예외 처리 정책

## 복구 가능한 오류

- 중복 이벤트
- 알 수 없는 Pointer Move
- 버퍼 초과
- 유효하지 않은 Config 일부

처리:

- 안전하게 무시 또는 기본값 사용
- 오류 로그
- 게임 진행 유지

## 복구 불가능한 오류

- InputManager 초기화 실패
- 필수 Device Adapter 생성 실패
- ContextController 부재

처리:

- 입력 비활성화
- 명확한 개발 오류 표시
- Shipping에서는 안전 메뉴 또는 재시작 유도

---

# 18. Thread 및 결정론

MVP에서는 모든 Input 상태 변경을 메인 게임 스레드에서 수행한다.

허용:

- 원시 이벤트 수집 큐는 플랫폼 콜백 스레드에서 기록 가능
- 실제 라우팅과 상태 변경은 메인 스레드

필수:

- 이벤트 순서 보존
- sequence_id 단조 증가
- timestamp는 monotonic clock 사용
- 동일 입력 리플레이 시 동일 Command 순서 생성

---

# 19. 메모리 정책

- Gesture Point Buffer는 풀링
- Raw Event Queue는 재사용 가능한 링 버퍼 권장
- Command Buffer 최대 용량 고정
- 매 프레임 LINQ/동적 컬렉션 생성 금지
- Debug Snapshot은 개발 모드에서만 상세 데이터 생성

---

# 20. 보안 및 안정성

- 비정상적으로 많은 입력 이벤트에 상한 적용
- 포인터 이벤트 폭주 시 프레임당 처리량 제한
- 외부 매크로 탐지는 MVP 범위 밖
- 입력 데이터에는 개인정보 저장 금지
- Telemetry 전송 시 좌표 원본은 기본적으로 로컬 보관

---

# 21. 테스트 가능성 설계

모든 시간 의존 로직은 `IClock` 또는 동등한 추상화를 사용한다.

모든 Device Adapter는 테스트용 가짜 입력 공급자를 지원한다.

필수 Test Double:

```text
FakeClock
FakeKeyboardMouseAdapter
FakeTouchAdapter
FakeUIInputGate
FakeInputEventListener
```

리플레이 테스트는 Raw Event 시퀀스를 입력하고 발생한 Game Command를 비교한다.

---

# 22. Acceptance 연결 기준

Input System Acceptance Test에서 최소 검증:

- WASD 이동
- 터치 가상 스틱
- 이동 중 제스처
- 제스처 중 이동
- 회피와 이동 동시 입력
- UI 위 터치 차단
- Context 전환
- 포커스 손실 복구
- Pointer Owner 충돌
- 버퍼 만료
- 30/60/120FPS 결정론
- 장시간 입력 후 메모리 안정성

---

# 23. Definition of Done

다음 조건을 모두 만족해야 Input System Spec 구현 완료로 인정한다.

- 모듈 책임 분리 완료
- 모든 핵심 이벤트 구현
- Pointer Ownership 구현
- Context 전환 구현
- Command Buffer 구현
- CancelAllInput 구현
- Unit Test 통과
- Integration Test 통과
- Acceptance Test 통과
- 오류 코드 로그 검증
- 디버그 Snapshot 제공
- Stage 1 통합 문서 갱신

---

# 24. Cross References

- Input System Bible
- Gesture Recognition Bible
- Gesture Algorithm Spec
- Gesture Acceptance Test Spec
- Game Data Architecture Bible
- Stage 1 Development Package
- Master Design Bible

---

# 25. Open Questions

1. 엔진이 Unity인지 Unreal인지에 따라 파일/클래스 매핑을 별도 작성할 것인가?
2. PC 제스처 버튼을 사용자 설정 가능하게 할 것인가?
3. 이동과 제스처를 모두 마우스로 처리하는 접근성 모드를 둘 것인가?
4. 터치 전용 기기에서 손가락이 UI를 가리는 문제를 어떻게 완화할 것인가?
5. 게임패드 지원을 Vertical Slice 전에 포함할 것인가?
6. Input Replay를 개발 초기부터 필수로 넣을 것인가?

---

# 다음 문서

## Input System Acceptance Test Spec

다음 항목을 객관적 PASS/FAIL 기준으로 정의한다.

- 동시 입력
- 입력 손실
- Context 전환
- Cancel 복구
- 포커스 손실
- Pointer Ownership
- Command Buffer
- 기기/FPS별 결정론
- 성능 및 메모리
