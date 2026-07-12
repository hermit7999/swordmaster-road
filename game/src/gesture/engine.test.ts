// GES-06~10 E2E: 8검술 인식 + 충돌 매트릭스 + 결정론 (Bible §6, v2.9)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GestureEngine } from './engine.ts';
import { line, polyline, circle, garbage, VP, VP_HI } from './testUtils.ts';

const eng = new GestureEngine();

function rec(pts: ReturnType<typeof line>, vp = VP) {
  return eng.recognize(pts, vp);
}

describe('기본 검술 8종 인식 (성공 ≥85)', () => {
  it('횡베기: E 직선', () => {
    const r = rec(line(300, 350, 800, 350));
    assert.equal(r.gesture_id, 'slash_h');
    assert.equal(r.outcome, 'success');
    assert.ok(r.score >= 85, `score=${r.score}`);
  });

  it('역베기: W 직선', () => {
    const r = rec(line(800, 350, 300, 350));
    assert.equal(r.gesture_id, 'slash_back');
    assert.equal(r.outcome, 'success');
  });

  it('내려베기: S 직선', () => {
    const r = rec(line(600, 150, 600, 550));
    assert.equal(r.gesture_id, 'slash_v');
    assert.equal(r.outcome, 'success');
  });

  it('올려베기: N 직선', () => {
    const r = rec(line(600, 550, 600, 150));
    assert.equal(r.gesture_id, 'slash_up');
    assert.equal(r.outcome, 'success');
  });

  it('사선베기: SE 직선', () => {
    const r = rec(line(350, 200, 750, 600));
    assert.equal(r.gesture_id, 'slash_diag');
    assert.equal(r.outcome, 'success');
  });

  it('발도술: W→E (당겼다 긋기)', () => {
    const r = rec(polyline([[700, 350], [480, 350], [1050, 350]], 70, 500));
    assert.equal(r.gesture_id, 'iaido');
    assert.equal(r.outcome, 'success');
  });

  it('패링: SE→NE (✓)', () => {
    const r = rec(polyline([[450, 250], [650, 480], [900, 230]], 60, 350));
    assert.equal(r.gesture_id, 'parry');
    assert.equal(r.outcome, 'success');
  });

  it('회전베기: 시계방향 원', () => {
    const r = rec(circle(640, 380, 190));
    assert.equal(r.gesture_id, 'spin');
    assert.equal(r.outcome, 'success');
  });

  it('회전베기: 반시계 원도 loop로 인식 (Open Question 3 — 현행 허용)', () => {
    const r = rec(circle(640, 380, 190, 64, 600, 1000, 0, -360));
    assert.equal(r.gesture_id, 'spin');
  });
});

describe('충돌 매트릭스 (Bible §6)', () => {
  it('발도술 W 세그먼트가 횡베기로 오인되지 않음', () => {
    const r = rec(polyline([[700, 350], [480, 350], [1050, 350]], 70, 500));
    assert.notEqual(r.gesture_id, 'slash_h');
  });

  it('사선베기 단독은 패링으로 오인되지 않음', () => {
    const r = rec(line(350, 200, 750, 600));
    assert.notEqual(r.gesture_id, 'parry');
  });

  it('패링 ✓는 사선베기로 오인되지 않음', () => {
    const r = rec(polyline([[450, 250], [650, 480], [900, 230]], 60, 350));
    assert.notEqual(r.gesture_id, 'slash_diag');
  });

  it('약간 기운 횡베기(±20° 내)도 횡베기', () => {
    const r = rec(line(300, 380, 800, 300)); // 약 -9°
    assert.equal(r.gesture_id, 'slash_h');
    assert.equal(r.outcome, 'success');
  });
});

describe('실패/경계 처리 (v2.9 §6)', () => {
  it('지그재그 쓰레기 입력 → 실행 없음', () => {
    const r = rec(garbage());
    assert.equal(r.outcome, 'fail');
    assert.equal(r.gesture_id, null);
  });

  it('점 부족 → too_few_points', () => {
    const r = rec(line(0, 0, 100, 100, 5));
    assert.equal(r.outcome, 'fail');
    assert.ok(r.debug.reason.startsWith('too_few_points'));
  });

  it('너무 짧은 획 → 길이 미달로 성공 불가', () => {
    const r = rec(line(600, 350, 660, 350, 15, 80)); // 60px ≈ 0.083 (min 0.22)
    assert.notEqual(r.outcome, 'success');
  });

  it('너무 느린 획(2.5s) → 성공 불가', () => {
    const r = rec(line(300, 350, 800, 350, 40, 2500));
    assert.notEqual(r.outcome, 'success');
  });

  it('실패 시 사유·후보 로그 제공 (v2.7 §9)', () => {
    const r = rec(garbage());
    assert.ok(r.debug.reason.length > 0);
    assert.ok(Array.isArray(r.debug.candidates));
  });
});

describe('결정론·해상도 독립 (TC-150 계열)', () => {
  it('동일 입력 → 항상 동일 결과', () => {
    const pts = polyline([[450, 250], [650, 480], [900, 230]], 60, 350);
    const a = rec(pts);
    const b = rec(pts.map((p) => ({ ...p })));
    assert.equal(a.gesture_id, b.gesture_id);
    assert.equal(a.score, b.score);
  });

  it('720p와 1440p 동일 비율 입력 → 동일 판정', () => {
    const lo = rec(line(300, 350, 800, 350), VP);
    const hi = rec(line(600, 700, 1600, 700), VP_HI);
    assert.equal(lo.gesture_id, hi.gesture_id);
    assert.ok(Math.abs(lo.score - hi.score) < 0.5, `${lo.score} vs ${hi.score}`);
  });

  it('입력 속도 3단(느림/보통/빠름) 동일 스킬 (TC-003)', () => {
    for (const dur of [150, 400, 850]) {
      const r = rec(line(300, 350, 800, 350, 40, dur));
      assert.equal(r.gesture_id, 'slash_h', `dur=${dur}`);
    }
  });

  it('난이도 오차 스케일: Easy(1.3)에서 기운 획 관용도 증가', () => {
    const tilted = line(300, 420, 800, 260); // 약 -18°
    const normal = new GestureEngine();
    const easy = new GestureEngine(undefined, { tolerance_scale: 1.3 });
    const rn = normal.recognize(tilted, VP);
    const re = easy.recognize(tilted, VP);
    assert.ok(re.score >= rn.score);
  });
});

describe('버그 수정 회귀: 와이드 화면 가로 획 (2026-07-12 실기)', () => {
  it('1920×430 뷰포트에서 화면을 가로지르는 긴 횡베기 성공', () => {
    const wideVp = { w: 1920, h: 430 };
    const r = eng.recognize(line(150, 215, 1850, 215, 60, 700), wideVp);
    assert.equal(r.gesture_id, 'slash_h', r.debug.reason);
    assert.equal(r.outcome, 'success', `score=${r.score}`);
  });

  it('긴 발도술(W→E)도 와이드에서 성공', () => {
    const wideVp = { w: 1920, h: 430 };
    const r = eng.recognize(polyline([[1000, 215], [700, 215], [1850, 215]], 70, 800), wideVp);
    assert.equal(r.gesture_id, 'iaido');
    assert.equal(r.outcome, 'success');
  });

  it('세로 획은 기존대로 (상한 미변경 확인)', () => {
    const r = eng.recognize(line(600, 150, 600, 550), VP);
    assert.equal(r.gesture_id, 'slash_v');
    assert.equal(r.outcome, 'success');
  });
});

describe('좌수검류 미러 (프로토타입 유파 이식)', () => {
  it('좌수: 우→좌 긋기 = 횡베기 (품질 동등)', async () => {
    const { LEFT_GESTURES } = await import('./templates.ts');
    const left = new GestureEngine(LEFT_GESTURES);
    const r = left.recognize(line(800, 350, 300, 350), VP);
    assert.equal(r.gesture_id, 'slash_h');
    assert.equal(r.outcome, 'success');
    const right = new GestureEngine();
    const rr = right.recognize(line(300, 350, 800, 350), VP);
    assert.ok(Math.abs(r.score - rr.score) < 0.5, '좌우 품질 동등');
  });

  it('좌수: 발도술 = E→W (당겼다 긋기 미러)', async () => {
    const { LEFT_GESTURES } = await import('./templates.ts');
    const left = new GestureEngine(LEFT_GESTURES);
    const r = left.recognize(polyline([[500, 350], [720, 350], [150, 350]], 70, 500), VP);
    assert.equal(r.gesture_id, 'iaido');
  });

  it('좌수: 세로 획은 미러 무관', async () => {
    const { LEFT_GESTURES } = await import('./templates.ts');
    const left = new GestureEngine(LEFT_GESTURES);
    assert.equal(left.recognize(line(600, 150, 600, 550), VP).gesture_id, 'slash_v');
  });
});

describe('반복 안정성 (TC-002 축소판: 100회)', () => {
  it('8검술 × 100회 반복 = 오인식 0', () => {
    const cases: Array<[string, ReturnType<typeof line>]> = [
      ['slash_h', line(300, 350, 800, 350)],
      ['slash_back', line(800, 350, 300, 350)],
      ['slash_v', line(600, 150, 600, 550)],
      ['slash_up', line(600, 550, 600, 150)],
      ['slash_diag', line(350, 200, 750, 600)],
      ['iaido', polyline([[700, 350], [480, 350], [1050, 350]], 70, 500)],
      ['parry', polyline([[450, 250], [650, 480], [900, 230]], 60, 350)],
      ['spin', circle(640, 380, 190)],
    ];
    for (const [want, pts] of cases) {
      for (let i = 0; i < 100; i++) {
        const r = rec(pts);
        assert.equal(r.gesture_id, want);
      }
    }
  });
});
