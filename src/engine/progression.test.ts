import { describe, it, expect } from 'vitest';
import { levelFromXp, xpToNext, derivedStats } from './progression';
import { BALANCE } from './data';

describe('progression (T2-04)', () => {
  const t = BALANCE.progression.xpToLevel; // [0,40,90,160,250,360]

  it('경험치 0 = 1레벨', () => { expect(levelFromXp(0)).toBe(1); });
  it('임계 도달 시 레벨 상승', () => {
    expect(levelFromXp(39)).toBe(1);
    expect(levelFromXp(40)).toBe(2);
    expect(levelFromXp(89)).toBe(2);
    expect(levelFromXp(90)).toBe(3);
    expect(levelFromXp(360)).toBe(6);
  });
  it('최대 레벨 초과 경험치도 최대 레벨 유지', () => {
    expect(levelFromXp(9999)).toBe(t.length);
  });
  it('다음 레벨까지 남은 경험치', () => {
    expect(xpToNext(0)).toBe(40);
    expect(xpToNext(40)).toBe(50); // 90-40
    expect(xpToNext(360)).toBeNull(); // 최대 레벨
  });
  it('파생 스탯: 레벨/검 반영', () => {
    const base = BALANCE.combat.playerHp;
    expect(derivedStats(1, 'nameless')).toEqual({ hpMax: base, power: 0 });
    expect(derivedStats(3, 'nameless')).toEqual({ hpMax: base + 20, power: 4 }); // (3-1)*10, (3-1)*2
    expect(derivedStats(1, 'blue_steel')).toEqual({ hpMax: base, power: 3 });
    expect(derivedStats(2, 'wave_blade')).toEqual({ hpMax: base + 10, power: 2 + 5 });
  });
});
