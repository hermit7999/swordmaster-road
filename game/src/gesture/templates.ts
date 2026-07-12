// 기본 검술 8종 제스처 템플릿 — Sword Language Bible v0.1 §2.
// 데이터 단일 출처. 추후 JSON 외부화 가능(Data Architecture) — 현재는 TS 상수로 관리.
import type { Dir8, GestureTemplate } from './types.ts';

export const DEFAULT_GESTURES: GestureTemplate[] = [
  // 가로 계열 max_len 주의: 정규화가 화면 '높이' 기준이라 와이드 화면에서
  // 가로 획은 3~4 유닛까지 자연스럽게 나온다 (실기 버그 2026-07-12 — 상한 완화).
  {
    gesture_id: 'slash_h',
    name: '횡베기',
    kind: 'stroke',
    dirs: ['E'],
    min_len: 0.22,
    max_len: 4.5,
    min_ms: 30,
    max_ms: 1200,
    priority: 5,
  },
  {
    gesture_id: 'slash_back',
    name: '역베기',
    kind: 'stroke',
    dirs: ['W'],
    min_len: 0.22,
    max_len: 4.5,
    min_ms: 30,
    max_ms: 1200,
    priority: 5,
  },
  {
    gesture_id: 'slash_v',
    name: '내려베기',
    kind: 'stroke',
    dirs: ['S'],
    min_len: 0.2,
    max_len: 1.4,
    min_ms: 30,
    max_ms: 900,
    priority: 5,
  },
  {
    gesture_id: 'slash_up',
    name: '올려베기',
    kind: 'stroke',
    dirs: ['N'],
    min_len: 0.2,
    max_len: 1.4,
    min_ms: 30,
    max_ms: 900,
    priority: 5,
  },
  {
    gesture_id: 'slash_diag',
    name: '사선베기',
    kind: 'stroke',
    dirs: ['SE'],
    min_len: 0.18,
    max_len: 4.0,
    min_ms: 25,
    max_ms: 1100,
    priority: 6, // 패링(SE→NE)과의 충돌 시 패링 우선 (Bible §6)
  },
  {
    gesture_id: 'iaido',
    name: '발도술',
    kind: 'stroke',
    dirs: ['W', 'E'],
    dir_weights: [0.4, 1], // 짧은 납도(당김) + 긴 발도(긋기)
    min_len: 0.3,
    max_len: 5.5,
    min_ms: 60,
    max_ms: 1200,
    priority: 3, // W 세그먼트 확인 시 횡베기보다 우선
  },
  {
    gesture_id: 'parry',
    name: '패링',
    kind: 'stroke',
    dirs: ['SE', 'NE'],
    min_len: 0.18,
    max_len: 3.0,
    min_ms: 50,
    max_ms: 1000,
    priority: 2, // 최고 우선 (방어 기술 — 오발 방지)
  },
  {
    gesture_id: 'spin',
    name: '회전베기',
    kind: 'loop',
    dirs: [],
    min_len: 0.55,
    max_len: 6.0,
    min_ms: 120,
    max_ms: 1200,
    priority: 4,
    min_turn_deg: 270,
  },
];

/** 좌수검류: 좌우 미러 (프로토타입 유파 시스템 이식 — 좌수는 우→좌 긋기 = 횡베기). */
const MIRROR: Record<Dir8, Dir8> = {
  E: 'W', W: 'E', NE: 'NW', NW: 'NE', SE: 'SW', SW: 'SE', N: 'N', S: 'S',
};

export function mirrorTemplates(list: GestureTemplate[]): GestureTemplate[] {
  return list.map((t) => ({ ...t, dirs: t.dirs.map((d) => MIRROR[d]) }));
}

export const LEFT_GESTURES: GestureTemplate[] = mirrorTemplates(DEFAULT_GESTURES);
