// T1-05 검술 6종 성립 + 데미지 공식 검증 + 데미지 표 로그.
import { describe, it, expect } from 'vitest';
import { createTechniqueTracker, computeTechniqueDamage, TECHNIQUES, BALANCE } from './index';
import type { StrokeEvent } from './index';

let clock = 0;
function ev(strokeId: string, o: Partial<StrokeEvent> & { dt?: number } = {}): StrokeEvent {
  clock += o.dt ?? 100;
  return { strokeId, accuracy: o.accuracy ?? 100, grade: o.grade ?? 'perfect', inputMode: o.inputMode ?? 'gesture', timestamp: clock, powerBonus: o.powerBonus ?? false };
}
function run(seq: StrokeEvent[]) {
  const tr = createTechniqueTracker();
  let last: any = null;
  for (const e of seq) { const r = tr.feed(e); if (r) last = r; }
  return last;
}

describe('T1-05 검술 6종 성립', () => {
  const combos: [string, string[]][] = Object.entries(TECHNIQUES).map(([id, t]) => [id, t.combo]);
  for (const [id, combo] of combos) {
    it(`${TECHNIQUES[id].name} 성립`, () => {
      clock = 0;
      const r = run(combo.map(s => ev(s, { dt: 200 })));
      expect(r?.type).toBe('success');
      expect(r.techId).toBe(id);
      expect(r.strokeCount).toBe(combo.length);
    });
  }
});

describe('T1-05 데미지 공식(곱셈 체인)', () => {
  it('전 획 퍼펙트·검로 = base×1.2', () => {
    clock = 0;
    const r = run([ev('h_lr', { dt: 200 }), ev('diag_dr', { dt: 200 })]); // 연풍참 base 28
    expect(r.damage).toBe(Math.round(28 * 1.2)); // 34
    expect(r.mana).toBe(15);                       // 15×(2−1)
    expect(r.perfectMult).toBe(1.2);
    expect(r.commandBonus).toBe(false);
  });
  it('전 획 퍼펙트·검결 보너스 = base×1.2×1.1 (all-or-nothing)', () => {
    clock = 0;
    const r = run([ev('h_lr', { dt: 200, inputMode: 'command', powerBonus: true }), ev('diag_dr', { dt: 200, inputMode: 'command', powerBonus: true })]);
    expect(r.commandBonus).toBe(true);
    expect(r.damage).toBe(Math.round(28 * 1.2 * 1.1)); // 37
  });
  it('혼합 입력(한 획 검로) = 검결 보너스 없음', () => {
    clock = 0;
    const r = run([ev('h_lr', { dt: 200, inputMode: 'command', powerBonus: true }), ev('diag_dr', { dt: 200, inputMode: 'gesture' })]);
    expect(r.commandBonus).toBe(false);
    expect(r.damage).toBe(Math.round(28 * 1.2)); // 34
  });
  it('평균<95 = 퍼펙트 보너스 없음', () => {
    clock = 0;
    const r = run([ev('h_lr', { dt: 200, accuracy: 88, grade: 'great' }), ev('diag_dr', { dt: 200, accuracy: 90, grade: 'great' })]);
    expect(r.perfectMult).toBe(1.0);
    expect(r.damage).toBe(28);
    expect(r.avg).toBe(89);
  });
});

describe('T1-05 검술 우선순위 & 미스 페널티', () => {
  it('회천무(wonmu→h_lr→h_rl)가 일자베기보다 우선(긴 조합)', () => {
    clock = 0;
    const r = run([ev('wonmu', { dt: 300 }), ev('h_lr', { dt: 300 }), ev('h_rl', { dt: 300 })]);
    expect(r.techId).toBe('hoechonmu');
  });
  it('h_lr→h_rl(창 내) = 일자베기', () => {
    clock = 0;
    const r = run([ev('h_lr', { dt: 200 }), ev('h_rl', { dt: 200 })]);
    expect(r.techId).toBe('iljabegi');
  });
  it('진행 중 미스 = 발동 실패(마나 페널티 + 경직)', () => {
    clock = 0;
    const tr = createTechniqueTracker();
    tr.feed(ev('h_lr', { dt: 200 }));
    const r = tr.feed(ev('diag_dr', { dt: 200, grade: 'miss', accuracy: 0 }));
    expect(r?.type).toBe('fail');
    expect((r as any).manaPenalty).toBeGreaterThan(0);
    expect((r as any).stunMs).toBe(BALANCE.missPenalty.stunMs);
  });
  it('기본 획(검술 접두어 아님) 단독은 아무 검술도 발동 안 함', () => {
    clock = 0;
    const tr = createTechniqueTracker();
    expect(tr.feed(ev('v_down', { dt: 200 }))).toBeNull(); // v_down은 어떤 검술 접두어도 아님
  });
});

describe('T1-05 데미지 표(로그)', () => {
  it('출력', () => {
    const lines: string[] = ['=== 검술 데미지 표 (base × 퍼펙트×1.2 × 검결×1.1) ==='];
    lines.push('검술\tbase\tcost\t검로퍼펙트\t검결퍼펙트\t마나(퍼펙트)');
    for (const [id, t] of Object.entries(TECHNIQUES)) {
      const strokes = t.combo.map(s => ({ strokeId: s, accuracy: 100, grade: 'perfect', inputMode: 'gesture', timestamp: 0, powerBonus: false } as StrokeEvent));
      const gest = computeTechniqueDamage(id, strokes);
      const cmd = computeTechniqueDamage(id, strokes.map(s => ({ ...s, inputMode: 'command', powerBonus: true })));
      lines.push(`${t.name}\t${t.damage}\t${t.cost}\t${gest.damage}\t${cmd.damage}\t${gest.mana}`);
    }
    lines.push(`기본 획(마나무소모) 데미지 = ${BALANCE.basicAttackDamage}`);
    lines.push('데미지/코스트 비율(검로퍼펙트): ' + Object.entries(TECHNIQUES).map(([id, t]) => `${t.name} ${(computeTechniqueDamage(id, t.combo.map(s => ({ strokeId: s, accuracy: 100, grade: 'perfect', inputMode: 'gesture', timestamp: 0 } as StrokeEvent))).damage / t.cost).toFixed(2)}`).join(' / '));
    console.log('\n' + lines.join('\n') + '\n');
    expect(true).toBe(true);
  });
});
