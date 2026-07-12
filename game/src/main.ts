// M-D: Stage 1 완주 빌드 — 웨이브→성장 3택→미니보스→보스 관문→Duel→결과.
// 스크롤 월드 + 보스전 연출(진입/처치) + 골드/성장. Gate C 후보 빌드.
import Phaser from 'phaser';
import { InputManager } from './input/manager.ts';
import { KeyboardAdapter, LifecycleAdapter, PointerAdapter, SequenceSource } from './input/adapters.ts';
import { realClock } from './input/core.ts';
import { GesturePipeline, type SkillResolved } from './game/pipeline.ts';
import { GestureEngine } from './gesture/engine.ts';
import { DEFAULT_GESTURES, LEFT_GESTURES } from './gesture/templates.ts';
import { SkillExecutor } from './skill/machine.ts';
import { getSkill } from './skill/data.ts';
import {
  applyPoise, isGroggy, newAttackId, PlayerCombat, resolveAttack, updatePoise,
  type Combatant, type HitResult,
} from './combat/combat.ts';
import { AttackCoordinator, EnemyUnit } from './enemy/ai.ts';
import { getEnemy, type TelegraphType } from './enemy/data.ts';
import { DuelController } from './duel/duel.ts';
import { BossController } from './boss/boss.ts';
import { getBoss } from './boss/data.ts';
import { Sfx } from './game/sfx.ts';
import { GrowthPicker, GrowthState, GROWTH_POOL, SCHOOLS, type GrowthOption } from './growth/growth.ts';
import { StageRunner, STAGES, STAGE_1, type StageDef } from './stage/stage.ts';
import { MetaState } from './meta/meta.ts';

const W = 960;
const H = 540;
const UNIT = 100;
const GROUND_Y = 400;
const PLAYER_RADIUS = 0.3;

/** 한글 폰트 명시 — Phaser 기본(Courier)은 한글 미지원으로 글리프 깨짐 (실기 버그 2026-07-12). */
const FONT = '"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

/** 좌수검류 설정 (프로토타입 유파 이식 — localStorage 영구). */
function isLefty(): boolean {
  try {
    return localStorage.getItem('sm.lefty.v1') === '1';
  } catch {
    return false;
  }
}

function setLefty(v: boolean): void {
  try {
    localStorage.setItem('sm.lefty.v1', v ? '1' : '0');
  } catch {
    /* 무시 */
  }
}

/** 검격 스윙 프로파일 (도, y-down) — 준비(windup)→휘두름(from→to)→복귀. */
const SWING: Record<string, { from: number; to: number }> = {
  slash_h: { from: -75, to: 55 },
  slash_back: { from: -75, to: 55 },
  slash_v: { from: -135, to: 40 },
  slash_up: { from: 65, to: -115 },
  slash_diag: { from: -105, to: 50 },
  iaido: { from: 165, to: -5 },   // 납도 → 발도
  spin: { from: -180, to: 180 },
  parry: { from: -95, to: -70 },  // 세워 받기
  art_gale: { from: -90, to: 60 },
  art_thunder: { from: -150, to: 45 },
  art_cross: { from: -110, to: 55 },
  art_waltz: { from: -180, to: 180 },
  art_flash: { from: 170, to: -10 },
  ki_line: { from: -60, to: 40 },
  ki_fan: { from: -90, to: 60 },
  ki_burst: { from: -140, to: 45 },
};
const SWORD_REST = 32;

function easeOutQuad(r: number): number {
  return 1 - (1 - r) * (1 - r);
}

interface UnitView {
  c: Combatant;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  aura: Phaser.GameObjects.Rectangle;
  hpBar: Phaser.GameObjects.Rectangle;
  poiseBar: Phaser.GameObjects.Rectangle;
  ai?: EnemyUnit;
}

class PlayScene extends Phaser.Scene {
  private mgr!: InputManager;
  private pipe!: GesturePipeline;
  private exec!: SkillExecutor;
  private playerCombat = new PlayerCombat();
  private clock = realClock();
  private sfx = new Sfx();
  // 런 상태
  private meta = new MetaState();
  private stageDef: StageDef = STAGE_1;
  private runner = new StageRunner(STAGE_1);
  private growth = new GrowthState();
  private picker = new GrowthPicker(Date.now() % 100000);
  private gold = 0;
  private kills = 0;
  private deaths = 0;
  private bossKills = 0;
  private miniKills = 0;
  private runStartMs = 0;
  private lastHitFrom = '';
  private awaitingNextStage = false;
  private schoolName = '';
  private stageDmgBuff = 1; // 숫돌 (이번 스테이지 한정)
  // 전투 개체
  private duel = new DuelController();
  private coord = new AttackCoordinator(2);
  private units: UnitView[] = [];
  private boss: BossController | null = null;
  private bossView: UnitView | null = null;
  private bossIsMini = false;
  private inDuel = false;
  private arenaMin = 0;
  private arenaMax = 0;
  // 플레이어
  private player!: Phaser.GameObjects.Container;
  private armPivot!: Phaser.GameObjects.Container;
  private bodyRect!: Phaser.GameObjects.Rectangle;
  private facing: 1 | -1 = 1;
  private vy = 0;
  private onGround = true;
  private jumpArmed = true;
  private parryWin: { start: number; end: number } | null = null;
  // UI
  private trail: Array<{ x: number; y: number }> = [];
  private trailGfx!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private bigText!: Phaser.GameObjects.Text;
  private staminaBar!: Phaser.GameObjects.Rectangle;
  private kiBar!: Phaser.GameObjects.Rectangle;
  private playerHpBar!: Phaser.GameObjects.Rectangle;
  private goldText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private edges: Phaser.GameObjects.Rectangle[] = [];
  private pickUi: Phaser.GameObjects.GameObject[] = [];
  private gateDecor: Phaser.GameObjects.GameObject[] = [];
  private gameOver = false;
  // 트윈스틱 UI (프로토타입 이식 — 터치 기기 전용)
  private isTouch = false;
  private touchUiGfx!: Phaser.GameObjects.Graphics;
  private stickView: { active: boolean; ox: number; oy: number; cx: number; cy: number } = { active: false, ox: 0, oy: 0, cx: 0, cy: 0 };
  private seqSource!: SequenceSource;
  private introLockUntil = 0;

  constructor() {
    super('play');
  }

  create(): void {
    const seq = new SequenceSource();
    this.mgr = new InputManager({
      clock: this.clock,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      initialContext: 'gameplay_field',
    });
    // 좌수검류: 미러 템플릿 (프로토타입 유파)
    const engine = new GestureEngine(isLefty() ? LEFT_GESTURES : DEFAULT_GESTURES);
    this.pipe = new GesturePipeline(this.mgr, { w: window.innerWidth, h: window.innerHeight }, engine);
    this.seqSource = seq;
    new PointerAdapter(this.mgr, this.clock, seq).attach(window as never);
    new KeyboardAdapter(this.mgr, this.clock, seq).attach(window as never);
    new LifecycleAdapter(this.mgr, this.clock, seq).attach(window as never, document as never);
    window.addEventListener('resize', () => {
      const vp = { w: window.innerWidth, h: window.innerHeight };
      this.mgr.setViewport(vp);
      this.pipe.setViewport(vp);
    });

    // 월드
    const worldW = STAGE_1.world_width * UNIT;
    this.cameras.main.setBounds(0, 0, worldW, H);
    this.add.rectangle(worldW / 2, GROUND_Y + 30, worldW, 2, 0x444444);
    // 배경 기둥 (진행감)
    for (let x = 300; x < worldW; x += 260) {
      this.add.rectangle(x, GROUND_Y - 40 - (x % 3) * 25, 14, 140 + (x % 5) * 30, 0x2a2a2a).setDepth(-10);
    }
    // 보스 관문 표식은 loadStage에서 스테이지별 재생성

    // 가장자리 (Duel 공격권)
    const mk = (x: number, y: number, w: number, h: number) =>
      this.add.rectangle(x, y, w, h, 0xffffff, 0).setDepth(70).setScrollFactor(0);
    this.edges = [mk(W / 2, 6, W, 12), mk(W / 2, H - 6, W, 12), mk(6, H / 2, 12, H), mk(W - 6, H / 2, 12, H)];

    // 플레이어 리그: 몸 + 어깨 피벗(팔+검) — 검격이 스킬 타이밍과 동기화 (M-E: "칼질이 보인다")
    this.bodyRect = this.add.rectangle(0, 0, 26, 46, 0xe8dcc0);
    const head = this.add.circle(0, -30, 9, 0xe8dcc0);
    this.armPivot = this.add.container(8, -12);
    const sword = this.add.rectangle(14, 0, 40, 4, 0x9ad0ff).setOrigin(0, 0.5);
    const swordTip = this.add.triangle(54, 0, 0, -3, 0, 3, 8, 0, 0x9ad0ff).setOrigin(0, 0.5);
    const guard = this.add.rectangle(12, 0, 3, 12, 0xcfe8ff).setOrigin(0.5, 0.5);
    const arm = this.add.rectangle(4, 0, 12, 5, 0xd8c8a8).setOrigin(0, 0.5);
    this.armPivot.add([arm, sword, swordTip, guard]);
    this.player = this.add.container(160, GROUND_Y, [this.bodyRect, head, this.armPivot]);
    this.cameras.main.startFollow(this.player, true, 0.12, 0);
    this.cameras.main.setFollowOffset(-120, 0);

    this.trailGfx = this.add.graphics().setDepth(50).setScrollFactor(0);
    this.touchUiGfx = this.add.graphics().setDepth(75).setScrollFactor(0);

    // 트윈스틱 시각화 + 터치 회피 버튼 (프로토타입 acDrawControls 이식)
    const DODGE_BX = W * 0.13;
    const DODGE_BY = H * 0.3;
    const DODGE_R = 42;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const type = (p.event as PointerEvent | undefined)?.pointerType ?? 'mouse';
      if (type !== 'touch') return;
      this.isTouch = true;
      if (Math.hypot(p.x - DODGE_BX, p.y - DODGE_BY) < DODGE_R + 8) {
        this.touchDodge();
        return;
      }
      if (p.x / W < 0.4) {
        this.stickView = { active: true, ox: p.x, oy: p.y, cx: p.x, cy: p.y, id: p.id } as never;
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const sv = this.stickView as { active: boolean; id?: number; cx: number; cy: number };
      if (sv.active && sv.id === p.id) {
        sv.cx = p.x;
        sv.cy = p.y;
      }
    });
    const stickEnd = (p: Phaser.Input.Pointer) => {
      const sv = this.stickView as { active: boolean; id?: number };
      if (sv.active && sv.id === p.id) this.stickView.active = false;
    };
    this.input.on('pointerup', stickEnd);
    this.input.on('pointerupoutside', stickEnd);
    this.resultText = this.add.text(W / 2, 90, '', { fontFamily: FONT, fontSize:'24px', color: '#ffd700', align: 'center' }).setOrigin(0.5).setDepth(80).setScrollFactor(0);
    this.bigText = this.add.text(W / 2, H / 2 - 60, '', { fontFamily: FONT, fontSize:'36px', color: '#ffd700', align: 'center', lineSpacing: 8 }).setOrigin(0.5).setDepth(85).setScrollFactor(0);
    this.debugText = this.add.text(8, 8, '', { fontFamily: FONT, fontSize:'11px', color: '#8f8', lineSpacing: 3 }).setDepth(80).setScrollFactor(0);
    this.comboText = this.add.text(W - 16, 110, '', { fontFamily: FONT, fontSize:'22px', color: '#ffd700' }).setOrigin(1, 0).setDepth(80).setScrollFactor(0);
    this.goldText = this.add.text(W - 16, 14, '', { fontFamily: FONT, fontSize:'16px', color: '#ffd77a' }).setOrigin(1, 0).setDepth(80).setScrollFactor(0);

    const hud = (y: number, label: string, color: number) => {
      this.add.text(12, y - 6, label, { fontFamily: FONT, fontSize:'11px', color: '#aaa' }).setDepth(80).setScrollFactor(0);
      this.add.rectangle(160, y, 200, 10, 0x333333).setDepth(79).setScrollFactor(0);
      return this.add.rectangle(60, y, 200, 10, color).setOrigin(0, 0.5).setDepth(80).setScrollFactor(0);
    };
    this.playerHpBar = hud(H - 68, '체력', 0xdd5555);
    this.staminaBar = hud(H - 52, '기력', 0x66cc66);
    this.kiBar = hud(H - 36, '검기', 0xffd700);

    this.add.text(W / 2, H - 14,
      '전진! · 긋기=검술 · ✓=패링(노랑) · 회피=Space/좌상단«(빨강) · 점프=W/스틱↑ · C=부활 / R=새 런', {
      fontFamily: FONT, fontSize: '12px', color: '#888',
    }).setOrigin(0.5).setDepth(80).setScrollFactor(0);

    this.pipe.onSkill((s) => this.onSkill(s));
    this.pipe.onMiss(() => this.flash('미스', '#f66', 16));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      const type = (p.event as PointerEvent | undefined)?.pointerType ?? 'mouse';
      if (type !== 'touch' || p.x / W >= 0.4) this.trail = [{ x: p.x, y: p.y }];
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.trail.length > 0 && p.isDown) {
        this.trail.push({ x: p.x, y: p.y });
        if (this.trail.length > 120) this.trail.shift();
      }
    });
    this.input.on('pointerup', () => this.time.delayedCall(120, () => (this.trail = [])));

    window.addEventListener('keydown', (e) => {
      this.sfx.unlock();
      const k = e.key.toLowerCase();
      if (k === 'r') {
        // 런 포기/새 런 (진행 중이었으면 미클리어 정산)
        if (!this.awaitingNextStage && (this.kills > 0 || this.gameOver)) this.settleRun(false);
        this.newRun();
      }
      if (k === 'c' && this.gameOver && this.playerCombat.hp <= 0) this.reviveAtCheckpoint();
      if (k === 'e' && this.awaitingNextStage) {
        const next = this.stageDef.next_stage;
        if (next && STAGES[next]) this.loadStage(STAGES[next]!, true);
      }
    });

    this.newRun();
  }

  // ── 런/스테이지 수명주기 ──────────────────────────
  private settleRun(cleared: boolean): void {
    const now = this.clock.now();
    this.meta.settleRun({
      cleared,
      boss_kills: this.bossKills,
      mini_kills: this.miniKills,
      no_death: this.deaths === 0,
      time_ms: now - this.runStartMs,
    });
  }

  private newRun(): void {
    this.gold = 0;
    this.kills = 0;
    this.deaths = 0;
    this.bossKills = 0;
    this.miniKills = 0;
    this.growth = new GrowthState();
    this.playerCombat = new PlayerCombat();
    // 승급 보상: 시작 특성 (PRG-06)
    const bonus = this.meta.startBonuses();
    if (bonus.max_hp > 0) this.playerCombat.addMaxHp(bonus.max_hp);
    this.gold += bonus.start_gold;
    this.runStartMs = this.clock.now();
    this.schoolName = '';
    this.loadStage(STAGE_1, true);
    this.flash(`${this.meta.rankName()} — 수련점 ${this.meta.tp}`, '#9ad0ff', 18);
    this.showSchoolPick(); // PRG-07: 런 시작 = 검파 선택
  }

  private loadStage(def: StageDef, keepBuild: boolean): void {
    for (const u of this.units) u.root.destroy();
    this.units = [];
    this.bossView?.root.destroy();
    this.bossView = null;
    this.boss = null;
    this.inDuel = false;
    this.bossIsMini = false;
    this.gameOver = false;
    this.awaitingNextStage = false;
    this.lastHitFrom = '';
    this.bigText.setText('');
    this.clearPickUi();
    this.coord = new AttackCoordinator(2);
    this.duel = new DuelController();
    this.stageDef = def;
    this.runner = new StageRunner(def);
    this.stageDmgBuff = 1; // 숫돌은 스테이지 한정
    if (!keepBuild) this.growth = new GrowthState();
    // 스테이지 전환 시 체력 50% 회복 (연속 런 호흡)
    if (keepBuild && def !== STAGE_1) this.playerCombat.heal(0.5);
    const kiBonus = this.growth.kiGainMul;
    this.exec = new SkillExecutor(this.clock.now(), {
      onSecretArt: (a) => {
        this.sfx.secretArt();
        this.flash(`오의 — ${getSkill(a)?.name}!`, '#ff9d00', 34);
      },
      onKiWave: (wId) => this.fireKiWave(wId),
      onRejected: (_s, r) => {
        if (r === 'no_stamina') this.flash('기력 부족', '#f66');
      },
    });
    this.exec.kiBonus = kiBonus;
    this.player.x = 160;
    this.player.y = GROUND_Y;
    this.cameras.main.setBounds(0, 0, def.world_width * UNIT, H);
    // 스테이지별 보스 관문 표식
    for (const o of this.gateDecor) o.destroy();
    this.gateDecor = [];
    const gate = def.sections.find((s) => s.type === 'boss_gate');
    if (gate) {
      const gx = gate.trigger_x * UNIT + 150;
      this.gateDecor.push(
        this.add.rectangle(gx, GROUND_Y - 60, 16, 180, 0x553333).setDepth(-5),
        this.add.text(gx, GROUND_Y - 170, '結', { fontFamily: FONT, fontSize:'28px', color: '#aa5555' }).setOrigin(0.5).setDepth(-5),
      );
    }
    this.mgr.changeContext('gameplay_field');
    this.flash(def.name, '#9ad0ff', 22);
  }

  /** STG-05: 사망 → 스테이지 처음부터 재도전 (런·빌드·골드 유지 — P09 §6, 사용자 확정 2026-07-12). */
  private reviveAtCheckpoint(): void {
    this.deaths++;
    for (const u of this.units) u.root.destroy();
    this.units = [];
    this.bossView?.root.destroy();
    this.bossView = null;
    this.boss = null;
    this.inDuel = false;
    this.bossIsMini = false;
    this.coord = new AttackCoordinator(2);
    this.duel = new DuelController();
    this.runner = new StageRunner(this.stageDef); // 스테이지 처음부터
    this.player.x = 160;
    this.player.y = GROUND_Y;
    this.playerCombat = new PlayerCombat();
    const bonus = this.meta.startBonuses();
    this.playerCombat.addMaxHp(bonus.max_hp + this.growth.maxHpTotal); // 메타+성장 체력 재적용
    this.gameOver = false;
    this.bigText.setText('');
    this.mgr.changeContext('gameplay_field');
    this.flash('스테이지 처음부터 — 검을 다시 잡는다', '#9ad0ff', 22);
  }

  // ── 스폰 ──────────────────────────────────────────
  private spawnEnemy(id: string, x: number): void {
    const ai = new EnemyUnit(getEnemy(id)!, x, this.clock.now(), this.coord, {
      onTelegraph: (u, a) => this.showTelegraph(this.findView(u.c.id), a.telegraph),
      onStrike: (u, a) => this.enemyStrike(u.c, u.def.name, a.damage, a.range, a.telegraph),
    });
    const colorMap: Record<string, number> = {
      soldier: 0xa05050, hound: 0x7a5a3a, spear: 0x9a8050, shield: 0x5070a0, swift: 0x70a070, heavy: 0x707070,
    };
    const c = ai.c;
    const small = id === 'hound';
    const aura = this.add.rectangle(0, 0, small ? 34 : 44, small ? 40 : 62, 0xffcc00, 0);
    const bodyR = this.add.rectangle(0, small ? 12 : 0, small ? 28 : 34, small ? 26 : 54, colorMap[id] ?? 0xa05050);
    const hpBg = this.add.rectangle(0, -42, 50, 6, 0x333333);
    const hpBar = this.add.rectangle(-25, -42, 50, 6, 0x66dd66).setOrigin(0, 0.5);
    const poiseBar = this.add.rectangle(-25, -35, 50, 3, 0xffaa00).setOrigin(0, 0.5);
    poiseBar.width = 0;
    const label = this.add.text(0, -56, ai.def.name, { fontFamily: FONT, fontSize:'11px', color: '#ccc' }).setOrigin(0.5);
    const root = this.add.container(c.x * UNIT, GROUND_Y, [aura, bodyR, hpBg, hpBar, poiseBar, label]);
    this.units.push({ c, root, body: bodyR, aura, hpBar, poiseBar, ai });
  }

  private spawnBoss(bossId: string, isMini: boolean): void {
    const def = getBoss(bossId)!;
    this.bossIsMini = isMini;
    const px = this.player.x / UNIT;
    // 버그 수정 (2026-07-12): 관문이 월드 끝 근처면 px+4.2가 월드 밖 → 보스가 화면 밖에 갇힘.
    // 스폰 위치를 월드/경기장 안쪽으로 클램프.
    const bossX = Math.min(px + 4.2, this.stageDef.world_width - 1.5);
    this.boss = new BossController(bossId, bossX, this.clock.now(), this.duel, {
      onTelegraph: (p) => this.showTelegraph(this.bossView, p.telegraph.type),
      onStrike: (p, s) => this.enemyStrike(this.boss!.c, def.name, s.damage, s.range, p.telegraph.type, s.unstoppable),
      onOpening: () => this.flash('빈틈!', '#9ad0ff', 20),
      onPhaseChange: (ph) => {
        this.sfx.crack();
        this.flash(`Phase ${ph}!`, '#ff9d00', 30);
      },
      onDefeated: () => this.onBossDefeated(),
    }, Date.now() % 100000);
    const c = this.boss.c;
    const size = isMini ? { w: 40, h: 62 } : { w: 46, h: 74 };
    const aura = this.add.rectangle(0, 0, size.w + 14, size.h + 12, 0xffcc00, 0);
    const bodyR = this.add.rectangle(0, 0, size.w, size.h, isMini ? 0x8a5a3a : 0x8a6a4a);
    const hpBg = this.add.rectangle(0, -58, 80, 8, 0x333333);
    const hpBar = this.add.rectangle(-40, -58, 80, 8, 0xdd5555).setOrigin(0, 0.5);
    const poiseBar = this.add.rectangle(-40, -49, 80, 4, 0xffaa00).setOrigin(0, 0.5);
    poiseBar.width = 0;
    const label = this.add.text(0, -74, def.name, { fontFamily: FONT, fontSize:'13px', color: '#ffd0a0' }).setOrigin(0.5);
    const root = this.add.container(c.x * UNIT, GROUND_Y, [aura, bodyR, hpBg, hpBar, poiseBar, label]);
    this.bossView = { c, root, body: bodyR, aura, hpBar, poiseBar };

    // 등장 연출 (P12 §2: 보스 풀샷)
    const now = this.clock.now();
    this.introLockUntil = now + 1100;
    this.cameras.main.zoomTo(1.18, 260, 'Sine.easeOut');
    this.time.delayedCall(700, () => this.cameras.main.zoomTo(1, 300, 'Sine.easeIn'));
    this.bigText.setText(isMini ? def.name : `${def.title}\n— ${def.name} —`).setColor(isMini ? '#ffd0a0' : '#ff9d66');
    this.time.delayedCall(1300, () => this.bigText.setText(''));
    this.sfx.crack();

    if (!isMini) {
      this.inDuel = true;
      this.mgr.changeContext('gameplay_duel');
      this.arenaMin = Math.max(0.5, Math.min(px, bossX) - 2.0);
      this.arenaMax = Math.min(this.stageDef.world_width - 0.5, Math.max(px, bossX) + 3.0);
    }
  }

  private onBossDefeated(): void {
    const now = this.clock.now();
    this.sfx.kill();
    // 처치 연출: 슬로우 + 줌 (P12 finish_boss)
    this.time.timeScale = 0.25;
    this.cameras.main.zoomTo(1.25, 200);
    this.time.delayedCall(900 * 0.25, () => {
      this.time.timeScale = 1;
      this.cameras.main.zoomTo(1, 300);
    });
    if (this.bossView) {
      this.tweens.add({ targets: this.bossView.root, alpha: 0, angle: 80, duration: 700 });
    }
    if (this.bossIsMini) {
      this.gold += this.runner.goldFor('', true);
      this.kills++;
      this.miniKills++;
      this.boss = null;
      this.time.delayedCall(600, () => {
        this.bossView?.root.destroy();
        this.bossView = null;
      });
      this.runner.notifyCleared();
      this.flash(`정예 격파! +${this.runner.goldFor('', true)}G`, '#ffd700', 26);
    } else {
      // 스테이지 클리어
      this.runner.notifyCleared(); // 보스 관문 통과 처리
      this.gold += this.runner.goldFor('', false, true);
      this.kills++;
      this.bossKills++;
      this.gameOver = true;
      const sec = Math.round((now - this.runStartMs) / 1000);
      const timeStr = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      const next = this.stageDef.next_stage;
      this.time.delayedCall(1000, () => {
        if (next && STAGES[next]) {
          this.awaitingNextStage = true;
          this.bigText.setText([
            `${this.stageDef.name.split(' — ')[0]} 돌파!`,
            `누적 ${timeStr} · 처치 ${this.kills} · ${this.gold}G`,
            '',
            `E = 다음 스테이지 (${STAGES[next]!.name})`,
            'R = 런 종료·정산',
          ].join('\n')).setColor('#ffd700').setFontSize(24);
        } else {
          // 런 완주 — 정산 (PRG-08/L4)
          const before = this.meta.rankName();
          this.settleRun(true);
          const after = this.meta.rankName();
          this.bigText.setText([
            '검성 흑월을 꺾었다 — 완주!',
            `기록 ${timeStr} · 처치 ${this.kills} · 사망 ${this.deaths} · ${this.schoolName}`,
            `수련점 ${this.meta.tp} · ${before !== after ? `승급! ${before} → ${after}` : after}`,
            '',
            '(R = 새로운 런 — 승급 보상이 적용된다)',
          ].join('\n')).setColor('#ffd700').setFontSize(24);
        }
      });
    }
  }

  private findView(id: string): UnitView | null {
    return this.units.find((u) => u.c.id === id) ?? (this.bossView?.c.id === id ? this.bossView : null);
  }

  private showTelegraph(view: UnitView | null, type: TelegraphType): void {
    if (!view) return;
    view.aura.fillColor = type === 'yellow' ? 0xffcc00 : 0xff3333;
    view.aura.setAlpha(0.9);
    this.tweens.add({ targets: view.aura, alpha: 0.35, duration: 280, yoyo: true, repeat: 3 });
    // 준비 자세: 뒤로 젖힘 (예고의 신체 언어 — 가독성)
    this.tweens.add({ targets: view.body, angle: -14, duration: 220, ease: 'Sine.easeOut' });
  }

  /** 타격 자세: 앞으로 내지르기. */
  private lungePose(view: UnitView | null): void {
    if (!view) return;
    this.tweens.add({
      targets: view.body, angle: 22, duration: 90, yoyo: true, ease: 'Sine.easeIn',
      onComplete: () => (view.body.angle = 0),
    });
  }

  // ── 적 타격 → 패링/회피/피격 ──────────────────────
  private enemyStrike(attacker: Combatant, name: string, damage: number, range: number, type: TelegraphType, unstoppable = false): void {
    const now = this.clock.now();
    const view = this.findView(attacker.id);
    if (view) {
      view.aura.setAlpha(0);
      this.lungePose(view);
      // 타격 순간 '!' — 가독성 (프로토타입 방식)
      const ex = this.add.text(view.root.x, view.root.y - 90, '!', { fontFamily: FONT, fontSize:'26px', color: type === 'red' ? '#ff5555' : '#ffcc00' }).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: ex, alpha: 0, duration: 300, onComplete: () => ex.destroy() });
    }
    if (this.gameOver) return;
    const dist = Math.abs(attacker.x - this.player.x / UNIT);
    if (dist > range + PLAYER_RADIUS) return;

    if (type === 'yellow' && this.parryWin && now >= this.parryWin.start && now <= this.parryWin.end) {
      this.parryWin = null;
      this.exec.onParrySuccess();
      let bonus = 60 + this.growth.parryPoiseBonus;
      if (this.inDuel) bonus = this.duel.onParrySuccess(now) + this.growth.parryPoiseBonus;
      if (this.growth.parryKiBonus > 0) this.exec.ki.addRaw(this.growth.parryKiBonus);
      applyPoise(attacker, bonus, now);
      const unit = this.units.find((u) => u.c.id === attacker.id);
      unit?.ai?.onHitReaction(isGroggy(attacker, now) ? 'groggy' : 'flinch', now);
      if (this.boss && attacker.id === this.boss.c.id) this.boss.onHitReaction(now);
      this.sfx.parry();
      this.sfx.haptic([10, 40, 25]);
      this.flash(`패링! (자세 +${bonus})`, '#ffe680', 26);
      this.cameras.main.shake(100, 0.006);
      this.time.timeScale = 0.05;
      this.time.delayedCall(7, () => (this.time.timeScale = 1));
      return;
    }

    if (this.playerCombat.invulnerable(now)) {
      if (type === 'red') {
        this.duel.onRedDodge(now);
        this.flash('회피 성공 — 반격!', '#9ad0ff', 20);
      }
      return;
    }

    if (this.playerCombat.tryHit(damage, now, { unstoppable })) {
      this.lastHitFrom = name;
      this.exec.onPlayerHit(now);
      this.sfx.hurt();
      this.sfx.haptic(70);
      this.cameras.main.shake(140, 0.008);
      this.cameras.main.flash(80, 120, 0, 0);
      // 피격 넉백
      const dir = Math.sign(this.player.x / UNIT - attacker.x) || 1;
      this.tweens.add({ targets: this.player, x: this.player.x + dir * 40, duration: 100 });
      if (!this.playerCombat.alive) {
        this.gameOver = true;
        this.bigText.setText([
          '쓰러졌다…',
          `사인: ${this.lastHitFrom}의 공격`,
          '',
          'C = 스테이지 처음부터 재도전 (빌드·골드 유지)',
          'R = 런 포기·정산 (골드 소실)',
        ].join('\n')).setColor('#ff6666').setFontSize(24);
      }
    }
  }

  // ── 플레이어 스킬 ─────────────────────────────────
  private onSkill(s: SkillResolved): void {
    if (this.gameOver || this.pickUi.length > 0) return;
    const now = this.clock.now();
    if (now < this.introLockUntil) return;
    if (s.parry_attempt_failed) {
      this.flash('패링 실패 (오발 방지)', '#fa0', 16);
      return;
    }
    const r = this.exec.execute(s.skill_id, s.grade, now);
    if (!r.ok) {
      if (this.inDuel && s.grade === 'miss') this.duel.onPlayerMiss(now);
      return;
    }
    const ex = r.execution;
    const def = getSkill(ex.skill_id)!;
    if (ex.skill_id === 'parry') {
      this.parryWin = { start: ex.active_start_ms, end: ex.active_end_ms };
      this.sfx.swing();
      this.slashArc();
      return;
    }
    const gradeColor: Record<string, string> = { perfect: '#ffd700', great: '#c0c0ff', good: '#ffffff', bad: '#999999' };
    if (!ex.is_secret_art) this.flash(`${def.name} [${s.grade}]`, gradeColor[s.grade] ?? '#fff', 18);
    this.sfx.swing();
    this.slashArc();
    if (ex.base_skill_id === 'iaido') {
      this.tweens.add({ targets: this.player, x: this.player.x + this.facing * 1.0 * UNIT, duration: 90 });
    }
    this.time.delayedCall(Math.max(0, ex.active_start_ms - now), () => this.doAttack(ex.skill_id, s.grade));
  }

  private targets(): Combatant[] {
    const t = this.units.filter((u) => u.c.alive).map((u) => u.c);
    if (this.boss && this.boss.c.alive) t.push(this.boss.c);
    return t;
  }

  private doAttack(skillId: string, grade: SkillResolved['grade']): void {
    const now = this.clock.now();
    const counter = this.playerCombat.dodgeCounterActive(now) || this.duel.counterWindowActive(now);
    const results = resolveAttack({
      attack_id: newAttackId(), skill_id: skillId, grade,
      origin: { x: this.player.x / UNIT, y: 0, dir: this.facing },
      combo: this.playerCombat.combo.current, counter,
      modifier_mul: this.growth.damageMulFor(skillId) * this.stageDmgBuff,
      range_mul: this.growth.rangeMulFor(skillId),
    }, this.targets(), now);
    if (results.length === 0) {
      this.sfx.whiff();
      const t = this.add.text(this.player.x + this.facing * 60, GROUND_Y - 60, '허공', { fontFamily: FONT, fontSize:'13px', color: '#667' }).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 14, duration: 450, onComplete: () => t.destroy() });
      return;
    }
    for (const hit of results) {
      this.playerCombat.combo.onHit(now);
      this.exec.onHitLanded(grade);
      this.applyHitView(hit, now);
      if (hit.reaction === 'guarded') {
        this.sfx.guard();
        this.sfx.haptic(10);
      } else if (hit.reaction === 'dead') {
        this.sfx.kill();
        this.sfx.haptic(35);
      } else if (hit.reaction === 'groggy' || hit.reaction === 'guard_break') {
        this.sfx.crack();
        this.sfx.haptic([20, 30, 40]);
      } else {
        this.sfx.hit(grade === 'perfect' ? 1.3 : 1);
        this.sfx.haptic(grade === 'perfect' ? 25 : 12);
      }
      if (this.inDuel || this.bossIsMini) {
        if (counter) this.duel.onCounterHit(now);
        if (hit.reaction === 'guard_break') this.duel.onGuardBreak(now);
      }
      if (this.boss && hit.target_id === this.boss.c.id) this.boss.onHitReaction(now);
    }
    if (results.length >= 2) this.flash(`관통 ${results.length}명!`, '#9ad0ff', 22);
    const mul = results.some((h) => h.reaction === 'dead') ? 2 : 1;
    this.cameras.main.shake(80, 0.0035 * mul);
    this.time.timeScale = 0.05;
    this.time.delayedCall(4, () => (this.time.timeScale = 1));
  }

  /** 터치 회피: Space와 동일한 커맨드 합성 (INP 버퍼 경유 — 규격 유지). */
  private touchDodge(): void {
    const t = this.clock.now();
    const base = { pointer_id: -1, x: 0, y: 0, key: ' ', device: 'keyboard' as const, is_over_ui: false };
    this.mgr.push({ ...base, type: 'key_down', timestamp_ms: t, sequence_id: this.seqSource.next() });
    this.mgr.push({ ...base, type: 'key_up', timestamp_ms: t + 1, sequence_id: this.seqSource.next() });
  }

  private slashArc(): void {
    const arc = this.add.arc(
      this.player.x + this.facing * 34, this.player.y - 8, 42,
      this.facing > 0 ? -70 : 110, this.facing > 0 ? 70 : 250,
      false, 0xd8ecff, 0.55,
    ).setDepth(54);
    this.tweens.add({ targets: arc, alpha: 0, scale: 1.35, duration: 160, onComplete: () => arc.destroy() });
  }

  private fireKiWave(waveId: string): void {
    const def = getSkill(waveId)!;
    this.sfx.kiWave();
    this.flash(`검기 — ${def.name}!`, '#ffd700', 30);
    const line = this.add.rectangle(this.player.x, GROUND_Y - 10, 60, 6, 0xffe680).setDepth(55);
    this.tweens.add({ targets: line, x: this.player.x + this.facing * 900, scaleX: 3, duration: 260, onComplete: () => line.destroy() });
    this.time.delayedCall(60, () => this.doAttack(waveId, 'perfect'));
  }

  private applyHitView(hit: HitResult, now: number): void {
    const view = this.findView(hit.target_id);
    if (!view) return;
    view.ai?.onHitReaction(hit.reaction, now);
    const color = hit.reaction === 'guarded' ? '#8899aa' : hit.weakness_hit ? '#ff9d00' : hit.counter ? '#ffe680' : '#fff';
    const pop = this.add.text(view.root.x, view.root.y - 78, `${hit.damage}${hit.weakness_hit ? ' 약점!' : ''}${hit.counter ? ' 카운터!' : ''}`, {
      fontFamily: FONT, fontSize: hit.reaction === 'dead' ? '22px' : '15px', color,
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: pop, y: pop.y - 24, alpha: 0, duration: 600, onComplete: () => pop.destroy() });
    const orig = view.body.fillColor;
    view.body.fillColor = hit.reaction === 'guarded' ? 0x8899ff : 0xffffff;
    this.time.delayedCall(60, () => (view.body.fillColor = orig));
    this.tweens.add({ targets: view.root, x: view.root.x + this.facing * hit.knockback * UNIT, duration: 80 });

    // 잉크 스플래시 (프로토타입 feelHit 이식 — 수묵 톤 파편)
    if (hit.reaction !== 'guarded') {
      const n = hit.reaction === 'dead' ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
        const spd = 30 + Math.random() * 55;
        const drop = this.add.circle(view.root.x, view.root.y - 10, 2 + Math.random() * 4, 0x120e0b, 0.8).setDepth(53);
        this.tweens.add({
          targets: drop,
          x: drop.x + Math.cos(ang) * spd + this.facing * 25,
          y: drop.y + Math.sin(ang) * spd * 0.7 + 18,
          alpha: 0,
          scale: 0.4,
          duration: 380 + Math.random() * 180,
          ease: 'Cubic.easeOut',
          onComplete: () => drop.destroy(),
        });
      }
    }

    if (hit.reaction === 'guard_break') this.flash('가드 브레이크!', '#ff9d00', 24);
    if (hit.reaction === 'groggy') this.flash('자세 붕괴!', '#ff9d00', 26);
    if (hit.reaction === 'dead' && view !== this.bossView) {
      this.tweens.add({ targets: view.root, alpha: 0, angle: 75, duration: 320 });
      const enemyId = hit.target_id.split(':')[0]!;
      const g = this.runner.goldFor(enemyId);
      this.gold += g;
      this.kills++;
      const gp = this.add.text(view.root.x, view.root.y - 100, `+${g}G`, { fontFamily: FONT, fontSize:'13px', color: '#ffd77a' }).setOrigin(0.5).setDepth(60);
      this.tweens.add({ targets: gp, y: gp.y - 20, alpha: 0, duration: 700, onComplete: () => gp.destroy() });
      // 웨이브 전멸 체크
      if (this.units.every((u) => !u.c.alive)) {
        this.runner.notifyCleared();
        this.flash('일소!', '#ffd700', 24);
      }
    }
  }

  // ── 성장 3택 UI ───────────────────────────────────
  private showGrowthPick(bossReward = false): void {
    this.mgr.changeContext('menu');
    const options = this.picker.roll(this.growth, bossReward);
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(88).setScrollFactor(0);
    const title = this.add.text(W / 2, 90, '성장 — 하나를 선택하라', { fontFamily: FONT, fontSize:'24px', color: '#ffd700' }).setOrigin(0.5).setDepth(90).setScrollFactor(0);
    this.pickUi = [dim, title];
    const rc: Record<string, string> = { common: '#cccccc', rare: '#7ab0ff', legendary: '#ff9d00' };
    options.forEach((o, i) => {
      const x = W / 2 + (i - 1) * 250;
      const card = this.add.rectangle(x, H / 2, 220, 200, 0x222228).setStrokeStyle(2, o.rarity === 'legendary' ? 0xff9d00 : o.rarity === 'rare' ? 0x7ab0ff : 0x555555)
        .setDepth(90).setScrollFactor(0).setInteractive({ useHandCursor: true });
      const name = this.add.text(x, H / 2 - 60, o.name, { fontFamily: FONT, fontSize:'18px', color: rc[o.rarity] }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      const desc = this.add.text(x, H / 2, o.desc, { fontFamily: FONT, fontSize:'14px', color: '#ddd', wordWrap: { width: 190 }, align: 'center' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      const axis = this.add.text(x, H / 2 + 70, { offense: '공격', technique: '기술', survival: '생존' }[o.axis], { fontFamily: FONT, fontSize:'12px', color: '#888' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      card.on('pointerdown', () => this.applyGrowthPick(o));
      this.pickUi.push(card, name, desc, axis);
    });
  }

  private applyGrowthPick(o: GrowthOption): void {
    this.growth.apply(o);
    this.consumeGrowthPendings();
    this.clearPickUi();
    this.mgr.changeContext(this.inDuel ? 'gameplay_duel' : 'gameplay_field');
    this.sfx.secretArt();
    this.flash(`${o.name} 습득!`, '#9ad0ff', 22);
  }

  private clearPickUi(): void {
    for (const o of this.pickUi) o.destroy();
    this.pickUi = [];
  }

  /** PRG-07: 검파 선택 (런 시작 — "너는 어느 손에 검을 쥘 것이냐"). */
  private showSchoolPick(): void {
    this.mgr.changeContext('menu');
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(88).setScrollFactor(0);
    const title = this.add.text(W / 2, 80, '검파를 선택하라', { fontFamily: FONT, fontSize: '26px', color: '#e8dcc0' }).setOrigin(0.5).setDepth(90).setScrollFactor(0);
    this.pickUi = [dim, title];
    SCHOOLS.forEach((s, i) => {
      const x = W / 2 + (i - 1) * 260;
      const card = this.add.rectangle(x, H / 2, 230, 220, 0x222228).setStrokeStyle(2, 0x8a7a5a)
        .setDepth(90).setScrollFactor(0).setInteractive({ useHandCursor: true });
      const name = this.add.text(x, H / 2 - 70, s.name, { fontFamily: FONT, fontSize: '24px', color: '#ffd700' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      const motto = this.add.text(x, H / 2 - 38, `"${s.motto}"`, { fontFamily: FONT, fontSize: '13px', color: '#9ad0ff' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      const desc = this.add.text(x, H / 2 + 20, s.desc, { fontFamily: FONT, fontSize: '14px', color: '#ddd', wordWrap: { width: 200 }, align: 'center' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      card.on('pointerdown', () => {
        for (const e of s.effects) this.growth.applyEffect(e);
        this.consumeGrowthPendings();
        this.schoolName = s.name;
        this.clearPickUi();
        this.mgr.changeContext('gameplay_field');
        this.sfx.secretArt();
        this.flash(`${s.name} 입문 — ${s.motto}`, '#ffd700', 24);
      });
      this.pickUi.push(card, name, motto, desc);
    });
  }

  /** EQP-05: 휴식처 상점 (골드 사용처 — 선택 압박). */
  private showShop(): void {
    this.mgr.changeContext('menu');
    const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(88).setScrollFactor(0);
    const title = this.add.text(W / 2, 70, `휴식처 — 행상 소녀의 상점 (${this.gold}G)`, { fontFamily: FONT, fontSize: '22px', color: '#ffd77a' }).setOrigin(0.5).setDepth(90).setScrollFactor(0);
    this.pickUi = [dim, title];
    const items: Array<{ name: string; desc: string; price: number; buy: () => void }> = [
      { name: '회복약', desc: '체력 50% 회복', price: 80, buy: () => this.playerCombat.heal(0.5) },
      { name: '숫돌', desc: '이번 스테이지 피해 +20%', price: 100, buy: () => (this.stageDmgBuff = 1.2) },
      {
        name: '비전서', desc: '레어 이상 성장 1개 (무작위)', price: 150,
        buy: () => {
          const pool = GROWTH_POOL.filter((o) => o.rarity !== 'common' && this.growth.stacksOf(o.option_id) < o.max_stacks);
          const pick = pool[Math.floor(Math.random() * pool.length)];
          if (pick) {
            this.growth.apply(pick);
            this.consumeGrowthPendings();
            this.flash(`${pick.name} 습득!`, '#7ab0ff', 22);
          }
        },
      },
    ];
    items.forEach((it, i) => {
      const x = W / 2 + (i - 1) * 250;
      const afford = this.gold >= it.price;
      const card = this.add.rectangle(x, H / 2 - 10, 220, 170, 0x222228).setStrokeStyle(2, afford ? 0xffd77a : 0x444444)
        .setDepth(90).setScrollFactor(0);
      const name = this.add.text(x, H / 2 - 60, it.name, { fontFamily: FONT, fontSize: '19px', color: afford ? '#ffd77a' : '#666' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      const desc = this.add.text(x, H / 2 - 20, it.desc, { fontFamily: FONT, fontSize: '13px', color: afford ? '#ddd' : '#555', wordWrap: { width: 190 }, align: 'center' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      const price = this.add.text(x, H / 2 + 40, `${it.price} G`, { fontFamily: FONT, fontSize: '16px', color: afford ? '#ffd700' : '#663333' }).setOrigin(0.5).setDepth(91).setScrollFactor(0);
      if (afford) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerdown', () => {
          this.gold -= it.price;
          it.buy();
          this.sfx.hit(1);
          this.closeShop();
        });
      }
      this.pickUi.push(card, name, desc, price);
    });
    const leave = this.add.text(W / 2, H - 70, '— 지나간다 —', { fontFamily: FONT, fontSize: '17px', color: '#9ad0ff' })
      .setOrigin(0.5).setDepth(91).setScrollFactor(0).setInteractive({ useHandCursor: true });
    leave.on('pointerdown', () => this.closeShop());
    this.pickUi.push(leave);
  }

  private closeShop(): void {
    this.clearPickUi();
    this.mgr.changeContext(this.inDuel ? 'gameplay_duel' : 'gameplay_field');
  }

  /** 성장 효과의 즉시 반영분 소비 (체력/회복/골드/검기배율). */
  private consumeGrowthPendings(): void {
    if (this.growth.pendingMaxHp > 0) {
      this.playerCombat.addMaxHp(this.growth.pendingMaxHp);
      this.growth.pendingMaxHp = 0;
    }
    if (this.growth.pendingHeal > 0) {
      this.playerCombat.heal(this.growth.pendingHeal);
      this.growth.pendingHeal = 0;
    }
    if (this.growth.pendingGold > 0) {
      this.gold += this.growth.pendingGold;
      this.growth.pendingGold = 0;
    }
    this.exec.kiBonus = this.growth.kiGainMul;
  }

  private flash(msg: string, color: string, size = 20): void {
    this.resultText.setText(msg).setColor(color).setFontSize(size).setAlpha(1);
    this.tweens.add({ targets: this.resultText, alpha: 0, delay: 750, duration: 350 });
  }

  // ── 프레임 갱신 ───────────────────────────────────
  override update(_t: number, delta: number): void {
    const now = this.clock.now();
    this.mgr.update();
    this.exec.update(now);
    this.playerCombat.combo.update(now);
    this.duel.update(now);

    const playerX = this.player.x / UNIT;

    // 스테이지 진행
    if (!this.gameOver && this.pickUi.length === 0) {
      for (const e of this.runner.update(playerX)) {
        switch (e.kind) {
          case 'spawn':
            for (const s of e.spawns) this.spawnEnemy(s.enemy_id, s.x);
            this.flash(`적습 — ${e.name}!`, '#ff9d66', 22);
            break;
          case 'rest':
            this.playerCombat.heal(e.heal_ratio);
            this.flash('휴식 — 체력 회복', '#8f8', 20);
            this.showShop(); // EQP-05
            break;
          case 'growth_pick':
            this.showGrowthPick();
            break;
          case 'miniboss':
            this.spawnBoss(e.boss_id, true);
            break;
          case 'boss_gate':
            this.spawnBoss(e.boss_id, false);
            break;
        }
      }
    }

    // 패링 유효창 자동 감지 (노랑 예고 근접)
    let yellowNear = false;
    for (const u of this.units) {
      const t = u.ai?.telegraphing;
      if (t && t.telegraph === 'yellow' && Math.abs(u.c.x - playerX) < t.range + 1.0) yellowNear = true;
    }
    const bt = this.boss?.telegraphing;
    if (bt && bt.telegraph.type === 'yellow') yellowNear = true;
    this.pipe.setParryWindow(yellowNear);

    // 회피
    const dodge = this.mgr.buffer.tryConsume(now, (c) => (c.type === 'dodge' ? 'ok' : 'blocked'));
    if (dodge && !this.gameOver && this.pickUi.length === 0 && this.exec.tryDodge(now)) {
      this.playerCombat.onDodge(now);
      const mv0 = this.mgr.snapshot().move;
      const dir = mv0.magnitude > 0.1 ? Math.sign(mv0.x) || this.facing : -this.facing;
      this.tweens.add({ targets: this.player, x: this.player.x + dir * 1.2 * UNIT, duration: 140 });
      this.sfx.whiff();
    }

    // 이동 + 점프
    const mv = this.mgr.snapshot().move;
    const locked = this.gameOver || this.pickUi.length > 0 || now < this.introLockUntil;
    if (!locked && !this.playerCombat.staggered(now)) {
      if (Math.abs(mv.x) > 0.05) this.facing = mv.x > 0 ? 1 : -1;
      const speed = 0.3 * delta;
      const minX = (this.inDuel ? this.arenaMin : 0.2) * UNIT;
      const maxX = (this.inDuel ? this.arenaMax : this.runner.maxAdvanceX()) * UNIT;
      this.player.x = Phaser.Math.Clamp(this.player.x + mv.x * speed, minX, maxX);
      if (mv.y > -0.3) this.jumpArmed = true;
      if (this.onGround && this.jumpArmed && mv.y < -0.6) {
        this.vy = -0.9;
        this.onGround = false;
        this.jumpArmed = false;
      }
    }
    if (!this.onGround) {
      this.vy += 0.0037 * delta;
      this.player.y += this.vy * delta;
      if (this.player.y >= GROUND_Y) {
        this.player.y = GROUND_Y;
        this.vy = 0;
        this.onGround = true;
      }
    }
    this.player.setScale(this.facing, 1);

    // 검격 리그: 스킬 상태와 동기화된 팔 회전 (준비→휘두름→복귀)
    const act = this.exec.machine.activeSkill;
    const skState = this.exec.machine.state(now);
    let armDeg = SWORD_REST;
    if (act && skState !== 'ready') {
      const prof = SWING[act.def.skill_id] ?? SWING['slash_h']!;
      if (skState === 'startup') {
        const r = Math.min(1, (now - act.started_ms) / Math.max(1, act.active_start_ms - act.started_ms));
        armDeg = SWORD_REST + (prof.from - SWORD_REST) * easeOutQuad(r);
      } else if (skState === 'active') {
        const r = Math.min(1, (now - act.active_start_ms) / Math.max(1, act.active_end_ms - act.active_start_ms));
        armDeg = prof.from + (prof.to - prof.from) * r;
      } else {
        // recovery: 따라가기(follow-through) 후 서서히 복귀 — "붕 뜨는 시간"이 검을 거두는 동작으로 보임
        const r = Math.min(1, (now - act.active_end_ms) / Math.max(1, act.recovery_end_ms - act.active_end_ms));
        armDeg = prof.to + (SWORD_REST - prof.to) * easeOutQuad(r);
      }
    } else if (mv.magnitude > 0.1) {
      armDeg = SWORD_REST + Math.sin(now * 0.012) * 6; // 달리기 흔들림
    }
    this.armPivot.rotation = Phaser.Math.DegToRad(armDeg);
    // 달리기 몸 기울임 + 걸음 바운스
    this.bodyRect.rotation = mv.magnitude > 0.1 ? this.facing * 0.06 : 0;
    this.bodyRect.y = mv.magnitude > 0.1 && this.onGround ? Math.abs(Math.sin(now * 0.015)) * -2.5 : 0;

    // 적/보스 AI
    const alive = this.playerCombat.alive && !this.gameOver && this.pickUi.length === 0;
    for (const u of this.units) {
      if (!u.c.alive) continue;
      updatePoise(u.c, now);
      const dx = u.ai!.update(now, delta, playerX, alive);
      u.root.x += dx * UNIT;
      u.c.x = u.root.x / UNIT;
      this.refreshUnitView(u, now);
    }
    if (this.boss && this.bossView && this.boss.state !== 'dead') {
      updatePoise(this.boss.c, now);
      const dx = this.boss.update(now, delta, playerX, alive && now >= this.introLockUntil);
      this.bossView.root.x += dx * UNIT;
      // 안전장치: 보스가 멀리서 방치되면(스폰 이상 등) 강제로 시야 안까지 끌어옴
      if (Math.abs(this.boss.c.x - playerX) > 7 && now >= this.introLockUntil) {
        this.bossView.root.x -= Math.sign(this.boss.c.x - playerX) * 0.045 * delta * UNIT * 0.06;
      }
      this.boss.c.x = this.bossView.root.x / UNIT;
      this.refreshUnitView(this.bossView, now);
    }

    // Duel 가장자리
    const phase = this.inDuel ? this.duel.current : 'neutral';
    const edgeColor = phase === 'player_offense' ? 0xffd700 : phase === 'enemy_offense' ? 0xcc2222 : 0xffffff;
    const edgeAlpha = phase === 'player_offense' ? 0.25 + 0.35 * this.duel.offenseRatio(now) : phase === 'enemy_offense' ? 0.4 : 0;
    for (const e of this.edges) {
      e.fillColor = edgeColor;
      e.setAlpha(edgeAlpha);
    }

    // HUD
    this.playerHpBar.width = Math.max(0, (this.playerCombat.hp / this.playerCombat.maxHp) * 200);
    this.staminaBar.width = (this.exec.stamina.current / 100) * 200;
    this.kiBar.width = (this.exec.ki.current / 100) * 200;
    this.kiBar.fillColor = this.exec.ki.full ? 0xfff2a0 : 0xffd700;
    this.goldText.setText(`${this.gold} G · 진행 ${Math.min(100, Math.round((playerX / this.stageDef.world_width) * 100))}%`);
    const combo = this.playerCombat.combo.current;
    this.comboText.setText(combo >= 2 ? `${combo} COMBO` : '');

    // 궤적
    this.trailGfx.clear();
    if (this.trail.length > 1) {
      this.trailGfx.lineStyle(4, 0xd8ecff, 0.9);
      this.trailGfx.beginPath();
      this.trailGfx.moveTo(this.trail[0]!.x, this.trail[0]!.y);
      for (const p of this.trail) this.trailGfx.lineTo(p.x, p.y);
      this.trailGfx.strokePath();
    }

    // 트윈스틱 UI (터치 전용 — 프로토타입 방식: 우측 이중 링 상시 은은 + 좌측 스틱 터치 중)
    this.touchUiGfx.clear();
    if (this.isTouch) {
      const g = this.touchUiGfx;
      // 우측 검격 존 가이드 링
      g.lineStyle(2, 0xc9a86a, 0.13);
      g.strokeCircle(W * 0.72, H * 0.55, 118);
      g.lineStyle(2, 0xc9a86a, 0.07);
      g.strokeCircle(W * 0.72, H * 0.55, 118 * 0.62);
      // 좌상단 회피 버튼 (원 + « 기호)
      const bx = W * 0.13;
      const by = H * 0.3;
      g.lineStyle(2, 0xc9a86a, 0.22);
      g.strokeCircle(bx, by, 42);
      g.lineStyle(3, 0xe6dcc3, 0.4);
      g.beginPath();
      g.moveTo(bx + 8, by - 12);
      g.lineTo(bx - 6, by);
      g.lineTo(bx + 8, by + 12);
      g.moveTo(bx + 18, by - 12);
      g.lineTo(bx + 4, by);
      g.lineTo(bx + 18, by + 12);
      g.strokePath();
      // 좌측 조이스틱 (터치 중)
      const sv = this.stickView;
      if (sv.active) {
        const sr = 62;
        let dx = sv.cx - sv.ox;
        let dy = sv.cy - sv.oy;
        const d = Math.hypot(dx, dy);
        if (d > sr) {
          dx = (dx / d) * sr;
          dy = (dy / d) * sr;
        }
        g.lineStyle(3, 0xe6dcc3, 0.32);
        g.strokeCircle(sv.ox, sv.oy, sr);
        g.fillStyle(0xe6dcc3, 0.5);
        g.fillCircle(sv.ox + dx, sv.oy + dy, 20);
      }
    }

    // 디버그
    const r = this.pipe.last;
    this.debugText.setText([
      `${this.stageDef.stage_id} x: ${playerX.toFixed(1)}/${this.stageDef.world_width} duel: ${this.inDuel ? this.duel.current : '-'} parry: ${yellowNear ? 'ON' : 'off'}`,
      `hp ${this.playerCombat.hp}/${this.playerCombat.maxHp} stamina ${this.exec.stamina.current.toFixed(0)} ki ${this.exec.ki.current.toFixed(0)} 빌드 ${this.growth.picks.length}종`,
      r ? `last: ${r.gesture_id ?? 'fail'} ${r.score.toFixed(1)}` : '',
      this.boss ? `boss: ${this.boss.state} ph${this.boss.phase} ${this.boss.c.hp}/${this.boss.c.max_hp}` : '',
    ]);
  }

  private refreshUnitView(u: UnitView, now: number): void {
    const wBar = u === this.bossView ? 80 : 50;
    u.hpBar.width = Math.max(0, (u.c.hp / u.c.max_hp) * wBar);
    u.poiseBar.width = Math.max(0, Math.min(1, u.c.poise / u.c.poise_max)) * wBar;
    const groggy = isGroggy(u.c, now);
    u.body.setAlpha(groggy ? 0.55 : 1);
    if (groggy) u.aura.setAlpha(0);
    u.root.setScale(u.c.facing === 1 ? -1 : 1, 1);
  }
}

/**
 * 타이틀 씬 (UI-04) — 프로토타입 방식 계승 (사용자 확정 2026-07-12):
 * 첫 화면에서 실제로 횡베기를 그어야 시작된다. "이 게임은 긋는 게임"을 첫 3초에 각인.
 * 첫 긋기 = AudioContext 게이트 겸용 (P10 §3).
 */
class TitleScene extends Phaser.Scene {
  private engine = new GestureEngine(isLefty() ? LEFT_GESTURES : DEFAULT_GESTURES);
  private pts: Array<{ x: number; y: number; t: number }> = [];
  private trailGfx!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private sfx = new Sfx();
  private started = false;

  constructor() {
    super('title');
  }

  create(): void {
    const meta = new MetaState();
    this.titleText = this.add.text(W / 2, H / 2 - 90, '소드마스터의 길', { fontFamily: FONT, fontSize:'52px', color: '#e8dcc0' }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 - 40, '劍 로 그 라 이 크', { fontFamily: FONT, fontSize:'15px', color: '#8a7a5a' }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 20,
      `${meta.rankName()} · 수련점 ${meta.tp} · 완주 ${meta.snapshot.total_clears}회`,
      { fontFamily: FONT, fontSize:'15px', color: '#9ad0ff' }).setOrigin(0.5);
    this.hint = this.add.text(W / 2, H / 2 + 120, '검 을   가 로 로   그 어 라', { fontFamily: FONT, fontSize:'22px', color: '#ffd700' }).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
    this.add.text(W / 2, H - 24, '개발 빌드 · 데모 = S1~S2', { fontFamily: FONT, fontSize:'11px', color: '#555' }).setOrigin(0.5);

    // 시범 궤적: 유령 검이 가로로 긋는 시연 (반복 — 좌수검류는 우→좌)
    const lefty = isLefty();
    const gx0 = lefty ? W / 2 + 180 : W / 2 - 180;
    const gx1 = lefty ? W / 2 - 180 : W / 2 + 180;
    const ghost = this.add.circle(gx0, H / 2 + 75, 5, 0xd8ecff, 0.9);
    const ghostTrail = this.add.rectangle(gx0, H / 2 + 75, 4, 3, 0xd8ecff, 0.5).setOrigin(lefty ? 0 : 1, 0.5);
    this.tweens.add({
      targets: ghost, x: gx1, duration: 700, repeat: -1, repeatDelay: 900, ease: 'Sine.easeInOut',
      onUpdate: () => {
        ghostTrail.x = ghost.x;
        ghostTrail.width = Math.max(4, Math.abs(ghost.x - gx0));
        ghostTrail.setAlpha(0.4);
      },
      onRepeat: () => (ghostTrail.width = 4),
    });

    // 유파 선택 (프로토타입 이식): 좌수검/우수검 토글
    const handText = this.add.text(W - 20, H - 24, `검 쥔 손: ${lefty ? '좌수검류' : '우수검류'} (탭하여 변경)`, {
      fontFamily: FONT, fontSize: '13px', color: '#8a7a5a',
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    handText.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation(); // 긋기 수집과 충돌 방지
      setLefty(!lefty);
      this.scene.restart();
    });

    this.trailGfx = this.add.graphics().setDepth(50);

    // 실제 긋기 수집 → 횡베기 판정 시 시작
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.sfx.unlock();
      this.pts = [{ x: p.x, y: p.y, t: performance.now() }];
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pts.length > 0 && p.isDown) this.pts.push({ x: p.x, y: p.y, t: performance.now() });
    });
    this.input.on('pointerup', () => this.judge());
    this.input.keyboard?.on('keydown-ENTER', () => this.begin()); // 접근성 폴백
  }

  private judge(): void {
    if (this.started || this.pts.length === 0) return;
    const r = this.engine.recognize(this.pts, { w: W, h: H });
    this.pts = [];
    if (r.gesture_id === 'slash_h' && r.outcome !== 'fail') {
      this.begin();
    } else if (r.outcome !== 'fail') {
      this.hint.setText('좋 다 —  이 번 엔   가 로 로');
    } else {
      this.hint.setText('길 게 ,  한 번 에   그 어 라');
    }
  }

  private begin(): void {
    if (this.started) return;
    this.started = true;
    this.sfx.swing();
    this.sfx.kill();
    // 타이틀이 베인다: 화면 가로지르는 참격선 + 상하 분리
    const slash = this.add.rectangle(-100, H / 2 - 90, 40, 4, 0xffffff).setDepth(60);
    this.tweens.add({ targets: slash, x: W + 100, scaleX: 8, duration: 220, ease: 'Cubic.easeIn' });
    this.cameras.main.shake(150, 0.008);
    this.time.delayedCall(200, () => {
      this.tweens.add({ targets: this.titleText, y: this.titleText.y - 14, angle: -2, alpha: 0.9, duration: 300 });
      this.cameras.main.fadeOut(450, 0, 0, 0);
    });
    this.time.delayedCall(700, () => this.scene.start('play'));
  }

  override update(): void {
    this.trailGfx.clear();
    if (this.pts.length > 1) {
      this.trailGfx.lineStyle(4, 0xd8ecff, 0.9);
      this.trailGfx.beginPath();
      this.trailGfx.moveTo(this.pts[0]!.x, this.pts[0]!.y);
      for (const p of this.pts) this.trailGfx.lineTo(p.x, p.y);
      this.trailGfx.strokePath();
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: W,
  height: H,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  backgroundColor: '#151515',
  scene: [TitleScene, PlayScene],
});
