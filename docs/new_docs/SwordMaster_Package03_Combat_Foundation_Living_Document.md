# Package 03 — Combat Foundation (Living Document) v1.0

> 작성일: 2026-07-12 | 선행: Package 02 | 해금: Package 04, 05
> 스킬 실행(AttackEvent)이 세계에 미치는 결과 — 히트 판정, 데미지, 반응, 자세, 콤보 — 를 정의한다.
> Combat Bible Part 1(v1.5)의 규칙을 구현 가능한 명세로 구체화한 문서 (= 예고됐던 Combat Bible Part 2).

---

# 1. 목적/범위

포함: Hit Detection, Damage Formula, Hit Reaction(넉백/경직), 자세(Poise)/그로기, 콤보, 플레이어 피격/회피 실행, 이벤트 규격.
제외: 적 AI 행동 선택(P04), Duel 전용 규칙(P05), 연출 수치(P12 — 여기선 profile ID만 전달).

# 2. 핵심 규칙 (Bible 요약)

- 공격은 ①보이고 ②느껴지고 ③결과가 즉시 나온다.
- 모든 적중은 눈에 보이는 변화를 만든다 — HP만 감소 금지 (Game Feel §4).
- 피격 이유가 불명확한 공격, 보이지 않는 판정 금지 (Combat Bible §11).
- 그로기는 "많이 때려서"가 아니라 "정확하게 공략해서" 발생.

# 3. Hit Detection

- 좌표계: 월드 단위(unit). 플레이어 기준 히트 형상:
  - `arc{angle, range}`: 부채꼴 (횡베기·역베기)
  - `line{width, range}`: 직선 (내려·올려·사선·발도)
  - `circle{range}`: 원형 (회전베기)
  - `projectile{speed, range, pierce}`: 검기
- 적 히트박스: 원(radius) — enemy.json.
- 판정 시점: Active 구간 시작 프레임에 1회 스냅샷 판정 (드래그 판정 아님 — 결정론 우선). 발도술·검기만 이동 경로 스윕(swept) 판정.
- 중복 방지: AttackEvent당 적별 1히트 (hit set). 오의·회전베기 Lv4 등 다단히트는 hit_count 필드로 명시.
- 방향: 제스처 방향(8방향)이 공격 방향 — 플레이어 바라보기와 무관하게 그은 쪽을 벤다 (횡스크롤에선 좌우 부호로 축약, P09 참조).

# 4. Damage Formula

```
damage = base                      // skill.json
       × gradeMul                  // 퍼펙트1.3 / 그레이트1.15 / 굿1.0 / 배드0.6
       × comboMul                  // 1 + 0.05×콤보수, 상한 1.5
       × counterMul                // 카운터 성립 시 2.0, 아니면 1.0
       × groggyMul                 // 대상 그로기 중 1.5
       × modifierMul               // 장비/성장 (P08)
       × weaknessMul               // 약점 획 적중 1.3 (enemy.weak_point)
```
- 카운터 성립: 적 Telegraph 구간에 발도술/패링 반격 적중.
- 최소 피해 1 보장. 모든 배율은 balance.json.

# 5. Hit Reaction (적 반응)

| 반응 | 조건 | 효과 |
|---|---|---|
| 밀림(push) | 모든 적중 기본 | 넉백 거리 = skill.push × 적 weight 역보정 |
| 경직(flinch) | poise 누적 < 임계 && 적중 | flinch_ms 동안 행동 취소 (슈퍼아머 적 제외) |
| 가드(guarded) | 방패/가드 상태 정면 적중 | 피해 0~30%, 가드 게이지 감소, "막힘" 연출 |
| 가드 브레이크 | 가드 게이지 0 | 큰 경직 + poise 대미지 2배 창 |
| 자세 붕괴(groggy) | poise 게이지 만충 | §6 |
| 사망 | HP 0 | 사망 연출 + 보상 (마지막 적이면 피니시 연출, P12) |

# 6. 자세(Poise) / 그로기

- 적별 poise_max. 스킬 poise_damage로 누적, 3s 무적중 시 초당 20% 자연 감소.
- 만충 → 그로기: duration 3000ms(잡몹)/2000ms(정예·보스), 피해 ×1.5, 전용 피니시 입력 가능(연출 강화).
- 그로기 유발 3경로 (Combat Bible §9): ① 올려베기 등 poise 특화 스킬 ② 패링 성공(+60) ③ 가드 브레이크 후 공략.

# 7. 콤보

- 적중 시 +1. 리셋 조건: 2500ms 무적중 / 플레이어 피격 / 미스 등급.
- comboMul 외 효과: 콤보 10+ 시 HUD 강조, 콤보 유지가 쾌검류 검파 보너스 대상.

# 8. 플레이어 피격/회피

- 피격: HP 감소, 피격 경직 200ms(짧게 — Game Feel §9 "긴 피격 경직 금지"), 검기 게이지 50% 감소(P02), 콤보 리셋, 무적 600ms.
- 회피(플릭/버튼): 이동 거리 1.2unit, i-frame 240ms, 기력 15. 회피 후 300ms 내 공격 = 회피 반격 보정(+15% 피해).
- 사망: 런 종료 → 결과 화면 (P09/P10). "억울한 즉사" 금지 — 단일 공격 최대 피해 ≤ maxHP 40% (보스 필살 제외, 필살은 회피 강제 빨강 예고).

# 9. 이벤트 규격

```
AttackEvent{attack_id, skill_id, grade, shape, origin, dir, combo}
HitResult{attack_id, target_id, damage, poise, reaction, weakness_hit, counter}
→ Presentation(P12)에 profile 전달: {hit_stop_profile, shake_profile, sfx, vfx}
→ Telemetry: 명중률/스킬 사용 분포 집계
```
판정 로직은 순수 TS — 이벤트만 발행, 연출 직접 호출 금지.

# 10. AI Task 분해

| ID | 내용 | 완료 조건 | 의존 |
|---|---|---|---|
| CBT-01 | 히트 형상 기하 판정 (arc/line/circle/swept) | 기하 단위 테스트 PASS | SKL-01 |
| CBT-02 | AttackEvent→HitResult 파이프라인 (중복 방지) | 중복 히트 0 테스트 PASS | CBT-01 |
| CBT-03 | Damage Formula + 배율 체인 | 공식 결정론 테스트 PASS | CBT-02 |
| CBT-04 | Poise/그로기/가드 게이지 | 상태 전이 테스트 PASS | CBT-02 |
| CBT-05 | Hit Reaction 결정기 (§5 표) | 반응 매트릭스 테스트 PASS | CBT-04 |
| CBT-06 | 콤보 시스템 | 리셋 조건 테스트 PASS | CBT-02 |
| CBT-07 | 플레이어 피격/회피 실행 (i-frame) | 무적/회피 테스트 PASS | CBT-03, INP-09 |
| CBT-08 | 이벤트 발행 + profile 매핑 + Acceptance | §11 전체 PASS | 전부 |

# 11. Acceptance Test

□ 형상별 판정: 경계 안/밖/걸침 각 100케이스 결정론
□ 한 AttackEvent가 같은 적을 2회 타격하는 경우 0건
□ 공식: 배율 조합 전수(등급4×콤보3×카운터2×그로기2×약점2=96케이스) 기대값 일치
□ 그로기: 3경로 각각 성립, 자연 감소 타이밍 정확
□ 가드: 정면/후면 판정, 브레이크 전이
□ 회피 i-frame 경계(239/240/241ms) 정확
□ 최대 단일 피해 ≤ 40% 규칙 (보스 필살 태그 제외)
□ 리플레이 결정론: 동일 시드·입력 → 동일 HitResult 시퀀스
□ 실기: 첫 베기 손맛 체크(히트스톱·경직·밀림 3종 동시 발생 확인)

# 12. Cross References
Combat Bible P1(v1.5) / Game Feel Bible(v1.6) / P02 Skill Execution / Sword Language Bible §2 / Data Architecture(v2.6)

# 13. Open Questions
1. 스냅샷 판정 vs 획 궤적 실시간 판정 — 손맛 차이 프로토타입 A/B 필요 (현재: 스냅샷 채택)
2. 약점 시스템 노출 방식 (아이콘 표시 vs 발견형)
3. 피니시 입력을 별도 제스처로 할지 자동 연출로 할지
