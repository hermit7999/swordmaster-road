// DUL-01~05: Duel 상태 머신 (momentum 3상태, ADR-011) + 공격권 + 연쇄 패링 + 거리 존.
// P05 Living Document 구현.

export type DuelPhase = 'neutral' | 'player_offense' | 'enemy_offense';
export type DuelZone = 'far' | 'mid' | 'near';

export interface DuelProfile {
  offense_gauge_ms: number;
  chain_parry_bonus: number[];
  red_dodge_counter_ms: number;
  zones: { far: number; mid: number };
  arena_width: number;
}

export const DEFAULT_DUEL_PROFILE: DuelProfile = {
  offense_gauge_ms: 6000,
  chain_parry_bonus: [60, 70, 85, 100],
  red_dodge_counter_ms: 900,
  zones: { far: 5.0, mid: 2.5 },
  arena_width: 12.0,
};

export interface DuelEvents {
  onPhaseChange?: (from: DuelPhase, to: DuelPhase) => void;
  onChainParry?: (chainIndex: number, poiseBonus: number) => void;
}

/** DUL-01/02: 공격권 시스템. */
export class DuelController {
  readonly profile: DuelProfile;
  private phase: DuelPhase = 'neutral';
  private offenseUntil = 0;
  private chainParryCount = 0;
  private counterUntil = 0;
  private offensePending = false; // 적 공세 중 패링 성공 → 패턴 종료 시 공격권
  private events: DuelEvents;

  constructor(profile: DuelProfile = DEFAULT_DUEL_PROFILE, events: DuelEvents = {}) {
    this.profile = profile;
    this.events = events;
  }

  get current(): DuelPhase {
    return this.phase;
  }

  private to(phase: DuelPhase, now: number): void {
    if (this.phase === phase) return;
    const from = this.phase;
    this.phase = phase;
    if (phase === 'player_offense') this.offenseUntil = now + this.profile.offense_gauge_ms;
    if (phase !== 'enemy_offense') this.chainParryCount = 0;
    this.events.onPhaseChange?.(from, phase);
  }

  /** 공격권 게이지 잔량 (0~1). */
  offenseRatio(now: number): number {
    if (this.phase !== 'player_offense') return 0;
    return Math.max(0, (this.offenseUntil - now) / this.profile.offense_gauge_ms);
  }

  update(now: number): void {
    if (this.phase === 'player_offense' && now >= this.offenseUntil) {
      this.to('neutral', now); // 게이지 소진 → 대치 (P05 §3)
    }
  }

  /** 거리 존 (DUL-05). */
  zoneOf(dist: number): DuelZone {
    if (dist >= this.profile.zones.far) return 'far';
    if (dist >= this.profile.zones.mid) return 'mid';
    return 'near';
  }

  // ── 공격권 획득 경로 (P05 §3) ──
  /**
   * 패링 성공: 연쇄 카운트 증가 + 보너스 poise 반환.
   * 적 공세(연격) 중이면 연쇄를 유지하고 공격권은 패턴 종료 시 부여 (연쇄 2~4연 성립 조건).
   * 대치 중 단발 패링이면 즉시 공격권.
   */
  onParrySuccess(now: number): number {
    const idx = Math.min(this.chainParryCount, this.profile.chain_parry_bonus.length - 1);
    const bonus = this.profile.chain_parry_bonus[idx]!;
    this.chainParryCount++;
    this.events.onChainParry?.(this.chainParryCount, bonus);
    if (this.phase === 'enemy_offense') this.offensePending = true;
    else this.to('player_offense', now);
    return bonus;
  }

  /** 빨강 회피 성공 → 반격 창 + 반격 적중 시 공격권. */
  onRedDodge(now: number): void {
    this.counterUntil = now + this.profile.red_dodge_counter_ms;
  }

  counterWindowActive(now: number): boolean {
    return now < this.counterUntil;
  }

  /** 반격 창 내 적중 / 가드 브레이크 / 대치 카운터 → 공격권. */
  onCounterHit(now: number): void {
    this.to('player_offense', now);
    this.counterUntil = 0;
  }

  onGuardBreak(now: number): void {
    this.to('player_offense', now);
  }

  // ── 공격권 상실 경로 ──
  /** 미스 등급 → 대치로 복귀 (P05 §3). */
  onPlayerMiss(now: number): void {
    if (this.phase === 'player_offense') this.to('neutral', now);
  }

  /** 보스 패턴 시작 → 적 공세. */
  onBossPatternStart(now: number): void {
    this.to('enemy_offense', now);
  }

  /** 보스 패턴 종료(빈틈) → 패링 성공했으면 공격권, 아니면 대치. */
  onBossPatternEnd(now: number): void {
    if (this.phase !== 'enemy_offense') return;
    if (this.offensePending) {
      this.offensePending = false;
      this.to('player_offense', now);
    } else {
      this.to('neutral', now);
    }
  }

  reset(): void {
    this.phase = 'neutral';
    this.chainParryCount = 0;
    this.counterUntil = 0;
    this.offensePending = false;
  }
}
