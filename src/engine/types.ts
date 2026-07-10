// 판정 엔진 공용 타입. FR-JDG-*/FR-INP-*.
export interface Pt { x: number; y: number; t?: number }
export type Grade = 'perfect' | 'great' | 'good' | 'bad' | 'miss';
export type InputMode = 'gesture' | 'command';
export type Dir = 'L' | 'R' | 'U' | 'D' | 'UL' | 'UR' | 'DL' | 'DR';

export interface StrokeSpec {
  name: string;
  path: [number, number][];
  command: Dir[];
  raw: Dir[];
  rhythm: number[];
  minLenRatio?: number;   // 획별 오버라이드(예: 찌르기). 없으면 전역 사용.
}
export interface Style { name: string; mirrorX: boolean; updownCluster: 'left' | 'right' }
export interface Breakdown { direction: number; straight: number; speed: number; completion: number }

export interface JudgeResult {
  rejected: boolean;
  reason?: 'tap' | 'short' | 'unknown';
  strokeId?: string;
  accuracy?: number;
  grade?: Grade;
  breakdown?: Breakdown;
  dist?: number;
}
export interface CommandInput { dir: Dir; t: number }
export interface CommandMatch { strokeId: string; tokens: CommandInput[]; tightness: number }
export interface RhythmResult {
  grade: Grade;
  accuracy: number;
  maxErr?: number;
  errors?: number[];
  powerBonus?: boolean;
  reason?: 'count' | 'order';
}
// 판정 이벤트 규격(고정): {strokeId, accuracy, grade, inputMode, timestamp}. 작업규칙 #4.
export interface StrokeEvent {
  strokeId: string;
  accuracy: number;
  grade: Grade;
  inputMode: InputMode;
  timestamp: number;
  breakdown?: Breakdown;
  powerBonus?: boolean;
}
