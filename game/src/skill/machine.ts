// SKL-03/05: Skill State Machine + Executor (실행 파이프라인 조립).
// Ready → Startup → Active → Recovery(+CancelWindow) → Ready (P02 §4~5).
import { BALANCE } from '../data/balance.ts';
import type { SkillDef } from './data.ts';
import { getSkill } from './data.ts';
import type { Grade } from './system.ts';
import { cancelRatio, ChainRecorder, gradeMul, KiGauge, Stamina } from './system.ts';

export type SkillState = 'ready' | 'startup' | 'active' | 'recovery';

export interface ActiveSkill {
  def: SkillDef;
  grade: Grade;
  started_ms: number;
  active_start_ms: number;
  active_end_ms: number;
  recovery_end_ms: number;
  cancel_open_ms: number; // 이 시각부터 다음 스킬로 캔슬 가능
}

/** SKL-03: 상태 머신 — IClock 시간 주입, 결정론. */
export class SkillStateMachine {
  private current: ActiveSkill | null = null;

  state(now: number): SkillState {
    const c = this.current;
    if (!c) return 'ready';
    if (now < c.active_start_ms) return 'startup';
    if (now < c.active_end_ms) return 'active';
    if (now < c.recovery_end_ms) return 'recovery';
    return 'ready';
  }

  get activeSkill(): ActiveSkill | null {
    return this.current;
  }

  /** 실행 가능 여부: ready이거나, recovery 중 캔슬창 열림. 회피는 recovery 중 항상. */
  canExecute(now: number, isDodgeCancel = false): boolean {
    const s = this.state(now);
    if (s === 'ready') return true;
    if (s === 'recovery') {
      if (isDodgeCancel) return true; // 생존 우선 (P02 §4)
      return now >= this.current!.cancel_open_ms;
    }
    return false; // startup/active 중 불가 (패링은 버퍼가 처리)
  }

  begin(def: SkillDef, grade: Grade, now: number): ActiveSkill {
    const active_start = now + def.startup_ms;
    const active_end = active_start + def.active_ms;
    const recovery_end = active_end + def.recovery_ms;
    const cancel_open = active_end + def.recovery_ms * cancelRatio(grade);
    this.current = {
      def,
      grade,
      started_ms: now,
      active_start_ms: active_start,
      active_end_ms: active_end,
      recovery_end_ms: recovery_end,
      cancel_open_ms: cancel_open,
    };
    return this.current;
  }

  interrupt(): void {
    this.current = null;
  }
}

export interface SkillExecution {
  skill_id: string;       // 실제 실행된 스킬 (오의 승격 반영)
  base_skill_id: string;  // 입력된 원 스킬
  grade: Grade;
  is_secret_art: boolean;
  ki_wave: string | null; // 함께 발동된 검기 (없으면 null)
  active_start_ms: number;
  active_end_ms: number;
}

export type ExecResult =
  | { ok: true; execution: SkillExecution }
  | { ok: false; reason: 'busy' | 'no_stamina' | 'unknown_skill' | 'miss' };

export interface ExecutorEvents {
  onExecuted?: (e: SkillExecution) => void;
  onRejected?: (skillId: string, reason: string) => void;
  onSecretArt?: (artId: string) => void;
  onKiWave?: (waveId: string) => void;
}

/**
 * SKL-05: 실행 파이프라인.
 * GestureResolved{skill_id, grade} → 오의 승격 → 기력 → 상태머신 → 실행 이벤트.
 */
export class SkillExecutor {
  readonly machine = new SkillStateMachine();
  readonly stamina: Stamina;
  readonly ki = new KiGauge();
  readonly chain = new ChainRecorder();
  /** 성장 효과: 검기 충전 배율 (GrowthState.kiGainMul — PRG-03). */
  kiBonus = 1;
  private events: ExecutorEvents;

  constructor(now: number, events: ExecutorEvents = {}) {
    this.stamina = new Stamina(now);
    this.events = events;
  }

  update(now: number): void {
    const s = this.machine.state(now);
    this.stamina.update(now, s === 'active' || s === 'startup' || s === 'recovery');
  }

  /** 회피 실행 (CBT-07에서 무적 처리, 여기선 기력+캔슬만). */
  tryDodge(now: number): boolean {
    if (!this.machine.canExecute(now, true)) return false;
    if (!this.stamina.trySpend(BALANCE.dodge.stamina)) {
      this.events.onRejected?.('dodge', 'no_stamina');
      return false;
    }
    this.machine.interrupt(); // 회피는 recovery 캔슬
    return true;
  }

  execute(skillId: string, grade: Grade, now: number): ExecResult {
    if (grade === 'miss') return { ok: false, reason: 'miss' };
    const baseDef = getSkill(skillId);
    if (!baseDef) return { ok: false, reason: 'unknown_skill' };
    if (!this.machine.canExecute(now)) {
      this.events.onRejected?.(skillId, 'busy');
      return { ok: false, reason: 'busy' };
    }

    // 오의 승격 판정 (성립 실패는 무음 — 일반 실행)
    const artId = this.chain.matchSecretArt(skillId, grade, now);
    const def = artId ? getSkill(artId)! : baseDef;

    // 기력 (오의는 stamina_cost 0 — 이미 소모한 체인의 보상)
    if (!this.stamina.trySpend(def.stamina_cost)) {
      this.events.onRejected?.(skillId, 'no_stamina');
      return { ok: false, reason: 'no_stamina' };
    }

    const active = this.machine.begin(def, grade, now);
    this.chain.record(skillId, grade, active.active_end_ms);
    if (artId) {
      this.chain.reset(); // 오의 성립 시 체인 초기화 (P02 §7)
      this.events.onSecretArt?.(artId);
    }

    // 검기: 만충 + 퍼펙트 대응 스킬 (오의가 아니어도 기본 스킬 기준)
    const kiWave = artId ? null : this.ki.tryRelease(skillId, grade);
    if (kiWave) this.events.onKiWave?.(kiWave);

    const execution: SkillExecution = {
      skill_id: def.skill_id,
      base_skill_id: skillId,
      grade,
      is_secret_art: artId !== null,
      ki_wave: kiWave,
      active_start_ms: active.active_start_ms,
      active_end_ms: active.active_end_ms,
    };
    this.events.onExecuted?.(execution);
    return { ok: true, execution };
  }

  /** 적중 성공 시 호출 (Combat → Ki 충전). */
  onHitLanded(grade: Grade): void {
    const def = this.machine.activeSkill?.def;
    this.ki.onHitLanded(grade, (def?.ki_gain_mul ?? 1) * this.kiBonus);
  }

  /** 피격 시 호출 (Combat → Ki 감소 + 기력 회복 정지 + 시전 중단). */
  onPlayerHit(now: number): void {
    this.ki.onPlayerHit();
    this.stamina.onPlayerHit(now);
    this.machine.interrupt();
  }

  onParrySuccess(): void {
    this.stamina.onParrySuccess();
  }

  /** 데미지 배율 (등급) — Combat에서 사용. */
  static gradeMul(grade: Grade): number {
    return gradeMul(grade);
  }
}
