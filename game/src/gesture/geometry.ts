// GES-02~05 공용 기하 유틸 — Normalize / Noise Filter / Resample / RDP / 방향.
// 전부 순수 함수, 결정론 (Gesture Algorithm Spec v2.8).
import type { Dir8, GesturePoint } from './types.ts';
import { ALL_DIR8, DIR8_ANGLE } from './types.ts';

export interface Viewport {
  w: number;
  h: number;
}

/**
 * GES-02 Normalize: px → 화면높이 단위.
 * x,y를 동일 스칼라(viewport.h)로 나눠 **각도를 보존**한다
 * (x/w, y/h로 나누면 종횡비에 따라 방향이 왜곡됨 — 오인식 원인).
 */
export function normalizeByViewport(pts: GesturePoint[], vp: Viewport): GesturePoint[] {
  const s = vp.h > 0 ? vp.h : 1;
  return pts.map((p) => ({ x: p.x / s, y: p.y / s, t: p.t }));
}

/** GES-03 Noise Filter: 미세 이동(손떨림)·중복 좌표 제거. 첫/끝 점은 보존. */
export function noiseFilter(pts: GesturePoint[], minDist: number): GesturePoint[] {
  if (pts.length === 0) return [];
  const first = pts[0]!;
  const out: GesturePoint[] = [first];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i]!;
    const prev = out[out.length - 1]!;
    if (Math.hypot(p.x - prev.x, p.y - prev.y) >= minDist) out.push(p);
  }
  const last = pts[pts.length - 1]!;
  const kept = out[out.length - 1]!;
  if (out.length > 1 && (kept.x !== last.x || kept.y !== last.y)) out.push(last);
  else if (out.length === 1 && pts.length > 1) out.push(last);
  return out;
}

/** 궤적 총 길이. */
export function pathLength(pts: GesturePoint[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** GES-04 Resample: 호 길이 기준 균일 n점으로 재표본 (v2.8 §5 — 기본 64). */
export function resample(pts: GesturePoint[], n: number): GesturePoint[] {
  if (pts.length === 0 || n <= 0) return [];
  if (pts.length === 1) {
    const p = pts[0]!;
    return Array.from({ length: n }, () => ({ ...p }));
  }
  const total = pathLength(pts);
  if (total === 0) {
    const p = pts[0]!;
    return Array.from({ length: n }, () => ({ ...p }));
  }
  const interval = total / (n - 1);
  const out: GesturePoint[] = [{ ...pts[0]! }];
  let acc = 0;
  let i = 1;
  let prev = pts[0]!;
  while (i < pts.length && out.length < n) {
    const cur = pts[i]!;
    const d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (acc + d >= interval && d > 0) {
      const ratio = (interval - acc) / d;
      const nx = prev.x + ratio * (cur.x - prev.x);
      const ny = prev.y + ratio * (cur.y - prev.y);
      const nt = prev.t + ratio * (cur.t - prev.t);
      const np = { x: nx, y: ny, t: nt };
      out.push(np);
      prev = np;
      acc = 0;
    } else {
      acc += d;
      prev = cur;
      i++;
    }
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1]! });
  return out;
}

/** 점-선분 수직 거리. */
function perpDist(p: GesturePoint, a: GesturePoint, b: GesturePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/** GES-05a Ramer–Douglas–Peucker 단순화 — 코너 추출 (결정론·표준 알고리즘). */
export function rdp(pts: GesturePoint[], epsilon: number): GesturePoint[] {
  if (pts.length < 3) return pts.slice();
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  let maxD = -1;
  let idx = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i]!, first, last);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD > epsilon && idx > 0) {
    const left = rdp(pts.slice(0, idx + 1), epsilon);
    const right = rdp(pts.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

/** 각도(도, 0~360). 화면 좌표계 y-down: E=0, S=90, W=180, N=270. */
export function angleDeg(from: GesturePoint, to: GesturePoint): number {
  const a = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return (a + 360) % 360;
}

/** 두 각도의 원형 차이 (0~180). */
export function angularDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** 각도 → 8방향 양자화. */
export function quantizeDir(deg: number): Dir8 {
  let best: Dir8 = 'E';
  let bestDiff = Infinity;
  for (const dir of ALL_DIR8) {
    const diff = angularDiff(deg, DIR8_ANGLE[dir]);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = dir;
    }
  }
  return best;
}

export interface Segment {
  from: GesturePoint;
  to: GesturePoint;
  angle: number; // 도
  dir: Dir8;
  len: number;
}

/**
 * GES-05b: RDP 정점 → 세그먼트 목록.
 * - 인접 세그먼트가 mergeDeg 미만 차이면 병합 (곡선 관용).
 * - 전체 길이 대비 minSegRatio 미만의 짧은 세그먼트는 제거 (스파이크 제거).
 */
export function buildSegments(
  vertices: GesturePoint[],
  mergeDeg: number,
  minSegRatio: number,
): Segment[] {
  const raw: Segment[] = [];
  for (let i = 1; i < vertices.length; i++) {
    const from = vertices[i - 1]!;
    const to = vertices[i]!;
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len === 0) continue;
    const angle = angleDeg(from, to);
    raw.push({ from, to, angle, dir: quantizeDir(angle), len });
  }
  if (raw.length === 0) return [];
  // 병합: 각도 차 작으면 하나의 세그먼트로
  const merged: Segment[] = [raw[0]!];
  for (let i = 1; i < raw.length; i++) {
    const cur = raw[i]!;
    const prev = merged[merged.length - 1]!;
    if (angularDiff(cur.angle, prev.angle) < mergeDeg) {
      const from = prev.from;
      const to = cur.to;
      const len = prev.len + cur.len; // 호 길이 유지 (방향 가중 평균용)
      const angle =
        (prev.angle * prev.len + cur.angle * cur.len) / (prev.len + cur.len);
      merged[merged.length - 1] = {
        from,
        to,
        angle: ((angle % 360) + 360) % 360,
        dir: quantizeDir(angle),
        len,
      };
    } else {
      merged.push(cur);
    }
  }
  // 짧은 스파이크 제거
  const total = merged.reduce((s, x) => s + x.len, 0);
  const filtered = merged.filter((s) => s.len >= total * minSegRatio);
  return filtered.length > 0 ? filtered : merged;
}

/**
 * 방향 급반전(되돌아 긋기) 지점 검출 — RDP는 일직선 왕복을 감지하지 못한다
 * (발도술 W→E가 횡베기로 오인되는 원인, Bible §6 충돌 매트릭스).
 * 반환: 반전이 일어난 점 인덱스 목록.
 */
export function splitByReversal(pts: GesturePoint[], reversalDeg = 120): number[] {
  const idx: number[] = [];
  let prevAngle: number | null = null;
  let lastSplit = -3;
  for (let i = 1; i < pts.length; i++) {
    const step = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
    if (step === 0) continue;
    const a = angleDeg(pts[i - 1]!, pts[i]!);
    if (prevAngle !== null && angularDiff(a, prevAngle) >= reversalDeg && i - 1 - lastSplit > 2) {
      idx.push(i - 1);
      lastSplit = i - 1;
    }
    prevAngle = a;
  }
  return idx;
}

/** 총 서명 회전각(도) — 폐곡선(loop) 판정용. 시계방향(y-down) 양수. */
export function totalTurnDeg(pts: GesturePoint[]): number {
  let sum = 0;
  for (let i = 2; i < pts.length; i++) {
    const a1 = angleDeg(pts[i - 2]!, pts[i - 1]!);
    const a2 = angleDeg(pts[i - 1]!, pts[i]!);
    let d = a2 - a1;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    sum += d;
  }
  return sum;
}

/** 경계 상자. */
export function bbox(pts: GesturePoint[]): { w: number; h: number; size: number } {
  if (pts.length === 0) return { w: 0, h: 0, size: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return { w, h, size: Math.max(w, h) };
}

/** 단위 상자 정규화 (종횡비 보존, 중심 정렬) — Shape 비교용. */
export function toUnitBox(pts: GesturePoint[]): GesturePoint[] {
  const { size } = bbox(pts);
  if (size === 0) return pts.map((p) => ({ x: 0.5, y: 0.5, t: p.t }));
  let minX = Infinity;
  let minY = Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  }
  const { w, h } = bbox(pts);
  const ox = (1 - w / size) / 2;
  const oy = (1 - h / size) / 2;
  return pts.map((p) => ({
    x: (p.x - minX) / size + ox,
    y: (p.y - minY) / size + oy,
    t: p.t,
  }));
}
