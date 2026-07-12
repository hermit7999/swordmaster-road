"""compare_shot — 스프라이트들을 배경 위에 나란히 합성해 그림체 일관성 비교샷 생성.
같은 필드에 서도 안 어색한지 눈으로 판정하기 위한 것. PIL만 사용(torch 불필요).

예: python compare_shot.py --bg public/art/bg_forest.webp --out tools/out/compare.png \
      public/art/acade/enemy_goblin.webp public/art/acade/enemy_shieldman.webp public/art/acade/enemy_archer.webp
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

REPO = Path(__file__).resolve().parent.parent


def rp(p: str) -> Path:
    q = Path(p)
    return q if q.is_absolute() else (REPO / p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bg", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--height", type=int, default=520)
    ap.add_argument("--sprite-h", type=int, default=300, help="스프라이트 목표 높이(px)")
    ap.add_argument("--slot", type=int, default=360, help="칸 너비(px)")
    ap.add_argument("--labels", default="", help="쉼표구분 라벨(선택)")
    ap.add_argument("sprites", nargs="+")
    a = ap.parse_args()

    from PIL import Image, ImageDraw
    n = len(a.sprites)
    W, H = a.slot * n, a.height
    canvas = Image.open(rp(a.bg)).convert("RGB").resize((W, H)).convert("RGBA")
    canvas = Image.alpha_composite(canvas, Image.new("RGBA", (W, H), (10, 8, 6, 90)))  # 세트 톤 오버레이
    ground_y = int(H * 0.92)
    labels = [s.strip() for s in a.labels.split(",")] if a.labels else []
    dr = ImageDraw.Draw(canvas)
    for i, sp in enumerate(a.sprites):
        im = Image.open(rp(sp)).convert("RGBA")
        sc = a.sprite_h / im.height
        im = im.resize((max(1, int(im.width * sc)), a.sprite_h))
        cx = a.slot * i + a.slot // 2
        canvas.alpha_composite(im, (cx - im.width // 2, ground_y - im.height))
        lab = labels[i] if i < len(labels) else Path(sp).stem
        dr.text((cx - len(lab) * 3, H - 16), lab, fill=(230, 220, 195, 220))
    out = rp(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out)
    print("saved", out)


if __name__ == "__main__":
    main()
