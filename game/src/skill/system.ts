// SKL-02/04/06/07: Grade 판정 + Stamina + ChainRecorder(오의) + KiGauge(검기).
import { BALANCE, type GradeKey } from '../data/balance.ts';
import { KI_WAVE_BY_SKILL, SECRET_ART_RULES } from './data.ts';

export type Grade = GradeKey | 'miss';

/** SKL-02: score → grade (경계는 balance.grades). */
export function gradeOf(score: number, success: boolean): Grade {
  if (!success && score < BALANCE.grades.bad.min) return 'miss';
  const g = BALANCE.grades;
  if (score >= g.perfect.min) return 'perfect';
  if (score >= g.great.min) return 'great';
  if (score >= g.good.min) return 'good';
  if (score >= g.bad.min) return 'bad';
  return 'miss';
}

export function gradeMul(grade: Grade): number {
  if (grade === 'miss') return 0;
  return BALANCE.grades[grade].mul;
}

export function cancelRatio(grade: Grade): number {
  if (grade === 'miss') return 1;
  return BALANCE.grades[grade].cancel_ratio;
}

const GRADE_ORDER: Record<Exclude<Grade, 'miss'>, number> = { bad: 0, good: 1, great: 2, perfect: 3 };

export function gradeAtLeast(g: Grade, min: 'good' | 'great' | 'perfect'): boolean {
  if (g === 'miss' || g === 'bad') return false;
  return GRADE_ORDER[g] >= GRADE_ORDER[min];
}

/** SKL-04: 기력. 회복은 update(now)에서 시간 기반 (결정론). */
export class Stamina {
  private value: number;
  private lastUpdate: number;
  private regenPausedUntil = 0;

  constructor(now: number, initial = BALANCE.player.max_stamina) {
    this.value = initial;
    this.lastUpdate = now;
  }

  get current(): number {
    return this.value;
  }

  update(now: number, executing: boolean): void {
    const dt = Math.max(0, now - this.lastUpdate);
    this.lastUpdate = now;
    if (executing || now < this.regenPausedUntil) return;
    this.value = Math.min(BALANCE.player.max_stamina, this.value + (BALANCE.player.stamina_regen_per_s * dt) / 1000);
  }

  /** 소모 시도. 부족하면 false (불발 — "지침" 상태 금지, P02 §6). */
  trySpend(cost: number): boolean {
    if (this.value < cost) return false;
    this.value -= cost;
    return true;
  }

  onPlayerHit(now: number): void {
    this.regenPausedUntil = now + BALANCE.player.stamina_regen_pause_on_hit_ms;
  }

  onParrySuccess(): void {
    this.value = Math.min(BALANCE.player.max_stamina, this.value + BALANCE.player.parry_success_stamina);
  }
}

/** SKL-07: 검기 게이지. */
export class KiGauge {
  private value = 0;

  get current(): number {
    return this.value;
  }

  get full(): boolean {
    return this.value >= BALANCE.ki.max;
  }

  onHitLanded(grade: Grade, kiGainMul: number): void {
    this.value = Math.min(BALANCE.ki.max, this.value + BALANCE.ki.per_hit * gradeMul(grade) * kiGainMul);
  }

  onPlayerHit(): void {
    this.value = Math.floor(this.value * BALANCE.ki.on_player_hit_ratio);
  }

  /** 직접 충전 (성장 효과 — 예: 패링 성공 시 검기 +N). */
  addRaw(v: number): void {
    this.value = Math.min(BALANCE.ki.max, this.value + v);
  }

  /** 만충 + 퍼펙트 스킬 → 검기 발동 여부/종류 (P02 §8). 발동 시 게이지 0. */
  tryRelease(skillId: string, grade: Grade): string | null {
    if (!this.full || grade !== 'perfect') return null;
    const wave = KI_WAVE_BY_SKILL[skillId];
    if (!wave) return null;
    this.value = 0;
    return wave;
  }
}

interface ChainEntry {
  skill_id: string;
  grade: Grade;
  active_end_ms: number;
}

/** SKL-06: 오의 성립 판정 — 최근 체인 기록 (P02 §7). */
export class ChainRecorder {
  private entries: ChainEntry[] = [];

  record(skillId: string, grade: Grade, activeEndMs: number): void {
    this.entries.push({ skill_id: skillId, grade, active_end_ms: activeEndMs });
    if (this.entries.length > BALANCE.chain.max_entries) this.entries.shift();
  }

  /**
   * 현재 스킬 실행 직전 호출: [직전 스킬, 현재 스킬]이 오의 조건을 만족하면 art_id 반환.
   * 성립 실패는 무음 (일반 스킬 정상 실행).
   */
  matchSecretArt(currentSkillId: string, currentGrade: Grade, nowMs: number): string | null {
    const prev = this.entries[this.entries.length - 1];
    if (!prev) return null;
    if (nowMs - prev.active_end_ms > BALANCE.chain.window_ms) return null;
    for (const rule of SECRET_ART_RULES) {
      if (rule.chain[0] !== prev.skill_id || rule.chain[1] !== currentSkillId) continue;
      if (rule.prev_perfect && prev.grade !== 'perfect') continue;
      if (!rule.prev_perfect && !gradeAtLeast(prev.grade, rule.min_grade)) continue;
      if (!gradeAtLeast(currentGrade, rule.min_grade)) continue;
      return rule.art_id;
    }
    return null;
  }

  reset(): void {
    this.entries.length = 0;
  }
}
