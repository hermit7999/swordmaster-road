// 검로(劍路) 판정. FR-JDG-001/004. 순수(DOM 비의존).
import type { Pt, Grade, JudgeResult, Style } from './types';
import { BALANCE, STROKE_TEMPLATES, STYLES } from './data';
import { pathLength, bbox, resample, normalize, meanDist, mirrorPoints } from './geometry';

const _tplCache: Record<string, Pt[]> = {};
export function templatePoints(id: string): Pt[] {
  if (_tplCache[id]) return _tplCache[id];
  const path = STROKE_TEMPLATES[id].path.map(([x, y]) => ({ x, y }));
  return (_tplCache[id] = normalize(resample(path, BALANCE.resample)));
}
export function classify(normInput: Pt[]) {
  return Object.keys(STROKE_TEMPLATES)
    .map(id => ({ strokeId: id, dist: meanDist(normInput, templatePoints(id)) }))
    .sort((a, b) => a.dist - b.dist);
}
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
  const bDiag = Math.hypot(b.w, b.h);
  if (bDiag / canvasDiag < BALANCE.rejectRatio) return { rejected: true, reason: 'tap' };
  const pLen = pathLength(raw);
  if (pLen / canvasDiag < BALANCE.minLenRatio) return { rejected: true, reason: 'short' };

  const rs = resample(raw, BALANCE.resample);
  const norm = normalize(rs);
  const best = classify(norm)[0];
  if (best.dist > BALANCE.classifyThreshold) return { rejected: true, reason: 'unknown', dist: best.dist };

  const tpl = templatePoints(best.strokeId);
  // 방향 40%: 구간별 국소 방향 일치도(궤적 정밀도 — 흔들리면 하락). FR-JDG-004.
  const tVec = { x: tpl[tpl.length - 1].x - tpl[0].x, y: tpl[tpl.length - 1].y - tpl[0].y };
  const tLen = Math.hypot(tVec.x, tVec.y) || 1;
  const tux = tVec.x / tLen, tuy = tVec.y / tLen;
  let dsum = 0, dcnt = 0;
  for (let i = 1; i < rs.length; i++) {
    const sx = rs[i].x - rs[i - 1].x, sy = rs[i].y - rs[i - 1].y;
    const sl = Math.hypot(sx, sy);
    if (sl < 1e-9) continue;
    dsum += Math.max(0, (sx * tux + sy * tuy) / sl);
    dcnt++;
  }
  const dir01 = dcnt ? dsum / dcnt : 0;
  // 직선 30%: (현/경로)^2, 정규화 공간.
  const normChord = Math.hypot(norm[norm.length - 1].x - norm[0].x, norm[norm.length - 1].y - norm[0].y);
  const straight = Math.pow(Math.max(0, Math.min(1, normChord / (pathLength(norm) || 1))), 2);
  // 속도 15%.
  const dur = (raw[raw.length - 1].t || 0) - (raw[0].t || 0);
  let speed: number;
  if (dur >= BALANCE.speedIdeal.min && dur <= BALANCE.speedIdeal.max) speed = 1;
  else if (dur < BALANCE.speedIdeal.min) speed = Math.max(0, dur / BALANCE.speedIdeal.min);
  else speed = Math.max(0, BALANCE.speedIdeal.max / dur);
  // 완주 15%: 정규화 끝점 정합.
  const dStart = Math.hypot(norm[0].x - tpl[0].x, norm[0].y - tpl[0].y);
  const dEnd = Math.hypot(norm[norm.length - 1].x - tpl[tpl.length - 1].x, norm[norm.length - 1].y - tpl[tpl.length - 1].y);
  const completion = Math.max(0, 1 - (dStart + dEnd) / 2);

  const w = BALANCE.weights;
  const acc = Math.max(0, Math.min(100, Math.round(
    100 * (w.direction * dir01 + w.straight * straight + w.speed * speed + w.completion * completion))));
  return {
    rejected: false, strokeId: best.strokeId, accuracy: acc, grade: gradeOf(acc),
    breakdown: { direction: dir01, straight, speed, completion }, dist: best.dist,
  };
}
