// ENM-02/03/04: Enemy State Machine + Telegraph + 공격 토큰 (P04 §3/§4/§6).
// 순수 TS — 위치는 1D(횡스크롤, ADR-012). 렌더/판정 결과는 콜백으로 연결.
import type { Combatant } from '../combat/combat.ts';
import { isGroggy, makeCombatant } from '../combat/combat.ts';
import type { EnemyAttack, EnemyDef } from './data.ts';

export type EnemyState =
  | 'idle' | 'alert' | 'approach' | 'telegraph' | 'attack' | 'recover'
  | 'flinch' | 'groggy' | 'dead';

/** ENM-04: 공격 토큰 — 동시 공격 2, 빨강 예고 화면당 1 (P04 §6). */
export class AttackCoordinator {
  private tokens = new Map<string, 'yellow' | 'red'>();
  private maxTokens: number;

  constructor(maxTokens = 2) {
    this.maxTokens = maxTokens;
  }

  request(id: string, type: 'yellow' | 'red'): boolean {
    if (this.tokens.has(id)) return true;
    if (this.tokens.size >= this.maxTokens) return false;
    if (type === 'red' && [...this.tokens.values()].includes('red')) return false;
    this.tokens.set(id, type);
    return true;
  }

  release(id: string): void {
    this.tokens.delete(id);
  }

  get activeCount(): number {
    return this.tokens.size;
  }

  get redActive(): boolean {
    return [...this.tokens.values()].includes('red');
  }
}

export interface EnemyEvents {
  onTelegraph?: (unit: EnemyUnit, attack: EnemyAttack) => void;
  /** 타격 시점 — 월드가 플레이어 거리/무적/패링을 판정한다. */
  onStrike?: (unit: EnemyUnit, attack: EnemyAttack) => void;
  onStateChange?: (unit: EnemyUnit, from: EnemyState, to: EnemyState) => void;
}

const FLINCH_MS = 300;
const ATTACK_EXEC_MS = 150; // Telegraph 종료 후 타격 판정까지
const RECOVER_MS = 600;
const ALERT_RANGE = 6.5;
const ALERT_MS = 250;

/** ENM-02: 적 1기 — 공통 상태 머신. */
export class EnemyUnit {
  readonly def: EnemyDef;
  readonly c: Combatant;
  state: EnemyState = 'idle';
  private stateSince = 0;
  private currentAttack: EnemyAttack | null = null;
  private cooldowns = new Map<string, number>();
  private nextAggressionAt = 0;
  private struck = false;
  private events: EnemyEvents;
  private coord: AttackCoordinator;

  constructor(def: EnemyDef, x: number, now: number, coord: AttackCoordinator, events: EnemyEvents = {}) {
    this.def = def;
    this.coord = coord;
    this.events = events;
    this.stateSince = now;
    this.c = makeCombatant({
      id: def.enemy_id + ':' + Math.round(x * 100), x,
      hp: def.hp, max_hp: def.hp, poise_max: def.poise_max, weight: def.weight,
      radius: def.radius, guard_front: def.guard_front, guard_gauge: def.guard_gauge,
      guard_gauge_max: def.guard_gauge, super_armor: def.super_armor,
      weak_point: def.weak_point, elite: def.elite, facing: -1,
    });
  }

  private to(state: EnemyState, now: number): void {
    if (this.state === state) return;
    const from = this.state;
    this.state = state;
    this.stateSince = now;
    this.events.onStateChange?.(this, from, state);
  }

  /** 피격 반응 (Combat HitResult → AI 반영). */
  onHitReaction(reaction: string, now: number): void {
    if (!this.c.alive) {
      this.abortAttack();
      this.to('dead', now);
      return;
    }
    if (reaction === 'groggy' || reaction === 'guard_break') {
      this.abortAttack();
      this.to('groggy', now);
      return;
    }
    if (reaction === 'flinch' && !this.def.super_armor) {
      this.abortAttack();
      this.to('flinch', now);
    }
  }

  private abortAttack(): void {
    if (this.currentAttack) {
      this.coord.release(this.c.id);
      this.currentAttack = null;
    }
  }

  /** 예고 중인가? (플레이어 패링 타이밍용) */
  get telegraphing(): EnemyAttack | null {
    return this.state === 'telegraph' ? this.currentAttack : null;
  }

  /** 프레임 갱신. playerX 기준 1D 추적. 반환: 이동량(유닛). */
  update(now: number, dtMs: number, playerX: number, playerAlive: boolean): number {
    if (this.state === 'dead') return 0;
    if (!this.c.alive) {
      this.abortAttack();
      this.to('dead', now);
      return 0;
    }
    if (isGroggy(this.c, now)) {
      if (this.state !== 'groggy') {
        this.abortAttack();
        this.to('groggy', now);
      }
      return 0;
    }
    if (this.state === 'groggy') this.to('alert', now); // 그로기 해제
    if (this.state === 'flinch') {
      if (now - this.stateSince < FLINCH_MS) return 0;
      this.to('alert', now);
    }

    const dist = Math.abs(playerX - this.c.x);
    this.c.facing = playerX < this.c.x ? -1 : 1;

    switch (this.state) {
      case 'idle':
        if (playerAlive && dist <= ALERT_RANGE) this.to('alert', now);
        return 0;
      case 'alert':
        if (now - this.stateSince >= ALERT_MS) this.to('approach', now);
        return 0;
      case 'approach': {
        if (!playerAlive) {
          this.to('idle', now);
          return 0;
        }
        // 공격 시도: 거리·쿨다운·어그레션·토큰
        if (dist <= this.bestAttackRange() && now >= this.nextAggressionAt) {
          const atk = this.pickAttack(dist, now);
          if (atk && this.coord.request(this.c.id, atk.telegraph)) {
            this.currentAttack = atk;
            this.to('telegraph', now);
            this.events.onTelegraph?.(this, atk);
            return 0;
          }
        }
        // 선호 간격까지 이동
        if (dist > this.def.ai.preferred_range) {
          const step = (this.def.ai.move_speed * dtMs) / 1000;
          return Math.sign(playerX - this.c.x) * Math.min(step, dist - this.def.ai.preferred_range);
        }
        return 0;
      }
      case 'telegraph': {
        const atk = this.currentAttack!;
        if (now - this.stateSince >= atk.telegraph_ms) this.to('attack', now);
        return 0;
      }
      case 'attack': {
        const atk = this.currentAttack!;
        if (!this.struck && now - this.stateSince >= ATTACK_EXEC_MS) {
          this.struck = true;
          this.events.onStrike?.(this, atk);
        }
        if (now - this.stateSince >= ATTACK_EXEC_MS + 100) {
          this.struck = false;
          this.cooldowns.set(atk.attack_id, now + atk.cooldown_ms);
          this.nextAggressionAt = now + this.def.ai.aggression_ms;
          this.coord.release(this.c.id);
          this.currentAttack = null;
          this.to('recover', now);
        }
        return 0;
      }
      case 'recover':
        if (now - this.stateSince >= RECOVER_MS) this.to('approach', now);
        return 0;
    }
    return 0;
  }

  private bestAttackRange(): number {
    return Math.max(...this.def.attacks.map((a) => a.range));
  }

  private pickAttack(dist: number, now: number): EnemyAttack | null {
    for (const a of this.def.attacks) {
      if (dist > a.range) continue;
      if ((this.cooldowns.get(a.attack_id) ?? 0) > now) continue;
      return a;
    }
    return null;
  }
}
