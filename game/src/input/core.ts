// INP-02/04/05: IClock + EventBus + PointerOwnershipRegistry + InputContextController.
import type { PointerId } from '../gesture/types.ts';
import type { InputContext, InputEvent, InputEventName, PointerOwner } from './types.ts';
import { GAMEPLAY_CONTEXTS, INPUT_ERR } from './types.ts';

/** 시간 추상화 — 결정론 테스트용 (v3.4 §21). */
export interface IClock {
  now(): number; // monotonic ms
}

export class FakeClock implements IClock {
  private t: number;
  constructor(start = 0) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
  set(ms: number): void {
    this.t = ms;
  }
}

export function realClock(): IClock {
  // 브라우저: performance.now / Node: perf_hooks 호환
  const perf = (globalThis as { performance?: { now(): number } }).performance;
  return { now: () => (perf ? perf.now() : Date.now()) };
}

type Listener = (e: InputEvent) => void;

/** INP-02 EventBus — 구독/발행. 발행 순서는 호출 순서 보존 (동기). */
export class InputEventBus {
  private listeners = new Map<InputEventName | '*', Listener[]>();
  private log: InputEvent[] = [];
  private keepLog: boolean;

  constructor(keepLog = false) {
    this.keepLog = keepLog;
  }

  on(name: InputEventName | '*', fn: Listener): () => void {
    const arr = this.listeners.get(name) ?? [];
    arr.push(fn);
    this.listeners.set(name, arr);
    return () => {
      const a = this.listeners.get(name);
      if (a) this.listeners.set(name, a.filter((f) => f !== fn));
    };
  }

  emit(name: InputEventName, data: unknown, timestamp_ms: number): void {
    const e: InputEvent = { name, data, timestamp_ms };
    if (this.keepLog) this.log.push(e);
    for (const fn of this.listeners.get(name) ?? []) fn(e);
    for (const fn of this.listeners.get('*') ?? []) fn(e);
  }

  history(): InputEvent[] {
    return this.log.slice();
  }

  clearHistory(): void {
    this.log.length = 0;
  }
}

/** INP-04 Pointer Ownership (v3.4 §6). 금지 전이 차단 + 오류 코드. */
export class PointerOwnershipRegistry {
  private owners = new Map<PointerId, PointerOwner>();
  private errors: string[] = [];

  /** 할당. 이미 소유 중이면 INPUT-001 기록 후 false (기존 유지). */
  assign(id: PointerId, owner: Exclude<PointerOwner, 'unowned'>): boolean {
    const cur = this.owners.get(id);
    if (cur && cur !== 'unowned') {
      this.errors.push(`${INPUT_ERR.PointerOwnerConflict}:${id}:${cur}->${owner}`);
      return false;
    }
    this.owners.set(id, owner);
    return true;
  }

  get(id: PointerId): PointerOwner {
    return this.owners.get(id) ?? 'unowned';
  }

  release(id: PointerId): void {
    this.owners.delete(id);
  }

  releaseAll(): void {
    this.owners.clear();
  }

  get activeCount(): number {
    return this.owners.size;
  }

  /** 누적 오류 드레인 (테스트/로그용). */
  drainErrors(): string[] {
    const e = this.errors.slice();
    this.errors.length = 0;
    return e;
  }

  snapshot(): Array<{ pointer_id: PointerId; owner: PointerOwner }> {
    return [...this.owners.entries()].map(([pointer_id, owner]) => ({ pointer_id, owner }));
  }
}

/** 허용 전이 테이블 (v3.4 §7). '*'=어디서든 진입 가능. */
const ALLOWED: Record<InputContext, InputContext[] | '*'> = {
  gameplay_field: ['menu', 'pause', 'tutorial', 'result', 'gameplay_duel'],
  gameplay_duel: ['gameplay_field', 'pause'],
  tutorial: ['menu', 'gameplay_field'],
  menu: ['pause', 'result', 'gameplay_field', 'gameplay_duel', 'tutorial'],
  pause: ['gameplay_field', 'gameplay_duel', 'tutorial', 'menu'],
  dialogue: ['gameplay_field', 'gameplay_duel', 'tutorial'],
  cutscene: '*',
  result: ['gameplay_field', 'gameplay_duel'],
  debug: '*',
};

export type CancelPolicy = 'none' | 'gesture_only' | 'all';

/** 전환 시 취소 정책 (v3.4 §7 기본 정책). */
export function cancelPolicyFor(from: InputContext, to: InputContext): CancelPolicy {
  const fromGameplay = GAMEPLAY_CONTEXTS.includes(from);
  const toGameplay = GAMEPLAY_CONTEXTS.includes(to);
  if (fromGameplay && toGameplay) return 'gesture_only'; // 이동 유지, 제스처 취소
  if (to === 'result') return 'all';
  if (fromGameplay && !toGameplay) return 'all'; // → menu/pause/cutscene
  return 'none'; // menu→gameplay 등: 새 입력만 (기존 상태는 이미 취소됨)
}

/** INP-05 Context Controller. */
export class InputContextController {
  private current: InputContext;
  private errors: string[] = [];

  constructor(initial: InputContext = 'menu') {
    this.current = initial;
  }

  get context(): InputContext {
    return this.current;
  }

  canTransition(to: InputContext): boolean {
    if (to === this.current) return false;
    if (to === 'cutscene' || to === 'debug') return true;
    const allowed = ALLOWED[to];
    if (allowed === '*') return true;
    // 진입 규칙: 대상 컨텍스트가 아니라 "현재→대상" 허용 목록으로 검사
    const fromAllowed = ALLOWED[this.current];
    return fromAllowed === '*' || fromAllowed.includes(to);
  }

  /** 전환 시도. 성공 시 [from, to], 실패 시 null + INPUT-005 기록. */
  transition(to: InputContext): { from: InputContext; to: InputContext } | null {
    if (!this.canTransition(to)) {
      this.errors.push(`${INPUT_ERR.InvalidContextTransition}:${this.current}->${to}`);
      return null;
    }
    const from = this.current;
    this.current = to;
    return { from, to };
  }

  drainErrors(): string[] {
    const e = this.errors.slice();
    this.errors.length = 0;
    return e;
  }
}
