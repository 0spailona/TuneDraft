# Layout Engine

> **Layout engine landed (roadmap stage 3).** The pure TypeScript geometry code lives in `src/domain/layout-engine/` (layer layout per [ADR-0003](../decisions/0003-src-layer-directories.md); the character-unit coordinate decision is recorded in [ADR-0004](../decisions/0004-layout-character-units-and-wrap-policy.md)). Remaining `TODO: verify` markers in this tree refer to later stages (4–8). Citations of the form (№NN) refer to the numbered decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Purpose

The layout engine is the single pure-JS geometry kernel of TuneDraft: it converts the tabulature model — columns, notes, barlines, column texts — into coordinates (`x`, `y`) plus per-line wrap decisions (№14). It is a deterministic function of `(model, target width)`; both renderers (Skia screen, HTML→PDF) and the preview consume its output, so screen and PDF always agree and geometry logic is written exactly once (№14, №23).

## Key Files

- `src/domain/layout-engine/config.ts` — geometric constants in character units (№32): `MIN_COLUMN_WIDTH_CHARS = 4`, `MAX_COLUMN_WIDTH_CHARS = 12`, `STRIP_WIDTH_FRACTION = 0.85`, and the provisional vertical metrics `ROW_SPACING_CHARS = 2`, `TEXT_ROW_SPACING_CHARS = 1` (finalized at stage 4)
- `src/domain/layout-engine/types.ts` — the output vocabulary of a layout pass (see Core Types); imports only `EntityId` from the tabulature model (R1)
- `src/domain/layout-engine/measure.ts` — the MEASURE pass (Flow step 1): `columnWidthChars(column, texts)` — 4…12 characters, barline columns always the minimum (№18) — and `systemCapacity(targetWidthChars)` — the strip/capacity floor arithmetic (№20)
- `src/domain/layout-engine/wrap.ts` — the WRAP pass (Flow step 2): `wrapTabLine(columns, widths, capacity)` — trailing-empty shrink first, then measure-boundary wrap ([ADR-0004](../decisions/0004-layout-character-units-and-wrap-policy.md))
- `src/domain/layout-engine/__tests__/measure.test.ts` — stage-3 unit tests of the width and capacity arithmetic on synthetic columns (№34)
- `src/domain/layout-engine/__tests__/wrap.test.ts` — stage-3 unit tests of the wrap rules on synthetic columns (№34)

## Core Types

From `src/domain/layout-engine/types.ts` (stage 3); all offsets, widths, and y-coordinates are in character units — the advance of the monospace fret-digit font (№32), which each renderer multiplies by its own advance:

```ts
NotebookLayout     { ribbon }                          // one full pass over the notebook (№14, №23)
RibbonLayoutEntry = (TabLineLayout & { kind: 'tab' })
                  | (TextLineLayout & { kind: 'text' }) // mirrors the model's RibbonLine kind (№6)
TabLineLayout     { lineId, stringCount, stringYChars, systems }
                  // stringYChars[i] = i * ROW_SPACING_CHARS (provisional, №2, №32)
LaidOutSystem     { index, columns, texts, widthChars }  // one system of a tab line (№18);
                  // widthChars = floor(target · STRIP_WIDTH_FRACTION) (№20)
LaidOutColumn     { columnId, xChars, widthChars }       // №20
LaidOutColumnText { textId, columnId, xChars, yChars }   // rides under its column (№24)
TextLineLayout    { lineId, text }                        // pass-through, no geometry (№6, №19);
                  // the entry union above adds the kind: 'text' discriminant
```

From `src/domain/layout-engine/wrap.ts` (stage 3):

```ts
WrapColumn  { columnId, kind: 'content' | 'barline', isEmpty }   // wrap-pass input (№20)
WrapSystem  = readonly EntityId[]                                 // system = column-id list, model order
wrapTabLine(columns, widths, capacity) → readonly WrapSystem[]   // ≥ 1 system, even for an empty line
```

From `src/domain/layout-engine/measure.ts` (stage 3):

```ts
SystemCapacity { stripWidthChars, capacityColumns }              // №20: two floor() steps
columnWidthChars(column, texts) → number                         // 4…12 chars; barline → 4 (№18)
systemCapacity(targetWidthChars) → SystemCapacity                // floor(W · 0.85) ÷ 4
```

The full single-entry pass over the notebook (walking every ribbon line, calling MEASURE → WRAP, and emitting `NotebookLayout`) grows on later roadmap stages; `measure.ts` and `wrap.ts` are the parts the stage-3 unit tests pin down (№34).

## Flow

One layout pass = measure columns, then wrap systems, then emit geometry.

```
 notebook model (tab lines + text lines)      target width
   (columns, notes, barlines, texts)        (screen / A4 / preview)
        └────────────────┬─────────────────────┬─────────┘
                         ▼                     ▼
              ┌─────────────────────────────────────┐
              │ 1. MEASURE — per column:            │
              │    width = max(4 chars, longest     │
              │    column text), capped at 12       │
              │    characters          (№20, №24)   │
              └──────────────────┬──────────────────┘
                                 ▼
              ┌─────────────────────────────────────┐
              │ 2. WRAP — per tab line:             │
              │    compare column-width sums with   │
              │    the strip width in characters    │
              │    (~85% of target width, №20);     │
              │    overflow handling below          │
              └──────────────────┬──────────────────┘
                                 ▼
              ┌─────────────────────────────────────┐
              │ 3. EMIT — systems with coordinates; │
              │    texts ride under their column    │
              │    (№24); measures stay whole (№18) │
              └─────────────────────────────────────┘
```

Overflow decision table for step 2 (order is significant — shrinking precedes wrapping) (№20, [ADR-0004](../decisions/0004-layout-character-units-and-wrap-policy.md)), as implemented by `wrapTabLine` in `src/domain/layout-engine/wrap.ts`:

```
 tab line exceeds capacity?
 ├── no  ─────────────────────► keep as one system (trailing empties stay)
 └── yes
     ├── trailing empty columns exist?
     │   ├── yes ──► drop them from the layout until the line fits;
     │   │           fits after shrinking → stay on this system
     │   └── no  ──► split into measures (a measure ends at its barline,
     │               №18, №36) and wrap measure-wise:
     │               line has no barlines → the whole line is one measure:
     │               it never splits — it overflows its single system
     │               measure fits → append to the current system
     │               measure doesn't fit → close the current system,
     │               the measure opens the next one; a measure wider than
     │               the capacity occupies a system alone (№18)
```

A wrap result always contains at least one system — even an empty tab line yields one empty system.

Runtime happy paths (the consumers are stages 4–8; the wrap kernel they invoke is shipped):

1. **After every mutation** the editing domain hands the new model to the engine; the engine re-runs the pass above at the current screen width and the shell re-renders from the fresh output (№14, №20).
2. **On rotation** the shell re-runs the same pass at the new width: landscape fits more columns per system. The model stores data, not coordinates, so re-flow costs a recomputation and nothing else (№23).
3. **On export / preview** the engine runs at its own width — the fixed A4 print width for PDF, the preview width for `tet-<id>.png` — independent of the current screen orientation (№23, №30).

## Invariants

- The engine always remains pure Domain code: a deterministic function of the model and a target width, free of I/O, framework, and renderer imports (№14, rule R1 of [architecture/layers.md](../architecture/layers.md)).
- Geometry is always computed at the target width of its consumer: screen, PDF, and preview each get their own layout pass, and PDF/preview results always stay independent of the current screen orientation (№23).
- Every column always starts at the minimum width of 4 characters (2 for the fret digits plus 1 padding each side) and only grows — to fit its longest column text — up to the 12-character maximum (№20, №24).
- Character widths are always measured in the advance of the monospace fret-digit font — as character units, the single unit of every coordinate and width the engine emits (№32, [ADR-0004](../decisions/0004-layout-character-units-and-wrap-policy.md)); each renderer multiplies by its own advance, so the engine itself never sees a font.
- Reaching the 12-character maximum always rejects text input upstream in the editing domain with a warning; the engine itself always leaves column text untruncated and unwrapped (№24).
- The wrap always compares column-width sums against the strip width — `floor(85% of the target width)` characters; the minimum-cell count (`capacityColumns`) stays a derived measure metric, not the wrap bound (№20).
- On overflow the engine always shrinks first: trailing empty columns are always removed before any wrap to a new system happens; wrapping occurs only when no trailing empty columns remain (№20).
- A measure always moves to the next system as a whole: the engine always breaks a tab line only at measure boundaries — never inside a measure (№18).
- Column texts always travel with their column: rendered beneath the tab line, aligned to the column that widened for them (№24).
- Rotation and mutation always produce a fresh full layout pass; the model underneath always stays untouched by geometry (№23).
- Every wrap decision depends only on `(model, target width)`, so re-running the pass on identical input always yields identical geometry (№14).
- Each ribbon line always lays out independently of every other line — its geometry depends only on its own columns and the target width — so the render window (visible lines plus a reserve margin) is always servable without laying out the whole document (№28).

The width/capacity invariants are checked by the stage-3 unit tests in `src/domain/layout-engine/__tests__/measure.test.ts`, and the wrap invariants by `src/domain/layout-engine/__tests__/wrap.test.ts` (№34); invariants that need consumers or renderers (geometry at consumer width, text rejection upstream) remain testable only when those stages land (4–8).

## Configuration

Constants live in `src/domain/layout-engine/config.ts` (stage 3) and are exported as named constants — the engine takes no runtime configuration (№14, №32):

| Parameter | Value | Valid values | Source |
| --------- | ------------ | ------------ | ------ |
| `MIN_COLUMN_WIDTH_CHARS` | 4 characters (2 fret digits + 1 padding each side) | fixed | (№20) |
| `MAX_COLUMN_WIDTH_CHARS` | 12 characters — the text-input rejection threshold | fixed | (№20, №24) |
| `STRIP_WIDTH_FRACTION` | 0.85 of the target width | fixed | (№20) |
| `ROW_SPACING_CHARS` | 2 characters between string rows | provisional — finalized at stage 4 | (№32) |
| `TEXT_ROW_SPACING_CHARS` | 1 character between the bottom string row and the column-text stack | provisional — finalized at stage 4 | (№24, №32) |
| Barline column width | 4 characters — `columnWidthChars` returns the minimum for `kind: 'barline'`; no dedicated constant | fixed | (№18) |
| Target widths | current screen width (portrait and landscape); A4 portrait print width; preview width | one per consumer | (№23, №7) |

## Extension Points

- **A third consumer** (image export, print theme) plugs in by invoking the engine with its own target width; adding a consumer always reuses the same pass and never duplicates geometry (№14).
- **Fifth string (low B):** the engine derives row height and cell rows from the model's tuning list, so appending a string is a model-config change the engine absorbs without edits (№2).
- **Pinch zoom (candidate):** zoom re-runs the pass at a scaled width — the same mechanism rotation uses; the model stays untouched (№11, №23).
- **Duration palette (post-MVP):** rhythm is a model/UI concern; geometry depends on column content count, so the engine stays unchanged (№4).
- **Themed fonts (post-MVP):** a theme swaps the monospace advance feeding the 4/12-character rules; capacity recomputes from configuration, not code changes (№32).

## Related Specs

- [Tabulature](tabulature/README.md) — the pure model this engine consumes as input (columns, notes, barlines, texts).
- [Notebook Model](tabulature/notebook-model.md) — entity catalog and column states the measure/wrap passes operate on.
- [Rendering](rendering/README.md) — the two renderers that draw this engine's output and own no geometry of their own.
- [PDF Export](rendering/pdf-export.md) — the A4-width consumer: pagination by row boundaries over this engine's systems.
- [Editing](editing/README.md) — triggers re-flow after every model mutation (№14, №20).
- [App Shell](app-shell.md) — forwards rotation events that re-run layout at the new width (№23).
- [architecture/layers.md](../architecture/layers.md) — Domain purity rule R1 this engine obeys.
- [architecture/data-flow.md](../architecture/data-flow.md) — the five-stage pipeline whose EXECUTE stage a layout pass is.
- [ADR-0001](../decisions/0001-bootstrap-spec-system-before-code.md) — the bootstrap/TODO-marker protocol this spec follows.
- [ADR-0004](../decisions/0004-layout-character-units-and-wrap-policy.md) — character-unit coordinates and the measure-boundary wrap policy this engine implements.
- [META.md](../META.md) — document format and update rules.
