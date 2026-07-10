// T1-04 유파(流派) StyleManager. 순수(DOM 비의존).
// 미러 판정은 좌표 기반(입력을 canonical=우수 공간으로 접기) — 원(wonmu) 손방향(chirality)까지 정확.
// 따라서 판정 결과 strokeId는 항상 canonical이고, 검술 조합은 canonical로 정의하면 두 유파에서 자동 동작.
// styles.json의 techniqueOverrides는 미러가 아닌 미래 유파(쾌검류 등)를 위한 확장 지점(우수/좌수는 비어 있음).
import { STYLES, TECHNIQUES } from './data';
import type { Style } from './types';

// 미러 유파에서 상호 대응하는 획ID(표시/참조용). 대칭 없는 획(thrust/wonmu/vertical)은 자기 자신.
export const MIRROR_STROKE: Record<string, string> = {
  h_lr: 'h_rl', h_rl: 'h_lr',
  diag_dr: 'diag_dl', diag_dl: 'diag_dr',
  diag_ur: 'diag_ul', diag_ul: 'diag_ur',
  v_down: 'v_down', v_up: 'v_up',
  thrust: 'thrust', wonmu: 'wonmu',
};
export function mirrorStrokeId(id: string): string { return MIRROR_STROKE[id] ?? id; }

export function styleByName(name: string): Style { return STYLES[name]; }
export function listStyles(): Style[] { return Object.values(STYLES); }
export function otherStyle(cur: Style): Style {
  const vals = Object.values(STYLES);
  return vals.find(s => s.name !== cur.name) ?? cur;
}

// 검술 조합을 유파 관점에서 해석. 기본은 canonical 조합(입력이 canonical로 접히므로).
export function techniqueCombo(techId: string, style: Style): string[] {
  const ov = style.techniqueOverrides?.[techId];
  return ov ?? TECHNIQUES[techId].combo;
}

// 가상패드 ↑↓ 클러스터 방향.
export function updownCluster(style: Style): 'left' | 'right' { return style.updownCluster; }
