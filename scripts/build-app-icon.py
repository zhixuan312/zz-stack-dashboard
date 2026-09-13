"""Build the ZZ app icon set from the purpose-drawn app-icon master.

Requires Pillow (`pip install Pillow`). It is an ambient dependency: this repository has no
requirements.txt or pyproject.toml.

Source: public/assets/brand-kit-sheet.png, the "03 APP ICON" squircle at
(1013,70)-(1196,249) native — 183x179 px. Everything above ~180px is therefore
an upscale of a contact-sheet crop, not a fresh render.

A mobile app icon must be full-bleed: iOS applies its own squircle and Android
its own mask, so baked-in rounded corners show up as a dark ring inside the
system mask. The kit's panel has white sheet corners, so the lavender ground is
extrapolated outward and the artwork composited back over it.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
# The MASTER, not a contact-sheet panel. The first version of this script cropped a
# 183x179 region of brand-kit-sheet.png that the sheet itself labelled "1024 x 1024" --
# drawn-on annotation, not a file size -- so every icon above ~180px was an upscale.
# This master is a real 1254x1254 render.
SHEET = ROOT / 'design/in-use/app-icon-squircle.png'
OUT = ROOT / 'public/assets/app-icon/'
BOX = None                       # the master is full-bleed; no crop
CORNER_R = 0.22                  # squircle radius as a fraction of the side
GRID = 12                        # cells per side for the ground extrapolation

_img = Image.open(SHEET).convert('RGB')
src = _img if BOX is None else _img.crop(BOX)
w, h = src.size
px = src.load()


def is_ground(p):
    """A lavender squircle-background pixel, not the cream/dark mascot."""
    r, g, b = p
    return b - g > 14 and b - r > 6 and b > 200


# --- 1. extrapolate the lavender ground over the whole square --------------
cells = [[None] * GRID for _ in range(GRID)]
for cy in range(GRID):
    for cx in range(GRID):
        x0, x1 = cx * w // GRID, (cx + 1) * w // GRID
        y0, y1 = cy * h // GRID, (cy + 1) * h // GRID
        acc, n = [0, 0, 0], 0
        for y in range(y0, y1):
            for x in range(x0, x1):
                p = px[x, y]
                if is_ground(p):
                    acc[0] += p[0]; acc[1] += p[1]; acc[2] += p[2]; n += 1
        if n >= 12:
            cells[cy][cx] = (acc[0] // n, acc[1] // n, acc[2] // n)

# fill the cells the mascot covers from their nearest known neighbour, so the
# grid stays a smooth field rather than a hole
for _ in range(GRID * 2):
    if all(c is not None for row in cells for c in row):
        break
    nxt = [row[:] for row in cells]
    for cy in range(GRID):
        for cx in range(GRID):
            if cells[cy][cx] is not None:
                continue
            near = [cells[cy + dy][cx + dx]
                    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))
                    if 0 <= cy + dy < GRID and 0 <= cx + dx < GRID
                    and cells[cy + dy][cx + dx] is not None]
            if near:
                nxt[cy][cx] = tuple(sum(c[i] for c in near) // len(near) for i in range(3))
    cells = nxt

grid = Image.new('RGB', (GRID, GRID))
for cy in range(GRID):
    for cx in range(GRID):
        grid.putpixel((cx, cy), cells[cy][cx])
ground = grid.resize((w, h), Image.BICUBIC)

# --- 2. composite the real artwork over the ground -------------------------
# The background is found by flooding inward from the four corners, NOT by a
# colour test: the helmet's cream (#F8EFEA) and its specular highlights are
# within a hair of the sheet's white, and a global test punches holes in them.
probe = src.copy()
SENTINEL = (1, 2, 3)
for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
    ImageDraw.floodfill(probe, seed, SENTINEL, thresh=25)
pp = probe.load()
alpha = Image.new('L', (w, h), 0)
ap = alpha.load()
for y in range(h):
    for x in range(w):
        ap[x, y] = 0 if pp[x, y] == SENTINEL else 255
# Erode 3px: that drops the squircle's own glossy rim along with the
# anti-aliased white edge. Keeping the rim would leave a ghost outline sitting
# just inside whatever mask iOS or Android draws. Then feather into the ground.
for _ in range(3):
    alpha = alpha.filter(ImageFilter.MinFilter(3))
alpha = alpha.filter(ImageFilter.GaussianBlur(1.1))
flat = ground.copy()
flat.paste(src, (0, 0), alpha)

# --- 3. upscale ------------------------------------------------------------
master = flat.resize((1024, 1024), Image.LANCZOS)
master = master.filter(ImageFilter.UnsharpMask(radius=3, percent=60, threshold=2))
master.save(OUT / 'app-icon-1024.png')

# --- 4. maskable variant ---------------------------------------------------
# Android's circle mask eats the outer ~19% of the canvas, which is exactly
# where the bear ears and the two sparkles sit. Shrink the art onto the same
# lavender ground so the launcher never clips them.
SAFE = 717                                        # 70% of 1024
OFF = (1024 - SAFE) // 2
art = master.resize((SAFE, SAFE), Image.LANCZOS)

# The ground behind it has to be the SAME gradient continued outward, or the
# shrunk art reads as a square tile pasted on a different purple. Clamp the
# ground's edge pixels out to the canvas instead of re-stretching the gradient.
g = ground.resize((SAFE, SAFE), Image.BICUBIC)
bg = Image.new('RGB', (1024, 1024))
bg.paste(g, (OFF, OFF))
r = 1024 - SAFE - OFF                              # right/bottom band width
bg.paste(g.crop((0, 0, 1, SAFE)).resize((OFF, SAFE)), (0, OFF))
bg.paste(g.crop((SAFE - 1, 0, SAFE, SAFE)).resize((r, SAFE)), (OFF + SAFE, OFF))
bg.paste(bg.crop((0, OFF, 1024, OFF + 1)).resize((1024, OFF)), (0, 0))
bg.paste(bg.crop((0, OFF + SAFE - 1, 1024, OFF + SAFE)).resize((1024, r)), (0, OFF + SAFE))
bg = bg.filter(ImageFilter.GaussianBlur(12))

corner = Image.new('L', (SAFE, SAFE), 0)
ImageDraw.Draw(corner).rounded_rectangle((0, 0, SAFE - 1, SAFE - 1),
                                         radius=int(SAFE * CORNER_R), fill=255)
corner = corner.filter(ImageFilter.GaussianBlur(26))
maskable = bg.copy()
maskable.paste(art, (OFF, OFF), corner)
maskable.save(OUT / 'app-icon-maskable-1024.png')

# --- 5. derived sizes ------------------------------------------------------
for size in (512, 192, 180, 64):
    name = 'apple-touch-icon-180.png' if size == 180 else f'app-icon-{size}.png'
    master.resize((size, size), Image.LANCZOS).save(OUT / name)
for size in (512, 192):
    maskable.resize((size, size), Image.LANCZOS).save(OUT / f'app-icon-maskable-{size}.png')
print('written')
