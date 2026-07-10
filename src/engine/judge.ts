// 검로(劍路) 판정. FR-JDG-001/003/004. 순수(DOM 비의존).
// T1-02: shapeType(line/circle) 분기, lenBand 동률 판별, 속도/최소길이 오버라이드.
import type { Pt, Grade, JudgeResult, Style, ShapeType } from './types';
import { BALANCE, STROKE_TEMPLATES, STYLES } from './data';
import { pathLength, bbox, resample, normalize, mirrorPoints } from './geometry';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 순각도(net angle, 화면좌표 y아래) [0,360). ↘=45°, ↓=90°, ←=180°, ↑=270°.
function netAngleDeg(pts: Pt[]): number {
  const a = pts[0], b = pts[pts.length - 1];
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 360) % 360;
}
// 두 각도의 최소 차(도), 0~180.
function angDistDeg(a: number, b: number): number {
  let d = ((a - b + 180) % 360 + 360) % 360 - 180;
  return Math.abs(d);
}
const _lineIdeal: Record<string, number> = {};
export function lineIdealAngle(id: string): number {
  if (_lineIdeal[id] != null) return _lineIdeal[id];
  return (_lineIdeal[id] = netAngleDeg(STROKE_TEMPLATES[id].path.map(([x, y]) => ({ x, y }))));
}

const _tplCache: Record<string, Pt[]> = {};
export function templatePoints(id: string): Pt[] {
  if (_tplCache[id]) return _tplCache[id];
  const path = STROKE_TEMPLATES[id].path.map(([x, y]) => ({ x, y }));
  return (_tplCache[id] = normalize(resample(path, BALANCE.resample)));
}
// 원형 특징(회전 불변): 중심·반지름CV·부호있는 스윕·단조성·폐합.
export interface CircleFeats { meanR: number; cv: number; sweepDeg: number; signSweep: number; monotonicity: number; closure: number }
export function circleFeatures(pts: Pt[]): CircleFeats {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length; cy /= pts.length;
  const radii = pts.map(p => Math.hypot(p.x - cx, p.y - cy));
  const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
  const varR = radii.reduce((a, b) => a + (b - meanR) ** 2, 0) / radii.length;
  const cv = meanR > 1e-9 ? Math.sqrt(varR) / meanR : 1;
  let signed = 0;
  const deltas: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1].x - cx, ay = pts[i - 1].y - cy, bx = pts[i].x - cx, by = pts[i].y - cy;
    const cross = ax * by - ay * bx, dot = ax * bx + ay * by;
    const d = Math.atan2(cross, dot);
    signed += d; deltas.push(d);
  }
  const sgn = Math.sign(signed) || 1;
  const fwd = deltas.filter(d => Math.sign(d) === sgn).length;
  const circumference = 2 * Math.PI * meanR || 1;
  const gap = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  return {
    meanR, cv, sweepDeg: Math.abs(signed) * 180 / Math.PI, signSweep: sgn,
    monotonicity: deltas.length ? fwd / deltas.length : 0, closure: gap / circumference,
  };
}
// 원무 템플릿의 회전 부호 = 우수검류 기대 방향(시계). 미러는 raw를 정규 공간으로 접으므로 canonical 기준.
const _circleExpectedSign = (() => {
  const c = Object.values(STROKE_TEMPLATES).find(s => s.shapeType === 'circle');
  if (!c) return 1;
  return circleFeatures(c.path.map(([x, y]) => ({ x, y }))).signSweep;
})();
// 사전 거부 바닥 = 템플릿 최소 minLenRatio(찌르기 오버라이드로 낮아짐).
const _rejectFloor = Math.min(...Object.values(STROKE_TEMPLATES).map(s => s.minLenRatio ?? BALANCE.minLenRatio));

export function gradeOf(acc: number): Grade {
  const c = BALANCE.gradeCuts;
  if (acc >= c.perfect) return 'perfect';
  if (acc >= c.great) return 'great';
  if (acc >= c.good) return 'good';
  if (acc >= c.bad) return 'bad';
  return 'miss';
}

export function judgeStroke(raw: Pt[], meta: { w: number; h: number }, style: Style = STYLES.uraken): JudgeResult {
  const canvasDiag = Math.hypot(meta.w, meta.h);
  if (!raw || raw.length < 2) return { rejected: true, reason: 'tap' };
  if (style.mirrorX) raw = mirrorPoints(raw);
  const b = bbox(raw);
  if (Math.hypot(b.w, b.h) / canvasDiag < BALANCE.rejectRatio) return { rejected: true, reason: 'tap' };
  const lengthRatio = pathLength(raw) / canvasDiag;
  if (lengthRatio < _rejectFloor) return { rejected: true, reason: 'short' };

  const rs = resample(raw, BALANCE.resample);
  const norm = normalize(rs);
  const feats = circleFeatures(rs);

  // ---- 형태 매칭: 원(circle) vs 직선(line) ----
  // 원 게이트: 큰 스윕 + 낮은 반지름 CV + 낮은 폐합(호/스파이럴은 원 아님).
  const isCircle = feats.sweepDeg >= BALANCE.shape.circleMinSweepDeg
    && feats.cv <= BALANCE.shape.circleMaxCV
    && feats.closure <= BALANCE.shape.circleMaxClosure;
  let strokeId: string, shapeType: ShapeType, dist: number | undefined;
  if (isCircle) {
    const circleId = Object.keys(STROKE_TEMPLATES).find(id => STROKE_TEMPLATES[id].shapeType === 'circle');
    if (!circleId) return { rejected: true, reason: 'unknown' };
    strokeId = circleId; shapeType = 'circle';
  } else {
    // 직선 획: net 각도 섹터 분류(±sectorHalfDeg, 획별 오버라이드). 흔들림/곡률에 강건. (버그3)
    shapeType = 'line';
    const netAng = netAngleDeg(rs);
    const cand = Object.keys(STROKE_TEMPLATES)
      .filter(id => STROKE_TEMPLATES[id].shapeType === 'line')
      .map(id => ({ id, dAng: angDistDeg(netAng, lineIdealAngle(id)), half: STROKE_TEMPLATES[id].sectorHalfDeg ?? BALANCE.sectorHalfDeg }))
      .filter(c => c.dAng <= c.half)
      .sort((a, b) => a.dAng - b.dAng);
    // ↖/↗ 등 획 없는 섹터 → 획 불명(결정 a). 형태가 line/circle 어디에도 안 맞을 때만 불명.
    if (!cand.length) return { rejected: true, reason: 'unknown' };
    // 같은 섹터 다수(h_lr/thrust는 둘 다 0°) → lenBand로 판별.
    let chosen = cand[0].id;
    if (cand.length > 1) {
      const inBand = cand.find(c => { const [lo, hi] = STROKE_TEMPLATES[c.id].lenBand; return lengthRatio >= lo && lengthRatio <= hi; });
      chosen = inBand ? inBand.id : cand[0].id;
    }
    strokeId = chosen; dist = cand[0].dAng;
  }

  const spec = STROKE_TEMPLATES[strokeId];
  // ---- 형태 점수 30% ----
  let shapeScore: number;
  if (shapeType === 'circle') {
    const cw = BALANCE.shape.circleWeights;
    const radiusScore = clamp01(1 - feats.cv / BALANCE.shape.radiusCVZero);            // 반지름 일관성 50%
    const sweepScore = clamp01(feats.sweepDeg / BALANCE.shape.sweepFullDeg);           // 각도 스윕 30%
    const closureScore = clamp01(1 - feats.closure / BALANCE.shape.closureZero);       // 폐합도 20%
    shapeScore = cw.radius * radiusScore + cw.sweep * sweepScore + cw.closure * closureScore;
  } else {
    const normChord = Math.hypot(norm[norm.length - 1].x - norm[0].x, norm[norm.length - 1].y - norm[0].y);
    shapeScore = Math.pow(clamp01(normChord / (pathLength(norm) || 1)), 2);            // 직선도 (현/경로)²
  }
  // ---- 방향 점수 40% ----
  let dir01: number;
  if (shapeType === 'circle') {
    dir01 = feats.signSweep === _circleExpectedSign ? feats.monotonicity : 0;          // 반대방향=0
  } else {
    // 방향 40% = 국소 방향 일치도(L, 흔들림 감점) × 이상각 오차 점수(A, net 각도 감점). 둘 다 반영. (버그3)
    const tpl = templatePoints(strokeId);
    const tVec = { x: tpl[tpl.length - 1].x - tpl[0].x, y: tpl[tpl.length - 1].y - tpl[0].y };
    const tLen = Math.hypot(tVec.x, tVec.y) || 1;
    const tux = tVec.x / tLen, tuy = tVec.y / tLen;
    let dsum = 0, dcnt = 0;
    for (let i = 1; i < rs.length; i++) {
      const sx = rs[i].x - rs[i - 1].x, sy = rs[i].y - rs[i - 1].y;
      const sl = Math.hypot(sx, sy);
      if (sl < 1e-9) continue;
      dsum += Math.max(0, (sx * tux + sy * tuy) / sl); dcnt++;
    }
    const L = dcnt ? dsum / dcnt : 0;
    const iVec = { x: rs[rs.length - 1].x - rs[0].x, y: rs[rs.length - 1].y - rs[0].y };
    const iLen = Math.hypot(iVec.x, iVec.y) || 1;
    const cosNet = Math.max(-1, Math.min(1, (iVec.x * tux + iVec.y * tuy) / iLen));
    const errDeg = Math.acos(cosNet) * 180 / Math.PI;
    const A = Math.max(0, 1 - errDeg / BALANCE.angleErrorFullDeg);   // 13°→0.71, 45°→0
    dir01 = L * A;
  }
  // ---- 속도 15% (획별 오버라이드) ----
  const spd = spec.speedMs ?? BALANCE.speedIdeal;
  const dur = (raw[raw.length - 1].t || 0) - (raw[0].t || 0);
  let speed: number;
  if (dur >= spd.min && dur <= spd.max) speed = 1;
  else if (dur < spd.min) speed = Math.max(0, dur / spd.min);
  else speed = Math.max(0, spd.max / dur);
  // ---- 완주 15% ----
  let completion: number;
  if (shapeType === 'circle') {
    completion = clamp01(feats.sweepDeg / 360);
  } else {
    const tpl = templatePoints(strokeId);
    const dStart = Math.hypot(norm[0].x - tpl[0].x, norm[0].y - tpl[0].y);
    const dEnd = Math.hypot(norm[norm.length - 1].x - tpl[tpl.length - 1].x, norm[norm.length - 1].y - tpl[tpl.length - 1].y);
    completion = Math.max(0, 1 - (dStart + dEnd) / 2);
  }

  const w = BALANCE.weights;
  const acc = Math.max(0, Math.min(100, Math.round(
    100 * (w.direction * dir01 + w.straight * shapeScore + w.speed * speed + w.completion * completion))));
  return { rejected: false, strokeId, accuracy: acc, grade: gradeOf(acc), breakdown: { direction: dir01, straight: shapeScore, speed, completion }, dist };
}
