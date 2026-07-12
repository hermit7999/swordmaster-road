# SwordMaster GDD v3.5

# Remaining Development Roadmap

> 목적
>
> 현재까지 설계를 기준으로 앞으로 반드시 작성해야 할 문서를 정리한다. 더
> 이상 문서를 무한히 늘리지 않고, 실제 개발에 필요한 문서만 관리한다.

------------------------------------------------------------------------

# 현재 진행률

  구분                    상태
  ----------------------- ------------
  게임 방향               ✅ 완료
  Core Loop               ✅ 완료
  성장 시스템             ✅ 완료
  상용화 방향             ✅ 완료
  데이터 구조             ✅ 완료
  Gesture 설계            ✅ 완료
  Input 설계              🔨 진행 중
  Combat 구현 명세        ⏳ 대기
  Boss 구현 명세          ⏳ 대기
  Progression 구현 명세   ⏳ 대기
  UI/Save                 ⏳ 대기

------------------------------------------------------------------------

# 남은 핵심 문서

## Stage 1 : Input Foundation (3개)

### 1. Input System Acceptance Test Spec

-   입력 씹힘
-   동시 입력
-   Context 전환
-   Pointer Ownership
-   FPS별 테스트

### 2. AI Task Spec - Input System

-   Task 분해
-   구현 순서
-   완료 조건

### 3. Stage 1 Final Integration

-   Gesture
-   Input
-   Integration
-   Acceptance
-   Vertical Slice 0.1

------------------------------------------------------------------------

## Stage 2 : Combat Foundation (5개)

1.  Skill Execution Package
2.  Hit Detection Package
3.  Enemy State Machine Package
4.  Hit Reaction & Stagger Package
5.  Combat Timing Package

목표

"적을 베는 것이 재미있는가?"

------------------------------------------------------------------------

## Stage 3 : Duel Mode (4개)

1.  Duel System Package
2.  Boss Pattern Package
3.  Boss State Machine Package
4.  Duel Acceptance Test

목표

"보스를 다시 도전하고 싶은가?"

------------------------------------------------------------------------

## Stage 4 : Progression (4개)

1.  Run Progression
2.  Permanent Progression
3.  Equipment & Modifier
4.  Reward Selection

------------------------------------------------------------------------

## Stage 5 : Game Flow (4개)

1.  Stage Flow
2.  Save / Load
3.  HUD / UI
4.  Tutorial Flow

------------------------------------------------------------------------

## Stage 6 : Polish (4개)

1.  Camera
2.  Audio / FX
3.  Balance Data
4.  Release Checklist

------------------------------------------------------------------------

# 최종 문서 수 목표

이미 작성된 문서 : 약 20개

추가 작성 예정 : 약 20개

최종 목표 : 40\~45개

이 이상은 문서를 늘리지 않고, 기존 문서를 개선한다.

------------------------------------------------------------------------

# 앞으로의 원칙

새 문서는 아래 조건을 모두 만족해야 한다.

-   구현자가 바로 개발할 수 있는가?
-   AI가 그대로 구현 가능한가?
-   테스트 기준이 있는가?
-   기존 문서와 중복되지 않는가?

YES가 아니면 새 문서를 만들지 않는다.

------------------------------------------------------------------------

# 다음 작업 순서

1.  Input System Acceptance Test Spec
2.  AI Task Spec - Input System
3.  Stage 1 Final Integration
4.  Combat Foundation 시작

이 순서대로 진행하면 Stage 1을 종료하고 실제 전투 구현 단계로 넘어갈 수
있다.
