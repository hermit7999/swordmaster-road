// T1-04 유파 정식화 검증: 8획 전부 좌수에서 canonical로 판정 + StyleManager.
import { describe, it, expect } from 'vitest';
import { judgeStroke, STYLES, mirrorStrokeId, techniqueCombo, otherStyle, updownCluster, TECHNIQUES } from './index';
import type { Pt } from './index';

const META = { w: 800, h: 450 };
function line(from: [number, number], to: [number, number], n = 40, dur = 320): Pt[] {
  const o: Pt[] = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1); o.push({ x: from[0] + (to[0] - from[0]) * u, y: from[1] + (to[1] - from[1]) * u, t: dur * u }); }
  return o;
}
function circle(cx: number, cy: number, r: number, n: number, dur: number, cw: boolean): Pt[] {
  const o: Pt[] = []; const s = 2 * Math.PI * (cw ? 1 : -1);
  for (let i = 0; i < n; i++) { const u = i / (n - 1), th = s * u; o.push({ x: cx + r * Math.sin(th), y: cy - r * Math.cos(th), t: dur * u }); }
  return o;
}
const mirX = (pts: Pt[]) => pts.map(p => ({ x: META.w - p.x, y: p.y, t: p.t }));

// 우수(canonical) 표본. 좌수 플레이어는 이들의 x-미러를 그린다.
const samples: Record<string, Pt[]> = {
  h_lr: line([100, 225], [700, 225]),
  h_rl: line([700, 225], [100, 225]),
  diag_dr: line([150, 60], [650, 400]),
  diag_dl: line([650, 60], [150, 400]),
  v_down: line([400, 40], [400, 420]),
  v_up: line([400, 420], [400, 40]),
  thrust: line([400, 225], [520, 225], 20, 150),
  wonmu: circle(400, 225, 170, 44, 1000, true),
};

describe('T1-04 유파: 8획 전부 좌수에서 canonical 판정', () => {
  for (const id of Object.keys(samples)) {
    it(`${id}: 좌수(미러 입력) = ${id}`, () => {
      // 좌수 플레이어의 물리 입력 = 우수표본의 x-미러. 좌수로 판정 → canonical id로 접힘.
      const r = judgeStroke(mirX(samples[id]), META, STYLES.saken);
      expect(r.rejected).toBe(false);
      expect(r.strokeId).toBe(id);
    });
  }
  it('좌수 원무: 손방향(chirality) 정상 — 반시계 물리입력이 방향점수 유지', () => {
    // wonmu 우수표본은 시계. 좌수 플레이어는 반시계(미러)를 그림.
    const r = judgeStroke(mirX(samples.wonmu), META, STYLES.saken);
    expect(r.strokeId).toBe('wonmu');
    expect(r.breakdown!.direction).toBeGreaterThan(0.5);
  });
});

describe('T1-04 StyleManager', () => {
  it('미러 획ID 맵: 상호 대응', () => {
    expect(mirrorStrokeId('h_lr')).toBe('h_rl');
    expect(mirrorStrokeId('diag_dr')).toBe('diag_dl');
    expect(mirrorStrokeId('v_down')).toBe('v_down');
    expect(mirrorStrokeId('wonmu')).toBe('wonmu');
  });
  it('검술 조합: 두 유파 모두 canonical(오버라이드 없음)', () => {
    for (const techId of Object.keys(TECHNIQUES)) {
      expect(techniqueCombo(techId, STYLES.uraken)).toEqual(TECHNIQUES[techId].combo);
      expect(techniqueCombo(techId, STYLES.saken)).toEqual(TECHNIQUES[techId].combo);
    }
  });
  it('가상패드 ↑↓ 클러스터: 우수=우측 / 좌수=좌측', () => {
    expect(updownCluster(STYLES.uraken)).toBe('right');
    expect(updownCluster(STYLES.saken)).toBe('left');
  });
  it('otherStyle 토글', () => {
    expect(otherStyle(STYLES.uraken).name).toBe(STYLES.saken.name);
    expect(otherStyle(STYLES.saken).name).toBe(STYLES.uraken.name);
  });
});
