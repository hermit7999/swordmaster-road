// Gesture 공통 타입 — AI Task Spec Gesture(v3.0) / Gesture Algorithm Spec(v2.8)
// 순수 TS, DOM/Phaser 의존 금지 (ADR-009). enum 금지(strip-types 호환) — 문자열 유니온 사용.

/** 포인터(터치/마우스) 식별자. Pointer Events API의 pointerId와 호환. */
export type PointerId = number;

/** 제스처 궤적의 한 점. 단계에 따라 px(수집) 또는 화면높이 단위(정규화 후). */
export interface GesturePoint {
  x: number;
  y: number;
  /** monotonic clock 기준 ms. */
  t: number;
}

/** 8방향 (화면 좌표계: y 아래가 +). 우수검류 기준. */
export type Dir8 = 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'N' | 'NE';

/** 각 방향의 기준 각도(도). E=0, 시계방향(y-down) 양수. */
export const DIR8_ANGLE: Record<Dir8, number> = {
  E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225, N: 270, NE: 315,
};

export const ALL_DIR8: readonly Dir8[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

/** 제스처 템플릿 종류: stroke=방향 시퀀스, loop=폐곡선(회전베기). */
export type GestureKind = 'stroke' | 'loop';

/** 제스처 템플릿 (gestures 데이터 — Sword Language Bible §2). */
export interface GestureTemplate {
  gesture_id: string;
  name: string;
  kind: GestureKind;
  /** stroke: 세그먼트 방향 시퀀스. loop: 무시. */
  dirs: Dir8[];
  /** 전체 궤적 최소/최대 길이 (화면높이 단위). */
  min_len: number;
  max_len: number;
  /** 입력 시간 허용 범위 ms. */
  min_ms: number;
  max_ms: number;
  /** 동점 해결용 우선순위 (낮을수록 우선). */
  priority: number;
  /** loop 전용: 요구 총회전각(도). */
  min_turn_deg?: number;
  /**
   * 세그먼트 상대 길이 비율 (dirs와 같은 길이, 기본 전부 1).
   * 예: 발도술 [0.4, 1] = 짧게 당기고 길게 긋기 — Shape 비교의 이상 궤적에 반영.
   */
  dir_weights?: number[];
}

/** 판정 등급 (마스터 문서 §16.3 / P02 §3). */
export type RecognitionOutcome = 'success' | 'candidate' | 'fail';

export interface ScoreBreakdown {
  direction: number; // 0~50
  shape: number;     // 0~20
  length: number;    // 0~10
  speed: number;     // 0~10
  corner: number;    // 0~10
}

export interface CandidateScore {
  gesture_id: string;
  total: number;
  breakdown: ScoreBreakdown;
}

/** Gesture Engine 반환값 (Integration Guide v3.1 §3). */
export interface RecognitionResult {
  outcome: RecognitionOutcome;
  /** success/candidate일 때 최종 선택된 제스처. */
  gesture_id: string | null;
  score: number;
  confidence: number; // total/100
  elapsed_ms: number; // 입력 시작~끝
  /** 개발 모드용 상세 (실패 사유·후보·경로). */
  debug: RecognitionDebug;
}

export interface RecognitionDebug {
  reason: string;                 // 실패/판정 사유
  candidates: CandidateScore[];   // 전 템플릿 점수 (내림차순)
  segment_dirs: Dir8[];           // 인식된 세그먼트 방향
  corner_count: number;
  path_len: number;               // 화면높이 단위
  total_turn_deg: number;
  closed: boolean;
}

/** 엔진 설정 — 수치는 데이터에서 주입 (하드코딩 금지 원칙). */
export interface GestureEngineConfig {
  min_points: number;         // 최소 샘플 수 (v2.7 §3: 12)
  resample_n: number;         // v2.8 §5: 64
  noise_min_dist: number;     // 화면높이 단위 최소 이동 (손떨림 제거)
  rdp_epsilon: number;        // 코너 단순화 허용 오차 (크기 비율)
  corner_merge_deg: number;   // 인접 세그먼트 병합 각도
  min_segment_len: number;    // 세그먼트 최소 길이 (전체 대비 비율)
  loop_close_ratio: number;   // 폐곡선 판정: 시작-끝 거리 ≤ 크기×비율
  loop_min_turn_deg: number;  // 폐곡선 최소 총회전각
  success_threshold: number;  // 85 (v2.8 §8)
  candidate_threshold: number;// 70
  /** 난이도 오차 스케일 (Easy 1.3 / Normal 1.0 / Hard 0.8 — v2.8 §10). */
  tolerance_scale: number;
  /**
   * 길이 하한 실격 비율: min_len × 이 값 미만이면 실격.
   * 짧은 획은 실격 대신 길이 감점으로 처리 (실기 피드백 2026-07-12:
   * 적 위에 짧게 긋는 자연스러운 입력이 미스가 되던 문제).
   */
  min_len_gate_ratio: number;
}

export const DEFAULT_ENGINE_CONFIG: GestureEngineConfig = {
  min_points: 12,
  resample_n: 64,
  noise_min_dist: 0.003,
  rdp_epsilon: 0.055,
  corner_merge_deg: 25,
  min_segment_len: 0.08,
  loop_close_ratio: 0.35,
  loop_min_turn_deg: 270,
  success_threshold: 85,
  candidate_threshold: 70,
  tolerance_scale: 1.0,
  min_len_gate_ratio: 0.5,
};

/** Point Buffer 설정. */
export interface PointBufferConfig {
  maxPoints: number;
}

export const DEFAULT_POINT_BUFFER_CONFIG: PointBufferConfig = {
  maxPoints: 512,
};
