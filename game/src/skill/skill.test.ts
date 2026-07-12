// SKL-01~08 Unit Test (P02 §11 Acceptance 매핑)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_SKILLS, getSkill, validateSkills, SECRET_ART_RULES } from './data.ts';
import { ChainRecorder, gradeAtLeast, gradeMul, gradeOf, KiGauge, Stamina } from './system.ts';
import { SkillExecutor, SkillStateMachine } from './machine.ts';
import { BALANCE } from '../data/balance.ts';

describe('SKL-01 데이터 검증', () => {
  it('전 스킬 스키마 무결 (린트 0건)', () => {
    assert.deepEqual(validateSkills(ALL_SKILLS), []);
  });

  it('16종 로드 (기본8 + 오의5 + 검기3)', () => {
    assert.equal(ALL_SKILLS.length, 16);
    assert.ok(getSkill('iaido'));
    assert.ok(getSkill('art_flash'));
    assert.ok(getSkill('ki_burst'));
  });
});

describe('SKL-02 등급 경계값 (P02 §11)', () => {
  it('경계: 69/70/84/85/89/90/94/95', () => {
    assert.equal(gradeOf(69, false), 'miss');
    assert.equal(gradeOf(70, false), 'bad');
    assert.equal(gradeOf(84.9, false), 'bad');
    assert.equal(gradeOf(85, true), 'good');
    assert.equal(gradeOf(89.9, true), 'good');
    assert.equal(gradeOf(90, true), 'great');
    assert.equal(gradeOf(94.9, true), 'great');
    assert.equal(gradeOf(95, true), 'perfect');
  });

  it('배율: 1.3/1.15/1.0/0.6/0', () => {
    assert.equal(gradeMul('perfect'), 1.3);
    assert.equal(gradeMul('great'), 1.15);
    assert.equal(gradeMul('good'), 1.0);
    assert.equal(gradeMul('bad'), 0.6);
    assert.equal(gradeMul('miss'), 0);
  });

  it('gradeAtLeast: bad는 오의 조건 불충족', () => {
    assert.equal(gradeAtLeast('bad', 'good'), false);
    assert.equal(gradeAtLeast('perfect', 'great'), true);
  });
});

describe('SKL-03 상태 머신', () => {
  it('상태 전이 타임라인 (횡베기: 60/100/240)', () => {
    const m = new SkillStateMachine();
    m.begin(getSkill('slash_h')!, 'good', 1000);
    assert.equal(m.state(1000), 'startup');
    assert.equal(m.state(1059), 'startup');
    assert.equal(m.state(1060), 'active');
    assert.equal(m.state(1159), 'active');
    assert.equal(m.state(1160), 'recovery');
    assert.equal(m.state(1399), 'recovery');
    assert.equal(m.state(1400), 'ready');
  });

  it('캔슬창: 퍼펙트(0.4)가 배드(1.0)보다 항상 빠름 — 결정론', () => {
    const mp = new SkillStateMachine();
    const p = mp.begin(getSkill('slash_h')!, 'perfect', 1000);
    const mb = new SkillStateMachine();
    const b = mb.begin(getSkill('slash_h')!, 'bad', 1000);
    assert.ok(p.cancel_open_ms < b.cancel_open_ms);
    // 퍼펙트: active_end(1160) + 240*0.4 = 1256부터 캔슬 가능
    assert.equal(p.cancel_open_ms, 1160 + 240 * 0.4);
    assert.equal(mp.canExecute(1255), false);
    assert.equal(mp.canExecute(1256), true);
    // 배드: recovery 끝(1400)까지 캔슬 불가
    assert.equal(mb.canExecute(1399), false);
    assert.equal(mb.canExecute(1400), true);
  });

  it('회피는 recovery 중 언제나 캔슬 가능', () => {
    const m = new SkillStateMachine();
    m.begin(getSkill('slash_h')!, 'bad', 1000);
    assert.equal(m.canExecute(1161, true), true);
    assert.equal(m.canExecute(1100, true), false); // active 중은 회피도 불가
  });
});

describe('SKL-04 기력', () => {
  it('소모/부족 불발/회복', () => {
    const s = new Stamina(1000, 20);
    assert.equal(s.trySpend(18), true);
    assert.equal(s.current, 2);
    assert.equal(s.trySpend(10), false); // 불발 — 기력 미소모
    assert.equal(s.current, 2);
    s.update(2000, false); // 1초 → +12
    assert.ok(Math.abs(s.current - 14) < 1e-9);
  });

  it('피격 시 1초 회복 정지', () => {
    const s = new Stamina(1000, 50);
    s.onPlayerHit(1000);
    s.update(1500, false);
    assert.equal(s.current, 50); // 정지 중
    s.update(3000, false);
    assert.ok(s.current > 50);
  });

  it('패링 성공 +20', () => {
    const s = new Stamina(1000, 50);
    s.onParrySuccess();
    assert.equal(s.current, 70);
  });
});

describe('SKL-06 오의 매트릭스 (P02 §11 — 성립 5종 × 부정 케이스)', () => {
  const cases: Array<[string, string, string]> = [
    ['art_gale', 'slash_h', 'slash_diag'],
    ['art_thunder', 'slash_up', 'slash_v'],
    ['art_cross', 'slash_h', 'slash_v'],
    ['art_waltz', 'spin', 'slash_diag'],
  ];

  it('성립: 4종 (등급 충족 + 시간 내)', () => {
    for (const [art, a, b] of cases) {
      const c = new ChainRecorder();
      c.record(a, 'perfect', 1000);
      assert.equal(c.matchSecretArt(b, 'perfect', 1500), art, art);
    }
  });

  it('일섬: 선행 퍼펙트 필수', () => {
    const c = new ChainRecorder();
    c.record('iaido', 'great', 1000);
    assert.equal(c.matchSecretArt('iaido', 'perfect', 1500), null);
    const c2 = new ChainRecorder();
    c2.record('iaido', 'perfect', 1000);
    assert.equal(c2.matchSecretArt('iaido', 'good', 1500), 'art_flash');
  });

  it('부정: 등급 미달', () => {
    const c = new ChainRecorder();
    c.record('slash_up', 'good', 1000); // 낙뢰참은 great+ 필요
    assert.equal(c.matchSecretArt('slash_v', 'perfect', 1400), null);
  });

  it('부정: 시간 초과 (연계창 1500ms)', () => {
    const c = new ChainRecorder();
    c.record('slash_h', 'perfect', 1000);
    assert.equal(c.matchSecretArt('slash_diag', 'perfect', 2501), null);
    assert.equal(c.matchSecretArt('slash_diag', 'perfect', 2500), 'art_gale');
  });

  it('부정: 순서 오류', () => {
    const c = new ChainRecorder();
    c.record('slash_diag', 'perfect', 1000);
    assert.equal(c.matchSecretArt('slash_h', 'perfect', 1400), null);
  });

  it('규칙 테이블 무결: 모든 art_id가 실존 스킬', () => {
    for (const r of SECRET_ART_RULES) {
      assert.ok(getSkill(r.art_id), r.art_id);
      assert.ok(getSkill(r.chain[0]) && getSkill(r.chain[1]));
    }
  });
});

describe('SKL-07 검기 게이지', () => {
  it('충전: 정타당 8×등급배율, 만충 100', () => {
    const k = new KiGauge();
    k.onHitLanded('perfect', 1); // +10.4
    assert.ok(Math.abs(k.current - 10.4) < 1e-9);
    for (let i = 0; i < 12; i++) k.onHitLanded('perfect', 1);
    assert.equal(k.current, 100);
    assert.equal(k.full, true);
  });

  it('피격 시 50% 감소', () => {
    const k = new KiGauge();
    for (let i = 0; i < 13; i++) k.onHitLanded('perfect', 1);
    k.onPlayerHit();
    assert.equal(k.current, 50);
  });

  it('발동: 만충+퍼펙트+대응 스킬 → 형태 결정, 게이지 0 (P02 §8)', () => {
    const k = new KiGauge();
    for (let i = 0; i < 13; i++) k.onHitLanded('perfect', 1);
    assert.equal(k.tryRelease('slash_h', 'great'), null); // 퍼펙트 아님
    assert.equal(k.tryRelease('slash_up', 'perfect'), null); // 비대응 스킬
    assert.equal(k.tryRelease('spin', 'perfect'), 'ki_fan');
    assert.equal(k.current, 0);
    assert.equal(k.tryRelease('spin', 'perfect'), null); // 소진 후 불가
  });
});

describe('SKL-05/08 Executor 통합', () => {
  it('실행 → 오의 승격 → 검기 발동 사슬', () => {
    const events: string[] = [];
    const ex = new SkillExecutor(1000, {
      onExecuted: (e) => events.push(`exec:${e.skill_id}${e.is_secret_art ? '(오의)' : ''}`),
      onSecretArt: (a) => events.push(`art:${a}`),
      onKiWave: (w) => events.push(`ki:${w}`),
    });
    // 1) 횡베기 퍼펙트
    const r1 = ex.execute('slash_h', 'perfect', 1000);
    assert.ok(r1.ok);
    // 2) 캔슬창 후 사선베기 퍼펙트 → 연풍참 성립
    const t2 = (r1 as { execution: { active_end_ms: number } }).execution.active_end_ms + 240 * 0.4;
    const r2 = ex.execute('slash_diag', 'perfect', t2);
    assert.ok(r2.ok && (r2 as { execution: { is_secret_art: boolean } }).execution.is_secret_art);
    assert.ok(events.some((e) => e === 'art:art_gale'));
  });

  it('busy: active 중 실행 거부, 캔슬창 후 허용', () => {
    const ex = new SkillExecutor(1000);
    ex.execute('slash_h', 'good', 1000);
    const r = ex.execute('slash_diag', 'good', 1100); // active 중
    assert.equal(r.ok, false);
    assert.equal((r as { reason: string }).reason, 'busy');
    const r2 = ex.execute('slash_diag', 'good', 1160 + 240 * 0.7 + 1);
    assert.ok(r2.ok);
  });

  it('기력 0 → 불발 + 기력 미소모 (P02 §11)', () => {
    const ex = new SkillExecutor(1000);
    // 기력 소진: 회전베기(22) 연타
    let now = 1000;
    for (let i = 0; i < 8; i++) {
      const r = ex.execute('spin', 'bad', now);
      if (r.ok) now = ex.machine.activeSkill!.recovery_end_ms;
      ex.update(now);
      now += 1;
    }
    // 남은 기력으로 발도술(18) 불가 시점 만들기
    while (ex.stamina.current >= 6) ex.stamina.trySpend(6);
    const before = ex.stamina.current;
    const r = ex.execute('iaido', 'good', now + 1000);
    assert.equal(r.ok, false);
    assert.equal(ex.stamina.current, before);
  });

  it('미스 등급 → 실행 자체 거부', () => {
    const ex = new SkillExecutor(1000);
    const r = ex.execute('slash_h', 'miss', 1000);
    assert.equal(r.ok, false);
  });

  it('회피: recovery 캔슬 + 기력 15', () => {
    const ex = new SkillExecutor(1000);
    ex.execute('slash_h', 'bad', 1000);
    assert.equal(ex.tryDodge(1100), false); // active 중 불가
    assert.equal(ex.tryDodge(1200), true);  // recovery 중 가능
    assert.equal(ex.machine.state(1201), 'ready'); // 캔슬됨
    assert.equal(ex.stamina.current, 100 - 8 - BALANCE.dodge.stamina);
  });

  it('결정론: 동일 시퀀스 2회 = 동일 이벤트', () => {
    const run = () => {
      const out: string[] = [];
      const ex = new SkillExecutor(0, { onExecuted: (e) => out.push(e.skill_id) });
      ex.execute('slash_h', 'perfect', 0);
      ex.execute('slash_diag', 'perfect', 300);
      ex.execute('slash_v', 'great', 900);
      return out.join('|');
    };
    assert.equal(run(), run());
  });
});
