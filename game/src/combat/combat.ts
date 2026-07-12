// CBT-01~08: 히트 기하 + Hit 파이프라인 + 데미지 공식 + Poise/그로기/가드 + 콤보 + 플레이어 + 이벤트.
// 순수 TS — 좌표는 월드 단위(unit). 횡스크롤이므로 방향은 부호(+1 우 / -1 좌)로 축약 (P03 §3, ADR-012).
import { BALANCE } from '../data/balance.ts';
import type { HitShape, SkillDef } from '../skill/data.ts';
import { getSkill } from '../skill/data.ts';
import type { Grade } from '../skill/system.ts';
import { gradeMul } from '../skill/system.ts';

// ── 대상 (적) ─────────────────────────────────────────
export interface Combatant {
  id: string;
  x: number;
  y: number;
  radius: number;
  hp: number;
  max_hp: number;
  poise: number;      // 누적치 (0에서 시작, max 도달 시 그로기)
  poise_max: number;
  weight: number;     // 넉백 역보정
  guard_front: boolean;
  guard_gauge: number;
  guard_gauge_max: number;
  super_armor: boolean;
  weak_point: string | null; // 약점 skill_id
  elite: boolean;
  facing: 1 | -1;
  // 상태
  groggy_until_ms: number;
  last_poise_hit_ms: number;
  alive: boolean;
}

export function makeCombatant(partial: Partial<Combatant> & { id: string; x: number }): Combatant {
  return {
    y: 0, radius: 0.4, hp: 40, max_hp: 40, poise: 0, poise_max: 60, weight: 1,
    guard_front: false, guard_gauge: 90, guard_gauge_max: 90, super_armor: false,
    weak_point: null, elite: false, facing: -1,
    groggy_until_ms: 0, last_poise_hit_ms: 0, alive: true,
    ...partial,
  };
}

// ── CBT-01: 히트 기하 (스냅샷 판정) ──────────────────
export interface AttackOrigin {
  x: number;
  y: number;
  dir: 1 | -1; // 공격 방향 (횡스크롤 좌우)
}

/** 형상 안 판정: arc(전방 부채꼴 → 횡스크롤에선 전방 반원 근사), line(전방 직사각), circle(원). */
export function inShape(shape: HitShape, o: AttackOrigin, t: { x: number; y: number; radius: number }): boolean {
  const dx = t.x - o.x;
  const dy = t.y - o.y;
  const dist = Math.hypot(dx, dy);
  switch (shape.type) {
    case 'circle':
      return dist <= shape.range + t.radius;
    case 'arc': {
      if (dist > shape.range + t.radius) return false;
      // 전방 판정: 방향 부호 일치 (반각 90° 이상이면 사실상 전방 반원)
      if (dist <= t.radius) return true; // 겹침
      const angle = Math.abs((Math.atan2(dy, dx * o.dir) * 180) / Math.PI);
      return angle <= shape.angle_deg / 2 + 15; // 여유 15° (횡스크롤 근사)
    }
    case 'line':
    case 'projectile': {
      const fx = dx * o.dir; // 전방 거리
      if (fx < -t.radius || fx > shape.range + t.radius) return false;
      return Math.abs(dy) <= shape.width / 2 + t.radius;
    }
  }
}

// ── CBT-05: 반응 종류 ─────────────────────────────────
export type Reaction = 'push' | 'flinch' | 'guarded' | 'guard_break' | 'groggy' | 'dead';

export interface HitResult {
  attack_id: number;
  target_id: string;
  skill_id: string;
  damage: number;
  poise_damage: number;
  reaction: Reaction;
  weakness_hit: boolean;
  counter: boolean;
  groggy_bonus: boolean;
  knockback: number;
  profile: string; // P12 이벤트 프로파일 ID
}

export interface AttackEvent {
  attack_id: number;
  skill_id: string;
  grade: Grade;
  origin: AttackOrigin;
  combo: number;
  counter: boolean;
  modifier_mul: number; // 장비/성장 (P08 — M-D에서 연결, 기본 1)
  /** 성장/진화: 사거리·범위 배율 (PRG-04 — 검술 진화는 플레이 방식을 바꾼다). */
  range_mul?: number;
}

/** 형상 스케일 (진화·장비의 사거리/범위 효과). */
export function scaleShape(shape: HitShape, mul: number): HitShape {
  if (mul === 1) return shape;
  switch (shape.type) {
    case 'arc':
      return { ...shape, range: shape.range * mul };
    case 'circle':
      return { ...shape, range: shape.range * mul };
    case 'line':
    case 'projectile':
      return { ...shape, range: shape.range * mul, width: shape.width * Math.sqrt(mul) };
  }
}

// ── CBT-06: 콤보 ──────────────────────────────────────
export class ComboTracker {
  private count = 0;
  private lastHit = -Infinity;

  get current(): number {
    return this.count;
  }

  onHit(now: number): number {
    if (now - this.lastHit > BALANCE.combo.reset_ms) this.count = 0;
    this.count++;
    this.lastHit = now;
    return this.count;
  }

  update(now: number): void {
    if (this.count > 0 && now - this.lastHit > BALANCE.combo.reset_ms) this.count = 0;
  }

  reset(): void {
    this.count = 0;
  }

  mul(): number {
    return Math.min(BALANCE.combo.mul_cap, 1 + BALANCE.combo.per_hit_mul * this.count);
  }
}

// ── CBT-03: 데미지 공식 (P03 §4) ─────────────────────
export interface DamageInput {
  base: number;
  grade: Grade;
  comboMul: number;
  counter: boolean;
  targetGroggy: boolean;
  modifierMul: number;
  weakness: boolean;
}

export function damageOf(i: DamageInput): number {
  const d =
    i.base *
    gradeMul(i.grade) *
    i.comboMul *
    (i.counter ? BALANCE.damage.counter_mul : 1) *
    (i.targetGroggy ? BALANCE.poise.groggy_damage_mul : 1) *
    i.modifierMul *
    (i.weakness ? BALANCE.damage.weakness_mul : 1);
  return Math.max(BALANCE.damage.min_damage, Math.round(d));
}

// ── CBT-04: Poise 갱신 ────────────────────────────────
export function updatePoise(c: Combatant, now: number): void {
  if (c.groggy_until_ms > 0 && now >= c.groggy_until_ms) {
    c.groggy_until_ms = 0;
    c.poise = 0;
  }
  if (c.poise > 0 && now - c.last_poise_hit_ms > BALANCE.poise.decay_delay_ms) {
    const dt = now - Math.max(c.last_poise_hit_ms + BALANCE.poise.decay_delay_ms, now - 100);
    c.poise = Math.max(0, c.poise - c.poise_max * BALANCE.poise.decay_per_s_ratio * (dt / 1000));
  }
}

export function isGroggy(c: Combatant, now: number): boolean {
  return now < c.groggy_until_ms;
}

/** 그로기 부여 (패링 성공·가드 브레이크·poise 만충). */
export function applyPoise(c: Combatant, amount: number, now: number): boolean {
  c.poise += amount;
  c.last_poise_hit_ms = now;
  if (c.poise >= c.poise_max && c.groggy_until_ms <= now) {
    c.groggy_until_ms = now + (c.elite ? BALANCE.poise.groggy_ms_elite : BALANCE.poise.groggy_ms_normal);
    return true;
  }
  return false;
}

// ── CBT-02/05/08: 공격 해석 ───────────────────────────
let nextAttackId = 1;

export function newAttackId(): number {
  return nextAttackId++;
}

function profileFor(def: SkillDef, reaction: Reaction, grade: Grade): string {
  if (reaction === 'dead') return 'finish_wave';
  if (reaction === 'guard_break' || def.category === 'secret') return 'hit_heavy';
  if (grade === 'perfect' || reaction === 'groggy') return 'hit_medium';
  if (reaction === 'guarded') return 'hit_guard';
  return 'hit_light';
}

/**
 * CBT-02: AttackEvent → 대상 목록 판정 → HitResult[].
 * 중복 방지: 스냅샷 1회 판정이므로 대상당 최대 1건 (다단히트는 hit_count 반복이 아니라 damage에 명시된 설계).
 */
export function resolveAttack(
  attack: AttackEvent,
  targets: Combatant[],
  now: number,
): HitResult[] {
  const def = getSkill(attack.skill_id);
  if (!def || !def.hit_shape) return [];
  const shape = scaleShape(def.hit_shape, attack.range_mul ?? 1);
  const results: HitResult[] = [];
  const hitSet = new Set<string>();

  for (const t of targets) {
    if (!t.alive || hitSet.has(t.id)) continue;
    if (!inShape(shape, attack.origin, t)) continue;
    hitSet.add(t.id);

    const groggy = isGroggy(t, now);
    // 가드 판정: 정면 가드 + 관통 아님 + 그로기 아님
    const attackFromFront = attack.origin.dir !== t.facing; // 서로 마주봄 = 정면
    const guarded = t.guard_front && attackFromFront && !def.pierce_guard && !groggy;

    const weakness = t.weak_point === attack.skill_id;
    let damage = damageOf({
      base: def.damage * (def.hit_count > 1 ? def.hit_count : 1),
      grade: attack.grade,
      comboMul: 1 + Math.min(BALANCE.combo.mul_cap - 1, BALANCE.combo.per_hit_mul * attack.combo),
      counter: attack.counter,
      targetGroggy: groggy,
      modifierMul: attack.modifier_mul,
      weakness,
    });

    let reaction: Reaction;
    let poiseDmg = def.poise_damage;
    if (guarded) {
      damage = Math.max(BALANCE.damage.min_damage, Math.round(damage * BALANCE.damage.guard_damage_ratio));
      t.guard_gauge -= def.poise_damage + def.damage * 0.5;
      if (t.guard_gauge <= 0) {
        t.guard_gauge = 0;
        t.guard_front = false; // 가드 브레이크 — 방패 소실
        reaction = 'guard_break';
        poiseDmg = def.poise_damage * 2;
      } else {
        reaction = 'guarded';
        poiseDmg = Math.round(def.poise_damage * 0.3);
      }
    } else {
      reaction = t.super_armor ? 'push' : 'flinch';
    }

    t.hp -= damage;
    const becameGroggy = applyPoise(t, poiseDmg, now);
    // 반응 우선순위: dead > guard_break > groggy (동시 발생 시 브레이크 연출 우선, 그로기 상태는 유지)
    if (becameGroggy && reaction !== 'guard_break') reaction = 'groggy';
    if (t.hp <= 0) {
      t.hp = 0;
      t.alive = false;
      reaction = 'dead';
    }

    const knockback = reaction === 'guarded' ? 0.1 : (0.3 * gradeMul(attack.grade)) / t.weight;

    results.push({
      attack_id: attack.attack_id,
      target_id: t.id,
      skill_id: attack.skill_id,
      damage,
      poise_damage: poiseDmg,
      reaction,
      weakness_hit: weakness,
      counter: attack.counter,
      groggy_bonus: groggy,
      knockback,
      profile: profileFor(def, reaction, attack.grade),
    });
  }
  return results;
}

// ── CBT-07: 플레이어 상태 ─────────────────────────────
export class PlayerCombat {
  hp: number = BALANCE.player.max_hp;
  maxHp: number = BALANCE.player.max_hp;
  private iframeUntil = 0;
  private staggerUntil = 0;
  private dodgeCounterUntil = 0;
  readonly combo = new ComboTracker();

  get alive(): boolean {
    return this.hp > 0;
  }

  invulnerable(now: number): boolean {
    return now < this.iframeUntil;
  }

  staggered(now: number): boolean {
    return now < this.staggerUntil;
  }

  /** 성장: 최대 체력 증가 (증가분만큼 현재 체력도 회복 — 즉시 체감 원칙). */
  addMaxHp(add: number): void {
    this.maxHp += add;
    this.hp += add;
  }

  heal(ratio: number): void {
    this.hp = Math.min(this.maxHp, this.hp + Math.round(this.maxHp * ratio));
  }

  /** 회피 실행 → i-frame + 반격 창. */
  onDodge(now: number): void {
    this.iframeUntil = now + BALANCE.dodge.iframe_ms;
    this.dodgeCounterUntil = now + BALANCE.dodge.iframe_ms + BALANCE.dodge.counter_window_ms;
  }

  /** 회피 반격 보정 활성? */
  dodgeCounterActive(now: number): boolean {
    return now < this.dodgeCounterUntil;
  }

  /**
   * 피격 시도. i-frame이면 무시(false). 성공 시 피해 적용 + 경직 + 무적 + 콤보 리셋.
   * 단일 피해 상한: max_hp의 40% (보스 필살 태그 제외 — P03 §8).
   */
  tryHit(rawDamage: number, now: number, opts: { unstoppable?: boolean } = {}): boolean {
    if (!this.alive) return false;
    if (this.invulnerable(now)) return false;
    const cap = opts.unstoppable ? rawDamage : Math.min(rawDamage, Math.floor(this.maxHp * BALANCE.player.max_single_hit_ratio));
    this.hp = Math.max(0, this.hp - cap);
    this.staggerUntil = now + BALANCE.player.hit_stagger_ms;
    this.iframeUntil = now + BALANCE.player.hit_iframe_ms;
    this.combo.reset();
    return true;
  }
}

// ── 패링 해석 (P05 연계 전 최소 규칙) ─────────────────
export interface ParryOutcome {
  success: boolean;
  poise_to_attacker: number;
}

/** 패링 판정: 적 공격 적중 예정 시각과 패링 active 창의 교차 (판정 시점 = 긋기 완료, Bible §2.8-2). */
export function resolveParry(
  parryActiveStart: number,
  parryActiveEnd: number,
  enemyHitAt: number,
): ParryOutcome {
  const success = enemyHitAt >= parryActiveStart && enemyHitAt <= parryActiveEnd;
  return { success, poise_to_attacker: success ? BALANCE.poise.parry_poise_damage : 0 };
}
