# Tabulature

> **Bootstrap spec.** This domain is specified before any code exists (see [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)). Claims about code that does not exist yet carry a `<!-- TODO: verify -->` marker. Citations of the form (№NN) refer to the numbered decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Purpose

The `tabulature` domain is the pure data model of a TuneDraft notebook: the entities of a tab document — notebook, ribbon lines, columns, notes, barlines, column texts — and the rules that govern them (identity, attachment, limits, cascades). Tabulature is the single notation format of v1 (№1). The domain stores musical data only; geometry is computed by the layout engine and pixels by the renderers (№14, №23).

## Key Files

None yet — this domain's code is not implemented yet (the stage-1 scaffold, [ADR-0003](../../decisions/0003-src-layer-directories.md), ships only the layer skeleton and i18n). Roadmap stage 2 (КАРТА §3) implements this model as pure TypeScript in the Domain layer defined by [architecture/layers.md](../../architecture/layers.md). <!-- TODO: verify when stage-2 model code lands -->

## Core Types

None yet. <!-- TODO: verify when stage-2 model code lands -->

## Flow

The primary structure of this domain is containment, not processing: a notebook holds a ribbon of lines, a tab line holds columns, a column holds notes and texts.

```
Notebook  { version (№22), name (№29), albumId (№30) }
│
└─ ribbon: ordered lines of exactly two kinds (№6)
   ├─ TabLine  — tab system: strings × columns grid (№20)
   │  ├─ strings: MIDI note list, v1 = E1 A1 D2 G2 (№2)
   │  ├─ Column — one cell per string; unites simultaneously
   │  │          played notes (№20)
   │  │  ├─ state: content column  OR  barline column (№18)
   │  │  ├─ Note       { id, stringIndex, fret 0–24, duration } (№19, №3, №4)
   │  │  └─ ColumnText { id, columnId } — max 3 per column      (№6, №19)
   │  └─ Cell (string × column intersection) — empty cell is a
   │           rest ("do not play"), carries no id of its own   (№20)
   └─ TextLine — multiline, standalone, any position in the
                 ribbon, unlimited count, never attached to
                 notes or columns (№6)
```

Mutation happy path — stage 3 (EXECUTE) of the canonical pipeline in [architecture/data-flow.md](../../architecture/data-flow.md):

1. A validated editing command arrives (e.g. "set fret 7 in cell (tab line, column, string)").
2. The model checks its own constraints: fret range (№3), barline conflict (№18), per-column text limit (№6).
3. On success the mutation is applied: every created entity receives a fresh stable `id` (№19); a fret edit reuses the note's existing `id` (№21).
4. The new model state is handed onward to persistence and to the layout engine; the model itself emits no coordinates and performs no I/O (№14, №23).

Steps 1–4 describe intended stage-2 behavior; no code exists yet. <!-- TODO: verify -->

## Invariants

- The ribbon always consists of lines of exactly two kinds: tab lines and text lines (№6).
- A text line always carries its content standalone — attached to neither notes nor columns — and may appear at any position in the ribbon, before the first and after the last tab line (№6).
- The ribbon always grows without a model-level bound; scroll windowing is a rendering concern (№6, №28).
- Every notebook always stores `version` (№22), a visible `name` inside its JSON (№29), and `albumId` (№30) at the root.
- Every note, barline, column, and column text always carries a stable unique `id`, assigned at creation and unchanged for the entity's lifetime (№19).
- Every column always spans all strings of its tab line and holds at most one note per string; simultaneous notes across different strings form a chord (№20).
- A column always exists in exactly one of two states: content column (notes plus at most 3 texts) or barline column (always free of notes and texts) (№18).
- Barline conversion always applies only to a column that is free of notes (№18).
- Every column text is always attached to its column by `columnId` (№19).
- Deleting a column always deletes its notes and its texts with it — the cascade (№19).
- Every note always records a `fret` within 0–24 (№3) and a `duration` that defaults to a quarter (№4).
- Editing a note's fret always preserves the note's `id` (№21); deleting a note always leaves its cell in place as a rest (№20, №21).
- The string set is always stored as a list of MIDI note numbers; v1 always ships exactly four strings, E1–A1–D2–G2 (№2).
- Measure extent always follows barline positions only; the model always leaves duration sums unchecked (№18).
- The model always stores musical data, never layout coordinates (№23).

These invariants become checkable at roadmap stage 2, where model unit tests are an acceptance criterion (№34). <!-- TODO: verify -->

## Configuration

All parameters below describe intent; none is read from code yet. <!-- TODO: verify -->

| Parameter | Default | Valid values | Source |
| --------- | ------- | ------------ | ------ |
| Notebook format `version` value | defined by the first JSON serializer (stage 2) | any version constant future migrations can dispatch on | (№22) |
| String tuning | `[E1, A1, D2, G2]` as MIDI note numbers `[28, 33, 38, 43]` | any list of MIDI note numbers; v1 ships exactly 4 entries | (№2) |
| Fret domain | — | integers 0–24 inclusive; 0 denotes the open string | (№3) |
| Note `duration` | quarter | duration value; the value vocabulary is finalized with the post-MVP palette | (№4) |
| Max texts per column | 3 | 0–3 column texts per column | (№6) |
| `albumId` | unset (no album) until albums ship post-MVP | reference to an album | (№30) |

## Extension Points

- **Fifth string (low B):** append one entry to the tuning list — a single config line; the model is unchanged and `stringIndex` simply takes its domain from the list length (№2).
- **Duration palette:** a post-MVP UI addition layered on the `duration` field that already exists from day one (№4).
- **Albums:** post-MVP grouping reads the day-one `albumId`; introducing albums requires no model migration (№30).
- **Format migrations:** the `version` field is the hook every future migrator dispatches on (№22).
- **Classic notation:** a hypothetical second notation format far after MVP and all deferred features; it arrives as a separate domain beside this one (№1).

## Related Specs

- [Notebook Model](notebook-model.md) — component detail: entity catalog, column states, operation rules, cascade and error semantics.
- [architecture/layers.md](../../architecture/layers.md) — the Domain layer this model lives in; purity rule R1.
- [architecture/data-flow.md](../../architecture/data-flow.md) — the five-stage pipeline whose EXECUTE stage this model serves.
- [META.md](../../META.md) — document format and update rules.
- [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md) — the pre-code bootstrap protocol behind every TODO marker in this file.
