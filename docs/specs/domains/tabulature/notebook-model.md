# Notebook Model

> **Model landed (roadmap stage 2).** This component is implemented in `src/domain/tabulature/` (layer layout per [ADR-0003](../../decisions/0003-src-layer-directories.md)). Remaining `TODO: verify` markers refer to later stages. Citations of the form (№NN) refer to the numbered decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Role

The notebook model is the concrete entity catalog of the tabulature domain: the notebook, its two kinds of ribbon lines, columns with their two states, notes, barlines, and column texts — together with the structural rules that hold between them.

## Key Files

- `src/domain/tabulature/types.ts` — the entity catalog below as interfaces plus constants and the `ModelResult<T>` error-as-value contract
- `src/domain/tabulature/model.ts` — factories, mutations, cascade rules and `validateNotebook`
- `src/domain/tabulature/ids.ts` — deterministic id factory (№19)
- `src/domain/tabulature/fixtures.ts` — valid test notebooks built through public operations
- `src/domain/tabulature/__tests__/notebook-model.test.ts` — unit tests of the validation summary (№34)

Persistence as JSON is stage-7 infrastructure (№29).

## Behavior

### Entity catalog

| Entity | Fields (v1 intent) | Notes |
| ------ | ------------------ | ----- |
| Notebook | `version` (№22), `id` (№29), `name` (№29), `albumId` (№30), ribbon of lines | Root aggregate; serialized as one JSON document `tet-<id>.json` named by its stable `id` (№29). Every field listed ships from day one. |
| TabLine | ordered columns, strings (as MIDI note list, №2) | A tab system: the grid of strings × columns (№20). |
| TextLine | multiline text content | Standalone ribbon line; unlimited count; never attached to notes or columns (№6). |
| Column | stable `id` (№19); state: content or barline (№18) | Unites the cells of all strings; carries simultaneously played notes (№20). |
| Note | stable `id` (№19), `stringIndex`, `fret` 0–24 (№3), `duration` (№4) | Lives inside a content column, one per string. |
| Barline | (the barline state of a column; no separate fields beyond the column's own `id`) | A column that wholly is a barline (№18). |
| ColumnText | stable `id` (№19), `columnId` (№19), text content | Attached to a column by `columnId`; max 3 per column (№6). |
| Cell | (derived: a string × column intersection; no own `id`) | An empty cell is a rest — a rest entity in its own right, distinct from a deleted column (№20). |

The table matches `src/domain/tabulature/types.ts` (verified at stage 2); lines carry a `kind: 'tab' | 'text'` discriminator. JSON serialization itself is stage 7.

### Column state machine

```
                     insert fret (№21)
        ┌─────────────────────────────────────┐
        │                                     ▼
┌───────────────────┐    remove note (№21)   ┌──────────────────────┐
│ EMPTY CONTENT     │ ◀─────────────────────  │ CONTENT WITH NOTES   │
│ COLUMN            │                         │ ≤ 1 note per string  │
│ (each cell a      │                         │ ≤ 3 column texts (№6)│
│  rest, №20)       │                         └──────────────────────┘
└───────────────────┘
      │         ▲
      │         └────────────── clear barline (№35, №18)
      │ insert barline (№18) —
      ▼ allowed only from here
┌───────────────────┐
│ BARLINE COLUMN    │ holds no notes and no texts (№18)
└───────────────────┘

  CONTENT WITH NOTES ── insert barline (№18) ──▶ BLOCKED (№18)
```

**Reading the diagram:** an empty content column (every cell a rest) is the hub. Inserting a fret into an empty cell creates a note with a fresh `id` (№19, №21); removing a note clears the cell, which stays in the grid as a rest (№20, №21). A barline conversion applies only to a column that is free of notes (№18); clearing a barline returns an ordinary empty column (№35). A content column that already holds notes (a chord) never converts to a barline — the operation is blocked outright (№18).

Column-menu operations (№35) act on whole columns:

- **Insert column left / right** — a new empty content column appears beside the target.
- **Clear column** — all notes and texts of a content column are removed; the column itself remains. For a barline column, "clear" removes the barline state (№18).
- **Delete column** — the column is removed wholly, with all its content — the cascade (№19).

### Attachment and cascade rules

```
Notebook ──contains──▶ TabLine ──contains──▶ Column ──contains──▶ Note
    │                     │                    │
    │                     │                    └──attached by columnId──▶ ColumnText
    └──contains──▶ TextLine (standalone)
```

| Rule | Statement |
| ---- | --------- |
| Column delete cascade | Deleting a column always deletes its notes and its column texts (№19). |
| Text attachment | A column text always references its column by `columnId`, never by position and never a note (№19). |
| Chord semantics | Simultaneously played notes live in one column, one note per string at most (№20). |
| Measure extent | A measure is always the column range from one barline to the next; absent barlines, the whole tab line is one measure (№36). |
| Duration sum | The model always leaves measure duration sums unchecked — barlines are any length (№18). |
| Text-line independence | Deleting or editing any column, note, or barline always leaves text lines untouched (№6). |

### Validation summary

| Constraint | Rule | Source |
| ---------- | ---- | ------ |
| Fret range | `fret` is an integer in 0–24 | (№3) |
| One note per string per column | at most one note per (column, string) | (№20) |
| Column text limit | at most 3 texts attached to one column | (№6) |
| Barline purity | a barline column holds no notes and no texts | (№18) |
| Barline insertion precondition | barline conversion applies only to a column free of notes and texts | (№18) |
| Note edit identity | a fret edit preserves the note's `id` | (№21) |
| Duration presence | every note carries a `duration`; default quarter | (№4) |

This validation summary is the contract of `src/domain/tabulature/__tests__/notebook-model.test.ts` (№34) and of `validateNotebook` in `src/domain/tabulature/model.ts`.

## Error Handling

The model layer returns violations as values; it never throws across boundaries as control flow — the EXECUTE-stage convention of [architecture/data-flow.md](../../architecture/data-flow.md). Implemented as the `ModelResult<T>` union in `src/domain/tabulature/types.ts`.

| Violation | Intended model response |
| --------- | ---------------------- |
| Fret out of 0–24 (№3) | reject the mutation with a validation value; UI never offers out-of-range buttons (№21). |
| Barline into a column with notes (№18) | reject; the menu entry is also disabled (№18). |
| 4th column text (№6) | reject with a limit violation; editing surfaces a warning dialog (№35). |
| `columnId` referencing a deleted/nonexistent column | unrepresentable by construction: cascade delete removes texts with the column (№19). |

## Invariants

- Every notebook always carries `version` (№22), `name` (№29), and `albumId` (№30) from day one.
- Every note, barline, column, and column text always carries a stable unique `id` assigned at creation (№19).
- A column always spans all strings of its tab line (№2, №20).
- A column always is either a content column or a barline column, never both (№18).
- A barline column always holds no notes and no texts (№18).
- A content column always holds at most one note per string and at most 3 texts (№20, №6).
- Every note always stores `fret` in 0–24 and a `duration` (№3, №4).
- Every column text always references a column by `columnId` (№19).
- Deleting a column always deletes its notes and texts (№19).
- The tuning always lives as a list of MIDI note numbers — `[28, 33, 38, 43]` (E1 A1 D2 G2) in v1 (№2).
- The ribbon always mixes tab lines and text lines in any order, and text lines always stay unattached to notes and columns (№6).
- The model always leaves measure duration sums unchecked (№18).

## Related Specs

- [Tabulature domain README](README.md) — the domain overview this component belongs to: purpose, flow, configuration, extension points.
- [architecture/layers.md](../../architecture/layers.md) — Domain-layer purity rule R1 this model must satisfy.
- [architecture/data-flow.md](../../architecture/data-flow.md) — stage 3 (EXECUTE) semantics for mutations over this model.
- [META.md](../../META.md) — document format and update rules.
- [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md) — the pre-code bootstrap protocol behind every TODO marker in this file.
