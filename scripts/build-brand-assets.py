"""Derive every runtime brand asset from the masters in design/in-use/.

Requires Pillow, declared in `requirements.txt` at the repository root
(`python3 -m pip install -r requirements.txt`); `build-app-icon.py` has the same one. It was
ambient until CI ran the checks on a clean clone, where both failed for its absence.

Every output is a pure function of a master and a size, so re-running produces byte-identical
output, and the check asserts exactly that.

DELIBERATE: `mascot-working.png` is not built. No surface in the console uses it.
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'design/in-use'
OUT = ROOT / 'public/assets/brand'
OUT.mkdir(parents=True, exist_ok=True)

# `--digest` prints one line per output: its name and the sha256 of its DECODED pixels. The checks
# compare that across a generator run instead of the files' bytes, because PNG encoding is a property
# of the Pillow build's zlib/libpng: the same Pillow version produces different bytes on Linux and on
# macOS for pixel-for-pixel identical images (`app-icon-1024.png` is 1,223,250 bytes on macOS and
# 1,200,072 on Linux, the same picture). Comparing bytes therefore asserted a property of the
# encoder's PLATFORM and could only pass on the machine that produced the committed files — which is
# what CI found the first time it ran this on Linux. The derivation is what must be reproducible.
if '--digest' in sys.argv:
    import hashlib
    for p in sorted(OUT.glob('*.png')):
        im = Image.open(p)
        print(p.name + ' ' + hashlib.sha256(f'{im.size}{im.mode}'.encode() + im.tobytes()).hexdigest())
    raise SystemExit(0)

# The favicon master is a 980x980 purple square centred on an off-white canvas with
# exactly 137px of margin on all four sides.
FAVICON_BOX = (137, 137, 1117, 1117)


def trim(im):
    """Crop to the non-transparent content, so a rendered size means the artwork's size."""
    box = im.getbbox()
    return im.crop(box) if box else im


def fit(im, box):
    """Downscale to fit `box` on the long edge. Never upscales: every master is larger
    than every size we render, and silently enlarging one would hide a missing master."""
    w, h = im.size
    scale = min(box / w, box / h)
    if scale > 1:
        raise SystemExit(f'refusing to upscale {w}x{h} to fit {box}')
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def emit(master, stem, rendered):
    """Write one file, at twice the rendered size.

    `next/image` builds its srcset from the one source it is given and scales down, so a
    2x file gives a sharp 2x entry and a clean 1x downscale. Call sites declare the rendered
    size in `width`/`height`: that is the CSS box, not the file.
    """
    path = SRC / master
    if not path.exists():
        raise SystemExit(f'missing master: {path}')
    art = trim(Image.open(path).convert('RGBA'))
    fit(art, rendered * 2).save(OUT / f'{stem}.png', optimize=True)
    print(f'  {stem:<16} {rendered}px rendered, 2x on disk  <- {master}')


# --- the in-app mark -------------------------------------------------------
emit('wordmark-zz.png', 'wordmark', 60)

# --- the login hero --------------------------------------------------------
emit('mascot-waving.png', 'mascot-hero', 320)

# --- the four state illustrations -----------------------------------------
emit('mascot-bust.png', 'state-empty', 96)
emit('mascot-waving.png', 'state-welcome', 96)
emit('mascot-error.png', 'state-error', 96)
emit('mascot-notfound.png', 'state-notfound', 96)

# --- the three bespoke surfaces -------------------------------------------
emit('mascot-approved.png', 'state-approved', 40)
emit('mascot-goodbye.png', 'state-goodbye', 128)
emit('mascot-thinking.png', 'state-thinking', 72)

# --- the two icons, from the two masters drawn for their size bands --------
#
# DELIBERATE: PNG, not SVG. Tracing the bitmap needs a vectoriser this repository does not
# have, and a hand-drawn approximation would be a different logo. Next's app/ file convention
# accepts icon.png as it does icon.svg.
#
# The two masters are not interchangeable and neither is a scaled copy of the other:
# the flat single-Z reads at 16px in a tab strip where two letters would be mush; the
# mascot squircle has room for the character at 180px and up, which is where a
# home-screen icon earns its personality.
# One size: the tab icon is `app/icon.png`, found by Next's file convention.
def _transparent_corners(tile):
    """Knock the background out from around a rounded tile, leaving its corners CLEAR.

    The master draws a rounded purple square on a WHITE canvas. Crop it and the four
    corners keep that white, so on a dark browser tab the icon shows four bright dots
    around the tile. That is what a reader sees; the tile itself is fine.

    The obvious fix is wrong: "make white transparent" punches a hole straight through
    the `Z`, which is also white. So the background is found by FLOOD FILL from the four
    corners — only white CONNECTED TO THE EDGE goes. White enclosed by purple, which is
    the glyph, is never reached and stays opaque.

    Done at full resolution and downscaled afterwards, so the curve anti-aliases against
    transparency rather than against white and the edge is clean at 32px.
    """
    KEY = (255, 0, 255)          # a colour the kit does not contain
    # DELIBERATE: .copy(). PIL's convert() returns the same object when the mode
    # already matches, so without it the flood fill runs on the tile itself and the
    # finished icon carries magenta in its corners.
    probe = tile.convert('RGB').copy()
    for corner in ((0, 0), (probe.width - 1, 0),
                   (0, probe.height - 1), (probe.width - 1, probe.height - 1)):
        ImageDraw.floodfill(probe, corner, KEY, thresh=60)

    alpha = Image.new('L', tile.size, 255)
    keyed, ap = probe.load(), alpha.load()
    for y in range(tile.height):
        for x in range(tile.width):
            if keyed[x, y] == KEY:
                ap[x, y] = 0

    # Paste onto a clear canvas rather than putalpha onto the tile. `putalpha` leaves the
    # original RGB under the transparent pixels, and if the flood fill touched the tile
    # (PIL's convert() can hand back the same object) that RGB is the key colour — which
    # then bleeds magenta into the rounded edge when LANCZOS resamples. Compositing
    # through the mask makes the cleared area 0,0,0,0, so there is nothing to bleed.
    out = Image.new('RGBA', tile.size, (0, 0, 0, 0))
    out.paste(tile.convert('RGB'), (0, 0), alpha)
    return out


fav = Image.open(SRC / 'favicon-flat.png').convert('RGB').crop(FAVICON_BOX)
_transparent_corners(fav).resize((32, 32), Image.LANCZOS).save(
    ROOT / 'app/icon.png', optimize=True)
print(f'  {"icon (tab)":<16} 32px   <- favicon-flat.png')

squircle = Image.open(SRC / 'app-icon-squircle.png').convert('RGB')
squircle.resize((180, 180), Image.LANCZOS).save(ROOT / 'app/apple-icon.png', optimize=True)
print(f"  {'apple-icon':<16} 180px  <- app-icon-squircle.png")
