// ITG-01 통합 테스트: Raw 이벤트 → 스킬 결정 (E2E 전체 사슬).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock } from '../input/core.ts';
import { InputManager } from '../input/manager.ts';
import type { RawInputEvent } from '../input/types.ts';
import { GesturePipeline, toGrade } from './pipeline.ts';

let SEQ = 0;
function ev(partial: Partial<RawInputEvent>): RawInputEvent {
  return {
    type: 'pointer_down', pointer_id: 0, x: 0, y: 0, key: '',
    timestamp_ms: 0, sequence_id: SEQ++, device: 'touch', is_over_ui: false,
    ...partial,
  };
}

function setup() {
  SEQ = 0;
  const clock = new FakeClock(1000);
  const vp = { w: 1280, h: 720 };
  const mgr = new InputManager({ clock, viewport: vp, initialContext: 'gameplay_field' });
  const pipe = new GesturePipeline(mgr, vp);
  const skills: Array<{ skill_id: string; grade: string; parry_attempt_failed: boolean }> = [];
  pipe.onSkill((s) => skills.push({ skill_id: s.skill_id, grade: s.grade, parry_attempt_failed: s.parry_attempt_failed }));
  return { clock, mgr, pipe, skills };
}

/** 우측 영역에 직선 획 주입 (touch). */
function strokeLine(mgr: InputManager, x0: number, y0: number, x1: number, y1: number, id = 2, t0 = 1000, dur = 300, n = 20) {
  mgr.push(ev({ type: 'pointer_down', pointer_id: id, x: x0, y: y0, timestamp_ms: t0 }));
  for (let i = 1; i < n; i++) {
    const r = i / (n - 1);
    mgr.push(ev({
      type: 'pointer_move', pointer_id: id,
      x: x0 + (x1 - x0) * r, y: y0 + (y1 - y0) * r,
      timestamp_ms: t0 + dur * r,
    }));
  }
  mgr.push(ev({ type: 'pointer_up', pointer_id: id, x: x1, y: y1, timestamp_ms: t0 + dur }));
}

describe('ITG-01 Raw→Skill 전체 사슬', () => {
  it('E 획 → slash_h 스킬 (이동 유지 동시)', () => {
    const { clock, mgr, skills } = setup();
    mgr.push(ev({ type: 'pointer_down', pointer_id: 1, x: 200, y: 500, timestamp_ms: 1000 }));
    mgr.push(ev({ type: 'pointer_move', pointer_id: 1, x: 420, y: 500, timestamp_ms: 1010 }));
    strokeLine(mgr, 700, 350, 1150, 350);
    clock.set(1400);
    mgr.update();
    assert.equal(skills.length, 1);
    assert.equal(skills[0]!.skill_id, 'slash_h');
    assert.ok(['perfect', 'great', 'good'].includes(skills[0]!.grade));
    assert.ok(mgr.snapshot().move.x > 0, '이동 유지');
  });

  it('TC-106 패링 유효창 내 SE 단독 → 사선베기 미실행, 패링 실패 처리', () => {
    const { clock, mgr, pipe, skills } = setup();
    pipe.setParryWindow(true);
    strokeLine(mgr, 700, 200, 1050, 550); // SE
    clock.set(1400);
    mgr.update();
    assert.equal(skills.length, 1);
    assert.equal(skills[0]!.skill_id, 'parry');
    assert.equal(skills[0]!.parry_attempt_failed, true);
  });

  it('유효창 밖 SE는 정상 사선베기', () => {
    const { clock, mgr, pipe, skills } = setup();
    pipe.setParryWindow(false);
    strokeLine(mgr, 700, 200, 1050, 550);
    clock.set(1400);
    mgr.update();
    assert.equal(skills[0]!.skill_id, 'slash_diag');
  });

  it('miss 입력 → 스킬 미발행 + onMiss 콜백', () => {
    const { clock, mgr, pipe, skills } = setup();
    let missed = 0;
    pipe.onMiss(() => missed++);
    // 짧은 지그재그 (인식 불가)
    const t0 = 1000;
    mgr.push(ev({ type: 'pointer_down', pointer_id: 2, x: 800, y: 300, timestamp_ms: t0 }));
    for (let i = 1; i <= 14; i++) {
      mgr.push(ev({
        type: 'pointer_move', pointer_id: 2,
        x: 800 + (i % 2 === 0 ? 60 : -60) + i * 6, y: 300 + (i % 3) * 55,
        timestamp_ms: t0 + i * 20,
      }));
    }
    mgr.push(ev({ type: 'pointer_up', pointer_id: 2, x: 900, y: 400, timestamp_ms: t0 + 300 }));
    clock.set(1400);
    mgr.update();
    assert.equal(skills.length, 0, '스킬 실행 금지');
    assert.equal(missed, 1);
  });

  it('등급 매핑 경계 (P02 §3)', () => {
    const mk = (outcome: 'success' | 'candidate' | 'fail', score: number) =>
      toGrade({ outcome, gesture_id: 'x', score, confidence: score / 100, elapsed_ms: 0, debug: { reason: '', candidates: [], segment_dirs: [], corner_count: 0, path_len: 0, total_turn_deg: 0, closed: false } });
    assert.equal(mk('success', 95), 'perfect');
    assert.equal(mk('success', 94.9), 'great');
    assert.equal(mk('success', 90), 'great');
    assert.equal(mk('success', 89.9), 'good');
    assert.equal(mk('success', 85), 'good');
    assert.equal(mk('candidate', 84.9), 'bad');
    assert.equal(mk('candidate', 70), 'bad');
    assert.equal(mk('fail', 0), 'miss');
  });

  it('W→E 발도술 전체 사슬', () => {
    const { clock, mgr, skills } = setup();
    const t0 = 1000;
    // W 당김 (짧게) 후 E 긋기 (길게)
    mgr.push(ev({ type: 'pointer_down', pointer_id: 2, x: 900, y: 350, timestamp_ms: t0 }));
    for (let i = 1; i <= 6; i++) {
      mgr.push(ev({ type: 'pointer_move', pointer_id: 2, x: 900 - i * 35, y: 350, timestamp_ms: t0 + i * 15 }));
    }
    for (let i = 1; i <= 14; i++) {
      mgr.push(ev({ type: 'pointer_move', pointer_id: 2, x: 690 + i * 38, y: 350, timestamp_ms: t0 + 90 + i * 15 }));
    }
    mgr.push(ev({ type: 'pointer_up', pointer_id: 2, x: 1222, y: 350, timestamp_ms: t0 + 300 }));
    clock.set(1400);
    mgr.update();
    assert.equal(skills.length, 1);
    assert.equal(skills[0]!.skill_id, 'iaido');
  });
});
