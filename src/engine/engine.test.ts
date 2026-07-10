// M0 회귀 29종을 vitest로 이관(T1-01 완료 기준). 새 엔진 구조에서 전부 통과해야.
import { describe, it, expect } from 'vitest';
import {
  judgeStroke, recognizeCommand, judgeRhythm, STYLES, BALANCE,
} from './index';
import type { Pt } from './index';

const META = { w: 800, h: 450 };
function synthLine(from: [number, number], to: [number, number], n: number, durMs: number, jitter = 0): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const jx = jitter ? Math.sin(u * Math.PI * 6) * jitter : 0;
    const jy = jitter ? Math.cos(u * Math.PI * 6) * jitter : 0;
    out.push({ x: from[0] + (to[0] - from[0]) * u + jx, y: from[1] + (to[1] - from[1]) * u + jy, t: durMs * u });
  }
  return out;
}
// 시계방향(화면) 원호. sweepDeg=360이면 완전한 원. cw=false면 반시계.
function synthCircle(cx: number, cy: number, r: number, n: number, durMs: number, sweepDeg = 360, jitter = 0, cw = true): Pt[] {
  const out: Pt[] = [];
  const sweep = (sweepDeg * Math.PI / 180) * (cw ? 1 : -1);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const th = sweep * u;
    const jr = jitter ? (Math.sin(u * Math.PI * 8) * jitter) : 0;
    out.push({ x: cx + (r + jr) * Math.sin(th), y: cy - (r + jr) * Math.cos(th), t: durMs * u });
  }
  return out;
}

describe('judgeStroke (검로)', () => {
  it('반듯한 횡베기 = 그레이트+', () => {
    const r = judgeStroke(synthLine([100, 225], [700, 225], 40, 300), META);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('h_lr');
    expect(r.accuracy!).toBeGreaterThanOrEqual(85);
  });
  it('흔들린 획 = 배드(50-69)', () => {
    // 수직 웨이브(직선 유지, 스파이럴 아님) 3주기로 "흔들린 횡베기"를 표현.
    const wob: Pt[] = [];
    for (let i = 0; i < 60; i++) { const u = i / 59; wob.push({ x: 100 + 600 * u, y: 225 + Math.sin(u * Math.PI * 6) * 62, t: 300 * u }); }
    const r = judgeStroke(wob, META);
    expect(r.strokeId).toBe('h_lr');
    expect(r.accuracy!).toBeGreaterThanOrEqual(50);
    expect(r.accuracy!).toBeLessThanOrEqual(69);
  });
  it('우→좌 = 횡베기(우→좌) h_rl (8획: 더 이상 불명 아님)', () => {
    const r = judgeStroke(synthLine([700, 225], [100, 225], 40, 300), META);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('h_rl');
  });
  // 참고(T1-02 발견): 8방향 직선+원 커버리지에서 "획 불명"은 드문 폴백이 됨.
  // 45°만 벗어난 방향(↖/↗)은 인접 획으로 스냅되고, 곡선은 원/최근접 직선으로 흡수됨.
  // 진짜 불명(dist>classifyThreshold)은 존재하나 합성으로 안정 재현이 어려워 전용 회귀는 두지 않음.
  it('탭 = 거부', () => {
    const r = judgeStroke([{ x: 400, y: 225, t: 0 }, { x: 402, y: 226, t: 10 }], META);
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe('tap');
  });
  it('작은 획 = 비율 인정', () => {
    const r = judgeStroke(synthLine([340, 225], [540, 225], 30, 220), META);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('h_lr');
    expect(r.accuracy!).toBeGreaterThanOrEqual(70);
  });
  it('사선 = diag_dr', () => {
    const r = judgeStroke(synthLine([150, 60], [650, 400], 40, 320), META);
    expect(r.strokeId).toBe('diag_dr');
  });
  it('내려찍기 = v_down', () => {
    const r = judgeStroke(synthLine([400, 40], [400, 420], 40, 320), META);
    expect(r.strokeId).toBe('v_down');
  });
});

describe('recognizeCommand (검결)', () => {
  it('순차 ←→ = 횡베기', () => expect(recognizeCommand([{ dir: 'L', t: 0 }, { dir: 'R', t: 180 }], BALANCE.simulMs)?.strokeId).toBe('h_lr'));
  it('동시 ↓+→ = 사선', () => expect(recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'R', t: 30 }], BALANCE.simulMs)?.strokeId).toBe('diag_dr'));
  it('패드 ↘ 단일 = 사선', () => expect(recognizeCommand([{ dir: 'DR', t: 0 }], BALANCE.simulMs)?.strokeId).toBe('diag_dr'));
  it('순차 ↑↓ = 내려찍기', () => expect(recognizeCommand([{ dir: 'U', t: 0 }, { dir: 'D', t: 150 }], BALANCE.simulMs)?.strokeId).toBe('v_down'));
  it('↓후→ 늦게(순차) ≠ 사선', () => expect(recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'R', t: 300 }], BALANCE.simulMs)).toBeNull());
  it('→← = 횡베기(우→좌) h_rl (8획)', () => expect(recognizeCommand([{ dir: 'R', t: 0 }, { dir: 'L', t: 150 }], BALANCE.simulMs)?.strokeId).toBe('h_rl'));
});

describe('좌수검류 미러', () => {
  it('우→좌 제스처 = 횡베기', () => {
    const r = judgeStroke(synthLine([700, 225], [100, 225], 40, 300), META, STYLES.saken);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('h_lr');
    expect(r.accuracy!).toBeGreaterThanOrEqual(85);
  });
  it('커맨드 →← = 횡베기', () => expect(recognizeCommand([{ dir: 'R', t: 0 }, { dir: 'L', t: 180 }], BALANCE.simulMs, STYLES.saken)?.strokeId).toBe('h_lr'));
  it('커맨드 ↓+← = 사선', () => expect(recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'L', t: 25 }], BALANCE.simulMs, STYLES.saken)?.strokeId).toBe('diag_dr'));
});

describe('judgeRhythm (검결 타이밍)', () => {
  it('←0 →400 = 퍼펙트+보너스', () => {
    const r = judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 400 }], 'h_lr');
    expect(r.grade).toBe('perfect'); expect(r.powerBonus).toBe(true);
  });
  it('오차70 = 그레이트', () => expect(judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 470 }], 'h_lr').grade).toBe('great'));
  it('오차220 = 배드', () => expect(judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 180 }], 'h_lr').grade).toBe('bad'));
  it('오차350 = 미스', () => expect(judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 50 }], 'h_lr').grade).toBe('miss'));
  it('동시 사선 오차30 = 퍼펙트+보너스', () => {
    const r = judgeRhythm([{ dir: 'D', t: 0 }, { dir: 'R', t: 30 }], 'diag_dr');
    expect(r.grade).toBe('perfect'); expect(r.powerBonus).toBe(true);
  });
  it('사선 오차120 = 굿', () => expect(judgeRhythm([{ dir: 'D', t: 0 }, { dir: 'R', t: 120 }], 'diag_dr').grade).toBe('good'));
  it('패드 단일 ↘ = 퍼펙트·보너스無', () => {
    const r = judgeRhythm([{ dir: 'DR', t: 0 }], 'diag_dr');
    expect(r.grade).toBe('perfect'); expect(r.powerBonus).toBe(false);
  });
  it('좌수 →0 ←400 = 퍼펙트', () => expect(judgeRhythm([{ dir: 'R', t: 0 }, { dir: 'L', t: 400 }], 'h_lr', STYLES.saken).grade).toBe('perfect'));
});

describe('T0-10 좌수 품질 동등성 + 클러스터', () => {
  const mir = (pts: Pt[]) => pts.map(p => ({ x: META.w - p.x, y: p.y, t: p.t }));
  const parity = (pts: Pt[], id: string) => {
    const u = judgeStroke(pts, META, STYLES.uraken), s = judgeStroke(mir(pts), META, STYLES.saken);
    return !u.rejected && !s.rejected && u.strokeId === id && s.strokeId === id && Math.abs(u.accuracy! - s.accuracy!) <= 1;
  };
  it('횡베기 반듯 품질동등', () => expect(parity(synthLine([100, 225], [700, 225], 40, 300), 'h_lr')).toBe(true));
  it('횡베기 흔들림 품질동등', () => expect(parity(synthLine([100, 225], [700, 225], 60, 300, 60), 'h_lr')).toBe(true));
  it('내려찍기 품질동등', () => expect(parity(synthLine([400, 40], [400, 420], 40, 320), 'v_down')).toBe(true));
  it('우수 ↑↓ 클러스터=우측', () => expect(STYLES.uraken.updownCluster).toBe('right'));
  it('좌수 ↑↓ 클러스터=좌측', () => expect(STYLES.saken.updownCluster).toBe('left'));
});

// 버그3: net 각도 섹터 분류 + 방향점수 = 국소 × 이상각 오차
function lineAtAngle(deg: number, len = 380, n = 40): Pt[] {
  const th = deg * Math.PI / 180, dx = Math.cos(th), dy = Math.sin(th), cx = 400, cy = 225;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1) - 0.5; out.push({ x: cx + dx * len * u, y: cy + dy * len * u, t: 300 * (u + 0.5) }); }
  return out;
}
describe('버그3 사선 섹터 분류 + 이상각 감점', () => {
  it('↘(down-right 45°)는 양수 각도 → diag_dr', () => {
    const r = judgeStroke(lineAtAngle(45), META);
    expect(r.strokeId).toBe('diag_dr');
    expect(r.breakdown!.direction).toBeGreaterThan(0.98);  // 이상각과 일치 → 방향 만점
  });
  it('22° → 횡베기(섹터 경계 아래) + 방향 감점', () => {
    const r = judgeStroke(lineAtAngle(22), META);
    expect(r.strokeId).toBe('h_lr');
    expect(r.breakdown!.direction).toBeLessThan(0.6);       // 22° 오차 → 크게 감점
  });
  it('30° → 사선(섹터 안) + 이상각 15° 감점', () => {
    const r = judgeStroke(lineAtAngle(30), META);
    expect(r.strokeId).toBe('diag_dr');
    expect(r.breakdown!.direction).toBeGreaterThan(0.5);
    expect(r.breakdown!.direction).toBeLessThan(0.75);      // 45° 대비 15° 오차 감점
  });
  it('60° → 사선 (섹터 안)', () => expect(judgeStroke(lineAtAngle(60), META).strokeId).toBe('diag_dr'));
  it('68° → 내려찍기(섹터 경계 위)', () => expect(judgeStroke(lineAtAngle(68), META).strokeId).toBe('v_down'));
  it('13° 곧은 획도 각도 틀리면 방향 감점(과거 ~100 → 이제 감점)', () => {
    const r = judgeStroke(lineAtAngle(13), META);
    expect(r.strokeId).toBe('h_lr');
    expect(r.breakdown!.direction).toBeLessThan(0.8);       // A=1−13/45=0.71 반영
    expect(r.accuracy!).toBeLessThan(100);                  // 총점도 감점(퍼펙트 아님)
  });
  it('↖/↗(획 없는 섹터)는 획 불명', () => {
    const r = judgeStroke(lineAtAngle(-45), META);          // -45° = ↗ up-right(315°)
    expect(r.rejected).toBe(true);
    expect(r.reason).toBe('unknown');
  });
});

describe('T1-02 획 8종 (검로)', () => {
  it('h_lr 횡베기(좌→우)', () => expect(judgeStroke(synthLine([100, 225], [700, 225], 40, 300), META).strokeId).toBe('h_lr'));
  it('h_rl 횡베기(우→좌)', () => expect(judgeStroke(synthLine([700, 225], [100, 225], 40, 300), META).strokeId).toBe('h_rl'));
  it('diag_dr 사선(↘)', () => expect(judgeStroke(synthLine([150, 60], [650, 400], 40, 320), META).strokeId).toBe('diag_dr'));
  it('diag_dl 사선(↙)', () => expect(judgeStroke(synthLine([650, 60], [150, 400], 40, 320), META).strokeId).toBe('diag_dl'));
  it('v_down 내려찍기', () => expect(judgeStroke(synthLine([400, 40], [400, 420], 40, 320), META).strokeId).toBe('v_down'));
  it('v_up 올려베기', () => expect(judgeStroke(synthLine([400, 420], [400, 40], 40, 320), META).strokeId).toBe('v_up'));
  it('thrust 찌르기(짧고 빠름 → lenBand)', () => {
    const r = judgeStroke(synthLine([400, 225], [520, 225], 20, 150), META); // 120px ≈ 0.13 대각비 → thrust 밴드
    expect(r.strokeId).toBe('thrust');
  });
  it('찌르기 길이의 긴 획은 횡베기(lenBand 분기)', () => {
    expect(judgeStroke(synthLine([100, 225], [700, 225], 40, 300), META).strokeId).toBe('h_lr');
  });
  it('wonmu 원무(완전한 원 → 형태 원)', () => {
    const r = judgeStroke(synthCircle(400, 225, 170, 40, 900, 360), META);
    expect(r.rejected).toBe(false);
    expect(r.strokeId).toBe('wonmu');
  });
  it('원무 반듯 = 그레이트+', () => {
    const r = judgeStroke(synthCircle(400, 225, 170, 48, 1000, 360), META);
    expect(r.accuracy!).toBeGreaterThanOrEqual(85);
  });
  it('원무 반시계 = 방향 0(등급 하락)', () => {
    const ccw = judgeStroke(synthCircle(400, 225, 170, 48, 1000, 360, 0, false), META);
    expect(ccw.strokeId).toBe('wonmu');
    expect(ccw.breakdown!.direction).toBe(0);
  });
  it('좌수 원무: 반시계로 그으면 h_rl 아닌 원무 + 방향 정상', () => {
    // 좌수는 미러 → 반시계 입력이 canonical 시계가 됨.
    const r = judgeStroke(synthCircle(400, 225, 170, 48, 1000, 360, 0, false), META, STYLES.saken);
    expect(r.strokeId).toBe('wonmu');
    expect(r.breakdown!.direction).toBeGreaterThan(0.5);
  });
});
