// ENM-01: 적 스키마 + 12종 데이터 (P04 §5/§7). 수치는 초기값 (Balance 대상).
// Telegraph 규격: 노랑 ≥700ms(패링 가능), 빨강 ≥500ms(회피 강제) — P04 §4.

export type TelegraphType = 'yellow' | 'red';

export interface EnemyAttack {
  attack_id: string;
  telegraph: TelegraphType;
  telegraph_ms: number;
  damage: number;
  range: number;      // 유닛
  cooldown_ms: number;
  poise_self: number; // 시전 중 슈퍼아머 보정용 (미사용 시 0)
}

export interface AiProfile {
  move_speed: number;      // 유닛/초
  preferred_range: number; // 이 거리까지 접근
  aggression_ms: number;   // 공격 시도 간 최소 간격
}

export interface EnemyDef {
  enemy_id: string;
  name: string;
  hp: number;
  poise_max: number;
  weight: number;
  radius: number;
  guard_front: boolean;
  guard_gauge: number;
  super_armor: boolean;
  weak_point: string | null;
  elite: boolean;
  teach_goal: string;
  attacks: EnemyAttack[];
  ai: AiProfile;
  version: number;
}

export const TELEGRAPH_MIN = { yellow: 700, red: 500 } as const;

const v = 1;
const ai = (move_speed: number, preferred_range: number, aggression_ms: number): AiProfile =>
  ({ move_speed, preferred_range, aggression_ms });

/** 적 12종 (P04 §5 표 그대로). */
export const ENEMIES: EnemyDef[] = [
  {
    enemy_id: 'soldier', name: '잡병', hp: 40, poise_max: 40, weight: 1, radius: 0.4,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: null, elite: false,
    teach_goal: 'basic_rhythm',
    attacks: [{ attack_id: 'sol_slash', telegraph: 'yellow', telegraph_ms: 800, damage: 8, range: 1.0, cooldown_ms: 2600, poise_self: 0 }],
    ai: ai(1.6, 0.9, 1200), version: v,
  },
  {
    enemy_id: 'spear', name: '창병', hp: 45, poise_max: 45, weight: 1, radius: 0.4,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: 'iaido', elite: false,
    teach_goal: 'spacing',
    attacks: [{ attack_id: 'spr_thrust', telegraph: 'yellow', telegraph_ms: 900, damage: 12, range: 2.2, cooldown_ms: 3200, poise_self: 0 }],
    ai: ai(1.2, 2.0, 1600), version: v,
  },
  {
    enemy_id: 'hound', name: '들개', hp: 18, poise_max: 20, weight: 0.6, radius: 0.35,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: 'spin', elite: false,
    teach_goal: 'crowd_control',
    attacks: [{ attack_id: 'hnd_bite', telegraph: 'yellow', telegraph_ms: 700, damage: 5, range: 0.7, cooldown_ms: 2000, poise_self: 0 }],
    ai: ai(2.6, 0.6, 900), version: v,
  },
  {
    enemy_id: 'archer', name: '궁수', hp: 30, poise_max: 30, weight: 0.8, radius: 0.4,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: 'iaido', elite: false,
    teach_goal: 'mobility_dodge',
    attacks: [{ attack_id: 'arc_shot', telegraph: 'red', telegraph_ms: 900, damage: 10, range: 8.0, cooldown_ms: 3600, poise_self: 0 }],
    ai: ai(1.4, 5.5, 2000), version: v,
  },
  {
    enemy_id: 'swift', name: '쾌검사', hp: 34, poise_max: 35, weight: 0.9, radius: 0.4,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: 'slash_diag', elite: false,
    teach_goal: 'speed_duel',
    attacks: [
      { attack_id: 'swf_double', telegraph: 'yellow', telegraph_ms: 700, damage: 7, range: 1.1, cooldown_ms: 2400, poise_self: 0 },
    ],
    ai: ai(2.4, 1.0, 1000), version: v,
  },
  {
    enemy_id: 'shield', name: '방패병', hp: 90, poise_max: 80, weight: 1.2, radius: 0.45,
    guard_front: true, guard_gauge: 60, super_armor: false, weak_point: 'slash_v', elite: false,
    teach_goal: 'parry_guardbreak',
    attacks: [{ attack_id: 'shd_bash', telegraph: 'yellow', telegraph_ms: 850, damage: 10, range: 1.0, cooldown_ms: 3400, poise_self: 20 }],
    ai: ai(1.0, 0.9, 1800), version: v,
  },
  {
    enemy_id: 'dual', name: '쌍검사', hp: 50, poise_max: 45, weight: 1, radius: 0.4,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: 'parry', elite: false,
    teach_goal: 'chain_parry_rhythm',
    attacks: [
      { attack_id: 'dul_combo', telegraph: 'yellow', telegraph_ms: 750, damage: 6, range: 1.0, cooldown_ms: 3000, poise_self: 0 },
    ],
    ai: ai(2.0, 0.9, 1400), version: v,
  },
  {
    enemy_id: 'heavy', name: '중갑귀', hp: 140, poise_max: 70, weight: 1.6, radius: 0.55,
    guard_front: false, guard_gauge: 0, super_armor: true, weak_point: 'slash_up', elite: false,
    teach_goal: 'poise_battle',
    attacks: [{ attack_id: 'hvy_smash', telegraph: 'red', telegraph_ms: 1000, damage: 22, range: 1.4, cooldown_ms: 4200, poise_self: 40 }],
    ai: ai(0.8, 1.1, 2200), version: v,
  },
  {
    enemy_id: 'berserk', name: '광전사', hp: 70, poise_max: 55, weight: 1.1, radius: 0.45,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: null, elite: false,
    teach_goal: 'red_dodge',
    attacks: [{ attack_id: 'brk_rush', telegraph: 'red', telegraph_ms: 700, damage: 16, range: 3.0, cooldown_ms: 3800, poise_self: 10 }],
    ai: ai(2.2, 2.5, 1600), version: v,
  },
  {
    enemy_id: 'caster', name: '주술사', hp: 26, poise_max: 25, weight: 0.8, radius: 0.4,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: null, elite: false,
    teach_goal: 'priority_target',
    attacks: [{ attack_id: 'cst_hex', telegraph: 'red', telegraph_ms: 1200, damage: 8, range: 7.0, cooldown_ms: 5000, poise_self: 0 }],
    ai: ai(1.0, 6.0, 2600), version: v,
  },
  {
    enemy_id: 'shadow', name: '그림자검사', hp: 60, poise_max: 50, weight: 1, radius: 0.4,
    guard_front: false, guard_gauge: 0, super_armor: false, weak_point: 'iaido', elite: false,
    teach_goal: 'iaido_counter',
    attacks: [
      { attack_id: 'sdw_mirror', telegraph: 'yellow', telegraph_ms: 700, damage: 12, range: 1.4, cooldown_ms: 2800, poise_self: 0 },
    ],
    ai: ai(2.2, 1.3, 1300), version: v,
  },
  {
    enemy_id: 'knight', name: '정예기사', hp: 160, poise_max: 90, weight: 1.3, radius: 0.5,
    guard_front: true, guard_gauge: 80, super_armor: false, weak_point: null, elite: true,
    teach_goal: 'synthesis',
    attacks: [
      { attack_id: 'kgt_slash', telegraph: 'yellow', telegraph_ms: 750, damage: 12, range: 1.2, cooldown_ms: 2800, poise_self: 10 },
      { attack_id: 'kgt_charge', telegraph: 'red', telegraph_ms: 800, damage: 18, range: 2.6, cooldown_ms: 5200, poise_self: 20 },
    ],
    ai: ai(1.4, 1.1, 1500), version: v,
  },
];

const byId = new Map(ENEMIES.map((e) => [e.enemy_id, e]));

export function getEnemy(id: string): EnemyDef | undefined {
  return byId.get(id);
}

/** ENM-01/03 데이터 검증: Telegraph 최소 시간(P04 §4) 등. */
export function validateEnemies(list: EnemyDef[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const e of list) {
    if (seen.has(e.enemy_id)) errors.push(`dup:${e.enemy_id}`);
    seen.add(e.enemy_id);
    if (e.hp <= 0 || e.poise_max <= 0) errors.push(`bad_stat:${e.enemy_id}`);
    if (e.attacks.length === 0) errors.push(`no_attack:${e.enemy_id}`);
    if (e.teach_goal.length === 0) errors.push(`no_teach_goal:${e.enemy_id}`); // "적은 선생님" 강제
    for (const a of e.attacks) {
      if (a.telegraph_ms < TELEGRAPH_MIN[a.telegraph]) {
        errors.push(`telegraph_too_short:${e.enemy_id}:${a.attack_id}`);
      }
      if (a.damage <= 0 || a.range <= 0 || a.cooldown_ms <= 0) errors.push(`bad_attack:${a.attack_id}`);
    }
  }
  return errors;
}
