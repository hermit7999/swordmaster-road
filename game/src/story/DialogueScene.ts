// 대화 씬 — 초상화 + 타이핑 텍스트 + 탭 진행 + 유파 선택 + 첫 획 입력 (프로토타입 방식 이식).
// 흐름: 타이틀 → [DialogueScene: 프롤로그 → 유파선택 → 스테이지1 인트로] → PlayScene.
import Phaser from 'phaser';
import { GestureEngine } from '../gesture/engine.ts';
import { DEFAULT_GESTURES } from '../gesture/templates.ts';
import {
  PROLOGUE, STYLE_PROMPT, STYLE_CHOICES, STAGE1_INTRO,
  type DialogueLine,
} from './prologue.ts';

const FONT = '"Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

type Phase = 'prologue' | 'style_prompt' | 'style_choice' | 'reaction' | 'intro';

export class DialogueScene extends Phaser.Scene {
  private lines: DialogueLine[] = [];
  private idx = 0;
  private phase: Phase = 'prologue';
  private engine = new GestureEngine(DEFAULT_GESTURES);
  // UI
  private portrait!: Phaser.GameObjects.Rectangle;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private tapHint!: Phaser.GameObjects.Text;
  private box!: Phaser.GameObjects.Rectangle;
  private choiceUi: Phaser.GameObjects.GameObject[] = [];
  private trailGfx!: Phaser.GameObjects.Graphics;
  // 타이핑
  private full = '';
  private shown = 0;
  private typing = false;
  private typeEvent?: Phaser.Time.TimerEvent;
  // 첫 획 입력
  private awaitStroke = false;
  private strokePts: Array<{ x: number; y: number; t: number }> = [];

  constructor() {
    super('dialogue');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor('#0d0b09');

    // 배경 분위기 (잿빛 세로선 = 불탄 검문 실루엣 느낌)
    for (let i = 0; i < 14; i++) {
      const x = 40 + i * (W / 14) + (i % 3) * 12;
      this.add.rectangle(x, H * 0.45, 6, 60 + (i % 4) * 40, 0x1a1712).setOrigin(0.5, 1).setAlpha(0.5);
    }

    // 대화 박스
    this.box = this.add.rectangle(W / 2, H - 92, W - 60, 150, 0x14110d, 0.92).setStrokeStyle(1, 0x3a3128).setDepth(10);
    this.portrait = this.add.rectangle(60, H - 92, 66, 90, 0x333333).setStrokeStyle(2, 0x6a5a3a).setDepth(11);
    this.nameText = this.add.text(105, H - 150, '', { fontFamily: FONT, fontSize: '17px', color: '#ffd77a' }).setDepth(12);
    this.bodyText = this.add.text(108, H - 120, '', { fontFamily: FONT, fontSize: '18px', color: '#e8dcc0', wordWrap: { width: W - 200 }, lineSpacing: 6 }).setDepth(12);
    this.tapHint = this.add.text(W - 60, H - 34, '▼ 탭', { fontFamily: FONT, fontSize: '13px', color: '#9a8a6a' }).setOrigin(1, 0.5).setDepth(12);
    this.tweens.add({ targets: this.tapHint, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    this.trailGfx = this.add.graphics().setDepth(20);

    // 진행 입력
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', () => this.onUp());
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());

    // 시작
    this.lines = PROLOGUE;
    this.idx = 0;
    this.phase = 'prologue';
    this.render();
  }

  private current(): DialogueLine | undefined {
    return this.lines[this.idx];
  }

  private render(): void {
    const line = this.current();
    if (!line) return;
    this.clearChoices();
    this.awaitStroke = false;

    if (line.speaker) {
      this.nameText.setText(line.speaker);
      this.portrait.setFillStyle(line.portraitColor ?? 0x333333).setVisible(true);
      // 화자 위치(좌/우)
      const W = this.scale.width;
      const H = this.scale.height;
      this.portrait.x = line.side === 'right' ? W - 60 : 60;
      this.nameText.x = line.side === 'right' ? W - 105 : 105;
      this.nameText.setOrigin(line.side === 'right' ? 1 : 0, 0);
      this.bodyText.x = line.side === 'right' ? 92 : 108;
    } else {
      this.nameText.setText('');
      this.portrait.setVisible(false);
      this.bodyText.x = 40;
    }

    // 타이핑 시작
    this.full = line.text;
    this.shown = 0;
    this.typing = true;
    this.bodyText.setText('');
    this.tapHint.setVisible(false);
    this.typeEvent?.remove();
    this.typeEvent = this.time.addEvent({
      delay: 22,
      loop: true,
      callback: () => {
        this.shown++;
        this.bodyText.setText(this.full.slice(0, this.shown));
        if (this.shown >= this.full.length) {
          this.typing = false;
          this.typeEvent?.remove();
          this.onTypedComplete(line);
        }
      },
    });
  }

  private onTypedComplete(line: DialogueLine): void {
    if (line.stroke) {
      this.awaitStroke = true;
      this.tapHint.setText('▶ 검을 그어라');
      this.tapHint.setVisible(true);
    } else if (this.phase === 'style_prompt') {
      this.showStyleChoices();
    } else {
      this.tapHint.setText('▼ 탭');
      this.tapHint.setVisible(true);
    }
  }

  private advance(): void {
    const line = this.current();
    if (!line) return;
    // 타이핑 중 탭 = 즉시 완성
    if (this.typing) {
      this.typing = false;
      this.typeEvent?.remove();
      this.shown = this.full.length;
      this.bodyText.setText(this.full);
      this.onTypedComplete(line);
      return;
    }
    if (this.awaitStroke) return;         // 획 대기 중엔 탭 무시
    if (this.phase === 'style_prompt') return; // 선택 대기

    this.idx++;
    if (this.idx < this.lines.length) {
      this.render();
      return;
    }
    this.nextPhase();
  }

  private nextPhase(): void {
    if (this.phase === 'prologue') {
      this.phase = 'style_prompt';
      this.lines = [STYLE_PROMPT];
      this.idx = 0;
      this.render();
    } else if (this.phase === 'reaction') {
      this.phase = 'intro';
      this.lines = [STAGE1_INTRO];
      this.idx = 0;
      this.render();
    } else if (this.phase === 'intro') {
      this.startGame();
    }
  }

  // ── 유파 선택 ─────────────────────────────────────
  private showStyleChoices(): void {
    const W = this.scale.width;
    this.tapHint.setVisible(false);
    STYLE_CHOICES.forEach((c, i) => {
      const y = 150 + i * 78;
      const card = this.add.rectangle(W / 2, y, W * 0.62, 64, 0x1c1912, 0.95).setStrokeStyle(2, 0x6a5a3a).setDepth(30).setInteractive({ useHandCursor: true });
      const label = this.add.text(W / 2, y - 12, c.label, { fontFamily: FONT, fontSize: '19px', color: '#ffd77a' }).setOrigin(0.5).setDepth(31);
      const hint = this.add.text(W / 2, y + 14, c.hint, { fontFamily: FONT, fontSize: '13px', color: '#9ad0ff' }).setOrigin(0.5).setDepth(31);
      card.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.chooseStyle(c.lefty, c.reaction);
      });
      this.choiceUi.push(card, label, hint);
    });
  }

  private chooseStyle(lefty: boolean, reaction: DialogueLine[]): void {
    try {
      localStorage.setItem('sm.lefty.v1', lefty ? '1' : '0');
    } catch {
      /* 무시 */
    }
    this.clearChoices();
    this.phase = 'reaction';
    this.lines = reaction;
    this.idx = 0;
    this.render();
  }

  private clearChoices(): void {
    for (const o of this.choiceUi) o.destroy();
    this.choiceUi = [];
  }

  // ── 첫 획 입력 (관대 판정) ────────────────────────
  private onDown(p: Phaser.Input.Pointer): void {
    if (this.awaitStroke) {
      this.strokePts = [{ x: p.x, y: p.y, t: performance.now() }];
      return;
    }
    if (this.choiceUi.length > 0) return; // 선택 카드가 처리
    this.advance();
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.awaitStroke && p.isDown && this.strokePts.length > 0) {
      this.strokePts.push({ x: p.x, y: p.y, t: performance.now() });
    }
  }

  private onUp(): void {
    if (!this.awaitStroke || this.strokePts.length < 5) return;
    // 관대 판정: 어떤 방향이든 충분히 길게 그으면 통과
    const a = this.strokePts[0]!;
    const b = this.strokePts[this.strokePts.length - 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < this.scale.width * 0.15) {
      this.tapHint.setText('▶ 더 길게 — 화면을 가로질러');
      return;
    }
    this.awaitStroke = false;
    this.strokePts = [];
    this.trailGfx.clear();
    this.idx++;
    this.render();
  }

  private startGame(): void {
    try {
      localStorage.setItem('sm.prologue.v1', '1'); // 다음 런부터 프롤로그 스킵
    } catch {
      /* 무시 */
    }
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.time.delayedCall(430, () => this.scene.start('play'));
  }

  override update(): void {
    this.trailGfx.clear();
    if (this.awaitStroke && this.strokePts.length > 1) {
      this.trailGfx.lineStyle(4, 0xd8ecff, 0.9);
      this.trailGfx.beginPath();
      this.trailGfx.moveTo(this.strokePts[0]!.x, this.strokePts[0]!.y);
      for (const p of this.strokePts) this.trailGfx.lineTo(p.x, p.y);
      this.trailGfx.strokePath();
    }
  }
}
