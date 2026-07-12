# Package 11 — Save & Data (Living Document) v1.0

> 작성일: 2026-07-12 | 선행: Package 07, 08 | 해금: Package 14 | 병렬: Package 10, 12
> 저장은 신뢰다. 데이터 손실 1회 = 플레이어 1명 영구 상실.

---

# 1. 목적/범위

포함: Save 스키마, 저장/로드 엔진, 버전/마이그레이션, 손상 복구, 자동저장 시점, 클라우드 훅.
제외: 저장되는 값의 의미(P07/P08), 설정 UI(P10).

# 2. 저장 대상 (Data Architecture §7 승계)

| 저장 (영구) | 저장 안 함 (런) |
|---|---|
| 수련점, 영구 해금(검술/검파/특성), 승급, 도감, 업적, 옵션, 튜토리얼 완료, 통계 | 런 빌드, 골드, 검기 게이지, 버프, 웨이브 상태 |
| **런 이어하기 스냅샷** (별도 슬롯): 현재 스테이지·체크포인트·런 빌드·골드 | — |

- 런 스냅샷: "앱 종료 후 이어하기"용. 사망/클리어 시 삭제. 체크포인트 도달·성장 선택·상점 이용 시 갱신.

# 3. save.json 스키마

```json
{
  "version": 1,
  "created_at": 0, "updated_at": 0,
  "meta": { "training_points": 0, "rank": 1, "unlocked_skills": [], "unlocked_schools": [], "start_traits": [], "meta_upgrades": {} },
  "codex": { "skills": {}, "enemies": {}, "bosses": {} },
  "achievements": [],
  "stats": { "runs": 0, "clears": 0, "best_time_ms": 0, "parry_success": 0 },
  "options": { "difficulty": "standard", "left_handed": false, "..." : "..." },
  "tutorial_done": false,
  "run_snapshot": null
}
```

# 4. 저장 엔진 규칙

- 백엔드: localStorage (키: `sm.save.v1`) + **이중 슬롯**(main/backup 교대 기록 — 기록 중 크래시 대비).
- 기록 절차: 직렬화 → 체크섬(CRC32) 부착 → backup에 쓰기 → 검증 읽기 → main 승격.
- 로드 절차: main 체크섬 검증 → 실패 시 backup → 둘 다 실패 시 신규 생성 + 손상본 보존(`sm.save.corrupt`) + 사과 안내.
- 저장 시점: 런 스냅샷 갱신 이벤트 / 메타 변동(수련점·해금·승급) / 옵션 변경 / visibilitychange(백그라운드 전환 — 모바일 필수).
- 쓰기 스로틀: 최소 간격 1s (연속 이벤트 배칭).

# 5. 버전/마이그레이션

- `version` 정수 증가. `migrations[]` = 순차 순수 함수 (v1→v2→…).
- 마이그레이션 실패 시: 원본 보존 + 안전 기본값 병합 + 로그. 데이터 구조 변경은 ADR 기록 (Data Architecture §10).
- 다운그레이드(구버전 앱이 신버전 세이브): 읽기 거부 + 안내 (조용한 파손 금지).

# 6. 클라우드 훅 (출시 채널 대비 — 구현은 P14)

- SaveBackend 인터페이스: `read()/write()/timestamp()` — localStorage 구현이 기본.
- Steam(Tauri) = Steam Cloud 파일 / 모바일 = 플랫폼 클라우드 or 계정 서버 (추후).
- 충돌 정책: 최신 updated_at 우선 + 사용자 확인 (통계 큰 쪽 경고).

# 7. AI Task 분해

| ID | 내용 | 완료 조건 | 의존 |
|---|---|---|---|
| SAV-01 | 스키마 + 직렬화/체크섬 | 왕복(round-trip) 테스트 PASS | PRG-01 |
| SAV-02 | 이중 슬롯 엔진 + 복구 | 손상 주입 테스트 PASS | SAV-01 |
| SAV-03 | 저장 시점 연결 + 스로틀 | 이벤트 트리거 테스트 PASS | SAV-02 |
| SAV-04 | 런 스냅샷 (이어하기) | 중단/복원 시나리오 PASS | SAV-03, STG-05 |
| SAV-05 | 마이그레이션 프레임 + v1 기준선 | 마이그레이션 테스트 PASS | SAV-01 |
| SAV-06 | SaveBackend 추상화 + Acceptance | §8 전체 PASS | 전부 |

# 8. Acceptance Test

□ 왕복 직렬화 무손실 (전 필드)
□ 손상 주입 20종(절단/변조/빈문자열/쿼터 초과) 전부 복구 or 안전 생성
□ 기록 중 강제 중단 시뮬 → backup 생존
□ 이어하기: 중단 시점 스테이지·빌드·골드 완전 복원
□ 사망/클리어 후 스냅샷 삭제 확인
□ v0(더미)→v1 마이그레이션
□ 모바일 실기: 앱 강제 종료 → 이어하기 (iOS/Android)
□ localStorage 쿼터 초과 시 안전 처리

# 9. Cross References
Data Architecture(v2.6) §7 / P07 §6(유지 규칙) / P09 §6(체크포인트) / P14(클라우드 구현)

# 10. Open Questions
1. 통계 항목 확정 (도감·업적과 중복 정리)
2. 세이브 슬롯 다중화(프로필 3개) — 현재 안: 1 프로필
3. 클라우드 동기화 시점 (수동/자동)
