// 검결(劍訣) 리듬 판정. FR-JDG-005/FR-INP-013/014. 순수(DOM 비의존).
import type { Dir, CommandInput, RhythmResult, Grade, Style } from './types';
import { BALANCE, STROKE_TEMPLATES, STYLES } from './data';
import { MIRROR_TOK } from './command';

// 패드 대각 단일 토큰을 raw 카디널 2개로 전개(동시각).
export function expandRaw(inputs: CommandInput[]): CommandInput[] {
  const CARD2: Partial<Record<Dir, [Dir, Dir]>> = { UL: ['U', 'L'], UR: ['U', 'R'], DL: ['D', 'L'], DR: ['D', 'R'] };
  const out: CommandInput[] = [];
  for (const i of inputs) {
    const pair = CARD2[i.dir];
    if (pair) { out.push({ dir: pair[0], t: i.t }); out.push({ dir: pair[1], t: i.t }); }
    else out.push({ dir: i.dir, t: i.t });
  }
  return out;
}
export function rhythmGradeAcc(maxErr: number): { grade: Grade; accuracy: number } {
  const W = BALANCE.rhythm.windows;
  if (maxErr <= W.perfect) return { grade: 'perfect', accuracy: Math.round(100 - (maxErr / W.perfect) * 5) };
  if (maxErr <= W.great)   return { grade: 'great',   accuracy: Math.round(94 - ((maxErr - W.perfect) / (W.great - W.perfect)) * 9) };
  if (maxErr <= W.good)    return { grade: 'good',    accuracy: Math.round(84 - ((maxErr - W.great) / (W.good - W.great)) * 14) };
  if (maxErr <= W.bad)     return { grade: 'bad',     accuracy: Math.round(69 - ((maxErr - W.good) / (W.bad - W.good)) * 19) };
  return { grade: 'miss', accuracy: 0 };
}
// rawInputs = CommandCapture 버퍼(collapse 이전).
// 동일 이상 오프셋(=동시 입력, chord)은 순서 무관 멀티셋으로 매칭 — ↓+→에서 →가 먼저 들어와도 정상.
export function judgeRhythm(rawInputs: CommandInput[], strokeId: string, style: Style = STYLES.uraken): RhythmResult {
  const rawCount = rawInputs.length;
  let ins = style.mirrorX ? rawInputs.map(i => ({ dir: MIRROR_TOK[i.dir] || i.dir, t: i.t })) : rawInputs.map(i => ({ dir: i.dir, t: i.t }));
  ins = expandRaw(ins).sort((a, b) => a.t - b.t);
  const spec = STROKE_TEMPLATES[strokeId];
  if (ins.length !== spec.raw.length) return { grade: 'miss', accuracy: 0, reason: 'count' };
  // 이상 리듬을 동시 그룹(동일 오프셋 연속)으로 묶는다.
  const groups: { off: number; dirs: string[] }[] = [];
  for (let i = 0; i < spec.raw.length; i++) {
    const last = groups[groups.length - 1];
    if (last && last.off === spec.rhythm[i]) last.dirs.push(spec.raw[i]);
    else groups.push({ off: spec.rhythm[i], dirs: [spec.raw[i]] });
  }
  const t0 = ins[0].t; let maxErr = 0; const errors: number[] = []; let idx = 0;
  for (const g of groups) {
    const slice = ins.slice(idx, idx + g.dirs.length); idx += g.dirs.length;
    const want = [...g.dirs].sort(); const got = slice.map(s => s.dir).sort();  // 그룹 내 순서 무관
    if (want.length !== got.length || want.some((d, i) => d !== got[i])) return { grade: 'miss', accuracy: 0, reason: 'order' };
    for (const s of slice) { const e = Math.abs((s.t - t0) - g.off); errors.push(Math.round(e)); if (e > maxErr) maxErr = e; }
  }
  const ga = rhythmGradeAcc(maxErr);
  // 다입력(고난도) 정밀 성공 시 위력 +10% (패드 단일 대각 press 제외). FR-INP-014.
  const powerBonus = rawCount >= 2 && ga.grade !== 'miss' && maxErr <= BALANCE.rhythm.windows.great;
  return { grade: ga.grade, accuracy: ga.accuracy, maxErr, errors, powerBonus };
}
