# Editing

> **Pre-code domain spec.** TuneDraft has no source code yet ([ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)). This document defines intended behavior for the first implementation; every claim about code that does not exist yet carries a `<!-- TODO: verify -->` marker.

## Purpose

Editing turns touch input into mutations of the notebook model. It owns selection of cells and columns (№5, №35), the bottom-panel context menus (№21, №36), gesture-driven management of ribbon rows (№11, №36), the undo/redo history wrapping every mutation (№25, №37), and the edit/read gating of all input (№40). Model shape, geometry, and persistence belong to other domains; editing only orchestrates mutations.

## Key Files

None yet — the repository contains no source code. <!-- TODO: verify when first editing code lands -->

Intended placement (see [layers.md](../../architecture/layers.md)): mutation orchestration lives in the Application layer; gesture and menu UI glue sits at the Entry-Points level. <!-- TODO: verify -->

## Core Types

None yet. <!-- TODO: verify when first editing code lands -->

Planned forward-looking shape (to live beside the model in the tabulature domain): a selection reference — cell or column — and a mutation-intent union covering the operations listed under [Flow](#flow). <!-- TODO: verify -->

## Flow

Primary happy path — inserting a note into an empty cell (№5, №21):

```
 edit mode active (№40)
       │
       ▼
 tap on a cell ──► cell selected ──► bottom panel opens:
 (№5, №21)                           fret digits 0–24 + bar-line button
                                     (empty cell, №21)
       │
       ▼
 fret digit pressed
       │
       ▼
 model mutation: note placed into the cell
 (fresh `id`; fret 0–24; `duration` defaults to quarter, №4)
       │
       ├─► undo history push — depth ≤ 3 (№25)
       ├─► pocket write after every action (№26 — storage domain)
       ▼
 layout re-flow (layout-engine) ──► screen re-render
```

Every mutation in this domain — menu action or gesture — follows the same tail: mutate → push undo → write pocket → re-flow. Operations follow the canonical five-stage pipeline of [data-flow.md](../../architecture/data-flow.md).

## Invariants

- A tap always resolves to exactly one selection target — a cell or a column (№5, №35).
- The cell menu and the column menu are distinct menus (№35).
- Context menus always open in the bottom panel — the zone where the system keyboard normally appears — and always non-modally (№21, №36).
- Fret input always accepts exactly the integers 0–24 (№3, №21).
- Editing a note always preserves its `id`; only the fret value changes (№21).
- Every model mutation produced by this domain enters the undo history, and the history always holds at most 3 entries (№25).
- Undo always reverses any kind of model mutation — notes, bar lines, texts, columns, ribbon rows (№25).
- A new mutation always empties the redo branch; redo always restores the most recently undone mutation (№37). <!-- TODO: verify -->
- Editing input of any kind is enabled only in edit mode; read mode always renders the ribbon without menus, panels, and handles (№40).

## Configuration

No configuration file exists yet. <!-- TODO: verify when configuration is introduced -->

Fixed constants (project-map decisions; not user-configurable in MVP):

| Parameter | Default | Valid values | Source |
| --------- | ------- | ------------ | ------ |
| Fret range on the insert/edit panel | 0–24 | integers 0..24 | №3, №21 |
| Undo depth | 3 | ≥ 1; fixed at 3 in MVP | №25 |
| Column text limit | 3 per column | 1..3; the 4th is refused with a warning | №35 |

## Extension Points

- Post-MVP input gestures slot in without model changes: «drag along string» fret entry (№5), dragging a fret digit along the string (№11), pinch zoom (№11, candidate).
- A durations palette (post-MVP, №4) extends the fret panel; the `duration` field already exists in the model.
- New menu actions: each new mutation joins the same pipeline — menu → mutate → push undo → pocket write → re-flow — and inherits undo semantics automatically (№25).
- Raising the undo cap above 3 later touches only the history store (№25). <!-- TODO: verify -->

## Related Specs

- [Cell and Column Menus](cell-and-column-menus.md) — bottom-panel menus for the selected cell/column (№21, №35).
- [Ribbon Lines and Gestures](lines-and-gestures.md) — row insertion, drag, deletion, undo/redo mechanics, mode gating (№11, №36, №25, №37, №40).
- [Tabulature](../tabulature/README.md) — the model domain being mutated.
- [Notebook Model](../tabulature/notebook-model.md) — entities and the id/cascade rules behind these operations.
- [Layout Engine](../layout-engine.md) — re-flow after every mutation (№14, №20).
- [App Shell](../app-shell.md) — the edit/read toggle and the toolbar hosting Undo/Redo (№37, №40).
- [Storage](../storage/README.md) — the pocket written after every action (№26).
- [Data Flow](../../architecture/data-flow.md) — the canonical five-stage pipeline.
