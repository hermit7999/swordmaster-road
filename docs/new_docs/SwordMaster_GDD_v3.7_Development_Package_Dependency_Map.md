
# SwordMaster GDD v3.7
# Development Package Dependency Map

> 목적
>
> 이 문서는 16개 통합 개발 패키지의 의존관계와 진행 순서를 정의한다.
> 설계 문서 작성 순서와 이후 Sprint 구현 순서는 이 문서를 기준으로 한다.

---

# 1. 최상위 진행 원칙

패키지는 번호 순서대로만 진행하지 않는다.

각 패키지는 다음 세 조건으로 구분한다.

- `선행 필수`: 이전 패키지가 완료되어야 시작 가능
- `부분 병렬`: 일부 영역은 동시에 작성 가능
- `후행 통합`: 여러 패키지가 완료된 뒤 최종 통합

---

# 2. 전체 의존성 구조

```text
Package 01 - Input Foundation
            ↓
Package 02 - Skill Execution
            ↓
Package 03 - Combat Foundation
        ↙           ↘
Package 04           Package 05
Enemy Foundation     Duel Foundation
        ↘           ↙
      Package 06 - Boss Content
             ↓
      Package 07 - Progression
             ↓
Package 08 - Equipment & Reward
             ↓
      Package 09 - Stage Flow
       ↙         ↓         ↘
Package 10   Package 11   Package 12
UI/Tutorial  Save/Data    Presentation
       ↘         ↓         ↙
        Package 13 - Balance
                 ↓
        Package 14 - QA & Release
                 ↓
        Package 15 - Live Operation
                 ↓
        Package 16 - Final Release Review
```

---

# 3. 패키지별 의존성

## Package 01 — Input Foundation

### 선행 패키지
- 없음

### 완료 후 해금
- Package 02 Skill Execution

### 핵심 산출물
- 입력 시스템
- 제스처 인식
- 입력 Acceptance
- AI Task
- Stage 1 Integration

### 시작 조건
- 플랫폼 우선순위 확정
- PC/터치 지원 범위 확정

---

## Package 02 — Skill Execution

### 선행 패키지
- Package 01

### 완료 후 해금
- Package 03 Combat Foundation

### 핵심 산출물
- 검술 8개 확정
- Skill State Machine
- Skill Data Schema
- 캔슬/연계 규칙
- Skill Acceptance

### 병렬 가능
- 검술 연출 콘셉트
- Skill JSON 초안

---

## Package 03 — Combat Foundation

### 선행 패키지
- Package 02

### 완료 후 해금
- Package 04 Enemy Foundation
- Package 05 Duel Foundation

### 핵심 산출물
- Hit Detection
- Damage Formula
- Stamina
- Hit Reaction
- Stagger/Groggy
- Combo/Cancel
- Combat Acceptance

### 주의
Enemy와 Duel은 Combat Foundation의 공통 규칙을 재사용한다.

---

## Package 04 — Enemy Foundation

### 선행 패키지
- Package 03

### 완료 후 해금
- Package 06 Boss Content
- Package 09 Stage Flow

### 핵심 산출물
- Enemy State Machine
- 적 역할 10~12종
- 공격 선택 규칙
- 다수 적 협동 규칙
- Enemy Data Schema
- Enemy Acceptance

### 병렬 가능
- Package 05와 병렬 진행 가능

---

## Package 05 — Duel Foundation

### 선행 패키지
- Package 03

### 완료 후 해금
- Package 06 Boss Content

### 핵심 산출물
- Duel State Machine
- 패링
- 자세 게이지
- 거리 조절
- Duel Camera 규칙
- Duel Acceptance

### 병렬 가능
- Package 04와 병렬 진행 가능

---

## Package 06 — Boss Content

### 선행 패키지
- Package 04
- Package 05

### 완료 후 해금
- Package 07 Progression
- Package 09 Stage Flow

### 핵심 산출물
- 메인 보스 5명
- 미니보스 5명
- Pattern Table
- Phase Rule
- Boss Reward
- Boss Acceptance

---

## Package 07 — Progression

### 선행 패키지
- Package 06

### 완료 후 해금
- Package 08 Equipment & Reward
- Package 11 Save & Data

### 핵심 산출물
- Run Progression
- Permanent Progression
- 승급
- 검파
- 스킬 해금
- 실패 후 유지 규칙

### 주의
보스 보상 구조가 확정되어야 Progression을 닫을 수 있다.

---

## Package 08 — Equipment & Reward

### 선행 패키지
- Package 07

### 완료 후 해금
- Package 09 Stage Flow
- Package 10 UI & Tutorial
- Package 13 Balance

### 핵심 산출물
- 장비 슬롯
- Modifier
- 드랍
- 강화
- Reward Selection
- Economy Table

---

## Package 09 — Stage Flow

### 선행 패키지
- Package 04
- Package 06
- Package 08

### 완료 후 해금
- Package 10 UI & Tutorial
- Package 12 Presentation
- Package 13 Balance

### 핵심 산출물
- 스테이지 5개
- Spawn/Wave
- 정예 배치
- 보스 진입
- 실패/재시작
- Stage Acceptance

---

## Package 10 — UI & Tutorial

### 선행 패키지
- Package 08
- Package 09

### 완료 후 해금
- Package 13 Balance
- Package 14 QA & Release

### 핵심 산출물
- HUD
- 성장 선택 화면
- 장비 화면
- 메뉴
- 결과 화면
- 튜토리얼 플로우
- 접근성 UI

### 병렬 가능
- Package 11, 12와 병렬 진행 가능

---

## Package 11 — Save & Data

### 선행 패키지
- Package 07
- Package 08

### 완료 후 해금
- Package 14 QA & Release

### 핵심 산출물
- Save/Load
- Version
- Migration
- Settings
- Cloud Save
- Recovery

### 병렬 가능
- Package 10, 12와 병렬 진행 가능

---

## Package 12 — Presentation

### 선행 패키지
- Package 03
- Package 05
- Package 09

### 완료 후 해금
- Package 13 Balance
- Package 14 QA & Release

### 핵심 산출물
- Camera
- Animation
- FX
- Audio
- Event Profile

### 병렬 가능
- Package 10, 11과 병렬 진행 가능

---

## Package 13 — Balance

### 선행 패키지
- Package 08
- Package 09
- Package 10
- Package 12

### 완료 후 해금
- Package 14 QA & Release

### 핵심 산출물
- 기본 수치
- 피해 공식
- 성장 곡선
- 난이도 보정
- 보상 곡선
- 플레이 시간별 목표 수치

---

## Package 14 — QA & Release

### 선행 패키지
- Package 10
- Package 11
- Package 12
- Package 13

### 완료 후 해금
- Package 15 Live Operation
- Package 16 Final Release Review

### 핵심 산출물
- Debug Tool
- Replay
- Regression Test
- Telemetry
- Build Matrix
- Steam 연동
- Release Checklist 초안

---

## Package 15 — Live Operation

### 선행 패키지
- Package 14

### 완료 후 해금
- Package 16 Final Release Review

### 핵심 산출물
- 패치 정책
- 데이터 수정 정책
- 밸런스 업데이트
- 로그 분석
- DLC/업데이트 호환
- Save Migration 운영 절차

---

## Package 16 — Final Release Review

### 선행 패키지
- Package 14
- Package 15

### 완료 조건
- 전체 설계 Freeze
- 전체 Acceptance 정의
- 미설계 항목 0
- 충돌 문서 0
- Open Question 정리 완료
- Sprint 구현 착수 가능

### 최종 산출물
- Release Gate Checklist
- 설계 Freeze 선언
- Sprint Backlog 생성 기준
- 우선순위 확정
- 리스크 등록부

---

# 4. 문서 작성 권장 순서

## Phase A — 핵심 조작과 전투

1. Package 01 Input Foundation
2. Package 02 Skill Execution
3. Package 03 Combat Foundation

## Phase B — 적과 보스

4. Package 04 Enemy Foundation
5. Package 05 Duel Foundation
6. Package 06 Boss Content

## Phase C — 성장과 게임 흐름

7. Package 07 Progression
8. Package 08 Equipment & Reward
9. Package 09 Stage Flow

## Phase D — 플레이 경험과 저장

10. Package 10 UI & Tutorial
11. Package 11 Save & Data
12. Package 12 Presentation

## Phase E — 마감

13. Package 13 Balance
14. Package 14 QA & Release
15. Package 15 Live Operation
16. Package 16 Final Release Review

---

# 5. 병렬 진행 가능 구간

다음 구간은 문서 작성 시 병렬 진행 가능하다.

## 병렬 그룹 1

- Package 04 Enemy Foundation
- Package 05 Duel Foundation

조건:
- Package 03 Combat Foundation 완료

## 병렬 그룹 2

- Package 10 UI & Tutorial
- Package 11 Save & Data
- Package 12 Presentation

조건:
- 각 선행 패키지 완료
- 공통 데이터 Schema Freeze

---

# 6. 설계 Freeze Gate

각 Phase 종료 시 다음을 확인한다.

## Gate A — Combat Core Freeze

대상:
- Package 01~03

통과 조건:
- 입력
- 제스처
- 스킬 실행
- 기본 전투

모두 Acceptance 정의 완료

## Gate B — Content Core Freeze

대상:
- Package 04~06

통과 조건:
- 적
- Duel
- 보스

모두 상태 머신과 데이터 Schema 완료

## Gate C — Game Loop Freeze

대상:
- Package 07~09

통과 조건:
- 성장
- 장비
- 보상
- 스테이지

모두 연결 규칙 완료

## Gate D — Product Freeze

대상:
- Package 10~16

통과 조건:
- UI
- Save
- Presentation
- Balance
- QA
- Release

모두 정의 완료

---

# 7. 패키지 시작 조건 템플릿

모든 패키지는 시작 전에 아래를 확인한다.

- 선행 패키지 완료
- 입력 데이터 확정
- 출력 데이터 확정
- 관련 Schema 확정
- Open Question 수용 가능 수준
- 상위 문서와 충돌 없음

---

# 8. 패키지 종료 조건 템플릿

모든 패키지는 아래를 만족해야 종료한다.

1. Bible
2. Spec
3. Data Schema
4. State Machine
5. Exception Rules
6. AI Task Breakdown
7. Acceptance Test
8. Integration Guide
9. Review Checklist
10. Definition of Done

---

# 9. 변경 관리

의존성이 바뀌면 반드시 다음을 수행한다.

1. 이 문서의 DAG 수정
2. 영향받는 패키지 목록 작성
3. ADR 기록
4. Sprint Backlog 영향 검토
5. Save/Data 호환성 검토

---

# 10. 다음 작업

현재 순서상 다음 작업은 그대로 유지한다.

## Package 01 — Input Foundation 마감

1. Input System Acceptance Test Spec
2. AI Task Spec — Input System
3. Stage 1 Final Integration & Review

이 세 문서가 완료되면 Package 01을 `완료`로 전환한다.

그 다음:

## Package 02 — Skill Execution Development Package

작성 시작.
