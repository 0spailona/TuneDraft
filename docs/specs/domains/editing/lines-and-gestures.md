# Ribbon Lines and Gestures

> **Stage 5 landed — stage 6 pending.** Row insertion (via the controller + `insertLine`), the undo/redo history, and the mode gating are implemented and verified against the code (see [ADR-0006](../../decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md)); drag, the trash, and the virtualized scroll window are roadmap stage 6 and keep `<!-- TODO: verify -->` markers. Citations of the form (№NN) refer to the numbered decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Role

Gesture-driven management of ribbon rows (insert, move, delete) via `react-native-gesture-handler` + `reanimated` (№11), plus the undo/redo history covering every model mutation (№25, №37) and the edit/read mode gating of all input (№40).

## Key Files

- `src/application/editing/history.ts` — the snapshot undo/redo store: `MAX_HISTORY_DEPTH = 3`, `pushSnapshot`/`popUndo`/`popRedo`, `canUndo`/`canRedo` (№25, №37).
- `src/application/editing/controller.ts` — undo/redo intents (`applyIntent`): gated on mode, not mutations — allowed in read mode; a rollback pushes no snapshot but rewrites the pocket — the pocket follows the visible draft (№26, [storage/pocket.md](../storage/pocket.md)).
- `src/application/editing/types.ts` — `EditorHistory`, undo/redo members of `EditorIntent`.
- `components/editor/EditorScreen.tsx` — toolbar Undo/Redo wiring with `canUndo`/`canRedo` enablement (buttons rendered in edit mode only, №40), the «+» button and picker, the long-press → text-line modal, mode toggle (№36, №37, №40).
- `components/editor/RowTypePicker.tsx`, `components/editor/TextEntryModal.tsx` — the «+» mini-picker (№36) and the text-line input modal (№27).
- `src/domain/tabulature/model.ts` — `insertLine(notebook, line, position)`, the single row-insertion contract (№36; see [Notebook Model](../tabulature/notebook-model.md)).

Drag handles, row move, and the trash have no files yet — stage 6. <!-- TODO: verify when stage-6 drag/trash code lands -->

## Behavior

### Gesture vocabulary (№11)

A gesture is a finger movement the system recognizes as a command — as distinct from a plain tap (№11).

| Input | Command | Availability |
| ----- | ------- | ------------ |
| Tap | Select cell / column and open the context menu (№5, №21, №35) | Edit mode |
| «+» button (left corner) | Insert a ribbon row — type choice: tab line or text line (№36) | Edit mode |
| Long-press on an empty spot of the ribbon | Quick path: insert a text line (№36) | Edit mode |
| Drag a row | Move the row; every row on the page is movable (№36) | Edit mode; stage 6 |
| Long-press a row start → drag into the trash/cross | Delete the row (№36) | Edit mode; stage 6 |
| Drag along a string | «Pull the fret digit along the string» | Post-MVP (№5, №11) |
| Pinch | Zoom | Post-MVP candidate (№11) |

Stage 5 ships the tap, the «+» button, and the long-press (canvas `onTap`/`onLongPress` in `NotebookCanvas`); drag and trash arrive with the stage-6 ribbon work.

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

Text-line content is entered in a modal window; the text may be multiline (№27). The modal is shared by both text inputs (the text line and the column text); its input lifts above the software keyboard (`KeyboardAvoidingView`, padding behavior — on modern Android the edge-to-edge modal dialog window ignores `adjustResize`, so the compensation is done in the entry layer). Dismissal semantics (№27): a tap **outside** the card commits the draft through the same confirm path as the «Готово» button (model mutation → undo push → pocket write, №25/№26); when the trimmed text is empty there is nothing to commit, so the same tap acts as a cancel; the hardware back button always cancels. The new-notebook template (№38) lives in the storage domain. Insertion position: text lines are insertable anywhere in the ribbon — before the first and after the last tab line included (№6). In the stage-5 UI both the «+» picker and the long-press insert at the **end of the ribbon** (`position = lines.length`); choosing a position among existing rows is stage-6 UX (the model already accepts any position in `0..lines.length`).

The type picker is modal-free and dismissed by the next canvas gesture — any tap (on a target or on empty space) and the empty-spot long-press close it (№36). The «+» button stays rendered in edit mode even with a cell/column panel or menu open; the type picker is its one exception: while the picker is open, «+» yields its slot to the picker and reappears when the next canvas gesture closes it (№36). Edit mode is the availability gate of the pair — «+» opens the picker, the next gesture dismisses it, and both exist only in edit mode (№36, №40).

Row insertion at the model level always goes through `insertLine(notebook, line, position): ModelResult<Notebook>` — the value-error contract of [Notebook Model](../tabulature/notebook-model.md); the stage-2 fixtures-only `appendLine` was removed when `insertLine` landed with stage 5. Drag/reorder (stage 6) reuses the same contract (see the notebook-model spec).

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

Implemented in `src/application/editing/` (verified against `history.ts`, `controller.ts`, and `controller.test.ts`):

- Toolbar buttons: Undo ↶ («step back», up to 3 steps) and Redo ↷ («undo the undo») — the standard editor pair (№37); wired in `EditorScreen` with `canUndo`/`canRedo` enablement, rendered in edit mode only (№40 — read mode offers no undo/redo UI, acceptance 2026-11-09; the controller still accepts the intents in read mode per ADR-0006).
- Undoable: **any model mutation** — notes, bar lines, texts, columns, ribbon rows (№25).
- History depth ≤ 3 in MVP (№25, `MAX_HISTORY_DEPTH = 3`).
- Representation: **state snapshots** — `pushSnapshot` stores the notebook reference from *before* the mutation; no inverse operations exist, so any new mutation inherits undo semantics for free (ADR-0006).

```
 M1 ──► M2 ──► M3 ──► M4      history after M4: [M2, M3, M4] — M1 evicted (depth 3, №25)

 undo ↶ ×2: M4, M3 undone     redo branch: [M4, M3] (M3 = most recently undone)
 redo ↷:                      restores M3 — the most recently undone mutation (№37)
 new mutation M5:             redo branch cleared; history: [M2, M5]
```

`popUndo` moves the current notebook into the redo branch (last — the most recently undone), `popRedo` mirrors it back; both undo and redo sanitize the selection point-wise and symmetrically (review ST-5, finding 1a): a selection whose line or column no longer resolves in the restored notebook is cleared, a valid selection survives. A cell selection also requires its string to exist (review ST-5, round 3, finding 1a): a `stringIndex` outside the line's tuning clears the selection — the fret panel must not hang over a string that does not resolve (unreachable through the current UI, tuning is constant; the check guards stage-6 line editing). An undo/redo is not a mutation: it pushes no snapshot and never fails — an empty branch leaves the state untouched. The pocket is the one exception to «not a mutation»: a rollback changes the model, so it emits the `write-pocket` effect too (№26) — a crash must not resurrect an undone action.

### Mode gating (№40)

- Tap on a library card opens the notebook **for reading** — the primary scenario: open and play (№40); a **new** notebook opens **directly in edit mode** (№40).
- In the editor, a «Править»/«Чтение» toggle switches the mode at any moment, in both directions; menus, input panels, and the Сохранить/Отменить/Вернуть toolbar buttons appear only in edit mode (№40).
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

- Ribbon rows are always created through the «+» button or the empty-spot long-press; the long-press always yields a text line (№36); both always insert at the end of the ribbon until stage 6 adds positional UX.
- Every tab line always renders the 𝄢 handle at its start; every text line always exposes its strip handle on grab (№36).
- A measure always spans from one bar line to the next; with no bar lines, the measure always equals the whole tab line (№36).
- The undo history always holds at most 3 entries (№25).
- Undo always reverses any kind of model mutation — notes, bar lines, texts, columns, ribbon rows (№25).
- A new mutation always empties the redo branch; redo always restores the most recently undone mutation (№37; verified: `pushSnapshot`/`popUndo`/`popRedo` in `src/application/editing/history.ts`).
- Every row-level mutation always follows the pipeline: mutate → undo push → pocket write → re-flow.
- Input UI (menus, panels, and the Save/Undo/Redo toolbar buttons) always appears only in edit mode; the mode toggle always works in both directions (№40).

## Related Specs

- [Editing README](README.md) — domain overview and the shared mutation pipeline.
- [Cell and Column Menus](cell-and-column-menus.md) — cell/column selection and menus (№21, №35).
- [Notebook Model](../tabulature/notebook-model.md) — rows, measures, and cascade rules being mutated (№19).
- [Layout Engine](../layout-engine.md) — re-flow and measure integrity across line breaks (№18, №20).
- [App Shell](../app-shell.md) — toolbar with Undo/Redo (№37), the mode toggle (№40), virtualization of the long ribbon (№28).
- [Storage](../storage/README.md) — the pocket written after every action (№26).
