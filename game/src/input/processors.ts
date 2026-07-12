// INP-07/08/09: Movement + GestureCollector + Dodge/CommandBuffer.
import type { GesturePoint, PointerId } from '../gesture/types.ts';
import { PointBufferRegistry } from '../gesture/pointBuffer.ts';
import type {
  BufferedCommand, CommandType, DeviceType, InputConfig, MoveCommand,
} from './types.ts';
import { INPUT_ERR, PRIORITY } from './types.ts';

/** INP-07 이동: 키보드 + 터치 가상 스틱. 최근 활성 장치 우선 (v3.4 §8.3). */
export class MovementProcessor {
  private keys = new Set<string>();
  private stickOrigin: { x: number; y: number } | null = null;
  private stickVec = { x: 0, y: 0, mag: 0 };
  private stickPointer: PointerId | null = null;
  private lastDevice: DeviceType = 'keyboard';
  private cfg: InputConfig;
  private viewportH: number;

  constructor(cfg: InputConfig, viewportH: number) {
    this.cfg = cfg;
    this.viewportH = viewportH;
  }

  setViewportH(h: number): void {
    this.viewportH = h;
  }

  keyDown(key: string): void {
    this.keys.add(key);
    this.lastDevice = 'keyboard';
  }

  keyUp(key: string): void {
    this.keys.delete(key);
  }

  stickDown(id: PointerId, x: number, y: number): void {
    this.stickPointer = id;
    this.stickOrigin = { x, y };
    this.stickVec = { x: 0, y: 0, mag: 0 };
    this.lastDevice = 'touch';
  }

  stickMove(id: PointerId, x: number, y: number): void {
    if (this.stickPointer !== id || !this.stickOrigin) return;
    const s = this.viewportH || 1;
    const dx = (x - this.stickOrigin.x) / s;
    const dy = (y - this.stickOrigin.y) / s;
    const dist = Math.hypot(dx, dy);
    const dz = this.cfg.movement.dead_zone * this.cfg.movement.full_input_radius;
    if (dist < dz) {
      this.stickVec = { x: 0, y: 0, mag: 0 };
      return;
    }
    const full = this.cfg.movement.full_input_radius;
    const mag = Math.min(1, (dist - dz) / (full - dz));
    this.stickVec = { x: (dx / dist) * mag, y: (dy / dist) * mag, mag };
    this.lastDevice = 'touch';
  }

  stickUp(id: PointerId): void {
    if (this.stickPointer !== id) return;
    this.stickPointer = null;
    this.stickOrigin = null;
    this.stickVec = { x: 0, y: 0, mag: 0 };
  }

  private keyboardVec(): { x: number; y: number } {
    const k = this.keys;
    const x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    const y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) return { x: x / len, y: y / len };
    return { x, y };
  }

  /** 결합 규칙: 최근 활성 장치 사용, 합산 금지. */
  current(): MoveCommand {
    if (this.lastDevice === 'touch' && this.stickPointer !== null) {
      return { x: this.stickVec.x, y: this.stickVec.y, magnitude: this.stickVec.mag, device: 'touch' };
    }
    const v = this.keyboardVec();
    const mag = Math.hypot(v.x, v.y);
    return { x: v.x, y: v.y, magnitude: Math.min(1, mag), device: 'keyboard' };
  }

  get activeStickPointer(): PointerId | null {
    return this.stickPointer;
  }

  reset(): void {
    this.keys.clear();
    this.stickPointer = null;
    this.stickOrigin = null;
    this.stickVec = { x: 0, y: 0, mag: 0 };
  }
}

export type GestureCancelReason =
  | 'context_change' | 'focus_lost' | 'pointer_cancel' | 'max_duration' | 'too_few_points' | 'cancel_all';

export interface CompletedGesture {
  points: GesturePoint[];
  pointer_id: PointerId;
}

/** INP-08 제스처 수집기 — 동시 1세션 원칙 (v3.4 §9). */
export class GestureCollector {
  private registry = new PointBufferRegistry();
  private activePointer: PointerId | null = null;
  private startedAt = 0;
  private cfg: InputConfig;
  private errors: string[] = [];

  constructor(cfg: InputConfig) {
    this.cfg = cfg;
  }

  get active(): boolean {
    return this.activePointer !== null;
  }

  get activePointerId(): PointerId | null {
    return this.activePointer;
  }

  /** 시작 시도. 이미 활성이면 INPUT-004. */
  tryStart(id: PointerId, x: number, y: number, t: number): boolean {
    if (this.activePointer !== null) {
      this.errors.push(`${INPUT_ERR.GestureAlreadyActive}:${id}`);
      return false;
    }
    this.registry.begin(id, x, y, t);
    this.activePointer = id;
    this.startedAt = t;
    return true;
  }

  /** 갱신. max_duration 초과 시 취소 사유 반환. */
  update(id: PointerId, x: number, y: number, t: number): GestureCancelReason | null {
    if (this.activePointer !== id) return null;
    if (t - this.startedAt > this.cfg.gesture.max_duration_ms) {
      this.cancel('max_duration');
      return 'max_duration';
    }
    this.registry.append(id, x, y, t);
    return null;
  }

  /** 종료: 점 수 미달이면 취소 사유, 정상이면 완성 제스처 반환. */
  end(id: PointerId): { done?: CompletedGesture; canceled?: GestureCancelReason } {
    if (this.activePointer !== id) return {};
    const pts = this.registry.end(id);
    this.activePointer = null;
    if (!pts || pts.length < this.cfg.gesture.min_points) {
      return { canceled: 'too_few_points' };
    }
    return { done: { points: pts, pointer_id: id } };
  }

  cancel(_reason: GestureCancelReason): void {
    if (this.activePointer !== null) {
      this.registry.cancel(this.activePointer);
      this.activePointer = null;
    }
  }

  drainErrors(): string[] {
    const e = this.errors.slice();
    this.errors.length = 0;
    return e;
  }
}

/** INP-09 Command Buffer (v3.4 §10). */
export class CommandBuffer {
  private items: BufferedCommand[] = [];
  private nextId = 1;
  private seen = new Set<number>();
  private capacity: number;
  private errors: string[] = [];
  private expiredLog: BufferedCommand[] = [];

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  enqueue(
    type: CommandType,
    payload: unknown,
    now: number,
    ttlMs: number,
    sourceSeq: number,
  ): BufferedCommand | null {
    this.expire(now);
    if (this.seen.has(sourceSeq)) {
      this.errors.push(`${INPUT_ERR.DuplicateSequence}:${sourceSeq}`);
      return null;
    }
    if (this.items.length >= this.capacity) {
      // 최저 우선순위·최고령 제거
      let victim = 0;
      for (let i = 1; i < this.items.length; i++) {
        const a = this.items[i]!;
        const v = this.items[victim]!;
        if (a.priority < v.priority || (a.priority === v.priority && a.created_at_ms < v.created_at_ms)) {
          victim = i;
        }
      }
      this.items.splice(victim, 1);
      this.errors.push(`${INPUT_ERR.CommandBufferOverflow}`);
    }
    const priority = type === 'dodge' ? PRIORITY.dodge : PRIORITY.gesture;
    const cmd: BufferedCommand = {
      command_id: this.nextId++,
      type,
      payload,
      created_at_ms: now,
      expires_at_ms: now + ttlMs,
      priority,
      source_sequence_id: sourceSeq,
      state: 'pending',
    };
    this.items.push(cmd);
    this.seen.add(sourceSeq);
    return cmd;
  }

  expire(now: number): BufferedCommand[] {
    const expired: BufferedCommand[] = [];
    this.items = this.items.filter((c) => {
      if (now >= c.expires_at_ms) {
        c.state = 'expired';
        expired.push(c);
        return false;
      }
      return true;
    });
    this.expiredLog.push(...expired);
    return expired;
  }

  /** 우선순위 내림차순 → 생성 오름차순으로 소비 시도 (v3.4 §10.2). */
  tryConsume(
    now: number,
    canExecute: (c: BufferedCommand) => 'ok' | 'blocked' | 'rejected',
  ): BufferedCommand | null {
    this.expire(now);
    const sorted = [...this.items].sort(
      (a, b) => b.priority - a.priority || a.created_at_ms - b.created_at_ms,
    );
    for (const c of sorted) {
      const r = canExecute(c);
      if (r === 'ok') {
        c.state = 'consumed';
        this.items = this.items.filter((x) => x !== c);
        return c;
      }
      if (r === 'rejected') {
        c.state = 'rejected';
        this.items = this.items.filter((x) => x !== c);
      }
    }
    return null;
  }

  cancelAll(): void {
    for (const c of this.items) c.state = 'canceled';
    this.items.length = 0;
  }

  get size(): number {
    return this.items.length;
  }

  drainErrors(): string[] {
    const e = this.errors.slice();
    this.errors.length = 0;
    return e;
  }

  drainExpired(): BufferedCommand[] {
    const e = this.expiredLog.slice();
    this.expiredLog.length = 0;
    return e;
  }
}
