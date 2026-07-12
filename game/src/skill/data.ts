// SKL-01: Skill 정의 + 8검술/오의5/검기3 데이터 — P02 §9 / Sword Language Bible / Content Data Sheets §1~2.
// 수치는 초기값 (Balance 조정 대상).

export type HitShape =
  | { type: 'arc'; angle_deg: number; range: number }
  | { type: 'line'; width: number; range: number }
  | { type: 'circle'; range: number }
  | { type: 'projectile'; width: number; range: number; speed: number };

export type SkillCategory = 'basic' | 'secret' | 'ki_wave' | 'defense';

export interface SkillDef {
  skill_id: string;
  name: string;
  category: SkillCategory;
  damage: number;
  poise_damage: number;
  stamina_cost: number;
  startup_ms: number;
  active_ms: number;
  recovery_ms: number;
  hit_shape: HitShape | null; // parry 등 self 스킬은 null
  hit_count: number;
  ki_gain_mul: number;
  /** 가드/방패 무시 여부. */
  pierce_guard: boolean;
  version: number;
}

const v = 1;

/** 기본 검술 8 (P02 §9 표). */
export const BASIC_SKILLS: SkillDef[] = [
  { skill_id: 'slash_h', name: '횡베기', category: 'basic', damage: 20, poise_damage: 10, stamina_cost: 8, startup_ms: 60, active_ms: 100, recovery_ms: 240, hit_shape: { type: 'arc', angle_deg: 120, range: 1.6 }, hit_count: 1, ki_gain_mul: 1, pierce_guard: false, version: v },
  { skill_id: 'slash_v', name: '내려베기', category: 'basic', damage: 24, poise_damage: 30, stamina_cost: 12, startup_ms: 110, active_ms: 90, recovery_ms: 320, hit_shape: { type: 'line', width: 0.6, range: 1.4 }, hit_count: 1, ki_gain_mul: 1, pierce_guard: false, version: v },
  { skill_id: 'slash_up', name: '올려베기', category: 'basic', damage: 16, poise_damage: 35, stamina_cost: 10, startup_ms: 80, active_ms: 90, recovery_ms: 280, hit_shape: { type: 'line', width: 0.6, range: 1.3 }, hit_count: 1, ki_gain_mul: 1, pierce_guard: false, version: v },
  { skill_id: 'slash_diag', name: '사선베기', category: 'basic', damage: 12, poise_damage: 8, stamina_cost: 6, startup_ms: 40, active_ms: 80, recovery_ms: 180, hit_shape: { type: 'line', width: 0.5, range: 1.5 }, hit_count: 1, ki_gain_mul: 1, pierce_guard: false, version: v },
  { skill_id: 'iaido', name: '발도술', category: 'basic', damage: 30, poise_damage: 20, stamina_cost: 18, startup_ms: 70, active_ms: 120, recovery_ms: 360, hit_shape: { type: 'line', width: 0.7, range: 2.8 }, hit_count: 1, ki_gain_mul: 1, pierce_guard: false, version: v },
  { skill_id: 'slash_back', name: '역베기', category: 'basic', damage: 18, poise_damage: 10, stamina_cost: 8, startup_ms: 60, active_ms: 100, recovery_ms: 220, hit_shape: { type: 'arc', angle_deg: 120, range: 1.6 }, hit_count: 1, ki_gain_mul: 1, pierce_guard: false, version: v },
  { skill_id: 'spin', name: '회전베기', category: 'basic', damage: 26, poise_damage: 25, stamina_cost: 22, startup_ms: 140, active_ms: 160, recovery_ms: 420, hit_shape: { type: 'circle', range: 1.8 }, hit_count: 1, ki_gain_mul: 1, pierce_guard: false, version: v },
  { skill_id: 'parry', name: '패링', category: 'defense', damage: 0, poise_damage: 0, stamina_cost: 5, startup_ms: 30, active_ms: 120, recovery_ms: 200, hit_shape: null, hit_count: 1, ki_gain_mul: 0, pierce_guard: false, version: v },
];

/** 오의 5 (Content Data Sheets §1). */
export const SECRET_ARTS: SkillDef[] = [
  { skill_id: 'art_gale', name: '연풍참', category: 'secret', damage: 45, poise_damage: 30, stamina_cost: 0, startup_ms: 80, active_ms: 180, recovery_ms: 380, hit_shape: { type: 'arc', angle_deg: 140, range: 2.0 }, hit_count: 2, ki_gain_mul: 1.5, pierce_guard: false, version: v },
  { skill_id: 'art_thunder', name: '낙뢰참', category: 'secret', damage: 70, poise_damage: 60, stamina_cost: 0, startup_ms: 120, active_ms: 140, recovery_ms: 520, hit_shape: { type: 'line', width: 0.8, range: 1.6 }, hit_count: 1, ki_gain_mul: 1.5, pierce_guard: false, version: v },
  { skill_id: 'art_cross', name: '십자참', category: 'secret', damage: 60, poise_damage: 45, stamina_cost: 0, startup_ms: 100, active_ms: 160, recovery_ms: 460, hit_shape: { type: 'arc', angle_deg: 120, range: 1.8 }, hit_count: 1, ki_gain_mul: 1.5, pierce_guard: true, version: v },
  { skill_id: 'art_waltz', name: '원무', category: 'secret', damage: 55, poise_damage: 35, stamina_cost: 0, startup_ms: 140, active_ms: 200, recovery_ms: 420, hit_shape: { type: 'circle', range: 2.0 }, hit_count: 1, ki_gain_mul: 1.5, pierce_guard: false, version: v },
  { skill_id: 'art_flash', name: '일섬', category: 'secret', damage: 90, poise_damage: 80, stamina_cost: 0, startup_ms: 60, active_ms: 100, recovery_ms: 700, hit_shape: { type: 'line', width: 0.9, range: 5.0 }, hit_count: 1, ki_gain_mul: 2, pierce_guard: true, version: v },
];

/** 검기 3 (Content Data Sheets §2). */
export const KI_WAVES: SkillDef[] = [
  { skill_id: 'ki_line', name: '직선 검기(貫)', category: 'ki_wave', damage: 40, poise_damage: 20, stamina_cost: 0, startup_ms: 60, active_ms: 100, recovery_ms: 300, hit_shape: { type: 'projectile', width: 0.8, range: 99, speed: 12 }, hit_count: 1, ki_gain_mul: 0, pierce_guard: true, version: v },
  { skill_id: 'ki_fan', name: '확산 검기(扇)', category: 'ki_wave', damage: 28, poise_damage: 15, stamina_cost: 0, startup_ms: 80, active_ms: 100, recovery_ms: 340, hit_shape: { type: 'projectile', width: 2.4, range: 4, speed: 10 }, hit_count: 3, ki_gain_mul: 0, pierce_guard: true, version: v },
  { skill_id: 'ki_burst', name: '폭렬 검기(爆)', category: 'ki_wave', damage: 50, poise_damage: 40, stamina_cost: 0, startup_ms: 100, active_ms: 80, recovery_ms: 380, hit_shape: { type: 'circle', range: 2.5 }, hit_count: 1, ki_gain_mul: 0, pierce_guard: true, version: v },
];

export const ALL_SKILLS: SkillDef[] = [...BASIC_SKILLS, ...SECRET_ARTS, ...KI_WAVES];

const byId = new Map(ALL_SKILLS.map((s) => [s.skill_id, s]));

export function getSkill(id: string): SkillDef | undefined {
  return byId.get(id);
}

/** SKL-01 데이터 검증 — 로드 시 1회 (Acceptance: 데이터 린트). */
export function validateSkills(skills: SkillDef[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const s of skills) {
    if (seen.has(s.skill_id)) errors.push(`dup_id:${s.skill_id}`);
    seen.add(s.skill_id);
    if (s.damage < 0 || s.stamina_cost < 0) errors.push(`negative:${s.skill_id}`);
    if (s.startup_ms < 0 || s.active_ms <= 0 || s.recovery_ms < 0) errors.push(`bad_timing:${s.skill_id}`);
    if (s.category !== 'defense' && s.hit_shape === null) errors.push(`no_shape:${s.skill_id}`);
    if (s.hit_count < 1) errors.push(`bad_hit_count:${s.skill_id}`);
  }
  return errors;
}

/** 오의 성립 테이블 (P02 §7). chain은 [이전, 현재] 순. */
export interface SecretArtRule {
  art_id: string;
  chain: [string, string];
  min_grade: 'good' | 'great' | 'perfect';
  /** 일섬 전용: 선행 스킬이 퍼펙트여야 함. */
  prev_perfect?: boolean;
}

export const SECRET_ART_RULES: SecretArtRule[] = [
  { art_id: 'art_gale', chain: ['slash_h', 'slash_diag'], min_grade: 'good' },
  { art_id: 'art_thunder', chain: ['slash_up', 'slash_v'], min_grade: 'great' },
  { art_id: 'art_cross', chain: ['slash_h', 'slash_v'], min_grade: 'great' },
  { art_id: 'art_waltz', chain: ['spin', 'slash_diag'], min_grade: 'good' },
  { art_id: 'art_flash', chain: ['iaido', 'iaido'], min_grade: 'good', prev_perfect: true },
];

/** 검기 형태 결정: 만충 + 퍼펙트로 발동한 스킬 → 검기 종류 (P02 §8). */
export const KI_WAVE_BY_SKILL: Record<string, string> = {
  slash_h: 'ki_line',
  iaido: 'ki_line',
  spin: 'ki_fan',
  slash_v: 'ki_burst',
};
