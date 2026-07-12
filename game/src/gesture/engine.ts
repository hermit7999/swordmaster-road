// GES-08/09/10: Skill Resolver + Debug + 파이프라인 통합 (GestureEngine).
// Touch Down→…→Skill 결정 (Gesture Algorithm Spec v2.8 §1).
import type {
  CandidateScore,
  GestureEngineConfig,
  GesturePoint,
  GestureTemplate,
  RecognitionResult,
} from './types.ts';
import { DEFAULT_ENGINE_CONFIG } from './types.ts';
import type { Viewport } from './geometry.ts';
import {
  bbox,
  buildSegments,
  noiseFilter,
  normalizeByViewport,
  pathLength,
  rdp,
  resample,
  splitByReversal,
  totalTurnDeg,
} from './geometry.ts';
import type { PathFeatures } from './score.ts';
import { scoreTemplate } from './score.ts';
import { DEFAULT_GESTURES } from './templates.ts';

function fail(reason: string, elapsed: number, partial?: Partial<RecognitionResult['debug']>): RecognitionResult {
  return {
    outcome: 'fail',
    gesture_id: null,
    score: 0,
    confidence: 0,
    elapsed_ms: elapsed,
    debug: {
      reason,
      candidates: [],
      segment_dirs: [],
      corner_count: 0,
      path_len: 0,
      total_turn_deg: 0,
      closed: false,
      ...partial,
    },
  };
}

export class GestureEngine {
  private templates: GestureTemplate[];
  private cfg: GestureEngineConfig;

  constructor(
    templates: GestureTemplate[] = DEFAULT_GESTURES,
    cfg: Partial<GestureEngineConfig> = {},
  ) {
    this.templates = templates;
    this.cfg = { ...DEFAULT_ENGINE_CONFIG, ...cfg };
  }

  /** 해금 상태 등에 따른 템플릿 교체 (런 중 검술 습득). */
  setTemplates(templates: GestureTemplate[]): void {
    this.templates = templates;
  }

  setToleranceScale(scale: number): void {
    this.cfg = { ...this.cfg, tolerance_scale: scale };
  }

  /**
   * 인식 진입점. rawPoints는 px 좌표 (수집 그대로).
   * 결정론: 동일 입력 + 동일 설정 = 동일 결과.
   */
  recognize(rawPoints: GesturePoint[], viewport: Viewport): RecognitionResult {
    const elapsed =
      rawPoints.length >= 2
        ? rawPoints[rawPoints.length - 1]!.t - rawPoints[0]!.t
        : 0;

    if (rawPoints.length < this.cfg.min_points) {
      return fail(`too_few_points:${rawPoints.length}<${this.cfg.min_points}`, elapsed);
    }

    // GES-02 Normalize (각도 보존)
    const normalized = normalizeByViewport(rawPoints, viewport);
    // GES-03 Noise Filter
    const cleaned = noiseFilter(normalized, this.cfg.noise_min_dist);
    if (cleaned.length < 2) return fail('degenerate_path', elapsed);

    const len = pathLength(cleaned);
    if (len <= 0) return fail('zero_length', elapsed);

    // GES-04 Resample
    const rs = resample(cleaned, this.cfg.resample_n);
    // GES-05 Corner/Direction
    const size = bbox(rs).size;
    const eps = Math.max(size * this.cfg.rdp_epsilon, 1e-6);
    // 급반전 지점으로 먼저 분할 후 각 구간 RDP (일직선 왕복 = 발도술 대응)
    const splits = splitByReversal(rs, 120);
    let vertices: GesturePoint[];
    if (splits.length === 0) {
      vertices = rdp(rs, eps);
    } else {
      vertices = [];
      let start = 0;
      for (const s of [...splits, rs.length - 1]) {
        const sub = rdp(rs.slice(start, s + 1), eps);
        if (vertices.length > 0) sub.shift(); // 경계 중복 정점 제거
        vertices.push(...sub);
        start = s;
      }
    }
    const segments = buildSegments(vertices, this.cfg.corner_merge_deg, this.cfg.min_segment_len);
    const turn = totalTurnDeg(rs);
    const first = rs[0]!;
    const last = rs[rs.length - 1]!;
    const closed = size > 0 && Math.hypot(last.x - first.x, last.y - first.y) <= size * this.cfg.loop_close_ratio;

    const features: PathFeatures = {
      segments,
      resampled: rs,
      pathLen: len,
      elapsedMs: elapsed,
      totalTurnDeg: turn,
      closed,
    };

    // GES-06/07 Matching + Score
    const candidates: CandidateScore[] = this.templates
      .map((tpl) => scoreTemplate(features, tpl, this.cfg))
      .sort((a, b) => b.total - a.total);

    const debugBase = {
      candidates,
      segment_dirs: segments.map((s) => s.dir),
      corner_count: Math.max(0, segments.length - 1),
      path_len: Math.round(len * 1000) / 1000,
      total_turn_deg: Math.round(turn),
      closed,
    };

    const best = candidates[0];
    if (!best || best.total < this.cfg.candidate_threshold) {
      return {
        ...fail('below_candidate_threshold', elapsed, debugBase),
      };
    }

    // GES-08 동점/근접 해결: 총점 → direction → shape → priority (v2.8 §9)
    const near = candidates.filter((c) => best.total - c.total < 0.001);
    let chosen = best;
    if (near.length > 1) {
      const byId = new Map(this.templates.map((t) => [t.gesture_id, t]));
      near.sort((a, b) => {
        if (b.breakdown.direction !== a.breakdown.direction)
          return b.breakdown.direction - a.breakdown.direction;
        if (b.breakdown.shape !== a.breakdown.shape) return b.breakdown.shape - a.breakdown.shape;
        return (byId.get(a.gesture_id)?.priority ?? 99) - (byId.get(b.gesture_id)?.priority ?? 99);
      });
      chosen = near[0]!;
    }

    const outcome = chosen.total >= this.cfg.success_threshold ? 'success' : 'candidate';
    return {
      outcome,
      gesture_id: chosen.gesture_id,
      score: chosen.total,
      confidence: chosen.total / 100,
      elapsed_ms: elapsed,
      debug: { reason: outcome, ...debugBase },
    };
  }
}
