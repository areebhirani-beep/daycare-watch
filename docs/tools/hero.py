"""Render the README hero: three real app screenshots in phone frames on a plain background.

Usage (from the repo root):
    uv run --with pillow python docs/tools/hero.py --theme light \
        docs/screenshots/01-home.jpg docs/screenshots/03-place-overview.jpg docs/screenshots/07-alert.jpg
    uv run --with pillow python docs/tools/hero.py --theme dark \
        docs/screenshots/dark/01-home.jpg docs/screenshots/dark/03-place-overview.jpg docs/screenshots/dark/07-alert.jpg

Writes docs/screenshots/hero-<theme>.png. Only drawing: the screenshots are pasted as they are.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 2400, 1350
THEMES = {
    "light": {"top": (246, 246, 248), "bottom": (232, 232, 237), "bezel": (17, 17, 19), "edge": (60, 60, 66),
              "shadow": (0, 0, 0, 70)},
    "dark": {"top": (22, 22, 25), "bottom": (8, 8, 10), "bezel": (36, 36, 40), "edge": (82, 82, 90),
             "shadow": (0, 0, 0, 160)},
}
SCREEN_H = 1120  # middle phone; the side phones are 92% of it
BEZEL = 22
SIDE_SCALE = 0.92
GAP = 90


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def phone(shot: Image.Image, screen_h: int, theme: dict[str, tuple[int, ...]]) -> Image.Image:
    """The screenshot with rounded corners inside a bezel, as one RGBA image."""
    screen_w = round(shot.width * screen_h / shot.height)
    screen = shot.convert("RGB").resize((screen_w, screen_h), Image.LANCZOS)
    r_screen = round(screen_w * 0.12)
    fw, fh = screen_w + 2 * BEZEL, screen_h + 2 * BEZEL
    frame = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle((0, 0, fw - 1, fh - 1), radius=r_screen + BEZEL, fill=theme["bezel"],
                        outline=theme["edge"], width=3)
    frame.paste(screen, (BEZEL, BEZEL), rounded_mask((screen_w, screen_h), r_screen))
    return frame


def shadow(img: Image.Image, color: tuple[int, ...], blur: int = 38, dy: int = 28) -> Image.Image:
    pad = blur * 3
    base = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad + dy), (0, 0, 0, 0))
    sil = Image.new("RGBA", img.size, color)
    base.paste(sil, (pad, pad + dy), img.getchannel("A"))
    return base.filter(ImageFilter.GaussianBlur(blur))


def render(shots: list[Path], theme_name: str, out: Path) -> None:
    theme = THEMES[theme_name]
    canvas = Image.new("RGBA", (W, H))
    top, bottom = theme["top"], theme["bottom"]
    grad = ImageDraw.Draw(canvas)
    for y in range(H):
        t = y / (H - 1)
        grad.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom, strict=True)))
    phones = [phone(Image.open(p), round(SCREEN_H * (1 if i == 1 else SIDE_SCALE)), theme)
              for i, p in enumerate(shots)]
    total = sum(p.width for p in phones) + GAP * (len(phones) - 1)
    x = (W - total) // 2
    for i, ph in enumerate(phones):
        y = (H - ph.height) // 2 + (0 if i == 1 else 24)
        sh = shadow(ph, theme["shadow"])
        pad = (sh.width - ph.width) // 2
        canvas.alpha_composite(sh, (x - pad, y - pad))
        canvas.alpha_composite(ph, (x, y))
        x += ph.width + GAP
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(out, optimize=True)
    print(f"wrote {out} {W}x{H}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--theme", choices=sorted(THEMES), default="light")
    ap.add_argument("--out", type=Path)
    ap.add_argument("shots", nargs=3, type=Path, help="left, middle, right screenshots")
    args = ap.parse_args()
    render(args.shots, args.theme, args.out or Path(f"docs/screenshots/hero-{args.theme}.png"))


if __name__ == "__main__":
    main()
