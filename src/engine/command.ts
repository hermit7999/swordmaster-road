// 검결(劍訣) 커맨드 인식. FR-INP-006. 순수(DOM 비의존).
import type { Dir, CommandInput, CommandMatch, Style } from './types';
import { BALANCE, STROKE_TEMPLATES, STYLES } from './data';

export const MIRROR_TOK: Record<Dir, Dir> = {
  L: 'R', R: 'L', UL: 'UR', UR: 'UL', DL: 'DR', DR: 'DL', U: 'U', D: 'D',
};
const CARD: Partial<Record<Dir, [number, number]>> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
const DIAG: Record<string, Dir> = { '-1,-1': 'UL', '1,-1': 'UR', '-1,1': 'DL', '1,1': 'DR' };

// 동시 입력(카디널 쌍)을 대각 토큰으로 접기.
export function collapseSimul(inputs: CommandInput[], simulMs: number): CommandInput[] {
  const out: CommandInput[] = [];
  const used = new Array(inputs.length).fill(false);
  for (let i = 0; i < inputs.length; i++) {
    if (used[i]) continue;
    const a = inputs[i];
    let merged = false;
    if (CARD[a.dir]) {
      for (let j = i + 1; j < inputs.length; j++) {
        if (used[j]) continue;
        const bb = inputs[j];
        const cb = CARD[bb.dir];
        if (!cb || Math.abs(bb.t - a.t) > simulMs) continue;
        const ca = CARD[a.dir]!;
        const key = (ca[0] + cb[0]) + ',' + (ca[1] + cb[1]);
        if (DIAG[key]) { out.push({ dir: DIAG[key], t: Math.min(a.t, bb.t) }); used[i] = used[j] = true; merged = true; break; }
      }
    }
    if (!merged) { out.push({ dir: a.dir, t: a.t }); used[i] = true; }
  }
  return out.sort((x, y) => x.t - y.t);
}
// 버퍼 → (획ID 후보, 타임스탬프 시퀀스).
export function recognizeCommand(inputs: CommandInput[], simulMs: number, style: Style = STYLES.uraken): CommandMatch | null {
  if (style.mirrorX) inputs = inputs.map(i => ({ dir: MIRROR_TOK[i.dir] || i.dir, t: i.t }));
  const toks = collapseSimul(inputs, simulMs);
  const seq = toks.map(t => t.dir);
  for (const id of Object.keys(STROKE_TEMPLATES)) {
    const cmd = STROKE_TEMPLATES[id].command;
    if (cmd.length === seq.length && cmd.every((c, i) => c === seq[i])) {
      const span = toks.length >= 2 ? toks[toks.length - 1].t - toks[0].t : 0;
      const tightness = Math.max(0, Math.min(1, 1 - span / BALANCE.commandWindow));
      return { strokeId: id, tokens: toks, tightness };
    }
  }
  return null;
}
