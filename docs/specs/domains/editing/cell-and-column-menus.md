# Cell and Column Menus

> **Editing landed (roadmap stage 5).** The menus are implemented: UI glue in `components/editor/` (Entry), the mutation pipeline in `src/application/editing/` (Application) — see [ADR-0006](../../decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md). Claims about implemented behavior are verified against the code; stage-6+ features keep `<!-- TODO: verify -->` markers.

## Role

The bottom-panel context menus that turn a selected cell (№5, №21) or a selected column (№35) into model mutations: fret insertion/editing, bar lines, column insert/clear/delete, and column texts.

## Key Files

- `components/editor/FretPanel.tsx` — the cell menu panel: fret digits 0–24 in rows of 9; empty cell → «Тактовая черта», occupied cell → «Удалить ноту» and no bar-line button (№21, №18).
- `components/editor/ColumnMenu.tsx` — the column menu panel: insert left/right, clear, delete, add text; edit text opens the keyboard pre-filled with the chosen text (one text → directly; 2–3 texts → the menu first expands the list of the column's texts); barline column → «Убрать черту» instead of text actions and without «Clear» (№35, №18).
- `components/editor/EditorScreen.tsx` — selection state, hit-test dispatch, intent routing from both panels into `applyIntent`, warning display (№31).
- `src/application/editing/controller.ts` — the pipeline every menu action runs through (see [README.md](README.md)).
- `src/domain/tabulature/model.ts` — the model operations behind the menus (№19, №20, №35).

## Behavior

### Selection (№5, №35)

| Input | Target selected | Menu opened |
| ----- | --------------- | ----------- |
| Tap on a cell (string × column intersection) | Cell | Cell menu (№21) |
| Tap on the column header / top zone of a column | Column | Column menu (№35) |

The cell menu and the column menu are distinct menus (№35); a tap resolves to exactly one of them.

### Cell menu (№21) — always in the bottom panel (№36)

The panel occupies the zone where the system keyboard normally appears; it is a panel, not a modal dialog (№21, №36). Behavior branches on cell state:

```
                 tap on cell (№5)
                       │
                       ▼
        ┌──────────────┴───────────────┐
        ▼                              ▼
   EMPTY CELL                    OCCUPIED CELL
        │                              │
        ▼                              ▼
 INSERT PANEL (immediate)        EDIT PANEL
 • fret buttons 0–24             • same fret buttons 0–24,
   (digits, several rows)          but NO bar-line button (№21)
 • bar-line button               • "Delete note":
   (№18)                            cell cleared, cell remains
```

- Empty cell → the insert panel appears immediately: fret digits 0–24 in several rows + the bar-line button (№21).
- Pressing a fret digit on an empty cell creates a note: fresh `id`, fret 0–24, `duration` defaults to quarter (`DEFAULT_DURATION` in `src/domain/tabulature/types.ts`; `insertNote` applies it when the panel sends no duration — №4).
- Bar line on an empty cell → the whole column becomes a bar-line column (a vertical line across all 4 strings, №18). If the column already holds notes (a chord) — insertion is blocked (№18). A bar-line column holds no texts (№18, №35).
- While the cell menu is open, the «bar line» press turns the column into a bar-line column and the panel switches to the column menu (№35); the selection becomes the column's as well — the canvas highlights the whole column, not the now-empty cell (review ST-5, finding 7a). A bar-line cell is always empty, so the fret digits and a repeated bar-line button would only be refused (`column-is-barline`, `barline-already-set`). Removing the bar line from the column menu keeps the column menu open on the now-ordinary column.
- Occupied cell → the edit panel: the same fret digits, without the bar-line button — the fret value changes, the note `id` is preserved (№21) — plus «delete note»: the cell is cleared and remains as a cell (№21; the empty cell is a rest entity, №20).

### Column menu (№35)

Opened by tapping the column header/top zone (№35), in the bottom panel (№36). Actions:

| Action | Effect | Notes |
| ------ | ------ | ----- |
| Insert column left / right | An empty column is inserted on that side | №35 |
| Clear column | All notes and texts of the column are removed; the column itself remains | №35; the button is hidden for a bar-line column — see below |
| Delete column | The column is removed entirely, with all its content — cascade per №19 | №35 |
| Add text | Standard text keyboard opens; text is bound to the column by `columnId` (№19) | №27, №35; the button stays available for any non-barline column — max 3, see below |
| Edit text | The same keyboard opens pre-filled with the chosen text; with 2–3 texts the menu first expands the list of the column's texts, picking one opens the keyboard | №27, №35; the edited text keeps its `id` |

Text limit: a column carries at most 3 texts; when it already has 3, adding another is refused with a warning — like the width-threshold refusal of №24 (no silent truncation; both refusals are enforced in the model since stage 5: `column-text-limit`, `column-text-too-long`). The refusal surfaces as `column-text-limit` (model value) → `EditorWarning.code` → dictionary string `warning.column-text-limit` («Максимум 3 текста на колонку», №31); the copy lives in `src/i18n/ru.ts`, owned by the dictionary, not by the menu.

Bar-line column menu (№18, №35): «Clear» is not shown — clearing a bar-line column removes the bar line (an empty ordinary column remains), so the single «Убрать черту» button carries the action; insert left/right and «delete» behave as for an ordinary column.

### Every action enters history and persistence

Each menu action is a model mutation and follows the domain pipeline: mutate → push undo (depth ≤ 3, №25) → pocket write after every action (№26) → layout re-flow. Text entry goes through the standard keyboard; the text-line modal belongs to [Ribbon Lines and Gestures](lines-and-gestures.md) (№27, №36).

Menus appear only in edit mode; in read mode taps produce no menus (№40).

## Error Handling

- Blocked operations surface as refusals with warnings, never silent truncation or silent no-ops: bar line into a column holding notes (№18), a 4th column text (№35, by analogy with №24).
- A refused action mutates nothing and creates no undo entry: `applyIntent` returns the notebook, history, and pocket untouched — only `EditorWarning` lands in the state (verified: `src/application/editing/controller.ts`, pinned by `controller.test.ts`).
- Deleting a column cascades without confirmation prompt in MVP (verified: `ColumnMenu` dispatches `delete-column` straight into the pipeline — №35, №19 define no confirmation); recovery is via undo (≤ 3 steps, №25).

## Invariants

- A tap selects exactly one target — a cell or a column (№5, №35).
- The cell menu and the column menu always remain distinct menus (№35).
- The menus always open as a non-modal panel in the bottom of the screen — the keyboard zone (№21, №36).
- The fret panel always offers exactly the digits 0–24 (№3, №21).
- The bar-line button appears only for an empty cell; the edit panel always omits it (№21, №18).
- Editing a note always preserves its `id` (№21).
- Deleting a note always clears the cell and leaves the cell in place (№21).
- Clearing a column always removes its notes and texts and keeps the column (№35).
- Deleting a column always removes the column with all its notes and texts — cascade (№19, №35).
- A column always holds at most 3 texts; the 4th is always refused with a warning (№35).
- A bar-line column always holds no texts (№18, №35).
- A bar-line column menu always shows «Убрать черту» and always omits «Clear» — clearing and removing the bar line are one operation (№35, №18).
- The cell panel over a bar-line column always switches to the column menu, and the selection always becomes the column's (№35).
- Every menu action always enters the undo history (≤ 3 entries, №25) and triggers a pocket write (№26).
- The menus appear only in edit mode (№40).

## Related Specs

- [Editing README](README.md) — domain overview, pipeline, mode gating.
- [Ribbon Lines and Gestures](lines-and-gestures.md) — row-level operations, undo/redo mechanics, the text-line modal.
- [Notebook Model](../tabulature/notebook-model.md) — the entities these menus mutate; id and cascade rules (№19).
- [Layout Engine](../layout-engine.md) — column width and re-flow after inserts (№20).
- [App Shell](../app-shell.md) — the edit/read toggle (№40).
- [ADR-0006](../../decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md) — why the menus are Entry glue over an Application controller.
