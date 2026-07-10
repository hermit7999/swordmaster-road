# CLAUDE.md — 「소드마스터의 길」 저장소 규칙

이 저장소에서 작업하는 에이전트는 **먼저 이 파일과 `docs/`를 읽는다.**

## 현재 상태 (2026-07-10)

- **M0 완료 (조건부 통과)** — 획 3종 검로/검결 판정, 등급/사운드/오버레이, 연풍참, 좌수 미러, 채널 중재. 라이브: https://hermit7999.github.io/swordmaster-road/
  - 잔여 1건: 테스터 3인 "다시 긋고 싶다" 실기 — **M1 완료 전까지 실시**(미실시로 M2 진입 금지).
- **M1 착수** — Phaser 3 + TypeScript + Vite 전환. 획 8종 + 검술 6종 + 유파 정식화 + 수련 씬 + 결전 전투 + 승급 시험. 진행 순서·완료 기준 = `docs/작업지시서_v2.md` §3.

## 작업 규칙 (필수)

1. M0는 단일 `index.html`(프레임워크 금지). **M1부터 Phaser 3 + TS + Vite** — 순수부(engine)와 DOM 계층 분리.
2. 판정 로직은 **순수 함수**(DOM 비의존): `judgeStroke` / `judgeRhythm` / `ComboTracker` / 미러.
3. 수치 하드코딩 금지 — `BALANCE / STROKE_TEMPLATES / TECHNIQUES / STYLES` 데이터 블록에만. M1에서 `src/data/*.json`으로 외부화.
4. 판정 이벤트 규격 고정: `{strokeId, accuracy, grade, inputMode, timestamp}`.
5. 용어 통일(판타지): 퍼펙트/그레이트/굿/배드/미스, 소드 아츠, 골드, 승급 시험.
6. 요구사항 ID(FR-INP-004 등)를 코드 주석에 남긴다.
7. **작업(태스크) 완료마다 커밋 + push**, `WORKLOG.md` 갱신. 커밋 메시지는 "무엇을·왜".

## 문서

- `docs/설계서_v3.1.md` — 판정·입력 코어 설계(산식/수치/중재/유파).
- `docs/SRS_v1.2.md` — 요구사항(FR-INP/JDG/FBK, Open Issues).
- `docs/작업지시서_v2.md` — M0 마감 판정 + M1 상세 태스크(T1-00~T1-09).
- `WORKLOG.md` — 인수인계 장부 + M0 검증 리포트(T0-11).

> 참고: 이전 세션의 SRS v1.1 / 설계서 v3.0 / 작업지시서 v1 원본 파일은 이 저장소·PC에 존재하지 않았다. 현재 docs/는 M0 검증 통과분을 단일 진실로 재정착한 정식 문서다.
