# Design source

Brand source material for the ZZ Console. **Nothing here is served to a browser.**

`.dockerignore` excludes this directory, so none of it reaches the production image. That is the
whole reason it is not under `public/` — the `Dockerfile` copies `public/` into the runtime image
unconditionally, and `.dockerignore` gets no second pass over that line. Source material left in
`public/` ships, whether anything references it or not.

## The two folders, and the difference

### `in-use/` — the build consumes these

Twelve single-image renders at 1122×1402 or 1254×1254. Scripts in `../scripts/` read from here
and write small, derived runtime assets into `../public/assets/`. Add a file here only when
something is going to build from it.

The ten mascot renders carry real transparency. The two icon masters are opaque on purpose, and
each needs one step before use: `favicon-flat.png` is a 980×980 purple square centred on an
off-white canvas with 137px of margin, so it is cropped to that square; `app-icon-squircle.png`
is full-bleed with near-black corners where its squircle radius cuts in, so the build's existing
corner-extrapolation step fills them with the squircle's own gradient.

**Three marks, one per size band, and they are not interchangeable.** `favicon-flat.png` is the
tab icon because two letters at 16px is mush and a favicon is a silhouette;
`app-icon-squircle.png` is the home-screen icon because at 180px and up there is room for the
character; `wordmark-zz.png` is the mark inside the app because it sits beside the product name.
Do not scale one of them into another's band.

| File | Size | Alpha | Serves |
|---|---|---|---|
| `favicon-flat.png` | 1254 × 1254 | opaque | The tab icon at 16–32px — a single **Z** with the sparkle, white on brand purple |
| `app-icon-squircle.png` | 1254 × 1254 | opaque | App icon, apple-touch icon and the PWA icon set — the mascot in a lavender squircle |
| `wordmark-zz.png` | 1254 × 1254 | yes | The in-app mark — sidebar and auth screens |
| `mascot-bust.png` | 1254 × 1254 | yes | "Nothing here yet" empty states |
| `mascot-waving.png` | 1122 × 1402 | yes | The login hero, and "add the first one" empty states |
| `mascot-celebrating.png` | 1122 × 1402 | yes | "Nothing to do, and that is a good outcome" |
| `mascot-working.png` | 1122 × 1402 | yes | Nothing yet — no surface uses it, so it is not built |
| `mascot-error.png` | 1122 × 1402 | yes | The error boundary, and the query-error fallback every page routes through |
| `mascot-notfound.png` | 1122 × 1402 | yes | 404, and the unknown plugin / skill pages |
| `mascot-approved.png` | 1122 × 1402 | yes | The approval success toast — this platform's signature act |
| `mascot-goodbye.png` | 1122 × 1402 | yes | The signed-out screen |
| `mascot-thinking.png` | 1122 × 1402 | yes | Knowledge Ask, while a question is being answered |

### `reference/` — look at these, never build from them

The ten delivered brand sheets. Every one is a **1448 × 1086 contact sheet**: a grid of small
panels with captions drawn onto the artwork, not a single asset. Panels sit at roughly 180–300px,
and several carry baked-in English text.

They are kept because they are the brand's documentation — the palette swatches, the logo
spacing rules, the expression range, the mood. Read them to answer "what does the brand say about
X". Do not crop production assets out of them while an `in-use/` master exists; a master is
sharper and carries no caption.

```
brand-kit-sheet.png          palette, logo lockups, typography, usage rules
icon-set-3d.png              3D icon family
marketing-template-board.png social and campaign layouts
mascot-character-bible.png   turnarounds and construction
mascot-expressions-grid.png  16 expressions
mascot-poses-full-body.png   12 full-body poses
mascot-scenes.png            the mascot in context
mascot-sticker-pack.png      sticker cuts
ui-kit-elements.png          buttons, badges and chips in the kit's glossy 3D style
ui-state-illustrations.png   empty / loading / error / approved states, with captions drawn in
```

**One caution about `ui-kit-elements.png`.** It is not a component library. The console keeps
flat surfaces — `--shadow-sm` and `--shadow` are `none` on purpose — so that sheet is a reference
for colour and mood, not a set of components to reproduce.
