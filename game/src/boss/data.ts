// BOS-01: 보스 패턴 스키마 + 데이터 (P06 §5).
// B1 노병 = 상세 확정 (P06 §6). B2~B5·M2~M5 = 구조 동일 데이터 (기믹 상세는 스토리 확정 후 보강 — BOS-06 노트).
import { TELEGRAPH_MIN, type TelegraphType } from '../enemy/data.ts';
import type { DuelZone } from '../duel/duel.ts';

export interface BossPattern {
  pattern_id: string;
  boss_id: string;
  phase: number;
  zone: DuelZone | 'any';
  telegraph: { type: TelegraphType; ms: number };
  /** 타격 시퀀스: telegraph 종료 기준 상대 시각. */
  strikes: Array<{ at_ms: number; damage: number; range: number; telegraph?: TelegraphType; unstoppable?: boolean }>;
  opening_ms: number; // 패턴 종료 후 빈틈 (반격 창) — 필수 (P06 §5)
  cooldown_ms: number;
  weight: number;
  tests_skill: string;
  /** 패턴 중 이동 (유닛, +=플레이어 방향). */
  approach: number;
}

export interface BossDef {
  boss_id: string;
  name: string;
  title: string;
  hp: number;
  poise_max: number;
  radius: number;
  weight: number;
  phases: number[]; // HP 비율 임계 (내림차순). 예: [0.6] = 60%에서 Phase2
  is_miniboss: boolean;
  stage: number;
  version: number;
}

const v = 1;

export const BOSSES: BossDef[] = [
  { boss_id: 'boss_veteran', name: '갈퇴', title: '낡은 검의 노병', hp: 300, poise_max: 300, radius: 0.5, weight: 1.4, phases: [], is_miniboss: false, stage: 1, version: v },
  { boss_id: 'boss_dancer', name: '홍련 무희', title: '쌍검의 배신자', hp: 340, poise_max: 280, radius: 0.45, weight: 1.0, phases: [0.5], is_miniboss: false, stage: 2, version: v },
  { boss_id: 'boss_fortress', name: '철벽 거암', title: '몰락한 성의 수문장', hp: 420, poise_max: 400, radius: 0.6, weight: 1.8, phases: [0.5], is_miniboss: false, stage: 3, version: v },
  { boss_id: 'boss_mirror', name: '그림자 무영', title: '흑월의 암살검', hp: 380, poise_max: 300, radius: 0.45, weight: 1.0, phases: [0.5], is_miniboss: false, stage: 4, version: v },
  { boss_id: 'boss_saint', name: '검성 흑월', title: '찬탈자', hp: 520, poise_max: 380, radius: 0.5, weight: 1.2, phases: [0.6, 0.3], is_miniboss: false, stage: 5, version: v },
  { boss_id: 'mini_captain', name: '산적 두목', title: '', hp: 160, poise_max: 120, radius: 0.5, weight: 1.2, phases: [], is_miniboss: true, stage: 1, version: v },
  { boss_id: 'mini_ranger', name: '사냥꾼', title: '', hp: 150, poise_max: 100, radius: 0.45, weight: 0.9, phases: [], is_miniboss: true, stage: 2, version: v },
  { boss_id: 'mini_twin', name: '쌍둥이 검사', title: '', hp: 180, poise_max: 130, radius: 0.45, weight: 1.0, phases: [], is_miniboss: true, stage: 3, version: v },
  { boss_id: 'mini_juggernaut', name: '파성귀', title: '', hp: 240, poise_max: 180, radius: 0.6, weight: 1.8, phases: [], is_miniboss: true, stage: 4, version: v },
  { boss_id: 'mini_gatekeeper', name: '검문의 수문장', title: '', hp: 220, poise_max: 160, radius: 0.5, weight: 1.2, phases: [], is_miniboss: true, stage: 5, version: v },
];

/** B1 — 낡은 검의 노병: 상세 확정 패턴 3종 (P06 §6). */
const B1: BossPattern[] = [
  {
    pattern_id: 'ptn_vet_overhead', boss_id: 'boss_veteran', phase: 1, zone: 'near',
    telegraph: { type: 'yellow', ms: 800 },
    strikes: [{ at_ms: 100, damage: 14, range: 1.4 }],
    opening_ms: 900, cooldown_ms: 3000, weight: 1.2, tests_skill: 'parry', approach: 0,
  },
  {
    pattern_id: 'ptn_vet_thrust', boss_id: 'boss_veteran', phase: 1, zone: 'mid',
    telegraph: { type: 'yellow', ms: 900 },
    strikes: [{ at_ms: 150, damage: 12, range: 2.4 }],
    opening_ms: 700, cooldown_ms: 4000, weight: 1.0, tests_skill: 'iaido', approach: 1.6,
  },
  {
    pattern_id: 'ptn_vet_quake', boss_id: 'boss_veteran', phase: 1, zone: 'near',
    telegraph: { type: 'red', ms: 600 },
    strikes: [{ at_ms: 120, damage: 20, range: 2.0 }],
    opening_ms: 1100, cooldown_ms: 5000, weight: 0.8, tests_skill: 'dodge', approach: 0,
  },
];

/** B2~B5·미니보스 — 구조 동일 초안 패턴 (기믹 상세 보강 예정, BOS-06). */
function ptn(
  id: string, boss: string, phase: number, zone: BossPattern['zone'],
  type: TelegraphType, ms: number, dmg: number, range: number,
  opening: number, cd: number, tests: string, approach = 0, weight = 1,
): BossPattern {
  return {
    pattern_id: id, boss_id: boss, phase, zone,
    telegraph: { type, ms }, strikes: [{ at_ms: 120, damage: dmg, range }],
    opening_ms: opening, cooldown_ms: cd, weight, tests_skill: tests, approach,
  };
}

const OTHERS: BossPattern[] = [
  // B2 무희 (리듬·연쇄 패링) — 4패턴
  ptn('ptn_dan_flurry', 'boss_dancer', 1, 'near', 'yellow', 700, 8, 1.2, 700, 2800, 'parry'),
  ptn('ptn_dan_cross', 'boss_dancer', 1, 'near', 'yellow', 750, 10, 1.3, 800, 3200, 'parry'),
  ptn('ptn_dan_spin', 'boss_dancer', 1, 'mid', 'red', 650, 16, 2.2, 900, 4500, 'dodge', 1.2),
  ptn('ptn_dan_waltz', 'boss_dancer', 2, 'any', 'yellow', 700, 9, 1.5, 700, 3000, 'slash_diag'),
  // B3 거암 (가드·자세) — 4패턴
  ptn('ptn_for_bash', 'boss_fortress', 1, 'near', 'yellow', 850, 14, 1.4, 900, 3400, 'slash_v'),
  ptn('ptn_for_wall', 'boss_fortress', 1, 'mid', 'yellow', 900, 12, 2.0, 800, 3800, 'slash_v', 1.0),
  ptn('ptn_for_crush', 'boss_fortress', 1, 'near', 'red', 700, 24, 2.2, 1200, 5200, 'dodge'),
  ptn('ptn_for_rage', 'boss_fortress', 2, 'any', 'red', 600, 20, 2.6, 1000, 4800, 'dodge', 1.4),
  // B4 무영 (미러·카운터) — 5패턴
  ptn('ptn_mir_iaido', 'boss_mirror', 1, 'mid', 'yellow', 700, 15, 2.6, 700, 3200, 'parry', 2.0),
  ptn('ptn_mir_cross', 'boss_mirror', 1, 'near', 'yellow', 720, 12, 1.4, 750, 3000, 'parry'),
  ptn('ptn_mir_shadow', 'boss_mirror', 1, 'far', 'red', 800, 18, 4.0, 900, 5000, 'dodge', 3.0),
  ptn('ptn_mir_feint', 'boss_mirror', 2, 'near', 'yellow', 700, 13, 1.4, 650, 2800, 'parry'),
  ptn('ptn_mir_flash', 'boss_mirror', 2, 'mid', 'red', 700, 22, 3.4, 1000, 5600, 'dodge', 2.4),
  // B5 흑월 (종합) — 6패턴
  ptn('ptn_snt_form1', 'boss_saint', 1, 'near', 'yellow', 750, 14, 1.5, 700, 3000, 'parry'),
  ptn('ptn_snt_form2', 'boss_saint', 1, 'mid', 'yellow', 800, 16, 2.4, 750, 3400, 'iaido', 1.4),
  ptn('ptn_snt_quake', 'boss_saint', 1, 'near', 'red', 650, 22, 2.2, 1000, 5000, 'dodge'),
  ptn('ptn_snt_chain', 'boss_saint', 2, 'near', 'yellow', 700, 12, 1.5, 700, 3200, 'parry'),
  ptn('ptn_snt_void', 'boss_saint', 2, 'far', 'red', 750, 20, 5.0, 900, 5200, 'dodge', 3.5),
  ptn('ptn_snt_issen', 'boss_saint', 3, 'any', 'red', 900, 32, 6.0, 1300, 7000, 'dodge', 4.0, 1.4),
  // 미니보스 (간소 2패턴씩)
  ptn('ptn_cap_swing', 'mini_captain', 1, 'near', 'yellow', 800, 10, 1.3, 800, 3000, 'slash_h'),
  ptn('ptn_cap_rush', 'mini_captain', 1, 'mid', 'red', 700, 14, 2.6, 900, 4600, 'dodge', 2.0),
  ptn('ptn_rng_shot', 'mini_ranger', 1, 'far', 'red', 850, 12, 6.0, 800, 4200, 'dodge'),
  ptn('ptn_rng_knife', 'mini_ranger', 1, 'near', 'yellow', 700, 9, 1.2, 700, 2800, 'parry'),
  ptn('ptn_twn_left', 'mini_twin', 1, 'near', 'yellow', 700, 8, 1.3, 650, 2600, 'parry'),
  ptn('ptn_twn_right', 'mini_twin', 1, 'near', 'yellow', 750, 8, 1.3, 650, 2600, 'parry'),
  ptn('ptn_jug_smash', 'mini_juggernaut', 1, 'near', 'red', 800, 24, 2.0, 1100, 5000, 'dodge'),
  ptn('ptn_jug_press', 'mini_juggernaut', 1, 'mid', 'yellow', 900, 16, 2.2, 900, 3800, 'slash_up', 1.2),
  ptn('ptn_gtk_form', 'mini_gatekeeper', 1, 'near', 'yellow', 750, 13, 1.4, 750, 3000, 'parry'),
  ptn('ptn_gtk_charge', 'mini_gatekeeper', 1, 'mid', 'red', 700, 18, 3.0, 950, 5000, 'dodge', 2.2),
];

export const BOSS_PATTERNS: BossPattern[] = [...B1, ...OTHERS];

const bossById = new Map(BOSSES.map((b) => [b.boss_id, b]));

export function getBoss(id: string): BossDef | undefined {
  return bossById.get(id);
}

export function patternsOf(bossId: string): BossPattern[] {
  return BOSS_PATTERNS.filter((p) => p.boss_id === bossId);
}

/** BOS-01 검증: telegraph 최소시간·빈틈 필수·phase 유효 (P06 §9). */
export function validateBossData(): string[] {
  const errors: string[] = [];
  for (const b of BOSSES) {
    const pats = patternsOf(b.boss_id);
    if (pats.length === 0) errors.push(`no_patterns:${b.boss_id}`);
    const maxPhase = b.phases.length + 1;
    for (const p of pats) {
      if (p.telegraph.ms < TELEGRAPH_MIN[p.telegraph.type]) errors.push(`telegraph_short:${p.pattern_id}`);
      if (p.opening_ms <= 0) errors.push(`no_opening:${p.pattern_id}`); // "때릴 타이밍 없는 보스" 금지
      if (p.phase < 1 || p.phase > maxPhase) errors.push(`bad_phase:${p.pattern_id}`);
      if (p.strikes.length === 0) errors.push(`no_strike:${p.pattern_id}`);
    }
    // 패턴 수 규칙: 보스 3~6 (P06 §1), 미니 2~3
    const n = pats.length;
    if (!b.is_miniboss && (n < 3 || n > 6)) errors.push(`pattern_count:${b.boss_id}:${n}`);
    if (b.is_miniboss && (n < 2 || n > 3)) errors.push(`pattern_count:${b.boss_id}:${n}`);
  }
  return errors;
}
