// GES-06/07: Pattern Matching + Score Engine.
// 총점 = Direction 50 + Shape 20 + Length 10 + Speed 10 + Corner 10 (v2.8 §8).
import type {
  CandidateScore,
  Dir8,
  GestureEngineConfig,
  GesturePoint,
  GestureTemplate,
  ScoreBreakdown,
} from './types.ts';
import { DIR8_ANGLE } from './types.ts';
import type { Segment } from './geometry.ts';
import { angularDiff, resample, toUnitBox } from './geometry.ts';

export interface PathFeatures {
  segments: Segment[];
  resampled: GesturePoint[]; // 정규화(화면높이 단위) 후 리샘플
  pathLen: number;
  elapsedMs: number;
  totalTurnDeg: number;
  closed: boolean; // 시작-끝 근접 여부
}

/** 밴드 점수: 값이 [lo, hi] 안이면 만점, 밖이면 tol 비율 내 선형 감쇠. */
function bandScore(v: number, lo: number, hi: number, tolRatio: number, max: number): number {
  if (v >= lo && v <= hi) return max;
  if (v < lo) {
    const limit = lo * (1 - tolRatio);
    if (v <= limit) return 0;
    return max * ((v - limit) / (lo - limit));
  }
  const limit = hi * (1 + tolRatio);
  if (v >= limit) return 0;
  return max * ((limit - v) / (limit - hi));
}

/** Direction 50점: 세그먼트별 각도 오차 기반 (±20°×tolerance 내 만점 감쇠). */
function directionScore(
  segs: Segment[],
  dirs: Dir8[],
  tolScale: number,
): number {
  if (dirs.length === 0 || segs.length === 0) return 0;
  // 세그먼트 수 불일치 페널티: 초과/부족 1개당 40% 감점, 2개 이상 차이면 0
  const diff = Math.abs(segs.length - dirs.length);
  if (diff >= 2) return 0;
  const countMul = diff === 1 ? 0.45 : 1.0;
  const n = Math.min(segs.length, dirs.length);
  const fullTol = 20 * tolScale; // 이 안이면 만점
  const zeroTol = 42 * tolScale; // 이 밖이면 0점
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const seg = segs[i]!;
    const want = DIR8_ANGLE[dirs[i]!];
    const err = angularDiff(seg.angle, want);
    let s: number;
    if (err <= fullTol) s = 1;
    else if (err >= zeroTol) s = 0;
    else s = 1 - (err - fullTol) / (zeroTol - fullTol);
    sum += s;
  }
  return (sum / dirs.length) * 50 * countMul;
}

/** 템플릿 dirs → 이상적 폴리라인 생성 (Shape 비교 기준). */
export function idealPolyline(dirs: Dir8[], n: number, weights?: number[]): GesturePoint[] {
  const pts: GesturePoint[] = [{ x: 0, y: 0, t: 0 }];
  let x = 0;
  let y = 0;
  for (let i = 0; i < dirs.length; i++) {
    const rad = (DIR8_ANGLE[dirs[i]!] * Math.PI) / 180;
    const w = weights?.[i] ?? 1;
    x += Math.cos(rad) * w;
    y += Math.sin(rad) * w;
    pts.push({ x, y, t: 0 });
  }
  return resample(pts, n);
}

/** Shape 20점: 단위상자 정규화 후 평균 점 거리. */
function shapeScore(resampled: GesturePoint[], ideal: GesturePoint[], tolScale: number): number {
  const a = toUnitBox(resampled);
  const b = toUnitBox(ideal);
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += Math.hypot(a[i]!.x - b[i]!.x, a[i]!.y - b[i]!.y);
  }
  const mean = sum / n;
  const zero = 0.32 * tolScale;
  return Math.max(0, 1 - mean / zero) * 20;
}

const ZERO_BREAKDOWN: ScoreBreakdown = { direction: 0, shape: 0, length: 0, speed: 0, corner: 0 };

/**
 * 하드 게이트: 길이·시간이 허용 오차 밖이면 해당 템플릿 실격 (총점 0).
 * 감점만으로는 미세 획/초저속 획이 85점을 넘는 오발이 가능 — v2.9 §6 실패 규격 보장.
 */
function hardGate(f: PathFeatures, tpl: GestureTemplate, cfg: GestureEngineConfig): boolean {
  const tolL = 0.15 * cfg.tolerance_scale;
  // 하한: 실격은 min_len의 gate 비율 미만만 — 그 위는 길이 감점으로 처리 (관대한 입력)
  if (f.pathLen < tpl.min_len * cfg.min_len_gate_ratio || f.pathLen > tpl.max_len * (1 + tolL)) return false;
  const tolT = 0.25 * cfg.tolerance_scale;
  if (f.elapsedMs < tpl.min_ms * (1 - tolT) || f.elapsedMs > tpl.max_ms * (1 + tolT)) return false;
  return true;
}

/** loop(회전베기) 전용 채점. */
function scoreLoop(
  f: PathFeatures,
  tpl: GestureTemplate,
  cfg: GestureEngineConfig,
): ScoreBreakdown {
  const minTurn = tpl.min_turn_deg ?? cfg.loop_min_turn_deg;
  const turn = Math.abs(f.totalTurnDeg);
  // Direction 50: 회전량 충족 + 폐곡선 여부
  let direction = 0;
  if (f.closed && turn >= minTurn) direction = 50;
  else if (f.closed && turn >= minTurn * 0.75) direction = 50 * ((turn - minTurn * 0.75) / (minTurn * 0.25));
  // Shape 20: 원형도 — 리샘플 점들의 중심 거리 분산
  const ub = toUnitBox(f.resampled);
  const cx = ub.reduce((s, p) => s + p.x, 0) / ub.length;
  const cy = ub.reduce((s, p) => s + p.y, 0) / ub.length;
  const rs = ub.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
  let shape = 0;
  if (mean > 0) {
    const variance = rs.reduce((s, r) => s + (r - mean) * (r - mean), 0) / rs.length;
    const cv = Math.sqrt(variance) / mean; // 원이면 0
    shape = Math.max(0, 1 - cv / (0.45 * cfg.tolerance_scale)) * 20;
  }
  const length = bandScore(f.pathLen, tpl.min_len, tpl.max_len, 0.15 * cfg.tolerance_scale, 10);
  const speed = bandScore(f.elapsedMs, tpl.min_ms, tpl.max_ms, 0.25 * cfg.tolerance_scale, 10);
  const corner = 10; // loop는 코너 수 무관
  return { direction, shape, length, speed, corner };
}

/** stroke 채점. */
function scoreStroke(
  f: PathFeatures,
  tpl: GestureTemplate,
  cfg: GestureEngineConfig,
): ScoreBreakdown {
  // 폐곡선 입력이 stroke에 높은 점수를 받는 것 방지
  if (f.closed && Math.abs(f.totalTurnDeg) >= cfg.loop_min_turn_deg * 0.75) {
    return { direction: 0, shape: 0, length: 0, speed: 0, corner: 0 };
  }
  const direction = directionScore(f.segments, tpl.dirs, cfg.tolerance_scale);
  const ideal = idealPolyline(tpl.dirs, f.resampled.length, tpl.dir_weights);
  const shape = shapeScore(f.resampled, ideal, cfg.tolerance_scale);
  const length = bandScore(f.pathLen, tpl.min_len, tpl.max_len, 0.15 * cfg.tolerance_scale, 10);
  const speed = bandScore(f.elapsedMs, tpl.min_ms, tpl.max_ms, 0.25 * cfg.tolerance_scale, 10);
  const expectedCorners = tpl.dirs.length - 1;
  const actualCorners = Math.max(0, f.segments.length - 1);
  const cdiff = Math.abs(actualCorners - expectedCorners);
  const corner = cdiff === 0 ? 10 : cdiff === 1 ? 4 : 0;
  return { direction, shape, length, speed, corner };
}

export function scoreTemplate(
  f: PathFeatures,
  tpl: GestureTemplate,
  cfg: GestureEngineConfig,
): CandidateScore {
  if (!hardGate(f, tpl, cfg)) {
    return { gesture_id: tpl.gesture_id, total: 0, breakdown: { ...ZERO_BREAKDOWN } };
  }
  const breakdown = tpl.kind === 'loop' ? scoreLoop(f, tpl, cfg) : scoreStroke(f, tpl, cfg);
  const total =
    breakdown.direction + breakdown.shape + breakdown.length + breakdown.speed + breakdown.corner;
  return { gesture_id: tpl.gesture_id, total: Math.round(total * 100) / 100, breakdown };
}
