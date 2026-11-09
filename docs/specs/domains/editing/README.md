# Editing

> **Editing landed (roadmap stage 5).** The mutation pipeline and history live in `src/application/editing/` (Application layer); the gesture and menu UI glue lives in the root `components/editor/` (Entry level) — see [ADR-0006](../../decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md). Ribbon drag/delete and the virtualized scroll window are stage 6 and keep `<!-- TODO: verify -->` markers. Citations of the form (№NN) refer to the numbered decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Purpose

Editing turns touch input into mutations of the notebook model. It owns selection of cells and columns (№5, №35), the bottom-panel context menus (№21, №36), gesture-driven management of ribbon rows (№11, №36), the undo/redo history wrapping every mutation (№25, №37), and the edit/read gating of all input (№40). Model shape, geometry, and persistence belong to other domains; editing only orchestrates mutations.

## Key Files

- `src/application/editing/types.ts` — `EditMode` (№40), `Selection` (cell/column, №5, №35), the `EditorIntent` union (all stage-5 operations + undo/redo, №37), `EditorState`, `EditorWarning`, `EditorEffect`, and the `PocketWriter` interface (№26; R2 inversion — implementation deferred to stage 7).
- `src/application/editing/history.ts` — snapshot undo/redo: `pushSnapshot`, `popUndo`, `popRedo`, `canUndo`/`canRedo`; depth ≤ 3 (`MAX_HISTORY_DEPTH`, №25); a new mutation always clears the redo branch (№37).
- `src/application/editing/controller.ts` — the pure pipeline `applyIntent(state, intent, gen) → ApplyResult`: mode gating (№40) → mutation → push undo (№25) → redo reset (№37) → pocket effect (№26); refusals mutate nothing and surface as `EditorWarning`.
- `src/application/editing/__tests__/controller.test.ts` — pipeline unit tests: gating, refusal-without-history, snapshot/eviction semantics (№34).
- `components/editor/EditorScreen.tsx` — Entry glue: `useReducer` over `applyIntent`, tap → hit-test dispatch, toolbar (№37), mode switch (№40), warning strip (№31), pocket-effect execution (no-op writer until stage 7).
- `components/editor/FretPanel.tsx` — fret grid 0–24 (№21); empty cell → «Тактовая черта», occupied cell → «Удалить ноту».
- `components/editor/ColumnMenu.tsx` — column menu (№35): insert left/right, clear, delete, add text; barline column → «Убрать черту».
- `components/editor/RowTypePicker.tsx` — «+» mini-picker: tab line / text line (№36).
- `components/editor/TextEntryModal.tsx` — text input modal (№27); multiline for text lines.

## Core Types

```ts
// src/application/editing/types.ts
export type EditMode = 'read' | 'edit';                       // №40
export type Selection = CellSelection | ColumnSelection;      // №5, №35

export type EditorIntent =                                    // all stage-5 ops + №37
  | { readonly type: 'insert-note'; ... }                     // №21, №3
  | { readonly type: 'edit-note'; ... }                       // id preserved (№21)
  | { readonly type: 'delete-note'; ... }                     // cell remains (№20)
  | { readonly type: 'set-barline'; ... }                     // №18
  | { readonly type: 'insert-column'; ... }                   // №35
  | { readonly type: 'clear-column'; ... }                    // №35
  | { readonly type: 'delete-column'; ... }                   // №19, №35
  | { readonly type: 'add-column-text'; ... }                 // ≤ 3 texts (№6, №35)
  | { readonly type: 'edit-column-text'; ... }                // №27, №35
  | { readonly type: 'insert-tab-line'; position: number; columnCount: number } // №36
  | { readonly type: 'insert-text-line'; position: number; text: string }       // №36, №27
  | { readonly type: 'undo' } | { readonly type: 'redo' };    // №25, №37

export interface EditorState {
  readonly notebook: Notebook;
  readonly mode: EditMode;
  readonly selection: Selection | null;   // for UI; ops target explicit ids
  readonly warning: EditorWarning | null; // last refusal; success or a mode switch clears it (№40)
  readonly history: EditorHistory;        // snapshot stacks (№25, №37)
}

export type EditorEffect = { readonly kind: 'write-pocket'; readonly notebook: Notebook }; // №26

export interface PocketWriter { write(notebook: Notebook): void } // R2 inversion; stage 7 impl
```

```ts
// src/application/editing/history.ts
export interface EditorHistory {
  readonly undo: readonly Notebook[]; // snapshots taken before mutations, oldest → newest
  readonly redo: readonly Notebook[]; // states removed by undo, most recently undone last
}
```

## Flow

Primary happy path — inserting a note into an empty cell (№5, №21):

```
 edit mode active (№40)
       │
       ▼
 tap on a cell ──► hit-test over the draw plan ──► cell selected,
 (№5, №35)         (hit-test.ts, rendering)        bottom panel opens:
                                                   fret digits 0–24 + bar-line button
                                                   (empty cell, №21)
       │
       ▼
 fret digit pressed ──► intent 'insert-note'
       │
       ▼
 applyIntent (controller.ts, Application):
 mutation via the tabulature model (fresh `id`, fret 0–24,
 `duration` defaults to quarter, №4)
       │
       ├─► undo snapshot push — depth ≤ 3 (№25)
       ├─► pocket write effect (№26 — executed by Entry, stage 7 storage)
       ▼
 layout re-flow (layout-engine) ──► screen re-render
```

Every mutation in this domain — menu action or gesture — follows the same tail: mutate → push undo → pocket effect → re-flow. Operations follow the canonical five-stage pipeline of [data-flow.md](../../architecture/data-flow.md).

## Invariants

- A tap always resolves to exactly one selection target — a cell or a column (№5, №35).
- The cell menu and the column menu are distinct menus (№35).
- Context menus always open in the bottom panel — the zone where the system keyboard normally appears — and always non-modally (№21, №36).
- Fret input always accepts exactly the integers 0–24 (№3, №21).
- Editing a note always preserves its `id`; only the fret value changes (№21).
- Every model mutation produced by this domain enters the undo history, and the history always holds at most 3 entries (№25).
- Undo always reverses any kind of model mutation — notes, bar lines, texts, columns, ribbon rows (№25).
- A new mutation always empties the redo branch; redo always restores the most recently undone mutation (№37).
- Editing input of any kind is enabled only in edit mode; read mode always renders the ribbon without menus, panels, and handles (№40). The Save/Undo/Redo toolbar buttons (№37) render only in edit mode (№40; acceptance 2026-11-09) — the controller still accepts undo/redo intents in read mode (ADR-0006), the screen simply does not offer them.

## Configuration

Fixed constants (project-map decisions; not user-configurable in MVP):

| Parameter | Default | Valid values | Source |
| --------- | ------- | ------------ | ------ |
| Fret range on the insert/edit panel | 0–24 | integers 0..24 | №3, №21 |
| Undo depth | 3 | ≥ 1; fixed at 3 in MVP | №25 |
| Column text limit | 3 per column | 1..3; the 4th is refused with a warning | №35 |
| Column text length | 12 characters | at most 12; longer input is refused with a warning | №24 |

## Extension Points

- Post-MVP input gestures slot in without model changes: «drag along string» fret entry (№5), dragging a fret digit along the string (№11), pinch zoom (№11, candidate).
- A durations palette (post-MVP, №4) extends the fret panel; the `duration` field already exists in the model.
- New menu actions: each new mutation joins the same pipeline — menu → mutate → push undo → pocket write → re-flow — and inherits undo semantics automatically (№25).
- Raising the undo cap above 3 later touches only `MAX_HISTORY_DEPTH` in `src/application/editing/history.ts` (№25).
- Stage 6 (ribbon drag/delete, virtualization) reuses the same controller: drag/reorder and trash-delete arrive as new intents or entry-level gesture glue over the existing pipeline.

## Related Specs

- [Cell and Column Menus](cell-and-column-menus.md) — bottom-panel menus for the selected cell/column (№21, №35).
- [Ribbon Lines and Gestures](lines-and-gestures.md) — row insertion, drag, deletion, undo/redo mechanics, mode gating (№11, №36, №25, №37, №40).
- [Tabulature](../tabulature/README.md) — the model domain being mutated.
- [Notebook Model](../tabulature/notebook-model.md) — entities and the id/cascade rules behind these operations.
- [Layout Engine](../layout-engine.md) — re-flow after every mutation (№14, №20).
- [App Shell](../app-shell.md) — the edit/read toggle and the toolbar hosting Undo/Redo (№37, №40).
- [Storage](../storage/README.md) — the pocket written after every action (№26).
- [Data Flow](../../architecture/data-flow.md) — the canonical five-stage pipeline.
