// 데이터 외부화(T1-01): BALANCE/STROKE_TEMPLATES/TECHNIQUES/STYLES를 JSON에서 로드.
import balanceJson from '../data/balance.json';
import strokesJson from '../data/strokes.json';
import techniquesJson from '../data/techniques.json';
import stylesJson from '../data/styles.json';
import enemiesJson from '../data/enemies.json';
import trialsJson from '../data/trials.json';
import stage1Json from '../data/stages/stage1.json';
import itemsJson from '../data/items.json';
import type { StrokeSpec, Style } from './types';

export interface Balance {
  resample: number;
  gradeCuts: { bad: number; good: number; great: number; perfect: number };
  speedIdeal: { min: number; max: number };
  minLenRatio: number;
  rejectRatio: number;
  classifyThreshold: number;
  classifyTieEps: number;
  sectorHalfDeg: number;
  angleErrorFullDeg: number;
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
    kinds: Record<string, { hpMul: number; respondMs?: number; windowMs?: number }>;
  };
  progression: {
    hpPerLevel: number; powerPerLevel: number;
    xpToLevel: number[];
    goldPerWin: Record<string, number>;
    xpPerWin: Record<string, number>;
    startGold: number;
  };
  art: { bgOverlay: number; bgOverlayCombat: number; titleGradient: number; hitFlashMs: number };
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
export interface Enemy { name: string; hp: number; image?: string; attacks: EnemyAttack[] }
export interface Trial { name: string; strokes: string[]; intervalMs: number; avgPass: number }
export interface Item { name: string; kind: 'consumable' | 'sword'; effect?: string; value?: number; power?: number; price: number; desc: string; source: string[] }
export type NodeType = 'battle' | 'training' | 'event' | 'shop' | 'rest';
export interface StageNode { zone: string; col: number; type: NodeType; battleKind?: string; label: string; next: string[] }
export interface Stage { name: string; start: string; nodes: Record<string, StageNode> }

export const BALANCE = balanceJson as Balance;
export const STROKE_TEMPLATES = strokesJson as unknown as Record<string, StrokeSpec>;
export const TECHNIQUES = techniquesJson as unknown as Record<string, Technique>;
export const STYLES = stylesJson as unknown as Record<string, Style>;
export const ENEMIES = enemiesJson as unknown as Record<string, Enemy>;
export const TRIALS = trialsJson as unknown as Record<string, Trial>;
export const ITEMS = {
  ...(itemsJson.consumables as unknown as Record<string, Item>),
  ...(itemsJson.swords as unknown as Record<string, Item>),
} as Record<string, Item>;
export const CONSUMABLES = itemsJson.consumables as unknown as Record<string, Item>;
export const SWORDS = itemsJson.swords as unknown as Record<string, Item>;
export const STAGES = { stage1: (stage1Json as any).stage1 } as unknown as Record<string, Stage>;
