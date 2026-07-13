// INP-06/10/11/12: Router + CancelAll + InputManager 조립 + Debug Snapshot.
// Raw 이벤트 → (UI Gate → Context → Ownership → Processor) → Command/Event.
import type { PointerId } from '../gesture/types.ts';
import type {
  DeviceType, InputConfig, InputContext, MoveCommand, RawInputEvent,
} from './types.ts';
import { INPUT_ERR, validateInputConfig } from './types.ts';
import type { IClock } from './core.ts';
import {
  cancelPolicyFor, FakeClock, InputContextController, InputEventBus,
  PointerOwnershipRegistry,
} from './core.ts';
import type { CompletedGesture } from './processors.ts';
import { CommandBuffer, GestureCollector, MovementProcessor } from './processors.ts';

export interface Viewport {
  w: number;
  h: number;
}

export interface InputSnapshot {
  context: InputContext;
  move: MoveCommand;
  gesture_active: boolean;
  gesture_pointer: PointerId | null;
  buffer_size: number;
  owners: Array<{ pointer_id: PointerId; owner: string }>;
  last_device: DeviceType | null;
  errors: string[];
}

/** 제스처 완료 시 호출되는 인식 콜백 (Gesture Engine 연결점 — ITG-01). */
export type GestureSink = (g: CompletedGesture) => void;

export class InputManager {
  readonly bus: InputEventBus;
  readonly config: InputConfig;
  private clock: IClock;
  private viewport: Viewport;
  private ctx: InputContextController;
  private owners = new PointerOwnershipRegistry();
  private movement: MovementProcessor;
  private gesture: GestureCollector;
  readonly buffer: CommandBuffer;
  private queue: RawInputEvent[] = [];
  private lastSeq = -1;
  private lastDevice: DeviceType | null = null;
  private lastMove: MoveCommand = { x: 0, y: 0, magnitude: 0, device: 'keyboard' };
  private errorLog: string[] = [];
  private gestureSink: GestureSink | null = null;
  private configErrors: string[] = [];

  constructor(opts: {
    config?: Partial<InputConfig>;
    clock?: IClock;
    viewport?: Viewport;
    initialContext?: InputContext;
    keepEventLog?: boolean;
  } = {}) {
    const { config, errors } = validateInputConfig(opts.config ?? {});
    this.config = config;
    this.configErrors = errors;
    this.clock = opts.clock ?? new FakeClock();
    this.viewport = opts.viewport ?? { w: 1280, h: 720 };
    this.ctx = new InputContextController(opts.initialContext ?? 'gameplay_field');
    this.movement = new MovementProcessor(config, this.viewport.h);
    this.gesture = new GestureCollector(config);
    this.buffer = new CommandBuffer(config.limits.command_buffer_capacity);
    this.bus = new InputEventBus(opts.keepEventLog ?? false);
    for (const e of errors) this.bus.emit('input_error', e, this.clock.now());
  }

  get context(): InputContext {
    return this.ctx.context;
  }

  onGesture(sink: GestureSink): void {
    this.gestureSink = sink;
  }

  setViewport(vp: Viewport): void {
    this.viewport = vp;
    this.movement.setViewportH(vp.h);
    // 해상도 변경 중 제스처는 신뢰 불가 → 취소 (TC-132)
    this.cancelGesture('pointer_cancel');
  }

  /** Adapter가 호출: 원시 이벤트 큐잉. sequence 역행 방어. */
  push(e: RawInputEvent): void {
    if (e.sequence_id <= this.lastSeq) {
      this.errorLog.push(`${INPUT_ERR.DuplicateSequence}:raw:${e.sequence_id}`);
      return;
    }
    this.lastSeq = e.sequence_id;
    this.queue.push(e);
  }

  /** 프레임 업데이트 (v3.4 §5 순서): 큐 드레인 → 만료 → 이벤트. */
  update(): void {
    const now = this.clock.now();
    const q = this.queue;
    this.queue = [];
    for (const e of q) this.route(e);
    // 8. Command Buffer Expire
    for (const c of this.buffer.expire(now)) {
      this.bus.emit('buffer_expired', { command_id: c.command_id, type: c.type }, now);
    }
    // 9. Move 변화 발행
    const mv = this.movement.current();
    if (mv.x !== this.lastMove.x || mv.y !== this.lastMove.y || mv.device !== this.lastMove.device) {
      if (mv.device !== this.lastMove.device) {
        this.bus.emit('device_changed', { device: mv.device }, now);
      }
      this.lastMove = mv;
      this.bus.emit('move_changed', mv, now);
    }
    // 오류 수집
    this.errorLog.push(
      ...this.owners.drainErrors(),
      ...this.ctx.drainErrors(),
      ...this.gesture.drainErrors(),
      ...this.buffer.drainErrors(),
    );
  }

  private gameplay(): boolean {
    const c = this.ctx.context;
    return c === 'gameplay_field' || c === 'gameplay_duel' || c === 'tutorial';
  }

  private route(e: RawInputEvent): void {
    const now = e.timestamp_ms;
    switch (e.type) {
      case 'focus_lost':
        this.cancelAllInput('focus_lost');
        return;
      case 'focus_gained':
        return;
      case 'key_down': {
        if (!this.gameplay()) return;
        const k = e.key.toLowerCase();
        if (k === ' ' || k === 'space') {
          this.requestDodge(e.sequence_id, now);
        } else {
          this.movement.keyDown(k);
        }
        this.lastDevice = 'keyboard';
        return;
      }
      case 'key_up': {
        this.movement.keyUp(e.key.toLowerCase());
        return;
      }
      case 'pointer_down': {
        if (e.is_over_ui) {
          this.owners.assign(e.pointer_id, 'ui');
          return;
        }
        if (!this.gameplay()) return;
        if (this.owners.activeCount >= this.config.limits.max_simultaneous_pointers) return;
        if (e.device === 'mouse') {
          // PC 마우스 = 항상 제스처 (이동은 키보드)
          this.startGesture(e.pointer_id, e.x, e.y, now);
          return;
        }
        const ratio = e.x / (this.viewport.w || 1);
        if (ratio < this.config.regions.movement_end_x) {
          if (this.owners.assign(e.pointer_id, 'movement')) {
            this.movement.stickDown(e.pointer_id, e.x, e.y);
          }
        } else if (ratio >= this.config.regions.gesture_start_x) {
          this.startGesture(e.pointer_id, e.x, e.y, now);
        } else {
          // 완충 구간: 이동 스틱이 없으면 이동, 있으면 제스처 (결정론 규칙)
          if (this.movement.activeStickPointer === null) {
            if (this.owners.assign(e.pointer_id, 'movement')) {
              this.movement.stickDown(e.pointer_id, e.x, e.y);
            }
          } else {
            this.startGesture(e.pointer_id, e.x, e.y, now);
          }
        }
        this.lastDevice = e.device;
        return;
      }
      case 'pointer_move': {
        const owner = this.owners.get(e.pointer_id);
        if (owner === 'movement') {
          this.movement.stickMove(e.pointer_id, e.x, e.y);
        } else if (owner === 'gesture') {
          const canceled = this.gesture.update(e.pointer_id, e.x, e.y, e.timestamp_ms);
          if (canceled) {
            this.owners.release(e.pointer_id);
            this.bus.emit('gesture_canceled', { reason: canceled }, e.timestamp_ms);
          } else {
            this.bus.emit('gesture_updated', { pointer_id: e.pointer_id }, e.timestamp_ms);
          }
        } else if (owner === 'unowned') {
          this.errorLog.push(`${INPUT_ERR.UnknownPointerMove}:${e.pointer_id}`);
        }
        return;
      }
      case 'pointer_up': {
        const owner = this.owners.get(e.pointer_id);
        if (owner === 'movement') {
          this.movement.stickUp(e.pointer_id);
          this.owners.release(e.pointer_id);
        } else if (owner === 'gesture') {
          const r = this.gesture.end(e.pointer_id);
          this.owners.release(e.pointer_id);
          if (r.done) {
            this.bus.emit('gesture_ended', { pointer_id: e.pointer_id, points: r.done.points.length }, e.timestamp_ms);
            this.gestureSink?.(r.done);
          } else if (r.canceled) {
            this.bus.emit('gesture_canceled', { reason: r.canceled }, e.timestamp_ms);
          }
        } else if (owner === 'ui') {
          this.owners.release(e.pointer_id);
        } else {
          this.errorLog.push(`${INPUT_ERR.UnknownPointerRelease}:${e.pointer_id}`);
        }
        return;
      }
      case 'pointer_cancel': {
        const owner = this.owners.get(e.pointer_id);
        if (owner === 'movement') this.movement.stickUp(e.pointer_id);
        if (owner === 'gesture') {
          this.gesture.cancel('pointer_cancel');
          this.bus.emit('gesture_canceled', { reason: 'pointer_cancel' }, e.timestamp_ms);
        }
        this.owners.release(e.pointer_id);
        return;
      }
    }
  }

  private startGesture(id: PointerId, x: number, y: number, t: number): void {
    if (!this.gesture.tryStart(id, x, y, t)) return; // INPUT-004는 collector가 기록
    if (!this.owners.assign(id, 'gesture')) {
      this.gesture.cancel('pointer_cancel');
      return;
    }
    this.bus.emit('gesture_started', { pointer_id: id }, t);
  }

  private requestDodge(seq: number, now: number): void {
    const cmd = this.buffer.enqueue('dodge', { seq }, now, this.config.buffer_ms.dodge, seq);
    if (cmd) this.bus.emit('dodge_requested', { command_id: cmd.command_id }, now);
  }

  /** Context 전환 (v3.4 §7 절차). */
  changeContext(to: InputContext): boolean {
    const now = this.clock.now();
    if (!this.ctx.canTransition(to)) {
      this.ctx.transition(to); // 오류 기록용
      this.errorLog.push(...this.ctx.drainErrors());
      return false;
    }
    const from = this.ctx.context;
    this.bus.emit('before_context_change', { from, to }, now);
    const policy = cancelPolicyFor(from, to);
    if (policy === 'all') this.cancelAllInput('context_change');
    else if (policy === 'gesture_only') this.cancelGesture('context_change');
    this.ctx.transition(to);
    this.bus.emit('context_changed', { from, to }, now);
    return true;
  }

  private cancelGesture(reason: 'context_change' | 'pointer_cancel' | 'focus_lost' | 'cancel_all'): void {
    const id = this.gesture.activePointerId;
    if (id === null) return;
    this.gesture.cancel(reason);
    this.owners.release(id);
    this.bus.emit('gesture_canceled', { reason }, this.clock.now());
  }

  /** INP-10 CancelAllInput (v3.4 §12). */
  cancelAllInput(reason: string): void {
    const now = this.clock.now();
    this.bus.emit('before_input_cancel', { reason }, now);
    this.movement.reset();
    this.cancelGesture('cancel_all');
    this.buffer.cancelAll();
    this.owners.releaseAll();
    this.queue.length = 0;
    this.lastMove = { x: 0, y: 0, magnitude: 0, device: this.lastMove.device };
    this.bus.emit('after_input_cancel', { reason }, now);
  }

  /** INP-12 Debug Snapshot. */
  snapshot(): InputSnapshot {
    return {
      context: this.ctx.context,
      move: this.movement.current(),
      gesture_active: this.gesture.active,
      gesture_pointer: this.gesture.activePointerId,
      buffer_size: this.buffer.size,
      owners: this.owners.snapshot(),
      last_device: this.lastDevice,
      errors: [...this.configErrors, ...this.errorLog],
    };
  }

  drainErrors(): string[] {
    const e = this.errorLog.slice();
    this.errorLog.length = 0;
    return e;
  }
}
