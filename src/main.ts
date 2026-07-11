// DOM/게임 계층 (T1-01: 순수부는 src/engine에서 임포트). 판정 로직은 여기 없음.
import './style.css';
import {
  BALANCE, STROKE_TEMPLATES, STYLES, ENEMIES, TRIALS, STAGES,
  CONSUMABLES, SWORDS, ITEMS, STORY,
  judgeStroke, recognizeCommand, judgeRhythm, gradeOf, createTechniqueTracker,
  bbox, resample, levelFromXp, xpToNext, derivedStats, freeAttackDamage,
  isGuarded, comboMultiplier,
} from './engine';
import type { Dialogue, DlgLine } from './engine';
import type { Pt, Dir, Grade, Style, StrokeEvent, CommandInput, Enemy, EnemyAttack } from './engine';
import { loadArt, setSceneBg, artUrl, tuneArt, artTuneState, repaintSceneBg } from './art';

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const canvas = document.querySelector('#ink') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 0, H = 0, currentStyle: Style = STYLES.uraken, currentStyleId = 'uraken';
let soundOn = true, overlayOn = true;
// T2-07 설정(전역, 저장과 별도 키). 판정난이도=전투 응수창 배율, 대화속도=자동진행 배율, 가상키크기=패드 스케일.
let hapticOn = true, difficultyEase = 1, dlgSpeedMul = 1;
const SETTINGS_KEY = 'sm_settings_v1';
const settings: { sound: boolean; haptic: boolean; difficulty: string; dlgSpeed: string; padSize: string } =
  { sound: true, haptic: true, difficulty: 'standard', dlgSpeed: 'normal', padSize: 'normal' };
function applySettings() {
  soundOn = settings.sound; hapticOn = settings.haptic;
  difficultyEase = BALANCE.difficultyEase[settings.difficulty] ?? 1;
  dlgSpeedMul = BALANCE.dialogueSpeed[settings.dlgSpeed] ?? 1;
  document.documentElement.style.setProperty('--pad-scale', String(BALANCE.padScale[settings.padSize] ?? 1));
  const bs = document.querySelector('#btnSound'); if (bs) { bs.classList.toggle('active', soundOn); bs.textContent = '소리 ' + (soundOn ? 'ON' : 'OFF'); }
}
function loadSettings() { try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (s) Object.assign(settings, s); } catch (_) { /* noop */ } applySettings(); }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* noop */ } }
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
  if (!hapticOn || !navigator.vibrate) return;
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
  if (arcadeActive) {
    const now = performance.now(); let real = acPrevT ? now - acPrevT : 16; acPrevT = now;
    real = Math.min(real, 50);
    acFxTick(real); acUpdate(real * acTimeScale); drawArcade();
  }
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
  if (arcadeActive) { acAttack(ev); return; }             // 횡스크롤 아케이드 — 필드 베기
  if (moActive) { momentumOnStroke(ev, pendingHeavy); return; }   // 재설계 스파이크(momentum FSM)
  if (spikeActive) { spikeOnStroke(ev); return; }         // 전투(3층 루프)로 라우팅
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
  setSceneBg('bg_training');
  loadTrainTarget();
}
let trainDone = false;
function exitTraining() {
  trainingActive = false; trainGuide = null;
  $('#train').classList.remove('on'); $('#btnTrain').classList.remove('active'); setSceneBg(null);
  const s = trainDone; trainDone = false; runAfterScene(s);   // 맵 복귀(완주 여부 전달)
}
function finishTraining() {
  trainDone = true;
  setMaster(MASTER.done, 'perfect'); trainGuide = null; $('#trainTarget').textContent = '수련 완료';
  $('#trainDots').textContent = '● ● ●';
  setTimeout(exitTraining, 1800);
}

/* ---- 방향별 오디오 큐(FR-FBK) — 소리만으로 예고 방향 인지. 전투 루프에서 사용 ---- */
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
// (구 결전 FSM 제거 — 전투는 아래 3층 루프로 일원화. 결전 버튼은 자유연습용 정예 진입)
$('#btnCombat').addEventListener('click', () => { spikeActive ? exitSpike() : enterSpike('goblin', 'elite'); });

/* ==== 전투(3층 루프): 자유공격 + 콤보 + 방어 + 타격감. 조우/정예/결전 공통(종류별 파라미터).
   시간 감속(슬로모)은 보스 시그니처(일섬) 전용 연출. 지도 전투 노드가 이 루프로 진입. ==== */
let spikeActive = false, spikeParryOpen = false, spikeStaggered = false, spikeSlowMo = false;
let spEnemy: Enemy, spEnemyId = 'wolf';
let spikeKind: 'encounter' | 'elite' | 'boss' = 'elite';
let spEnemyHpMax = 0, spEnemyHp = 0, spPlayerHp = 0, spPlayerHpMax = 60, spMana = 0;
let spAttack: EnemyAttack | null = null, spAttackIsSig = false;
let spAtkTimer: number | undefined, spWinTimer: number | undefined, spStaggerTimer: number | undefined;
let spikeResult: 'win' | 'lose' | 'quit' = 'quit';
let feelShakeMul = 1, feelHitstopMul = 1;   // 자가진단 슬라이더 튜닝
// 판정 코어(자세/콤보/그로기/회피)
let pendingFlick: 'L' | 'R' | null = null;
let pendingHeavy = false;   // 강공격(차지=긴 획) 판정 — momentum 모드에서 사용
let spGuard: string[] = [], spGuardTimer: number | undefined;
let spCombo = 0, spGroggy = 0, spGroggyBroken = false, spGroggyTimer: number | undefined, spGroggyDecayTimer: number | undefined;
let spInvulnUntil = 0;
let spPressure = 0, spPressureTimer: number | undefined;   // 내 압박 → 적 반격 빈도↑
const SP = () => BALANCE.spike;
const SPK = () => SP().kinds[spikeKind] ?? SP().kinds.elite;
const JD = () => BALANCE.spike.judge;
const FEEL = () => BALANCE.feel;
type SpArt = Extract<NonNullable<TechRes>, { type: 'success' }>;

function spBars() {
  ($('#spEnemyHp')).style.width = Math.max(0, spEnemyHp / spEnemyHpMax * 100) + '%';
  ($('#spPlayerHp')).style.width = Math.max(0, spPlayerHp / spPlayerHpMax * 100) + '%';
  ($('#spMana')).style.width = Math.max(0, spMana / SP().manaMax * 100) + '%';
  const g = document.querySelector('#spGroggyFill') as HTMLElement | null;
  if (g) g.style.width = Math.max(0, Math.min(100, spGroggy / JD().groggyMax * 100)) + '%';
}
// 자세(가드)는 UI가 아니라 적 몸으로 — 막는 쪽(무기 든 방향)이 붉게 발광. 붕괴 중엔 전방향 오픈(금빛).
function renderGuard() {
  const el = $('#spEnemyArt');
  el.classList.remove('gR', 'gL', 'gH', 'gD', 'gBroken');
  if (spGroggyBroken) { el.classList.add('gBroken'); return; }
  const g = spGuard;
  if (g.includes('→')) el.classList.add('gR');
  else if (g.includes('←')) el.classList.add('gL');
  else if (g.includes('↑')) el.classList.add('gH');
  else if (g.includes('↓')) el.classList.add('gD');
}
function shiftGuard() {
  if (!spikeActive) return;
  const pats = spEnemy.guardPatterns;
  if (pats && pats.length) spGuard = pats[Math.floor(Math.random() * pats.length)];
  else spGuard = [];
  renderGuard();
  const d = JD().guardShiftMinMs + Math.random() * (JD().guardShiftMaxMs - JD().guardShiftMinMs);
  clearTimeout(spGuardTimer); spGuardTimer = setTimeout(shiftGuard, d) as unknown as number;
}
function enterSpike(enemyId = 'wolf', kind: 'encounter' | 'elite' | 'boss' = 'elite') {
  spEnemyId = ENEMIES[enemyId] ? enemyId : 'wolf'; spEnemy = ENEMIES[spEnemyId]; spikeKind = kind;
  spEnemyHpMax = Math.max(1, Math.round(spEnemy.hp * SPK().hpMul)); spEnemyHp = spEnemyHpMax;
  spPlayerHpMax = playerStats().hpMax; spPlayerHp = spPlayerHpMax; spMana = SP().startMana;
  spikeActive = true; spikeParryOpen = false; spikeStaggered = false; spikeSlowMo = false; spikeResult = 'quit';
  spCombo = 0; spGroggy = 0; spGroggyBroken = false; spInvulnUntil = 0; spPressure = 0; pendingFlick = null;
  tracker = createTechniqueTracker(currentStyle);   // 콤보 초기화
  $('#spike').classList.add('on'); $('#app').classList.add('spike-open'); $('#hint').style.display = 'none';
  $('#diag').style.display = 'none';
  $('#spEnemyName').textContent = spEnemy.name; spBars(); renderSpItems(); renderCombo();
  $('#spLog').textContent = kind === 'boss' ? '결전(決戰) — 열린 방향으로 베고, 노란 예고는 쳐내고 빨간 예고는 좌우로 플릭 회피'
    : kind === 'elite' ? '정예전(精銳) — 적 자세의 열린 방향을 베라. 노랑=쳐내기 / 빨강=플릭 회피'
    : '조우(遭遇) — 열린 방향으로 그어 베어라. 예고 뜨면 쳐내거나(노랑) 플릭 회피(빨강)';
  $('#spTele').classList.remove('on', 'sig', 'red'); $('#spEnemyArt').classList.remove('teleY', 'teleR'); $('#spTele').textContent = '';
  setSceneBg(kind === 'boss' ? 'bg_bossgate' : 'bg_forest', true);
  const art = $('#spEnemyArt'); art.style.backgroundImage = ''; art.classList.remove('stagger', 'hit');
  const img = spEnemy.image || 'enemy_wolf';
  loadArt(img).then(i => { if (i && spikeActive) art.style.backgroundImage = `url("${artUrl(img)}")`; });
  shiftGuard();            // 자세 시작 + 주기적 변경
  spGroggyDecay();         // 붕괴 게이지 자연 감소 루프
  spPressureDecay();       // 압박 감소 루프
  scheduleEnemy();
}
function exitSpike() {
  if (!spikeActive && !$('#spike').classList.contains('on')) return;
  spikeActive = false; spikeParryOpen = false; endSlowMo();
  clearTimeout(spAtkTimer); clearTimeout(spWinTimer); clearTimeout(spStaggerTimer);
  clearTimeout(spGuardTimer); clearTimeout(spGroggyTimer); clearTimeout(spGroggyDecayTimer);
  $('#spike').classList.remove('on', 'groggy'); $('#app').classList.remove('spike-open'); setSceneBg(null);
  runAfterScene(spikeResult === 'win');   // 지도 복귀 — afterScene이 spikeResult(win/lose/quit)로 분기
}
function scheduleEnemy() {
  if (!spikeActive) return;
  clearTimeout(spAtkTimer);
  const p = Math.min(JD().pressureMax, spPressure) / JD().pressureMax;   // 0..1
  const reduce = 1 - p * JD().pressureFreqReduce;                        // 압박↑ → 간격↓ → 반격/패링 기회↑
  const d = (SPK().atkMinMs + Math.random() * (SPK().atkMaxMs - SPK().atkMinMs)) * reduce;
  spAtkTimer = setTimeout(enemyTelegraph, d) as unknown as number;
}
function pickEnemyAttack(): EnemyAttack {
  const e = spEnemy;
  if (spikeKind === 'boss' && e.signature && e.signatureWeight && Math.random() < e.signatureWeight) {
    return e.attacks.find(a => a.signature) ?? e.attacks[0];
  }
  const pool = (spikeKind === 'boss' && e.signature) ? e.attacks.filter(a => !a.signature) : e.attacks;
  const use = pool.length ? pool : e.attacks;
  return use[Math.floor(Math.random() * use.length)];
}
function enemyTelegraph() {
  if (!spikeActive) return;
  if (spikeStaggered) { scheduleEnemy(); return; }
  const a = pickEnemyAttack(); spAttack = a;
  spAttackIsSig = !!(a.signature && spikeKind === 'boss' && spEnemy.signature);
  const red = a.type === 'red';
  playCue(a.dir); if (soundOn) playTick();
  spikeParryOpen = true;
  const art = $('#spEnemyArt'); art.classList.remove('teleY', 'teleR');
  $('#spTele').classList.remove('sig', 'red');
  if (spAttackIsSig) {   // 보스 필살(一閃): 그 순간만 세계가 느려진다 (노란 예고=쳐내기)
    startSlowMo(); art.classList.add('teleY');
    $('#spTele').textContent = `⚡ 一閃 — ${a.dir} 쳐내라! (${a.counterName})`;
    $('#spTele').classList.add('on', 'sig');
    spWinTimer = setTimeout(enemyLands, SP().slowMo.windowMs) as unknown as number;
  } else if (red) {      // 빨강 발광: 방어 불가 — 좌우 플릭 회피만
    art.classList.add('teleR');
    $('#spTele').textContent = `⚠ ${a.dir} ${a.name} — 좌우로 플릭 회피!`;
    $('#spTele').classList.add('on', 'red');
    spWinTimer = setTimeout(enemyLands, SPK().windowMs) as unknown as number;
  } else {               // 노랑 발광: 쳐내기(카운터 획)
    art.classList.add('teleY');
    $('#spTele').textContent = `${a.dir}  ${a.name} — 쳐내라! (${a.counterName})`;
    $('#spTele').classList.add('on');
    spWinTimer = setTimeout(enemyLands, SPK().windowMs) as unknown as number;
  }
}
function enemyLands() {   // 창 만료 = 방어 실패
  spikeParryOpen = false; endSlowMo(); $('#spTele').classList.remove('on', 'sig', 'red'); $('#spEnemyArt').classList.remove('teleY', 'teleR');
  const a = spAttack!; $('#spLog').textContent = `✗ ${a.name}에 당했다`;
  spTakeHit(a);
}
// 방어: 노랑=쳐내기(카운터 획), 빨강=좌우 플릭 회피. 성공 시 그로기↑·반격 기회.
function spDefend(ev: StrokeEvent) {
  const a = spAttack!;
  clearTimeout(spWinTimer); spikeParryOpen = false; endSlowMo(); $('#spTele').classList.remove('on', 'sig', 'red'); $('#spEnemyArt').classList.remove('teleY', 'teleR');
  if (a.type === 'red') {
    if (pendingFlick) return spDodge();
    $('#spLog').textContent = `✗ 막을 수 없다 — ${a.name}`; spTakeHit(a); return;
  }
  const ok = ev.strokeId === a.counter && (ev.grade === 'good' || ev.grade === 'great' || ev.grade === 'perfect');
  if (ok) {
    spMana = Math.min(SP().manaMax, spMana + SP().parryManaGain); addGroggy(JD().groggyPerParry); spBars();
    $('#spLog').textContent = `⚔ 쳐냈다! ${a.counterName}(${ev.grade}) — 그로기↑ · 지금 베어라` + (spAttackIsSig ? ' (一閃 간파!)' : '');
    spStagger(); feelHit(spAttackIsSig ? 'art' : 'great', spAttackIsSig);
  } else {
    $('#spLog').textContent = `✗ 헛쳤다 — ${a.name} 피격`; spTakeHit(a);
  }
}
function spDodge() {
  spInvulnUntil = performance.now() + JD().dodgeInvulnMs;
  addGroggy(JD().groggyPerDodge); spBars();
  $('#spLog').textContent = '↯ 스텝 회피! 무적 순간 — 반격 기회';
  const app = $('#app'); app.classList.remove('dodgeL', 'dodgeR'); void app.offsetWidth;
  app.classList.add(pendingFlick === 'R' ? 'dodgeR' : 'dodgeL');
  setTimeout(() => app.classList.remove('dodgeL', 'dodgeR'), 380);
  haptic('good'); scheduleEnemy();
}
function spTakeHit(a: EnemyAttack) {
  if (performance.now() < spInvulnUntil) { $('#spLog').textContent = '↯ 무적 — 무피해'; scheduleEnemy(); return; }
  spPlayerHp -= a.damage; spCombo = 0; renderCombo(); spBars();
  feelShake(FEEL().shakeArtPx); playerHurtFx(); haptic('miss');
  if (spPlayerHp <= 0) return spEnd(false);
  scheduleEnemy();
}
function spStagger() {
  spikeStaggered = true;
  const el = $('#spEnemyArt'); el.classList.remove('stagger'); void el.offsetWidth; el.classList.add('stagger');
  clearTimeout(spStaggerTimer);
  spStaggerTimer = setTimeout(() => { spikeStaggered = false; if (spikeActive) scheduleEnemy(); }, SP().staggerMs) as unknown as number;
}
function spikeOnStroke(ev: StrokeEvent) {
  if (spikeParryOpen) { spDefend(ev); pendingFlick = null; return; }            // 방어 창
  const tech = tracker.feed(ev); updateTech(tech);                              // 자유 공격(콤보 추적)
  if (tech && tech.type === 'success') { spikeArtHit(tech); pendingFlick = null; return; }
  spikeBasicHit(ev); pendingFlick = null;
}
function spikeBasicHit(ev: StrokeEvent) {
  if (ev.grade === 'miss') { $('#spLog').textContent = '✗ 헛손질'; return; }
  addPressure();
  if (!spGroggyBroken && isGuarded(ev.strokeId, spGuard)) { spBlocked(ev); return; }   // 막힌 방향 → 가드에 막힘(전진)
  const dmg = applyHitBonus(freeAttackDamage(ev.grade) + playerStats().power);
  spEnemyHp -= dmg; spCombo++; addGroggy(JD().groggyPerHit); renderCombo(); spBars();
  const nm = STROKE_TEMPLATES[ev.strokeId]?.name ?? ev.strokeId;
  $('#spLog').textContent = `⚔ ${nm}(${ev.grade}) · 적 −${dmg}${comboTag()}`;
  feelHit(ev.grade, false); dmgPopup(dmg, ev.grade);
  if (spEnemyHp <= 0) spEnd(true);
}
function spikeArtHit(tech: SpArt) {   // 아츠는 가드 관통(강타)
  addPressure();
  const dmg = applyHitBonus(tech.damage + playerStats().power);
  spEnemyHp -= dmg; spMana = Math.max(0, spMana - Math.round(tech.mana)); spCombo++; addGroggy(JD().groggyPerHit); renderCombo(); spBars();
  $('#spLog').textContent = `⚔⚔ ${tech.name}! 적 −${dmg}${comboTag()}`;
  feelHit('art', true); dmgPopup(dmg, 'art');
  if (spEnemyHp <= 0) spEnd(true);
}
// 주도권 반전: 막혀도 경직·콤보리셋 없음. 데미지만 0이고 붕괴 게이지는 오른다 — 계속 몰아붙이면 가드가 부서진다.
function spBlocked(ev: StrokeEvent) {
  addGroggy(JD().groggyPerBlock);
  const nm = STROKE_TEMPLATES[ev.strokeId]?.name ?? ev.strokeId;
  $('#spLog').textContent = `막혔다(${nm}) — 계속 몰아붙여 가드를 부숴라`;
  const el = $('#spEnemyArt'); el.classList.remove('blocked'); void el.offsetWidth; el.classList.add('blocked');
  feelShake(Math.round(FEEL().shakeHitPx * 0.55)); playBlock(); haptic('bad');
}
function addPressure() { spPressure = Math.min(JD().pressureMax, spPressure + JD().pressurePerAttack); }
function spPressureDecay() {
  clearTimeout(spPressureTimer);
  spPressureTimer = setTimeout(() => {
    if (spikeActive && spPressure > 0) spPressure = Math.max(0, spPressure - JD().pressureDecayPerSec);
    if (spikeActive) spPressureDecay();
  }, 1000) as unknown as number;
}
function applyHitBonus(dmg: number): number {
  let m = comboMultiplier(spCombo + 1, JD().comboStep, JD().comboMax);
  if (spGroggyBroken) m *= JD().groggyDamageMul;
  else if (spikeStaggered) m *= SP().staggerCounterMul;
  return Math.max(1, Math.round(dmg * m));
}
function comboTag(): string { return spCombo >= 2 ? ` ×${spCombo}` : (spGroggyBroken ? ' 그로기!' : ''); }
function renderCombo() { const el = document.querySelector('#spCombo'); if (el) el.textContent = spCombo >= 2 ? `연타 ×${spCombo}` : ''; }
// 그로기 게이지: 정타/쳐내기/회피로 축적 → 만충 시 자세 붕괴(전방향 오픈·강타 창).
function addGroggy(n: number) {
  if (spGroggyBroken) return;
  spGroggy = Math.min(JD().groggyMax, spGroggy + n); spBars();
  if (spGroggy >= JD().groggyMax) spGroggyBreak();
}
function spGroggyBreak() {
  spGroggyBroken = true; spGroggy = JD().groggyMax; spBars();
  $('#spike').classList.add('groggy'); renderGuard();
  $('#spLog').textContent = '★ 자세 붕괴 — 지금! 전방향 난무!';
  if (soundOn) playGroggySignal();
  clearTimeout(spGroggyTimer);
  spGroggyTimer = setTimeout(spGroggyReset, JD().groggyWindowMs) as unknown as number;
}
function spGroggyReset() {
  spGroggyBroken = false; spGroggy = 0; spBars();
  $('#spike').classList.remove('groggy'); renderGuard();
}
function spGroggyDecay() {
  clearTimeout(spGroggyDecayTimer);
  spGroggyDecayTimer = setTimeout(() => {
    if (spikeActive && !spGroggyBroken && spGroggy > 0) { spGroggy = Math.max(0, spGroggy - JD().groggyDecayPerSec); spBars(); }
    if (spikeActive) spGroggyDecay();
  }, 1000) as unknown as number;
}
function spEnd(win: boolean) {
  if (!spikeActive) return;                 // 이미 종료 처리됨(추가 획 중복 방지)
  spikeActive = false;                       // 이후 획은 스파이크로 라우팅되지 않음(중복 spEnd·보상 방지)
  spikeParryOpen = false; endSlowMo();
  clearTimeout(spAtkTimer); clearTimeout(spWinTimer); clearTimeout(spStaggerTimer);
  clearTimeout(spGuardTimer); clearTimeout(spGroggyTimer); clearTimeout(spGroggyDecayTimer); clearTimeout(spPressureTimer);
  $('#spTele').classList.remove('on', 'sig', 'red'); $('#spEnemyArt').classList.remove('teleY', 'teleR', 'gR', 'gL', 'gH', 'gD', 'gBroken');
  spikeResult = win ? 'win' : 'lose';
  if (win) { spFinish(grantReward(spikeKind)); }
  else { $('#spLog').textContent = '쓰러졌다… 체크포인트에서 다시.'; setTimeout(() => exitSpike(), 1900); }
}
// 처치 쾌감 체인(문서 순서): 히트스톱→흔들림→검기→적 날아감→슬로우→일섬 피니시.
function spFinish(rewardText: string) {
  const art = $('#spEnemyArt');
  $('#spLog').textContent = `⚑ 쓰러뜨렸다! · ${rewardText}`;
  feelShake(Math.round(FEEL().shakeArtPx * 1.6));   // 흔들림(강)
  playSlashFx();                                     // 검기
  playHit(true); startSlowMo();                      // 타격음 + 슬로우
  setTimeout(() => art.classList.add('knockout'), 130);   // 적 날아감
  setTimeout(() => { $('#spFinish').classList.add('on'); playHit(true); haptic('perfect'); }, 470);  // 일섬 피니시(암전→한 획→산화)
  setTimeout(() => { $('#spFinish').classList.remove('on'); art.classList.remove('knockout'); endSlowMo(); }, 1700);
  setTimeout(() => exitSpike(), 2300);
}
function playSlashFx() {
  const fx = $('#spSlashFx'); fx.classList.remove('play'); void fx.offsetWidth; fx.classList.add('play');
  setTimeout(() => fx.classList.remove('play'), 380);
}
function startSlowMo() {
  spikeSlowMo = true; $('#app').classList.add('slowmo');
  const bg = document.querySelector('#sceneBg') as HTMLElement | null;
  if (bg) bg.style.filter = 'saturate(.4) brightness(.72) contrast(1.08)';   // 인라인 필터 오버라이드
}
function endSlowMo() {
  if (!spikeSlowMo) return;
  spikeSlowMo = false; $('#app').classList.remove('slowmo');
  repaintSceneBg();   // 배경 필터 원복
}
// 아이템(실시간, 언제든 사용) — 회복/기력/응수창 연장
function renderSpItems() {
  const box = document.querySelector('#spItems'); if (!box) return;
  const owned = Object.keys(CONSUMABLES).filter(id => (inventory[id] ?? 0) > 0);
  box.innerHTML = owned.map(id => `<button class="spItem" data-item="${id}">${CONSUMABLES[id].name} ×${inventory[id]}</button>`).join('');
  box.querySelectorAll('.spItem').forEach(b => b.addEventListener('click', () => spUseItem((b as HTMLElement).dataset.item!)));
}
function spUseItem(id: string) {
  if (!spikeActive || (inventory[id] ?? 0) <= 0) return;
  const it = CONSUMABLES[id]; if (!it) return;
  inventory[id]--;
  if (it.effect === 'heal') { spPlayerHp = Math.min(spPlayerHpMax, spPlayerHp + (it.value ?? 0)); $('#spLog').textContent = `${it.name} · HP +${it.value}`; }
  else if (it.effect === 'mana') { spMana = Math.min(SP().manaMax, spMana + (it.value ?? 0)); $('#spLog').textContent = `${it.name} · 마나 +${it.value}`; }
  else if (it.effect === 'slow') { if (spikeParryOpen && spWinTimer) { clearTimeout(spWinTimer); spWinTimer = setTimeout(enemyLands, it.value ?? 0) as unknown as number; } $('#spLog').textContent = `${it.name} · 응수 창 연장`; }
  spBars(); renderSpItems(); saveGame();
}
// ---- 타격감(feel) ----
function feelShake(px: number) {
  const app = $('#app'); app.style.setProperty('--shake-px', (px * feelShakeMul) + 'px'); app.style.setProperty('--shake-ms', FEEL().shakeMs + 'ms');
  app.classList.remove('shaking'); void app.offsetWidth; app.classList.add('shaking');
  setTimeout(() => app.classList.remove('shaking'), FEEL().shakeMs);
}
function feelHit(grade: string, isArt: boolean) {
  const art = $('#spEnemyArt'), sp = $('#spSplash');
  art.style.setProperty('--flash-ms', FEEL().flashMs + 'ms');
  art.classList.remove('hit'); sp.classList.remove('play'); void art.offsetWidth;
  art.classList.add('hit'); sp.classList.add('play');
  feelShake(isArt ? FEEL().shakeArtPx : FEEL().shakeHitPx);
  playHit(isArt);
  const base = isArt ? FEEL().hitstop.art : ((FEEL().hitstop as Record<string, number>)[grade] ?? 0);
  const ms = Math.round(base * feelHitstopMul);
  if (ms > 0) { art.style.transition = 'none'; art.classList.add('hitstop'); setTimeout(() => { art.style.transition = ''; art.classList.remove('hitstop'); }, ms); }
}
function dmgPopup(n: number, grade: string) {
  const box = $('#spPopups'); const el = document.createElement('div'); el.className = 'dmgPop';
  const col: Record<string, string> = { good: 'var(--bone)', great: 'var(--gold)', perfect: 'var(--gold)', art: '#ff6a3d', bad: '#b98a6a' };
  el.style.color = col[grade] || 'var(--bone)';
  el.style.setProperty('--pop-ms', FEEL().popupMs + 'ms');
  el.textContent = grade === 'art' ? `${n}!` : String(n);
  const ar = $('#spEnemyArt').getBoundingClientRect();
  el.style.left = (ar.left + ar.width * (0.35 + Math.random() * 0.3)) + 'px';
  el.style.top = (ar.top + ar.height * (0.3 + Math.random() * 0.2)) + 'px';
  box.appendChild(el);
  setTimeout(() => el.remove(), FEEL().popupMs + 60);
}
function playHit(isArt: boolean) {
  if (!soundOn) return;
  try {
    audio = audio || new (AC())();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(isArt ? 165 : 115, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(48, audio.currentTime + 0.12);
    g.gain.setValueAtTime(isArt ? 0.5 : 0.32, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (isArt ? 0.22 : 0.14));
    o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.24);
  } catch (e) { /* noop */ }
}
// 튕김 "챙!" — 고음 금속성 짧은 소리
function playBlock() {
  if (!soundOn) return;
  try {
    audio = audio || new (AC())();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1400, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(700, audio.currentTime + 0.08);
    g.gain.setValueAtTime(0.28, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
    o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.14);
  } catch (e) { /* noop */ }
}
// 그로기 "지금!" — 낮게 울리는 신호
function playGroggySignal() {
  if (!soundOn) return;
  try {
    audio = audio || new (AC())();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(90, audio.currentTime);
    o.frequency.linearRampToValueAtTime(220, audio.currentTime + 0.25);
    g.gain.setValueAtTime(0.0001, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.5);
    o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.52);
  } catch (e) { /* noop */ }
}
// 피격 붉은 비네트 연출(연출 청크에서 확장 예정)
function playerHurtFx() {
  const app = $('#app'); app.classList.remove('hurt'); void app.offsetWidth; app.classList.add('hurt');
  setTimeout(() => app.classList.remove('hurt'), 320);
}
$('#spExit').addEventListener('click', exitSpike);

/* ==== 재설계 스파이크 1 — 공격권(攻擊權) 쟁탈 momentum FSM. 신규·병행(기존 combat 불변).
   3상태(대치/내공세/적공세) + 행동 5종. 판정 엔진·아츠·플릭·연출 재사용. 자가진단 진입. ==== */
let moActive = false;
let moState: 'standoff' | 'mine' | 'enemy' = 'standoff';
let moEnemy: Enemy, moEnemyHpMax = 0, moEnemyHp = 0, moPlayerHp = 0, moPlayerHpMax = 60;
let moMomentum = 0, moCharge = 0, moGuard = 0, moGroggy = 0, moCombo = 0, moBroken = false;
let moAttack: EnemyAttack | null = null, moAttackRed = false, moParryOpen = false;
let moInvulnUntil = 0, moCounterUntil = 0;
let moSeizeTimer: number | undefined, moWinTimer: number | undefined, moDrainTimer: number | undefined, moGuardShiftTimer: number | undefined, moGroggyTimer: number | undefined;
let moGuardDirs: string[] = [];
const MO = () => BALANCE.momentum;

function moBars() {
  ($('#moEnemyHp')).style.width = Math.max(0, moEnemyHp / moEnemyHpMax * 100) + '%';
  ($('#moPlayerHp')).style.width = Math.max(0, moPlayerHp / moPlayerHpMax * 100) + '%';
  ($('#moMomFill')).style.width = Math.max(0, moMomentum / MO().momentumMax * 100) + '%';
  ($('#moKikiFill')).style.width = Math.max(0, moCharge / MO().chargeMax * 100) + '%';
}
function moRenderGuard() {   // 가드 방향 = 적 몸 발광(대치 중에만). 붕괴=금빛.
  const el = $('#moArt'); el.classList.remove('gR', 'gL', 'gH', 'gD', 'gBroken');
  if (moBroken) { el.classList.add('gBroken'); return; }
  if (moState !== 'standoff') return;
  const g = moGuardDirs;
  if (g.includes('→')) el.classList.add('gR'); else if (g.includes('←')) el.classList.add('gL');
  else if (g.includes('↑')) el.classList.add('gH'); else if (g.includes('↓')) el.classList.add('gD');
}
function moShiftGuard() {
  if (!moActive) return;
  const pats = moEnemy.guardPatterns;
  moGuardDirs = pats && pats.length ? pats[Math.floor(Math.random() * pats.length)] : [];
  moRenderGuard();
  clearTimeout(moGuardShiftTimer);
  moGuardShiftTimer = setTimeout(moShiftGuard, 2600 + Math.random() * 1800) as unknown as number;
}
function enterMomentum() {
  moEnemy = ENEMIES['swordsman'];
  moEnemyHpMax = Math.round(moEnemy.hp * MO().enemyHpMul); moEnemyHp = moEnemyHpMax;
  moPlayerHpMax = playerStats().hpMax; moPlayerHp = moPlayerHpMax;
  moMomentum = 0; moCharge = 0; moGuard = 0; moGroggy = 0; moCombo = 0; moBroken = false; moParryOpen = false;
  moInvulnUntil = 0; moCounterUntil = 0; moActive = true;
  tracker = createTechniqueTracker(currentStyle);
  $('#momentum').classList.add('on'); $('#app').classList.add('spike-open'); $('#hint').style.display = 'none';
  $('#diag').style.display = 'none';
  $('#moEnemyName').textContent = moEnemy.name; moBars();
  setSceneBg('bg_forest', true);
  const art = $('#moArt'); art.style.backgroundImage = ''; art.classList.remove('teleY', 'teleR', 'knockout');
  loadArt(moEnemy.image || 'enemy_swordsman').then(i => { if (i && moActive) art.style.backgroundImage = `url("${artUrl(moEnemy.image || 'enemy_swordsman')}")`; });
  moSetState('standoff');
  moShiftGuard();
  moDrainLoop();
}
function exitMomentum() {
  if (!moActive && !$('#momentum').classList.contains('on')) return;
  moActive = false; moParryOpen = false;
  [moSeizeTimer, moWinTimer, moDrainTimer, moGuardShiftTimer, moGroggyTimer].forEach(t => clearTimeout(t));
  endSlowMo();
  $('#momentum').classList.remove('on'); $('#app').classList.remove('spike-open', 'moMine', 'moEnemy'); setSceneBg(null);
}
function moSetState(s: 'standoff' | 'mine' | 'enemy') {
  moState = s;
  const app = $('#app'); app.classList.remove('moMine', 'moEnemy');
  clearTimeout(moSeizeTimer); clearTimeout(moWinTimer); moParryOpen = false;
  $('#moArt').classList.remove('teleY', 'teleR');
  $('#moStateLbl').textContent = s === 'mine' ? '내 공세(攻)' : s === 'enemy' ? '적 공세(守)' : '대치(對峙)';
  if (s === 'mine') {
    app.classList.add('moMine'); moMomentum = MO().momentumMax; if (!spikeSlowMo) startSlowMo();
    $('#moLog').textContent = '내 공세! 마음껏 베어라 — 콤보·검기 충전 (미스 주의)';
    moRenderGuard();
  } else if (s === 'enemy') {
    app.classList.add('moEnemy'); endSlowMo();
    moTelegraph();
  } else {   // standoff
    endSlowMo(); moRenderGuard();
    $('#moLog').textContent = '대치 — 베어 가드를 깎거나(강공격=관통), 적 반격을 노려라';
    const d = MO().seizeMinMs + Math.random() * (MO().seizeMaxMs - MO().seizeMinMs);
    moSeizeTimer = setTimeout(() => { if (moActive && moState === 'standoff') moSetState('enemy'); }, d) as unknown as number;
  }
  moBars();
}
function moTelegraph() {
  if (!moActive) return;
  const a = moEnemy.attacks[Math.floor(Math.random() * moEnemy.attacks.length)];
  moAttack = a; moAttackRed = a.type === 'red'; moParryOpen = true;
  const art = $('#moArt'); art.classList.remove('teleY', 'teleR'); art.classList.add(moAttackRed ? 'teleR' : 'teleY');
  playCue(a.dir); if (soundOn) playTick();
  $('#moLog').textContent = moAttackRed ? `⚠ ${a.name} — 좌우로 플릭 회피!` : `${a.name} — 쳐내라(패링)!`;
  moWinTimer = setTimeout(moLands, MO().windowMs) as unknown as number;
}
function moLands() {
  moParryOpen = false; $('#moArt').classList.remove('teleY', 'teleR');
  const a = moAttack!;
  if (performance.now() < moInvulnUntil) { moSetState('standoff'); return; }
  moPlayerHp -= a.damage; moCombo = 0; moBars(); feelShake(FEEL().shakeArtPx); playerHurtFx(); haptic('miss');
  $('#moLog').textContent = `✗ ${a.name} 피격 — 공격권 뺏김`;
  if (moPlayerHp <= 0) return moEnd(false);
  moSetState('standoff');
}
function momentumOnStroke(ev: StrokeEvent, heavy: boolean) {
  if (moParryOpen) { moDefend(ev); pendingFlick = null; return; }        // 적 공세: 방어
  if (moState === 'mine') { moOffenseHit(ev, heavy); pendingFlick = null; return; }  // 내 공세: 난타
  moPoke(ev, heavy); pendingFlick = null;                                // 대치: 가드 깎기
}
// 대치: 가드 게이지를 깎는다. 열린 방향/강공격이 더 깎음. 부서지면 공격권 획득(내 공세).
function moPoke(ev: StrokeEvent, heavy: boolean) {
  if (ev.grade === 'miss') { $('#moLog').textContent = '✗ 헛손질'; return; }
  const open = !isGuarded(ev.strokeId, moGuardDirs);
  let chip = heavy ? MO().guardHeavyChip : MO().guardPokeChip;
  if (!open && !heavy) chip = Math.round(chip * 0.5);   // 막힌 방향 평타는 절반(그래도 전진)
  moGuard = Math.min(MO().guardMax, moGuard + chip);
  const nm = STROKE_TEMPLATES[ev.strokeId]?.name ?? ev.strokeId;
  $('#moLog').textContent = `${heavy ? '강공격' : '평타'} ${nm} — 가드 ${Math.round(moGuard)}${!open && !heavy ? ' (막힘)' : ''}`;
  const el = $('#moArt'); el.classList.remove('blocked'); void el.offsetWidth; el.classList.add('blocked');
  feelShake(Math.round(FEEL().shakeHitPx * (heavy ? 0.9 : 0.5))); playBlock(); moPopup(Math.round(chip), 'guard');
  if (moGuard >= MO().guardMax) { moGuard = 0; $('#moLog').textContent = '가드 브레이크! 공격권 획득 — 몰아쳐라'; moSetState('mine'); }
}
// 내 공세: 모든 획이 꽂힌다. 데미지·콤보·검기 충전·공격권 유지. 미스=공격권 급감.
function moOffenseHit(ev: StrokeEvent, heavy: boolean) {
  if (ev.grade === 'miss') { moMomentum = Math.max(0, moMomentum - MO().missDrain); moBars(); $('#moLog').textContent = '✗ 헛손질 — 공격권 급감!'; if (moMomentum <= 0) moSetState('standoff'); return; }
  const tech = tracker.feed(ev); updateTech(tech);
  if (moCharge >= MO().chargeMax) return moKiki();   // 검기 충전 완료 → 관통 참격
  let base = (tech && tech.type === 'success') ? tech.damage : freeAttackDamage(ev.grade);
  base += playerStats().power; if (heavy) base = Math.round(base * 1.35);
  if (performance.now() < moCounterUntil) base = Math.round(base * MO().counterBonusMul);
  let m = comboMultiplier(moCombo + 1, BALANCE.spike.judge.comboStep, BALANCE.spike.judge.comboMax);
  if (moBroken) m *= MO().groggyDmgMul;
  const dmg = Math.max(1, Math.round(base * m));
  moEnemyHp -= dmg; moCombo++; moCharge = Math.min(MO().chargeMax, moCharge + MO().chargePerHit);
  moMomentum = Math.min(MO().momentumMax, moMomentum + MO().momentumPerHit);
  moAddGroggy(MO().groggyPerHit); moBars();
  const nm = (tech && tech.type === 'success') ? tech.name : (STROKE_TEMPLATES[ev.strokeId]?.name ?? ev.strokeId);
  $('#moLog').textContent = `⚔ ${nm} · 적 −${dmg}${moCombo >= 2 ? ` ×${moCombo}` : ''}${moBroken ? ' 붕괴!' : ''}`;
  feelHitMo(tech ? 'art' : ev.grade, !!tech); moPopup(dmg, tech ? 'art' : ev.grade);
  if (moEnemyHp <= 0) return moEnd(true);
}
function moKiki() {
  moCharge = 0;
  const dmg = Math.max(1, Math.round((MO().kikiDamage + playerStats().power) * (moBroken ? MO().groggyDmgMul : 1)));
  moEnemyHp -= dmg; moBars();
  $('#moLog').textContent = `✧ 검기(劍氣)! 화면 관통 — 적 −${dmg}`;
  moSlash(); feelShake(FEEL().shakeArtPx); playHit(true); moPopup(dmg, 'art');
  if (moEnemyHp <= 0) return moEnd(true);
}
// 적 공세 방어: 노랑=패링(카운터 획), 빨강=플릭 회피. 성공=공격권 강탈.
function moDefend(ev: StrokeEvent) {
  const a = moAttack!; clearTimeout(moWinTimer); moParryOpen = false; $('#moArt').classList.remove('teleY', 'teleR');
  if (moAttackRed) {
    if (pendingFlick) { moInvulnUntil = performance.now() + BALANCE.spike.judge.dodgeInvulnMs; moCounterUntil = performance.now() + MO().counterBonusMs;
      $('#moLog').textContent = '↯ 회피! 공격권 강탈 — 반격 보너스'; const app = $('#app'); app.classList.remove('dodgeL', 'dodgeR'); void app.offsetWidth; app.classList.add(pendingFlick === 'R' ? 'dodgeR' : 'dodgeL'); setTimeout(() => app.classList.remove('dodgeL', 'dodgeR'), 380); haptic('good'); moSetState('mine'); return; }
    $('#moLog').textContent = `✗ 못 피했다 — ${a.name}`; moTakeHit(a); return;
  }
  const ok = ev.strokeId === a.counter && (ev.grade === 'good' || ev.grade === 'great' || ev.grade === 'perfect');
  if (ok) { moAddGroggy(MO().groggyPerParry); $('#moLog').textContent = `⚔ 패링! 공격권 강탈 — 그로기↑`; feelHitMo('art', true); haptic('perfect'); moSetState('mine'); }
  else { $('#moLog').textContent = `✗ 헛쳤다 — ${a.name} 피격`; moTakeHit(a); }
}
function moTakeHit(a: EnemyAttack) {
  if (performance.now() < moInvulnUntil) { moSetState('standoff'); return; }
  moPlayerHp -= a.damage; moCombo = 0; moBars(); feelShake(FEEL().shakeArtPx); playerHurtFx(); haptic('miss');
  if (moPlayerHp <= 0) return moEnd(false);
  moSetState('standoff');
}
function moAddGroggy(n: number) {
  if (moBroken) return;
  moGroggy = Math.min(MO().groggyMax, moGroggy + n);
  if (moGroggy >= MO().groggyMax) { moBroken = true; moRenderGuard(); if (soundOn) playGroggySignal(); $('#moLog').textContent = '★ 자세 붕괴 — 난무!'; clearTimeout(moGroggyTimer); moGroggyTimer = setTimeout(() => { moBroken = false; moGroggy = 0; moRenderGuard(); }, MO().groggyWindowMs) as unknown as number; }
}
function moDrainLoop() {
  clearTimeout(moDrainTimer);
  moDrainTimer = setTimeout(() => {
    if (moActive && moState === 'mine') { moMomentum = Math.max(0, moMomentum - MO().momentumDrainPerSec); moBars(); if (moMomentum <= 0) moSetState('standoff'); }
    if (moActive) moDrainLoop();
  }, 1000) as unknown as number;
}
function moEnd(win: boolean) {
  if (!moActive) return; moActive = false; moParryOpen = false;
  [moSeizeTimer, moWinTimer, moDrainTimer, moGuardShiftTimer, moGroggyTimer].forEach(t => clearTimeout(t));
  if (win) { $('#moLog').textContent = '⚑ 낭인 검객을 베었다!'; moFinishFx(); }
  else { endSlowMo(); $('#moLog').textContent = '쓰러졌다…'; setTimeout(exitMomentum, 1700); }
}
function moFinishFx() {
  const art = $('#moArt'); feelShake(Math.round(FEEL().shakeArtPx * 1.6)); moSlash(); playHit(true); startSlowMo();
  setTimeout(() => art.classList.add('knockout'), 130);
  setTimeout(() => { $('#moFinish').classList.add('on'); playHit(true); haptic('perfect'); }, 470);
  setTimeout(() => { $('#moFinish').classList.remove('on'); art.classList.remove('knockout'); endSlowMo(); }, 1700);
  setTimeout(exitMomentum, 2300);
}
function moSlash() { const fx = $('#moSlashFx'); fx.classList.remove('play'); void fx.offsetWidth; fx.classList.add('play'); setTimeout(() => fx.classList.remove('play'), 380); }
function feelHitMo(grade: string, isArt: boolean) {
  const art = $('#moArt'), sp = $('#moSplash');
  art.style.setProperty('--flash-ms', FEEL().flashMs + 'ms');
  art.classList.remove('hit'); sp.classList.remove('play'); void art.offsetWidth; art.classList.add('hit'); sp.classList.add('play');
  feelShake(isArt ? FEEL().shakeArtPx : FEEL().shakeHitPx); playHit(isArt);
}
function moPopup(n: number, grade: string) {
  const box = $('#moPopups'); const el = document.createElement('div'); el.className = 'dmgPop';
  const col: Record<string, string> = { good: 'var(--bone)', great: 'var(--gold)', perfect: 'var(--gold)', art: '#ff6a3d', guard: '#8fb0d0' };
  el.style.color = col[grade] || 'var(--bone)'; el.style.setProperty('--pop-ms', FEEL().popupMs + 'ms');
  el.textContent = grade === 'guard' ? `가드 ${n}` : (grade === 'art' ? `${n}!` : String(n));
  const ar = $('#moArt').getBoundingClientRect();
  el.style.left = (ar.left + ar.width * (0.35 + Math.random() * 0.3)) + 'px';
  el.style.top = (ar.top + ar.height * (0.3 + Math.random() * 0.2)) + 'px';
  box.appendChild(el); setTimeout(() => el.remove(), FEEL().popupMs + 60);
}
$('#moExit').addEventListener('click', exitMomentum);

/* ==== 이동 스파이크 — 횡스크롤 검객(아케이드). 신규·병행, 씬 전환 없음. 필드에서 그대로 긋기 전투.
   #ink 캔버스에 월드 렌더(패럴랙스), 이동=버튼/키, 공격=긋기(판정 엔진 재사용). 자가진단 진입. ==== */
let arcadeActive = false;
const ACD = () => BALANCE.arcade;
const acSprites: Record<string, HTMLImageElement | null> = {};
interface AcEnemy { kind: 'goblin' | 'shield'; wave: number; x: number; hp: number; hpMax: number; face: number; state: 'idle' | 'chase' | 'tele'; timer: number; shield: boolean; hitFx: number; guardFx: number; knock: number; dead: number; splashes: { x: number; y: number; t: number; r: number }[]; }
interface AcProj { x: number; launchX: number; dir: number; life: number; hit: Set<AcEnemy>; }
const acHero = { x: 60, y: 0, vx: 0, vy: 0, onGround: true, jumps: 0, face: 1, pose: 'idle', poseT: 0, hp: 60, invuln: 0, run: 0, slash: 0 };
let acCam = 0, acGroundY = 0, acEnemies: AcEnemy[] = [], acBlocks: { x0: number; x1: number; top: number }[] = [];
let acWon = false, acDead = false, acEndT = 0, acPrevT = 0;
let acKi = 0;                               // 검기 게이지(0..kiMax) — 연속 정타로 충전
let acProjectiles: AcProj[] = [];           // 검기 참격(원거리 다수 절단)
let acSlashFx: { t: number; dir: number; slam: boolean; y: number }[] = [];   // 근접 베기 전방 잔상
// 피니시 연출(무리 마지막 처치): 슬로우 + 줌 + 갈라짐 + 잉크
let acFx = { t: 0, dur: 0, focusX: 0, focusY: 0, split: null as AcEnemy | null };
let acTimeScale = 1, acZoom = 1, acFlash = 0;
const acKeys = { left: false, right: false };
// 트윈스틱(모바일): 좌반=가상 조이스틱(이동+점프), 우반=검격 존(긋기). 멀티터치 동시.
let acStickId: number | null = null, acMoveX = 0, acStickUp = false, acStickDownT = 0;
const acStickOrg = { x: 0, y: 0 }, acStickCur = { x: 0, y: 0 };
let acSlashId: number | null = null, acSlashT0 = 0, acSlashPts: Pt[] = [];
const padK = () => (BALANCE.padScale[settings.padSize] ?? 1);
const HW = 30;   // 히어로 반폭(벽 충돌)

function loadAcSprites() {
  ['hero_idle', 'hero_run', 'hero_jump', 'hero_slash', 'hero_slam', 'enemy_goblin', 'enemy_shieldman'].forEach(n => {
    if (!acSprites[n]) loadArt('acade/' + n).then(img => { acSprites[n] = img; });
  });
  if (!acSprites['bg_forest']) loadArt('bg_forest').then(img => { acSprites['bg_forest'] = img; });
}
function enterArcade() {
  loadAcSprites();
  arcadeActive = true; acWon = false; acDead = false; acEndT = 0; acCam = 0; acPrevT = 0;
  acGroundY = H * ACD().groundFrac;
  Object.assign(acHero, { x: 60, y: acGroundY, vx: 0, vy: 0, onGround: true, jumps: 0, face: 1, pose: 'idle', poseT: 0, hp: ACD().heroHp, invuln: 0, run: 0, slash: 0 });
  acKeys.left = false; acKeys.right = false;
  acKi = 0; acProjectiles = []; acSlashFx = []; acFx = { t: 0, dur: 0, focusX: 0, focusY: 0, split: null }; acTimeScale = 1; acZoom = 1; acFlash = 0; acResetTouch();
  acBlocks = [{ x0: 470, x1: 660, top: acGroundY - 78 }, { x0: 1120, x1: 1330, top: acGroundY - 128 }];
  const A = ACD();
  const mk = (kind: 'goblin' | 'shield', x: number, wave: number): AcEnemy => ({ kind, wave, x, hp: kind === 'shield' ? A.shieldHp : A.goblinHp, hpMax: kind === 'shield' ? A.shieldHp : A.goblinHp, face: -1, state: 'idle', timer: A.enemyAtkMinMs + Math.random() * (A.enemyAtkMaxMs - A.enemyAtkMinMs), shield: kind === 'shield', hitFx: 0, guardFx: 0, knock: 0, dead: 0, splashes: [] });
  // 템포 파형: [잡몹 무리(학살) → 빈 구간(달리기) → 방패(긴장) → 큰 무리+검기(폭발)]
  acEnemies = [
    mk('goblin', 760, 0), mk('goblin', 880, 0), mk('goblin', 980, 0),                       // 웨이브0 — 잡몹 무리
    mk('shield', 1620, 1), mk('goblin', 1740, 1),                                            // 웨이브1 — 방패 긴장
    mk('goblin', 2240, 2), mk('goblin', 2360, 2), mk('goblin', 2470, 2),                     // 웨이브2 — 큰 무리(폭발)
    mk('goblin', 2560, 2), mk('goblin', 2660, 2),
  ];
  setSceneBg(null);
  $('#arcade').classList.add('on'); $('#app').classList.add('spike-open', 'arcade-open'); $('#hint').style.display = 'none'; $('#diag').style.display = 'none';
  acHud();
}
function exitArcade() {
  if (!arcadeActive && !$('#arcade').classList.contains('on')) return;
  arcadeActive = false; acKeys.left = false; acKeys.right = false; acResetTouch();
  $('#arcade').classList.remove('on'); $('#app').classList.remove('spike-open', 'arcade-open');
}
function acSurfaceAt(x: number): number {
  let g = acGroundY;
  for (const b of acBlocks) if (x > b.x0 && x < b.x1 && acHero.vy >= 0 && acHero.y <= b.top + 26) g = Math.min(g, b.top);
  for (const b of acBlocks) if (x > b.x0 && x < b.x1 && acHero.y <= b.top + 1) g = Math.min(g, b.top);   // 위에 서 있는 중
  return g;
}
function acJump() {   // 2단 점프: 지상 1회 + 공중 1회(maxJumps). 스페이스·↑·⤴ 공통 진입점.
  if (!arcadeActive || acWon || acDead) return;
  const A = ACD();
  if (acHero.onGround) { acHero.vy = -A.jumpV; acHero.onGround = false; acHero.jumps = 1; }
  else if (acHero.jumps < A.maxJumps) { acHero.vy = -A.jumpV; acHero.jumps++; }
}
function acHeroHurt(dmg: number) {
  if (performance.now() < acHero.invuln) return;
  acHero.hp -= dmg; acHero.invuln = performance.now() + ACD().hitInvulnMs; acKi = Math.max(0, acKi * 0.5); acHud();
  feelShake(FEEL().shakeArtPx); playerHurtFx(); haptic('miss');
  if (acHero.hp <= 0) { acDead = true; acEndT = 0; }
}
function acHud() { ($('#acHpFill')).style.width = Math.max(0, acHero.hp / ACD().heroHp * 100) + '%'; const k = $('#acKiFill'); if (k) { k.style.width = Math.min(100, acKi / ACD().kiMax * 100) + '%'; k.classList.toggle('full', acKi >= ACD().kiMax); } }
function acUpdate(dtMs: number) {
  const dt = Math.min(2.5, dtMs / 16.67), A = ACD();
  if (acWon || acDead) { acEndT += dtMs; if (acEndT > 2200) exitArcade(); return; }
  // 이동: 조이스틱(연속 -1..1) 활성 시 우선, 아니면 키보드
  const dir = acStickId !== null ? acMoveX : ((acKeys.right ? 1 : 0) - (acKeys.left ? 1 : 0));
  if (Math.abs(dir) > 0.05) acHero.face = dir > 0 ? 1 : -1;
  // 수평 이동 + 벽 충돌(단차 측면)
  let nx = acHero.x + dir * A.moveSpeed * dt;
  for (const b of acBlocks) {
    if (acHero.y > b.top + 6 && nx > b.x0 - HW && nx < b.x1 + HW) {
      if (acHero.x <= b.x0) nx = b.x0 - HW; else if (acHero.x >= b.x1) nx = b.x1 + HW;
    }
  }
  acHero.x = Math.max(30, Math.min(A.worldW - 30, nx));
  // 중력·착지
  acHero.vy += A.gravity * dt; acHero.y += acHero.vy * dt;
  const surf = acSurfaceAt(acHero.x);
  if (acHero.y >= surf) { acHero.y = surf; acHero.vy = 0; if (!acHero.onGround) acHero.jumps = 0; acHero.onGround = true; }
  else { if (acHero.onGround) acHero.jumps = 1; acHero.onGround = false; }   // 단차에서 걸어 떨어지면 지상 점프 소진(공중 1회만)
  // 포즈
  acHero.poseT -= dtMs;
  if (acHero.poseT <= 0) { acHero.pose = !acHero.onGround ? 'jump' : (dir !== 0 ? 'run' : 'idle'); if (acHero.pose === 'run') acHero.run += dt * 0.4; }
  acCam = Math.max(0, Math.min(A.worldW - W, acHero.x - W * 0.35));
  if (acHero.x >= A.signX) { acWon = true; acEndT = 0; }
  // 적 AI
  for (const e of acEnemies) {
    if (e.dead) { e.dead += dtMs; continue; }
    if (e.hp <= 0) { e.dead = 1; continue; }
    if (e.hitFx > 0) e.hitFx -= dtMs; if (e.guardFx > 0) e.guardFx -= dtMs;
    if (e.knock !== 0) { e.x += e.knock * dt; e.knock *= 0.8; if (Math.abs(e.knock) < 0.4) e.knock = 0; }
    e.splashes = e.splashes.filter(s => (s.t -= dtMs) > 0);
    const dx = acHero.x - e.x, dist = Math.abs(dx); e.face = dx >= 0 ? 1 : -1;
    if (e.state === 'tele') {
      e.timer -= dtMs;
      if (e.timer <= 0) { if (dist < A.enemyAtkRange + 24 && acHero.onGround) acHeroHurt(A.enemyDamage); e.state = 'idle'; e.timer = A.enemyAtkMinMs + Math.random() * (A.enemyAtkMaxMs - A.enemyAtkMinMs); }
    } else if (dist < A.enemyAggro && dist > A.enemyAtkRange) { e.x += Math.sign(dx) * A.moveSpeed * 0.5 * dt; e.state = 'chase'; }
    else if (dist <= A.enemyAtkRange) { e.timer -= dtMs; if (e.timer <= 0) { e.state = 'tele'; e.timer = A.enemyTeleMs; } }
    else e.state = 'idle';
  }
  // 검기 참격 이동·충돌 — 발사 전방 + 사거리 내 + 화면(뷰포트) 내로만 한정(버그: 뒤쪽·화면밖 적 전멸 방지)
  const swRange = BALANCE.swordWave.range || W;   // 기본 = 화면 폭
  for (const p of acProjectiles) {
    p.life -= dtMs; p.x += p.dir * A.kiSpeed * dt;
    if (Math.abs(p.x - p.launchX) > swRange) { p.life = 0; continue; }   // 사거리 초과 → 소멸
    for (const e of acEnemies) {
      if (e.hp <= 0 || p.hit.has(e)) continue;
      if (Math.sign(e.x - p.launchX) !== p.dir) continue;                 // 발사 방향 전방만
      if (Math.abs(e.x - p.launchX) > swRange) continue;                  // 사거리 내
      const esx = e.x - acCam;
      if (esx < 0 || esx > W) continue;                                   // 화면 안(뷰포트)만
      if (Math.abs(e.x - p.x) > A.kiRange) continue;                      // 참격 스윕 폭
      p.hit.add(e);
      if (e.shield) { e.shield = false; e.guardFx = 0; acShatter(e); }
      e.hp -= A.kiDamage; e.hitFx = 240; e.knock = p.dir * (A.knockPx / 8);
      e.splashes.push({ x: (Math.random() - 0.5) * 54, y: -60 - Math.random() * 54, t: 540, r: 12 + Math.random() * 16 });
      feelHit('great', true); haptic('great');
      if (e.hp <= 0) acOnKill(e);
    }
  }
  acProjectiles = acProjectiles.filter(p => p.life > 0 && p.x > -80 && p.x < A.worldW + 80);
  acSlashFx = acSlashFx.filter(s => (s.t -= dtMs) > 0);
}
// 무리(웨이브) 마지막 적 처치 → 피니시 연출(슬로우+줌+갈라짐+잉크).
function acOnKill(e: AcEnemy) {
  if (e.dead) return;
  e.dead = 1;
  $('#acMsg').textContent = e.kind === 'shield' ? '방패 고블린 처치!' : '고블린 처치!';
  const remain = acEnemies.some(o => o !== e && o.wave === e.wave && o.hp > 0);
  if (!remain) acStartFinish(e);
}
function acStartFinish(e: AcEnemy) {
  const A = ACD();
  acFx = { t: A.finishDurMs, dur: A.finishDurMs, focusX: e.x, focusY: acGroundY - 70, split: e };
  acFlash = 1;
  for (let i = 0; i < 16; i++) e.splashes.push({ x: (Math.random() - 0.5) * 110, y: -30 - Math.random() * 120, t: 700, r: 8 + Math.random() * 18 });   // 잉크 분출
  feelShake(FEEL().shakeArtPx); playHit(true); haptic('perfect');
  $('#acMsg').textContent = e.wave === 2 ? '무리 소탕 — 一閃!' : '무리 정리!';
}
// 피니시 연출을 실시간으로 진행(슬로우/줌/섬광). 게임 dt는 draw()에서 acTimeScale로 스케일.
function acFxTick(realDt: number) {
  const A = ACD();
  if (acFlash > 0) acFlash = Math.max(0, acFlash - realDt / 300);
  if (acFx.t > 0) {
    acFx.t -= realDt;
    const elapsed = acFx.dur - acFx.t;
    if (elapsed < A.finishSlowMs) acTimeScale = A.finishSlowScale;
    else acTimeScale = A.finishSlowScale + (1 - A.finishSlowScale) * Math.min(1, (elapsed - A.finishSlowMs) / (acFx.dur - A.finishSlowMs));
    const zc = Math.sin(Math.min(1, elapsed / acFx.dur) * Math.PI);
    acZoom = 1 + (A.finishZoom - 1) * zc;
    if (acFx.t <= 0) { acFx = { t: 0, dur: 0, focusX: 0, focusY: 0, split: null }; acTimeScale = 1; acZoom = 1; }
  } else { acTimeScale = 1; acZoom = 1; }
}
// 긋기 = 그 방향 베기. 앞쪽 근접 적 다수 동시 절단(관통). 방패=내려찍기. 검기 만충+퍼펙트=참격 발출.
function acAttack(ev: StrokeEvent) {
  if (ev.grade === 'miss') return;
  const A = ACD();
  const isSlam = ev.strokeId === 'v_down';
  const isHorizontal = ev.strokeId === 'h_lr' || ev.strokeId === 'h_rl';
  acHero.pose = isSlam ? 'slam' : 'slash'; acHero.poseT = 260;
  // 검기 발출: 게이지 만충 + 퍼펙트 획 → 화면 가로지르는 참격(원거리·관통·방패 무시)
  if (acKi >= A.kiMax && ev.grade === 'perfect') {
    acProjectiles.push({ x: acHero.x + acHero.face * 40, launchX: acHero.x, dir: acHero.face, life: A.kiLifeMs, hit: new Set() });
    acKi = 0; acHud(); acFlash = 0.85; feelShake(FEEL().shakeArtPx); playHit(true); haptic('perfect');
    acSlashFx.push({ t: 240, dir: acHero.face, slam: false, y: acGroundY - 70 });
    $('#acMsg').textContent = '검기 발출 — 一閃!';
    return;
  }
  let hitAny = false, hitCount = 0;
  for (const e of acEnemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - acHero.x;
    if (Math.abs(dx) > A.meleeRange) continue;
    if (Math.sign(dx) !== acHero.face && Math.abs(dx) > 40) continue;   // 바라보는 앞쪽만(전방 직선)
    if (e.shield && !isSlam) { e.guardFx = 240; feelShake(Math.round(FEEL().shakeHitPx * 0.6)); playBlock(); $('#acMsg').textContent = '방패에 막혔다 — 내려찍기(↓↓)로 부숴라!'; hitAny = true; continue; }
    if (e.shield && isSlam) { e.shield = false; e.guardFx = 0; feelShake(FEEL().shakeArtPx); playHit(true); acShatter(e); $('#acMsg').textContent = '방패 파괴!'; }
    const dmg = freeAttackDamage(ev.grade) + playerStats().power;
    e.hp -= dmg; e.hitFx = 200; e.knock = acHero.face * (A.knockPx / 10);
    e.splashes.push({ x: (Math.random() - 0.5) * 40, y: -60 - Math.random() * 40, t: 500, r: 10 + Math.random() * 14 });
    acKi = Math.min(A.kiMax, acKi + A.kiPerHit);   // 정타 → 검기 충전
    hitAny = true; hitCount++;
    if (e.hp <= 0) acOnKill(e);
  }
  if (hitCount > 0) {
    acSlashFx.push({ t: 200, dir: acHero.face, slam: isSlam, y: acGroundY - 70 });
    feelHit(ev.grade, hitCount >= 2); haptic(ev.grade); acHud();   // 다수 동시 절단 = 강한 히트스톱
    if (hitCount >= 2 && isHorizontal && acFx.t <= 0) $('#acMsg').textContent = `관통 — ${hitCount}명 절단!`;
  } else if (!hitAny) $('#acMsg').textContent = '';
}
function acShatter(e: AcEnemy) { for (let i = 0; i < 8; i++) e.splashes.push({ x: (Math.random() - 0.5) * 80, y: -40 - Math.random() * 80, t: 600, r: 6 + Math.random() * 10 }); }

$('#acExit').addEventListener('click', exitArcade);

// ---- 트윈스틱(모바일) 입력: 터치 포인터만 좌/우 분기. 마우스는 기존 제스처(PC) 유지 ----
function acResetTouch() { acStickId = null; acSlashId = null; acMoveX = 0; acStickUp = false; acSlashPts = []; }
function acTouchDown(e: PointerEvent) {
  gRect = canvas.getBoundingClientRect();
  const half = window.innerWidth / 2;
  if (e.clientX < half) {                          // 좌반 = 가상 조이스틱
    if (acStickId !== null) return;
    acStickId = e.pointerId;
    acStickOrg.x = e.clientX; acStickOrg.y = e.clientY;
    acStickCur.x = e.clientX; acStickCur.y = e.clientY;
    acMoveX = 0; acStickUp = false; acStickDownT = performance.now();
  } else {                                          // 우반 = 검격 존(긋기)
    if (acSlashId !== null) return;
    acSlashId = e.pointerId; acSlashT0 = performance.now();
    acSlashPts = [{ x: relX(e), y: relY(e), t: 0 }]; liveTrail = acSlashPts;
  }
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
}
function acTouchMove(e: PointerEvent) {
  const A = ACD(), k = padK();
  if (e.pointerId === acStickId) {
    acStickCur.x = e.clientX; acStickCur.y = e.clientY;
    const dx = acStickCur.x - acStickOrg.x, dy = acStickCur.y - acStickOrg.y;
    const rad = A.stickRadius * k, dead = A.stickDead * k;
    acMoveX = Math.abs(dx) < dead ? 0 : Math.max(-1, Math.min(1, dx / rad));
    if (dy < -rad * A.jumpSwipeFrac && !acStickUp) { acStickUp = true; acJump(); }   // 스와이프 업 = 점프
    else if (dy > -rad * A.jumpSwipeFrac * 0.4) acStickUp = false;                    // 엄지 내려오면 재점프(2단) 가능
  } else if (e.pointerId === acSlashId) {
    acSlashPts.push({ x: relX(e), y: relY(e), t: performance.now() - acSlashT0 });
  }
}
function acTouchUp(e: PointerEvent) {
  if (e.pointerId === acStickId) {
    const held = performance.now() - acStickDownT;
    const moved = Math.hypot(acStickCur.x - acStickOrg.x, acStickCur.y - acStickOrg.y);
    if (held < 220 && moved < ACD().stickDead * padK() * 1.6 && !acStickUp) acJump();   // 짧은 탭 = 점프
    acStickId = null; acMoveX = 0; acStickUp = false;
  } else if (e.pointerId === acSlashId) {
    const pts = acSlashPts; acSlashId = null; acSlashPts = []; liveTrail = null;
    acFinishSlash(pts);
  }
}
function acFinishSlash(pts: Pt[]) {   // 검격 존 긋기 → 판정(존 크기로 스케일) → acAttack 라우팅
  if (pts.length < 2) return;
  const zoneW = window.innerWidth / 2, zoneH = window.innerHeight;   // 우측 반 = 축소 판정 프레임
  const res = judgeStroke(pts, { w: zoneW, h: zoneH }, currentStyle);
  if (res.rejected) { if (pts.length > 1) { lastOverlay = { user: resample(pts, 40), ideal: null, grade: 'miss' }; overlayFade = 1; } return; }
  lastOverlay = { user: resample(pts, 40), ideal: idealForDisplay(res.strokeId!, pts), grade: res.grade! };
  overlayFade = 1;
  pendingFlick = computeFlick(pts);
  const dur = (pts[pts.length - 1].t ?? 0) - (pts[0].t ?? 0);
  pendingHeavy = dur >= BALANCE.momentum.chargeHoldMs;
  emitStroke({ strokeId: res.strokeId!, accuracy: res.accuracy!, grade: res.grade!, inputMode: 'gesture', timestamp: performance.now(), breakdown: res.breakdown });
}
// ---- 아케이드 렌더(#ink 캔버스) ----
function drawArcade() {
  const A = ACD();
  ctx.fillStyle = '#15120e'; ctx.fillRect(0, 0, W, H);   // 하늘(줌 영향 없음)
  const zoom = acZoom;
  ctx.save();
  if (zoom !== 1) { const fx = acFx.focusX - acCam, fy = acFx.focusY; ctx.translate(fx, fy); ctx.scale(zoom, zoom); ctx.translate(-fx, -fy); }
  const bg = acSprites['bg_forest'];
  if (bg) { drawBgLayer(bg, acCam * 0.22, 0.5); drawBgLayer(bg, acCam * 0.55, 0.85); }
  ctx.fillStyle = '#241d14'; ctx.fillRect(0, acGroundY, W, H - acGroundY);
  ctx.strokeStyle = 'rgba(201,168,106,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, acGroundY + 1); ctx.lineTo(W, acGroundY + 1); ctx.stroke();
  ctx.fillStyle = '#2c2318';
  for (const b of acBlocks) { const sx = b.x0 - acCam; ctx.fillRect(sx, b.top, b.x1 - b.x0, H - b.top); ctx.fillStyle = 'rgba(201,168,106,.25)'; ctx.fillRect(sx, b.top, b.x1 - b.x0, 3); ctx.fillStyle = '#2c2318'; }
  const signSx = A.signX - acCam;
  if (signSx < W + 60 && signSx > -60) { ctx.fillStyle = '#6b5836'; ctx.fillRect(signSx - 4, acGroundY - 92, 8, 92); ctx.fillStyle = '#c9a86a'; ctx.fillRect(signSx - 34, acGroundY - 122, 68, 32); ctx.fillStyle = '#16130f'; ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('끝', signSx, acGroundY - 100); ctx.textAlign = 'left'; }
  for (const e of acEnemies) {
    if (e.dead && e.dead > 520 && e !== acFx.split) continue;
    const sx = e.x - acCam; if (sx < -200 || sx > W + 200) continue;
    const img = acSprites[e.kind === 'shield' ? 'enemy_shieldman' : 'enemy_goblin'];
    for (const s of e.splashes) { ctx.fillStyle = `rgba(18,14,11,${Math.max(0, s.t / 540) * 0.78})`; ctx.beginPath(); ctx.arc(sx + s.x, acGroundY + s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    if (e === acFx.split && acFx.t > 0) { acDrawSplit(img, sx, acGroundY, A.enemyScale, 1 - acFx.t / acFx.dur); continue; }   // 피니시: 갈라짐
    let alpha = 1, dy = 0;
    if (e.dead) { alpha = Math.max(0, 1 - e.dead / 520); dy = e.dead / 520 * 12; }
    ctx.globalAlpha = alpha; if (e.hitFx > 0) ctx.filter = 'brightness(2.4) saturate(.3)';
    drawAcSprite(img, sx, acGroundY + dy, A.enemyScale, e.face); ctx.filter = 'none'; ctx.globalAlpha = 1;
    if (e.shield && e.guardFx > 0) { ctx.strokeStyle = 'rgba(140,176,208,.9)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx - 24 * e.face, acGroundY - 78, 42, 0, Math.PI * 2); ctx.stroke(); }
    if (e.state === 'tele' && !e.dead) { ctx.fillStyle = 'rgba(255,80,50,.95)'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', sx, acGroundY - 152); ctx.textAlign = 'left'; }
    if (!e.dead) { const bw = 44; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(sx - bw / 2, acGroundY - 166, bw, 4); ctx.fillStyle = '#9c2f26'; ctx.fillRect(sx - bw / 2, acGroundY - 166, bw * Math.max(0, e.hp / e.hpMax), 4); }
  }
  // 근접 베기 전방 잔상(관통 라인)
  for (const s of acSlashFx) {
    const a = Math.max(0, s.t / 200), hx = acHero.x - acCam;
    ctx.globalAlpha = a * 0.85; ctx.lineCap = 'round';
    ctx.strokeStyle = s.slam ? 'rgba(200,220,255,.95)' : 'rgba(242,228,182,.95)'; ctx.lineWidth = 6; ctx.beginPath();
    if (s.slam) { ctx.moveTo(hx, s.y - 80); ctx.lineTo(hx + s.dir * 34, s.y + 50); } else { ctx.moveTo(hx + s.dir * 16, s.y - 68); ctx.lineTo(hx + s.dir * (A.meleeRange - 10), s.y + 4); }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  // 검기 참격(원거리)
  for (const p of acProjectiles) {
    const px = p.x - acCam; if (px < -80 || px > W + 80) continue;
    ctx.globalAlpha = Math.min(1, p.life / 260); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(px - p.dir * 46, acGroundY - 150); ctx.lineTo(px + p.dir * 10, acGroundY - 24); ctx.stroke();
    ctx.strokeStyle = 'rgba(240,222,150,.9)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(px - p.dir * 70, acGroundY - 138); ctx.lineTo(px - p.dir * 8, acGroundY - 40); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  const poseImg = acSprites['hero_' + acHero.pose] || acSprites['hero_idle'];
  const tilt = acHero.pose === 'run' ? Math.sin(acHero.run) * 5 : 0;
  const bob = acHero.pose === 'run' ? Math.abs(Math.sin(acHero.run)) * -4 : 0;
  ctx.globalAlpha = (performance.now() < acHero.invuln && Math.floor(performance.now() / 80) % 2 === 0) ? 0.4 : 1;
  drawAcSprite(poseImg, acHero.x - acCam, acHero.y + bob, A.heroScale, acHero.face, tilt);
  ctx.globalAlpha = 1;
  ctx.restore();
  acDrawControls();   // 트윈스틱 UI(가이드 링 + 조이스틱) — 화면 공간
  // 섬광(一閃) — 화면 공간 오버레이
  if (acFlash > 0) {
    ctx.globalAlpha = acFlash * 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = acFlash; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(W * 0.12, H * 0.66); ctx.lineTo(W * 0.9, H * 0.2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if (acWon) { ctx.fillStyle = 'rgba(201,168,106,.95)'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('끝 — 도착!', W / 2, H * 0.4); ctx.textAlign = 'left'; }
  if (acDead) { ctx.fillStyle = 'rgba(156,47,38,.95)'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('쓰러졌다…', W / 2, H * 0.4); ctx.textAlign = 'left'; }
}
const AC_TOUCH = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || (typeof window !== 'undefined' && 'ontouchstart' in window);
// 트윈스틱 UI: 우측 검격 존 가이드 링(상시 은은) + 좌측 조이스틱(터치 중)
function acDrawControls() {
  if (!AC_TOUCH) return;   // PC(마우스)는 화면 어디든 긋기 — UI 없음
  const A = ACD(), k = padK();
  const ringR = A.slashRingRadius * k, rcx = W * 0.75, rcy = H * 0.6;
  ctx.strokeStyle = 'rgba(201,168,106,.13)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(rcx, rcy, ringR, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(201,168,106,.07)';
  ctx.beginPath(); ctx.arc(rcx, rcy, ringR * 0.62, 0, Math.PI * 2); ctx.stroke();
  if (acStickId !== null) {
    const sr = A.stickRadius * k;
    let dx = acStickCur.x - acStickOrg.x, dy = acStickCur.y - acStickOrg.y;
    const d = Math.hypot(dx, dy); if (d > sr) { dx = dx / d * sr; dy = dy / d * sr; }
    ctx.strokeStyle = 'rgba(230,220,195,.32)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(acStickOrg.x, acStickOrg.y, sr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(230,220,195,.5)';
    ctx.beginPath(); ctx.arc(acStickOrg.x + dx, acStickOrg.y + dy, 24, 0, Math.PI * 2); ctx.fill();
  }
}
// 피니시: 적을 세로로 갈라 두 조각이 벌어지며 회전·페이드
function acDrawSplit(img: HTMLImageElement | null, sx: number, footY: number, scale: number, prog: number) {
  if (!img) return;
  const w = img.width * scale, h = img.height * scale, topY = footY - h;
  const gap = 6 + prog * 30, rot = prog * 0.22, alpha = Math.max(0, 1 - prog * 0.85);
  ctx.globalAlpha = alpha;
  ctx.save(); ctx.beginPath(); ctx.rect(sx - w, topY - 14, w, h + 28); ctx.clip(); ctx.translate(sx - gap, footY); ctx.rotate(-rot); ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(sx, topY - 14, w, h + 28); ctx.clip(); ctx.translate(sx + gap, footY); ctx.rotate(rot); ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
  ctx.globalAlpha = 1;
}
function drawBgLayer(img: HTMLImageElement, offset: number, alpha: number) {
  const dh = acGroundY, dw = img.width * (dh / img.height);
  let x = -(((offset % dw) + dw) % dw); ctx.globalAlpha = alpha;
  for (; x < W; x += dw) ctx.drawImage(img, x, 0, dw, dh);
  ctx.globalAlpha = 1;
}
function drawAcSprite(img: HTMLImageElement | null, cx: number, footY: number, scale: number, face: number, tilt = 0) {
  if (!img) { ctx.fillStyle = 'rgba(20,15,12,.6)'; ctx.fillRect(cx - 18, footY - 56, 36, 56); return; }
  const w = img.width * scale, h = img.height * scale;
  ctx.save(); ctx.translate(cx, footY); if (tilt) ctx.rotate(tilt * Math.PI / 180); ctx.scale(face, 1);
  ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
}

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
/* ---- T2-04 확장: 골드·경험치·인벤토리·장착 검 (벌기→사기→쓰기 루프) ---- */
const SAVE_KEY = 'sm_save_v1', SAVE_VERSION = 1;
let checkpoint: { current: string; visited: string[] } = { current: STAGE.start, visited: [STAGE.start] };
let checkpointZone = STAGE.nodes[STAGE.start].zone;
// 플레이어 진행 상태
let gold = BALANCE.progression.startGold, xp = 0;
let inventory: Record<string, number> = {};
let equippedSword = 'nameless';
// T2-05: 스토리 진행 — 유파 선택(styleId=currentStyleId), 프롤로그 완료, 이미 본 대화(자동 스킵)
let prologueDone = false;
const seenDialogues = new Set<string>();
const playerLevel = () => levelFromXp(xp);
const playerStats = () => derivedStats(playerLevel(), equippedSword);
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, stage: 'stage1', current: mapCurrent, visited: [...mapVisited], checkpoint, checkpointZone, gold, xp, inventory, equippedSword, styleId: currentStyleId, prologueDone, seenDialogues: [...seenDialogues] })); } catch (_) { /* noop */ }
}
function loadGame(): boolean {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s && s.version === SAVE_VERSION && s.stage === 'stage1' && STAGE.nodes[s.current]) {
      mapCurrent = s.current; mapVisited.clear();
      (s.visited || []).forEach((v: string) => { if (STAGE.nodes[v]) mapVisited.add(v); });
      if (s.checkpoint && STAGE.nodes[s.checkpoint.current]) { checkpoint = s.checkpoint; checkpointZone = s.checkpointZone ?? STAGE.nodes[s.checkpoint.current].zone; }
      gold = Number.isFinite(s.gold) ? s.gold : BALANCE.progression.startGold;
      xp = Number.isFinite(s.xp) ? s.xp : 0;
      inventory = (s.inventory && typeof s.inventory === 'object') ? { ...s.inventory } : {};
      equippedSword = SWORDS[s.equippedSword] ? s.equippedSword : 'nameless';
      if (STYLES[s.styleId]) setStyle(s.styleId);   // 잠긴 유파 복원
      prologueDone = !!s.prologueDone;
      seenDialogues.clear(); (s.seenDialogues || []).forEach((d: string) => seenDialogues.add(d));
      updatePlayerHud();
      return true;
    }
  } catch (_) { /* noop */ }
  updatePlayerHud();
  return false;
}
function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (_) { /* noop */ }
  mapCurrent = STAGE.start; mapVisited.clear(); mapVisited.add(STAGE.start);
  checkpoint = { current: STAGE.start, visited: [STAGE.start] }; checkpointZone = STAGE.nodes[STAGE.start].zone;
  gold = BALANCE.progression.startGold; xp = 0; inventory = {}; equippedSword = 'nameless';
  prologueDone = false; seenDialogues.clear();   // 새 회차 → 유파 재선택 가능(프롤로그부터)
  updatePlayerHud(); saveGame(); renderMap();
}
// T2-04: 전투 승리 보상(골드+경험치) + 레벨업 감지. kind별 보상.
function grantReward(kind: 'encounter' | 'elite' | 'boss'): string {
  const p = BALANCE.progression;
  const before = playerLevel();
  gold += p.goldPerWin[kind] ?? 0;
  xp += p.xpPerWin[kind] ?? 0;
  const after = playerLevel();
  updatePlayerHud(); saveGame();
  const gained = `+${p.goldPerWin[kind] ?? 0}냥 · 경험치 +${p.xpPerWin[kind] ?? 0}`;
  if (after > before) { const st = derivedStats(after, equippedSword); return `${gained} · ⬆ 레벨 ${after}! (최대 HP ${st.hpMax} · 위력 +${st.power})`; }
  return gained;
}
function updatePlayerHud() {
  const st = playerStats(); const nxt = xpToNext(xp);
  const el = document.querySelector('#playerHud');
  if (el) el.textContent = `Lv.${playerLevel()} · ${gold}냥 · HP ${st.hpMax} · 위력+${st.power} · ${SWORDS[equippedSword]?.name ?? ''}` + (nxt === null ? ' · MAX' : ` · 다음 Lv ${nxt}xp`);
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
  mapActive = true; $('#map').classList.add('on'); $('#app').classList.add('map-open');   // 하위 씬 UI 가림
  $('#hint').style.display = 'none'; $('#btnMap').classList.add('active');
  $('#mapTitle').textContent = STAGE.name;
  setSceneBg('bg_nodemap');
  renderMap();
}
function exitMap() { mapActive = false; $('#map').classList.remove('on'); $('#app').classList.remove('map-open'); $('#btnMap').classList.remove('active'); setSceneBg(null); }
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
  const key = 'node_' + id;
  if (STORY[key] && !seenDialogues.has(key)) {   // 노드 첫 진입 시 대화 → 이후 씬
    seenDialogues.add(key); saveGame();
    playDialogue(key, () => runNodeScene(id));
  } else runNodeScene(id);
}
function runNodeScene(id: string) {
  const n = STAGE.nodes[id];
  if (n.type === 'shop') {
    // T2-04 상점: 골드로 아이템/검 구매. 떠나면 노드 완료.
    afterScene = () => { advanceTo(id); enterMap(); };
    exitMap(); enterShop();
    return;
  }
  if (n.type === 'event' || n.type === 'rest') {
    // 간이 노드: 맵 유지, 메시지 후 완료(대화는 T2-05)
    const note = n.type === 'rest' ? '기력을 회복했다.' : '사건이 벌어졌다 (대화는 T2-05).';
    $('#mapHint').textContent = `${NODE_ICON[n.type]} ${n.label} — ${note}`;
    advanceTo(id);                       // 진행 + 자동저장
    setTimeout(renderMap, 850);
    return;
  }
  if (n.type === 'battle') {
    // 전투: 승리=진행, 패배=구역 시작 복귀(체크포인트), 중도이탈=현상 유지.
    afterScene = () => {
      if (spikeResult === 'win') advanceTo(id);
      else if (spikeResult === 'lose') restoreCheckpoint();
      enterMap();
    };
    const kind = (n.battleKind === 'encounter' || n.battleKind === 'elite') ? n.battleKind : 'boss';
    exitMap(); enterSpike(ENEMIES[n.enemy!] ? n.enemy! : 'goblin', kind);   // 3층 루프 전면 이식
    return;
  }
  if (n.type === 'training') {
    // 성공 시: 진행 + 완료 대사(after_<id>) → 지도. (온보딩: 수련 끝 → 스승이 사냥 지시)
    afterScene = (success) => {
      if (success) { advanceTo(id); playAfterNode(id, () => enterMap()); }
      else enterMap();
    };
    exitMap(); enterTraining();
  }
}
// 노드 완료 후 대사(after_<id>) 1회 재생 → 콜백. 없으면 즉시 콜백.
function playAfterNode(id: string, done: () => void) {
  const key = 'after_' + id;
  if (STORY[key] && !seenDialogues.has(key)) { seenDialogues.add(key); saveGame(); playDialogue(key, done); }
  else done();
}
$('#btnMap').addEventListener('click', () => { mapActive ? exitMap() : enterMap(); });
$('#mapExit').addEventListener('click', exitMap);
let resetArm = false, resetTimer: number | undefined;
$('#mapReset').addEventListener('click', () => {
  const b = $('#mapReset');
  if (!resetArm) { resetArm = true; b.textContent = '정말? 다시 탭'; clearTimeout(resetTimer); resetTimer = setTimeout(() => { resetArm = false; b.textContent = '처음부터'; }, 2500) as unknown as number; return; }
  resetArm = false; clearTimeout(resetTimer); b.textContent = '처음부터'; resetGame();
});
/* ---- T2-05 대화 시스템 (초상+텍스트, 탭 진행/자동/스킵). 데이터=STORY(story/stage1.json) ---- */
let dlgActive = false, dlgInReaction = false, dlgAwaitStroke = false, dlgAuto = false;
let dlgLines: DlgLine[] = [], dlgIdx = 0;
let dlgDef: Dialogue | null = null;
let dlgOnDone: (() => void) | null = null;
let dlgAutoTimer: number | undefined;

function playDialogue(id: string, onDone: () => void) {
  const def = STORY[id];
  if (!def) { onDone(); return; }
  dlgActive = true; dlgDef = def; dlgLines = def.lines; dlgIdx = 0; dlgInReaction = false; dlgOnDone = onDone;
  $('#dialogue').classList.add('on'); $('#app').classList.add('dlg-open'); $('#hint').style.display = 'none';
  if (def.bg) setSceneBg(def.bg);
  dlgRender();
}
function dlgSetPortrait(line: DlgLine) {
  const L = $('#dlgPortrait'), R = $('#dlgPortraitR');
  [L, R].forEach(p => { p.classList.remove('on', 'silhouette'); p.style.backgroundImage = ''; });
  const name = line.silhouette || line.portrait;
  if (!name) return;
  const slot = line.side === 'right' ? R : L;
  loadArt(name).then(img => { if (img && dlgActive) { slot.style.backgroundImage = `url("${artUrl(name)}")`; slot.classList.add('on'); if (line.silhouette) slot.classList.add('silhouette'); } });
}
function dlgRender() {
  clearTimeout(dlgAutoTimer);
  const line = dlgLines[dlgIdx];
  if (!line) { dlgFinishList(); return; }
  $('#dialogue').classList.remove('stroke', 'choosing'); dlgAwaitStroke = false;
  dlgSetPortrait(line);
  $('#dlgSpeaker').textContent = line.speaker || '';
  $('#dlgText').textContent = line.text || '';
  const ch = $('#dlgChoices'); ch.innerHTML = '';
  if (line.choice) {
    $('#dialogue').classList.add('choosing');
    line.choice.forEach(c => {
      const b = document.createElement('button'); b.className = 'dlgChoice';
      b.innerHTML = `${c.text}${c.hint ? `<small>${c.hint}</small>` : ''}`;
      b.addEventListener('click', ev => { ev.stopPropagation(); dlgChoose(c.styleId); });
      ch.appendChild(b);
    });
    return;
  }
  if (line.stroke) { $('#dialogue').classList.add('stroke'); dlgAwaitStroke = true; return; }
  if (dlgAuto) dlgAutoTimer = setTimeout(dlgAdvance, (1800 + (line.text?.length || 0) * 45) * dlgSpeedMul) as unknown as number;   // 설정: 대화 속도
}
function dlgAdvance() {
  if (!dlgActive) return;
  clearTimeout(dlgAutoTimer);
  const line = dlgLines[dlgIdx];
  if (line && (line.choice || (line.stroke && dlgAwaitStroke))) return;   // 선택/획 대기 중엔 탭 무시
  dlgIdx++;
  if (dlgIdx < dlgLines.length) dlgRender(); else dlgFinishList();
}
function dlgFinishList() {
  if (!dlgInReaction && dlgDef?.next) { const nx = dlgDef.next, done = dlgOnDone; playDialogue(nx, done || (() => {})); return; }
  dlgFinish();
}
function dlgChoose(styleId: string) {
  setStyle(styleId); saveGame();
  $('#dialogue').classList.remove('choosing');
  const react = dlgDef?.reactions?.[styleId];
  if (react && react.length) { dlgLines = react; dlgIdx = 0; dlgInReaction = true; dlgRender(); }
  else dlgFinish();
}
function dlgSkip() {
  clearTimeout(dlgAutoTimer);
  while (dlgActive) {
    const line = dlgLines[dlgIdx];
    if (!line) { dlgFinishList(); return; }
    if (line.choice || line.stroke) { dlgRender(); return; }   // 선택/획에서 멈춤
    dlgIdx++;
  }
}
function dlgFinish() {
  dlgActive = false; dlgAwaitStroke = false; clearTimeout(dlgAutoTimer);
  $('#dialogue').classList.remove('on', 'stroke', 'choosing'); $('#app').classList.remove('dlg-open');
  const cb = dlgOnDone; dlgOnDone = null; dlgDef = null;
  if (cb) cb();
}
function maybeStartPrologue() {
  if (prologueDone) return;
  playDialogue('prologue', () => { prologueDone = true; saveGame(); enterMap(); });   // 프롤로그→유파선택→스테이지1 진입
}
$('#dlgBox').addEventListener('click', () => { if (!dlgAwaitStroke) dlgAdvance(); });
$('#dlgSkip').addEventListener('click', ev => { ev.stopPropagation(); dlgSkip(); });
$('#dlgAuto').addEventListener('click', ev => { ev.stopPropagation(); dlgAuto = !dlgAuto; $('#dlgAuto').classList.toggle('active', dlgAuto); if (dlgAuto) dlgAdvance(); });

/* ---- T2-04 상점(行商) 씬 ---- */
let shopActive = false;
function enterShop() {
  shopActive = true; $('#shop').classList.add('on'); $('#hint').style.display = 'none';
  $('#shopHint').textContent = '';
  setSceneBg('bg_camp');
  const pt = $('#shopPortrait'); pt.classList.remove('on'); pt.style.backgroundImage = '';
  loadArt('portrait_merchant').then(img => { if (img && shopActive) { pt.style.backgroundImage = `url("${artUrl('portrait_merchant')}")`; pt.classList.add('on'); } });
  renderShop();
}
function exitShop() {
  if (!shopActive) return;
  shopActive = false; $('#shop').classList.remove('on'); setSceneBg(null);
  runAfterScene(true);
}
function renderShop() {
  $('#shopGold').textContent = `소지금 ${gold}냥 · Lv.${playerLevel()} · ${SWORDS[equippedSword].name}`;
  const row = (id: string) => {
    const it = ITEMS[id];
    const isSword = it.kind === 'sword';
    const owned = isSword ? (id === equippedSword || (inventory['sword_' + id] ?? 0) > 0) : false;
    let btn: string;
    if (isSword && id === equippedSword) btn = `<span class="shopOwned">장착 중</span>`;
    else if (isSword && owned) btn = `<button class="shopBuy" data-equip="${id}">장착</button>`;
    else btn = `<button class="shopBuy" data-buy="${id}" ${gold < it.price ? 'disabled' : ''}>${it.price}냥</button>`;
    const cnt = !isSword && (inventory[id] ?? 0) > 0 ? ` <span class="shopCnt">×${inventory[id]}</span>` : '';
    return `<div class="shopItem"><div class="shopMeta"><b>${it.name}</b>${cnt}<small>${it.desc}</small></div>${btn}</div>`;
  };
  const consumables = Object.keys(CONSUMABLES).map(row).join('');
  const swords = Object.keys(SWORDS).filter(id => id !== 'nameless' || equippedSword === 'nameless').map(row).join('');
  $('#shopList').innerHTML = `<div class="shopSec">소모품 (관찰 중 사용)</div>${consumables}<div class="shopSec">검 (반격 위력)</div>${swords}`;
  $('#shopList').querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buyItem((b as HTMLElement).dataset.buy!)));
  $('#shopList').querySelectorAll('[data-equip]').forEach(b => b.addEventListener('click', () => equipSword((b as HTMLElement).dataset.equip!)));
}
function buyItem(id: string) {
  const it = ITEMS[id]; if (!it || gold < it.price) return;
  gold -= it.price;
  if (it.kind === 'sword') { inventory['sword_' + id] = 1; equippedSword = id; $('#shopHint').textContent = `${it.name} 구매·장착 (위력 +${it.power})`; }
  else { inventory[id] = (inventory[id] ?? 0) + 1; $('#shopHint').textContent = `${it.name} 구매 (보유 ${inventory[id]})`; }
  updatePlayerHud(); saveGame(); renderShop();
}
function equipSword(id: string) {
  if (!SWORDS[id]) return;
  equippedSword = id; $('#shopHint').textContent = `${SWORDS[id].name} 장착 (위력 +${SWORDS[id].power})`;
  updatePlayerHud(); saveGame(); renderShop();
}
$('#shopExit').addEventListener('click', exitShop);

// (부팅 로드는 하단 부트 블록에서 — setStyle→buildPad가 PAD 상수 초기화 이후여야 함)

/* ---- 검로(劍路) 입력: Pointer Events. T0-02 ---- */
let drawing = false, points: Pt[] = [], t0 = 0, gRect: DOMRect | null = null;
const relX = (e: PointerEvent) => e.clientX - gRect!.left, relY = (e: PointerEvent) => e.clientY - gRect!.top;
canvas.addEventListener('pointerdown', e => {
  if (arcadeActive && e.pointerType === 'touch') { e.preventDefault(); acTouchDown(e); return; }   // 트윈스틱(모바일)
  if (!arbiter.tryAcquire('gesture')) return;
  gRect = canvas.getBoundingClientRect();
  drawing = true; t0 = performance.now();
  points = [{ x: relX(e), y: relY(e), t: 0 }];
  liveTrail = points; try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
});
canvas.addEventListener('pointermove', e => {
  if (arcadeActive && e.pointerType === 'touch') { acTouchMove(e); return; }
  if (!drawing) return;
  points.push({ x: relX(e), y: relY(e), t: performance.now() - t0 });
});
function endStroke() {
  if (!drawing) return; drawing = false;
  arbiter.release('gesture');
  const pts = points; liveTrail = null;
  if (dlgActive) {   // 대화 중: 관대 판정 첫 획 비트만 처리(방향 무관), 그 외 획은 무시
    if (dlgAwaitStroke && pts.length >= 2) { dlgAwaitStroke = false; dlgAdvance(); }
    return;
  }
  const res = judgeStroke(pts, { w: W, h: H }, currentStyle);
  if (pts.length >= 2) {   // [임시 진단 버그3] 순각도(net angle) 표시 — 검증 후 자가진단으로 이동
    const a = pts[0], b = pts[pts.length - 1];
    const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI);
    $('#angDiag').textContent = `[진단] 순각도 ${ang}° → ${res.rejected ? (res.reason ?? '?') : STROKE_TEMPLATES[res.strokeId!].name}`;
  }
  if (res.rejected) { rejectHud(res.reason!); if (pts.length > 1) { lastOverlay = { user: resample(pts, 40), ideal: null, grade: 'miss' }; overlayFade = 1; } return; }
  lastOverlay = { user: resample(pts, 40), ideal: idealForDisplay(res.strokeId!, pts), grade: res.grade! };
  overlayFade = 1;
  pendingFlick = computeFlick(pts);   // 빠른 좌/우 플릭(스텝 회피용) 판정 — 빨강 예고에서만 사용
  const dur = pts.length >= 2 ? (pts[pts.length - 1].t ?? 0) - (pts[0].t ?? 0) : 0;
  pendingHeavy = dur >= BALANCE.momentum.chargeHoldMs;   // 느리게 그은(차지) 획 = 강공격
  emitStroke({ strokeId: res.strokeId!, accuracy: res.accuracy!, grade: res.grade!, inputMode: 'gesture', timestamp: performance.now(), breakdown: res.breakdown });
}
// 빠른 좌/우 플릭 감지: 짧고 빠른 수평 스와이프 = 스텝 회피 입력. balance.spike.judge.
function computeFlick(pts: Pt[]): 'L' | 'R' | null {
  if (pts.length < 2) return null;
  const j = BALANCE.spike.judge;
  const a = pts[0], b = pts[pts.length - 1];
  const dur = (b.t ?? 0) - (a.t ?? 0);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy), ratio = len / Math.min(W, H);
  if (dur > j.flickMaxMs) return null;               // 느리면 플릭 아님(그냥 베기)
  if (Math.abs(dx) < Math.abs(dy) * 1.4) return null; // 수평이어야
  if (ratio < j.flickMinLenRatio || ratio > j.flickMaxLenRatio) return null;
  return dx > 0 ? 'R' : 'L';
}
function onPointerEnd(e: PointerEvent) {
  if (arcadeActive && e.pointerType === 'touch') { acTouchUp(e); return; }
  endStroke();
}
canvas.addEventListener('pointerup', onPointerEnd);
canvas.addEventListener('pointercancel', onPointerEnd);

/* ---- T0-04 검결(劍訣) CommandCapture ---- */
const cmdBuf: CommandInput[] = [];
let cmdTimer: number | undefined;
function pushCommandInput(dir: Dir) {
  if (dlgActive || mapActive) return;   // 대화·지도 중 검결 입력 무시
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
  pendingFlick = null; pendingHeavy = false;   // 검결(커맨드)은 플릭/강공격이 아님
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
  if (arcadeActive) {   // 아케이드: 방향키 이동 + 스페이스 점프 (검결 입력 아님)
    if (e.key === 'ArrowLeft') { acKeys.left = true; e.preventDefault(); return; }
    if (e.key === 'ArrowRight') { acKeys.right = true; e.preventDefault(); return; }
    if (e.key === ' ' || e.key === 'ArrowUp') { if (!e.repeat) acJump(); e.preventDefault(); return; }
    return;
  }
  const dir = KEYMAP[e.key];
  if (!dir || e.repeat || pressed.has(dir)) return;
  pressed.add(dir); pushCommandInput(dir);
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') acKeys.left = false;
  if (e.key === 'ArrowRight') acKeys.right = false;
  const dir = KEYMAP[e.key]; if (dir) pressed.delete(dir);
});

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
$('#btnSound').addEventListener('click', () => { settings.sound = !settings.sound; applySettings(); saveSettings(); });
$('#btnOverlay').addEventListener('click', e => { overlayOn = !overlayOn; const b = e.target as HTMLElement; b.classList.toggle('active', overlayOn); b.textContent = '오버레이 ' + (overlayOn ? 'ON' : 'OFF'); });
// T2-05: 유파는 스토리에서 1회 선택되고 진행 중 잠금(FR-STY-007). 저장 데이터에 styleId 기록.
// 상단 일반 토글은 제거하고 자가진단(개발용)에만 남긴다. 재선택은 회차 시작(새 게임)에서만.
function setStyle(id: string) {
  if (!STYLES[id]) return;
  currentStyleId = id; currentStyle = STYLES[id];
  tracker = createTechniqueTracker(currentStyle);
  buildPad();
}
function devToggleStyle() {   // 개발용: 자가진단 패널에서만 노출
  setStyle(currentStyleId === 'uraken' ? 'saken' : 'uraken');
  runSelfTest();
}
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
  const ts = artTuneState();
  const curOverlay = ts.curCombat ? ts.overlayC : ts.overlayN;
  $('#diag').innerHTML = `<h4>자가진단 ${passed}/${T.length} 통과</h4>` +
    `<div class="devrow"><button id="devArcade">[개발] ▶ 이동 스파이크 — 횡스크롤 검객</button></div>` +
    `<div class="devrow"><button id="devMomentum">[개발] ▶ 재설계 스파이크1 — 공격권(낭인검객)</button></div>` +
    `<div class="devrow"><button id="devSpike">[개발] ⚔ 스파이크 전투(늑대) 시작</button></div>` +
    `<div class="devrow"><button id="devStyle">[개발] 유파 전환 · 현재: ${currentStyle.name}</button></div>` +
    `<div class="devtune">
       <label>타격 흔들림 ×<b id="shVal">${feelShakeMul.toFixed(2)}</b>
         <input id="shSlide" type="range" min="0" max="2.5" step="0.1" value="${feelShakeMul}"></label>
       <label>히트스톱 ×<b id="hsVal">${feelHitstopMul.toFixed(2)}</b>
         <input id="hsSlide" type="range" min="0" max="2.5" step="0.1" value="${feelHitstopMul}"></label>
     </div>` +
    `<div class="devtune">
       <label>먹빛 오버레이 <b id="ovVal">${curOverlay.toFixed(2)}</b> <small>(${ts.curCombat ? '전투' : '일반'}${ts.hasBg ? '' : ' · 배경 없음'})</small>
         <input id="ovSlide" type="range" min="0" max="0.8" step="0.02" value="${curOverlay}"></label>
       <label>배경 밝기 <b id="brVal">${ts.brightness.toFixed(2)}</b>
         <input id="brSlide" type="range" min="0.8" max="1.4" step="0.02" value="${ts.brightness}"></label>
       <div class="tunehint">씬(전투/수련 등)을 연 채로 조정 → 적정값을 보고해 주세요. 일반 ${ts.overlayN.toFixed(2)} · 전투 ${ts.overlayC.toFixed(2)}</div>
     </div>` +
    T.map(t => `<div class="${t.ok ? 'pass' : 'fail'}">${t.ok ? '✓' : '✗'} ${t.name}${t.extra != null ? ' · ' + t.extra : ''}</div>`).join('');
  const ds = document.querySelector('#devStyle'); if (ds) ds.addEventListener('click', devToggleStyle);
  const dsp = document.querySelector('#devSpike'); if (dsp) dsp.addEventListener('click', () => { $('#diag').style.display = 'none'; ($('#btnDiag')).classList.remove('active'); enterSpike(); });
  const dmo = document.querySelector('#devMomentum'); if (dmo) dmo.addEventListener('click', () => { $('#diag').style.display = 'none'; ($('#btnDiag')).classList.remove('active'); enterMomentum(); });
  const dac = document.querySelector('#devArcade'); if (dac) dac.addEventListener('click', () => { $('#diag').style.display = 'none'; ($('#btnDiag')).classList.remove('active'); enterArcade(); });
  const sh = document.querySelector('#shSlide') as HTMLInputElement | null;
  const hs = document.querySelector('#hsSlide') as HTMLInputElement | null;
  if (sh) sh.addEventListener('input', () => { feelShakeMul = parseFloat(sh.value); const e = document.querySelector('#shVal'); if (e) e.textContent = feelShakeMul.toFixed(2); });
  if (hs) hs.addEventListener('input', () => { feelHitstopMul = parseFloat(hs.value); const e = document.querySelector('#hsVal'); if (e) e.textContent = feelHitstopMul.toFixed(2); });
  const ov = document.querySelector('#ovSlide') as HTMLInputElement | null;
  const br = document.querySelector('#brSlide') as HTMLInputElement | null;
  if (ov) ov.addEventListener('input', () => { const v = parseFloat(ov.value); tuneArt({ overlay: v }); const e = document.querySelector('#ovVal'); if (e) e.textContent = v.toFixed(2); });
  if (br) br.addEventListener('input', () => { const v = parseFloat(br.value); tuneArt({ brightness: v }); const e = document.querySelector('#brVal'); if (e) e.textContent = v.toFixed(2); });
  console.log(`[소드마스터 자가진단] ${passed}/${T.length} 통과`);
}

/* ---- T2-07 타이틀 + 설정 ---- */
let hasSave = false;
function unlockAudio() { try { audio = audio || new (AC())(); if (audio.state === 'suspended') audio.resume(); } catch (_) { /* noop */ } }
function showTitle() {
  $('#title').classList.add('on'); $('#title').classList.remove('started');
  ($('#tContinue') as HTMLButtonElement).disabled = !hasSave;
  loadArt('bg_title').then(img => { if (img) ($('#titleArt')).style.backgroundImage = `url("${artUrl('bg_title')}")`; });
}
function hideTitle() { $('#title').classList.remove('on', 'started'); }
$('#title').addEventListener('click', () => { if (!$('#title').classList.contains('started')) { unlockAudio(); $('#title').classList.add('started'); } });
let newArm = false, newTimer: number | undefined;
$('#tNew').addEventListener('click', ev => {
  ev.stopPropagation(); const b = $('#tNew');
  if (hasSave && !newArm) { newArm = true; b.textContent = '기존 기록 삭제 · 다시 탭'; clearTimeout(newTimer); newTimer = setTimeout(() => { newArm = false; b.textContent = '새 게임'; }, 2600) as unknown as number; return; }
  newArm = false; clearTimeout(newTimer); b.textContent = '새 게임';
  hideTitle(); resetGame(); hasSave = true; maybeStartPrologue();
});
$('#tContinue').addEventListener('click', ev => { ev.stopPropagation(); if (!hasSave) return; hideTitle(); enterMap(); });
$('#tSettings').addEventListener('click', ev => { ev.stopPropagation(); openSettings(); });
$('#tFeedback').addEventListener('click', ev => { ev.stopPropagation(); const url = BALANCE.links.feedback; if (url) window.open(url, '_blank', 'noopener'); else toast('피드백 링크는 준비 중입니다'); });

const SET_OPTS: Record<string, [string, string][]> = {
  sound: [['on', '켜기'], ['off', '끄기']], haptic: [['on', '켜기'], ['off', '끄기']],
  difficulty: [['standard', '표준'], ['lenient', '관대']],
  dlgSpeed: [['slow', '느림'], ['normal', '보통'], ['fast', '빠름']],
  padSize: [['small', '작게'], ['normal', '보통'], ['large', '크게']],
};
function curSet(key: string): string {
  if (key === 'sound') return settings.sound ? 'on' : 'off';
  if (key === 'haptic') return settings.haptic ? 'on' : 'off';
  return (settings as unknown as Record<string, string>)[key];
}
function renderSettings() {
  document.querySelectorAll('#settings .setOpts').forEach(box => {
    const key = (box as HTMLElement).dataset.key!; const cur = curSet(key);
    box.innerHTML = SET_OPTS[key].map(([v, l]) => `<button data-v="${v}" class="${v === cur ? 'sel' : ''}">${l}</button>`).join('');
    box.querySelectorAll('button').forEach(bt => bt.addEventListener('click', () => setSetting(key, (bt as HTMLElement).dataset.v!)));
  });
}
function setSetting(key: string, v: string) {
  if (key === 'sound') settings.sound = v === 'on';
  else if (key === 'haptic') settings.haptic = v === 'on';
  else (settings as unknown as Record<string, string>)[key] = v;
  applySettings(); saveSettings(); renderSettings();
}
function openSettings() { renderSettings(); $('#settings').classList.add('on'); }
$('#setClose').addEventListener('click', () => $('#settings').classList.remove('on'));

/* ---- 부트 ---- */
resize(); buildPad(); draw(); updateTech(null); runSelfTest();
loadSettings();                 // T2-07: 전역 설정
hasSave = loadGame();           // T2-02: 이어하기 로드(PAD·buildPad 이후 — setStyle 안전)
showTitle();                    // T2-07: 타이틀 → 새 게임/이어하기 분기
