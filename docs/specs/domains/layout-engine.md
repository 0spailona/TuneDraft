# Layout Engine

> **Bootstrap spec.** This document is written before any source code exists (see [ADR-0001](../decisions/0001-bootstrap-spec-system-before-code.md)). Every claim about future code carries a `<!-- TODO: verify -->` marker per the bootstrap protocol. Decision numbers `(№NN)` refer to the decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Purpose

The layout engine is the single pure-JS geometry kernel of TuneDraft: it converts the tabulature model — columns, notes, barlines, column texts — into coordinates (`x`, `y`) plus per-line wrap decisions (№14). It is a deterministic function of `(model, target width)`; both renderers (Skia screen, HTML→PDF) and the preview consume its output, so screen and PDF always agree and geometry logic is written exactly once (№14, №23).

## Key Files

None yet — this domain's code is not implemented yet (the stage-1 scaffold, [ADR-0003](../decisions/0003-src-layer-directories.md), ships only the layer skeleton and i18n). Roadmap stage 3 (КАРТА §3) implements the engine as pure TypeScript in the Domain layer defined by [architecture/layers.md](../architecture/layers.md), with unit tests as the stage's acceptance criterion (№34). <!-- TODO: verify when stage-3 layout code lands -->

## Core Types

None yet. The intended output vocabulary — laid-out systems carrying column `x`-offsets, string-line `y`-coordinates, column widths, and the positions of texts beneath their tab line (№24) — is fixed when stage-3 code lands; the shapes sketched in Flow below are intent, not types. <!-- TODO: verify when stage-3 layout code lands -->

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
              │    capacity ≈ strip width (~85% of  │
              │    target width) ÷ min cell width   │
              │    (№20); overflow handling below   │
              └──────────────────┬──────────────────┘
                                 ▼
              ┌─────────────────────────────────────┐
              │ 3. EMIT — systems with coordinates; │
              │    texts ride under their column    │
              │    (№24); measures stay whole (№18) │
              └─────────────────────────────────────┘
```

Overflow decision table for step 2 (order is significant — shrinking precedes wrapping) (№20):

```
 tab line exceeds capacity?
 ├── no  ─────────────────────► keep as one system
 └── yes
     ├── trailing empty columns exist?
     │   ├── yes ──► delete them until the line fits; stay on this system
     │   └── no  ──► create the next system, move the tail columns to it;
     │               a measure (barline-to-barline run) moves as a whole (№18)
```

Runtime happy paths (unimplemented; roadmap stage 3) <!-- TODO: verify -->:

1. **After every mutation** the editing domain hands the new model to the engine; the engine re-runs the pass above at the current screen width and the shell re-renders from the fresh output (№14, №20).
2. **On rotation** the shell re-runs the same pass at the new width: landscape fits more columns per system. The model stores data, not coordinates, so re-flow costs a recomputation and nothing else (№23).
3. **On export / preview** the engine runs at its own width — the fixed A4 print width for PDF, the preview width for `tet-<id>.png` — independent of the current screen orientation (№23, №30).

## Invariants

- The engine always remains pure Domain code: a deterministic function of the model and a target width, free of I/O, framework, and renderer imports (№14, rule R1 of [architecture/layers.md](../architecture/layers.md)).
- Geometry is always computed at the target width of its consumer: screen, PDF, and preview each get their own layout pass, and PDF/preview results always stay independent of the current screen orientation (№23).
- Every column always starts at the minimum width of 4 characters (2 for the fret digits plus 1 padding each side) and only grows — to fit its longest column text — up to the 12-character maximum (№20, №24).
- Character widths are always measured in the advance of the monospace fret-digit font, keeping the 4/12-character rules meaningful (№20, №32). <!-- TODO: verify when font metrics code lands -->
- Reaching the 12-character maximum always rejects text input upstream in the editing domain with a warning; the engine itself always leaves column text untruncated and unwrapped (№24).
- Tab-line capacity is always derived arithmetically: strip width (~85% of the target width) divided by the minimum cell width (№20).
- On overflow the engine always shrinks first: trailing empty columns are always removed before any wrap to a new system happens; wrapping occurs only when no trailing empty columns remain (№20).
- A measure always moves to the next system as a whole: the engine always breaks a tab line only at measure boundaries — never inside a measure (№18).
- Column texts always travel with their column: rendered beneath the tab line, aligned to the column that widened for them (№24).
- Rotation and mutation always produce a fresh full layout pass; the model underneath always stays untouched by geometry (№23).
- Every wrap decision depends only on `(model, target width)`, so re-running the pass on identical input always yields identical geometry (№14).
- Each ribbon line always lays out independently of every other line — its geometry depends only on its own columns and the target width — so the render window (visible lines plus a reserve margin) is always servable without laying out the whole document (№28).

These invariants become checkable at roadmap stage 3, where layout unit tests on fixtures are an acceptance criterion (№34). <!-- TODO: verify -->

## Configuration

No configuration code exists yet. <!-- TODO: verify when configuration is introduced -->

Intended parameters, from decisions:

| Parameter | Intended value | Valid values | Source |
| --------- | -------------- | ------------ | ------ |
| Min column width | 4 characters (2 fret digits + 1 padding each side) | fixed | (№20) |
| Max column width | 12 characters — the text-input rejection threshold | fixed | (№20, №24) |
| Strip width fraction | ~85% of the target width | fixed | (№20) |
| Character advance | monospace fret-digit font advance (№32) | finalized at stage 3 | (№32) |
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
- [META.md](../META.md) — document format and update rules.
