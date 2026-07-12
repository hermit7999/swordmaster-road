# SwordMaster GDD v3.1

# Integration Guide - Gesture Recognition

> 목적
>
> Gesture Recognition 기능을 기존 시스템과 안전하게 연결하기 위한 통합
> 명세. 구현 완료보다 **시스템 간 연결의 안정성**을 우선한다.

------------------------------------------------------------------------

# 1. 연결 대상

Gesture Engine │ ├─ Input System ├─ Skill System ├─ Combat System ├─
Enemy System ├─ Boss System ├─ UI/HUD ├─ Tutorial ├─ Replay ├─ Save
System └─ Telemetry

모든 연결은 인터페이스(API)를 통해 수행한다.

------------------------------------------------------------------------

# 2. 이벤트 흐름

Touch Down ↓

Input System

↓

Gesture Engine

↓

Skill Resolver

↓

Combat System

↓

Enemy Reaction

↓

Reward System

↓

Telemetry

------------------------------------------------------------------------

# 3. 인터페이스 규칙

Gesture Engine은 다음 정보만 반환한다.

-   gesture_id
-   confidence
-   score
-   elapsed_time
-   debug_info (개발모드)

Combat는 내부 알고리즘을 알 필요가 없다.

------------------------------------------------------------------------

# 4. 실패 처리

Gesture 실패 시

-   스킬 실행 금지
-   입력 로그 저장
-   HUD 피드백
-   게임 중단 금지

------------------------------------------------------------------------

# 5. Save 규칙

저장 대상

-   튜토리얼 완료 여부
-   입력 보정 옵션

저장 금지

-   최근 입력 버퍼
-   디버그 데이터

------------------------------------------------------------------------

# 6. Tutorial 연결

튜토리얼은 Gesture Engine의 실제 판정을 사용한다.

별도 튜토리얼 전용 판정을 만들지 않는다.

------------------------------------------------------------------------

# 7. Telemetry

수집 항목

-   성공률
-   실패율
-   평균 입력 시간
-   가장 많이 실패한 제스처
-   난이도별 성공률

이 데이터는 밸런스 조정에 활용한다.

------------------------------------------------------------------------

# 8. Integration Test

□ 입력→스킬 연결

□ 스킬→전투 연결

□ 전투→적 반응 연결

□ HUD 피드백

□ 저장/불러오기

□ 튜토리얼

모든 항목 PASS 후 통합 완료.

------------------------------------------------------------------------

# 9. Review Checklist

-   하드코딩된 참조가 없는가?
-   인터페이스가 최소한인가?
-   성능 저하가 없는가?
-   예외 처리가 충분한가?
-   Acceptance Test를 모두 통과했는가?

------------------------------------------------------------------------

# Cross References

-   Gesture Recognition Bible
-   Gesture Algorithm Spec
-   Gesture Acceptance Test Spec
-   AI Task Spec
-   Game Data Architecture Bible

------------------------------------------------------------------------

# 다음 문서

Review Checklist Framework

모든 기능이 동일한 리뷰 절차를 따르도록 공통 리뷰 규칙을 정의한다.
