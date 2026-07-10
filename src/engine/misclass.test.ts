// T1-02 오분류율 측정. 각 획을 노이즈 포함해 다수 합성 → 혼동행렬 + 특정 쌍 오분류율 출력.
// 목적은 수치 리포트(경계값 튜닝 판단용). 하드 실패는 명백한 회귀만.
import { describe, it, expect } from 'vitest';
import { judgeStroke, STROKE_TEMPLATES } from './index';
import type { Pt } from './index';

const META = { w: 800, h: 450 };
const DIAG = Math.hypot(META.w, META.h); // ≈918
const IDS = Object.keys(STROKE_TEMPLATES);

// 재현 가능한 PRNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(1234);
const rr = (a: number, b: number) => a + (b - a) * rnd();

function lineSample(from: [number, number], to: [number, number], n: number, dur: number, jit: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    out.push({ x: from[0] + (to[0] - from[0]) * u + (rnd() - 0.5) * jit, y: from[1] + (to[1] - from[1]) * u + (rnd() - 0.5) * jit, t: dur * u });
  }
  return out;
}
function circleSample(cx: number, cy: number, r: number, n: number, dur: number, sweepDeg: number, jit: number, cw: boolean): Pt[] {
  const out: Pt[] = [];
  const sweep = (sweepDeg * Math.PI / 180) * (cw ? 1 : -1);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), th = sweep * u;
    out.push({ x: cx + (r + (rnd() - 0.5) * jit) * Math.sin(th), y: cy - (r + (rnd() - 0.5) * jit) * Math.cos(th), t: dur * u });
  }
  return out;
}

// 각 획의 현실적 표본 생성기(크기·위치·속도·흔들림 랜덤). 경계 근처까지 포함.
function sample(id: string): Pt[] {
  const n = Math.round(rr(24, 48)), jit = rr(2, 14);
  const cy = rr(120, 340), cx = rr(300, 500);
  switch (id) {
    case 'h_lr': { const len = rr(0.18, 0.85) * DIAG; const x0 = rr(60, Math.max(70, 780 - len)); return lineSample([x0, cy], [x0 + len, cy], n, rr(180, 520), jit); }
    case 'h_rl': { const len = rr(0.18, 0.85) * DIAG; const x1 = rr(60, Math.max(70, 780 - len)); return lineSample([x1 + len, cy], [x1, cy], n, rr(180, 520), jit); }
    case 'diag_dr': { const len = rr(0.22, 0.55); const dx = len * DIAG * 0.7; return lineSample([cx - dx / 2, 60], [cx - dx / 2 + dx, 60 + dx], n, rr(220, 520), jit); }
    case 'diag_dl': { const len = rr(0.22, 0.55); const dx = len * DIAG * 0.7; return lineSample([cx + dx / 2, 60], [cx + dx / 2 - dx, 60 + dx], n, rr(220, 520), jit); }
    case 'diag_ur': { const len = rr(0.22, 0.55); const dx = len * DIAG * 0.7; return lineSample([cx - dx / 2, 400], [cx - dx / 2 + dx, 400 - dx], n, rr(220, 520), jit); }  // ↗ 좌하→우상
    case 'diag_ul': { const len = rr(0.22, 0.55); const dx = len * DIAG * 0.7; return lineSample([cx + dx / 2, 400], [cx + dx / 2 - dx, 400 - dx], n, rr(220, 520), jit); }  // ↖ 우하→좌상
    case 'v_down': { const len = rr(0.20, 0.85) * 450; const y0 = rr(30, Math.max(40, 420 - len)); return lineSample([cx, y0], [cx, y0 + len], n, rr(180, 520), jit); }
    case 'v_up': { const len = rr(0.20, 0.85) * 450; const y0 = rr(30, Math.max(40, 420 - len)); return lineSample([cx, y0 + len], [cx, y0], n, rr(180, 520), jit); }
    case 'thrust': { const len = rr(0.05, 0.15) * DIAG; const x0 = rr(200, 560); return lineSample([x0, cy], [x0 + len, cy], Math.round(rr(10, 22)), rr(70, 280), rr(1, 7)); }
    case 'wonmu': { const r = rr(90, 175); return circleSample(cx, rr(150, 300), r, Math.round(rr(28, 48)), rr(700, 1300), rr(315, 360), rr(3, 16), true); }
    default: return [];
  }
}

describe('T1-02 오분류율(혼동행렬)', () => {
  it('측정 및 출력', () => {
    const N = 400;
    const conf: Record<string, Record<string, number>> = {};
    for (const a of IDS) { conf[a] = {}; for (const b of [...IDS, 'reject']) conf[a][b] = 0; }
    for (const actual of IDS) {
      for (let k = 0; k < N; k++) {
        const r = judgeStroke(sample(actual), META);
        const pred = r.rejected ? 'reject' : r.strokeId!;
        conf[actual][pred]++;
      }
    }
    // 출력
    const pct = (a: string, b: string) => (100 * conf[a][b] / N).toFixed(1);
    const lines: string[] = [];
    lines.push('=== T1-02 혼동행렬 (행=실제, 열=예측, %) N=' + N + '/획 ===');
    lines.push(['actual\\pred', ...IDS.map(s => s.slice(0, 6)), 'rej'].join('\t'));
    for (const a of IDS) lines.push([a, ...IDS.map(b => pct(a, b)), pct(a, 'reject')].join('\t'));
    lines.push('--- 자기분류 정확도 ---');
    for (const a of IDS) lines.push(`${a}: ${pct(a, a)}%`);
    lines.push('--- 핵심 오분류 쌍 ---');
    lines.push(`찌르기→횡베기(좌우): ${pct('thrust', 'h_lr')}% / 횡베기→찌르기: ${pct('h_lr', 'thrust')}%`);
    lines.push(`원무→사선(↘): ${pct('wonmu', 'diag_dr')}% / 원무→사선(↙): ${pct('wonmu', 'diag_dl')}%`);
    lines.push(`사선(↘)→원무: ${pct('diag_dr', 'wonmu')}% / 사선(↙)→원무: ${pct('diag_dl', 'wonmu')}%`);
    console.log('\n' + lines.join('\n') + '\n');

    // 하드 실패는 명백한 회귀만: 각 획 자기분류 ≥ 60%, 핵심 쌍 폭주(>40%) 방지.
    for (const a of IDS) expect(conf[a][a] / N, `${a} 자기분류율`).toBeGreaterThanOrEqual(0.6);
  });
});
