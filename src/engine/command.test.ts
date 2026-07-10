// T1-03 검결 8종 인식·리듬 + OI-12(원무 4입력 난이도) 측정.
import { describe, it, expect } from 'vitest';
import { recognizeCommand, judgeRhythm, BALANCE, STROKE_TEMPLATES } from './index';
import type { CommandInput, Dir } from './index';

const S = BALANCE.simulMs;
// 각 획의 raw 커맨드를 이상 리듬(strokes.json)대로 입력했을 때의 시퀀스.
function idealInputs(id: string): CommandInput[] {
  const spec = STROKE_TEMPLATES[id];
  return spec.raw.map((dir, i) => ({ dir: dir as Dir, t: spec.rhythm[i] }));
}

describe('T1-03 검결 10종 인식', () => {
  const cases: [string, CommandInput[]][] = [
    ['h_lr', [{ dir: 'L', t: 0 }, { dir: 'R', t: 400 }]],
    ['h_rl', [{ dir: 'R', t: 0 }, { dir: 'L', t: 400 }]],       // →←
    ['diag_dr', [{ dir: 'D', t: 0 }, { dir: 'R', t: 20 }]],      // ↓+→
    ['diag_dl', [{ dir: 'D', t: 0 }, { dir: 'L', t: 20 }]],      // ↓+←
    ['diag_ur', [{ dir: 'U', t: 0 }, { dir: 'R', t: 20 }]],      // ↑+→ (10종)
    ['diag_ul', [{ dir: 'U', t: 0 }, { dir: 'L', t: 20 }]],      // ↑+← (10종)
    ['v_down', [{ dir: 'U', t: 0 }, { dir: 'D', t: 400 }]],      // ↑↓
    ['v_up', [{ dir: 'D', t: 0 }, { dir: 'U', t: 400 }]],        // ↓↑
    ['thrust', [{ dir: 'R', t: 0 }, { dir: 'R', t: 150 }]],      // →→
    ['wonmu', [{ dir: 'R', t: 0 }, { dir: 'D', t: 400 }, { dir: 'L', t: 800 }, { dir: 'U', t: 1200 }]], // →↓←↑
  ];
  for (const [id, inp] of cases) {
    it(`${id} 커맨드 인식`, () => expect(recognizeCommand(inp, S)?.strokeId).toBe(id));
  }
});

describe('T1-03 8종 리듬 판정(이상 입력 = 퍼펙트)', () => {
  for (const id of Object.keys(STROKE_TEMPLATES)) {
    it(`${id} 이상 리듬 = 퍼펙트`, () => {
      const r = judgeRhythm(idealInputs(id), id);
      expect(r.grade).toBe('perfect');
    });
  }
});

describe('OI-12 원무(4입력) 난이도 측정', () => {
  it('측정 및 출력', () => {
    // 시드 PRNG
    let seed = 4321;
    const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const gauss = (sd: number) => (rnd() + rnd() + rnd() + rnd() - 2) / 2 * sd * 2; // 근사 정규
    const N = 2000;
    // 사람이 이상 리듬을 목표로 σ 지터로 입력했을 때 등급 분포/인식 성공.
    function trial(id: string, sigma: number) {
      const spec = STROKE_TEMPLATES[id];
      const inp: CommandInput[] = spec.raw.map((dir, i) => ({ dir: dir as Dir, t: Math.max(0, spec.rhythm[i] + gauss(sigma)) }));
      const rec = recognizeCommand(inp, S);
      if (!rec || rec.strokeId !== id) return 'unrecognized';
      return judgeRhythm(inp, id).grade;
    }
    const grades = ['perfect', 'great', 'good', 'bad', 'miss', 'unrecognized'];
    function measure(id: string, sigma: number) {
      const cnt: Record<string, number> = {}; for (const g of grades) cnt[g] = 0;
      for (let k = 0; k < N; k++) cnt[trial(id, sigma)]++;
      const ok = (cnt.perfect + cnt.great + cnt.good) / N;       // 성공(굿+)
      const fail = (cnt.miss + cnt.unrecognized) / N;
      return { ok, fail, cnt };
    }
    const lines: string[] = ['=== OI-12 원무 난이도 (σ=지터 표준편차 ms, N=' + N + ') ==='];
    for (const sigma of [30, 50, 70]) {
      const wonmu = measure('wonmu', sigma);
      const hlr = measure('h_lr', sigma);   // 2입력 기준
      const diag = measure('diag_dr', sigma); // 동시입력 기준
      lines.push(`σ=${sigma}ms  원무(4입력) 성공(굿+)=${(wonmu.ok * 100).toFixed(1)}% 실패=${(wonmu.fail * 100).toFixed(1)}%  |  횡베기(2순차)=${(hlr.ok * 100).toFixed(1)}%  |  사선(동시)=${(diag.ok * 100).toFixed(1)}%`);
    }
    lines.push('원무 등급분포(σ=50): ' + JSON.stringify(measure('wonmu', 50).cnt));
    lines.push('사선(동시) 등급분포(σ=50): ' + JSON.stringify(measure('diag_dr', 50).cnt));
    lines.push('횡베기(순차) 등급분포(σ=50): ' + JSON.stringify(measure('h_lr', 50).cnt));
    console.log('\n' + lines.join('\n') + '\n');
    // 회귀 가드: σ 작을 때 원무도 대체로 성공해야(엔진이 4입력을 정상 처리).
    expect(measure('wonmu', 30).ok).toBeGreaterThan(0.5);
  });
});
