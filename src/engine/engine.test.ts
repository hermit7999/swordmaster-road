// M0 회귀 29종을 vitest로 이관(T1-01 완료 기준). 새 엔진 구조에서 전부 통과해야.
import { describe, it, expect } from 'vitest';
import {
  judgeStroke, recognizeCommand, judgeRhythm, STYLES, BALANCE,
} from './index';
import type { Pt } from './index';

const META = { w: 800, h: 450 };
function synthLine(from: [number, number], to: [number, number], n: number, durMs: number, jitter = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const jx = jitter ? Math.sin(u * Math.PI * 6) * jitter : 0;
    const jy = jitter ? Math.cos(u * Math.PI * 6) * jitter : 0;
    out.push({ x: from[0] + (to[0] - from[0]) * u + jx, y: from[1] + (to[1] - from[1]) * u + jy, t: durMs * u });
  }
  return out;
}

describe('judgeStroke (검로)', () => {
  it('반듯한 횡베기 = 그레이트+', () => {
    const r = judgeStroke(synthLine([100, 225], [700, 225], 40, 300), META);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('h_lr');
    expect(r.accuracy!).toBeGreaterThanOrEqual(85);
  });
  it('흔들린 획 = 배드(50-69)', () => {
    const r = judgeStroke(synthLine([100, 225], [700, 225], 60, 300, 80), META);
    expect(r.accuracy!).toBeGreaterThanOrEqual(50);
    expect(r.accuracy!).toBeLessThanOrEqual(69);
  });
  it('역방향 = 획 불명', () => {
    const r = judgeStroke(synthLine([700, 225], [100, 225], 40, 300), META);
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe('unknown');
  });
  it('탭 = 거부', () => {
    const r = judgeStroke([{ x: 400, y: 225, t: 0 }, { x: 402, y: 226, t: 10 }], META);
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe('tap');
  });
  it('작은 획 = 비율 인정', () => {
    const r = judgeStroke(synthLine([340, 225], [540, 225], 30, 220), META);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('h_lr');
    expect(r.accuracy!).toBeGreaterThanOrEqual(70);
  });
  it('사선 = diag_dr', () => {
    const r = judgeStroke(synthLine([150, 60], [650, 400], 40, 320), META);
    expect(r.strokeId).toBe('diag_dr');
  });
  it('내려찍기 = v_down', () => {
    const r = judgeStroke(synthLine([400, 40], [400, 420], 40, 320), META);
    expect(r.strokeId).toBe('v_down');
  });
});

describe('recognizeCommand (검결)', () => {
  it('순차 ←→ = 횡베기', () => expect(recognizeCommand([{ dir: 'L', t: 0 }, { dir: 'R', t: 180 }], BALANCE.simulMs)?.strokeId).toBe('h_lr'));
  it('동시 ↓+→ = 사선', () => expect(recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'R', t: 30 }], BALANCE.simulMs)?.strokeId).toBe('diag_dr'));
  it('패드 ↘ 단일 = 사선', () => expect(recognizeCommand([{ dir: 'DR', t: 0 }], BALANCE.simulMs)?.strokeId).toBe('diag_dr'));
  it('순차 ↑↓ = 내려찍기', () => expect(recognizeCommand([{ dir: 'U', t: 0 }, { dir: 'D', t: 150 }], BALANCE.simulMs)?.strokeId).toBe('v_down'));
  it('↓후→ 늦게(순차) ≠ 사선', () => expect(recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'R', t: 300 }], BALANCE.simulMs)).toBeNull());
  it('→← = null(M0 미존재)', () => expect(recognizeCommand([{ dir: 'R', t: 0 }, { dir: 'L', t: 150 }], BALANCE.simulMs)).toBeNull());
});

describe('좌수검류 미러', () => {
  it('우→좌 제스처 = 횡베기', () => {
    const r = judgeStroke(synthLine([700, 225], [100, 225], 40, 300), META, STYLES.saken);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('h_lr');
    expect(r.accuracy!).toBeGreaterThanOrEqual(85);
  });
  it('커맨드 →← = 횡베기', () => expect(recognizeCommand([{ dir: 'R', t: 0 }, { dir: 'L', t: 180 }], BALANCE.simulMs, STYLES.saken)?.strokeId).toBe('h_lr'));
  it('커맨드 ↓+← = 사선', () => expect(recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'L', t: 25 }], BALANCE.simulMs, STYLES.saken)?.strokeId).toBe('diag_dr'));
});

describe('judgeRhythm (검결 타이밍)', () => {
  it('←0 →400 = 퍼펙트+보너스', () => {
    const r = judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 400 }], 'h_lr');
    expect(r.grade).toBe('perfect'); expect(r.powerBonus).toBe(true);
  });
  it('오차70 = 그레이트', () => expect(judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 470 }], 'h_lr').grade).toBe('great'));
  it('오차220 = 배드', () => expect(judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 180 }], 'h_lr').grade).toBe('bad'));
  it('오차350 = 미스', () => expect(judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 50 }], 'h_lr').grade).toBe('miss'));
  it('동시 사선 오차30 = 퍼펙트+보너스', () => {
    const r = judgeRhythm([{ dir: 'D', t: 0 }, { dir: 'R', t: 30 }], 'diag_dr');
    expect(r.grade).toBe('perfect'); expect(r.powerBonus).toBe(true);
  });
  it('사선 오차120 = 굿', () => expect(judgeRhythm([{ dir: 'D', t: 0 }, { dir: 'R', t: 120 }], 'diag_dr').grade).toBe('good'));
  it('패드 단일 ↘ = 퍼펙트·보너스無', () => {
    const r = judgeRhythm([{ dir: 'DR', t: 0 }], 'diag_dr');
    expect(r.grade).toBe('perfect'); expect(r.powerBonus).toBe(false);
  });
  it('좌수 →0 ←400 = 퍼펙트', () => expect(judgeRhythm([{ dir: 'R', t: 0 }, { dir: 'L', t: 400 }], 'h_lr', STYLES.saken).grade).toBe('perfect'));
});

describe('T0-10 좌수 품질 동등성 + 클러스터', () => {
  const mir = (pts: Pt[]) => pts.map(p => ({ x: META.w - p.x, y: p.y, t: p.t }));
  const parity = (pts: Pt[], id: string) => {
    const u = judgeStroke(pts, META, STYLES.uraken), s = judgeStroke(mir(pts), META, STYLES.saken);
    return !u.rejected && !s.rejected && u.strokeId === id && s.strokeId === id && Math.abs(u.accuracy! - s.accuracy!) <= 1;
  };
  it('횡베기 반듯 품질동등', () => expect(parity(synthLine([100, 225], [700, 225], 40, 300), 'h_lr')).toBe(true));
  it('횡베기 흔들림 품질동등', () => expect(parity(synthLine([100, 225], [700, 225], 60, 300, 60), 'h_lr')).toBe(true));
  it('내려찍기 품질동등', () => expect(parity(synthLine([400, 40], [400, 420], 40, 320), 'v_down')).toBe(true));
  it('우수 ↑↓ 클러스터=우측', () => expect(STYLES.uraken.updownCluster).toBe('right'));
  it('좌수 ↑↓ 클러스터=좌측', () => expect(STYLES.saken.updownCluster).toBe('left'));
});
