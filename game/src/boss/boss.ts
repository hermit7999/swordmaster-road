// BOS-02/03/04: 패턴 선택기(결정론 RNG) + Phase 시스템 + BossController.
import type { Combatant } from '../combat/combat.ts';
import { isGroggy, makeCombatant } from '../combat/combat.ts';
import type { DuelController, DuelZone } from '../duel/duel.ts';
import type { BossDef, BossPattern } from './data.ts';
import { getBoss, patternsOf } from './data.ts';

/** 결정론 RNG (mulberry32) — 리플레이 회귀용 시드 고정. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** BOS-02: 존/쿨다운/가중치/2연속 금지 (P06 §5). */
export class PatternSelector {
  private cooldowns = new Map<string, number>();
  private lastPattern: string | null = null;
  private rng: () => number;
  private patterns: BossPattern[];

  constructor(bossId: string, seed = 1) {
    this.patterns = patternsOf(bossId);
    this.rng = mulberry32(seed);
  }

  select(phase: number, zone: DuelZone, now: number): BossPattern | null {
    const pool = this.patterns.filter(
      (p) =>
        p.phase <= phase &&
        (p.zone === 'any' || p.zone === zone) &&
        (this.cooldowns.get(p.pattern_id) ?? 0) <= now &&
        p.pattern_id !== this.lastPattern,
    );
    // 2연속 금지 때문에 풀이 비면 last 제한만 해제
    const candidates = pool.length > 0
      ? pool
      : this.patterns.filter(
          (p) => p.phase <= phase && (p.zone === 'any' || p.zone === zone) && (this.cooldowns.get(p.pattern_id) ?? 0) <= now,
        );
    if (candidates.length === 0) return null;
    const total = candidates.reduce((s, p) => s + p.weight, 0);
    let r = this.rng() * total;
    for (const p of candidates) {
      r -= p.weight;
      if (r <= 0) {
        this.commit(p, now);
        return p;
      }
    }
    const last = candidates[candidates.length - 1]!;
    this.commit(last, now);
    return last;
  }

  private commit(p: BossPattern, now: number): void {
    this.cooldowns.set(p.pattern_id, now + p.cooldown_ms);
    this.lastPattern = p.pattern_id;
  }
}

export type BossState = 'idle' | 'approach' | 'telegraph' | 'strike' | 'opening' | 'phase_transition' | 'groggy' | 'dead';

export interface BossEvents {
  onTelegraph?: (p: BossPattern) => void;
  onStrike?: (p: BossPattern, strike: BossPattern['strikes'][number]) => void;
  onOpening?: (p: BossPattern) => void;
  onPhaseChange?: (phase: number) => void;
  onDefeated?: () => void;
}

const PHASE_TRANSITION_MS = 1200;
const IDLE_BETWEEN_MS = 400;
const APPROACH_SPEED = 2.0; // 유닛/초

/** BOS-03/04: 보스 본체 — Duel과 연동. */
export class BossController {
  readonly def: BossDef;
  readonly c: Combatant;
  state: BossState = 'idle';
  phase = 1;
  private stateSince: number;
  private pattern: BossPattern | null = null;
  private struckIdx = 0;
  private selector: PatternSelector;
  private duel: DuelController;
  private events: BossEvents;
  private defeated = false;

  constructor(bossId: string, x: number, now: number, duel: DuelController, events: BossEvents = {}, seed = 1) {
    const def = getBoss(bossId);
    if (!def) throw new Error(`unknown boss: ${bossId}`);
    this.def = def;
    this.duel = duel;
    this.events = events;
    this.selector = new PatternSelector(bossId, seed);
    this.stateSince = now;
    this.c = makeCombatant({
      id: bossId, x, hp: def.hp, max_hp: def.hp, poise_max: def.poise_max,
      weight: def.weight, radius: def.radius, elite: true, facing: -1,
    });
  }

  get currentPattern(): BossPattern | null {
    return this.pattern;
  }

  get telegraphing(): BossPattern | null {
    return this.state === 'telegraph' ? this.pattern : null;
  }

  /** 피격 후 처리 — Phase 전이·그로기·사망 체크. */
  onHitReaction(now: number): void {
    if (!this.c.alive && !this.defeated) {
      this.defeated = true;
      this.abort();
      this.to('dead', now);
      this.events.onDefeated?.();
      return;
    }
    // Phase 전이: HP 임계 통과 (P06 §4)
    const ratio = this.c.hp / this.c.max_hp;
    const nextThreshold = this.def.phases[this.phase - 1];
    if (nextThreshold !== undefined && ratio <= nextThreshold && this.state !== 'phase_transition') {
      this.phase++;
      this.abort();
      this.c.groggy_until_ms = 0; // 전이 중 무적 성격
      this.c.poise = 0;
      this.to('phase_transition', now);
      this.duel.onBossPatternEnd(now);
      this.events.onPhaseChange?.(this.phase);
    }
  }

  private abort(): void {
    this.pattern = null;
    this.struckIdx = 0;
  }

  private to(state: BossState, now: number): void {
    this.state = state;
    this.stateSince = now;
  }

  /** 프레임 갱신. 반환: 이동량. */
  update(now: number, dtMs: number, playerX: number, playerAlive: boolean): number {
    if (this.state === 'dead') return 0;
    if (!this.c.alive) {
      this.onHitReaction(now);
      return 0;
    }
    if (isGroggy(this.c, now)) {
      if (this.state !== 'groggy') {
        this.abort();
        this.duel.onBossPatternEnd(now);
        this.to('groggy', now);
      }
      return 0;
    }
    if (this.state === 'groggy') this.to('idle', now);

    const dist = Math.abs(playerX - this.c.x);
    this.c.facing = playerX < this.c.x ? -1 : 1;
    const dir = Math.sign(playerX - this.c.x) || 1;

    switch (this.state) {
      case 'phase_transition':
        if (now - this.stateSince >= PHASE_TRANSITION_MS) this.to('idle', now);
        return 0;
      case 'idle': {
        if (!playerAlive) return 0;
        if (now - this.stateSince < IDLE_BETWEEN_MS) return 0;
        const zone = this.duel.zoneOf(dist);
        const p = this.selector.select(this.phase, zone, now);
        if (p) {
          this.pattern = p;
          this.struckIdx = 0;
          this.to('telegraph', now);
          this.duel.onBossPatternStart(now);
          this.events.onTelegraph?.(p);
        } else {
          this.to('approach', now);
        }
        return 0;
      }
      case 'approach': {
        if (now - this.stateSince > 600) this.to('idle', now);
        const step = (APPROACH_SPEED * dtMs) / 1000;
        return dir * Math.min(step, Math.max(0, dist - 1.0));
      }
      case 'telegraph': {
        const p = this.pattern!;
        // 접근형 패턴은 예고 중 전진
        let move = 0;
        if (p.approach > 0) {
          const total = p.telegraph.ms;
          move = dir * (p.approach * dtMs) / total;
        }
        if (now - this.stateSince >= p.telegraph.ms) this.to('strike', now);
        return move;
      }
      case 'strike': {
        const p = this.pattern!;
        const t = now - this.stateSince;
        while (this.struckIdx < p.strikes.length && t >= p.strikes[this.struckIdx]!.at_ms) {
          this.events.onStrike?.(p, p.strikes[this.struckIdx]!);
          this.struckIdx++;
        }
        if (this.struckIdx >= p.strikes.length) {
          this.to('opening', now);
          this.duel.onBossPatternEnd(now);
          this.events.onOpening?.(p);
        }
        return 0;
      }
      case 'opening': {
        const p = this.pattern!;
        if (now - this.stateSince >= p.opening_ms) {
          this.abort();
          this.to('idle', now);
        }
        return 0;
      }
    }
    return 0;
  }
}
