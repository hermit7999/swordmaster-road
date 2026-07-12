// 임시 합성 SFX (WebAudio) — 에셋 없이 타격감 피드백 제공.
// PRS-05(M-E)에서 정식 사운드로 교체. "같은 소리 반복 금지" — 피치 변주 적용.
export class Sfx {
  private ctx: AudioContext | null = null;
  private lastPitch = 1;

  /** 첫 사용자 입력에서 호출 (브라우저 AudioContext 게이트). */
  unlock(): void {
    if (!this.ctx) {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private vary(): number {
    // 결정론 불필요(연출) — 직전과 다른 피치
    let p = 0.9 + Math.random() * 0.25;
    if (Math.abs(p - this.lastPitch) < 0.05) p += 0.08;
    this.lastPitch = p;
    return p;
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'bandpass'): void {
    const c = this.ctx;
    if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq * this.vary();
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0): void {
    const c = this.ctx;
    if (!c) return;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * this.vary(), c.currentTime);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + dur);
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  }

  /** 휘두름 (검풍). */
  swing(): void {
    this.noise(0.12, 0.15, 1800, 'highpass');
  }

  /** 명중 — 등급 배율로 무게 차등. */
  hit(mul = 1): void {
    this.noise(0.08, 0.3 * mul, 900);
    this.tone(140, 0.09, 0.25 * mul, 'square', -60);
  }

  /** 허공 (빗나감) — 약한 스윕만. */
  whiff(): void {
    this.noise(0.09, 0.06, 2400, 'highpass');
  }

  /** 가드/막힘 — 둔탁한 금속. */
  guard(): void {
    this.tone(220, 0.12, 0.25, 'square', -80);
    this.noise(0.06, 0.12, 500);
  }

  /** 패링 — 맑은 금속 핑 (가장 공들일 소리). */
  parry(): void {
    this.tone(1320, 0.28, 0.3, 'triangle', -200);
    this.tone(1980, 0.18, 0.15, 'sine', -300);
  }

  /** 피격 (플레이어). */
  hurt(): void {
    this.tone(90, 0.18, 0.35, 'sawtooth', -40);
  }

  /** 그로기/브레이크 — 균열음. */
  crack(): void {
    this.noise(0.25, 0.35, 400, 'lowpass');
    this.tone(70, 0.25, 0.3, 'square', -30);
  }

  /** 처치. */
  kill(): void {
    this.noise(0.3, 0.3, 700);
    this.tone(55, 0.35, 0.35, 'square', -25);
  }

  /** 검기 발출. */
  kiWave(): void {
    this.tone(880, 0.3, 0.25, 'sawtooth', 400);
    this.noise(0.25, 0.2, 1500, 'highpass');
  }

  /** 오의 성립. */
  secretArt(): void {
    this.tone(660, 0.15, 0.3, 'triangle');
    this.tone(990, 0.25, 0.25, 'triangle', 200);
  }

  /** 햅틱 진동 (모바일 — 프로토타입 haptic 이식). iOS Safari는 미지원(무시됨). */
  haptic(pattern: number | number[]): void {
    try {
      (navigator as { vibrate?: (p: number | number[]) => void }).vibrate?.(pattern);
    } catch {
      /* 미지원 무시 */
    }
  }
}
