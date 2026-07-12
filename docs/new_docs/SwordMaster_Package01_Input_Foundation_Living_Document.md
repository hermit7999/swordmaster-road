
# SwordMaster GDD - Package 01
# Input Foundation Development Package (Living Document)

Version: v1.0 (Integrated)

> 이 문서는 지금까지 작성된 다음 문서를 하나로 통합한 Living Document이다.
>
> - Input Foundation
> - Gesture Recognition Bible
> - Gesture Algorithm Spec
> - Gesture Acceptance Test
> - AI Task Spec (Gesture)
> - Integration Guide (Gesture)
> - Input System Bible
> - Input System Spec
> - (예정) Input Acceptance Test
> - (예정) AI Task Spec - Input
> - (예정) Stage 1 Final Integration

============================================================
1. 목적
============================================================

Stage 1(Input Foundation)의 목표는

- 왼손으로 자연스럽게 이동하고
- 오른손으로 검술 제스처를 입력하며
- 원하는 검술이 안정적으로 발동되는 것

이다.

이 단계가 완료되면 Vertical Slice 0.1의 입력과 기본 전투가 가능해야 한다.

============================================================
2. 개발 범위
============================================================

포함

- Input System
- Gesture Recognition
- Gesture Algorithm
- Skill Trigger
- Input Buffer
- Pointer Ownership
- Context System
- Debug Overlay

제외

- 적 AI
- 데미지 계산
- 보스
- 성장
- 저장 시스템

============================================================
3. 핵심 원칙 (Bible)
============================================================

- 이동과 검술은 동시에 가능해야 한다.
- 입력은 플레이어에게 관대해야 한다.
- 결과는 명확해야 한다.
- 억울한 실패가 없어야 한다.
- 동일 입력은 항상 동일 결과를 만든다.
- 입력 시스템은 장치에 독립적이어야 한다.
- 게임 로직은 키보드/터치 차이를 알 필요가 없다.

============================================================
4. 시스템 구조
============================================================

Raw Device
 ↓
Device Adapter
 ↓
Input Router
 ↓
Context
 ↓
Movement / Gesture / Dodge
 ↓
Command Buffer
 ↓
Combat Trigger

============================================================
5. Gesture Recognition
============================================================

구현 단계

1. Point Buffer
2. Normalize
3. Noise Filter
4. Resample
5. Corner Detection
6. Direction Vector
7. Pattern Matching
8. Score
9. Skill Resolve

판정 기준

- Direction 50%
- Shape 20%
- Length 10%
- Speed 10%
- Corner 10%

성공

85점 이상

============================================================
6. Input System
============================================================

구성

- Input Manager
- Device Adapter
- Input Router
- Context Controller
- Pointer Ownership
- Movement Processor
- Gesture Collector
- Dodge Processor
- Command Buffer

Context

- Gameplay
- Duel
- Tutorial
- Menu
- Pause
- Dialogue
- Result

============================================================
7. 데이터 구조
============================================================

주요 Runtime

- MoveCommand
- GestureSession
- BufferedCommand
- InputContext
- PointerOwner

============================================================
8. 상태 머신
============================================================

Gesture

Idle
→ Collecting
→ Pending Recognition
→ Completed

또는

Canceled

Pointer

Unowned
→ Movement
→ Gesture
→ UI
→ Released

============================================================
9. AI 구현 Task
============================================================

Task-01 Point Buffer

Task-02 Normalize

Task-03 Noise Filter

Task-04 Resample

Task-05 Direction Builder

Task-06 Pattern Matching

Task-07 Score Engine

Task-08 Skill Resolve

Task-09 Debug Overlay

Task-10 Integration

============================================================
10. Acceptance Test
============================================================

필수

□ 이동 중 제스처 가능

□ 제스처 중 이동 유지

□ 입력 씹힘 없음

□ FPS 30/60/120 동일

□ 해상도 독립

□ 오인식률 3% 이하

□ 성공률 95% 이상

□ 포커스 손실 복구

□ 멀티터치 정상

============================================================
11. Integration
============================================================

연결 대상

- Combat
- Skill
- Enemy
- UI
- Save
- Tutorial

Gesture는 Skill을 호출하고

Skill은 Combat를 호출한다.

============================================================
12. Debug
============================================================

표시

- Gesture Path
- Direction
- Score
- Owner
- Buffer
- Context

============================================================
13. Definition of Done
============================================================

□ Bible 완료

□ Spec 완료

□ Data 정의

□ State Machine 완료

□ AI Task 완료

□ Acceptance 완료

□ Integration 완료

□ Review 완료

□ Stage 1 통합 완료

============================================================
14. Open Issues
============================================================

남은 작업

1. Input Acceptance Test (통합)
2. AI Task - Input (통합)
3. Stage1 Final Review

완료 후

Package 01은 종료된다.

============================================================
15. 후속 패키지
============================================================

Package 02 Skill Execution

Package 03 Combat Foundation

Package 04 Enemy Foundation

...

Package 16 Final Release

============================================================
16. Living Document 정책
============================================================

앞으로는 새로운 v3.x 문서를 만들지 않는다.

이 문서만 계속 업데이트한다.

추가되는 내용은

- 기존 섹션에 병합
- 버전 증가
- 변경 이력 기록

항상 최신 버전의 이 문서만 참조한다.
