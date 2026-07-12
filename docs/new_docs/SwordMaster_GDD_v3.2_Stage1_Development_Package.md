# SwordMaster GDD v3.2

# Stage 1 Development Package

> 목적
>
> Stage 1(Input Foundation)을 하나의 실행 가능한 개발 패키지로 정의한다.
> AI는 이 패키지를 순서대로 구현하고, 모든 Acceptance Test를 통과해야
> 다음 Stage로 진행한다.

------------------------------------------------------------------------

# Stage 1 목표

플레이어가

-   왼손으로 자연스럽게 이동하고
-   오른손으로 검을 그어
-   원하는 검술이 안정적으로 발동되는 것

여기까지가 Stage 1의 완료 기준이다.

------------------------------------------------------------------------

# 포함 기능

1.  Input System
2.  Gesture Recognition
3.  Gesture Algorithm
4.  Skill Resolver
5.  Combat Trigger
6.  Debug Overlay

------------------------------------------------------------------------

# 구현 순서

STEP 1 Point Buffer

↓

STEP 2 Normalize

↓

STEP 3 Gesture Recognition

↓

STEP 4 Skill Resolve

↓

STEP 5 Combat Trigger

↓

STEP 6 Debug Overlay

↓

STEP 7 Acceptance Test

------------------------------------------------------------------------

# 산출물

각 Step은 아래 결과물을 반드시 생성한다.

-   Source Code
-   Unit Test
-   Integration Test
-   Review Report
-   변경 로그

------------------------------------------------------------------------

# Stage Acceptance

아래 조건을 모두 만족해야 Stage 1 완료.

-   Gesture 성공률 95% 이상
-   오인식률 3% 이하
-   멀티터치 정상
-   60FPS 유지
-   Acceptance Test PASS
-   플레이 테스트 PASS

------------------------------------------------------------------------

# AI 실행 규칙

AI는 다음 순서를 절대 변경하지 않는다.

1.  Spec 확인
2.  기존 코드 분석
3.  구현
4.  Unit Test
5.  Acceptance Test
6.  Self Review
7.  Commit 후보 생성

테스트 실패 시 다음 Step 진행 금지.

------------------------------------------------------------------------

# 종료 기준

Stage 1 종료 후 가능한 플레이

-   이동 가능
-   제스처 가능
-   검술 발동
-   적 1종 처치
-   기본 손맛 검증

이 시점이 Vertical Slice 0.1이다.

------------------------------------------------------------------------

# Risk Checklist

□ 입력 지연 □ 오인식 □ 멀티터치 충돌 □ 프레임 저하 □ 기기별 차이

모든 위험은 Stage 1에서 해결한다.

------------------------------------------------------------------------

# Cross References

-   Development Priority Matrix
-   Game Data Architecture Bible
-   Gesture Recognition Bible
-   Gesture Algorithm Spec
-   AI Task Spec
-   Integration Guide

------------------------------------------------------------------------

# 다음 단계

## Stage 2 Development Package

범위

-   Enemy State Machine
-   Hit Detection
-   Hit Feel
-   Camera Reaction
-   Basic Combat Loop

목표

'적을 베는 것이 재미있는가?'를 최초로 검증하는 플레이 가능한 빌드를
만든다.
