/// <reference types="vite/client" />
// 아트 로딩 계층 (DOM). 씬 진입 시 지연 로드 + 실패 시 기존 도형/무배경 폴백.
// 원본 PNG는 assets/art/raw 보존, 빌드는 public/art/*.webp 사용(WebP q80, 95% 절감).
import { BALANCE } from './engine';

const BASE = import.meta.env.BASE_URL; // '/swordmaster-road/'
export const artUrl = (name: string) => `${BASE}art/${name}.webp`;

const cache = new Map<string, Promise<HTMLImageElement | null>>();
/** 이미지 1장 지연 로드. 실패(404 등)면 null → 호출부가 폴백 유지. */
export function loadArt(name: string): Promise<HTMLImageElement | null> {
  let p = cache.get(name);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = artUrl(name);
    });
    cache.set(name, p);
  }
  return p;
}

// 실시간 튜닝 값(자가진단 슬라이더로 조정). 기본은 balance.art에서. 확정 시 balance에 반영.
const tune = { overlayN: BALANCE.art.bgOverlay, overlayC: BALANCE.art.bgOverlayCombat, brightness: BALANCE.art.bgBrightness };
let curBg: string | null = null, curCombat = false;

function paintBg(el: HTMLElement) {
  if (!curBg) { el.style.backgroundImage = ''; el.style.filter = ''; el.classList.remove('on'); return; }
  const a = curCombat ? tune.overlayC : tune.overlayN;
  el.style.backgroundImage = `linear-gradient(rgba(18,15,12,${a}), rgba(18,15,12,${a})), url("${artUrl(curBg)}")`;
  el.style.filter = `brightness(${tune.brightness})`;
  el.classList.add('on');
}

/** 전체 화면 배경 레이어(#sceneBg)에 아트 적용. name=null이면 배경 해제(도형 UI만).
 *  성공 시에만 이미지+먹빛 오버레이(+밝기)를 얹고, 실패하면 배경을 건드리지 않는다. */
let bgToken = 0;
export function setSceneBg(name: string | null, combat = false): void {
  const el = document.querySelector('#sceneBg') as HTMLElement | null;
  if (!el) return;
  const token = ++bgToken;
  if (!name) { curBg = null; paintBg(el); return; }
  loadArt(name).then((img) => {
    if (token !== bgToken) return;      // 더 최근 씬 전환이 있었으면 무시
    if (!img) { curBg = null; paintBg(el); return; }   // 폴백: 배경 없음
    curBg = name; curCombat = combat; paintBg(el);
  });
}

/** 자가진단 슬라이더용: 오버레이(현재 씬 유형)·밝기 실시간 조정 후 즉시 반영. */
export function tuneArt(patch: Partial<{ overlay: number; brightness: number }>): void {
  if (patch.overlay !== undefined) { if (curCombat) tune.overlayC = patch.overlay; else tune.overlayN = patch.overlay; }
  if (patch.brightness !== undefined) tune.brightness = patch.brightness;
  const el = document.querySelector('#sceneBg') as HTMLElement | null;
  if (el) paintBg(el);
}
export function artTuneState() { return { overlayN: tune.overlayN, overlayC: tune.overlayC, brightness: tune.brightness, curCombat, hasBg: !!curBg }; }
