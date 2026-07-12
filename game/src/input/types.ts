// INP-01: 입력 계층 공통 타입 + InputConfig — Input System Spec(v3.4) §4/§11/§15/§16.
// 순수 TS. enum 금지 (strip-types 호환).
import type { PointerId } from '../gesture/types.ts';

export type DeviceType = 'keyboard' | 'mouse' | 'touch';

export type RawEventType =
  | 'pointer_down' | 'pointer_move' | 'pointer_up' | 'pointer_cancel'
  | 'key_down' | 'key_up'
  | 'focus_lost' | 'focus_gained';

/** Device Adapter가 발행하는 공통 원시 이벤트 (v3.4 §4.1). */
export interface RawInputEvent {
  type: RawEventType;
  pointer_id: PointerId;      // 키/포커스 이벤트는 -1
  x: number;                  // px (pointer 계열만 유효)
  y: number;
  key: string;                // key 계열만 유효 ('w','a','s','d','arrowup',' ',…)
  timestamp_ms: number;       // monotonic
  sequence_id: number;        // 단조 증가
  device: DeviceType;
  is_over_ui: boolean;
}

export interface MoveCommand {
  x: number; // -1..1
  y: number;
  magnitude: number;
  device: DeviceType;
}

export type PointerOwner = 'unowned' | 'ui' | 'movement' | 'gesture' | 'dodge';

export type InputContext =
  | 'gameplay_field' | 'gameplay_duel' | 'tutorial'
  | 'menu' | 'pause' | 'dialogue' | 'cutscene' | 'result' | 'debug';

export const GAMEPLAY_CONTEXTS: readonly InputContext[] = ['gameplay_field', 'gameplay_duel', 'tutorial'];

export type CommandType = 'skill' | 'dodge' | 'parry';

export type BufferedState = 'pending' | 'consumed' | 'expired' | 'rejected' | 'canceled';

export interface BufferedCommand {
  command_id: number;
  type: CommandType;
  payload: unknown;
  created_at_ms: number;
  expires_at_ms: number;
  priority: number;
  source_sequence_id: number;
  state: BufferedState;
}

/** 입력 우선순위 상수 (v3.4 §11). */
export const PRIORITY = {
  system: 100, ui: 90, cancel: 80, dodge: 70, gesture: 60, movement: 50, debug: 10,
} as const;

/** 오류 코드 (v3.4 §16). */
export const INPUT_ERR = {
  PointerOwnerConflict: 'INPUT-001',
  UnknownPointerMove: 'INPUT-002',
  UnknownPointerRelease: 'INPUT-003',
  GestureAlreadyActive: 'INPUT-004',
  InvalidContextTransition: 'INPUT-005',
  DuplicateSequence: 'INPUT-006',
  CommandBufferOverflow: 'INPUT-007',
  DeviceStateMismatch: 'INPUT-008',
  InvalidConfig: 'INPUT-009',
  CancelRecoveryFailed: 'INPUT-010',
} as const;

/** InputConfig (v3.4 §15) — 검증 실패 시 안전 기본값 + INPUT-009 로그. */
export interface InputConfig {
  version: number;
  regions: {
    movement_end_x: number;  // 0..1 (화면 폭 비율)
    gesture_start_x: number;
  };
  movement: {
    dead_zone: number;
    full_input_radius: number; // px가 아닌 화면높이 단위
  };
  gesture: {
    min_points: number;
    max_duration_ms: number;
  };
  buffer_ms: {
    skill: number;
    dodge: number;
    parry: number;
  };
  limits: {
    max_simultaneous_pointers: number;
    command_buffer_capacity: number;
  };
}

export const DEFAULT_INPUT_CONFIG: InputConfig = {
  version: 1,
  regions: { movement_end_x: 0.4, gesture_start_x: 0.5 },
  movement: { dead_zone: 0.15, full_input_radius: 0.9 },
  gesture: { min_points: 12, max_duration_ms: 1200 },
  buffer_ms: { skill: 120, dodge: 100, parry: 80 },
  limits: { max_simultaneous_pointers: 5, command_buffer_capacity: 16 },
};

/** Config 검증: 범위 밖 값은 기본값으로 대체하고 오류 목록 반환. */
export function validateInputConfig(cfg: Partial<InputConfig>): { config: InputConfig; errors: string[] } {
  const errors: string[] = [];
  const d = DEFAULT_INPUT_CONFIG;
  const out: InputConfig = JSON.parse(JSON.stringify(d));
  const num = (v: unknown, lo: number, hi: number, fallback: number, path: string): number => {
    if (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi) return v;
    if (v !== undefined) errors.push(`${INPUT_ERR.InvalidConfig}:${path}`);
    return fallback;
  };
  out.regions.movement_end_x = num(cfg.regions?.movement_end_x, 0.1, 0.9, d.regions.movement_end_x, 'regions.movement_end_x');
  out.regions.gesture_start_x = num(cfg.regions?.gesture_start_x, 0.1, 0.9, d.regions.gesture_start_x, 'regions.gesture_start_x');
  if (out.regions.gesture_start_x < out.regions.movement_end_x) {
    errors.push(`${INPUT_ERR.InvalidConfig}:regions.order`);
    out.regions.movement_end_x = d.regions.movement_end_x;
    out.regions.gesture_start_x = d.regions.gesture_start_x;
  }
  out.movement.dead_zone = num(cfg.movement?.dead_zone, 0, 0.5, d.movement.dead_zone, 'movement.dead_zone');
  out.movement.full_input_radius = num(cfg.movement?.full_input_radius, 0.1, 2, d.movement.full_input_radius, 'movement.full_input_radius');
  out.gesture.min_points = num(cfg.gesture?.min_points, 3, 64, d.gesture.min_points, 'gesture.min_points');
  out.gesture.max_duration_ms = num(cfg.gesture?.max_duration_ms, 200, 5000, d.gesture.max_duration_ms, 'gesture.max_duration_ms');
  out.buffer_ms.skill = num(cfg.buffer_ms?.skill, 0, 1000, d.buffer_ms.skill, 'buffer_ms.skill');
  out.buffer_ms.dodge = num(cfg.buffer_ms?.dodge, 0, 1000, d.buffer_ms.dodge, 'buffer_ms.dodge');
  out.buffer_ms.parry = num(cfg.buffer_ms?.parry, 0, 1000, d.buffer_ms.parry, 'buffer_ms.parry');
  out.limits.max_simultaneous_pointers = num(cfg.limits?.max_simultaneous_pointers, 1, 10, d.limits.max_simultaneous_pointers, 'limits.max_simultaneous_pointers');
  out.limits.command_buffer_capacity = num(cfg.limits?.command_buffer_capacity, 1, 64, d.limits.command_buffer_capacity, 'limits.command_buffer_capacity');
  return { config: out, errors };
}

/** 발행 이벤트 타입 (v3.4 §13 순서 준수). */
export type InputEventName =
  | 'before_context_change' | 'context_changed'
  | 'before_input_cancel' | 'after_input_cancel'
  | 'gesture_started' | 'gesture_updated' | 'gesture_ended' | 'gesture_canceled'
  | 'dodge_requested'
  | 'move_changed'
  | 'device_changed'
  | 'buffer_expired'
  | 'input_error';

export interface InputEvent {
  name: InputEventName;
  data: unknown;
  timestamp_ms: number;
}
