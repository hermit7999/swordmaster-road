# SwordMaster GDD v2.6

# Game Data Architecture Bible

> 목적
>
> 이 문서는 프로젝트의 모든 데이터 구조를 정의한다. 모든 AI(Codex,
> Claude, GPT)가 동일한 데이터 구조를 사용하도록 하는 것이 목표이다.
>
> **규칙** - 로직보다 데이터를 우선한다. - 하드코딩을 최소화한다. -
> JSON/DataTable만 수정해도 게임 밸런스를 변경할 수 있어야 한다.

------------------------------------------------------------------------

# 1. 데이터 계층

Game ├── Stage ├── Enemy ├── Boss ├── Skill ├── SwordSchool ├── Growth
├── Reward ├── Item ├── Save └── UI

모든 데이터는 ID 기반으로 연결한다.

------------------------------------------------------------------------

# 2. 공통 규칙

모든 데이터는 아래 필드를 가진다.

-   id (고유 ID)
-   name
-   description
-   version
-   tags
-   unlock_condition
-   debug_flag

ID는 절대 변경하지 않는다.

------------------------------------------------------------------------

# 3. Skill Schema

필수 필드

-   skill_id
-   input_pattern
-   stamina_cost
-   cooldown
-   damage
-   hit_stop
-   camera_profile
-   fx_profile
-   audio_profile
-   combo_group
-   unlock_condition

------------------------------------------------------------------------

# 4. Enemy Schema

-   enemy_id
-   hp
-   movement_type
-   attack_set
-   weak_point
-   stagger_value
-   reward_table
-   ai_profile

Enemy는 스킬을 직접 가지지 않고 attack_set을 참조한다.

------------------------------------------------------------------------

# 5. Boss Schema

-   boss_id
-   phase_list
-   duel_profile
-   reward_table
-   intro_camera
-   finish_camera

Phase는 별도 데이터로 관리한다.

------------------------------------------------------------------------

# 6. Stage Schema

-   stage_id
-   theme
-   enemy_spawn_table
-   mini_boss
-   boss
-   reward
-   next_stage

------------------------------------------------------------------------

# 7. Save Schema

저장 대상

-   영구 성장
-   해금 상태
-   업적
-   옵션
-   진행도

저장하지 않는 것

-   이번 판 빌드
-   현재 버프
-   임시 효과

------------------------------------------------------------------------

# 8. 참조 규칙

데이터는 문자열 이름이 아니라 ID만 참조한다.

예)

enemy.attack_set -\> attack_set_id

boss.reward -\> reward_table_id

------------------------------------------------------------------------

# 9. JSON 분리 원칙

skill.json enemy.json boss.json reward.json growth.json stage.json
save.json

한 파일에는 한 종류의 데이터만 저장한다.

------------------------------------------------------------------------

# 10. 버전 정책

모든 데이터는 version 필드를 가진다.

데이터 구조 변경 시

-   Migration 작성
-   Save 호환성 검토
-   ADR 기록

------------------------------------------------------------------------

# 11. AI 개발 규칙

AI에게 구현을 요청할 때는

1.  Schema 변경 여부
2.  영향받는 JSON
3.  Save 영향
4.  Cross Reference

를 반드시 함께 검토한다.

------------------------------------------------------------------------

# Cross References

-   Development Priority Matrix
-   Master Design Bible
-   Combat Bible
-   Progression Bible
-   Scope Bible

------------------------------------------------------------------------

# Open Questions

-   Unreal DataTable과 JSON을 병행할 것인가?
-   ScriptableObject(향후 엔진 변경 시) 대응 계층이 필요한가?
-   Localization 키를 초기에 분리할 것인가?

------------------------------------------------------------------------

# 다음 문서

Gesture Recognition Bible

이 문서에서는 제스처 입력을 수학적 규칙과 데이터 구조로 정의한다.
