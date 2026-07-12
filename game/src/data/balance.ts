// 밸런스 단일 출처 (Data Architecture §15.6 / P13 §2) — 수치 하드코딩 금지 규칙의 구현.
// 전부 초기값. 추후 balance.json 외부화 + 핫 리로드(BAL-01)에서 JSON으로 이관.

export const BALANCE = {
  grades: {
    // P02 §3
    perfect: { min: 95, mul: 1.3, cancel_ratio: 0.4 },
    great: { min: 90, mul: 1.15, cancel_ratio: 0.55 },
    good: { min: 85, mul: 1.0, cancel_ratio: 0.7 },
    bad: { min: 70, mul: 0.6, cancel_ratio: 1.0 },
  },
  player: {
    max_hp: 100,
    max_stamina: 100,
    stamina_regen_per_s: 12,
    stamina_regen_pause_on_hit_ms: 1000,
    parry_success_stamina: 20,
    hit_stagger_ms: 200,
    hit_iframe_ms: 600,
    max_single_hit_ratio: 0.4, // 억울한 즉사 방지 (P03 §8)
  },
  dodge: {
    distance: 1.2,
    iframe_ms: 240,
    stamina: 15,
    counter_window_ms: 300,
    counter_bonus: 0.15,
  },
  combo: {
    per_hit_mul: 0.05,
    mul_cap: 1.5,
    reset_ms: 2500,
  },
  ki: {
    max: 100,
    per_hit: 8,
    on_player_hit_ratio: 0.5,
  },
  poise: {
    decay_delay_ms: 3000,
    decay_per_s_ratio: 0.2,
    groggy_ms_normal: 3000,
    groggy_ms_elite: 2000,
    groggy_damage_mul: 1.5,
    parry_poise_damage: 60,
  },
  damage: {
    counter_mul: 2.0,
    weakness_mul: 1.3,
    guard_damage_ratio: 0.25, // 가드 시 관통 피해
    min_damage: 1,
  },
  chain: {
    window_ms: 1500, // 오의 연계창 (P02 §7)
    max_entries: 4,
  },
} as const;

export type GradeKey = 'perfect' | 'great' | 'good' | 'bad';
