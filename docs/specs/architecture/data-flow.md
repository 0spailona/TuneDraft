# Data Flow

> **Pipeline exercised (roadmap stage 5).** The first editor operation — «insert a note» — is implemented: the Entry glue in `components/editor/` parses and validates input, the Application controller `src/application/editing/controller.ts` executes the pipeline, and the model mutates as values. The worked example below records the concrete file paths per stage, verified against the tree. Stages 6–8 operations (ribbon drag, save/load, PDF export) keep `TODO: verify` markers until they land (see [WORKFLOW.md](../WORKFLOW.md) §6).

## Context

A data-flow contract fixed early prevents the two classic failure modes of young projects: validation scattered across layers (same check in three places, none authoritative) and internal types leaking to boundaries (changing a database row breaks an API response). This document was fixed before the first code landed; the stage-5 editor pipeline is the first live instance of the five stages.

## Canonical Flow Shape

Every runtime operation — regardless of transport (HTTP, CLI, event, job) — follows the same five-stage pipeline:

```
  Input at boundary          Validate & translate      Domain operation
┌────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ 1. RECEIVE         │──▶│ 2. PARSE & VALIDATE  │──▶│ 3. EXECUTE           │
│ transport-specific │   │ transport-neutral    │   │ pure domain logic,   │
│ raw bytes/args/    │   │ input type built     │   │ errors as values     │
│ event payload      │   │ here; reject early   │   │                      │
└────────────────────┘   └──────────────────────┘   └──────────┬───────────┘
                                                              │
┌────────────────────────┐   ┌──────────────────────────┐     │
│ 5. DELIVER             │◀──│ 4. PERSIST & PROJECT     │◀────┘
│ translate result to    │   │ infrastructure via       │
│ the transport (status, │   │ interfaces; side effects │
│ format, exit code)     │   │ and events emitted here  │
└────────────────────────┘   └──────────────────────────┘
```

## Stage Responsibilities

| Stage | Owner layer (see [layers.md](layers.md)) | Responsibility |
| --- | --- | --- |
| 1. RECEIVE | Entry Points | Accept the raw transport payload. No interpretation. |
| 2. PARSE & VALIDATE | Entry Points / Application edge | Build a typed, validated, transport-neutral input. All input validation happens here — once, authoritatively. |
| 3. EXECUTE | Domain | Pure computation over validated input. Errors are returned as values, never thrown across the boundary as control flow. |
| 4. PERSIST & PROJECT | Infrastructure (via interfaces) | Durable writes, external calls, event emission. |
| 5. DELIVER | Entry Points | Translate the operation result into the transport's vocabulary. |

The pipeline and stage table are now exercised by the stage-5 editor operation (see the worked example below); the stage-4 demo screen remains the one render-only path with no boundary operation. Later operations (ribbon drag/save/load/export) trace the same stages when they land.

## Worked Example: "Insert a Note" (tap a cell, choose fret 7)

The canonical operation of the editor (№5, №21), traced through the five stages with the files that realize each one ([ADR-0006](../decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md)):

| Stage | What happens | Files (verified) |
| ----- | ------------ | ---------------- |
| 1. RECEIVE | The tap lands on the canvas; `Gesture.Tap()` in `NotebookCanvas` receives the raw touch — a point in screen space, no interpretation; the worklet forwards the point to JS via `runOnJS`. | `src/infrastructure/rendering/NotebookCanvas.tsx` (Infrastructure host of the gesture surface the Entry screen consumes) |
| 2. PARSE & VALIDATE | `hitTestPlan` resolves the point against the plan's `hitZones` to a selection target — a cell (`lineId`, `columnId`, `stringIndex`), a column, or `null`; rendering's `SelectionTarget` maps onto the application `Selection`. `EditorScreen` gates on Edit mode (№40) and the user's fret choice arrives from the bottom panel (digits 0–24 only, №3, №21); the intent is a typed `EditorIntent`. | `src/infrastructure/rendering/hit-test.ts`, `plan.ts` (zones); `components/editor/EditorScreen.tsx` (mode gate, intent build) |
| 3. EXECUTE | `applyIntent` calls the pure model operation `insertNote` — a fresh note id, `duration` defaults to quarter (№4); on refusal (`ModelResult` err) the notebook, history, and pocket are untouched and an `EditorWarning` value is returned; on success the pre-mutation snapshot is pushed onto the undo history (≤ 3, №25) and the redo branch is cleared (№37). Pure computation, errors as values. | `src/application/editing/controller.ts`, `history.ts`; `src/domain/tabulature/model.ts` |
| 4. PERSIST & PROJECT | The controller returns the effect `{ kind: 'write-pocket', notebook }`; the Entry level executes it through its `PocketWriter`. Stage 5 ships a no-op writer (the pocket file write is stage 7); no `tet-<id>.json` write occurs — the permanent file is touched only by «Сохранить» (№26). | `components/editor/EditorScreen.tsx` (pocket effect execution); `src/application/editing/types.ts` (`PocketWriter`) |
| 5. DELIVER | The new `EditorState` flows back through `useReducer` → re-render: `NotebookCanvas` rebuilds layout → plan → picture for the mutated notebook, the selection/panel update, and a refusal surfaces as a warning strip mapped through the dictionary (№31). | `components/editor/EditorScreen.tsx` (state rendering, warning); `src/infrastructure/rendering/NotebookCanvas.tsx` (redraw) |

The example demonstrates each invariant below: validation happens once at stage 2 (the hit-test and the panel's digit range); the domain never sees a touch event; the pocket write (side effect) waits for stage 4; storage types never reach the render path.


## Invariants

- Every runtime operation follows the five stages in order.
- Input validation always happens exactly once, at stage 2, before any domain logic runs.
- Domain logic always receives validated, transport-neutral types.
- Internal/persistence types always stay inside stage 4; they never appear in inputs at stage 1 or outputs at stage 5.
- Domain errors always cross boundaries as values, and each boundary maps them to its own error vocabulary at stage 5.
- Side effects (persistence, external calls, event emission) always occur at stage 4 or later, never during stages 1–3.

## Anti-Patterns

- **Validating in the domain** — duplicating checks inside stage 3 means the authoritative validation is ambiguous and they will drift.
- **Leaking storage types to the boundary** — a raw ORM entity or DB row in an HTTP response makes schema and API coupling total.
- **Throwing across the pipeline** — exceptions as inter-layer control flow hide the failure paths from the type system and from readers.
- **Side effects during validation** — a stage-2 step that writes or calls out makes "validate" untestable and non-idempotent.
- **Per-transport pipelines** — each transport reinventing stages 2–5 breeds subtly different validation and delivery rules.

## Related Specs

- [Layers](layers.md) — which layer owns each stage.
- [META.md](../META.md) — document format and update rules.
