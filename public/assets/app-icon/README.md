# ZZ app icon

The mascot in the lavender squircle — one of the three ZZ marks, the one drawn for
180px and up, where there is room for the character. The other two are the flat single-`Z`
tab icon (16–32px) and the `Zz` wordmark used inside the application; neither is built here,
and none of the three is a scaled copy of another.

Regenerate with `python3 scripts/build-app-icon.py` (needs Pillow).

## Source

Built from `design/in-use/app-icon-squircle.png` — a purpose-drawn **1254 × 1254** master, so
every size here is a downscale. Nothing in this directory is an upscale.

That was not always true. The first version of this set was cropped from panel 03 of
`brand-kit-sheet.png`, a region the sheet itself labels "1024 × 1024" and which is actually
**183 × 179 px** — the label is drawn-on annotation, not a file size. Everything above ~180px
was therefore a sharpened LANCZOS upscale. The master replaced it on 2026-09-13.

## Files

| File | Use |
|---|---|
| `app-icon-1024.png` | Master. App Store / Play Store listing, and the source for everything else. |
| `app-icon-512.png`, `app-icon-192.png` | PWA manifest `icons`, `purpose: "any"`. |
| `apple-touch-icon-180.png` | `<link rel="apple-touch-icon">` — iOS home screen. |
| `app-icon-64.png` | Large favicon / tab strip on hi-dpi. |
| `app-icon-maskable-1024.png`, `-512`, `-192` | PWA manifest `icons`, `purpose: "maskable"`. |
| `641F2C18-7277-46EE-9788-B7590FD375BB.png` | **Not part of this set and not built by the script.** 61 × 61, RGBA, a pink-haired character portrait — not one of the three ZZ marks. A UUID filename is what a design tool writes on export rather than on placement, so it arrived here by accident. Nothing references it: grepped across `ts`, `tsx`, `json` and `html`. Kept on the stakeholder's instruction, documented rather than tidied away, because a file in this directory that the table does not name is the thing this README exists to prevent. |

## Two variants, and why

**Full-bleed** (`app-icon-*.png`) — square, opaque, no baked rounded corners. iOS applies
its own squircle and Android its own mask; a pre-rounded icon shows the kit's corner
radius as a ghost outline inside the system mask. The kit's white sheet corners are
replaced by the squircle's own lavender gradient extrapolated outward, and its glossy rim
is eroded off for the same reason.

**Maskable** — Android's adaptive-icon circle clips roughly the outer 19% of the canvas,
which is exactly where the bear ears and the two sparkles sit. This variant sits the art
at 70% on the same gradient so nothing important is cut. Do not use it where the
full-bleed one belongs: at full size it looks small and floaty.

## Manifest snippet

```json
"icons": [
  { "src": "/assets/app-icon/app-icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
  { "src": "/assets/app-icon/app-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
  { "src": "/assets/app-icon/app-icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/assets/app-icon/app-icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

Nothing in the app points at these yet — there is no web manifest. That half of the
paragraph that used to sit here was true; the other half has been false since the brand
adoption landed, and it is worth saying what it claimed, because the file it named is gone.

It said the tab icon was "still the indigo hexagon at `app/icon.svg`, which is a different
brand from this kit — switching it over is a product decision, not a build step." The
product decision was made: the kit was adopted whole. `app/icon.svg` is deleted, the tab
icon is `app/icon.png` (the flat single-Z, because two letters at 16px is mush), and
`AppMark` renders `/assets/brand/wordmark.png` — a sibling of this directory.

So these eight PWA icons are built, documented and wired to nothing. That is a real loose
end rather than a decision: add a manifest and they are already here.
