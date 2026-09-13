"""Derive every runtime brand asset from the masters in design/in-use/.

Requires Pillow (`pip install Pillow`). It is an ambient dependency: this repository has no
requirements.txt or pyproject.toml, and `build-app-icon.py` has the same one.

WHY A SCRIPT AND NOT A FOLDER OF HAND-MADE PNGs. An asset nobody can regenerate is a
one-off: when the master changes, or a rendered size changes, somebody has to redo by hand
what they cannot reproduce. Everything here is a pure function of a master and a size, so
re-running produces byte-identical output and the check asserts exactly that.

WHAT IS DELIBERATELY NOT BUILT. `mascot-working.png` has no call site anywhere in the
console — the container it was imagined for does not exist as a distinct empty state. It
stays in design/in-use/ unbuilt rather than being given an invented home.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'design/in-use'
OUT = ROOT / 'public/assets/brand'
OUT.mkdir(parents=True, exist_ok=True)

# The favicon master is a 980x980 purple square centred on an off-white canvas with
# exactly 137px of margin on all four sides. Measured, not guessed.
FAVICON_BOX = (137, 137, 1117, 1117)


def trim(im):
    """Crop to the non-transparent content, so a rendered size means the ARTWORK's size."""
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
    """Write `stem`.png at the rendered size and `stem`@2x.png at twice it, for hi-dpi."""
    path = SRC / master
    if not path.exists():
        raise SystemExit(f'missing master: {path}')
    art = trim(Image.open(path).convert('RGBA'))
    fit(art, rendered).save(OUT / f'{stem}.png', optimize=True)
    fit(art, rendered * 2).save(OUT / f'{stem}@2x.png', optimize=True)
    print(f'  {stem:<16} {rendered}px  <- {master}')


# --- the in-app mark -------------------------------------------------------
emit('wordmark-zz.png', 'wordmark', 60)

# --- the login hero --------------------------------------------------------
emit('mascot-waving.png', 'mascot-hero', 320)

# --- the five state illustrations -----------------------------------------
emit('mascot-bust.png', 'state-empty', 96)
emit('mascot-waving.png', 'state-welcome', 96)
emit('mascot-celebrating.png', 'state-done', 96)
emit('mascot-error.png', 'state-error', 96)
emit('mascot-notfound.png', 'state-notfound', 96)

# --- the three bespoke surfaces -------------------------------------------
emit('mascot-approved.png', 'state-approved', 40)
emit('mascot-goodbye.png', 'state-goodbye', 128)
emit('mascot-thinking.png', 'state-thinking', 72)

# --- the two icons, from the two masters drawn for their size bands --------
#
# THE SPEC ASKED FOR A TRACED SVG HERE AND THIS EMITS A PNG. Tracing a bitmap to vector
# needs a vectoriser (potrace or similar) that this repository does not have, and the
# alternative — hand-drawing an approximation of the mark — is precisely the "a
# reconstruction is a DIFFERENT logo" failure the spec rejects for the wordmark. A PNG
# derived from the real master is honest; a hand-drawn SVG that merely resembles it is not.
# Next's app/ file convention accepts icon.png exactly as it accepts icon.svg.
#
# The two masters are not interchangeable and neither is a scaled copy of the other:
# the flat single-Z reads at 16px in a tab strip where two letters would be mush; the
# mascot squircle has room for the character at 180px and up, which is where a
# home-screen icon earns its personality.
fav = Image.open(SRC / 'favicon-flat.png').convert('RGB').crop(FAVICON_BOX)
for size in (32, 64):
    fav.resize((size, size), Image.LANCZOS).save(
        ROOT / ('app/icon.png' if size == 32 else 'public/assets/brand/favicon-64.png'),
        optimize=True)
print(f'  {"icon (tab)":<16} 32px   <- favicon-flat.png')

squircle = Image.open(SRC / 'app-icon-squircle.png').convert('RGB')
squircle.resize((180, 180), Image.LANCZOS).save(ROOT / 'app/apple-icon.png', optimize=True)
print(f"  {'apple-icon':<16} 180px  <- app-icon-squircle.png")
