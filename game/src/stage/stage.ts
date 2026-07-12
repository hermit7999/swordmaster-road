// STG (코어): S1 스테이지 데이터 + 러너 — 웨이브→성장→정예→보스 관문 (P09 §2).
// 템포 파형: 학살 → 휴지 → 긴장 → 폭발 (프로토타입 검증 리듬).

export interface SpawnEntry {
  enemy_id: string;
  x: number; // 월드 유닛
}

export type StageSection =
  | { type: 'wave'; name: string; trigger_x: number; spawns: SpawnEntry[]; growth_after?: boolean }
  | { type: 'rest'; trigger_x: number; heal_ratio: number }
  | { type: 'miniboss'; trigger_x: number; boss_id: string; growth_after?: boolean }
  | { type: 'boss_gate'; trigger_x: number; boss_id: string };

export interface StageDef {
  stage_id: string;
  name: string;
  world_width: number; // 유닛
  gold_per_kill: Record<string, number>;
  sections: StageSection[];
  next_stage: string | null;
}

export const STAGE_1: StageDef = {
  stage_id: 's1_mountain',
  name: '산길 — 검을 배우다',
  world_width: 30,
  gold_per_kill: { soldier: 10, hound: 6, spear: 14, shield: 22, swift: 16, mini: 90, boss: 180 },
  sections: [
    { type: 'wave', name: '학살', trigger_x: 5, spawns: [
      { enemy_id: 'soldier', x: 7.5 }, { enemy_id: 'soldier', x: 8.6 }, { enemy_id: 'hound', x: 9.4 }, { enemy_id: 'hound', x: 9.9 },
    ] },
    { type: 'rest', trigger_x: 11, heal_ratio: 0.3 },
    { type: 'wave', name: '긴장', trigger_x: 13.5, spawns: [
      { enemy_id: 'shield', x: 16 }, { enemy_id: 'spear', x: 17.2 }, { enemy_id: 'soldier', x: 17.8 },
    ], growth_after: true },
    { type: 'wave', name: '폭발', trigger_x: 19, spawns: [
      { enemy_id: 'soldier', x: 21 }, { enemy_id: 'soldier', x: 21.6 }, { enemy_id: 'hound', x: 22.2 }, { enemy_id: 'hound', x: 22.6 }, { enemy_id: 'swift', x: 23.4 },
    ] },
    { type: 'miniboss', trigger_x: 24.5, boss_id: 'mini_captain', growth_after: true },
    { type: 'boss_gate', trigger_x: 28, boss_id: 'boss_veteran' },
  ],
  next_stage: 's2_bamboo',
};

export const STAGE_2: StageDef = {
  stage_id: 's2_bamboo',
  name: '대나무 숲 — 검을 익히다',
  world_width: 32,
  gold_per_kill: { soldier: 10, hound: 6, spear: 14, shield: 22, swift: 16, archer: 18, dual: 20, mini: 100, boss: 220 },
  sections: [
    { type: 'wave', name: '매복', trigger_x: 5, spawns: [
      { enemy_id: 'swift', x: 7.5 }, { enemy_id: 'soldier', x: 8.4 }, { enemy_id: 'archer', x: 11 },
    ] },
    { type: 'rest', trigger_x: 12, heal_ratio: 0.3 },
    { type: 'wave', name: '협공', trigger_x: 14, spawns: [
      { enemy_id: 'dual', x: 16.5 }, { enemy_id: 'shield', x: 17.4 }, { enemy_id: 'archer', x: 20 },
    ], growth_after: true },
    { type: 'wave', name: '질주', trigger_x: 20.5, spawns: [
      { enemy_id: 'swift', x: 22.5 }, { enemy_id: 'swift', x: 23.2 }, { enemy_id: 'hound', x: 23.8 }, { enemy_id: 'hound', x: 24.2 }, { enemy_id: 'archer', x: 26 },
    ] },
    { type: 'miniboss', trigger_x: 26.5, boss_id: 'mini_ranger', growth_after: true },
    { type: 'boss_gate', trigger_x: 30, boss_id: 'boss_dancer' },
  ],
  next_stage: 's3_castle',
};

export const STAGE_3: StageDef = {
  stage_id: 's3_castle',
  name: '폐성 — 검을 연결하다',
  world_width: 34,
  gold_per_kill: { soldier: 12, hound: 8, spear: 16, shield: 24, swift: 18, archer: 20, dual: 22, heavy: 30, berserk: 26, mini: 120, boss: 260 },
  sections: [
    { type: 'wave', name: '성문', trigger_x: 5, spawns: [
      { enemy_id: 'heavy', x: 8 }, { enemy_id: 'soldier', x: 9 }, { enemy_id: 'dual', x: 9.8 },
    ] },
    { type: 'rest', trigger_x: 12, heal_ratio: 0.3 },
    { type: 'wave', name: '방진', trigger_x: 14.5, spawns: [
      { enemy_id: 'shield', x: 17 }, { enemy_id: 'shield', x: 18 }, { enemy_id: 'dual', x: 18.8 },
    ], growth_after: true },
    { type: 'wave', name: '광란', trigger_x: 21, spawns: [
      { enemy_id: 'berserk', x: 23.5 }, { enemy_id: 'hound', x: 24.2 }, { enemy_id: 'hound', x: 24.6 }, { enemy_id: 'swift', x: 25.4 },
    ] },
    { type: 'miniboss', trigger_x: 27.5, boss_id: 'mini_twin', growth_after: true },
    { type: 'boss_gate', trigger_x: 32, boss_id: 'boss_fortress' },
  ],
  next_stage: 's4_snowfield',
};

export const STAGE_4: StageDef = {
  stage_id: 's4_snowfield',
  name: '설원 — 검을 응용하다',
  world_width: 36,
  gold_per_kill: { soldier: 12, hound: 8, spear: 16, shield: 24, swift: 18, archer: 20, dual: 22, heavy: 30, berserk: 26, caster: 24, shadow: 28, knight: 40, mini: 140, boss: 300 },
  sections: [
    { type: 'wave', name: '눈보라', trigger_x: 5, spawns: [
      { enemy_id: 'berserk', x: 8 }, { enemy_id: 'caster', x: 11.5 }, { enemy_id: 'soldier', x: 8.8 },
    ] },
    { type: 'rest', trigger_x: 13, heal_ratio: 0.3 },
    { type: 'wave', name: '그림자', trigger_x: 15.5, spawns: [
      { enemy_id: 'shadow', x: 18 }, { enemy_id: 'dual', x: 19 }, { enemy_id: 'archer', x: 21.5 },
    ], growth_after: true },
    { type: 'wave', name: '기사단', trigger_x: 23, spawns: [
      { enemy_id: 'knight', x: 25.5 }, { enemy_id: 'hound', x: 26.2 }, { enemy_id: 'hound', x: 26.6 },
    ] },
    { type: 'miniboss', trigger_x: 29, boss_id: 'mini_juggernaut', growth_after: true },
    { type: 'boss_gate', trigger_x: 34, boss_id: 'boss_mirror' },
  ],
  next_stage: 's5_peak',
};

export const STAGE_5: StageDef = {
  stage_id: 's5_peak',
  name: '검성봉 — 검성의 시험',
  world_width: 38,
  gold_per_kill: { soldier: 14, hound: 10, spear: 18, shield: 26, swift: 20, archer: 22, dual: 24, heavy: 32, berserk: 28, caster: 26, shadow: 30, knight: 44, mini: 160, boss: 500 },
  sections: [
    { type: 'wave', name: '수문', trigger_x: 5, spawns: [
      { enemy_id: 'knight', x: 8 }, { enemy_id: 'shield', x: 9 }, { enemy_id: 'swift', x: 9.8 },
    ] },
    { type: 'rest', trigger_x: 12.5, heal_ratio: 0.3 },
    { type: 'wave', name: '혼전', trigger_x: 15, spawns: [
      { enemy_id: 'shadow', x: 17.5 }, { enemy_id: 'berserk', x: 18.5 }, { enemy_id: 'caster', x: 21 },
    ], growth_after: true },
    { type: 'wave', name: '총력', trigger_x: 23, spawns: [
      { enemy_id: 'heavy', x: 25.5 }, { enemy_id: 'dual', x: 26.3 }, { enemy_id: 'archer', x: 28.5 }, { enemy_id: 'swift', x: 27 },
    ] },
    { type: 'miniboss', trigger_x: 30.5, boss_id: 'mini_gatekeeper', growth_after: true },
    { type: 'boss_gate', trigger_x: 36, boss_id: 'boss_saint' },
  ],
  next_stage: null, // 완주 = 검성 흑월 격파
};

export const STAGES: Record<string, StageDef> = {
  s1_mountain: STAGE_1, s2_bamboo: STAGE_2, s3_castle: STAGE_3, s4_snowfield: STAGE_4, s5_peak: STAGE_5,
};

export type StageEvent =
  | { kind: 'spawn'; spawns: SpawnEntry[]; name: string }
  | { kind: 'rest'; heal_ratio: number }
  | { kind: 'growth_pick' }
  | { kind: 'miniboss'; boss_id: string }
  | { kind: 'boss_gate'; boss_id: string }
  | { kind: 'stage_clear' };

/** 스테이지 진행 러너 — 플레이어 x 기준 섹션 트리거·완료 추적. */
export class StageRunner {
  readonly def: StageDef;
  private idx = 0;
  private waitingClear = false;
  private pendingGrowth = false;

  constructor(def: StageDef) {
    this.def = def;
  }

  get currentIndex(): number {
    return this.idx;
  }

  get blocked(): boolean {
    return this.waitingClear;
  }

  /** 진행 상한 x (미클리어 웨이브 앞에서 전진 제한). */
  maxAdvanceX(): number {
    if (!this.waitingClear) return this.def.world_width;
    const s = this.def.sections[this.idx];
    return s ? s.trigger_x + 4.5 : this.def.world_width;
  }

  /** 매 프레임: 플레이어 위치로 트리거 검사. 발생 이벤트 반환. */
  update(playerX: number): StageEvent[] {
    const out: StageEvent[] = [];
    if (this.pendingGrowth) {
      this.pendingGrowth = false;
      out.push({ kind: 'growth_pick' });
    }
    if (this.waitingClear) return out;
    const s = this.def.sections[this.idx];
    if (!s) return out;
    if (playerX < s.trigger_x) return out;
    switch (s.type) {
      case 'wave':
        this.waitingClear = true;
        out.push({ kind: 'spawn', spawns: s.spawns, name: s.name });
        break;
      case 'rest':
        this.idx++;
        out.push({ kind: 'rest', heal_ratio: s.heal_ratio });
        break;
      case 'miniboss':
        this.waitingClear = true;
        out.push({ kind: 'miniboss', boss_id: s.boss_id });
        break;
      case 'boss_gate':
        // 보스를 잡아야 통과 — 사망 부활 후 재발동 가능 (버그 수정 2026-07-12)
        this.waitingClear = true;
        out.push({ kind: 'boss_gate', boss_id: s.boss_id });
        break;
    }
    return out;
  }

  /** 웨이브/미니보스 전멸 시 씬이 호출. */
  notifyCleared(): void {
    if (!this.waitingClear) return;
    const s = this.def.sections[this.idx];
    this.waitingClear = false;
    this.idx++;
    if (s && 'growth_after' in s && s.growth_after) this.pendingGrowth = true;
    // 마지막 섹션 이후는 boss_gate가 처리
  }

  /** STG-05 체크포인트: 사망 시 현재 섹션 시작으로 복귀 (런 유지 — P09 §6). */
  reviveAtCheckpoint(): { x: number } {
    this.waitingClear = false;
    this.pendingGrowth = false;
    const s = this.def.sections[this.idx];
    const x = s ? Math.max(0.5, s.trigger_x - 1.5) : 0.5;
    return { x };
  }

  goldFor(enemyId: string, isMini = false, isBoss = false): number {
    const g = this.def.gold_per_kill;
    if (isBoss) return g['boss'] ?? 0;
    if (isMini) return g['mini'] ?? 0;
    return g[enemyId] ?? 8;
  }
}
