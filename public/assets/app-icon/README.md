# ZZ app icon

Derived from panel **03 APP ICON** of `../brand-kit-sheet.png` — the mascot in the
lavender squircle, which is what the kit designates as the app icon. (Panel 04, the
purple `Zz` wordmark, is the kit's favicon; that is a separate mark and is not built
here.)

Regenerate with `python3 scripts/build-app-icon.py` (needs Pillow).

## Resolution caveat

The kit is a contact sheet: panel 03 is **183 × 179 px** on it, despite being labelled
"1024 × 1024". Everything here above ~180px is a LANCZOS upscale of that crop, sharpened.
It holds up because the source is a smooth 3D render with no fine detail, but it is not a
true 1024 master. If the original 1024 render exists somewhere, rebuild from it — point
`SHEET`/`BOX` in the build script at the real file and the rest of the pipeline is unchanged.

## Files

| File | Use |
|---|---|
| `app-icon-1024.png` | Master. App Store / Play Store listing, and the source for everything else. |
| `app-icon-512.png`, `app-icon-192.png` | PWA manifest `icons`, `purpose: "any"`. |
| `apple-touch-icon-180.png` | `<link rel="apple-touch-icon">` — iOS home screen. |
| `app-icon-64.png` | Large favicon / tab strip on hi-dpi. |
| `app-icon-maskable-1024.png`, `-512`, `-192` | PWA manifest `icons`, `purpose: "maskable"`. |

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

Nothing in the app points at these yet. The console's tab icon is still the indigo hexagon
at `app/icon.svg`, which is a different brand from this kit — switching it over is a
product decision, not a build step.
