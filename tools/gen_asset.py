"""gen_asset — 로컬 diffusion(ModelFit 엔진)으로 게임 아트를 생성·누끼하는 다리.

방식: ModelFit의 인페인트 파이프라인(DreamShaper-8-inpaint + IP-Adapter + LCM)을
      "전체 흰 마스크 인페인트 + IP-Adapter(스타일 앵커)" 트릭으로 써서
      txt2img처럼 새 그림을 뽑는다. 추가 다운로드 0(HF 오프라인 강제).

스타일 앵커: 같은 부류를 물려야 이식이 정확하다.
  monster    -> public/art/enemy_goblin.webp (또는 가장 유사한 기존 몬스터)
  background -> public/art/bg_forest.webp
  person     -> public/art/portrait_hero.webp
  (또는 --anchor 에 파일 경로/파일명을 직접 지정)

출력: assets/acade/<name>[_ip<scale>].png (원본)
      public/art/acade/<name>[_ip<scale>].webp (모서리색 누끼)

GPU 규칙(6GB 1660 SUPER, 동시 1장):
  - 생성 전 :7860(ModelFit 앱) 가동 여부 + 여유 VRAM 확인
  - 여유 VRAM 부족(=점유 중)이면 실패시키지 않고 대기 후 안내
  - 락파일로 gen_asset 동시 실행 차단

실행: ModelFit venv 파이썬으로 돌린다.
  D:\ai_factory\contents\modelfit\spike\.venv\Scripts\python.exe tools\gen_asset.py ...
"""
from __future__ import annotations
import argparse
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

# Windows 콘솔(cp949)에서 한글·em-dash·一 등 출력 시 인코딩 오류 방지
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# --- 경로 상수 ---
REPO = Path(__file__).resolve().parent.parent            # D:\swordmaster-road
MODELFIT = Path(r"D:\ai_factory\contents\modelfit")
MODELFIT_CORE = MODELFIT / "core"
HF_CACHE = MODELFIT / "spike" / "hf_cache"
RAW_DIR = REPO / "assets" / "acade"
NUKI_DIR = REPO / "public" / "art" / "acade"
ART_DIR = REPO / "public" / "art"
LOCK = Path(__file__).resolve().parent / ".gen_asset.lock"

ANCHOR_KEYS = {
    "monster": ART_DIR / "enemy_goblin.webp",
    "background": ART_DIR / "bg_forest.webp",
    "person": ART_DIR / "portrait_hero.webp",
}
MODELS_DIR = Path(__file__).resolve().parent / "models"   # 로컬 다운로드 체크포인트(gitignore)
IP_ADAPTER_REPO = "h94/IP-Adapter"
IP_ADAPTER_WEIGHT = "ip-adapter_sd15.bin"
LCM_LORA = "latent-consistency/lcm-lora-sdv1-5"

# 캐시 위치만 지정(추가 다운로드 0 — 모델은 전부 캐시됨). :7860 앱과 동일하게
# HF_HUB_OFFLINE은 걸지 않는다: 오프라인 강제 시 engine.py의 load_lora_weights가
# weight_name 없이 실패한다. 캐시가 완비돼 있어 실제 다운로드는 발생하지 않는다.
os.environ.setdefault("HF_HOME", str(HF_CACHE))

NEG = ("color photo, photorealistic, 3d render, colorful background, gradient background, "
       "vignette, scenery, landscape, cluttered background, shadow on background, "
       "multiple characters, text, watermark, signature, blurry, low quality, "
       "jpeg artifacts, deformed, bad anatomy, extra limbs, extra arrows, cropped, frame, border")


# ---------------- GPU 점유 확인 / 대기 ----------------
def _smi_free_mib() -> int | None:
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            stderr=subprocess.DEVNULL, timeout=15)
        return int(out.decode().splitlines()[0].strip())
    except Exception:
        return None


def _port_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def wait_for_gpu(min_free: int, wait_s: int, poll_s: int = 12) -> bool:
    """여유 VRAM이 min_free 이상 될 때까지 대기. 시간 내 확보 실패 시 False(안내용)."""
    app_up = _port_open(7860)
    print(f"[gpu] :7860 ModelFit 앱 가동 = {app_up}")
    deadline = time.time() + wait_s
    while True:
        free = _smi_free_mib()
        if free is None:
            print("[gpu] nvidia-smi 조회 불가 — 프리체크 생략하고 진행 시도")
            return True
        if free >= min_free:
            print(f"[gpu] 여유 VRAM {free}MiB >= {min_free}MiB — 진행")
            return True
        remain = int(deadline - time.time())
        if remain <= 0:
            print(f"[gpu] 여유 VRAM {free}MiB < {min_free}MiB — 대기 시간 초과.")
            return False
        hint = "(:7860 앱이 생성 중이거나 다른 앱이 GPU 점유)" if app_up else "(다른 앱이 GPU 점유)"
        print(f"[gpu] 여유 VRAM {free}MiB < {min_free}MiB {hint} — {poll_s}s 후 재확인 (남은 대기 {remain}s)")
        time.sleep(poll_s)


# ---------------- 모서리색 누끼 ----------------
def nuki(img, tol: int) -> "Image.Image":
    """네 모서리에서 flood-fill로 배경(연결된 단색)만 투명화 → 알파 bbox 크롭."""
    from PIL import Image, ImageDraw
    rgb = img.convert("RGB")
    W, H = rgb.size
    work = rgb.copy()
    MARK = (255, 0, 255)
    for corner in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
        ImageDraw.floodfill(work, corner, MARK, thresh=tol)
    rgba = rgb.convert("RGBA")
    wp = work.load()
    rp = rgba.load()
    for y in range(H):
        for x in range(W):
            if wp[x, y] == MARK:
                r, g, b, _ = rp[x, y]
                rp[x, y] = (r, g, b, 0)
    bbox = rgba.getbbox()
    if bbox:
        pad = 6
        x0 = max(0, bbox[0] - pad); y0 = max(0, bbox[1] - pad)
        x1 = min(W, bbox[2] + pad); y1 = min(H, bbox[3] + pad)
        rgba = rgba.crop((x0, y0, x1, y1))
    return rgba


# ---------------- 생성 ----------------
def resolve_anchor(anchor: str) -> Path:
    if anchor in ANCHOR_KEYS:
        p = ANCHOR_KEYS[anchor]
    else:
        p = Path(anchor)
        if not p.is_absolute():
            for base in (ART_DIR, NUKI_DIR, REPO):
                if (base / anchor).exists():
                    p = base / anchor
                    break
    if not p.exists():
        sys.exit(f"[err] 앵커 이미지를 찾을 수 없음: {anchor} -> {p}")
    return p


def load_anchor_rgb(path: Path, size: int = 512):
    from PIL import Image, ImageOps
    im = Image.open(path).convert("RGBA")
    # 누끼(투명) 앵커는 중립 회색에 합성해 배경 편향 제거
    bg = Image.new("RGBA", im.size, (128, 128, 128, 255))
    im = Image.alpha_composite(bg, im).convert("RGB")
    return ImageOps.contain(im, (size, size))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="출력 파일명(확장자 없이), 예: enemy_archer")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--anchor", default="monster",
                    help="monster|background|person 또는 파일경로/파일명")
    ap.add_argument("--ip-scale", type=float, nargs="+", default=[0.6],
                    help="IP-Adapter 스타일 강도. 여러 값 주면 변형 각각 생성")
    ap.add_argument("--model", default=None,
                    help="txt2img 스타일 체크포인트(.safetensors/.ckpt) 경로/파일명. 주면 txt2img 모드, 없으면 인페인트 트릭")
    ap.add_argument("--lcm", action="store_true", help="txt2img에서 LCM-LoRA 융합(빠름, 화풍은 약간 완화)")
    ap.add_argument("--no-ip", action="store_true", help="txt2img에서 IP-Adapter 앵커 미사용(체크포인트 화풍만)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--width", type=int, default=512)
    ap.add_argument("--height", type=int, default=512)
    ap.add_argument("--steps", type=int, default=None, help="미지정 시 모드별 기본(LCM/인페인트 8, txt2img 24)")
    ap.add_argument("--guidance", type=float, default=None, help="미지정 시 모드별 기본(LCM/인페인트 1.8, txt2img 7.0)")
    ap.add_argument("--bg-color", default="58,58,66", help="init/단색배경 R,G,B")
    ap.add_argument("--nuki-tol", type=int, default=40, help="누끼 flood-fill 허용오차")
    ap.add_argument("--min-free", type=int, default=3200, help="필요 여유 VRAM(MiB)")
    ap.add_argument("--wait", type=int, default=240, help="GPU 점유 시 최대 대기(s)")
    args = ap.parse_args()

    # 동시 실행 차단(락)
    if LOCK.exists():
        age = time.time() - LOCK.stat().st_mtime
        if age < 3600:
            sys.exit(f"[err] 다른 gen_asset 실행 중으로 보임(락 {int(age)}s 전). 끝나면 재시도.")
    LOCK.write_text(str(os.getpid()), encoding="utf-8")

    try:
        if not wait_for_gpu(args.min_free, args.wait):
            print("\n[안내] GPU가 점유 중입니다(여유 VRAM 부족). 아래 중 하나 후 재시도해 주세요:")
            print("  - :7860 ModelFit 앱 생성이 끝날 때까지 대기, 또는 앱 잠시 정지")
            print("  - 다른 GPU 사용 앱(브라우저 등) 정리")
            sys.exit(2)

        RAW_DIR.mkdir(parents=True, exist_ok=True)
        NUKI_DIR.mkdir(parents=True, exist_ok=True)
        W, H = args.width, args.height

        import torch
        from PIL import Image

        use_ip = not args.no_ip
        anchor_path = resolve_anchor(args.anchor) if use_ip else None
        anchor_img = load_anchor_rgb(anchor_path, size=max(W, H)) if use_ip else None
        print(f"[gen] 앵커: {anchor_path.name if anchor_path else '(없음)'}  프롬프트: {args.prompt[:60]}...")

        closer = lambda: None
        if args.model:
            # --- txt2img 모드: 스타일 체크포인트(4채널) ---
            from diffusers import (StableDiffusionPipeline, LCMScheduler,
                                   DPMSolverMultistepScheduler)
            mp = Path(args.model)
            if not mp.is_absolute():
                mp = MODELS_DIR / args.model
            if not mp.exists():
                sys.exit(f"[err] 체크포인트 없음: {mp}")
            print(f"[gen] txt2img 체크포인트 로드: {mp.name} (fp32)…")
            pipe = StableDiffusionPipeline.from_single_file(
                str(mp), torch_dtype=torch.float32,
                safety_checker=None, requires_safety_checker=False)
            pipe.set_progress_bar_config(disable=True)
            steps = args.steps or (8 if args.lcm else 24)
            guidance = args.guidance if args.guidance is not None else (1.8 if args.lcm else 7.0)
            if args.lcm:
                pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
                pipe.load_lora_weights(LCM_LORA); pipe.fuse_lora()
            else:
                pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
            if use_ip:
                pipe.load_ip_adapter(IP_ADAPTER_REPO, subfolder="models", weight_name=IP_ADAPTER_WEIGHT)
            pipe.enable_vae_slicing(); pipe.enable_model_cpu_offload()

            def run(scale):
                if use_ip:
                    pipe.set_ip_adapter_scale(scale)
                kw = dict(prompt=args.prompt, negative_prompt=NEG,
                          num_inference_steps=steps, guidance_scale=guidance,
                          height=H, width=W, generator=torch.manual_seed(args.seed))
                if use_ip:
                    kw["ip_adapter_image"] = anchor_img
                return pipe(**kw).images[0]
        else:
            # --- 인페인트 트릭 모드(ModelFit 엔진 재사용) ---
            sys.path.insert(0, str(MODELFIT_CORE))
            from engine import LocalVtonEngine
            bg_color = tuple(int(v) for v in args.bg_color.split(","))
            init = Image.new("RGB", (W, H), bg_color)
            mask = Image.new("L", (W, H), 255)             # 흰=전부 재생성 → txt2img처럼
            steps = args.steps or 8
            guidance = args.guidance if args.guidance is not None else 1.8
            print("[gen] 엔진 로드(fp32 + LCM + IP-Adapter, cpu offload)…")
            eng = LocalVtonEngine(width=W, height=H, use_lcm=True).load()
            pipe = eng.pipe
            closer = eng.close
            if anchor_img is None:   # 인페인트 트릭은 IP 앵커가 필수
                anchor_path = resolve_anchor(args.anchor)
                anchor_img = load_anchor_rgb(anchor_path, size=max(W, H))

            def run(scale):
                pipe.set_ip_adapter_scale(scale)
                return pipe(prompt=args.prompt, negative_prompt=NEG,
                            image=init, mask_image=mask, ip_adapter_image=anchor_img,
                            num_inference_steps=steps, guidance_scale=guidance,
                            height=H, width=W, strength=1.0,
                            generator=torch.manual_seed(args.seed)).images[0]

        multi = len(args.ip_scale) > 1
        outputs = []
        for scale in args.ip_scale:
            tag = f"_ip{str(scale).replace('.', '')}" if multi else ""
            t = time.time()
            out = run(scale)
            dt = time.time() - t
            raw_path = RAW_DIR / f"{args.name}{tag}.png"
            out.save(raw_path)
            cut = nuki(out, args.nuki_tol)
            nuki_path = NUKI_DIR / f"{args.name}{tag}.webp"
            cut.save(nuki_path, "WEBP", quality=92, method=6)
            vram = torch.cuda.max_memory_allocated() / 1e9
            print(f"[gen] ip_scale={scale}  {dt:.1f}s  VRAM {vram:.2f}GB  -> {raw_path.name} / {nuki_path.name}")
            outputs.append((scale, raw_path, nuki_path))

        closer()
        print("\n[done] 생성 완료:")
        for scale, r, n in outputs:
            print(f"  ip{scale}: {r.relative_to(REPO)}  |  {n.relative_to(REPO)}")
    finally:
        LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
