// DOM/게임 계층 (T1-01: 순수부는 src/engine에서 임포트). 판정 로직은 여기 없음.
import './style.css';
import {
  BALANCE, STROKE_TEMPLATES, STYLES, ENEMIES, TRIALS, STAGES,
  judgeStroke, recognizeCommand, judgeRhythm, gradeOf, createTechniqueTracker,
  bbox, resample, otherStyle,
} from './engine';
import type { Pt, Dir, Grade, Style, StrokeEvent, CommandInput, Enemy, EnemyAttack } from './engine';

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const canvas = document.querySelector('#ink') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 0, H = 0, currentStyle: Style = STYLES.uraken;
let soundOn = true, overlayOn = true;
// 숙련은 전 획을 데이터에서 파생(하드코딩 금지). 획 추가 시 자동 반영.
const mastery: Record<string, number> = Object.fromEntries(Object.keys(STROKE_TEMPLATES).map(k => [k, 0]));

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
// 버그2 수정: 모바일 주소창 표시/숨김·회전·레이아웃 정착으로 캔버스 표시 크기가 바뀌면
// window 'resize'가 안 오는 경우가 있어 백킹스토어가 고착 → 궤적이 어긋남. 표시 크기 변화를
// 직접 관찰해 resize() 재동기화(판정 좌표는 원래 정확하므로 렌더링만 교정).
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => resize()).observe(canvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resize);
  window.visualViewport.addEventListener('scroll', resize);
}

/* ---- 오디오(T0-07): 등급별 검명 5종 ---- */
let audio: AudioContext | null = null;
const AC = () => (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
const TONE: Record<Grade, [number, OscillatorType, number]> = {
  perfect: [1320, 'triangle', .28], great: [990, 'triangle', .26],
  good: [660, 'sine', .24], bad: [330, 'sawtooth', .22], miss: [140, 'square', .30],
};
function playGrade(grade: Grade) {
  if (!soundOn) return;
  try {
    audio = audio || new (AC())();
    const [f, type, dur] = TONE[grade] || TONE.miss;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur + 0.02);
  } catch (e) { /* noop */ }
}
function haptic(grade: Grade) {
  if (!navigator.vibrate) return;
  navigator.vibrate(grade === 'perfect' ? [8, 30, 8] : grade === 'miss' ? 90 : grade === 'bad' ? 45 : 18);
}
// 메트로놈(T0-05): 목검 비트.
let metroOn = false, metroTimer: number | undefined;
function playTick() {
  try {
    audio = audio || new (AC())();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square'; o.frequency.value = 1750;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14, audio.currentTime + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.05);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.06);
  } catch (e) { /* noop */ }
}
function beatPulse() {
  const d = $('#beatDot');
  d.classList.remove('tick'); void d.offsetWidth; d.classList.add('tick');
}
function setMetro(on: boolean) {
  metroOn = on;
  clearInterval(metroTimer);
  if (audio && audio.state === 'suspended') audio.resume();  // 사용자 제스처 시 resume
  if (on) { const tick = () => { if (soundOn) playTick(); beatPulse(); }; tick(); metroTimer = setInterval(tick, BALANCE.rhythm.beatMs) as unknown as number; }
}

/* ---- 검술 트래커(T1-05) — 엔진(다중 검술 + 데미지) ---- */
let tracker = createTechniqueTracker(currentStyle);

/* ---- 렌더링: 잉크 궤적 + 비교 오버레이(T0-08) ---- */
interface Overlay { user: Pt[] | null; ideal: Pt[] | null; grade: Grade }
let liveTrail: Pt[] | null = null;
let lastOverlay: Overlay | null = null;
let overlayFade = 0;
function draw() {
  ctx.clearRect(0, 0, W, H);
  if (lastOverlay && overlayFade > 0) {
    const a = overlayFade;
    if (overlayOn && lastOverlay.ideal) {
      ctx.setLineDash([6, 7]); ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(201,168,106,${0.75 * a})`;
      strokePath(lastOverlay.ideal); ctx.setLineDash([]);
    }
    if (lastOverlay.user) {
      const col = lastOverlay.grade === 'miss' ? '156,47,38' : '230,220,195';
      ctx.lineWidth = 3.5; ctx.strokeStyle = `rgba(${col},${0.85 * a})`;
      strokePath(lastOverlay.user);
    }
    overlayFade -= 0.02;
  }
  if (trainingActive && trainGuide && trainGuide.opacity > 0) {   // 수련 시범 궤적(페이드)
    ctx.setLineDash([8, 8]); ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(201,168,106,${trainGuide.opacity})`;
    strokePath(trainGuide.ideal); ctx.setLineDash([]);
  }
  if (liveTrail && liveTrail.length > 1) {
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(230,220,195,0.92)';
    strokePath(liveTrail);
  }
  requestAnimationFrame(draw);
}
function strokePath(pts: Pt[]) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}
function idealForDisplay(strokeId: string, userPts: Pt[]): Pt[] {
  const b = bbox(userPts);
  let path = STROKE_TEMPLATES[strokeId].path.map(([x, y]) => ({ x, y }));
  if (currentStyle.mirrorX) path = path.map(p => ({ x: 1 - p.x, y: p.y }));
  return resample(path, 24).map(p => ({ x: b.minX + p.x * b.w, y: b.minY + p.y * b.h }));
}

/* ---- T0-06 InputArbiter: 채널 점유(occupancy) 모델 ---- */
const arbiter = (() => {
  let occupant: 'gesture' | 'command' | null = null, sinceT = 0;
  return {
    tryAcquire(ch: 'gesture' | 'command') {
      const now = performance.now();
      if (occupant === null || occupant === ch) { occupant = ch; sinceT = now; return true; }
      if (now - sinceT > BALANCE.arbiterStaleMs) { occupant = ch; sinceT = now; return true; }
      return false;
    },
    release(ch: 'gesture' | 'command') { if (occupant === ch) occupant = null; },
    get() { return occupant; },
  };
})();

/* ---- 씬 복귀 훅 (T2-01 노드맵): 씬을 맵에서 진입하면 종료 시 맵으로 복귀 ---- */
let mapActive = false;
let afterScene: ((success: boolean) => void) | null = null;
function runAfterScene(success: boolean) { const cb = afterScene; afterScene = null; if (cb) cb(success); }

/* ---- 통일 판정 이벤트 발행 + 반응. 규칙 #4 규격 ---- */
function emitStroke(ev: StrokeEvent, extra?: string) {
  if (mapActive) return;   // 맵 메뉴 중에는 획 입력 무시
  if (ev.grade !== 'miss') mastery[ev.strokeId] = (mastery[ev.strokeId] || 0) + gradePoints(ev.grade);
  playGrade(ev.grade); haptic(ev.grade);
  updateHud(ev, extra);
  if (combatActive) {   // T1-07 결전: 응수 창에서만 판정. 그 외엔 무시 대신 피드백(무반응/의도차단 구분). 버그4
    if (awaitingParry) combatOnParry(ev);
    else toast('관찰 중(觀察) — 응수(應手) 신호를 기다려라');
    return;
  }
  if (trialActive) { trialCtl.feed(ev); return; }         // T1-08 승급 시험으로 라우팅
  if (trainingActive) { trainingCtl.feed(ev); return; }   // T1-06 수련 모드로 라우팅
  updateTech(tracker.feed(ev));
}
function gradePoints(g: Grade) { return ({ perfect: 5, great: 3, good: 2, bad: 1, miss: 0 } as Record<Grade, number>)[g] || 0; }

/* ---- HUD ---- */
const GRADE_KO: Record<string, string> = { perfect: '퍼펙트', great: '그레이트', good: '굿', bad: '배드', miss: '미스', tap: '거부(탭)', short: '거부(짧음)', unknown: '획 불명' };
const GRADE_COL: Record<string, string> = { perfect: 'var(--gold)', great: 'var(--gold)', good: 'var(--bone)', bad: 'var(--blood)', miss: 'var(--blood)' };
function updateHud(ev: StrokeEvent, extra?: string) {
  $('#hint').style.display = 'none';
  $('#grade').textContent = GRADE_KO[ev.grade] || ev.grade;
  $('#grade').style.color = GRADE_COL[ev.grade] || 'var(--bone)';
  const modeKo = ev.inputMode === 'command' ? '劍訣' : '劍路';
  $('#accLine').textContent = `정확도 ${ev.accuracy} · ${modeKo}` + (extra ? ` · ${extra}` : '');
  $('#strokeName').textContent = STROKE_TEMPLATES[ev.strokeId] ? STROKE_TEMPLATES[ev.strokeId].name : '';
  const bd = ev.breakdown || { direction: 0, straight: 0, speed: 0, completion: 0 };
  ($('#fDir') as HTMLElement).style.width = (bd.direction * 100) + '%';
  ($('#fStr') as HTMLElement).style.width = (bd.straight * 100) + '%';
  ($('#fSpd') as HTMLElement).style.width = (bd.speed * 100) + '%';
  ($('#fCmp') as HTMLElement).style.width = (bd.completion * 100) + '%';
  const prac = Object.entries(mastery).filter(([, v]) => v > 0).map(([k, v]) => `${STROKE_TEMPLATES[k].name.replace(/\(.*\)/, '')}${v}`);
  $('#mastery').textContent = '숙련  ' + (prac.length ? prac.join(' · ') : '—');
}
function rejectHud(reason: string) {
  $('#grade').textContent = GRADE_KO[reason] || reason;
  $('#grade').style.color = 'var(--blood)';
  $('#accLine').textContent = reason === 'unknown' ? '어느 획인지 알 수 없다' : '입력이 너무 작다';
  $('#strokeName').textContent = '';
  ['#fDir', '#fStr', '#fSpd', '#fCmp'].forEach(s => ($(s) as HTMLElement).style.width = '0%');
}
type TechRes = ReturnType<ReturnType<typeof createTechniqueTracker>['feed']>;
function updateTech(res: TechRes) {
  const prog = tracker.progress();
  $('#comboSteps').innerHTML = prog.length
    ? prog.map(p => `<span class="on">${p.name} ${p.matched}/${p.total}</span>`).join(' · ')
    : '<span class="off">소드 아츠 대기</span>';
  if (res && res.type === 'success') {
    const flags = [res.perfectMult > 1 ? '위력+20%' : '', res.commandBonus ? '검결+10%' : '', res.stun ? '경직' : '', res.aoe ? '광역' : '', res.pierce ? '관통' : ''].filter(Boolean).join(' · ');
    $('#manaLine').textContent = `⚔ ${res.name}! 데미지 ${res.damage} · 평균 ${res.avg} · 마나 ${res.mana}` + (flags ? ` · ${flags}` : '');
    $('#manaLine').style.color = 'var(--gold)';
  } else if (res && res.type === 'fail') {
    $('#manaLine').textContent = `✗ ${res.name} 발동 실패! 마나 −${res.manaPenalty} · 경직 ${res.stunMs}ms`;
    $('#manaLine').style.color = 'var(--blood)';
  }
}

/* ---- T1-06 수련(修練) 씬 (DOM). 시범 궤적→페이드→소거, 굿+ 3연속 통과, 스승 대사 ---- */
const TRAIN_LIST = ['h_lr', 'diag_dr', 'v_down'];
let trainingActive = false, trainIdx = 0, trainConsec = 0, trainBusy = false;
let trainGuide: { ideal: Pt[]; opacity: number } | null = null;
const GUIDE_OPACITY = [0.9, 0.45, 0.15];
const MASTER = {
  intro: '이 획을 눈에 새겨라. 시범을 따라 그어보아라.',
  perfect: '훌륭하다. 검이 곧게 섰다.',
  good: '됐다. 몸이 기억하기 시작했다.',
  fail: '흐트러졌다. 다시, 처음부터.',
  pass: '이제 이 획은 네 것이다.',
  done: '기본기가 몸에 뱄구나. 다음 경지로 가자.',
};
function guideFor(strokeId: string): Pt[] {
  // 정사각형 상자 — 비정사각이면 사선 가이드 각도가 왜곡돼(가로 화면=얕은 사선) 따라 그으면 오분류됨. 중앙-하단 배치(상단 패널 회피).
  const sz = Math.min(W, H) * 0.5;
  const box = { x0: W / 2 - sz / 2, y0: H * 0.56 - sz / 2, w: sz, h: sz };
  return resample(STROKE_TEMPLATES[strokeId].path.map(([x, y]) => ({ x: box.x0 + x * box.w, y: box.y0 + y * box.h })), 24);
}
function setMaster(text: string, cls = '') { const m = $('#trainMaster'); m.textContent = text; m.className = cls; }
function updateTrainDots() { $('#trainDots').textContent = [0, 1, 2].map(i => i < trainConsec ? '●' : '○').join(' '); }
function loadTrainTarget() {
  const id = TRAIN_LIST[trainIdx];
  trainConsec = 0;
  trainGuide = { ideal: guideFor(id), opacity: GUIDE_OPACITY[0] };
  $('#trainTarget').textContent = `[${trainIdx + 1}/${TRAIN_LIST.length}] ${STROKE_TEMPLATES[id].name} — 굿 이상 3연속`;
  setMaster(MASTER.intro); updateTrainDots();
}
const trainingCtl = {
  feed(ev: StrokeEvent) {
    if (trainBusy) return;
    const target = TRAIN_LIST[trainIdx];
    const pass = ev.strokeId === target && (ev.grade === 'good' || ev.grade === 'great' || ev.grade === 'perfect');
    if (pass) {
      trainConsec++;
      setMaster(ev.grade === 'perfect' ? MASTER.perfect : MASTER.good, ev.grade === 'perfect' ? 'perfect' : '');
      if (trainConsec >= 3) {
        setMaster(MASTER.pass, 'perfect'); updateTrainDots();
        trainBusy = true; trainGuide = null; trainIdx++;
        setTimeout(() => { trainBusy = false; if (trainIdx >= TRAIN_LIST.length) finishTraining(); else loadTrainTarget(); }, 1000);
        return;
      }
      if (trainGuide) trainGuide.opacity = GUIDE_OPACITY[Math.min(trainConsec, 2)];   // 반복 시 페이드아웃
    } else {
      trainConsec = 0;
      setMaster(MASTER.fail, 'miss');
      trainGuide = { ideal: guideFor(target), opacity: GUIDE_OPACITY[0] };            // 미스 시 가이드 복원
    }
    updateTrainDots();
  },
};
function enterTraining() {
  trainingActive = true; trainIdx = 0; trainBusy = false;
  $('#train').classList.add('on'); $('#hint').style.display = 'none'; $('#btnTrain').classList.add('active');
  loadTrainTarget();
}
let trainDone = false;
function exitTraining() {
  trainingActive = false; trainGuide = null;
  $('#train').classList.remove('on'); $('#btnTrain').classList.remove('active');
  const s = trainDone; trainDone = false; runAfterScene(s);   // 맵 복귀(완주 여부 전달)
}
function finishTraining() {
  trainDone = true;
  setMaster(MASTER.done, 'perfect'); trainGuide = null; $('#trainTarget').textContent = '수련 완료';
  $('#trainDots').textContent = '● ● ●';
  setTimeout(exitTraining, 1800);
}

/* ---- T1-07 결전(決戰) 전투 씬 (DOM). 관찰(觀察)→응수(應手)→해소(解消) FSM ---- */
let combatActive = false, awaitingParry = false;
let cbEnemy: Enemy, cbEnemyHpMax = 0, cbEnemyHp = 0, cbPlayerHp = 0, cbMana = 0;
let cbAttack: EnemyAttack | null = null;
let cbTimer: number | undefined;
const CB = () => BALANCE.combat;
const cbTxt = (sel: string, v: string) => { $(sel).textContent = v; };
function cbBars() {
  ($('#cbEnemyHp')).style.width = Math.max(0, cbEnemyHp / cbEnemyHpMax * 100) + '%';
  ($('#cbPlayerHp')).style.width = Math.max(0, cbPlayerHp / CB().playerHp * 100) + '%';
  ($('#cbMana')).style.width = Math.max(0, cbMana / CB().manaMax * 100) + '%';
}
// 방향별 오디오 큐 — 소리만으로 응수 방향 인지 가능(FR-FBK).
const CUE_FREQ: Record<string, number> = { '→': 520, '←': 392, '↑': 720, '↓': 300 };
function playCue(dir: string) {
  if (!soundOn) return;
  try {
    audio = audio || new (AC())();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = CUE_FREQ[dir] || 440;
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.4);
  } catch (e) { /* noop */ }
}
// T2-03: 전투 3무게 — 조우(encounter, 실시간 1타)·정예(elite, 간소 합)·결전(boss, 전체 FSM)
let combatKind: 'encounter' | 'elite' | 'boss' = 'boss';
let cbRespondMs = 2200;
function enterCombat(enemyId = 'goblin', kind: 'encounter' | 'elite' | 'boss' = 'boss') {
  combatKind = kind;
  const k = CB().kinds[kind] ?? CB().kinds.boss;
  cbEnemy = ENEMIES[enemyId];
  cbEnemyHpMax = Math.max(1, Math.round(cbEnemy.hp * (k.hpMul ?? 1))); cbEnemyHp = cbEnemyHpMax;
  cbPlayerHp = CB().playerHp; cbMana = CB().startMana;
  cbRespondMs = k.respondMs ?? CB().respondMs;
  combatActive = true; awaitingParry = false; combatResult = 'quit';   // 중도이탈 기본
  $('#combat').classList.add('on'); $('#hint').style.display = 'none'; $('#btnCombat').classList.add('active');
  cbTxt('#cbEnemyName', cbEnemy.name); cbBars();
  if (kind === 'encounter') {
    cbTxt('#cbLog', '조우(遭遇) — 적이 급습한다! 예고 방향으로 즉시 일섬(一閃)하라');
    cbTimer = setTimeout(cbEncounter, 600) as unknown as number;
  } else {
    cbTxt('#cbLog', (kind === 'elite' ? '정예전(精銳) 시작' : '결전(決戰) 시작') + ' — 적의 예고를 보고 응수하라 (소리로도 방향 인지 가능)');
    cbTimer = setTimeout(cbObserve, 700) as unknown as number;
  }
}
// 조우전: 실시간 1타. 예고 후 즉시 응수 창(觀察 없음). 정타=섬광 일격, 빗나감=스침(저스테이크 돌파).
function cbEncounter() {
  cbAttack = cbEnemy.attacks[Math.floor(Math.random() * cbEnemy.attacks.length)];
  cbTxt('#cbPhase', '일섬(一閃) — 지금!');
  cbTxt('#cbTele', `적 급습! ${cbAttack.name} ${cbAttack.dir} — 섬광 응수: ${cbAttack.counterName}`);
  playCue(cbAttack.dir);
  awaitingParry = true;
  if (soundOn) playTick();
  const win = CB().kinds.encounter.windowMs ?? cbRespondMs;
  cbTimer = setTimeout(() => combatOnParry(null), win) as unknown as number;
}
function cbEncounterResolve(ev: StrokeEvent | null) {
  const a = cbAttack!;
  const ok = !!ev && ev.strokeId === a.counter && (ev.grade === 'good' || ev.grade === 'great' || ev.grade === 'perfect');
  cbEnemyHp = 0; cbBars();
  cbTxt('#cbPhase', ok ? '섬광(閃光)' : '스침(掠)');
  if (ok) cbTxt('#cbLog', `⚡ 섬광 일격! ${a.counterName}(${ev!.grade}) — 적을 단칼에 베고 지나쳤다`);
  else { const what = ev ? (STROKE_TEMPLATES[ev.strokeId]?.name ?? ev.strokeId) : '무입력'; cbTxt('#cbLog', `✗ 빗나갔다(${what}) — ${a.name}에 스쳤으나 돌파했다`); }
  combatWon = true; combatResult = 'win';   // 조우는 돌파(노드 완료)
  cbTimer = setTimeout(exitCombat, 1400) as unknown as number;
}
let combatWon = false, combatResult: 'win' | 'lose' | 'quit' = 'quit';
function exitCombat() {
  combatActive = false; awaitingParry = false; clearTimeout(cbTimer);
  $('#combat').classList.remove('on'); $('#btnCombat').classList.remove('active');
  const s = combatWon; combatWon = false; runAfterScene(s);   // 맵 복귀(승리 여부 전달)
}
function cbNextHap() {
  if (cbEnemyHp <= 0) return cbEnd(true);
  if (cbPlayerHp <= 0) return cbEnd(false);
  cbObserve();
}
function cbObserve() {
  cbAttack = cbEnemy.attacks[Math.floor(Math.random() * cbEnemy.attacks.length)];
  cbTxt('#cbPhase', '관찰(觀察)');
  cbTxt('#cbTele', `적: ${cbAttack.name} ${cbAttack.dir} — 응수: ${cbAttack.counterName}`);
  playCue(cbAttack.dir);
  cbTimer = setTimeout(cbRespond, CB().observeMs) as unknown as number;
}
function cbRespond() {
  cbTxt('#cbPhase', '응수(應手) — 지금!');
  awaitingParry = true;
  if (soundOn) playTick();  // "지금" 신호
  cbTimer = setTimeout(() => combatOnParry(null), cbRespondMs) as unknown as number;
}
function combatOnParry(ev: StrokeEvent | null) {
  if (!awaitingParry) return;
  awaitingParry = false; clearTimeout(cbTimer);
  if (combatKind === 'encounter') { cbEncounterResolve(ev); return; }
  const a = cbAttack!;
  const ok = !!ev && ev.strokeId === a.counter && (ev.grade === 'good' || ev.grade === 'great' || ev.grade === 'perfect');
  cbTxt('#cbPhase', '해소(解消)');
  if (ok) {
    const dmg = CB().parryDamage[ev!.grade as 'good' | 'great' | 'perfect'];
    cbEnemyHp -= dmg;
    cbMana = Math.min(CB().manaMax, cbMana + (ev!.grade === 'perfect' ? CB().manaRecoverPerfect : CB().manaRecoverHit));
    cbTxt('#cbLog', `⚔ 반격! ${a.counterName}(${ev!.grade}) · 적 HP −${dmg}` + (ev!.grade === 'perfect' ? ' · 마나 회복+' : ''));
  } else {
    cbPlayerHp -= a.damage;
    const what = ev ? (STROKE_TEMPLATES[ev.strokeId]?.name ?? ev.strokeId) : '무입력';
    cbTxt('#cbLog', `✗ 응수 실패! ${a.name} 피격 · 내 HP −${a.damage} (${what})`);
  }
  cbBars();
  cbTimer = setTimeout(cbNextHap, 950) as unknown as number;
}
function cbEnd(win: boolean) {
  combatWon = win; combatResult = win ? 'win' : 'lose';
  cbTxt('#cbPhase', win ? '승리(勝)' : '패배(敗)');
  cbTxt('#cbLog', win ? '적을 쓰러뜨렸다! 결전에서 살아남았다.' : '쓰러졌다… 체크포인트에서 다시.');
  awaitingParry = false;
  setTimeout(exitCombat, 2200);
}
$('#btnCombat').addEventListener('click', () => { combatActive ? exitCombat() : enterCombat(); });
$('#cbExit').addEventListener('click', exitCombat);

/* ---- T1-08 승급 시험(昇級) 씬 (DOM). 마나 각성: 4획 연속(≤2s)·평균70+·미스 즉시중단 ---- */
const CUR_TRIAL = 'mana_awakening';
let trialActive = false, trialIdx = 0, trialBusy = false;
let trialAccs: { id: string; acc: number }[] = [];
let trialTimer: number | undefined;
const trialSpec = () => TRIALS[CUR_TRIAL];
function setTrialMaster(s: string, cls = '') { const m = $('#trialMaster'); m.textContent = s; m.className = cls; }
function renderTrialSteps() {
  const t = trialSpec();
  $('#trialSteps').innerHTML = t.strokes.map((id, i) => {
    const cls = i < trialIdx ? 'done' : (i === trialIdx ? 'cur' : 'off');
    return `<span class="tstep ${cls}">${STROKE_TEMPLATES[id].name.replace(/\(.*\)/, '')}</span>`;
  }).join(' → ');
}
function enterTrial() {
  const t = trialSpec();
  trialActive = true; trialIdx = 0; trialAccs = []; trialBusy = false;
  $('#trial').classList.add('on'); $('#hint').style.display = 'none'; $('#btnTrial').classList.add('active');
  $('#trialRetry').style.display = 'none';
  $('#trialTitle').textContent = `${t.name} 시험 — 4획 연속(획 간 ≤${t.intervalMs / 1000}초), 평균 ${t.avgPass}+ · 미스 즉시 중단`;
  setTrialMaster('시작하라. 첫 획부터, 끊김 없이.'); renderTrialSteps();
}
let trialPassed = false;
function exitTrial() { trialActive = false; clearTimeout(trialTimer); $('#trial').classList.remove('on'); $('#btnTrial').classList.remove('active'); const s = trialPassed; trialPassed = false; runAfterScene(s); }
function trialFailTimeout() { if (trialActive && !trialBusy) trialFail('시간 초과 — 흐름이 끊겼다', undefined); }
const trialCtl = {
  feed(ev: StrokeEvent) {
    if (trialBusy) return;
    clearTimeout(trialTimer);
    const t = trialSpec(); const target = t.strokes[trialIdx];
    if (ev.grade === 'miss') return trialFail('미스 — 즉시 중단', undefined);
    if (ev.strokeId !== target) return trialFail(`획이 어긋났다 (${STROKE_TEMPLATES[ev.strokeId]?.name ?? ev.strokeId})`, undefined);
    trialAccs.push({ id: target, acc: ev.accuracy }); trialIdx++; renderTrialSteps();
    if (trialIdx >= t.strokes.length) {
      const avg = Math.round(trialAccs.reduce((s, a) => s + a.acc, 0) / trialAccs.length);
      if (avg >= t.avgPass) return trialPass(avg);
      return trialFail(null, avg);
    }
    setTrialMaster(`좋다 (${ev.accuracy}). 이어라.`);
    trialTimer = setTimeout(trialFailTimeout, t.intervalMs) as unknown as number;
  },
};
function trialFail(reason: string | null, avg?: number) {
  trialBusy = true; clearTimeout(trialTimer);
  const weakest = trialAccs.length ? trialAccs.reduce((m, a) => a.acc < m.acc ? a : m) : null;
  let msg = avg !== undefined ? `불합격 — 평균 ${avg} (기준 ${trialSpec().avgPass} 미달). ` : `불합격 — ${reason}. `;
  if (weakest) msg += `${STROKE_TEMPLATES[weakest.id].name.replace(/\(.*\)/, '')} 획이 아직 흐리다.`;
  setTrialMaster(msg, 'miss');
  $('#trialRetry').style.display = 'inline-block';
}
function trialPass(avg: number) {
  trialBusy = true; trialPassed = true; clearTimeout(trialTimer);
  setTrialMaster(`합격! 평균 ${avg}. 마나가 깨어났다 — 이제 검에 기(氣)를 싣는다.`, 'perfect');
  $('#trialRetry').style.display = 'none';
  setTimeout(exitTrial, 2800);
}
$('#btnTrial').addEventListener('click', () => { trialActive ? exitTrial() : enterTrial(); });
$('#trialRetry').addEventListener('click', enterTrial);
$('#trialExit').addEventListener('click', exitTrial);

/* ---- T2-01 노드 맵 + 스테이지 (DOM). 맵→노드→씬→복귀 순환 ---- */
const STAGE = STAGES.stage1;
let mapCurrent = STAGE.start;
const mapVisited = new Set<string>([STAGE.start]);
const NODE_ICON: Record<string, string> = { battle: '⚔', training: '✎', event: '❈', shop: '₩', rest: '☾' };

/* ---- T2-02 저장(localStorage): 노드 완료 이어하기 + 구역 체크포인트(패배 복귀) ---- */
const SAVE_KEY = 'sm_save_v1', SAVE_VERSION = 1;
let checkpoint: { current: string; visited: string[] } = { current: STAGE.start, visited: [STAGE.start] };
let checkpointZone = STAGE.nodes[STAGE.start].zone;
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, stage: 'stage1', current: mapCurrent, visited: [...mapVisited], checkpoint, checkpointZone })); } catch (_) { /* noop */ }
}
function loadGame(): boolean {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && s.version === SAVE_VERSION && s.stage === 'stage1' && STAGE.nodes[s.current]) {
      mapCurrent = s.current; mapVisited.clear();
      (s.visited || []).forEach((v: string) => { if (STAGE.nodes[v]) mapVisited.add(v); });
      if (s.checkpoint && STAGE.nodes[s.checkpoint.current]) { checkpoint = s.checkpoint; checkpointZone = s.checkpointZone ?? STAGE.nodes[s.checkpoint.current].zone; }
      return true;
    }
  } catch (_) { /* noop */ }
  return false;
}
function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* noop */ }
  mapCurrent = STAGE.start; mapVisited.clear(); mapVisited.add(STAGE.start);
  checkpoint = { current: STAGE.start, visited: [STAGE.start] }; checkpointZone = STAGE.nodes[STAGE.start].zone;
  saveGame(); renderMap();
}
// 구역 진입 시 체크포인트 갱신(패배 복귀 지점). 노드 완료(진행) 시 자동저장.
function advanceTo(id: string) {
  mapVisited.add(id); mapCurrent = id;
  const zone = STAGE.nodes[id].zone;
  if (zone !== checkpointZone) { checkpointZone = zone; checkpoint = { current: id, visited: [...mapVisited] }; }
  saveGame();
}
function restoreCheckpoint() {
  mapCurrent = checkpoint.current; mapVisited.clear(); checkpoint.visited.forEach(v => mapVisited.add(v)); saveGame();
}

function enterMap() {
  mapActive = true; $('#map').classList.add('on'); $('#hint').style.display = 'none'; $('#btnMap').classList.add('active');
  $('#mapTitle').textContent = STAGE.name;
  renderMap();
}
function exitMap() { mapActive = false; $('#map').classList.remove('on'); $('#btnMap').classList.remove('active'); }
function renderMap() {
  const nodes = STAGE.nodes;
  const cur = nodes[mapCurrent];
  const avail = new Set(cur.next);
  const maxCol = Math.max(...Object.values(nodes).map(n => n.col));
  let grid = '';
  for (let c = 0; c <= maxCol; c++) {
    const col = Object.entries(nodes).filter(([, n]) => n.col === c);
    grid += '<div class="mapcol">' + col.map(([id, n]) => {
      const state = id === mapCurrent ? 'cur' : (mapVisited.has(id) ? 'done' : (avail.has(id) ? 'avail' : 'lock'));
      const dis = state === 'avail' ? '' : 'disabled';
      return `<button class="mapnode t-${n.type} ${state}" data-id="${id}" ${dis}><span class="ic">${NODE_ICON[n.type]}</span>${n.label}</button>`;
    }).join('') + '</div>';
  }
  const cleared = mapVisited.has('boss');
  $('#mapBody').innerHTML = `<div id="mapGrid">${grid}</div>`;
  $('#mapHint').textContent = cleared ? '⚑ 스테이지 1 관문장을 넘었다 — 데모 구간 완료!' : `다음 노드를 선택하라 · 현재 구역: ${cur.zone}`;
  $('#mapBody').querySelectorAll('.mapnode.avail').forEach(b => b.addEventListener('click', () => selectNode((b as HTMLElement).dataset.id!)));
}
function selectNode(id: string) {
  const n = STAGE.nodes[id];
  if (n.type === 'event' || n.type === 'shop' || n.type === 'rest') {
    // 간이 노드: 맵 유지, 메시지 후 완료(대화/상점은 T2-05/T2-04)
    const note = n.type === 'rest' ? '기력을 회복했다.' : (n.type === 'shop' ? '행상을 만났다 (상점은 T2-04).' : '사건이 벌어졌다 (대화는 T2-05).');
    $('#mapHint').textContent = `${NODE_ICON[n.type]} ${n.label} — ${note}`;
    advanceTo(id);                       // 진행 + 자동저장
    setTimeout(renderMap, 850);
    return;
  }
  if (n.type === 'battle') {
    // 전투: 승리=진행, 패배=구역 시작 복귀(체크포인트), 중도이탈=현상 유지.
    afterScene = () => {
      if (combatResult === 'win') advanceTo(id);
      else if (combatResult === 'lose') restoreCheckpoint();
      enterMap();
    };
    const kind = (n.battleKind === 'encounter' || n.battleKind === 'elite') ? n.battleKind : 'boss';
    exitMap(); enterCombat('goblin', kind);   // T2-03: 조우/정예/결전 무게 구분
    return;
  }
  if (n.type === 'training') {
    afterScene = (success) => { if (success) advanceTo(id); enterMap(); };
    exitMap(); enterTraining();
  }
}
$('#btnMap').addEventListener('click', () => { mapActive ? exitMap() : enterMap(); });
$('#mapExit').addEventListener('click', exitMap);
let resetArm = false, resetTimer: number | undefined;
$('#mapReset').addEventListener('click', () => {
  const b = $('#mapReset');
  if (!resetArm) { resetArm = true; b.textContent = '정말? 다시 탭'; clearTimeout(resetTimer); resetTimer = setTimeout(() => { resetArm = false; b.textContent = '처음부터'; }, 2500) as unknown as number; return; }
  resetArm = false; clearTimeout(resetTimer); b.textContent = '처음부터'; resetGame();
});
loadGame();   // T2-02: 부팅 시 이어하기 로드(맵 열면 저장 진행 반영)

/* ---- 검로(劍路) 입력: Pointer Events. T0-02 ---- */
let drawing = false, points: Pt[] = [], t0 = 0, gRect: DOMRect | null = null;
const relX = (e: PointerEvent) => e.clientX - gRect!.left, relY = (e: PointerEvent) => e.clientY - gRect!.top;
canvas.addEventListener('pointerdown', e => {
  if (!arbiter.tryAcquire('gesture')) return;
  gRect = canvas.getBoundingClientRect();
  drawing = true; t0 = performance.now();
  points = [{ x: relX(e), y: relY(e), t: 0 }];
  liveTrail = points; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
});
canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  points.push({ x: relX(e), y: relY(e), t: performance.now() - t0 });
});
function endStroke() {
  if (!drawing) return; drawing = false;
  arbiter.release('gesture');
  const pts = points; liveTrail = null;
  const res = judgeStroke(pts, { w: W, h: H }, currentStyle);
  if (pts.length >= 2) {   // [임시 진단 버그3] 순각도(net angle) 표시 — 검증 후 자가진단으로 이동
    const a = pts[0], b = pts[pts.length - 1];
    const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);
    $('#angDiag').textContent = `[진단] 순각도 ${ang}° → ${res.rejected ? (res.reason ?? '?') : STROKE_TEMPLATES[res.strokeId!].name}`;
  }
  if (res.rejected) { rejectHud(res.reason!); if (pts.length > 1) { lastOverlay = { user: resample(pts, 40), ideal: null, grade: 'miss' }; overlayFade = 1; } return; }
  lastOverlay = { user: resample(pts, 40), ideal: idealForDisplay(res.strokeId!, pts), grade: res.grade! };
  overlayFade = 1;
  emitStroke({ strokeId: res.strokeId!, accuracy: res.accuracy!, grade: res.grade!, inputMode: 'gesture', timestamp: performance.now(), breakdown: res.breakdown });
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);

/* ---- T0-04 검결(劍訣) CommandCapture ---- */
const cmdBuf: CommandInput[] = [];
let cmdTimer: number | undefined;
function pushCommandInput(dir: Dir) {
  const now = performance.now();
  while (cmdBuf.length && now - cmdBuf[0].t > BALANCE.commandWindow) cmdBuf.shift();
  // InputArbiter v2: 아직 안 그린(점만 찍힌) 제스처는 커맨드가 선점(취소). 빠른 응수에서 의도 입력 드롭 방지.
  if (cmdBuf.length === 0 && arbiter.get() === 'gesture' && drawing && points.length <= 1) {
    arbiter.release('gesture'); drawing = false; liveTrail = null;
  }
  if (cmdBuf.length === 0 && !arbiter.tryAcquire('command')) return;
  cmdBuf.push({ dir, t: now });
  flashKey(dir);
  clearTimeout(cmdTimer);
  const snapshot = cmdBuf.map(i => ({ dir: i.dir, t: i.t }));
  if (recognizeCommand(snapshot, BALANCE.simulMs, currentStyle)) { resolveCommand(); return; }
  cmdTimer = setTimeout(resolveCommand, BALANCE.commandResolveMs) as unknown as number;
}
function resolveCommand() {
  if (!cmdBuf.length) return;
  const inputs = cmdBuf.map(i => ({ dir: i.dir, t: i.t }));
  const seqLabel = inputs.map(i => DIR_GLYPH[i.dir] || i.dir).join('');
  const rec = recognizeCommand(inputs, BALANCE.simulMs, currentStyle);
  cmdBuf.length = 0;
  arbiter.release('command');
  if (!rec) { toast(`검결 불명 (${seqLabel})`); rejectHud('unknown'); return; }
  const rj = judgeRhythm(inputs, rec.strokeId, currentStyle);
  toast(`${STROKE_TEMPLATES[rec.strokeId].name} ◂ ${seqLabel}  오차 ${rj.maxErr}ms` + (rj.powerBonus ? ' · 위력+10%' : ''));
  const cx = W / 2, cy = H / 2, s = Math.min(W, H) * 0.32;
  const ideal = STROKE_TEMPLATES[rec.strokeId].path.map(([x, y]) => ({ x: cx + (x - .5) * s, y: cy + (y - .5) * s }));
  if (currentStyle.mirrorX) ideal.forEach(p => p.x = 2 * cx - p.x);
  lastOverlay = { user: null, ideal, grade: rj.grade };
  overlayFade = 1;
  const timing01 = Math.max(0, 1 - (rj.maxErr || 0) / BALANCE.rhythm.windows.bad);
  emitStroke({
    strokeId: rec.strokeId, accuracy: rj.accuracy, grade: rj.grade, inputMode: 'command', timestamp: performance.now(),
    breakdown: { direction: 1, straight: 1, speed: timing01, completion: 1 }, powerBonus: rj.powerBonus,
  }, `타이밍오차 ${rj.maxErr}ms` + (rj.powerBonus ? ' · 다입력 위력+10%' : ''));
}
const DIR_GLYPH: Record<Dir, string> = { L: '←', R: '→', U: '↑', D: '↓', UL: '↖', UR: '↗', DL: '↙', DR: '↘' };

// (a) 키보드
const pressed = new Set<Dir>();
const KEYMAP: Record<string, Dir> = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D', a: 'L', d: 'R', w: 'U', s: 'D' };
window.addEventListener('keydown', e => {
  const dir = KEYMAP[e.key];
  if (!dir || e.repeat || pressed.has(dir)) return;
  pressed.add(dir); pushCommandInput(dir);
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => { const dir = KEYMAP[e.key]; if (dir) pressed.delete(dir); });

// (b) 가상 방향 패드
const PAD_LEFT: Dir[] = ['UL', 'L', 'DL'];
const PAD_RIGHT: Dir[] = ['UR', 'R', 'DR'];
function buildPad() {
  const pad = $('#pad'); pad.innerHTML = '';
  const upSide = currentStyle.updownCluster;
  pad.appendChild(makeCluster(clusterCells(PAD_LEFT, upSide === 'left')));
  pad.appendChild(makeCluster(clusterCells(PAD_RIGHT, upSide === 'right')));
}
function clusterCells(diag: Dir[], withUpDown: boolean): Record<string, Dir> {
  const cells: Record<string, Dir> = {};
  if (diag[0] === 'UL') cells['0,0'] = 'UL'; if (diag[0] === 'UR') cells['0,2'] = 'UR';
  if (diag[1] === 'L') cells['1,0'] = 'L'; if (diag[1] === 'R') cells['1,2'] = 'R';
  if (diag[2] === 'DL') cells['2,0'] = 'DL'; if (diag[2] === 'DR') cells['2,2'] = 'DR';
  if (withUpDown) { cells['0,1'] = 'U'; cells['2,1'] = 'D'; }
  return cells;
}
function makeCluster(cells: Record<string, Dir>) {
  const el = document.createElement('div'); el.className = 'cluster';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const dir = cells[r + ',' + c];
    const k = document.createElement('div');
    k.className = 'key' + (dir ? '' : ' empty');
    if (dir) {
      k.textContent = DIR_GLYPH[dir]; k.dataset.dir = dir;
      k.addEventListener('pointerdown', ev => { ev.preventDefault(); pushCommandInput(dir); });
    }
    el.appendChild(k);
  }
  return el;
}
function flashKey(dir: Dir) {
  const k = document.querySelector(`.key[data-dir="${dir}"]`);
  if (k) { k.classList.add('hit'); setTimeout(() => k.classList.remove('hit'), 130); }
}
let toastTimer: number | undefined;
function toast(msg: string) {
  const t = $('#cmdToast'); t.textContent = msg; t.style.opacity = '1';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.style.opacity = '0', 1400) as unknown as number;
}

/* ---- 컨트롤 ---- */
$('#btnSound').addEventListener('click', e => { soundOn = !soundOn; const b = e.target as HTMLElement; b.classList.toggle('active', soundOn); b.textContent = '소리 ' + (soundOn ? 'ON' : 'OFF'); });
$('#btnOverlay').addEventListener('click', e => { overlayOn = !overlayOn; const b = e.target as HTMLElement; b.classList.toggle('active', overlayOn); b.textContent = '오버레이 ' + (overlayOn ? 'ON' : 'OFF'); });
$('#btnStyle').addEventListener('click', e => {
  currentStyle = otherStyle(currentStyle);   // StyleManager (T1-04)
  tracker = createTechniqueTracker(currentStyle);
  (e.target as HTMLElement).textContent = '유파: ' + currentStyle.name; buildPad();
});
$('#btnMetro').addEventListener('click', e => {
  setMetro(!metroOn); const b = e.target as HTMLElement;
  b.classList.toggle('active', metroOn); b.textContent = '메트로놈 ' + (metroOn ? 'ON' : 'OFF');
});
$('#btnTrain').addEventListener('click', () => { trainingActive ? exitTraining() : enterTraining(); });
$('#trainExit').addEventListener('click', exitTraining);
$('#btnDiag').addEventListener('click', e => {
  const d = $('#diag'); const show = d.style.display !== 'block';
  d.style.display = show ? 'block' : 'none'; (e.target as HTMLElement).classList.toggle('active', show);
  if (show) runSelfTest();
});

/* ---- 자가진단(엔진 회귀 스모크): 화면 패널 + 콘솔 ---- */
function runSelfTest() {
  const META = { w: 800, h: 450 };
  const line = (from: number[], to: number[], n: number, dur: number, jit = 0): Pt[] => {
    const o: Pt[] = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1); o.push({ x: from[0] + (to[0] - from[0]) * u + (jit ? Math.sin(u * Math.PI * 6) * jit : 0), y: from[1] + (to[1] - from[1]) * u + (jit ? Math.cos(u * Math.PI * 6) * jit : 0), t: dur * u }); }
    return o;
  };
  const T: { name: string; ok: boolean; extra?: string }[] = [];
  const add = (name: string, ok: boolean, extra?: string) => T.push({ name, ok, extra });
  let r;
  r = judgeStroke(line([100, 225], [700, 225], 40, 300), META); add('반듯 횡베기 = 그레이트+', !r.rejected && r.strokeId === 'h_lr' && r.accuracy! >= 85, `${r.grade} ${r.accuracy}`);
  r = judgeStroke(line([100, 225], [700, 225], 60, 300, 80), META); add('흔들림 = 배드', !r.rejected && r.accuracy! >= 50 && r.accuracy! <= 69, `${r.grade} ${r.accuracy}`);
  r = judgeStroke(line([700, 225], [100, 225], 40, 300), META); add('우→좌 = 횡베기(우→좌)', !r.rejected && r.strokeId === 'h_rl', r.strokeId);
  r = judgeStroke(line([650, 60], [150, 400], 40, 320), META); add('사선↙ = diag_dl', !r.rejected && r.strokeId === 'diag_dl', r.strokeId);
  r = judgeStroke(line([400, 420], [400, 40], 40, 320), META); add('올려베기 = v_up', !r.rejected && r.strokeId === 'v_up', r.strokeId);
  r = judgeStroke(line([400, 225], [520, 225], 20, 150), META); add('찌르기(짧고 빠름) = thrust', !r.rejected && r.strokeId === 'thrust', r.strokeId);
  { const cir: {x:number;y:number;t:number}[] = []; for (let i = 0; i < 44; i++) { const u = i / 43, th = u * 2 * Math.PI; cir.push({ x: 400 + 170 * Math.sin(th), y: 225 - 170 * Math.cos(th), t: 1000 * u }); } const x = judgeStroke(cir, META); add('원무(시계) = wonmu 그레이트+', !x.rejected && x.strokeId === 'wonmu' && (x.accuracy || 0) >= 85, `${x.strokeId} ${x.accuracy}`); }
  r = judgeStroke([{ x: 400, y: 225, t: 0 }, { x: 402, y: 226, t: 10 }], META); add('탭 = 거부', r.rejected && r.reason === 'tap', r.reason);
  r = judgeStroke(line([340, 225], [540, 225], 30, 220), META); add('작은 획 = 비율 인정', !r.rejected && r.strokeId === 'h_lr', `${r.grade} ${r.accuracy}`);
  r = judgeStroke(line([150, 60], [650, 400], 40, 320), META); add('사선 = diag_dr', !r.rejected && r.strokeId === 'diag_dr', String(r.accuracy));
  r = judgeStroke(line([400, 40], [400, 420], 40, 320), META); add('내려찍기 = v_down', !r.rejected && r.strokeId === 'v_down', String(r.accuracy));
  add('검결 ←→ = 횡베기', recognizeCommand([{ dir: 'L', t: 0 }, { dir: 'R', t: 180 }], BALANCE.simulMs)?.strokeId === 'h_lr');
  add('검결 ↓+→ 동시 = 사선', recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'R', t: 25 }], BALANCE.simulMs)?.strokeId === 'diag_dr');
  add('검결 패드 ↘ 단일 = 사선', recognizeCommand([{ dir: 'DR', t: 0 }], BALANCE.simulMs)?.strokeId === 'diag_dr');
  add('검결 ↑↓ = 내려찍기', recognizeCommand([{ dir: 'U', t: 0 }, { dir: 'D', t: 150 }], BALANCE.simulMs)?.strokeId === 'v_down');
  add('검결 ↓후→(순차) ≠ 사선', recognizeCommand([{ dir: 'D', t: 0 }, { dir: 'R', t: 300 }], BALANCE.simulMs) === null);
  add('좌수: 우→좌 제스처=횡베기', (() => { const x = judgeStroke(line([700, 225], [100, 225], 40, 300), META, STYLES.saken); return !x.rejected && x.strokeId === 'h_lr'; })());
  add('좌수: 검결 →← = 횡베기', recognizeCommand([{ dir: 'R', t: 0 }, { dir: 'L', t: 180 }], BALANCE.simulMs, STYLES.saken)?.strokeId === 'h_lr');
  add('리듬 ←0 →400 = 퍼펙트+보너스', (() => { const x = judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 400 }], 'h_lr'); return x.grade === 'perfect' && !!x.powerBonus; })());
  add('리듬 오차70 = 그레이트', judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 470 }], 'h_lr').grade === 'great');
  add('리듬 오차220 = 배드', judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 180 }], 'h_lr').grade === 'bad');
  add('리듬 오차350 = 미스', judgeRhythm([{ dir: 'L', t: 0 }, { dir: 'R', t: 50 }], 'h_lr').grade === 'miss');
  add('리듬 동시사선 오차30 = 퍼펙트', judgeRhythm([{ dir: 'D', t: 0 }, { dir: 'R', t: 30 }], 'diag_dr').grade === 'perfect');
  add('리듬 패드↘ 단일 = 퍼펙트·보너스無', (() => { const x = judgeRhythm([{ dir: 'DR', t: 0 }], 'diag_dr'); return x.grade === 'perfect' && !x.powerBonus; })());
  const mir = (pts: Pt[]) => pts.map(p => ({ x: META.w - p.x, y: p.y, t: p.t }));
  const parity = (pts: Pt[], id: string) => { const u = judgeStroke(pts, META, STYLES.uraken), s = judgeStroke(mir(pts), META, STYLES.saken); return !u.rejected && !s.rejected && u.strokeId === id && s.strokeId === id && Math.abs(u.accuracy! - s.accuracy!) <= 1; };
  add('좌수 품질동등: 횡베기 반듯', parity(line([100, 225], [700, 225], 40, 300), 'h_lr'));
  add('좌수 품질동등: 횡베기 흔들림', parity(line([100, 225], [700, 225], 60, 300, 60), 'h_lr'));
  add('좌수 품질동등: 내려찍기', parity(line([400, 40], [400, 420], 40, 320), 'v_down'));
  add('좌수 ↑↓ 클러스터=좌측', STYLES.saken.updownCluster === 'left' && STYLES.uraken.updownCluster === 'right');
  const passed = T.filter(t => t.ok).length;
  $('#diag').innerHTML = `<h4>자가진단 ${passed}/${T.length} 통과</h4>` +
    T.map(t => `<div class="${t.ok ? 'pass' : 'fail'}">${t.ok ? '✓' : '✗'} ${t.name}${t.extra != null ? ' · ' + t.extra : ''}</div>`).join('');
  console.log(`[소드마스터 자가진단] ${passed}/${T.length} 통과`);
}

/* ---- 부트 ---- */
resize(); buildPad(); draw(); updateTech(null); runSelfTest();
