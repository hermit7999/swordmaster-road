# CLAUDE.md — 「소드마스터의 길」 저장소 규칙

이 저장소에서 작업하는 에이전트는 **먼저 이 파일과 `docs/`를 읽는다.**

## 현재 상태 (2026-07-10)

- **M0 + M1 완료 (M1 조건부 통과)** — 획 8종·검술 6종·유파 2종·수련/결전/승급 씬. 라이브: https://hermit7999.github.io/swordmaster-road/
  - M1 잔여 1건: **테스터 3인 플레이테스트**(M1 빌드가 첫 "보낼 만한 빌드" — 사용자 액션, 라이브 URL 공유).
- **M2 착수 (데모: 프롤로그~스테이지1, 30~40분)** — 노드맵·저장·조우/정예전·경제/아이템/레벨·스토리·적확장/보스·타이틀/설정. 진행 순서·완료 기준 = `docs/작업지시서_v3.md` §2. 의존: T2-00→T2-01→(T2-02,T2-03,T2-05)→T2-04,T2-06→T2-07→T2-08→T2-09.

## 아키텍처

- **웹 표준 스택: TypeScript + Vite, 판정 엔진 순수 TS(`src/engine`), 씬 = DOM + Canvas.**
- **Phaser 이관 보류** (NFR-011): M1/M2는 DOM+Canvas 유지. 엔진이 순수 TS라 이관 비용 통제됨. **명확한 성능/연출 한계 도달 시 멈추고 보고 후 재평가.**
- 배포: `git push origin main` → GitHub Actions(`.github/workflows/deploy.yml`)가 `npm ci→build→dist` 배포(Pages build_type=workflow). 로컬 확인=`npm run dev` 또는 `npm run build`+`vite preview`(base `/swordmaster-road/`).

## 작업 규칙 (필수)

1. 판정 로직은 **순수 함수**(DOM 비의존): `src/engine/*.ts`(judge/rhythm/command/combo/style/geometry). DOM/씬은 `src/main.ts`.
2. 수치 하드코딩 금지 — `src/data/*.json`(strokes/techniques/styles/enemies/trials/balance)에만.
3. 판정 이벤트 규격 고정: `{strokeId, accuracy, grade, inputMode, timestamp}`.
4. 용어 통일(판타지): 퍼펙트/그레이트/굿/배드/미스, 소드 아츠, 골드, 승급 시험.
5. 요구사항 ID(FR-INP-004 등)를 코드 주석에 남긴다.
6. **작업(태스크) 완료마다 커밋 + push**, `WORKLOG.md` 갱신. 커밋 메시지는 "무엇을·왜".
7. 회귀: `npm test`(vitest, 현재 87종). 씬 변경은 브라우저 자가진단 + 실기 확인.

## 문서
- `docs/설계서_v3.2.md` — 판정·입력·전투·씬 코어 설계.
- `docs/SRS_v1.3.md` — 요구사항(FR-*, NFR, Open Issues).
- `docs/작업지시서_v3.md` — M1 마감 + M2 상세(T2-00~T2-10). (`작업지시서_v2.md`는 이력.)
- `WORKLOG.md` — 인수인계 장부 + M0(T0-11)·M1(T1-09) 검증 리포트.
