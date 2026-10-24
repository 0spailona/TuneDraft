# Rendering

> **Screen renderer landed** (roadmap stage 4: draw plan + Skia executor, [ADR-0005](../../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md)). Claims about the screen pipeline are verified against the tree; the HTML→PDF and preview pipelines are not implemented yet (stage 8) and keep `<!-- TODO: verify -->` markers. Decision references `(№NN)` point to [КАРТА-ПРОЕКТА.md](../../../КАРТА-ПРОЕКТА.md).

## Purpose

Turns the geometry produced by the layout engine into visible output through two renderers: a Skia renderer draws the interactive screen, and an HTML→PDF pipeline (`expo-print` + `expo-sharing`) produces the exported document (№14). Rendering owns drawing only — it computes no geometry of its own.

## Key Files

- `src/infrastructure/rendering/plan.ts` — `buildNotebookDrawPlan`: layout's character-unit dictionary → px primitives (`stringLine`, `fretDigit`, `barline`, `columnText`, `clef`, `textRow`); wraps text lines via an injected `TextLineMeasurer`; slices a `DrawWindow` (№28) without touching document height; owns page margins (№7, №23) — one `leftOffsetPx` centers the whole tab block (clef margin + strip of the first system) in `widthPx`, text rows center on their own measured width, and the ribbon starts at `theme.documentTopPaddingPx`.
- `src/infrastructure/rendering/skia.ts` — the Skia executor: `buildNotebookPicture` records the plan into a `SkPicture` (dispatch by `primitive.kind`), draws the bass clef 𝄢 as a built-in path (№36); `createNotebookFonts`, `measureMonoAdvancePx`, `createSkiaTextLineMeasurer`.
- `src/infrastructure/rendering/NotebookCanvas.tsx` — the screen component: `floor(widthPx / advance)` → `layoutNotebook` → plan → picture inside a `ScrollView`; no geometry of its own (№14, №23).
- `src/infrastructure/rendering/theme.ts` — the hardcoded MVP theme (№32): fonts by role, colors, line thicknesses, `clefMarginChars`, `textLinePaddingPx` (vertical padding around text lines, applied by the plan), and `documentTopPaddingPx` = 32 (top margin of the document, applied once as the ribbon's start offset — №7, №32).
- `src/infrastructure/rendering/__tests__/plan.test.ts` — plan determinism, primitive placement, wrapping, window slicing (№34).

PDF export (`pdf-export.md`, stage 8) and preview generation (№30) have no files yet.

## Core Types

Rendering consumes the layout domain's output (№14); its own vocabulary is the draw plan:

```ts
// src/infrastructure/rendering/plan.ts
export type DrawPrimitive =
  | StringLinePrimitive   // string line of a system (№2)
  | FretDigitPrimitive    // fret digit at string × column center (№3, №20)
  | BarlinePrimitive      // vertical through all strings (№18)
  | ColumnTextPrimitive   // column text stacked under the tab line (№24, №35)
  | ClefPrimitive         // 𝄢 margin rectangle of a system (№36)
  | TextRowPrimitive;     // wrapped row of a text line (№6)

export interface NotebookDrawPlan {
  readonly primitives: readonly DrawPrimitive[];
  readonly widthPx: number;   // echo of the wrap band
  readonly heightPx: number;  // full document height even under a window (№28)
}

export interface TextLineMeasurer {           // injected: plan never imports a framework
  measureTextWidthPx(text: string): number;   // (R1); tests pass a deterministic fake (№34)
}

export interface DrawWindow {  // №28: absolute ribbon-row indices, inclusive
  readonly firstRow: number;
  readonly lastRow: number;
}
```

Every primitive carries ready px coordinates — the plan multiplies character units by `advancePx`; the executor never multiplies. `NotebookFonts` (in `skia.ts`) holds the three role fonts resolved by `matchFont` (№32).

## Flow

```
              notebook model (tab rows + text rows)
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │   layout engine (pure JS) (№14)     │
            │   computes geometry per target      │
            │   width — never inside a renderer   │
            └───────┬───────────┬────────────┬────┘
                    │           │            │
        screen width│    A4 print width      │preview width
                    ▼           ▼            ▼
          ┌─────────────────────┐ ┌──────────┐ ┌────────────────┐
          │ draw plan (№14):    │ │ HTML→PDF │ │ preview render │
          │ chars × advance →   │ │ A4       │ │ first system   │
          │ px primitives;      │ │ portrait │ │ → tet-<id>.png │
          │ Skia executor →     │ │ (№7,№33) │ │ cached next to │
          │ SkPicture <Canvas>  │ │ see      │ │ tet-<id>.json  │
          │ (landed, stage 4;   │ │ pdf-     │ │ (№30)          │
          │ window — stage 6,   │ │ export   │ │                │
          │ №28)                │ │          │ │                │
          └─────────────────────┘ └──────────┘ └────────────────┘
```

Screen happy path (landed, stage 4):

1. The component receives the notebook model and the screen width in px. It measures the monospace advance from the theme's fret-digit font (`measureMonoAdvancePx`, glyph «0» — the engine's character unit, №32, [ADR-0004](../../decisions/0004-layout-character-units-and-wrap-policy.md)) and converts width to engine characters: `floor(widthPx / advance)` (№23).
2. `layoutNotebook` runs at that width; `buildNotebookDrawPlan` translates the layout into px primitives (multiplying by the advance, wrapping text lines through the injected measurer) and `buildNotebookPicture` records them into a `SkPicture` — paper background first, then a dispatch on `primitive.kind`: lines and barlines as strokes (theme thicknesses), fret digits centered on their string line by font ascent/descent, column texts on their baseline, the clef as a built-in path (№36).
3. `<Canvas>` displays the picture declaratively via `<Picture>`; the canvas is `widthPx × max(plan.heightPx, viewport height)` — the picture always carries the full document height (`plan.heightPx`, stage 6 introduces the window, №28), and the canvas never shrinks below the viewport so a short document still shows paper to the bottom of the screen.
4. On rotation `useWindowDimensions` changes `widthPx`, and steps 1–3 re-run for the new width; the model never changes (№23).

Export happy path (detail: [pdf-export.md](pdf-export.md)) — unimplemented, stage 8:

1. The user taps «Экспорт PDF» in the editor toolbar.
2. Rendering requests layout at the fixed A4 print width — independent of the current screen orientation (№23).
3. The HTML→PDF pipeline paginates by row boundaries and hands the document to the OS (№7, №8).

Preview happy path — unimplemented, stage 7:

1. The user taps «Сохранить» (storage domain writes `tet-<id>.json`).
2. Rendering regenerates the preview — the first system (the tab row up to its first line break) — and caches it as `tet-<id>.png` next to the JSON file, where the library card picks it up (№30).

The screen pipeline above is implemented (`App.tsx` renders `NotebookCanvas` with the demo notebook fixture); the export and preview pipelines have no code yet. <!-- TODO: verify when stage 7/8 code lands -->

## Invariants

- Both renderers always consume the output of the single layout engine; executor code always stays free of geometry computation — all coordinates arrive as ready px from the plan (№14).
- The screen pipeline always converts engine characters to px in exactly one place — `buildNotebookDrawPlan`, by multiplying by `advancePx`; the executor never multiplies ([ADR-0005](../../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md)).
- The draw plan is always a deterministic function of `(model, layout, options)` — same inputs, identical plan (№14, pinned by `plan.test.ts`).
- Text-line wrapping always runs in rendering (not the engine) through an injected `TextLineMeasurer`; the plan never imports a framework font (№6, №32, [ADR-0004](../../decisions/0004-layout-character-units-and-wrap-policy.md) item 4).
- The plan's `heightPx` always covers the whole ribbon, even when a window slices the primitives (№28).
- The plan always places the document as one block: a single `leftOffsetPx` centers the tab block in `widthPx` (clamped to the left edge when the document is narrower) and the ribbon always starts at `theme.documentTopPaddingPx`, included in `heightPx` exactly once (№7, №23, [ADR-0005](../../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md) decision 6).
- Fret digits are always drawn in a monospace font (№32); the bass clef 𝄢 is always drawn as a built-in Skia path, independent of the system font stack (№36).
- The screen pipeline always re-runs layout and plan on width change and never mutates the notebook model (№23).
- The exported document is always A4 portrait (№7, №33). <!-- TODO: verify (stage 8) -->
- A page break always falls on a row boundary; a row always appears whole on one page (№7). <!-- TODO: verify (stage 8) -->
- An overlong tab system is always resolved by wrapping the system, never by rotating the page to landscape (№7).
- Every PDF page always carries the notebook title in the top-right corner and the page number bottom-center, both in small type (№33). <!-- TODO: verify (stage 8) -->
- The preview always shows the first system of the notebook and is always regenerated when the user taps «Сохранить», caching to `tet-<id>.png` (№30). <!-- TODO: verify (stage 7) -->
- PDF and preview geometry is always computed at its own target width, never inherited from the current screen orientation (№23).

## Configuration

The MVP theme is hardcoded in `src/infrastructure/rendering/theme.ts` (№32); parameters realized by the screen pipeline:

| Parameter | Value | Source |
| --- | --- | --- |
| Fret digits font | monospace family, size 16 | №32 |
| Column text font | monospace family, size 12, `includeFontPadding: false` | №24, №32 |
| Text line font | `sans-serif` family, size 18, line height 36 | №6, №32 |
| Screen background / ink / barline colors | `#FAF7F0` / `#222222` / `#C0392B` | №32 |
| Line thickness | strings 1 px, barlines 2 px | №32 |
| Clef margin | `clefMarginChars` = 4 engine characters | №36 |
| Text line vertical padding | `textLinePaddingPx` = 12, added on both ends of a text-line block by the plan | №32 |
| Document top margin | `documentTopPaddingPx` = 32 — gap above the first ribbon row, included in `heightPx` exactly once | №7, №32, №23 |
| Horizontal centering | plan-level `leftOffsetPx = max(0, (widthPx − (clef margin + strip)) / 2)` — the whole tab block rides as one centered unit; narrower documents clamp to the left edge | №7, №23, [ADR-0005](../../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md) decision 6 |
| Advance measurement | glyph «0» of the fret-digit font | №32, [ADR-0004](../../decisions/0004-layout-character-units-and-wrap-policy.md) |
| PDF page format | A4 portrait (210 × 297 mm), fixed | №7, №33 |
| PDF header/footer type size | small (exact size chosen at implementation) | №33 |
| Preview cache file | `tet-<id>.png` beside `tet-<id>.json` | №30 |
| Screen render window | visible rows ± reserve margin | №28 |

## Extension Points

- A third renderer (for example a full-page image or a print theme) plugs in by consuming the same draw plan — the HTML→PDF and preview pipelines of stages 7–8 are planned consumers of `buildNotebookDrawPlan` (№14, №23).
- Preview size options (large / small / none) extend the preview cache without touching the layout engine (№30).
- «Share PDF» from a library card reuses the same PDF pipeline after MVP (№30).
- Font and color themes for headings and texts arrive after MVP; the MVP ships exactly one built-in theme (`theme.ts`), and role-based font resolution (fret digits / column texts / text lines) carries over (№32).
- The `DrawWindow` input already exists — wiring visible-row tracking into `NotebookCanvas` (stage 6) needs no plan or executor change (№28).

## Related Specs

- [pdf-export.md](pdf-export.md) — detail spec for the HTML→PDF export pipeline (page format, pagination, page chrome).
- [Layers](../../architecture/layers.md) — the layout engine stays pure Domain logic; renderers act as delivery/infrastructure adapters and never feed geometry back upstream.
- [Data Flow](../../architecture/data-flow.md) — the five-stage pipeline every export and save-triggered preview pass follows.
- [ADR-0004](../../decisions/0004-layout-character-units-and-wrap-policy.md) — character-unit coordinates and the wrap policy the plan consumes.
- [ADR-0005](../../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md) — the draw plan / executor split, role fonts, the path-based clef, final vertical metrics, and page margins (horizontal centering + document top padding).
- [App Shell](../app-shell.md) — hosts the Skia Canvas and the toolbar actions («Сохранить», «Экспорт PDF»).
- [Storage: Library](../storage/library.md) — the library card that consumes the cached `tet-<id>.png` preview.
- [Tabulature](../tabulature/README.md) — the notebook model every rendering pipeline starts from.
- [Layout Engine](../layout-engine.md) — the upstream geometry provider whose character-unit output the plan translates.
