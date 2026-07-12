// INP-03: Device Adapters — DOM 이벤트 → RawInputEvent 변환 (유일한 DOM 접점).
// INP-13: Recorder/Replayer — 결정론 리플레이.
import type { DeviceType, RawInputEvent, RawEventType } from './types.ts';
import type { IClock } from './core.ts';
import type { InputManager } from './manager.ts';

/** sequence_id 발급기 — 어댑터들이 공유해 전역 단조 증가 보장. */
export class SequenceSource {
  private seq = 0;
  next(): number {
    return this.seq++;
  }
}

interface DomPointerEventLike {
  pointerId: number;
  clientX: number;
  clientY: number;
  pointerType: string; // 'mouse' | 'touch' | 'pen'
  target?: unknown;
}

interface DomKeyboardEventLike {
  key: string;
  repeat?: boolean;
}

/**
 * Pointer Events 기반 어댑터. touch/mouse 이벤트는 직접 쓰지 않는다 (장치 통합).
 * attach(el)는 브라우저에서만 호출 — 테스트는 handle* 메서드에 fake 이벤트 주입.
 */
export class PointerAdapter {
  private mgr: InputManager;
  private clock: IClock;
  private seq: SequenceSource;
  private isOverUi: (target: unknown) => boolean;

  constructor(
    mgr: InputManager,
    clock: IClock,
    seq: SequenceSource,
    isOverUi: (target: unknown) => boolean = () => false,
  ) {
    this.mgr = mgr;
    this.clock = clock;
    this.seq = seq;
    this.isOverUi = isOverUi;
  }

  private emit(type: RawEventType, e: DomPointerEventLike): void {
    const device: DeviceType = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    this.mgr.push({
      type,
      pointer_id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      key: '',
      timestamp_ms: this.clock.now(),
      sequence_id: this.seq.next(),
      device,
      is_over_ui: this.isOverUi(e.target),
    });
  }

  handleDown(e: DomPointerEventLike): void {
    this.emit('pointer_down', e);
  }
  handleMove(e: DomPointerEventLike): void {
    this.emit('pointer_move', e);
  }
  handleUp(e: DomPointerEventLike): void {
    this.emit('pointer_up', e);
  }
  handleCancel(e: DomPointerEventLike): void {
    this.emit('pointer_cancel', e);
  }

  /** 브라우저 전용: 실제 DOM 요소에 연결. (Phaser 씬에서 호출 — ITG-02) */
  attach(el: {
    addEventListener(type: string, fn: (e: Event) => void): void;
    style?: { touchAction?: string };
  }): void {
    if (el.style) el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => this.handleDown(e as unknown as DomPointerEventLike));
    el.addEventListener('pointermove', (e) => this.handleMove(e as unknown as DomPointerEventLike));
    el.addEventListener('pointerup', (e) => this.handleUp(e as unknown as DomPointerEventLike));
    el.addEventListener('pointercancel', (e) => this.handleCancel(e as unknown as DomPointerEventLike));
  }
}

export class KeyboardAdapter {
  private mgr: InputManager;
  private clock: IClock;
  private seq: SequenceSource;

  constructor(mgr: InputManager, clock: IClock, seq: SequenceSource) {
    this.mgr = mgr;
    this.clock = clock;
    this.seq = seq;
  }

  private emit(type: 'key_down' | 'key_up', key: string): void {
    this.mgr.push({
      type,
      pointer_id: -1,
      x: 0,
      y: 0,
      key: key.toLowerCase(),
      timestamp_ms: this.clock.now(),
      sequence_id: this.seq.next(),
      device: 'keyboard',
      is_over_ui: false,
    });
  }

  handleKeyDown(e: DomKeyboardEventLike): void {
    if (e.repeat) return; // 키 리핏 무시 (프로토타입 교훈 — 2단 점프 오발)
    this.emit('key_down', e.key);
  }

  handleKeyUp(e: DomKeyboardEventLike): void {
    this.emit('key_up', e.key);
  }

  attach(target: { addEventListener(type: string, fn: (e: Event) => void): void }): void {
    target.addEventListener('keydown', (e) => this.handleKeyDown(e as unknown as DomKeyboardEventLike));
    target.addEventListener('keyup', (e) => this.handleKeyUp(e as unknown as DomKeyboardEventLike));
  }
}

/** 생명주기 어댑터: blur/visibilitychange → focus_lost (TC-130/131). */
export class LifecycleAdapter {
  private mgr: InputManager;
  private clock: IClock;
  private seq: SequenceSource;

  constructor(mgr: InputManager, clock: IClock, seq: SequenceSource) {
    this.mgr = mgr;
    this.clock = clock;
    this.seq = seq;
  }

  handleFocusLost(): void {
    this.mgr.push({
      type: 'focus_lost',
      pointer_id: -1,
      x: 0,
      y: 0,
      key: '',
      timestamp_ms: this.clock.now(),
      sequence_id: this.seq.next(),
      device: 'keyboard',
      is_over_ui: false,
    });
  }

  attach(win: { addEventListener(type: string, fn: () => void): void }, doc?: { addEventListener(type: string, fn: () => void): void; hidden?: boolean }): void {
    win.addEventListener('blur', () => this.handleFocusLost());
    doc?.addEventListener('visibilitychange', () => {
      if (doc.hidden) this.handleFocusLost();
    });
  }
}

/** INP-13: Raw 이벤트 녹화/재생 — 황금 리플레이 회귀(QA-02)의 기반. */
export class RawEventRecorder {
  private events: RawInputEvent[] = [];

  tap(mgr: InputManager): InputManager {
    const orig = mgr.push.bind(mgr);
    mgr.push = (e: RawInputEvent) => {
      this.events.push({ ...e });
      orig(e);
    };
    return mgr;
  }

  record(e: RawInputEvent): void {
    this.events.push({ ...e });
  }

  dump(): RawInputEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  clear(): void {
    this.events.length = 0;
  }
}

/** 녹화본을 매니저에 재주입. 프레임 경계는 frameMs 간격으로 update() 호출. */
export function replay(
  events: RawInputEvent[],
  mgr: InputManager,
  advance: (toMs: number) => void,
  frameMs = 16,
): void {
  if (events.length === 0) {
    mgr.update();
    return;
  }
  let frameEnd = events[0]!.timestamp_ms + frameMs;
  for (const e of events) {
    while (e.timestamp_ms >= frameEnd) {
      advance(frameEnd);
      mgr.update();
      frameEnd += frameMs;
    }
    advance(e.timestamp_ms);
    mgr.push({ ...e });
  }
  advance(frameEnd);
  mgr.update();
}
