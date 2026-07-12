// M-D 테스트: 성장 3택 규칙 + 효과 적용 + 스테이지 러너
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GROWTH_POOL, GrowthPicker, GrowthState } from './growth.ts';
import { StageRunner, STAGE_1 } from '../stage/stage.ts';

describe('PRG-02 3택 생성 규칙 (P07 §9)', () => {
  it('항상 3개, 중복 0, 100회 시행', () => {
    const p = new GrowthPicker(11);
    const s = new GrowthState();
    for (let i = 0; i < 100; i++) {
      const roll = p.roll(s);
      assert.equal(roll.length, 3);
      assert.equal(new Set(roll.map((o) => o.option_id)).size, 3);
    }
  });

  it('축 2종 이상 혼합', () => {
    const p = new GrowthPicker(7);
    const s = new GrowthState();
    for (let i = 0; i < 100; i++) {
      const axes = new Set(p.roll(s).map((o) => o.axis));
      assert.ok(axes.size >= 2, [...axes].join(','));
    }
  });

  it('만렙 옵션 미등장', () => {
    const p = new GrowthPicker(3);
    const s = new GrowthState();
    const target = GROWTH_POOL.find((o) => o.option_id === 'g_slash_h')!;
    for (let i = 0; i < target.max_stacks; i++) s.apply(target);
    for (let i = 0; i < 50; i++) {
      assert.ok(!p.roll(s).some((o) => o.option_id === 'g_slash_h'));
    }
  });

  it('보스 보상: 첫 슬롯 레어+ 보장', () => {
    const p = new GrowthPicker(5);
    const s = new GrowthState();
    for (let i = 0; i < 50; i++) {
      const roll = p.roll(s, true);
      assert.notEqual(roll[0]!.rarity, 'common');
    }
  });
});

describe('PRG-03 효과 적용', () => {
  it('스킬 피해 배율 누적 + 전체 배율 곱연산', () => {
    const s = new GrowthState();
    const opt = GROWTH_POOL.find((o) => o.option_id === 'g_iaido')!;
    s.apply(opt);
    s.apply(opt);
    assert.ok(Math.abs(s.damageMulFor('iaido') - 1.6) < 1e-9);
    assert.equal(s.damageMulFor('slash_h'), 1);
    s.apply(GROWTH_POOL.find((o) => o.option_id === 'g_all')!);
    assert.ok(Math.abs(s.damageMulFor('iaido') - 1.6 * 1.1) < 1e-9);
  });

  it('검기/패링/자원 효과', () => {
    const s = new GrowthState();
    s.apply(GROWTH_POOL.find((o) => o.option_id === 'g_ki')!);
    s.apply(GROWTH_POOL.find((o) => o.option_id === 'g_parry')!);
    s.apply(GROWTH_POOL.find((o) => o.option_id === 'g_parry_ki')!);
    s.apply(GROWTH_POOL.find((o) => o.option_id === 'g_heal')!);
    s.apply(GROWTH_POOL.find((o) => o.option_id === 'g_hp')!);
    assert.ok(Math.abs(s.kiGainMul - 1.3) < 1e-9);
    assert.equal(s.parryPoiseBonus, 25);
    assert.equal(s.parryKiBonus, 50);
    assert.equal(s.pendingHeal, 0.5);
    assert.equal(s.pendingMaxHp, 20);
  });
});

describe('STG 스테이지 러너 (S1)', () => {
  it('섹션 순차 트리거: 웨이브→휴식→웨이브(성장)→웨이브→미니보스(성장)→관문', () => {
    const r = new StageRunner(STAGE_1);
    const log: string[] = [];
    const step = (x: number) => {
      for (const e of r.update(x)) log.push(e.kind + ('name' in e ? `:${(e as { name: string }).name}` : ''));
    };
    step(1); // 아무것도
    assert.equal(log.length, 0);
    step(5.5); // 웨이브1
    assert.deepEqual(log, ['spawn:학살']);
    step(12); // 블록 중 — 진행돼도 트리거 없음
    assert.equal(log.length, 1);
    r.notifyCleared();
    step(11.5);
    assert.deepEqual(log.slice(1), ['rest']);
    step(14);
    assert.deepEqual(log.slice(2), ['spawn:긴장']);
    r.notifyCleared(); // growth_after → 다음 update에서 growth_pick
    step(14.1);
    assert.deepEqual(log.slice(3), ['growth_pick', 'spawn:폭발'].slice(0, log.length - 3));
    // 폭발 웨이브는 trigger 19 — 14.1에서는 아직
    step(19.5);
    assert.ok(log.includes('spawn:폭발'));
    r.notifyCleared();
    step(25);
    assert.ok(log.includes('miniboss'));
    r.notifyCleared();
    step(25.1); // 성장
    assert.ok(log.filter((l) => l === 'growth_pick').length === 2);
    step(28.5);
    assert.ok(log.includes('boss_gate'));
  });

  it('미클리어 웨이브 앞 전진 제한', () => {
    const r = new StageRunner(STAGE_1);
    r.update(6); // 웨이브1 발동
    assert.ok(r.blocked);
    assert.ok(r.maxAdvanceX() < STAGE_1.world_width);
    r.notifyCleared();
    assert.equal(r.maxAdvanceX(), STAGE_1.world_width);
  });

  it('골드 테이블', () => {
    const r = new StageRunner(STAGE_1);
    assert.equal(r.goldFor('soldier'), 10);
    assert.equal(r.goldFor('unknown'), 8);
    assert.equal(r.goldFor('', true), 90);
    assert.equal(r.goldFor('', false, true), 180);
  });
});
