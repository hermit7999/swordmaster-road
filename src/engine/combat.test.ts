import { describe, it, expect } from 'vitest';
import { strokeOctant, isGuarded, comboMultiplier } from './combat';

describe('전투 판정 코어 — 자세(가드)', () => {
  it('획 → 방향 글리프', () => {
    expect(strokeOctant('h_lr')).toBe('→');
    expect(strokeOctant('v_down')).toBe('↓');
    expect(strokeOctant('diag_ur')).toBe('↗');
    expect(strokeOctant('thrust')).toBeNull();   // 무방향
    expect(strokeOctant('wonmu')).toBeNull();
  });
  it('막힌 방향으로 그으면 튕김(guarded)', () => {
    const guard = ['→', '↗', '↘'];   // 우측 가드
    expect(isGuarded('h_lr', guard)).toBe(true);    // → 막힘
    expect(isGuarded('diag_dr', guard)).toBe(true);  // ↘ 막힘
    expect(isGuarded('h_rl', guard)).toBe(false);    // ← 열림
    expect(isGuarded('v_down', guard)).toBe(false);  // ↓ 열림
  });
  it('무방향 획은 가드 무시(항상 정타)', () => {
    expect(isGuarded('thrust', ['→', '←', '↑', '↓'])).toBe(false);
    expect(isGuarded('wonmu', ['→', '←', '↑', '↓', '↗', '↖', '↘', '↙'])).toBe(false);
  });
});

describe('전투 판정 코어 — 콤보 배율', () => {
  it('0/1콤보=1.0, 이후 step 누적, 상한', () => {
    expect(comboMultiplier(0, 0.15, 2)).toBe(1);
    expect(comboMultiplier(1, 0.15, 2)).toBe(1);
    expect(comboMultiplier(2, 0.15, 2)).toBeCloseTo(1.15);
    expect(comboMultiplier(4, 0.15, 2)).toBeCloseTo(1.45);
    expect(comboMultiplier(20, 0.15, 2)).toBe(2);   // 상한
  });
});
