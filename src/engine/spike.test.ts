import { describe, it, expect } from 'vitest';
import { freeAttackDamage } from './combo';
import { BALANCE } from './data';

describe('freeAttackDamage (스파이크 자유공격)', () => {
  const base = BALANCE.basicAttackDamage; // 10
  it('등급 배율 적용', () => {
    expect(freeAttackDamage('miss')).toBe(0);
    expect(freeAttackDamage('bad')).toBe(Math.round(base * 0.5));
    expect(freeAttackDamage('good')).toBe(base);
    expect(freeAttackDamage('great')).toBe(Math.round(base * 1.2));
    expect(freeAttackDamage('perfect')).toBe(Math.round(base * 1.5));
  });
  it('알 수 없는 등급 = 0', () => { expect(freeAttackDamage('???')).toBe(0); });
  it('퍼펙트 > 그레이트 > 굿 순', () => {
    expect(freeAttackDamage('perfect')).toBeGreaterThan(freeAttackDamage('great'));
    expect(freeAttackDamage('great')).toBeGreaterThan(freeAttackDamage('good'));
  });
});
