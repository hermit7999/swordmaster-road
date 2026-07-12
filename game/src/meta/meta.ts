// PRG-05/06 (간이) + SAV 선행: 수련점·승급 영구 저장.
// 저장 백엔드 주입식 (SAV-06 SaveBackend 추상화의 최소형) — 테스트는 메모리, 브라우저는 localStorage.
export interface KvStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class MemoryStorage implements KvStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
}

/** 승급 10단계 (P07 §4 — 간이 조건: 누적 수련점). */
export const RANKS = [
  { name: '견습 검객', tp: 0 },
  { name: '초급 검사', tp: 4 },
  { name: '숙련 검사', tp: 12 },
  { name: '검객', tp: 24 },
  { name: '상급 검객', tp: 40 },
  { name: '검호', tp: 64 },
  { name: '대검호', tp: 96 },
  { name: '검왕', tp: 140 },
  { name: '검성', tp: 200 },
  { name: '검신', tp: 300 },
] as const;

export interface MetaData {
  version: number;
  training_points: number;
  total_runs: number;
  total_clears: number;
  boss_kills: number;
  best_time_ms: number;
}

export interface RunResult {
  cleared: boolean;
  boss_kills: number;
  mini_kills: number;
  no_death: boolean;
  time_ms: number;
}

const KEY = 'sm.meta.v1';

export class MetaState {
  private data: MetaData;
  private storage: KvStorage;

  constructor(storage?: KvStorage) {
    this.storage =
      storage ??
      ((globalThis as { localStorage?: KvStorage }).localStorage ?? new MemoryStorage());
    this.data = this.load();
  }

  private load(): MetaData {
    const fallback: MetaData = { version: 1, training_points: 0, total_runs: 0, total_clears: 0, boss_kills: 0, best_time_ms: 0 };
    try {
      const raw = this.storage.getItem(KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<MetaData>;
      if (typeof parsed.version !== 'number') return fallback;
      return { ...fallback, ...parsed };
    } catch {
      return fallback; // 손상 → 안전 기본값 (SAV 원칙)
    }
  }

  private save(): void {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // 쿼터 초과 등 — 게임 진행은 유지 (조용한 실패 + 다음 기회)
    }
  }

  get tp(): number {
    return this.data.training_points;
  }

  get snapshot(): MetaData {
    return { ...this.data };
  }

  rankIndex(): number {
    let idx = 0;
    for (let i = 0; i < RANKS.length; i++) {
      if (this.data.training_points >= RANKS[i]!.tp) idx = i;
    }
    return idx;
  }

  rankName(): string {
    return RANKS[this.rankIndex()]!.name;
  }

  /** 시작 특성 (승급 보상 — 단계마다 새 플레이 요소 원칙의 간이형). */
  startBonuses(): { max_hp: number; start_gold: number } {
    const r = this.rankIndex();
    return {
      max_hp: r >= 2 ? 20 : 0,       // 숙련 검사+: 체력 +20
      start_gold: r >= 3 ? 100 : 0,  // 검객+: 시작 골드 100
    };
  }

  /** 런 종료 정산 → 수련점 획득·승급 판정 (PRG-08 연결). */
  settleRun(r: RunResult): { tp_gained: number; rank_before: string; rank_after: string; ranked_up: boolean } {
    const before = this.rankName();
    let tp = 0;
    tp += r.boss_kills * 3;
    tp += r.mini_kills * 1;
    if (r.cleared) tp += 3;
    if (r.cleared && r.no_death) tp += 2;
    this.data.training_points += tp;
    this.data.total_runs += 1;
    if (r.cleared) {
      this.data.total_clears += 1;
      if (this.data.best_time_ms === 0 || r.time_ms < this.data.best_time_ms) this.data.best_time_ms = r.time_ms;
    }
    this.data.boss_kills += r.boss_kills;
    this.save();
    const after = this.rankName();
    return { tp_gained: tp, rank_before: before, rank_after: after, ranked_up: before !== after };
  }
}
