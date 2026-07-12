# Stage 1 Final Integration & Review v1.0

> 작성일: 2026-07-12 | Package 01 마감 문서 3/3
> 상위: Stage 1 Development Package(v3.2), Package01 Living Document, ADR-008~010
> 이 문서가 정의하는 통합·검증을 통과하면 **Package 01 완료 = Vertical Slice 0.1**이며, Package 02(Skill Execution)를 시작한다.

---

# 1. 통합 대상

```
[Gesture 트랙]                     [Input 트랙]
TASK-001~010 (v3.0)               TASK-201~213 (AI Task Spec Input v1.0)
Point Buffer→…→Skill Resolver     Types→…→Acceptance
        └──────────┬──────────────┘
                   ▼
        Stage 1 Integration (본 문서)
                   ▼
        Vertical Slice 0.1
```

두 트랙은 독립 구현 가능하며, GestureInputCollector(TASK-208) ↔ Point Buffer(TASK-001)가 접점이다.

# 2. 통합 순서

## STEP 1 — 프로젝트 뼈대
- 신규 저장소: TS + Vite + Phaser 3 + vitest. CI(GitHub Actions): tsc → vitest → build.
- 디렉터리: `src/input/`(입력 계층), `src/gesture/`(인식), `src/data/`(JSON), `src/scene/`(Phaser 씬).
- 데이터: skill.json 초안 (Sword Language Bible §8 스키마, 시작 검술 2종 = 횡베기·내려베기 + 발도술).

## STEP 2 — Input ↔ Gesture 연결
- GestureSession(PendingRecognition) → Gesture Engine → `{gesture_id, confidence, score, elapsed_time}` 반환 (Integration Guide v3.1 인터페이스).
- 검증: 이동 중 횡베기 입력 → 85점 이상 시 skill_slash_h resolve.

## STEP 3 — Skill Resolver ↔ Combat Trigger (최소)
- 스킬 실행 스텁: 판정 결과 → 이벤트 발행 → 임시 연출(콘솔+화면 텍스트).
- 패링 유효창 플래그 규칙(SE 단독 오발 방지, TC-106) 구현.

## STEP 4 — Phaser 씬 + Debug Overlay
- 테스트 씬: 플레이어(임시 스프라이트) + 적 1종(더미) + 전체 화면 제스처 영역.
- **[프로토타입 교훈 — 필수 규칙]** 모든 표시 요소는 `pointer-events: none` 기본. 인터랙션 요소만 예외. 화면 전체가 검로 제스처 영역.
- Debug Overlay: Raw Path/정규화 Path/방향/Score/실패 사유/Owner/Context/버퍼 표시.

## STEP 5 — Acceptance 일괄 실행
- Gesture Acceptance(v2.9) + Input Acceptance(v1.0) 자동 TC 전체 → 리포트 생성.
- 실기 체크리스트 (아래 §4).

# 3. Vertical Slice 0.1 정의

완료 시 가능한 플레이:
- PC(WASD+마우스)와 폰(트윈터치)에서 이동
- 횡베기(E)·내려베기(S)·발도술(W→E) 제스처 발동
- 더미 적 1종 처치 (스킬 이벤트 → HP 감소 → 사망 연출 최소)
- 기본 손맛 1차 검증 (히트스톱·타격음·화면 흔들림 중 최소 2개 — 임시 에셋 허용)
- Debug Overlay로 판정 확인 가능

# 4. 실기 체크리스트 (기기: 안드로이드 + iPhone + PC)

□ 10분 플레이 중 입력 씹힘 체감 0건
□ 이동하며 베기가 자연스러움 (양손 동시)
□ 의도한 제스처 성공률 95%+ / 오인식 3%↓ (Debug Overlay 집계)
□ 패링 ✓ 실측: 예고 모션 보고 ✓ 입력이 물리적으로 가능 (Sword Language Bible §2.8-1 검증) — **불가 판정 시 패링 재설계 트리거**
□ 60FPS 유지 (폰 실기)
□ 브라우저 제스처 간섭 0 (새로고침 당김, 뒤로가기 스와이프, 더블탭 줌)
□ 백그라운드 전환 후 복귀 시 유령 입력 0

# 5. Package 01 Definition of Done

□ Gesture TASK-001~010 전부 DONE
□ Input TASK-201~213 전부 DONE
□ 두 Acceptance Spec 자동 TC 100% PASS
□ 실기 체크리스트 통과
□ Vertical Slice 0.1 플레이 가능
□ 치명적 버그 0 / 오류 코드 로그 규격 일치
□ Living Document(Package01) 갱신 + 본 리포트 작성

# 6. 리스크 등록부

| 리스크 | 심각도 | 대응 |
|---|---|---|
| 패링 ✓가 실측에서 불성립 | 높음 | §4 실측이 게이트. 실패 시 Sword Language Bible §2.8 재개정 (예고 시간 연장 또는 입력 재설계) |
| 발도술 W→E의 W 세그먼트가 노이즈 필터에 제거돼 횡베기 오인 | 중간 | 충돌 쌍 500회 테스트 (Bible §6), Noise Filter 임계 튜닝 |
| iOS Safari pointercancel 편차 | 중간 | 실기 확인 후 Adapter 예외 규칙 |
| 폰 저사양 60FPS 미달 | 중간 | Phaser 렌더 프로파일링, 오브젝트 풀링 — ADR-009 변경 조건 감시 |
| 두 트랙 인터페이스 불일치 | 낮음 | Integration Guide(v3.1) 인터페이스 고정 — 변경 시 양쪽 동시 개정 |

# 7. 종료 후 다음 단계

**Package 02 — Skill Execution** 시작 조건 충족 확인:
- 검술 8개 확정 ✅ (Sword Language Bible v0.1 — 사용자 검토 완료 전제)
- Skill Data Schema ✅ (Bible §8)
- 입력→제스처→스킬 resolve 파이프라인 가동 ✅ (본 통합)

Package 02 범위: Skill State Machine, 8검술 전체 구현, 캔슬/연계 규칙, 오의 성립 판정, Skill Acceptance.

# Cross References
- Stage 1 Development Package (v3.2) / Package01 Living Document
- Gesture: Recognition Bible(v2.7), Algorithm Spec(v2.8), Acceptance(v2.9), AI Task(v3.0), Integration Guide(v3.1)
- Input: System Spec(v3.4), Acceptance(v1.0), AI Task(v1.0)
- Sword Language Bible v0.1
- 통합 마스터 문서 v1.1
