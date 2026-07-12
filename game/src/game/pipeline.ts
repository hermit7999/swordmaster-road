// ITG-01: Input ↔ Gesture ↔ Skill 파이프라인 (Stage1 Final Integration STEP 2~3).
// InputManager의 완성 제스처 → GestureEngine 인식 → SkillResolved 이벤트.
import { GestureEngine } from '../gesture/engine.ts';
import type { RecognitionResult } from '../gesture/types.ts';
import type { InputManager } from '../input/manager.ts';

export interface SkillResolved {
  skill_id: string;        // gesture_id와 1:1 (M-A 시점)
  grade: Grade;
  score: number;
  elapsed_ms: number;
  parry_attempt_failed: boolean; // TC-106: 패링 유효창 내 SE 단독
}

export type Grade = 'perfect' | 'great' | 'good' | 'bad' | 'miss';

/** P02 §3 등급 매핑. */
export function toGrade(r: RecognitionResult): Grade {
  if (r.outcome === 'fail') return 'miss';
  if (r.score >= 95) return 'perfect';
  if (r.score >= 90) return 'great';
  if (r.score >= 85) return 'good';
  return 'bad'; // 70~84 candidate — 성립하되 약함 (관대한 입력)
}

export type SkillListener = (s: SkillResolved) => void;
export type MissListener = (r: RecognitionResult) => void;

/**
 * 파이프라인 조립기.
 * - 패링 유효창 규칙 (Sword Language Bible §2.8-4): 유효창 활성 중 사선베기(SE 단독)
 *   인식 → 사선베기 실행 금지, 패링 시도 실패로 처리 (방어 시도가 자폭이 되지 않게).
 */
export class GesturePipeline {
  readonly engine: GestureEngine;
  private input: InputManager;
  private viewport: { w: number; h: number };
  private skillListeners: SkillListener[] = [];
  private missListeners: MissListener[] = [];
  private parryWindowActive = false;
  private lastResult: RecognitionResult | null = null;

  constructor(input: InputManager, viewport: { w: number; h: number }, engine = new GestureEngine()) {
    this.input = input;
    this.viewport = viewport;
    this.engine = engine;
    this.input.onGesture((g) => this.handle(g.points));
  }

  setViewport(vp: { w: number; h: number }): void {
    this.viewport = vp;
  }

  /** Combat(P03~05)가 적 예고에 맞춰 토글 — M-A에서는 테스트 훅. */
  setParryWindow(active: boolean): void {
    this.parryWindowActive = active;
  }

  onSkill(fn: SkillListener): void {
    this.skillListeners.push(fn);
  }

  onMiss(fn: MissListener): void {
    this.missListeners.push(fn);
  }

  /** 디버그 오버레이용 최근 인식 결과. */
  get last(): RecognitionResult | null {
    return this.lastResult;
  }

  private handle(points: Parameters<GestureEngine['recognize']>[0]): void {
    const r = this.engine.recognize(points, this.viewport);
    this.lastResult = r;
    if (r.outcome === 'fail' || r.gesture_id === null) {
      for (const fn of this.missListeners) fn(r);
      return;
    }
    // TC-106: 패링 유효창 내 SE 단독 → 사선베기 오발 방지
    if (this.parryWindowActive && r.gesture_id === 'slash_diag') {
      const resolved: SkillResolved = {
        skill_id: 'parry',
        grade: 'miss',
        score: r.score,
        elapsed_ms: r.elapsed_ms,
        parry_attempt_failed: true,
      };
      for (const fn of this.skillListeners) fn(resolved);
      return;
    }
    const resolved: SkillResolved = {
      skill_id: r.gesture_id,
      grade: toGrade(r),
      score: r.score,
      elapsed_ms: r.elapsed_ms,
      parry_attempt_failed: false,
    };
    for (const fn of this.skillListeners) fn(resolved);
  }
}
