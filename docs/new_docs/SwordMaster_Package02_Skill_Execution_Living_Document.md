# Package 02 — Skill Execution (Living Document) v1.0

> 작성일: 2026-07-12 | 선행: Package 01 | 해금: Package 03
> 제스처 인식 결과(gesture_id + score)를 받아 검술을 실행하는 계층을 정의한다.
> 모든 수치는 초기값이며 balance.json에서 관리한다 (하드코딩 금지).

---

# 1. 목적/범위

포함: Skill State Machine, 실행 파이프라인, 등급 판정, 기력(Stamina), 캔슬/연계 규칙, 오의 성립 판정, 검기 게이지, skill.json 확정.
제외: 히트 판정·데미지 계산(P03), 연출 상세(P12), 적 반응(P04).

# 2. 핵심 규칙 (Bible)

1. 입력이 끝난 순간 판정·실행 (Combat Bible §4). 선딜(Startup)은 짧게 — 반응성이 손맛이다.
2. 잘 그린 입력은 반드시 성공한다. 등급은 위력·연출 차이로만 반영.
3. 캔슬은 보상이다 — 정확한 입력일수록 더 빨리 다음 행동 가능.
4. 기력 부족 = 실행 불발 + 명확한 HUD 피드백 (억울한 절반 실행 금지).

# 3. 등급 판정 (Gesture Score → Grade)

| Score | 등급 | 위력 배율 | 비고 |
|---|---|---|---|
| 95~100 | 퍼펙트 | ×1.30 | 검기 발동 조건, 캔슬창 확대 |
| 90~94 | 그레이트 | ×1.15 | |
| 85~89 | 굿 | ×1.00 | 기본 성공선 (v2.8 §8) |
| 70~84 | 배드 | ×0.60 | 성립은 하되 약함 — "관대한 입력" 구현 |
| <70 | 미스 | 불발 | 스킬 미실행, 기력 미소모, 실패 사유 로그 |

# 4. Skill State Machine

```
Ready → Startup → Active → Recovery → Ready
                    │          │
                    │          └─ CancelWindow(등급별) → 다음 스킬 Startup
                    └─ (히트 시 P03에 AttackEvent 발행)
```
- 상태 전이는 IClock 기반 결정론.
- CancelWindow: Recovery 구간 중 캔슬 허용 시점 = recovery_ms × cancel_ratio. 퍼펙트 0.4 / 그레이트 0.55 / 굿 0.7 / 배드 1.0(캔슬 불가).
- 패링(✓)은 예외 — Startup/Recovery 중에도 입력 버퍼(80ms)에 등록되어 최우선 소비.
- 회피 입력은 Recovery 중 언제나 캔슬 가능 (생존 우선 원칙).

# 5. 실행 파이프라인

```
GestureResolved{gesture_id, score}
→ SkillLookup(skill.json)
→ StaminaCheck (부족 시 불발 이벤트)
→ StateMachine 진입 (현재 상태·캔슬 규칙 검사, 불가 시 Command Buffer 대기 120ms)
→ SkillExecuted{skill_id, grade} 발행
→ ChainRecorder 기록 (오의 판정용)
→ (Active 구간) AttackEvent → P03
```

# 6. 기력 (Stamina)

- 최대 100 (초기값). 회복 12/s, 스킬 Active~Recovery 중 회복 정지, 피격 시 1s 정지.
- 스킬별 소모 (초기값): 횡베기 8 / 내려베기 12 / 올려베기 10 / 사선베기 6 / 발도술 18 / 역베기 8 / 회전베기 22 / 패링 5.
- 패링 성공 시 +20 회복 (Combat Bible §8 — 최고 보상).
- 0 도달 시: 탈진 없음(이동 가능), 스킬만 불발. "지침" 상태 금지 — 억울함 방지.

# 7. 오의 성립 판정 (ChainRecorder)

- 최근 스킬 체인 [skill_id, grade, timestamp] 최대 4개 유지.
- 연계창: 직전 스킬 Active 종료 후 1500ms (balance).
- 오의 테이블 (Sword Language Bible §3):

| 오의 | 체인 | 등급 조건 |
|---|---|---|
| 연풍참 | 횡베기→사선베기 | 둘 다 굿+ |
| 낙뢰참 | 올려베기→내려베기 | 둘 다 그레이트+ |
| 십자참 | 횡베기→내려베기 | 둘 다 그레이트+ |
| 원무 | 회전베기→사선베기 | 둘 다 굿+ |
| 일섬 | 발도술(퍼펙트)→발도술 | 선행 퍼펙트 |

- 성립 시: 마지막 스킬 실행이 오의 실행으로 승격(별도 damage/연출), SecretArtTriggered 발행, 체인 리셋.
- 성립 실패는 무음 — 일반 스킬로 정상 실행 (실패 페널티 없음).

# 8. 검기 게이지

- kiMax 100. 정타당 +8 × gradeMul. 피격 시 현재치 50% 감소.
- 만충 + 퍼펙트 (횡베기|발도술→직선검기 / 회전베기→확산검기 / 내려베기→폭렬검기) → 검기 발동, 게이지 0.
- 만충 상태 HUD 펄스 (P10).

# 9. skill.json 확정 스키마 + 초기 데이터

스키마: Sword Language Bible §8 + 실행 필드 추가:
`startup_ms, active_ms, recovery_ms, cancel_ratio_override?, hit_shape{type: arc|line|circle|projectile, range, angle|width}, poise_damage, ki_gain_mul`

초기 데이터 (전부 balance 조정 대상):

| skill_id | dmg | poise | startup | active | recovery | hit_shape |
|---|---|---|---|---|---|---|
| slash_h | 20 | 10 | 60 | 100 | 240 | arc 120° r1.6 |
| slash_v | 24 | 30 | 110 | 90 | 320 | line w0.6 r1.4 |
| slash_up | 16 | 35 | 80 | 90 | 280 | line w0.6 r1.3 |
| slash_diag | 12 | 8 | 40 | 80 | 180 | line w0.5 r1.5 |
| iaido | 30 | 20 | 70(대시) | 120 | 360 | line w0.7 r2.8 |
| slash_back | 18 | 10 | 60 | 100 | 220 | arc 120° r1.6 후방보정 |
| spin | 26 | 25 | 140 | 160 | 420 | circle r1.8 |
| parry | 0 | 60(성공시) | 30 | 유효창 120 | 200 | self |
| 오의 5종 | 45~90 | 40~80 | 별도 | 별도 | 별도 | 별도 시트 |

# 10. AI Task 분해

| ID | 내용 | 완료 조건 | 의존 |
|---|---|---|---|
| SKL-01 | Skill 타입 + skill.json 로더/검증 | 스키마 검증 테스트 PASS | INP-01 |
| SKL-02 | Grade 판정기 (score→grade→배율) | 경계값 테스트 PASS | SKL-01 |
| SKL-03 | Skill State Machine (전이+CancelWindow) | 전이 결정론 테스트 PASS | SKL-01 |
| SKL-04 | Stamina 시스템 | 소모/회복/불발 테스트 PASS | SKL-01 |
| SKL-05 | 실행 파이프라인 조립 (버퍼 연동) | Gesture→SkillExecuted E2E PASS | SKL-02~04, GES-10, INP-09 |
| SKL-06 | ChainRecorder + 오의 판정 | 오의 매트릭스 테스트 PASS | SKL-05 |
| SKL-07 | 검기 게이지 | 충전/감소/발동 테스트 PASS | SKL-05 |
| SKL-08 | 8검술+오의 데이터 입력 + Acceptance 실행 | §11 전체 PASS | 전부 |

# 11. Acceptance Test

□ 등급 경계값(69/70/84/85/89/90/94/95) 각각 올바른 결과
□ 오의 매트릭스: 성립 5종 × (등급 미달/시간 초과/순서 오류) 부정 케이스 전부 미성립
□ 캔슬: 퍼펙트가 배드보다 항상 빠르게 다음 스킬 가능 (결정론)
□ 기력 0 불발 시 기력 미소모·이벤트 발행
□ 패링 버퍼: Recovery 중 ✓ 입력 → 최우선 소비 (TC-104 연계)
□ 패링 유효창 내 SE 단독 → 사선베기 미실행 (TC-106)
□ 동일 입력 리플레이 = 동일 스킬/등급/오의 시퀀스
□ 1000회 연속 실행 메모리 안정

# 12. Cross References
Sword Language Bible v0.1 / Gesture Algorithm Spec(v2.8) / Input AI Task Spec(v1.0) / Combat Bible P1(v1.5) / Data Architecture(v2.6)

# 13. Open Questions
1. 오의를 자동 승격이 아니라 "성립 표시 후 추가 입력으로 발동"하는 안 (숙련 보상 강화) — 프로토타입 실측 후 결정
2. 배드 등급의 캔슬 불가가 너무 가혹한지 — 플레이테스트 판정
3. 검기 발동을 별도 제스처로 분리할지 (현: 퍼펙트 자동)
