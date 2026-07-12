# 소드마스터의 길 (신규 개발 — GDD 기반)

`docs/new_docs/SwordMaster_Master_Task_Backlog_v1.0.md`가 진행표. 설계는 같은 폴더의 Living Documents.

## 실행

```bash
npm install        # 최초 1회 (phaser, vite, typescript)
npm run dev        # 개발 서버 → 브라우저
npm run dev -- --host   # 폰 테스트 (같은 네트워크)
npm test           # 테스트 (node:test — 의존성 불필요, Node 22+)
npm run typecheck  # tsc
npm run build      # 배포 빌드
```

## 구조 (ADR-009: 로직은 순수 TS, 렌더만 Phaser)

```
src/
├── gesture/   제스처 인식 엔진 (GES-01~10) — DOM 비의존
├── input/     입력 시스템 (INP-01~13) — DOM 접점은 adapters.ts만
├── game/      파이프라인 (Input↔Gesture↔Skill)
└── main.ts    Phaser 테스트 씬 (Vertical Slice 0.1)
```

## 현재 상태: M-A 코드 완료

- 테스트 83종 PASS, 판정 0.12ms/회
- 조작: WASD/왼쪽 터치=이동, 화면에 긋기=검술 (E=횡베기, S=내려베기, N=올려베기, SE=사선, W=역베기, W→E=발도술, ✓=패링, 원=회전베기), Space=회피, P=패링 유효창 토글
- 다음: ITG-03 실기 검증 (사용자) → M-B (Skill Execution)
