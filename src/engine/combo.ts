// 검술(소드 아츠) 트래커 + 전투 수치. 순수(DOM 비의존). T1-05.
// 다중 검술 동시 추적(접두어 공유 처리), 데미지 = base × 퍼펙트+20% × 검결+10%.
import type { StrokeEvent, Style } from './types';
import { BALANCE, TECHNIQUES, STYLES } from './data';
import { techniqueCombo } from './style';

export interface TechDamage {
  avg: number; mana: number; damage: number;
  perfectMult: number; commandMult: number; commandBonus: boolean;
}
export interface TechSuccess extends TechDamage {
  type: 'success'; techId: string; name: string; strokeCount: number;
  stun: boolean; aoe: boolean; pierce: boolean;
}
export interface TechFail {
  type: 'fail'; techId: string; name: string; manaPenalty: number; stunMs: number;
}

// 데미지·마나 산출. 곱셈 체인: base × (평균≥95?1.2:1.0) × 검결보너스.
// 검결 +10%는 아츠 단위 all-or-nothing(전 획 검결+보너스)이 기본. balance 플래그로 proportional(충족획/전체) 전환.
export function computeTechniqueDamage(techId: string, strokes: StrokeEvent[]): TechDamage {
  const tech = TECHNIQUES[techId];
  const avg = strokes.reduce((s, e) => s + e.accuracy, 0) / strokes.length;
  const perfectMult = avg >= BALANCE.gradeCuts.perfect ? 1.2 : 1.0;
  const eligible = strokes.filter(s => s.inputMode === 'command' && s.powerBonus).length;
  let commandBonus: boolean, commandMult: number;
  if (BALANCE.commandBonusMode === 'proportional') {
    commandBonus = eligible > 0;
    commandMult = 1 + 0.1 * (eligible / strokes.length);
  } else { // all_or_nothing
    commandBonus = eligible === strokes.length;
    commandMult = commandBonus ? 1.1 : 1.0;
  }
  const damage = Math.round(tech.damage * perfectMult * commandMult);
  const mana = Math.round(tech.cost * (2 - avg / 100) * 10) / 10;
  return { avg: Math.round(avg), mana, damage, perfectMult, commandMult: Math.round(commandMult * 100) / 100, commandBonus };
}

interface Buf { ev: StrokeEvent; t: number }
export function createTechniqueTracker(style: Style = STYLES.uraken) {
  // 긴 조합 우선(가장 구체적인 검술을 먼저 성립).
  const techs = Object.keys(TECHNIQUES)
    .map(id => ({ id, name: TECHNIQUES[id].name, combo: techniqueCombo(id, style), window: TECHNIQUES[id].window, cost: TECHNIQUES[id].cost, spec: TECHNIQUES[id] }))
    .sort((a, b) => b.combo.length - a.combo.length);
  let buffer: Buf[] = [];
  const within = (startT: number, endT: number, w: number) => endT - startT <= w;

  function matchCompleted(now: number) {
    for (const tech of techs) {
      const k = tech.combo.length;
      if (buffer.length < k) continue;
      const tail = buffer.slice(-k);
      if (tail.every((b, i) => b.ev.strokeId === tech.combo[i]) && within(tail[0].t, now, tech.window)) return { tech, strokes: tail.map(b => b.ev) };
    }
    return null;
  }
  // 미스 시점에 진행 중이던(접두어) 가장 긴 검술.
  function inProgress(now: number) {
    let best: { tech: typeof techs[0]; k: number } | null = null;
    for (const tech of techs) {
      for (let k = Math.min(buffer.length, tech.combo.length - 1); k >= 1; k--) {
        const tail = buffer.slice(-k);
        if (tail.every((b, i) => b.ev.strokeId === tech.combo[i]) && within(tail[0].t, now, tech.window)) {
          if (!best || k > best.k) best = { tech, k };
          break;
        }
      }
    }
    return best;
  }
  // 버퍼를 "어떤 검술의 접두어인 가장 긴 suffix"로 정리(기본 획 노이즈 제거).
  function pruneToPrefix(now: number) {
    for (let start = 0; start < buffer.length; start++) {
      const suf = buffer.slice(start);
      const ok = techs.some(tech => suf.length <= tech.combo.length && suf.every((b, i) => b.ev.strokeId === tech.combo[i]) && within(suf[0].t, now, tech.window));
      if (ok) { buffer = suf; return; }
    }
    buffer = [];
  }

  return {
    feed(ev: StrokeEvent): TechSuccess | TechFail | null {
      const now = ev.timestamp;
      if (ev.grade === 'miss') {
        const ip = inProgress(now);
        buffer = [];
        if (ip) return { type: 'fail', techId: ip.tech.id, name: ip.tech.name, manaPenalty: Math.round(ip.tech.cost * BALANCE.missPenalty.manaFraction * 10) / 10, stunMs: BALANCE.missPenalty.stunMs };
        return null;
      }
      buffer.push({ ev, t: now });
      const done = matchCompleted(now);
      if (done) {
        buffer = [];
        const dmg = computeTechniqueDamage(done.tech.id, done.strokes);
        return { type: 'success', techId: done.tech.id, name: done.tech.name, strokeCount: done.strokes.length, stun: !!done.tech.spec.stun, aoe: !!done.tech.spec.aoe, pierce: !!done.tech.spec.pierce, ...dmg };
      }
      pruneToPrefix(now);
      return null;
    },
    // HUD용: 현재 진행 중(접두어) 검술 후보.
    progress(): { name: string; matched: number; total: number }[] {
      if (!buffer.length) return [];
      return techs
        .filter(tech => buffer.length < tech.combo.length && buffer.every((b, i) => b.ev.strokeId === tech.combo[i]))
        .map(tech => ({ name: tech.name, matched: buffer.length, total: tech.combo.length }));
    },
  };
}
