// 순수 기하 유틸(DOM 비의존). M0 검증분과 동일 semantics.
import type { Pt } from './types';

export function pathLength(pts: Pt[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}
export function bbox(pts: Pt[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
export function resample(pts: Pt[], n: number): Pt[] {
  if (pts.length < 2) return pts.slice();
  const total = pathLength(pts);
  const step = total / (n - 1);
  const out: Pt[] = [pts[0]];
  let acc = 0, i = 1, prev = pts[0];
  while (out.length < n && i < pts.length) {
    const d = Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y);
    if (acc + d >= step && d > 1e-9) {
      const t = (step - acc) / d;
      const np: Pt = { x: prev.x + t * (pts[i].x - prev.x), y: prev.y + t * (pts[i].y - prev.y) };
      out.push(np); prev = np; acc = 0;
    } else { acc += d; prev = pts[i]; i++; }
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
}
// 크기 정규화(회전 비정규화 — 방향이 획의 정체성). FR-JDG-002.
export function normalize(pts: Pt[]): Pt[] {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  const t = pts.map(p => ({ x: p.x - cx, y: p.y - cy }));
  const b = bbox(t);
  const diag = Math.hypot(b.w, b.h) || 1;
  return t.map(p => ({ x: p.x / diag, y: p.y / diag }));
}
export function meanDist(a: Pt[], b: Pt[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return s / a.length;
}
export function mirrorPoints(pts: Pt[]): Pt[] { return pts.map(p => ({ x: -p.x, y: p.y, t: p.t })); }
