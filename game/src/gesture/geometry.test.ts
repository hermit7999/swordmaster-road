// GES-02~05 Unit Test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  angularDiff,
  bbox,
  buildSegments,
  noiseFilter,
  normalizeByViewport,
  pathLength,
  quantizeDir,
  rdp,
  resample,
  toUnitBox,
  totalTurnDeg,
} from './geometry.ts';
import { line, polyline, circle, VP, VP_HI } from './testUtils.ts';

describe('GES-02 Normalize', () => {
  it('해상도 독립: 같은 비율 획은 같은 정규화 결과', () => {
    const a = normalizeByViewport(line(100, 300, 500, 300), VP);
    const b = normalizeByViewport(line(200, 600, 1000, 600), VP_HI);
    for (let i = 0; i < a.length; i++) {
      assert.ok(Math.abs(a[i]!.x - b[i]!.x) < 1e-9);
      assert.ok(Math.abs(a[i]!.y - b[i]!.y) < 1e-9);
    }
  });

  it('각도 보존: x,y 동일 스칼라 나눗셈', () => {
    const pts = normalizeByViewport(line(0, 0, 100, 100), { w: 3000, h: 720 });
    const dx = pts[pts.length - 1]!.x - pts[0]!.x;
    const dy = pts[pts.length - 1]!.y - pts[0]!.y;
    assert.ok(Math.abs(dx - dy) < 1e-9); // 45° 유지
  });
});

describe('GES-03 Noise Filter', () => {
  it('중복·미세 이동 제거, 끝점 보존', () => {
    const pts = [
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 8 },        // 중복
      { x: 0.001, y: 0, t: 16 },   // 미세
      { x: 0.5, y: 0, t: 24 },
      { x: 0.5001, y: 0, t: 32 },  // 미세 (끝점)
    ];
    const out = noiseFilter(pts, 0.003);
    assert.equal(out[0]!.x, 0);
    assert.equal(out[out.length - 1]!.x, 0.5001); // 끝점 보존
    assert.ok(out.length <= 3);
  });
});

describe('GES-04 Resample', () => {
  it('64점 균일 재표본, 끝점 유지', () => {
    const out = resample(line(0, 0, 640, 0, 10, 100), 64);
    assert.equal(out.length, 64);
    assert.ok(Math.abs(out[0]!.x - 0) < 1e-6);
    assert.ok(Math.abs(out[63]!.x - 640) < 1e-3);
    // 균일 간격
    const d1 = out[1]!.x - out[0]!.x;
    const d2 = out[33]!.x - out[32]!.x;
    assert.ok(Math.abs(d1 - d2) < 1e-3);
  });

  it('점 1개/길이 0 안전 처리', () => {
    const out = resample([{ x: 5, y: 5, t: 0 }], 8);
    assert.equal(out.length, 8);
    assert.equal(out[7]!.x, 5);
  });
});

describe('GES-05 방향/코너', () => {
  it('8방향 양자화 (y-down 좌표계)', () => {
    assert.equal(quantizeDir(0), 'E');
    assert.equal(quantizeDir(90), 'S');
    assert.equal(quantizeDir(180), 'W');
    assert.equal(quantizeDir(270), 'N');
    assert.equal(quantizeDir(315), 'NE');
    assert.equal(quantizeDir(44), 'SE');   // 경계 내
    assert.equal(quantizeDir(350), 'E');
  });

  it('angularDiff 원형 차이', () => {
    assert.equal(angularDiff(350, 10), 20);
    assert.equal(angularDiff(0, 180), 180);
  });

  it('L자 획 → 코너 1개, 세그먼트 2개 (E→S)', () => {
    const pts = resample(polyline([[100, 100], [500, 100], [500, 400]]), 64);
    const size = bbox(pts).size;
    const verts = rdp(pts, size * 0.055);
    const segs = buildSegments(verts, 25, 0.08);
    assert.equal(segs.length, 2);
    assert.equal(segs[0]!.dir, 'E');
    assert.equal(segs[1]!.dir, 'S');
  });

  it('직선 → 세그먼트 1개', () => {
    const pts = resample(line(100, 300, 500, 340), 64); // 살짝 기운 직선
    const size = bbox(pts).size;
    const segs = buildSegments(rdp(pts, size * 0.055), 25, 0.08);
    assert.equal(segs.length, 1);
    assert.equal(segs[0]!.dir, 'E'); // ±20° 내
  });

  it('시계방향 원 → 총회전각 ≈ +360', () => {
    const pts = circle(400, 400, 150);
    const turn = totalTurnDeg(pts);
    assert.ok(turn > 300, `turn=${turn}`);
  });

  it('toUnitBox 종횡비 보존', () => {
    const pts = toUnitBox(line(0, 0, 200, 100, 20));
    const { w, h } = bbox(pts);
    assert.ok(Math.abs(w - 1) < 1e-6);
    assert.ok(Math.abs(h - 0.5) < 1e-6);
  });

  it('pathLength', () => {
    assert.ok(Math.abs(pathLength(line(0, 0, 300, 400, 20)) - 500) < 1e-6);
  });
});
