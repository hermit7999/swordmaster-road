// T2-04: 경제/레벨 순수 로직 (DOM 비의존). 경험치→레벨, 레벨/검→파생 스탯.
import { BALANCE, SWORDS } from './data';

/** 누적 경험치로 현재 레벨 산출. xpToLevel[i] = i레벨 도달 누적 경험치(1레벨=0). */
export function levelFromXp(xp: number): number {
  const t = BALANCE.progression.xpToLevel;
  let lv = 1;
  for (let i = 1; i < t.length; i++) if (xp >= t[i]) lv = i + 1;
  return lv;
}

/** 다음 레벨까지 남은 경험치. 최대 레벨이면 null. */
export function xpToNext(xp: number): number | null {
  const t = BALANCE.progression.xpToLevel;
  const lv = levelFromXp(xp);
  if (lv >= t.length) return null;
  return t[lv] - xp;
}

/** 레벨 + 장착 검으로 파생 스탯(최대 HP, 반격 위력 보너스). */
export function derivedStats(level: number, swordId: string): { hpMax: number; power: number } {
  const p = BALANCE.progression;
  const sword = SWORDS[swordId];
  return {
    hpMax: BALANCE.combat.playerHp + (level - 1) * p.hpPerLevel,
    power: (level - 1) * p.powerPerLevel + (sword?.power ?? 0),
  };
}
