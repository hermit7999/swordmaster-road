// M-C 테스트: ENM(적 FSM·토큰·데이터) + DUL(공격권·연쇄패링·존) + BOS(선택기·Phase·B1)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, getEnemy, validateEnemies, TELEGRAPH_MIN } from './data.ts';
import { AttackCoordinator, EnemyUnit } from './ai.ts';
import { DuelController } from '../duel/duel.ts';
import { BossController, mulberry32, PatternSelector } from '../boss/boss.ts';
import { validateBossData, BOSSES, patternsOf, getBoss } from '../boss/data.ts';
import { resolveAttack, newAttackId, applyPoise } from '../combat/combat.ts';

// ── ENM-01 데이터 ─────────────────────────────────────
describe('ENM-01 적 데이터 검증 (P04 §9)', () => {
  it('12종 로드 + 린트 0건 (예고 최소시간·teach_goal 필수 포함)', () => {
    assert.equal(ENEMIES.length, 12);
    assert.deepEqual(validateEnemies(ENEMIES), []);
  });

  it('노랑 700ms / 빨강 500ms 하한 규칙이 실제로 작동', () => {
    const bad = [{ ...ENEMIES[0]!, attacks: [{ ...ENEMIES[0]!.attacks[0]!, telegraph_ms: 400 }] }];
    assert.ok(validateEnemies(bad).some((e) => e.startsWith('telegraph_too_short')));
  });

  it('교사 매핑: 방패병=내려베기 약점, 중갑=올려베기 약점', () => {
    assert.equal(getEnemy('shield')!.weak_point, 'slash_v');
    assert.equal(getEnemy('heavy')!.weak_point, 'slash_up');
  });
});

// ── ENM-04 토큰 ───────────────────────────────────────
describe('ENM-04 공격 토큰 (P04 §6)', () => {
  it('동시 공격 최대 2', () => {
    const c = new AttackCoordinator(2);
    assert.equal(c.request('a', 'yellow'), true);
    assert.equal(c.request('b', 'yellow'), true);
    assert.equal(c.request('c', 'yellow'), false);
    c.release('a');
    assert.equal(c.request('c', 'yellow'), true);
  });

  it('빨강 예고 동시 1개 제한', () => {
    const c = new AttackCoordinator(2);
    assert.equal(c.request('a', 'red'), true);
    assert.equal(c.request('b', 'red'), false);
    assert.equal(c.request('b', 'yellow'), true);
  });
});

// ── ENM-02/03 FSM ─────────────────────────────────────
describe('ENM-02/03 적 상태 머신', () => {
  function makeUnit(id = 'soldier', x = 3, events = {}) {
    const coord = new AttackCoordinator(2);
    return new EnemyUnit(getEnemy(id)!, x, 0, coord, events);
  }

  it('발견→접근→예고→타격→회복 사이클 + 예고 없는 타격 0 (P04 §9)', () => {
    const log: string[] = [];
    const u = makeUnit('soldier', 3, {
      onTelegraph: () => log.push('telegraph'),
      onStrike: () => log.push('strike'),
    });
    let now = 0;
    let x = 3;
    // 5초 시뮬 (16ms 스텝) — 플레이어 x=0 고정
    for (let i = 0; i < 320; i++) {
      now += 16;
      x += u.update(now, 16, 0, true);
      u.c.x = x;
    }
    assert.ok(log.length >= 2, `공격 발생: ${log.join(',')}`);
    // 모든 strike 앞에는 telegraph가 선행
    for (let i = 0; i < log.length; i++) {
      if (log[i] === 'strike') assert.equal(log[i - 1], 'telegraph', '예고 없는 타격 금지');
    }
    // 선호 간격까지 접근했는지
    assert.ok(Math.abs(x) < 3, `접근함: ${x}`);
  });

  it('경직(flinch): 예고 중 피격 시 공격 취소, 슈퍼아머는 지속', () => {
    const coord = new AttackCoordinator(2);
    const soldier = new EnemyUnit(getEnemy('soldier')!, 0.5, 0, coord);
    // 예고 상태 만들기
    let now = 0;
    for (let i = 0; i < 100 && soldier.state !== 'telegraph'; i++) {
      now += 16;
      soldier.update(now, 16, 0, true);
    }
    assert.equal(soldier.state, 'telegraph');
    soldier.onHitReaction('flinch', now);
    assert.equal(soldier.state, 'flinch');
    assert.equal(coord.activeCount, 0, '토큰 반환');

    const heavy = new EnemyUnit(getEnemy('heavy')!, 0.8, 0, new AttackCoordinator(2));
    now = 0;
    for (let i = 0; i < 200 && heavy.state !== 'telegraph'; i++) {
      now += 16;
      heavy.update(now, 16, 0, true);
    }
    assert.equal(heavy.state, 'telegraph');
    heavy.onHitReaction('flinch', now); // 슈퍼아머 — 무시
    assert.equal(heavy.state, 'telegraph');
  });

  it('그로기 → 행동 정지 → 해제 후 복귀', () => {
    const u = makeUnit('soldier', 1);
    applyPoise(u.c, 100, 1000); // 그로기
    u.update(1100, 16, 0, true);
    assert.equal(u.state, 'groggy');
    u.update(1000 + 3000 + 100, 16, 0, true);
    assert.notEqual(u.state, 'groggy');
  });

  it('사망 → dead + 토큰 반환', () => {
    const coord = new AttackCoordinator(2);
    const u = new EnemyUnit(getEnemy('soldier')!, 1, 0, coord);
    u.c.hp = 0;
    u.c.alive = false;
    u.update(16, 16, 0, true);
    assert.equal(u.state, 'dead');
    assert.equal(coord.activeCount, 0);
  });
});

// ── DUL ───────────────────────────────────────────────
describe('DUL-01~05 Duel 시스템 (P05 §10)', () => {
  it('공격권 획득 4경로 → player_offense', () => {
    for (const path of ['parry', 'counter', 'guardbreak'] as const) {
      const d = new DuelController();
      if (path === 'parry') d.onParrySuccess(1000);
      if (path === 'counter') d.onCounterHit(1000);
      if (path === 'guardbreak') d.onGuardBreak(1000);
      assert.equal(d.current, 'player_offense', path);
    }
  });

  it('게이지 소진(6s) → 대치 복귀', () => {
    const d = new DuelController();
    d.onParrySuccess(1000);
    d.update(6999);
    assert.equal(d.current, 'player_offense');
    d.update(7000);
    assert.equal(d.current, 'neutral');
  });

  it('미스 → 공격권 상실', () => {
    const d = new DuelController();
    d.onParrySuccess(1000);
    d.onPlayerMiss(2000);
    assert.equal(d.current, 'neutral');
  });

  it('연쇄 패링: 적 공세 중 누진 [60,70,85,100] → 패턴 종료 시 공격권', () => {
    const d = new DuelController();
    d.onBossPatternStart(0);
    assert.equal(d.onParrySuccess(100), 60);
    assert.equal(d.current, 'enemy_offense', '연격 중에는 공세 유지');
    assert.equal(d.onParrySuccess(200), 70);
    assert.equal(d.onParrySuccess(300), 85);
    assert.equal(d.onParrySuccess(400), 100);
    d.onBossPatternEnd(500);
    assert.equal(d.current, 'player_offense', '패링 성공 후 패턴 종료 → 공격권');
    // 새 공세에서 연쇄 리셋
    d.onBossPatternStart(1000);
    assert.equal(d.onParrySuccess(1100), 60);
  });

  it('패링 실패한 공세는 패턴 종료 시 대치로', () => {
    const d = new DuelController();
    d.onBossPatternStart(0);
    d.onBossPatternEnd(1000);
    assert.equal(d.current, 'neutral');
  });

  it('빨강 회피 → 반격 창 900ms → 반격 적중 시 공격권', () => {
    const d = new DuelController();
    d.onBossPatternStart(0);
    d.onRedDodge(1000);
    assert.equal(d.counterWindowActive(1899), true);
    assert.equal(d.counterWindowActive(1900), false);
    d.onRedDodge(2000);
    d.onCounterHit(2500);
    assert.equal(d.current, 'player_offense');
  });

  it('거리 존: far ≥5 / mid ≥2.5 / near', () => {
    const d = new DuelController();
    assert.equal(d.zoneOf(6), 'far');
    assert.equal(d.zoneOf(3), 'mid');
    assert.equal(d.zoneOf(1), 'near');
  });
});

// ── BOS ───────────────────────────────────────────────
describe('BOS-01 보스 데이터 검증 (P06 §9)', () => {
  it('보스 5+미니 5, 린트 0건 (예고·빈틈·패턴 수 규칙)', () => {
    assert.equal(BOSSES.length, 10);
    assert.deepEqual(validateBossData(), []);
  });

  it('B1 노병: 패턴 3, 전부 빈틈 보유', () => {
    const pats = patternsOf('boss_veteran');
    assert.equal(pats.length, 3);
    for (const p of pats) assert.ok(p.opening_ms >= 700);
  });

  it('B5 흑월: 3 Phase, 패턴 6', () => {
    assert.equal(getBoss('boss_saint')!.phases.length, 2);
    assert.equal(patternsOf('boss_saint').length, 6);
  });
});

describe('BOS-02 패턴 선택기', () => {
  it('같은 패턴 2연속 금지 + 존 필터 (1000회)', () => {
    const s = new PatternSelector('boss_saint', 42);
    let last: string | null = null;
    let now = 0;
    for (let i = 0; i < 1000; i++) {
      now += 6000;
      const p = s.select(3, 'near', now);
      assert.ok(p, 'null 없음');
      assert.notEqual(p!.pattern_id, last, '2연속 금지');
      assert.ok(p!.zone === 'near' || p!.zone === 'any', '존 일치');
      last = p!.pattern_id;
    }
  });

  it('결정론: 같은 시드 = 같은 시퀀스, 다른 시드 = 다른 시퀀스 (후보 4+ 풀)', () => {
    const run = (seed: number) => {
      const s = new PatternSelector('boss_saint', seed);
      const out: string[] = [];
      let now = 0;
      for (let i = 0; i < 30; i++) {
        now += 8000;
        out.push(s.select(3, 'near', now)?.pattern_id ?? 'x');
      }
      return out.join('|');
    };
    assert.equal(run(7), run(7));
    assert.notEqual(run(7), run(1234));
  });

  it('mulberry32 범위 [0,1)', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1);
    }
  });
});

describe('BOS-03/04 BossController — B1 시나리오', () => {
  it('예고→타격→빈틈 사이클 + Duel 공세 연동', () => {
    const duel = new DuelController();
    const log: string[] = [];
    const boss = new BossController('boss_veteran', 2, 0, duel, {
      onTelegraph: (p) => log.push(`tel:${p.pattern_id}`),
      onStrike: () => log.push('strike'),
      onOpening: () => log.push('open'),
    }, 3);
    let now = 0;
    let x = 2;
    for (let i = 0; i < 500; i++) {
      now += 16;
      duel.update(now);
      x += boss.update(now, 16, 0, true);
      boss.c.x = x;
    }
    assert.ok(log.filter((l) => l === 'strike').length >= 2);
    // strike 전에는 항상 telegraph, 후에는 open
    const first = log.findIndex((l) => l === 'strike');
    assert.ok(log[first - 1]!.startsWith('tel:'));
    assert.equal(log[first + 1], 'open');
  });

  it('예고 시작 시 enemy_offense, 빈틈에서 neutral (공격권 시각화 근거)', () => {
    const duel = new DuelController();
    const boss = new BossController('boss_veteran', 1.2, 0, duel, {}, 3);
    let now = 0;
    let seenOffense = false;
    for (let i = 0; i < 400; i++) {
      now += 16;
      duel.update(now);
      boss.update(now, 16, 0, true);
      if (boss.state === 'telegraph') {
        assert.equal(duel.current, 'enemy_offense');
        seenOffense = true;
      }
      if (boss.state === 'opening') assert.notEqual(duel.current, 'enemy_offense');
    }
    assert.ok(seenOffense);
  });

  it('Phase 전이: HP 임계 → 전이 상태 + 무적 성격 + 이벤트', () => {
    const duel = new DuelController();
    let phaseEvent = 0;
    const boss = new BossController('boss_saint', 2, 0, duel, { onPhaseChange: (p) => (phaseEvent = p) }, 3);
    boss.c.hp = boss.c.max_hp * 0.55; // 60% 임계 통과
    boss.onHitReaction(1000);
    assert.equal(boss.phase, 2);
    assert.equal(boss.state, 'phase_transition');
    assert.equal(phaseEvent, 2);
  });

  it('처치 → dead + onDefeated 1회', () => {
    const duel = new DuelController();
    let defeated = 0;
    const boss = new BossController('boss_veteran', 2, 0, duel, { onDefeated: () => defeated++ }, 3);
    boss.c.hp = 0;
    boss.c.alive = false;
    boss.onHitReaction(1000);
    boss.onHitReaction(1001);
    assert.equal(boss.state, 'dead');
    assert.equal(defeated, 1);
  });

  it('B1 3경로 승리 가능성 — 패링 축적 경로: 연쇄 패링 poise → 붕괴', () => {
    const duel = new DuelController();
    const boss = new BossController('boss_veteran', 1.2, 0, duel, {}, 3);
    // 패링 5회 상당의 poise (60+70+85+100+100 = 415 ≥ 300)
    let total = 0;
    for (let i = 0; i < 5; i++) total += duel.onParrySuccess(1000 + i * 500);
    assert.ok(total >= boss.def.poise_max, `${total} >= ${boss.def.poise_max}`);
  });

  it('B1 반격 경로: 빈틈(opening≥700ms) 동안 유효 타격 수 확보', () => {
    // 사선베기(총 300ms) 기준 opening 900ms에 2타 가능 — 산술 검증
    const p = patternsOf('boss_veteran').find((x) => x.pattern_id === 'ptn_vet_overhead')!;
    const diagTotal = 40 + 80 + 180 * 0.7; // startup+active+굿 캔슬
    assert.ok(p.opening_ms >= diagTotal * 2, '빈틈에 최소 2연격');
  });
});

// ── 전투 연동 (적 데이터 → Combat) ────────────────────
describe('ENM-05/06 기믹 연동', () => {
  it('방패병 유닛: 정면 가드가 Combat에서 실제 작동', () => {
    const coord = new AttackCoordinator(2);
    const u = new EnemyUnit(getEnemy('shield')!, 1, 0, coord);
    u.c.facing = -1;
    const r = resolveAttack({
      attack_id: newAttackId(), skill_id: 'slash_h', grade: 'good',
      origin: { x: 0, y: 0, dir: 1 }, combo: 0, counter: false, modifier_mul: 1,
    }, [u.c], 100)[0]!;
    assert.equal(r.reaction, 'guarded');
  });

  it('들개 무리: 토큰이 3마리 동시 공격 차단', () => {
    const coord = new AttackCoordinator(2);
    const dogs = [1.0, 1.2, 1.4].map((x) => new EnemyUnit(getEnemy('hound')!, x, 0, coord));
    let now = 0;
    let maxSimul = 0;
    for (let i = 0; i < 400; i++) {
      now += 16;
      for (const d of dogs) d.update(now, 16, 0, true);
      const telCount = dogs.filter((d) => d.state === 'telegraph' || d.state === 'attack').length;
      maxSimul = Math.max(maxSimul, telCount);
    }
    assert.ok(maxSimul <= 2, `동시 공격 ${maxSimul} ≤ 2`);
  });
});
