// 콤보 트래커(소드 아츠). 순수(DOM 비의존). 미스 한 획 = 조합 끊김.
import type { StrokeEvent } from './types';
import { TECHNIQUES } from './data';

export interface ComboResult { name: string; avg: number; mana: number; power: number }

export function createComboTracker(techId = 'yeonpung') {
  const tech = TECHNIQUES[techId];
  let progress: (StrokeEvent & { t: number })[] = [];
  return {
    feed(ev: StrokeEvent): ComboResult | null {
      const now = ev.timestamp;
      progress = progress.filter(p => now - p.t <= tech.window);
      const nextIdx = progress.length;
      if (ev.grade === 'miss' || ev.strokeId !== tech.combo[nextIdx]) {
        progress = (ev.grade !== 'miss' && ev.strokeId === tech.combo[0]) ? [{ ...ev, t: now }] : [];
      } else {
        progress.push({ ...ev, t: now });
      }
      if (progress.length === tech.combo.length) {
        const avg = progress.reduce((s, p) => s + p.accuracy, 0) / progress.length;
        const mana = tech.cost * (2.0 - avg / 100);
        const power = avg >= 95 ? 1.2 : 1.0;
        const result: ComboResult = { name: tech.name, avg: Math.round(avg), mana: Math.round(mana * 10) / 10, power };
        progress = [];
        return result;
      }
      return null;
    },
    state(): string[] { return progress.map(p => p.strokeId); },
  };
}
