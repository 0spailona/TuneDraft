# ADR-0004: Layout coordinates in character units and the measure-boundary wrap policy

## Status

Accepted

## Context

The layout engine (roadmap stage 3) turns the tabulature model into coordinates, but the spec left two things open until the code forced a choice.

First, the unit of geometry. The engine serves two renderers — the Skia screen renderer and the HTML→PDF exporter — which must always agree (№14, №23), yet they draw at different pixel densities and with different font stacks. If the engine emitted pixels or points, it would need to know each renderer's font metrics, which couples the pure Domain code to fonts and frameworks (R1), and screen/PDF geometry could drift apart. №32 fixes the monospace fret-digit font as the base, so its advance is the one measure every consumer shares by definition.

Second, the wrap policy for a tab line that exceeds the system strip width (№20). №18 requires that a measure (такт) is never broken by a wrap, and №36 defines the measure as the range between barline columns — "no barlines: the whole line is one measure" — but not *where exactly* the cut may fall, nor what to do when a single measure is itself wider than the strip. An arbitrary cut (mid-measure, or dropping columns) would violate №18; refusing to render an over-wide measure would leave content unrenderable.

## Decision

1. **Character units.** Every coordinate, width, and gap the engine emits is measured in characters — the advance of the monospace fret-digit font (№32): `xChars`, `widthChars`, `stringYChars`, `yChars` across `types.ts`, `measure.ts`, `config.ts`, `wrap.ts`. The engine never sees a font, a pixel, or a renderer; each consumer multiplies character units by its own advance at draw time (Skia) or converts them to CSS lengths (HTML→PDF), so screen and PDF geometry agree by construction (№14, №23). Column widths (4…12, №20, №24), the strip fraction (0.85, №20), and capacity (`floor(stripWidth / 4)`, №20) are all expressed and computed in these units, with integer `floor` arithmetic keeping the pass deterministic (№14).

2. **Cut point: immediately after a barline column.** `wrapTabLine` splits a tab line into measures — a measure ends at its barline column (№18, №36); the tail after the last barline is the closing measure — and distributes measures over systems greedily. A system break is therefore possible only in one place: right after a column of `kind: 'barline'`. Within a measure the wrap never cuts (№18).

3. **A measure wider than the capacity occupies a system alone.** When the very first measure of a system does not fit, it still opens the system and takes it whole: overflow by width is allowed, breaking the measure is not (№18). The wrap result remains at least one system per tab line, even an empty one (№20).

4. **Text lines pass through.** Text ribbon lines carry no geometry: `TextLineLayout` preserves only the line's position in the ribbon and its unmodified text (№6, №19). Wrapping a proportional-font text line is a renderer/theme concern (№32); putting it in the layout kernel would couple the engine to fonts it must not see (R1).

## Consequences

**Positive**

- Screen and PDF geometry can never disagree: both consume the same character-unit dictionary, and the engine is testable without any renderer (№14) — the stage-3 unit tests pin the wrap and measure rules with plain numbers (№34).
- The wrap policy is fully determined: for any `(columns, widths, capacity)` there is exactly one outcome, verified by `wrap.test.ts` including the degenerate over-wide-measure and no-barlines cases.
- Renderers stay dumb: they scale and draw, never re-flow. A fifth string, pinch zoom, or a themed font re-runs the same pass instead of adding engine branches (№2, №11, №23, №32).

**Negative**

- Character units defer font reality to the consumer: a proportional column text may render visually wider or narrower than its character count suggests; correcting for this (theme font metrics) is postponed to stage 4, where the provisional vertical metrics (`ROW_SPACING_CHARS`, `TEXT_ROW_SPACING_CHARS`) are also finalized (№32).
- An over-wide measure draws beyond its strip or must be scaled down by the renderer; the engine deliberately does not warn — the choice of how to *present* the overflow belongs to the renderer, not the kernel (№18).
- The `kind` discriminator lives on the layout entry, not on `LaidOutColumn` — barline identity reaches the wrap pass as a `WrapColumn` flag, so the two vocabularies must stay in sync by test.

## Alternatives Considered

- **Pixel/point coordinates from the engine (engine owns fonts)** — rejected: the engine would import font metrics (framework-adjacent knowledge, breaks R1), and each new consumer density would require an engine change instead of a multiply at draw time.
- **Percentage coordinates relative to the strip width** — rejected: percentages cannot express the character grid the 4/12-character width rules (№20, №24) live on, and they break the determinism check "same model and width → same numbers" (№14).
- **Break at the last column that fits (mid-measure cuts allowed)** — rejected: violates №18 "the engine never breaks a measure"; chords and barlines of a measure could land in different systems, which contradicts the printed notebook metaphor.
- **Force-shrink or truncate an over-wide measure to fit** — rejected: shrinking column widths below their text requirement or dropping columns silently loses content; №24 forbids silent truncation, and a measure that fits "by cheating" no longer measures what the model says.
- **Lay out text lines as wrapped boxes in the engine** — rejected: the engine would need the theme's proportional font metrics (№32), exactly the knowledge character units exist to keep out of the kernel; text lines stay pass-through until a stage proves otherwise.
