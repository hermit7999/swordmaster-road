// GES-01: Point Buffer — 터치 좌표·timestamp·멀티터치 ID 저장.
// 규격: AI Task Spec Gesture(v3.0) TASK-001. 풀링으로 GC 최소화 (Input Spec §19).
import type { GesturePoint, PointerId, PointBufferConfig } from './types.ts';
import { DEFAULT_POINT_BUFFER_CONFIG } from './types.ts';

/**
 * 단일 제스처 세션의 점 버퍼.
 * - 용량 초과 시 이후 점은 버린다 (크래시 금지, overflow 플래그 기록).
 * - timestamp는 단조 증가를 강제한다 (역행 시 직전 값으로 클램프 — 결정론).
 */
export class PointBuffer {
  private pts: GesturePoint[] = [];
  private cfg: PointBufferConfig;
  private _overflowed = false;

  constructor(cfg: PointBufferConfig = DEFAULT_POINT_BUFFER_CONFIG) {
    this.cfg = cfg;
  }

  add(x: number, y: number, t: number): boolean {
    if (this.pts.length >= this.cfg.maxPoints) {
      this._overflowed = true;
      return false;
    }
    const last = this.pts[this.pts.length - 1];
    const clampedT = last !== undefined && t < last.t ? last.t : t;
    this.pts.push({ x, y, t: clampedT });
    return true;
  }

  get length(): number {
    return this.pts.length;
  }

  get overflowed(): boolean {
    return this._overflowed;
  }

  at(i: number): GesturePoint | undefined {
    return this.pts[i];
  }

  /** 방어적 복사본 반환 (외부 변조 방지). */
  toArray(): GesturePoint[] {
    return this.pts.map((p) => ({ ...p }));
  }

  /** 입력 시작~끝 경과 ms. 점이 2개 미만이면 0. */
  elapsedMs(): number {
    if (this.pts.length < 2) return 0;
    const first = this.pts[0];
    const last = this.pts[this.pts.length - 1];
    return first && last ? last.t - first.t : 0;
  }

  clear(): void {
    this.pts.length = 0;
    this._overflowed = false;
  }
}

/**
 * 멀티터치 대응: pointer_id별 독립 버퍼 관리.
 * 동시 제스처는 1개 원칙(INP 소유권이 보장)이지만, 버퍼 계층은 방어적으로 다중 지원.
 */
export class PointBufferRegistry {
  private buffers = new Map<PointerId, PointBuffer>();
  private cfg: PointBufferConfig;

  constructor(cfg: PointBufferConfig = DEFAULT_POINT_BUFFER_CONFIG) {
    this.cfg = cfg;
  }

  begin(id: PointerId, x: number, y: number, t: number): void {
    const buf = new PointBuffer(this.cfg);
    buf.add(x, y, t);
    this.buffers.set(id, buf);
  }

  /** 미시작 pointer의 append는 무시하고 false 반환 (INPUT-002 대응 — 크래시 금지). */
  append(id: PointerId, x: number, y: number, t: number): boolean {
    const buf = this.buffers.get(id);
    if (!buf) return false;
    return buf.add(x, y, t);
  }

  /** 종료: 점 배열 반환 후 버퍼 제거. 미시작이면 null. */
  end(id: PointerId): GesturePoint[] | null {
    const buf = this.buffers.get(id);
    if (!buf) return null;
    const pts = buf.toArray();
    this.buffers.delete(id);
    return pts;
  }

  cancel(id: PointerId): void {
    this.buffers.delete(id);
  }

  cancelAll(): void {
    this.buffers.clear();
  }

  has(id: PointerId): boolean {
    return this.buffers.has(id);
  }

  get(id: PointerId): PointBuffer | undefined {
    return this.buffers.get(id);
  }

  get activeCount(): number {
    return this.buffers.size;
  }
}
