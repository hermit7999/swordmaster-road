# SwordMaster GDD v3.0

# AI Task Spec - Gesture Recognition

> 목적
>
> 이 문서는 AI(Codex, Claude, GPT)가 동일한 방식으로 구현 작업을
> 수행하도록 작업 단위를 정의한다.
>
> 각 Task는 독립적으로 구현, 테스트, 리뷰가 가능해야 한다.

------------------------------------------------------------------------

# 구현 원칙

-   한 Task는 300\~800줄 규모를 넘지 않는다.
-   하나의 책임만 가진다.
-   Acceptance Test가 존재해야 한다.
-   다음 Task에 영향을 최소화한다.

------------------------------------------------------------------------

# 작업 순서

## TASK-001 : Point Buffer

목표 - 터치 좌표 저장 - timestamp 저장 - 멀티터치 ID 저장

입력 - TouchDown - TouchMove - TouchUp

완료 조건 - Point Buffer Acceptance Test PASS

의존성 - 없음

------------------------------------------------------------------------

## TASK-002 : Coordinate Normalize

목표 - 화면 크기와 DPI를 제거 - 0\~1 좌표계 변환

입력 - Point Buffer

출력 - Normalize Buffer

완료 조건 - Normalize Test PASS

------------------------------------------------------------------------

## TASK-003 : Noise Filter

목표 - 손떨림 제거 - 중복 좌표 제거

출력 - Clean Buffer

완료 조건 - Noise Test PASS

------------------------------------------------------------------------

## TASK-004 : Resample

목표 - 모든 입력을 동일한 Point 수로 변환

기본값 - 64 Points

완료 조건 - Resample Test PASS

------------------------------------------------------------------------

## TASK-005 : Direction Builder

목표 - 방향 벡터 생성 - Corner 계산

출력 - Gesture Vector

완료 조건 - Direction Test PASS

------------------------------------------------------------------------

## TASK-006 : Pattern Matching

목표 - 등록된 Gesture와 비교 - 후보 생성

출력 - Candidate List

완료 조건 - Matching Accuracy PASS

------------------------------------------------------------------------

## TASK-007 : Score Engine

목표 - Direction - Shape - Length - Speed - Corner

점수 계산

출력 - Final Score

완료 조건 - Acceptance 기준 충족

------------------------------------------------------------------------

## TASK-008 : Skill Resolver

목표 - 최고 점수 선택 - 동점 해결 - 최종 Skill 반환

완료 조건 - Resolver Test PASS

------------------------------------------------------------------------

## TASK-009 : Debug Overlay

표시 - Raw Path - Normalized Path - Direction - Score - Failure Reason

완료 조건 - Overlay Test PASS

------------------------------------------------------------------------

## TASK-010 : Integration

목표 - Gesture → Skill 실행

완료 조건 - Gesture Acceptance Test 전체 PASS

------------------------------------------------------------------------

# AI 구현 규칙

AI는 반드시 아래 순서를 따른다.

1.  Spec 확인
2.  Schema 확인
3.  Task 구현
4.  Unit Test 작성
5.  Acceptance Test 실행
6.  Self Review
7.  다음 Task 진행

Task를 건너뛰지 않는다.

------------------------------------------------------------------------

# 산출물

각 Task는 아래 파일을 생성한다.

-   Source
-   Unit Test
-   Test Report
-   Review Report
-   변경 로그

------------------------------------------------------------------------

# Definition of Done

□ 코드 완료 □ Unit Test PASS □ Acceptance PASS □ 성능 기준 충족 □ 리뷰
완료

모두 만족해야 DONE으로 인정한다.

------------------------------------------------------------------------

# Cross References

-   Gesture Algorithm Spec
-   Gesture Recognition Bible
-   Gesture Acceptance Test Spec
-   Development Priority Matrix

------------------------------------------------------------------------

# 다음 문서

Input System Bible

-   왼손 이동
-   오른손 제스처
-   멀티터치
-   입력 버퍼
-   입력 우선순위
-   Cancel 규칙
