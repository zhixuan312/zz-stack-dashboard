# ZZ app icon

The mascot in the lavender squircle — one of the three ZZ marks, the one drawn for
180px and up, where there is room for the character. The other two are the flat single-`Z`
tab icon (16–32px) and the `Zz` wordmark used inside the application; neither is built here,
and none of the three is a scaled copy of another.

Regenerate with `python3 scripts/build-app-icon.py` (needs Pillow).

## Source

Built from `design/in-use/app-icon-squircle.png` — a purpose-drawn **1254 × 1254** master, so
every size here is a downscale. Nothing in this directory is an upscale.

Do not crop an icon out of `design/reference/brand-kit-sheet.png`: its "1024 × 1024" panel label
is drawn-on annotation, and the panel itself is about 183 × 179px.

## Files

| File | Use |
|---|---|
| `app-icon-1024.png` | Master. App Store / Play Store listing, and the source for everything else. |
| `app-icon-512.png`, `app-icon-192.png` | PWA manifest `icons`, `purpose: "any"`. |
| `apple-touch-icon-180.png` | `<link rel="apple-touch-icon">` — iOS home screen. |
| `app-icon-64.png` | Large favicon / tab strip on hi-dpi. |
| `app-icon-maskable-1024.png`, `-512`, `-192` | PWA manifest `icons`, `purpose: "maskable"`. |
| `641F2C18-7277-46EE-9788-B7590FD375BB.png` | **Not part of this set and not built by the script.** 61 × 61, RGBA, a character portrait — not one of the three ZZ marks, and referenced by nothing. DELIBERATE: kept, and named here because every file in this directory must be. |

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

Nothing in the app points at these — there is no web manifest. Add one and they are already
here. The tab icon is `app/icon.png` (the flat single-Z) and `AppMark` renders
`/assets/brand/wordmark.png`; neither is built from this directory.
