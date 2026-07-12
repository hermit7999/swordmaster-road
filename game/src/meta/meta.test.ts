// M-D 2차 테스트: 메타 저장 + 진화 range_mul + 체크포인트 + S2 데이터
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorage, MetaState, RANKS } from './meta.ts';
import { GROWTH_POOL, GrowthState } from '../growth/growth.ts';
import { STAGES, STAGE_2, StageRunner, STAGE_1 } from '../stage/stage.ts';
import { getEnemy } from '../enemy/data.ts';
import { getBoss, patternsOf } from '../boss/data.ts';
import { makeCombatant, newAttackId, resolveAttack } from '../combat/combat.ts';

describe('PRG-05/06 메타 (수련점·승급·저장)', () => {
  it('정산: 보스3 + 미니1 + 클리어3 + 노데스2', () => {
    const m = new MetaState(new MemoryStorage());
    const r = m.settleRun({ cleared: true, boss_kills: 1, mini_kills: 1, no_death: true, time_ms: 300000 });
    assert.equal(r.tp_gained, 3 + 1 + 3 + 2);
    assert.equal(m.tp, 9);
  });

  it('승급: 임계 통과 시 ranked_up', () => {
    const m = new MetaState(new MemoryStorage());
    const r1 = m.settleRun({ cleared: false, boss_kills: 1, mini_kills: 1, no_death: false, time_ms: 0 }); // +4 → 초급 검사
    assert.equal(r1.ranked_up, true);
    assert.equal(r1.rank_after, '초급 검사');
  });

  it('저장 왕복: 새 인스턴스가 이어받음', () => {
    const store = new MemoryStorage();
    const m1 = new MetaState(store);
    m1.settleRun({ cleared: true, boss_kills: 2, mini_kills: 2, no_death: false, time_ms: 100 });
    const m2 = new MetaState(store);
    assert.equal(m2.tp, m1.tp);
    assert.equal(m2.snapshot.total_clears, 1);
  });

  it('손상 데이터 → 안전 기본값', () => {
    const store = new MemoryStorage();
    store.setItem('sm.meta.v1', '{{{corrupt');
    const m = new MetaState(store);
    assert.equal(m.tp, 0);
  });

  it('시작 특성: 숙련 검사+ 체력, 검객+ 골드', () => {
    const store = new MemoryStorage();
    const m = new MetaState(store);
    assert.deepEqual(m.startBonuses(), { max_hp: 0, start_gold: 0 });
    // tp 12 이상 = 숙련 검사
    m.settleRun({ cleared: true, boss_kills: 3, mini_kills: 3, no_death: false, time_ms: 0 }); // 3*3+3+3=15
    assert.ok(m.tp >= RANKS[2]!.tp);
    assert.equal(m.startBonuses().max_hp, 20);
  });
});

describe('PRG-04 진화 (range_mul)', () => {
  it('사거리 밖 → 진화 후 적중', () => {
    const target = makeCombatant({ id: 't', x: 3.4 }); // iaido 기본 2.8 + 0.4 반경 밖... 3.4-0=3.4 > 3.2
    const base = {
      attack_id: newAttackId(), skill_id: 'iaido', grade: 'good' as const,
      origin: { x: 0, y: 0, dir: 1 as const }, combo: 0, counter: false, modifier_mul: 1,
    };
    assert.equal(resolveAttack({ ...base }, [target], 0).length, 0);
    const evolved = makeCombatant({ id: 't2', x: 3.4 });
    assert.equal(resolveAttack({ ...base, attack_id: newAttackId(), range_mul: 1.35 }, [evolved], 0).length, 1);
  });

  it('GrowthState: range 옵션 누적', () => {
    const s = new GrowthState();
    const opt = GROWTH_POOL.find((o) => o.option_id === 'e_iaido_dash')!;
    s.apply(opt);
    assert.ok(Math.abs(s.rangeMulFor('iaido') - 1.35) < 1e-9);
    assert.equal(s.rangeMulFor('slash_h'), 1);
  });
});

describe('STG-05 체크포인트 + S2 데이터', () => {
  it('체크포인트 부활: 현재 섹션 시작 복귀, 진행 인덱스 유지', () => {
    const r = new StageRunner(STAGE_1);
    r.update(6); // 웨이브1 발동 (idx 0, blocked)
    const rv = r.reviveAtCheckpoint();
    assert.equal(r.blocked, false);
    assert.ok(Math.abs(rv.x - 3.5) < 1e-9);
    // 부활 후 같은 웨이브 재트리거 가능
    const evs = r.update(6);
    assert.equal(evs[0]!.kind, 'spawn');
  });

  it('S2 데이터 무결: 적/보스 ID 실존', () => {
    for (const s of STAGE_2.sections) {
      if (s.type === 'wave') for (const sp of s.spawns) assert.ok(getEnemy(sp.enemy_id), sp.enemy_id);
      if (s.type === 'miniboss' || s.type === 'boss_gate') {
        assert.ok(getBoss(s.boss_id), s.boss_id);
        assert.ok(patternsOf(s.boss_id).length >= 2);
      }
    }
  });

  it('스테이지 체인: S1→S2→S3→S4→S5→종점 + 전 스테이지 데이터 무결', () => {
    let cur: string | null = STAGE_1.stage_id;
    const visited: string[] = [];
    while (cur) {
      const def = STAGES[cur]!;
      assert.ok(def, cur);
      visited.push(cur);
      for (const s of def.sections) {
        if (s.type === 'wave') for (const sp of s.spawns) assert.ok(getEnemy(sp.enemy_id), `${cur}:${sp.enemy_id}`);
        if (s.type === 'miniboss' || s.type === 'boss_gate') {
          assert.ok(getBoss(s.boss_id), s.boss_id);
          assert.ok(patternsOf(s.boss_id).length >= 2, s.boss_id);
        }
      }
      cur = def.next_stage;
    }
    assert.deepEqual(visited, ['s1_mountain', 's2_bamboo', 's3_castle', 's4_snowfield', 's5_peak']);
  });
});

describe('버그 수정 회귀: 보스 관문 재발동 (2026-07-12 실기 리포트)', () => {
  it('보스전 사망 → 부활 → 관문 재진입 시 보스 재등장', () => {
    const r = new StageRunner(STAGE_1);
    let sawGate = false;
    // 0→29 걸어가며 자동 클리어 (보스 관문 전까지)
    for (let x = 0; x <= 29 && !sawGate; x += 0.5) {
      const evs = r.update(x);
      for (const e of evs) {
        if (e.kind === 'boss_gate') sawGate = true;
        else if ((e.kind === 'spawn' || e.kind === 'miniboss') && r.blocked) r.notifyCleared();
      }
    }
    assert.ok(sawGate, '관문 발동');
    assert.equal(r.blocked, true, '보스 처치 전 통과 불가');
    const rv = r.reviveAtCheckpoint();
    assert.ok(rv.x < 28, '관문 앞 부활');
    const evs2 = r.update(28.5);
    assert.ok(evs2.some((e) => e.kind === 'boss_gate'), '보스 재등장');
    r.notifyCleared();
    assert.equal(r.blocked, false);
  });
});
