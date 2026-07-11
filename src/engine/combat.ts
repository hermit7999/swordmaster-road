// 전투 판정 코어(순수, DOM 비의존): 자세(가드) 방향 판정 + 콤보 배율.
// 획ID → 8방향 글리프. 이 방향이 적 가드에 막히면 튕김(0데미지), 열려 있으면 정타.
// 찌르기(thrust)/원무(wonmu)는 무방향 = 가드 무시(항상 정타) — 특수 획 보상.

export const STROKE_OCTANT: Record<string, string> = {
  h_lr: '→', h_rl: '←', v_up: '↑', v_down: '↓',
  diag_dr: '↘', diag_dl: '↙', diag_ur: '↗', diag_ul: '↖',
};

export function strokeOctant(strokeId: string): string | null {
  return STROKE_OCTANT[strokeId] ?? null;
}

/** 획이 적 가드(막힌 방향 집합)에 막히는가. 무방향 획(찌르기·원무)은 가드를 무시(false). */
export function isGuarded(strokeId: string, guard: readonly string[]): boolean {
  const o = strokeOctant(strokeId);
  return o != null && guard.includes(o);
}

/** 연속 정타 콤보 배율: 1 + step×(combo-1), 상한 max. combo 0/1 → 1.0. */
export function comboMultiplier(combo: number, step: number, max: number): number {
  if (combo <= 1) return 1;
  return Math.min(max, 1 + step * (combo - 1));
}
