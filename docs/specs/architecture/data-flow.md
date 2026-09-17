# Data Flow

> **Scaffold landed.** The first code exists (roadmap stage 1: Expo scaffold + `src/` layer skeleton, [ADR-0003](../decisions/0003-src-layer-directories.md)), but no five-stage operation is implemented yet: the editor pipeline (stages 1–5 of the worked example) belongs to roadmap stages 4–8. Treat this document as the contract those operations must satisfy; the `TODO: verify` markers below are resolved as the corresponding operations land (see [WORKFLOW.md](../WORKFLOW.md) §6).

## Context

A data-flow contract fixed early prevents the two classic failure modes of young projects: validation scattered across layers (same check in three places, none authoritative) and internal types leaking to boundaries (changing a database row breaks an API response). This document was fixed before the first code landed; the code base now exists (scaffold, [ADR-0003](../decisions/0003-src-layer-directories.md)), and the first editor operations implementing this pipeline arrive with roadmap stages 4–8.

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

`TODO: verify` — the stage table and pipeline are unexercised: the scaffold (ADR-0003) ships no runtime operation yet, so there is nothing to check them against. When the first operation is implemented (roadmap stage 4+), trace it through stages 1–5 and record the concrete file paths at each stage here.

## Worked Example: "Insert a Note" (tap a cell, choose fret 7)

The canonical operation of the editor (№5, №21), traced through the five stages. Domain citations point to the owning domain specs. <!-- TODO: verify — this example describes intended behavior; no code exists yet -->

| Stage | What happens | Owned by |
| ----- | ------------ | -------- |
| 1. RECEIVE | A tap lands on the editor ribbon; the gesture handler delivers the raw touch event. No interpretation — the event is only located in screen space. | [app-shell](../domains/app-shell.md) / editing UI glue (Entry Points) |
| 2. PARSE & VALIDATE | Hit-testing resolves the tap to a cell (`stringIndex`, `columnIndex`). The tap opens the bottom fret panel (№36); the user's choice "fret 7" is validated: Edit mode active (№40), the cell is empty, the column is a content column rather than a barline column (№18, №21), and `fret` is within 0–24 (№3). Output: a typed `insertNote` intent. | [editing](../domains/editing/README.md) (Entry Points / Application edge) |
| 3. EXECUTE | The tabulature model creates a `Note { id: new, stringIndex, fret: 7, duration }` attached to the column (№19, №20); the previous state is pushed onto the undo history (≤ 3, №25); the layout engine recomputes geometry — the column may widen, the system may re-wrap (№14, №20). Pure computation; errors are values. | [tabulature](../domains/tabulature/notebook-model.md) + [layout-engine](../domains/layout-engine.md) (Domain) |
| 4. PERSIST & PROJECT | The mutated draft notebook is serialized into the single autosave pocket — one write per user action (№26). No `tet-<id>.json` write occurs here: the permanent file is touched only by «Сохранить» (№26). | [storage/pocket](../domains/storage/pocket.md) (Infrastructure, via interfaces) |
| 5. DELIVER | The Skia renderer redraws the visible window — visible rows ± margin, not the whole document (№28); the fret panel and selection UI update. | [rendering](../domains/rendering/README.md) + app-shell (Entry Points) |

The example demonstrates each invariant below: validation happens once at stage 2; the domain never sees a touch event; the pocket write (side effect) waits for stage 4; storage types never reach the render path.


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
