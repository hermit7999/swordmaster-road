// 판정 엔진 공용 타입. FR-JDG-*/FR-INP-*.
export interface Pt { x: number; y: number; t?: number }
export type Grade = 'perfect' | 'great' | 'good' | 'bad' | 'miss';
export type InputMode = 'gesture' | 'command';
export type Dir = 'L' | 'R' | 'U' | 'D' | 'UL' | 'UR' | 'DL' | 'DR';

export type ShapeType = 'line' | 'circle';
export interface StrokeSpec {
  name: string;
  shapeType: ShapeType;
  path: [number, number][];
  lenBand: [number, number];        // 캔버스 대각 대비 길이 비율 밴드(형태 동률 후보 판별). T1-02.
  command: Dir[];
  raw: Dir[];
  rhythm: number[];
  // 오버라이드(미지정 시 balance 전역): 획별로 판정 파라미터 조정. 코드 하드코딩 금지 — 전부 strokes.json.
  minLenRatio?: number;             // 예: 찌르기 0.05
  speedMs?: { min: number; max: number };  // 예: 찌르기 60~300
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
