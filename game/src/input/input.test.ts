// INP-01~13 Unit/Acceptance Test — Input Acceptance Test Spec v1.0의 자동 TC 매핑.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakeClock, InputContextController, PointerOwnershipRegistry, cancelPolicyFor } from './core.ts';
import { CommandBuffer, MovementProcessor, GestureCollector } from './processors.ts';
import { InputManager } from './manager.ts';
import { RawEventRecorder, replay, SequenceSource, KeyboardAdapter } from './adapters.ts';
import { validateInputConfig, DEFAULT_INPUT_CONFIG, type RawInputEvent } from './types.ts';

// ── 헬퍼 ──────────────────────────────────────────────
let SEQ = 0;
function ev(partial: Partial<RawInputEvent>): RawInputEvent {
  return {
    type: 'pointer_down', pointer_id: 0, x: 0, y: 0, key: '',
    timestamp_ms: 0, sequence_id: SEQ++, device: 'touch', is_over_ui: false,
    ...partial,
  };
}
function mkMgr(clock = new FakeClock(1000)) {
  SEQ = 0;
  return new InputManager({ clock, viewport: { w: 1280, h: 720 }, initialContext: 'gameplay_field', keepEventLog: true });
}

// ── INP-01 Config ─────────────────────────────────────
describe('INP-01 InputConfig 검증', () => {
  it('유효 Config 통과', () => {
    const { config, errors } = validateInputConfig(DEFAULT_INPUT_CONFIG);
    assert.equal(errors.length, 0);
    assert.equal(config.regions.movement_end_x, 0.4);
  });

  it('범위 밖 값 → 기본값 + INPUT-009 (v3.4 §15)', () => {
    const { config, errors } = validateInputConfig({
      regions: { movement_end_x: 5, gesture_start_x: 0.5 },
    } as never);
    assert.equal(config.regions.movement_end_x, 0.4);
    assert.ok(errors.some((e) => e.startsWith('INPUT-009')));
  });

  it('영역 순서 위반 → 기본값 복원', () => {
    const { config, errors } = validateInputConfig({
      regions: { movement_end_x: 0.8, gesture_start_x: 0.2 },
    } as never);
    assert.ok(config.regions.gesture_start_x >= config.regions.movement_end_x);
    assert.ok(errors.length > 0);
  });
});

// ── INP-04 Ownership (TC-110~113) ─────────────────────
describe('INP-04 Pointer Ownership', () => {
  it('TC-111 중복 할당 → INPUT-001, 기존 유지', () => {
    const r = new PointerOwnershipRegistry();
    assert.equal(r.assign(1, 'gesture'), true);
    assert.equal(r.assign(1, 'movement'), false);
    assert.equal(r.get(1), 'gesture');
    assert.ok(r.drainErrors()[0]!.startsWith('INPUT-001'));
  });

  it('release/releaseAll', () => {
    const r = new PointerOwnershipRegistry();
    r.assign(1, 'movement');
    r.assign(2, 'gesture');
    r.release(1);
    assert.equal(r.get(1), 'unowned');
    r.releaseAll();
    assert.equal(r.activeCount, 0);
  });
});

// ── INP-05 Context (TC-120~123) ───────────────────────
describe('INP-05 Context Controller', () => {
  it('TC-122 유효하지 않은 전환 → INPUT-005', () => {
    const c = new InputContextController('result');
    assert.equal(c.transition('pause'), null);
    assert.ok(c.drainErrors()[0]!.startsWith('INPUT-005'));
  });

  it('Field→Duel 정책 = 제스처만 취소 (TC-121)', () => {
    assert.equal(cancelPolicyFor('gameplay_field', 'gameplay_duel'), 'gesture_only');
  });

  it('Gameplay→Pause 정책 = 전체 취소 (TC-120)', () => {
    assert.equal(cancelPolicyFor('gameplay_field', 'pause'), 'all');
  });

  it('Any→Result = 전체 취소', () => {
    assert.equal(cancelPolicyFor('gameplay_duel', 'result'), 'all');
  });
});

// ── INP-07 Movement (TC-100~101) ──────────────────────
describe('INP-07 Movement', () => {
  const cfg = DEFAULT_INPUT_CONFIG;

  it('TC-100 키보드: 대각 정규화·상충 0', () => {
    const m = new MovementProcessor(cfg, 720);
    m.keyDown('w');
    m.keyDown('d');
    const v = m.current();
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
    m.keyDown('a'); // a+d 상충
    m.keyUp('w');
    const v2 = m.current();
    assert.equal(v2.x, 0);
    assert.equal(v2.y, 0);
  });

  it('TC-101 터치 스틱: dead_zone 내 0, 경계 밖 clamp 1', () => {
    const m = new MovementProcessor(cfg, 720);
    m.stickDown(1, 200, 500);
    m.stickMove(1, 200 + 720 * 0.05, 500); // dead_zone(0.135) 미만
    assert.equal(m.current().magnitude, 0);
    m.stickMove(1, 200 + 720 * 2, 500); // full 초과
    assert.equal(m.current().magnitude, 1);
    m.stickUp(1);
    assert.equal(m.current().magnitude, 0);
  });

  it('결합: 최근 장치 우선, 합산 금지 (v3.4 §8.3)', () => {
    const m = new MovementProcessor(cfg, 720);
    m.keyDown('d');
    m.stickDown(1, 200, 500);
    m.stickMove(1, 200, 500 + 720); // 터치 아래 방향
    const v = m.current();
    assert.equal(v.device, 'touch');
    assert.ok(v.y > 0 && Math.abs(v.x) < 1e-9); // 키보드 +x 미합산
  });
});

// ── INP-08/09 Collector + Buffer (TC-140~142) ────────
describe('INP-08 GestureCollector', () => {
  const cfg = DEFAULT_INPUT_CONFIG;

  it('동시 2세션 금지 → INPUT-004 (TC-113)', () => {
    const g = new GestureCollector(cfg);
    assert.equal(g.tryStart(1, 0, 0, 100), true);
    assert.equal(g.tryStart(2, 0, 0, 100), false);
    assert.ok(g.drainErrors()[0]!.startsWith('INPUT-004'));
  });

  it('max_duration 초과 → 취소', () => {
    const g = new GestureCollector(cfg);
    g.tryStart(1, 0, 0, 1000);
    const r = g.update(1, 5, 5, 1000 + cfg.gesture.max_duration_ms + 1);
    assert.equal(r, 'max_duration');
    assert.equal(g.active, false);
  });

  it('점 수 미달 종료 → too_few_points', () => {
    const g = new GestureCollector(cfg);
    g.tryStart(1, 0, 0, 1000);
    g.update(1, 5, 5, 1016);
    const r = g.end(1);
    assert.equal(r.canceled, 'too_few_points');
  });
});

describe('INP-09 CommandBuffer', () => {
  it('TC-140 만료', () => {
    const b = new CommandBuffer(16);
    b.enqueue('dodge', {}, 1000, 100, 1);
    const expired = b.expire(1100);
    assert.equal(expired.length, 1);
    assert.equal(expired[0]!.state, 'expired');
    assert.equal(b.size, 0);
  });

  it('TC-141 우선순위 소비: dodge(70) > skill(60)', () => {
    const b = new CommandBuffer(16);
    b.enqueue('skill', {}, 1000, 200, 1);
    b.enqueue('dodge', {}, 1001, 200, 2);
    const c = b.tryConsume(1002, () => 'ok');
    assert.equal(c!.type, 'dodge');
  });

  it('TC-142 중복 sequence 거부(INPUT-006) + 용량 초과(INPUT-007)', () => {
    const b = new CommandBuffer(2);
    b.enqueue('skill', {}, 1000, 500, 7);
    assert.equal(b.enqueue('skill', {}, 1001, 500, 7), null);
    assert.ok(b.drainErrors()[0]!.startsWith('INPUT-006'));
    b.enqueue('dodge', {}, 1002, 500, 8);
    b.enqueue('dodge', {}, 1003, 500, 9); // 용량 2 초과 → 최저 우선순위(skill) 제거
    assert.ok(b.drainErrors()[0]!.startsWith('INPUT-007'));
    assert.equal(b.size, 2);
    const first = b.tryConsume(1004, () => 'ok');
    assert.equal(first!.type, 'dodge');
  });

  it('blocked는 유지, rejected는 제거', () => {
    const b = new CommandBuffer(16);
    b.enqueue('dodge', {}, 1000, 500, 1);
    assert.equal(b.tryConsume(1001, () => 'blocked'), null);
    assert.equal(b.size, 1);
    assert.equal(b.tryConsume(1002, () => 'rejected'), null);
    assert.equal(b.size, 0);
  });
});

// ── INP-11 Manager E2E (핵심 TC) ──────────────────────
describe('INP-11 InputManager E2E', () => {
  it('TC-102 이동 중 제스처 동시 입력 — 간섭 0', () => {
    const clock = new FakeClock(1000);
    const m = mkMgr(clock);
    let gestureDone = 0;
    m.onGesture((g) => {
      gestureDone++;
      assert.ok(g.points.length >= 12);
    });
    // 왼손 스틱 (x=200 < 0.4*1280=512)
    m.push(ev({ type: 'pointer_down', pointer_id: 1, x: 200, y: 500, timestamp_ms: 1000 }));
    m.push(ev({ type: 'pointer_move', pointer_id: 1, x: 400, y: 500, timestamp_ms: 1016 }));
    // 오른손 제스처 (x≥640) — 12점 이상
    m.push(ev({ type: 'pointer_down', pointer_id: 2, x: 700, y: 350, timestamp_ms: 1020 }));
    for (let i = 1; i <= 14; i++) {
      m.push(ev({ type: 'pointer_move', pointer_id: 2, x: 700 + i * 25, y: 350, timestamp_ms: 1020 + i * 8 }));
    }
    m.push(ev({ type: 'pointer_up', pointer_id: 2, x: 1080, y: 350, timestamp_ms: 1140 }));
    clock.set(1150);
    m.update();
    const s = m.snapshot();
    assert.equal(gestureDone, 1, '제스처 1회 완성');
    assert.ok(s.move.x > 0, '이동 유지');
    assert.equal(s.move.device, 'touch');
  });

  it('TC-105 UI 소유 포인터는 게임 영역 드래그에도 전이 금지', () => {
    const m = mkMgr();
    m.push(ev({ type: 'pointer_down', pointer_id: 3, x: 700, y: 100, is_over_ui: true }));
    m.push(ev({ type: 'pointer_move', pointer_id: 3, x: 900, y: 350 }));
    m.push(ev({ type: 'pointer_up', pointer_id: 3, x: 900, y: 350 }));
    m.update();
    const s = m.snapshot();
    assert.equal(s.gesture_active, false);
    assert.equal(s.owners.length, 0);
  });

  it('TC-112 무주공산 move/up → INPUT-002/003, 크래시 없음', () => {
    const m = mkMgr();
    m.push(ev({ type: 'pointer_move', pointer_id: 9, x: 100, y: 100 }));
    m.push(ev({ type: 'pointer_up', pointer_id: 9, x: 100, y: 100 }));
    m.update();
    const errs = m.drainErrors();
    assert.ok(errs.some((e) => e.startsWith('INPUT-002')));
    assert.ok(errs.some((e) => e.startsWith('INPUT-003')));
  });

  it('TC-120 Pause 진입 → 전체 취소, 복귀 후 유령 입력 0', () => {
    const clock = new FakeClock(1000);
    const m = mkMgr(clock);
    m.push(ev({ type: 'key_down', key: 'd', device: 'keyboard', pointer_id: -1 }));
    m.push(ev({ type: 'pointer_down', pointer_id: 2, x: 700, y: 350 }));
    m.update();
    assert.ok(m.snapshot().move.x > 0);
    m.changeContext('pause');
    const s = m.snapshot();
    assert.equal(s.move.magnitude, 0, '이동 0');
    assert.equal(s.gesture_active, false, '제스처 취소');
    assert.equal(s.buffer_size, 0);
    // 복귀 — 이전 키 홀드는 리셋된 상태여야
    m.changeContext('gameplay_field');
    m.update();
    assert.equal(m.snapshot().move.magnitude, 0);
  });

  it('TC-121 Field→Duel: 이동 유지 + 제스처만 취소', () => {
    const clock = new FakeClock(1000);
    const m = mkMgr(clock);
    m.push(ev({ type: 'pointer_down', pointer_id: 1, x: 200, y: 500 }));
    m.push(ev({ type: 'pointer_move', pointer_id: 1, x: 450, y: 500 }));
    m.push(ev({ type: 'pointer_down', pointer_id: 2, x: 800, y: 350 }));
    m.update();
    assert.equal(m.snapshot().gesture_active, true);
    m.changeContext('gameplay_duel');
    const s = m.snapshot();
    assert.equal(s.context, 'gameplay_duel');
    assert.equal(s.gesture_active, false, '제스처 취소');
    assert.ok(s.move.magnitude > 0, '이동 유지');
  });

  it('TC-123 이벤트 순서: before_context_change → cancel → context_changed', () => {
    const m = mkMgr();
    m.push(ev({ type: 'pointer_down', pointer_id: 2, x: 800, y: 350 }));
    m.update();
    m.bus.clearHistory();
    m.changeContext('pause');
    const names = m.bus.history().map((e) => e.name);
    const iBefore = names.indexOf('before_context_change');
    const iCancel = names.indexOf('before_input_cancel');
    const iChanged = names.indexOf('context_changed');
    assert.ok(iBefore < iCancel && iCancel < iChanged, names.join(','));
  });

  it('TC-130 포커스 손실 → CancelAllInput', () => {
    const m = mkMgr();
    m.push(ev({ type: 'key_down', key: 'd', device: 'keyboard', pointer_id: -1 }));
    m.push(ev({ type: 'pointer_down', pointer_id: 2, x: 800, y: 350 }));
    m.update();
    m.push(ev({ type: 'focus_lost', pointer_id: -1 }));
    m.update();
    const s = m.snapshot();
    assert.equal(s.move.magnitude, 0);
    assert.equal(s.gesture_active, false);
    assert.equal(s.owners.length, 0);
  });

  it('TC-104 회피(Space) → dodge 버퍼 등록·우선 소비', () => {
    const clock = new FakeClock(1000);
    const m = mkMgr(clock);
    m.push(ev({ type: 'key_down', key: ' ', device: 'keyboard', pointer_id: -1, timestamp_ms: 1000 }));
    m.update();
    assert.equal(m.snapshot().buffer_size, 1);
    const c = m.buffer.tryConsume(clock.now(), () => 'ok');
    assert.equal(c!.type, 'dodge');
  });

  it('버퍼 만료 이벤트 (TC-140 연동)', () => {
    const clock = new FakeClock(1000);
    const m = mkMgr(clock);
    m.push(ev({ type: 'key_down', key: ' ', device: 'keyboard', pointer_id: -1, timestamp_ms: 1000 }));
    m.update();
    clock.advance(200); // dodge ttl 100ms 초과
    m.update();
    assert.equal(m.snapshot().buffer_size, 0);
    assert.ok(m.bus.history().some((e) => e.name === 'buffer_expired'));
  });

  it('PC 마우스 = 좌측에서도 제스처 (이동은 키보드 전담)', () => {
    const m = mkMgr();
    m.push(ev({ type: 'pointer_down', pointer_id: 1, x: 100, y: 350, device: 'mouse' }));
    m.update();
    assert.equal(m.snapshot().gesture_active, true);
  });

  it('sequence 역행 주입 → 무시 + 오류 기록', () => {
    const m = mkMgr();
    m.push(ev({ type: 'pointer_down', pointer_id: 1, x: 200, y: 500, sequence_id: 100 }));
    m.push(ev({ type: 'pointer_move', pointer_id: 1, x: 300, y: 500, sequence_id: 50 })); // 역행
    m.update();
    assert.ok(m.drainErrors().some((e) => e.includes('raw:50')));
  });
});

// ── INP-13 리플레이 결정론 (TC-150~152) ───────────────
describe('INP-13 리플레이 결정론', () => {
  function scenario(): RawInputEvent[] {
    SEQ = 0;
    const evs: RawInputEvent[] = [];
    evs.push(ev({ type: 'pointer_down', pointer_id: 1, x: 200, y: 500, timestamp_ms: 1000 }));
    evs.push(ev({ type: 'pointer_move', pointer_id: 1, x: 420, y: 500, timestamp_ms: 1030 }));
    evs.push(ev({ type: 'pointer_down', pointer_id: 2, x: 700, y: 350, timestamp_ms: 1040 }));
    for (let i = 1; i <= 14; i++) {
      evs.push(ev({ type: 'pointer_move', pointer_id: 2, x: 700 + i * 25, y: 350, timestamp_ms: 1040 + i * 8 }));
    }
    evs.push(ev({ type: 'pointer_up', pointer_id: 2, x: 1080, y: 350, timestamp_ms: 1160 }));
    evs.push(ev({ type: 'key_down', key: ' ', device: 'keyboard', pointer_id: -1, timestamp_ms: 1170 }));
    return evs;
  }

  function run(frameMs: number): string {
    const clock = new FakeClock(1000);
    const m = new InputManager({ clock, viewport: { w: 1280, h: 720 }, initialContext: 'gameplay_field', keepEventLog: true });
    const out: string[] = [];
    m.onGesture((g) => out.push(`gesture:${g.points.length}`));
    m.bus.on('*', (e) => {
      if (e.name === 'move_changed' || e.name === 'dodge_requested' || e.name === 'gesture_ended') {
        out.push(e.name);
      }
    });
    replay(scenario(), m, (t) => clock.set(t), frameMs);
    return out.join('|');
  }

  it('TC-151 동일 시퀀스 2회 재생 = 동일 결과', () => {
    assert.equal(run(16), run(16));
  });

  it('TC-150 FPS 독립: 33ms(30fps)/16ms(60fps)/8ms(120fps) 커맨드 동일', () => {
    const a = run(33);
    const b = run(16);
    const c = run(8);
    // move_changed는 프레임 경계에 따라 병합될 수 있으므로 핵심 커맨드만 비교
    const key = (s: string) => s.split('|').filter((x) => x !== 'move_changed').join('|');
    assert.equal(key(a), key(b));
    assert.equal(key(b), key(c));
  });

  it('레코더 tap → dump 왕복', () => {
    const clock = new FakeClock(1000);
    const m = mkMgr(clock);
    const rec = new RawEventRecorder();
    rec.tap(m);
    m.push(ev({ type: 'pointer_down', pointer_id: 1, x: 200, y: 500, timestamp_ms: 1000 }));
    m.update();
    assert.equal(rec.dump().length, 1);
  });
});

// ── INP-03 어댑터 (fake DOM 이벤트) ───────────────────
describe('INP-03 Adapters', () => {
  it('키 리핏 무시 (e.repeat)', () => {
    const clock = new FakeClock(0);
    const m = mkMgr(clock);
    const seq = new SequenceSource();
    const kb = new KeyboardAdapter(m, clock, seq);
    kb.handleKeyDown({ key: 'd' });
    kb.handleKeyDown({ key: 'd', repeat: true });
    m.update();
    // repeat가 무시됐다면 keydown 1회만 반영 — 이동은 동일하나 sequence 소비 1회
    assert.equal(seq.next(), 1);
  });
});
