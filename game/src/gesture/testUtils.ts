// 테스트용 합성 획 생성기 (결정론 — Math.random 미사용).
import type { GesturePoint } from './types.ts';

/** 두 점 사이 직선 획 (px). n점, durMs 동안 균일 진행. */
export function line(
  x0: number, y0: number, x1: number, y1: number,
  n = 40, durMs = 300, t0 = 1000,
): GesturePoint[] {
  const pts: GesturePoint[] = [];
  for (let i = 0; i < n; i++) {
    const r = i / (n - 1);
    pts.push({ x: x0 + (x1 - x0) * r, y: y0 + (y1 - y0) * r, t: t0 + durMs * r });
  }
  return pts;
}

/** 다중 직선 연결 (코너 있는 획). 각 구간 균일 시간 분배. */
export function polyline(
  points: Array<[number, number]>, n = 60, durMs = 400, t0 = 1000,
): GesturePoint[] {
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
    segLens.push(l);
    total += l;
  }
  const pts: GesturePoint[] = [];
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    let acc = 0;
    let seg = 0;
    while (seg < segLens.length - 1 && acc + segLens[seg]! < target) {
      acc += segLens[seg]!;
      seg++;
    }
    const segLen = segLens[seg]! || 1;
    const r = Math.min(1, Math.max(0, (target - acc) / segLen));
    const a = points[seg]!;
    const b = points[seg + 1]!;
    pts.push({
      x: a[0] + (b[0] - a[0]) * r,
      y: a[1] + (b[1] - a[1]) * r,
      t: t0 + durMs * (i / (n - 1)),
    });
  }
  return pts;
}

/** 원형 획 (시계방향, y-down). */
export function circle(
  cx: number, cy: number, r: number,
  n = 64, durMs = 600, t0 = 1000, startDeg = 0, sweepDeg = 360,
): GesturePoint[] {
  const pts: GesturePoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((startDeg + (sweepDeg * i) / (n - 1)) * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), t: t0 + durMs * (i / (n - 1)) });
  }
  return pts;
}

/** 결정론적 지그재그 노이즈 획 (인식 실패용). */
export function garbage(n = 40, t0 = 1000): GesturePoint[] {
  const pts: GesturePoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = 400 + (i % 2 === 0 ? 0 : 90) + i * 3;
    const y = 300 + (i % 3) * 80 - (i % 5) * 40;
    pts.push({ x, y, t: t0 + i * 8 });
  }
  return pts;
}

export const VP = { w: 1280, h: 720 };
export const VP_HI = { w: 2560, h: 1440 };
