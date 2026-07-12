# Package 04 — Enemy Foundation (Living Document) v1.0

> 작성일: 2026-07-12 | 선행: Package 03 | 해금: Package 06, 09 | 병렬: Package 05
> "모든 적은 선생님이다"(ADR-005)를 상태 머신과 데이터로 구현한다.

---

# 1. 목적/범위

포함: Enemy State Machine, 적 12종 정의, 공격 선택 규칙(토큰), 다수 협동, Telegraph 규격, enemy.json.
제외: 보스(P06), Duel 전용 행동(P05), 스폰 배치(P09).

# 2. 핵심 규칙

1. 적마다 학습 목표 1개 — 답 못하면 삭제 (Enemy Teaching Bible).
2. 모든 공격은 Telegraph(예고) 후 나온다. 예고 없는 피격 금지.
3. 새 기술은 한 번에 하나만 요구.
4. HP만 많은 적 금지 — 단단함은 기믹(방패·슈퍼아머)으로.

# 3. Enemy State Machine (전 적 공통)

```
Idle → Alert(발견) → Approach(간격 조절) → Telegraph(예고) → Attack → Recover
  ↑        │                                                        │
  └────────┴──── Hit(경직) / Stagger(그로기) / Guard ←──────────────┘
                          ↓
                        Dead
```
- 상태별 데이터 주도(ai_profile): 이동 속도, 선호 간격, 예고 시간, 공격 쿨다운.
- Hit는 poise 임계 미만이면 무시(슈퍼아머 플래그).

# 4. Telegraph 규격 (전투 가독성의 핵심)

| 타입 | 표시 | 플레이어 대응 |
|---|---|---|
| 노랑 | 몸 아우라 황색 | 패링(✓) 가능 / 회피 가능 |
| 빨강 | 몸 아우라 적색 | 패링 불가 — 회피 강제 |

- **노랑 예고 최소 시간 = 700ms** (Sword Language Bible §2.8-1: 반응 250 + ✓작성 300 + 유효창 여유). 빨강 최소 500ms.
- 표시는 오버레이가 아니라 적 몸 발광 (프로토타입 검증 방식 — 방향 지시 UI 없음).

# 5. 적 12종 (출시 기준, Scope Bible 10~12 상한)

| # | enemy_id | 이름 | 학습 목표 | 핵심 기믹 | 등장 |
|---|---|---|---|---|---|
| 1 | soldier | 잡병 | 기본 베기·리듬 | 없음 (1~2획 처치) | S1 |
| 2 | spear | 창병 | 거리 조절·접근 타이밍 | 긴 리치, 근접 무력 | S1 |
| 3 | hound | 들개 | 다수 대응 | 3~5마리 포위 → 회전베기 유도 | S1 |
| 4 | archer | 궁수 | 이동·회피 | 원거리 조준선, 발도술로 접근 유도 | S2 |
| 5 | swift | 쾌검사 | 사선베기·속도 | 빠른 2연격(노랑) | S2 |
| 6 | shield | 방패병 | 내려베기·패링 | 정면 가드 — 내려베기/가드브레이크만 유효 | S2 |
| 7 | dual | 쌍검사 | 연속 공격 대응·리듬 | 3연격 노랑 연쇄 패링 | S3 |
| 8 | heavy | 중갑귀 | 자세 싸움 | 슈퍼아머, poise 공략 필수(올려베기) | S3 |
| 9 | berserk | 광전사 | 빨강 회피 | 빨강 돌진, 회피 후 반격 창 | S3~4 |
| 10 | caster | 주술사 | 우선순위 판단 | 후방 강화 오라 — 먼저 잡을 대상 | S4 |
| 11 | shadow | 그림자검사 | 발도 카운터 | 플레이어 획 흉내, 카운터 유도 | S4~5 |
| 12 | knight | 정예기사 | 종합 | 가드+연격+빨강 혼합 (미니보스급) | S4~5 |

각 적 = 특정 검술의 "출제자". 보스 전 필수 등장 규칙: 보스가 시험할 기술의 교사 적이 같은 스테이지에 선행 배치 (P09 스폰 규칙).

# 6. 공격 선택/협동 규칙 (다수전)

- **공격 토큰**: 동시 공격 가능 적 수 = 2 (balance). 토큰 없는 적은 배회/견제 위치 이동.
- 토큰 배분: 근접순 + 마지막 공격 후 경과 시간 가중.
- 포위 규칙: 좌우 배분 (횡스크롤 기준 앞뒤), 후방 적은 archer/caster 우선.
- 동시 빨강 금지: 빨강 예고는 화면에 1개만 (회피 강제가 겹치면 억울함).

# 7. enemy.json 스키마

```json
{
  "enemy_id": "shield",
  "name": "방패병",
  "hp": 34, "poise_max": 60, "weight": 1.2,
  "movement_type": "walker",
  "attack_set": "atkset_shield",       // 별도 attack_sets.json 참조
  "weak_point": "slash_v",             // 약점 획 (×1.3)
  "guard": { "front": true, "gauge": 90 },
  "super_armor": false,
  "teach_goal": "parry_timing",
  "reward_table": "rw_common_t2",
  "ai_profile": "ai_defensive",
  "version": 1
}
```
attack_sets.json: `{attack_id, telegraph_type(노랑|빨강), telegraph_ms, damage, range, cooldown, poise_self}`

# 8. AI Task 분해

| ID | 내용 | 완료 조건 | 의존 |
|---|---|---|---|
| ENM-01 | enemy/attack_set 스키마 + 로더 | 검증 테스트 PASS | CBT-08 |
| ENM-02 | Enemy State Machine (공통) | 전이 결정론 테스트 PASS | ENM-01 |
| ENM-03 | Telegraph 시스템 (노랑/빨강, 최소시간 검증) | 예고 규칙 테스트 PASS | ENM-02 |
| ENM-04 | 공격 토큰 + 협동 규칙 | 다수전 시뮬 테스트 PASS | ENM-02 |
| ENM-05 | 기믹 모듈: 가드/슈퍼아머/원거리/강화오라 | 기믹별 테스트 PASS | ENM-02 |
| ENM-06 | 12종 데이터 입력 + 개별 행동 검증 | 종별 시나리오 테스트 PASS | ENM-03~05 |
| ENM-07 | Acceptance 실행 + 리포트 | §9 전체 PASS | 전부 |

# 9. Acceptance Test

□ 12종 각각: 학습 목표 행동이 실제로 유도되는가 (시나리오 테스트)
□ 예고 없는 피해 0건 (전 공격 Telegraph 선행 검증)
□ 노랑 700ms/빨강 500ms 최소 시간 준수 (데이터 검증 규칙)
□ 동시 빨강 1개 제한
□ 공격 토큰 2 초과 동시 공격 0건
□ 방패병: 정면 횡베기 무효·내려베기 유효
□ 슈퍼아머: 경직 무시하되 poise 누적은 정상
□ 리플레이 결정론 (동일 시드 → 동일 행동 시퀀스)
□ 실기: 잡병 5~10초 내 처치 리듬 확인 (GDD 일반전 목표)

# 10. Cross References
Enemy Teaching Bible(v1.0) / P03 Combat / P06 Boss / P09 Stage Flow / Sword Language Bible §6(짝 적)

# 11. Open Questions
1. caster(주술사)가 판타지 톤과 맞는지 — 세계관 확정 시 재명명 가능
2. 적 AI 난이도 스케일링 (난이도 옵션이 예고 시간에도 영향?)
3. 들개 무리의 최대 동시 수 (성능 실측 후)
