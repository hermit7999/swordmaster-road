// CBT-01~08 Unit Test (P03 §11 Acceptance 매핑)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ComboTracker, damageOf, inShape, isGroggy, applyPoise, makeCombatant, newAttackId,
  PlayerCombat, resolveAttack, resolveParry, updatePoise, type AttackEvent,
} from './combat.ts';
import { BALANCE } from '../data/balance.ts';

const O = { x: 0, y: 0, dir: 1 as const };

describe('CBT-01 히트 기하', () => {
  it('arc: 전방 부채꼴 — 안/밖/후방', () => {
    const arc = { type: 'arc' as const, angle_deg: 120, range: 1.6 };
    assert.equal(inShape(arc, O, { x: 1.0, y: 0, radius: 0.3 }), true);
    assert.equal(inShape(arc, O, { x: 2.5, y: 0, radius: 0.3 }), false); // 사거리 밖
    assert.equal(inShape(arc, O, { x: -1.0, y: 0, radius: 0.3 }), false); // 후방
  });

  it('line: 전방 직사각 — 폭 경계', () => {
    const line = { type: 'line' as const, width: 0.6, range: 2.8 };
    assert.equal(inShape(line, O, { x: 2.0, y: 0.2, radius: 0.3 }), true);
    assert.equal(inShape(line, O, { x: 2.0, y: 0.7, radius: 0.3 }), false); // 0.3+0.3 < 0.7
    assert.equal(inShape(line, O, { x: 3.5, y: 0, radius: 0.3 }), false);
    // 방향 반전
    assert.equal(inShape(line, { ...O, dir: -1 }, { x: -2.0, y: 0, radius: 0.3 }), true);
  });

  it('circle: 전방위', () => {
    const c = { type: 'circle' as const, range: 1.8 };
    assert.equal(inShape(c, O, { x: -1.5, y: 0.5, radius: 0.3 }), true);
    assert.equal(inShape(c, O, { x: 0, y: 2.5, radius: 0.3 }), false);
  });
});

describe('CBT-03 데미지 공식 (배율 조합)', () => {
  const base = { base: 20, grade: 'good' as const, comboMul: 1, counter: false, targetGroggy: false, modifierMul: 1, weakness: false };

  it('기본: 20 × 1.0 = 20', () => {
    assert.equal(damageOf(base), 20);
  });

  it('전체 조합: 퍼펙트×콤보상한×카운터×그로기×약점', () => {
    const d = damageOf({ ...base, grade: 'perfect', comboMul: 1.5, counter: true, targetGroggy: true, weakness: true });
    // 20 × 1.3 × 1.5 × 2.0 × 1.5 × 1.3 = 152.1 → 152
    assert.equal(d, 152);
  });

  it('최소 피해 1 보장', () => {
    assert.equal(damageOf({ ...base, base: 0.1, grade: 'bad' }), 1);
  });
});

describe('CBT-04 Poise/그로기', () => {
  it('만충 → 그로기 → 시간 경과 후 해제 + poise 리셋', () => {
    const c = makeCombatant({ id: 'e1', x: 1, poise_max: 60 });
    assert.equal(applyPoise(c, 30, 1000), false);
    assert.equal(applyPoise(c, 30, 1100), true); // 만충
    assert.equal(isGroggy(c, 1200), true);
    assert.equal(isGroggy(c, 1100 + BALANCE.poise.groggy_ms_normal), false);
    updatePoise(c, 1100 + BALANCE.poise.groggy_ms_normal + 1);
    assert.equal(c.poise, 0);
  });

  it('정예는 그로기 시간 짧음', () => {
    const c = makeCombatant({ id: 'e2', x: 1, poise_max: 10, elite: true });
    applyPoise(c, 10, 1000);
    assert.equal(isGroggy(c, 1000 + BALANCE.poise.groggy_ms_elite - 1), true);
    assert.equal(isGroggy(c, 1000 + BALANCE.poise.groggy_ms_elite), false);
  });

  it('3초 무적중 시 자연 감소', () => {
    const c = makeCombatant({ id: 'e3', x: 1, poise_max: 100 });
    applyPoise(c, 50, 1000);
    updatePoise(c, 2000); // 3초 전 — 유지
    assert.equal(c.poise, 50);
    updatePoise(c, 4100); // decay 시작 후
    assert.ok(c.poise < 50);
  });
});

describe('CBT-02/05 공격 해석', () => {
  function atk(partial: Partial<AttackEvent> = {}): AttackEvent {
    return {
      attack_id: newAttackId(), skill_id: 'slash_h', grade: 'good',
      origin: { x: 0, y: 0, dir: 1 }, combo: 0, counter: false, modifier_mul: 1,
      ...partial,
    };
  }

  it('중복 히트 0: 한 공격이 같은 적을 2회 타격 불가', () => {
    const e = makeCombatant({ id: 'e1', x: 1 });
    const rs = resolveAttack(atk(), [e, e], 1000); // 같은 참조 2회
    assert.equal(rs.length, 1);
  });

  it('관통(arc 범위 내 다수 동시 타격)', () => {
    const targets = [
      makeCombatant({ id: 'a', x: 0.8 }),
      makeCombatant({ id: 'b', x: 1.3 }),
      makeCombatant({ id: 'c', x: 3.0 }), // 밖
    ];
    const rs = resolveAttack(atk(), targets, 1000);
    assert.equal(rs.length, 2);
  });

  it('방패병: 정면 가드 → 피해 25% + guarded / 내려베기 반복 → 가드 브레이크', () => {
    const shield = makeCombatant({
      id: 's', x: 1, hp: 200, max_hp: 200, guard_front: true, guard_gauge: 50, guard_gauge_max: 50,
      facing: -1, weak_point: 'slash_v',
    });
    const r1 = resolveAttack(atk(), [shield], 1000)[0]!;
    assert.equal(r1.reaction, 'guarded');
    assert.ok(r1.damage <= 20 * 0.25 + 1);
    // 가드 게이지 소진 → 브레이크
    let broke = false;
    for (let i = 0; i < 5; i++) {
      const r = resolveAttack(atk({ skill_id: 'slash_v' }), [shield], 1100 + i * 500)[0];
      if (r && r.reaction === 'guard_break') broke = true;
    }
    assert.equal(broke, true);
    assert.equal(shield.guard_front, false, '방패 소실');
  });

  it('배후 공격은 가드 무시', () => {
    const shield = makeCombatant({ id: 's2', x: 1, guard_front: true, facing: 1 }); // 같은 방향 = 등짐
    const r = resolveAttack(atk(), [shield], 1000)[0]!;
    assert.notEqual(r.reaction, 'guarded');
  });

  it('십자참(pierce_guard)은 정면 가드 관통', () => {
    const shield = makeCombatant({ id: 's3', x: 1, guard_front: true, facing: -1, hp: 500, max_hp: 500 });
    const r = resolveAttack(atk({ skill_id: 'art_cross', grade: 'great' }), [shield], 1000)[0]!;
    assert.notEqual(r.reaction, 'guarded');
  });

  it('약점 적중 ×1.3 + weakness_hit 플래그', () => {
    const e = makeCombatant({ id: 'w', x: 1, weak_point: 'slash_h', hp: 100, max_hp: 100 });
    const r = resolveAttack(atk(), [e], 1000)[0]!;
    assert.equal(r.weakness_hit, true);
    assert.equal(r.damage, 26); // 20 × 1.3
  });

  it('슈퍼아머: 경직 대신 push, poise는 정상 누적', () => {
    const heavy = makeCombatant({ id: 'h', x: 1, super_armor: true, poise_max: 100 });
    const r = resolveAttack(atk(), [heavy], 1000)[0]!;
    assert.equal(r.reaction, 'push');
    assert.equal(heavy.poise, 10);
  });

  it('처치 → dead + finish 프로파일', () => {
    const e = makeCombatant({ id: 'd', x: 1, hp: 5, max_hp: 5 });
    const r = resolveAttack(atk(), [e], 1000)[0]!;
    assert.equal(r.reaction, 'dead');
    assert.equal(r.profile, 'finish_wave');
    assert.equal(e.alive, false);
  });

  it('그로기 대상 ×1.5', () => {
    const e = makeCombatant({ id: 'g', x: 1, hp: 100, max_hp: 100, poise_max: 5 });
    applyPoise(e, 10, 999); // 그로기
    const r = resolveAttack(atk(), [e], 1000)[0]!;
    assert.equal(r.groggy_bonus, true);
    assert.equal(r.damage, 30); // 20 × 1.5
  });
});

describe('CBT-06 콤보', () => {
  it('적중 누적 + 2.5s 무적중 리셋', () => {
    const c = new ComboTracker();
    c.onHit(1000);
    c.onHit(1500);
    assert.equal(c.current, 2);
    c.update(4001); // 1500 + 2500 초과
    assert.equal(c.current, 0);
  });

  it('배율 상한 1.5', () => {
    const c = new ComboTracker();
    for (let i = 0; i < 20; i++) c.onHit(1000 + i * 100);
    assert.equal(c.mul(), 1.5);
  });
});

describe('CBT-07 플레이어 피격/회피', () => {
  it('i-frame 경계 (600ms) 정확', () => {
    const p = new PlayerCombat();
    assert.equal(p.tryHit(10, 1000), true);
    assert.equal(p.tryHit(10, 1599), false); // 무적
    assert.equal(p.tryHit(10, 1600), true);
    assert.equal(p.hp, 80);
  });

  it('회피 i-frame 240ms + 반격 창', () => {
    const p = new PlayerCombat();
    p.onDodge(1000);
    assert.equal(p.tryHit(10, 1239), false);
    assert.equal(p.dodgeCounterActive(1000 + 240 + 299), true);
    assert.equal(p.dodgeCounterActive(1000 + 240 + 300), false);
    assert.equal(p.tryHit(10, 1240), true);
  });

  it('단일 피해 상한 40% (필살 태그 예외)', () => {
    const p = new PlayerCombat();
    p.tryHit(99, 1000);
    assert.equal(p.hp, 100 - 40);
    const p2 = new PlayerCombat();
    p2.tryHit(99, 1000, { unstoppable: true });
    assert.equal(p2.hp, 1);
  });

  it('피격 시 콤보 리셋', () => {
    const p = new PlayerCombat();
    p.combo.onHit(1000);
    p.combo.onHit(1100);
    p.tryHit(5, 1200);
    assert.equal(p.combo.current, 0);
  });
});

describe('패링 판정 (Bible §2.8-2: 판정 시점 = active 창)', () => {
  it('유효창 교차 성공/실패', () => {
    // 패링 active: 1030~1150 (startup 30 + active 120)
    assert.equal(resolveParry(1030, 1150, 1100).success, true);
    assert.equal(resolveParry(1030, 1150, 1029).success, false);
    assert.equal(resolveParry(1030, 1150, 1151).success, false);
  });

  it('성공 시 공격자 poise +60', () => {
    assert.equal(resolveParry(1030, 1150, 1100).poise_to_attacker, BALANCE.poise.parry_poise_damage);
  });
});
