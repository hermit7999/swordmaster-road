// PRG-01/02/03 (런 성장 코어): 선택지 풀 + 3택 생성기 + 효과 적용.
// 규칙: 항상 3택, 서로 다른 빌드 축 2+ 혼합, 중복 금지 (P07 §2 / Decision Bible §5).
import { mulberry32 } from '../boss/boss.ts';

export type GrowthAxis = 'offense' | 'technique' | 'survival';
export type Rarity = 'common' | 'rare' | 'legendary';

export interface GrowthOption {
  option_id: string;
  name: string;
  desc: string;
  axis: GrowthAxis;
  rarity: Rarity;
  effect: GrowthEffect;
  max_stacks: number;
}

export type GrowthEffect =
  | { kind: 'dmg_skill'; skill_id: string; mul: number }
  | { kind: 'dmg_all'; mul: number }
  | { kind: 'range_skill'; skill_id: string; mul: number } // 진화: 사거리/범위 (PRG-04)
  | { kind: 'max_hp'; add: number }
  | { kind: 'heal'; ratio: number }
  | { kind: 'ki_gain'; mul: number }
  | { kind: 'parry_poise'; add: number }
  | { kind: 'parry_ki'; add: number }   // 전설: 패링 성공 시 검기 +N
  | { kind: 'gold'; add: number };

export const GROWTH_POOL: GrowthOption[] = [
  { option_id: 'g_slash_h', name: '횡베기 연마', desc: '횡베기 피해 +25%', axis: 'offense', rarity: 'common', effect: { kind: 'dmg_skill', skill_id: 'slash_h', mul: 0.25 }, max_stacks: 3 },
  { option_id: 'g_diag', name: '사선베기 연마', desc: '사선베기 피해 +30%', axis: 'offense', rarity: 'common', effect: { kind: 'dmg_skill', skill_id: 'slash_diag', mul: 0.3 }, max_stacks: 3 },
  { option_id: 'g_iaido', name: '발도술 연마', desc: '발도술 피해 +30%', axis: 'technique', rarity: 'common', effect: { kind: 'dmg_skill', skill_id: 'iaido', mul: 0.3 }, max_stacks: 3 },
  { option_id: 'g_spin', name: '회전베기 연마', desc: '회전베기 피해 +30%', axis: 'technique', rarity: 'common', effect: { kind: 'dmg_skill', skill_id: 'spin', mul: 0.3 }, max_stacks: 3 },
  { option_id: 'g_vert', name: '파성의 일격', desc: '내려베기 피해 +30%', axis: 'offense', rarity: 'common', effect: { kind: 'dmg_skill', skill_id: 'slash_v', mul: 0.3 }, max_stacks: 3 },
  { option_id: 'g_hp', name: '단련된 신체', desc: '최대 체력 +20', axis: 'survival', rarity: 'common', effect: { kind: 'max_hp', add: 20 }, max_stacks: 3 },
  { option_id: 'g_heal', name: '운기조식', desc: '즉시 체력 50% 회복', axis: 'survival', rarity: 'common', effect: { kind: 'heal', ratio: 0.5 }, max_stacks: 99 },
  { option_id: 'g_gold', name: '전리품 감식', desc: '즉시 골드 +120', axis: 'survival', rarity: 'common', effect: { kind: 'gold', add: 120 }, max_stacks: 99 },
  { option_id: 'g_all', name: '검기 각성', desc: '모든 피해 +10%', axis: 'offense', rarity: 'rare', effect: { kind: 'dmg_all', mul: 0.1 }, max_stacks: 3 },
  { option_id: 'g_ki', name: '예리한 검격', desc: '검기 충전 +30%', axis: 'technique', rarity: 'rare', effect: { kind: 'ki_gain', mul: 0.3 }, max_stacks: 2 },
  { option_id: 'g_parry', name: '유수의 방어', desc: '패링 자세 피해 +25', axis: 'technique', rarity: 'rare', effect: { kind: 'parry_poise', add: 25 }, max_stacks: 2 },
  { option_id: 'g_parry_ki', name: '받아치는 검기', desc: '패링 성공 시 검기 +50', axis: 'technique', rarity: 'legendary', effect: { kind: 'parry_ki', add: 50 }, max_stacks: 1 },
  // 진화 (사거리/범위 — 플레이 방식이 바뀌는 성장, PRG-04)
  { option_id: 'e_iaido_dash', name: '발도술 진화 — 신속', desc: '발도술 사거리 +35%', axis: 'technique', rarity: 'rare', effect: { kind: 'range_skill', skill_id: 'iaido', mul: 0.35 }, max_stacks: 2 },
  { option_id: 'e_spin_storm', name: '회전베기 진화 — 검풍', desc: '회전베기 반경 +30%', axis: 'technique', rarity: 'rare', effect: { kind: 'range_skill', skill_id: 'spin', mul: 0.3 }, max_stacks: 2 },
  { option_id: 'e_slash_wide', name: '횡베기 진화 — 광풍', desc: '횡베기 범위 +25%', axis: 'offense', rarity: 'rare', effect: { kind: 'range_skill', skill_id: 'slash_h', mul: 0.25 }, max_stacks: 2 },
];

const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 25, legendary: 5 };

/** PRG-07 검파 3종 (Sword Language Bible §5) — 런 시작 시 선택, 강화 방향만 다름. */
export interface SwordSchool {
  school_id: string;
  name: string;
  desc: string;
  motto: string;
  effects: GrowthEffect[];
}

export const SCHOOLS: SwordSchool[] = [
  {
    school_id: 'iaido_style', name: '발도류', motto: '기다렸다, 벤다',
    desc: '발도술 피해 +30% · 사거리 +20%',
    effects: [
      { kind: 'dmg_skill', skill_id: 'iaido', mul: 0.3 },
      { kind: 'range_skill', skill_id: 'iaido', mul: 0.2 },
    ],
  },
  {
    school_id: 'orthodox', name: '정검류', motto: '받아내고, 부순다',
    desc: '패링 자세 피해 +25 · 최대 체력 +20',
    effects: [
      { kind: 'parry_poise', add: 25 },
      { kind: 'max_hp', add: 20 },
    ],
  },
  {
    school_id: 'swift_style', name: '쾌검류', motto: '쉬지 않고, 벤다',
    desc: '사선베기 피해 +30% · 검기 충전 +20%',
    effects: [
      { kind: 'dmg_skill', skill_id: 'slash_diag', mul: 0.3 },
      { kind: 'ki_gain', mul: 0.2 },
    ],
  },
];

/** PRG-02: 3택 생성 — 중복 금지 + 만렙 제외 + 축 2종 이상 (P07 §9). */
export class GrowthPicker {
  private rng: () => number;

  constructor(seed = 1) {
    this.rng = mulberry32(seed);
  }

  roll(state: GrowthState, bossReward = false): GrowthOption[] {
    const available = GROWTH_POOL.filter((o) => state.stacksOf(o.option_id) < o.max_stacks);
    const picked: GrowthOption[] = [];
    let guard = 0;
    while (picked.length < 3 && guard++ < 200) {
      const pool = available.filter((o) => !picked.some((p) => p.option_id === o.option_id));
      if (pool.length === 0) break;
      // 보스 보상은 레어 1개 보장 (P06 §7)
      const needRare = bossReward && picked.length === 0;
      const weighted = pool.filter((o) => !needRare || o.rarity !== 'common');
      const src = weighted.length > 0 ? weighted : pool;
      const total = src.reduce((s, o) => s + RARITY_WEIGHT[o.rarity], 0);
      let r = this.rng() * total;
      let chosen = src[src.length - 1]!;
      for (const o of src) {
        r -= RARITY_WEIGHT[o.rarity];
        if (r <= 0) {
          chosen = o;
          break;
        }
      }
      picked.push(chosen);
      // 축 규칙: 3번째 선택에서 축이 전부 같으면 다른 축 강제
      if (picked.length === 3 && new Set(picked.map((p) => p.axis)).size < 2) {
        const alt = pool.find((o) => o.axis !== picked[0]!.axis && !picked.some((p) => p.option_id === o.option_id));
        if (alt) picked[2] = alt;
      }
    }
    return picked;
  }
}

/** PRG-03: 선택 누적 상태 + 효과 조회 (전투 시스템 연결점). */
export class GrowthState {
  private stacks = new Map<string, number>();
  private skillDmg = new Map<string, number>();
  private skillRange = new Map<string, number>();
  private allDmg = 0;
  kiGainMul = 1;
  parryPoiseBonus = 0;
  parryKiBonus = 0;
  maxHpTotal = 0;    // 누적 최대체력 (부활 시 재적용용)
  pendingHeal = 0;   // 씬이 소비
  pendingGold = 0;

  stacksOf(id: string): number {
    return this.stacks.get(id) ?? 0;
  }

  get picks(): Array<{ id: string; stacks: number }> {
    return [...this.stacks.entries()].map(([id, stacks]) => ({ id, stacks }));
  }

  apply(o: GrowthOption): void {
    this.stacks.set(o.option_id, this.stacksOf(o.option_id) + 1);
    this.applyEffect(o.effect);
  }

  applyEffect(e: GrowthEffect): void {
    switch (e.kind) {
      case 'dmg_skill':
        this.skillDmg.set(e.skill_id, (this.skillDmg.get(e.skill_id) ?? 0) + e.mul);
        break;
      case 'dmg_all':
        this.allDmg += e.mul;
        break;
      case 'range_skill':
        this.skillRange.set(e.skill_id, (this.skillRange.get(e.skill_id) ?? 0) + e.mul);
        break;
      case 'ki_gain':
        this.kiGainMul += e.mul;
        break;
      case 'parry_poise':
        this.parryPoiseBonus += e.add;
        break;
      case 'parry_ki':
        this.parryKiBonus += e.add;
        break;
      case 'heal':
        this.pendingHeal += e.ratio;
        break;
      case 'gold':
        this.pendingGold += e.add;
        break;
      case 'max_hp':
        // 씬에서 PlayerCombat에 반영 (pendingMaxHp), maxHpTotal은 부활 재적용용 누적
        this.pendingMaxHp += e.add;
        this.maxHpTotal += e.add;
        break;
    }
  }

  pendingMaxHp = 0;

  /** 공격 배율 (AttackEvent.modifier_mul로 전달). */
  damageMulFor(skillId: string): number {
    return (1 + (this.skillDmg.get(skillId) ?? 0)) * (1 + this.allDmg);
  }

  /** 사거리/범위 배율 (AttackEvent.range_mul로 전달 — 진화). */
  rangeMulFor(skillId: string): number {
    return 1 + (this.skillRange.get(skillId) ?? 0);
  }
}
