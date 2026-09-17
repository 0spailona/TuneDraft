# Ribbon Lines and Gestures

> **Pre-code domain spec.** Written before any source code exists ([ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)); every claim about code that does not exist yet carries a `<!-- TODO: verify -->` marker.

## Role

Gesture-driven management of ribbon rows (insert, move, delete) via `react-native-gesture-handler` + `reanimated` (№11), plus the undo/redo history covering every model mutation (№25, №37) and the edit/read mode gating of all input (№40).

## Key Files

None yet — this domain's code is not implemented yet (the stage-1 scaffold, [ADR-0003](../../decisions/0003-src-layer-directories.md), ships only the layer skeleton and i18n). <!-- TODO: verify when first editing code lands -->

## Behavior

### Gesture vocabulary (№11)

A gesture is a finger movement the system recognizes as a command — as distinct from a plain tap (№11).

| Input | Command | Availability |
| ----- | ------- | ------------ |
| Tap | Select cell / column and open the context menu (№5, №21, №35) | Edit mode |
| «+» button (left corner) | Insert a ribbon row — type choice: tab line or text line (№36) | Edit mode |
| Long-press on an empty spot of the ribbon | Quick path: insert a text line (№36) | Edit mode |
| Drag a row | Move the row; every row on the page is movable (№36) | Edit mode |
| Long-press a row start → drag into the trash/cross | Delete the row (№36) | Edit mode |
| Drag along a string | «Pull the fret digit along the string» | Post-MVP (№5, №11) |
| Pinch | Zoom | Post-MVP candidate (№11) |

### Row insertion (№36, №38)

```
      «+» button (left corner of screen)          long-press empty ribbon spot
                │                                            │
                ▼                                            ▼
     mini type picker opens                        text line inserted
     ┌────────────────────────┐                    (multiline text, №6, №27)
     │ ○ Tab line             │                              │
     │ ○ Text line            │                              │
     └────────────────────────┘                              │
                │                                           │
                ▼                                           ▼
   row of the chosen type inserted (№36) ──► undo push ──► pocket write ──► re-flow
```

Text-line content is entered in a modal window; the text may be multiline (№27). The new-notebook template (№38) lives in the storage domain. Insertion position: text lines are insertable anywhere in the ribbon — before the first and after the last tab line included (№6). <!-- TODO: verify the exact position-choosing UX for the «+» insert -->

### Row handles (№36)

- The start of every tab line renders a **bass clef 𝄢** — traditional for bass guitar and the marker of a system's start; it doubles as the grab handle for drag and delete (№36).
- The start of a text line gets a **left edge-strip handle**; it appears on grab (№36).

```
 𝄢───────────────────┐   ← tab line: 𝄢 handle
  ▬ text line         ← text line: edge-strip handle (appears on grab)
 𝄢───────────────────┐
```

### Row deletion and measure deletion (№36)

Two paths:

1. **Single row** — long-press the row start (the 𝄢 handle or the strip) → drag the row into the drawn trash/cross. <!-- TODO: verify -->
2. **A measure or the whole tab line** — select a column, then **extend the selection** (as in text editing) and delete:
   - measure = the range from one bar line to the next; with no bar lines, the measure is the whole line (№36).

```
 𝄢 ─●──●──│──●──●──│──●──     ● = selected column
          └─ bar ─┘            │ = bar line (№18)
 selection extended → delete → measure removed
```

### Drag (№36)

Drag moves rows; all rows on the page are movable. Drag and trash are part of the MVP (roadmap stage 6, together with the row ribbon). The gesture stack — `react-native-gesture-handler` + `reanimated` — provides 60 fps animation off the JS thread (№11). <!-- TODO: verify gesture/scroll disambiguation -->

### Undo / Redo (№25, №37)

- Toolbar buttons: Undo ↶ («step back», up to 3 steps) and Redo ↷ («undo the undo») — the standard editor pair (№37).
- Undoable: **any model mutation** — notes, bar lines, texts, columns, ribbon rows (№25).
- History depth ≤ 3 in MVP (№25).

```
 M1 ──► M2 ──► M3 ──► M4      history after M4: [M2, M3, M4] — M1 evicted (depth 3, №25)

 undo ↶ ×2: M4, M3 undone     redo branch: [M4, M3] (M3 = most recently undone)
 redo ↷:                      restores M3 — the most recently undone mutation (№37)
 new mutation M5:             redo branch cleared; history: [M2, M5]
                               <!-- TODO: verify exact eviction semantics -->
```

### Mode gating (№40)

- Tap on a library card opens the notebook **for reading** — the primary scenario: open and play (№40); a **new** notebook opens **directly in edit mode** (№40).
- In the editor, a «Править»/«Чтение» toggle switches the mode at any moment, in both directions; menus and input panels appear only in edit mode (№40).
- Only one notebook is ever open at a time — for reading or editing alike (№26, №40).

```
 edit mode                          read mode
 ┌────────────────────┐             ┌────────────────────┐
 │ «+», menus, panel, │  toggle ←→  │ clean ribbon,      │
 │ handles, drag      │  (№40)      │ no input UI        │
 └────────────────────┘             └────────────────────┘
```

## Error Handling

- A drag dropped outside any valid drop target returns the row to its origin and mutates nothing. <!-- TODO: verify -->
- Deleting a row/measure is recoverable exclusively through undo (≤ 3 steps, №25); deeper mistakes are irreversible — accepted for MVP.
- In read mode, every editing input is ignored rather than rejected with errors (№40).

## Invariants

- Ribbon rows are always created through the «+» button or the empty-spot long-press; the long-press always yields a text line (№36).
- Every tab line always renders the 𝄢 handle at its start; every text line always exposes its strip handle on grab (№36).
- A measure always spans from one bar line to the next; with no bar lines, the measure always equals the whole tab line (№36).
- The undo history always holds at most 3 entries (№25).
- Undo always reverses any kind of model mutation — notes, bar lines, texts, columns, ribbon rows (№25).
- A new mutation always empties the redo branch; redo always restores the most recently undone mutation (№37). <!-- TODO: verify -->
- Every row-level mutation always follows the pipeline: mutate → undo push → pocket write → re-flow.
- Input UI always appears only in edit mode; the mode toggle always works in both directions (№40).

## Related Specs

- [Editing README](README.md) — domain overview and the shared mutation pipeline.
- [Cell and Column Menus](cell-and-column-menus.md) — cell/column selection and menus (№21, №35).
- [Notebook Model](../tabulature/notebook-model.md) — rows, measures, and cascade rules being mutated (№19).
- [Layout Engine](../layout-engine.md) — re-flow and measure integrity across line breaks (№18, №20).
- [App Shell](../app-shell.md) — toolbar with Undo/Redo (№37), the mode toggle (№40), virtualization of the long ribbon (№28).
- [Storage](../storage/README.md) — the pocket written after every action (№26).
