// 데이터 외부화(T1-01): BALANCE/STROKE_TEMPLATES/TECHNIQUES/STYLES를 JSON에서 로드.
import balanceJson from '../data/balance.json';
import strokesJson from '../data/strokes.json';
import techniquesJson from '../data/techniques.json';
import stylesJson from '../data/styles.json';
import enemiesJson from '../data/enemies.json';
import trialsJson from '../data/trials.json';
import type { StrokeSpec, Style } from './types';

export interface Balance {
  resample: number;
  gradeCuts: { bad: number; good: number; great: number; perfect: number };
  speedIdeal: { min: number; max: number };
  minLenRatio: number;
  rejectRatio: number;
  classifyThreshold: number;
  classifyTieEps: number;
  shape: {
    circleMinSweepDeg: number;
    circleMaxCV: number;
    circleMaxClosure: number;
    radiusCVZero: number;
    closureZero: number;
    sweepFullDeg: number;
    circleWeights: { radius: number; sweep: number; closure: number };
  };
  comboWindow: number;
  basicAttackDamage: number;
  commandBonusMode: 'all_or_nothing' | 'proportional';
  missPenalty: { manaFraction: number; stunMs: number };
  combat: {
    playerHp: number; manaMax: number; startMana: number;
    parryDamage: { good: number; great: number; perfect: number };
    manaRecoverHit: number; manaRecoverPerfect: number;
    observeMs: number; respondMs: number;
  };
  weights: { direction: number; straight: number; speed: number; completion: number };
  simulMs: number;
  commandResolveMs: number;
  commandWindow: number;
  arbiterStaleMs: number;
  rhythm: { beatMs: number; windows: { perfect: number; great: number; good: number; bad: number } };
}
export interface Technique {
  name: string; combo: string[]; window: number; cost: number; damage: number;
  stun?: boolean; aoe?: boolean; pierce?: boolean;
}
export interface EnemyAttack { name: string; dir: string; counter: string; counterName: string; damage: number }
export interface Enemy { name: string; hp: number; attacks: EnemyAttack[] }
export interface Trial { name: string; strokes: string[]; intervalMs: number; avgPass: number }

export const BALANCE = balanceJson as Balance;
export const STROKE_TEMPLATES = strokesJson as unknown as Record<string, StrokeSpec>;
export const TECHNIQUES = techniquesJson as unknown as Record<string, Technique>;
export const STYLES = stylesJson as unknown as Record<string, Style>;
export const ENEMIES = enemiesJson as unknown as Record<string, Enemy>;
export const TRIALS = trialsJson as unknown as Record<string, Trial>;
