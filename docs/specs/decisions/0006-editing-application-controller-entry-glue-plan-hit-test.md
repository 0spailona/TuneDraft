# ADR-0006: Editing stage 5 — application controller, entry glue, plan hit-test

## Status

Accepted

## Context

Roadmap stage 5 lands two firsts at once: the first Application-layer code (`src/application/editing/` — the editing controller, undo/redo history) and the first Entry-level UI beyond the two Expo-required root files `App.tsx`/`index.ts` (the editor screen). [ADR-0003](0003-src-layer-directories.md) fixed the `src/` layer directories but deliberately deferred where additional Entry-level UI code lives. Five decisions had to be made before the code could exist:

1. Where the editor screen and its panels live, so that R4 (entry files contain no business logic) stays auditable by directory.
2. How undo/redo history is represented — command objects with inverse operations, or state snapshots.
3. How ribbon-line insertion reaches the model — the stage-2 model shipped only a fixtures-only `appendLine`, while the spec contract is `insertLine(notebook, line, position)`.
4. How the autosave pocket write (№26, Infrastructure) reaches the Application controller without breaking R2 (Application never imports Infrastructure directly).
5. Where tap → selection-target resolution lives — the tap needs `(lineId, columnId, stringIndex)`, which only the drawn geometry knows.

## Decision

1. **Editor UI glue lives in the root folder `components/editor/`** (Entry level, next to `App.tsx`):

   ```
   components/editor/
   ├── EditorScreen.tsx    useReducer over applyIntent; hit-test dispatch,
   │                       mode switch, toolbar wiring, warning strip
   ├── FretPanel.tsx       fret grid 0–24; empty cell → «Тактовая черта»,
   │                       occupied cell → «Удалить ноту» (no bar-line button)
   ├── ColumnMenu.tsx      insert left/right, clear, delete, add text;
   │                       barline column → «Убрать черту» instead of texts
   ├── RowTypePicker.tsx   «Таб-строка / Текст-строка» mini-picker for «+»
   └── TextEntryModal.tsx  text input modal (№27); multiline for text lines
   ```

   These components are Entry-level glue (R4): they translate taps and panel presses into controller intents and render controller state — no domain rules, no mutation pipeline, no drawing. `App.tsx` stays pure wiring: `GestureHandlerRootView` + `EditorScreen` + demo fixture. Dependencies point downward only: `components/editor/*` may import `src/application/*`, `src/domain/*`, `src/infrastructure/*`, `src/i18n` — never the reverse. The ESLint zones already forbid `src/**` from importing `App.tsx`/`index.ts`; the R4 zone applies the same entry-file ban to `components/**`.

2. **Undo/redo are whole-notebook state snapshots, depth 3** (`src/application/editing/history.ts`): `pushSnapshot` stores the notebook reference from **before** a successful mutation; the oldest snapshot is evicted beyond depth 3 (№25); any new mutation clears the redo branch (№37); `popUndo` moves the current state into the redo branch, `popRedo` restores the most recently undone snapshot. No inverse operations are computed — undo always reverses any mutation kind for free (№25). Undo/redo are allowed in read mode (toolbar №37 works in both modes); any other intent is ignored in read mode (№40).

3. **`insertLine(notebook, line, position): ModelResult<Notebook>` is introduced at stage 5** in `src/domain/tabulature/model.ts` — the single ribbon-insertion path. The «+» button and the empty-spot long-press both append at the ribbon end (`position = lines.length`); a positional insert UX is stage 6. The stage-2 fixtures-only `appendLine` was removed when `insertLine` landed.

4. **The pocket is an interface owned by the consumer** (`PocketWriter` in `src/application/editing/types.ts`): the controller's only effect is `{ kind: 'write-pocket', notebook }`, executed by the Entry level. Stage 5 ships a module-level no-op writer in `EditorScreen.tsx`; the real `expo-file-system` implementation arrives with storage (stage 7) and is injected at the same place. A failed pocket write never blocks or rolls back an action (pocket.md).

5. **Hit-test lives in rendering, over the draw plan** (`src/infrastructure/rendering/hit-test.ts`): the plan already owns px geometry, so `plan.ts` emits tap zones (`hitZones`) and `hitTestPlan` resolves a point to a zone target — a cell or a column — with no geometry of its own. The hit-test uses rendering's own `SelectionTarget` vocabulary and never imports application types (R3: infrastructure does not reach up); `EditorScreen` maps it to the structurally identical application `Selection`. A tap outside all zones resolves to `null` — a refusal to select, not a target.

## Consequences

**Positive**

- The controller is a pure function (`applyIntent(state, intent, gen) → { state, effects }`): trivially unit-testable without React, gestures, or files; the screen adds only `useReducer` + effect execution.
- Snapshot undo makes «undo reverses any mutation» structural — new operations inherit history semantics automatically (№25).
- `PocketWriter` keeps R2 true without stubs inside the application layer; swapping the no-op for the real stage-7 writer touches only the Entry wiring.
- The hit-test is reusable by the future preview/library surfaces and testable against the plan without a device; zones-not-overlap is pinned by tests.

**Negative**

- Snapshots hold up to 3 full notebooks plus the redo branch — acceptable at MVP model sizes; revisiting means capping per-entry cost, not changing semantics.
- The eviction policy (oldest snapshot dropped) means undo depth is a hard window, not a full history — accepted by №25.
- A third root convention (`components/`) joins `App.tsx`/`index.ts` and `src/`; the layers.md audit must remember Entry-level UI lives there.
- ESLint mechanically bans entry-file imports from `components/**` (the R4 zone pairs it with `src/infrastructure/**`); the reverse direction — `src/**` importing `components/**` — remains review-enforced.

## Alternatives Considered

- **`src/entry/` or `src/components/` for the UI glue** — rejected: contradicts ADR-0003, which fixed `src/` as the home of the canonical layers; Entry Points are the repo root by Expo convention (`main` → `index.ts`).
- **Flat root files (`EditorScreen.tsx` next to `App.tsx`)** — rejected: five cooperating components at the root bury the two toolchain-required files and leave no room for the future library screen (stage 7).
- **Command objects with inverse operations for undo** — rejected: every new mutation would have to ship an inverse; a refusals-and-cascades model makes inverses error-prone, while snapshots are uniform (№25).
- **Hit-test in the application layer** — rejected: it would either duplicate geometry in Application or pull the plan across the R3 boundary; the plan already owns px zones, and rendering must not import application types.
- **Pocket write inside the controller via a direct `expo-file-system` import** — rejected: breaks R2; the controller would become untestable without a file system.
- **Positional row insertion UX at stage 5** — deferred: the model accepts any `position` in `0..lines.length`; the chooser is part of the stage-6 ribbon work (drag/move).
