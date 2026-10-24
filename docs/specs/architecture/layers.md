# Layers and Dependency Rules

> **Layers landed (roadmap stages 1–4).** The repository contains real code: the Expo scaffold + `src/` layer skeleton (stage 1, [ADR-0003](../decisions/0003-src-layer-directories.md)), the tabulature notebook model (stage 2), the layout-engine kernel (stage 3, [ADR-0004](../decisions/0004-layout-character-units-and-wrap-policy.md)), and the screen renderer — draw plan + Skia executor (stage 4, [ADR-0005](../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md)). The layer model below is realized by the directories listed in Domain Mapping; layer rules R1–R6 are audited against that code (see the audit note under Dependency Rules). Remaining `TODO: verify` markers in this tree refer to features not yet implemented (stages 5–8).

## Context

Layer discipline keeps a codebase of any size changeable: it defines which parts may depend on which, so that core logic stays isolated from I/O, delivery mechanisms, and tooling. This document fixed the rules before the first code landed; the code now exists (Expo scaffold, [ADR-0003](../decisions/0003-src-layer-directories.md)), so the rules are stated as a description of the live `src/` tree, not a forward-looking wish.

## Layer Model

The canonical layer model below is technology-neutral. Concrete directories are fixed by [ADR-0003](../decisions/0003-src-layer-directories.md) and are listed in the Domain Mapping table.

```
┌─────────────────────────────────────────────┐
│                 Entry Points                │  executables, CLIs, HTTP servers,
│             (delivery mechanisms)           │  job runners — process boundaries
├─────────────────────────────────────────────┤
│                 Application                 │  use cases, orchestration of domain
│                                             │  operations, transaction boundaries
├─────────────────────────────────────────────┤
│                   Domain                    │  core concepts and rules; pure
│                                             │  logic, no I/O, no framework types
├─────────────────────────────────────────────┤
│                Infrastructure               │  persistence, external services,
│                                             │  file system, network, clock
├─────────────────────────────────────────────┤
│              Spec / Docs / Tooling          │  docs/specs/, build tooling,
│                                             │  linters — outside the runtime
└─────────────────────────────────────────────┘
```

## Domain Mapping

The six specified domains map onto the canonical layers as follows. Since [ADR-0003](../decisions/0003-src-layer-directories.md), the mapping names **code directories** where they exist; cells whose code has not landed yet name only the domain spec (marked "code pending").

| Canonical layer | Code directory | Domain spec(s) | Responsibilities in TuneDraft |
| --------------- | -------------- | -------------- | ---------------------------- |
| Entry Points | repo root (`index.ts`, `App.tsx`) + `src/i18n/` (string dictionary) | [app-shell](../domains/app-shell.md) (entirely); [editing](../domains/editing/README.md) (gesture & menu UI glue) | Library/Editor screens, toolbar, mode switch, Android Back contract, bottom input panels |
| Application | `src/application/` | [editing](../domains/editing/README.md) (mutation orchestration, undo/redo history) | Turns validated user intent into model mutations; owns the ≤ 3-step history (№25) |
| Domain | `src/domain/` | [tabulature](../domains/tabulature/README.md) (notebook model); [layout-engine](../domains/layout-engine.md) (geometry) | Pure TS: notebook entities and rules; deterministic `(model, width) → coordinates` pass (№14) |
| Infrastructure | `src/infrastructure/` | [storage](../domains/storage/README.md) (JSON files, pocket, AsyncStorage); [rendering](../domains/rendering/README.md) (draw plan + Skia screen renderer, [ADR-0005](../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md); HTML→PDF export pending stage 8) | expo-file-system, AsyncStorage, `@shopify/react-native-skia` — all I/O and delivery |
| Spec / Docs / Tooling | this tree (`docs/specs/`) | — | Governance only; never imported by runtime code (R5) |

Current code state: the shipped modules are the root entry files (`App.tsx` wires the demo notebook into the screen renderer, [ADR-0005](../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md)), the i18n dictionary (`src/i18n/`), the tabulature notebook model (stage 2: `src/domain/tabulature/` — entities, mutations, fixtures, unit tests, №34), the layout engine (stage 3: `src/domain/layout-engine/` — `config.ts`, `types.ts`, `measure.ts`, `wrap.ts`, `emit.ts`, `index.ts`, `fixtures.ts`, unit and acceptance tests, [ADR-0004](../decisions/0004-layout-character-units-and-wrap-policy.md)), and the screen renderer (stage 4: `src/infrastructure/rendering/` — `plan.ts`, `skia.ts`, `NotebookCanvas.tsx`, `theme.ts`, `__tests__/plan.test.ts`). Editing and storage code is pending their roadmap stages (5–7); the HTML→PDF pipeline is stage 8.


## Dependency Rules

Dependencies point **downward only**. A layer may import from layers below it in the diagram, never above, never sideways between the listed groups except as noted.

| Rule | Statement (affirmative) |
| --- | --- |
| R1 | Domain code imports only standard-library or pure utility code. Domain code is free of I/O, framework, and infrastructure imports. |
| R2 | Application code imports Domain and, through interfaces it defines, receives Infrastructure capabilities. |
| R3 | Infrastructure code implements interfaces defined in Domain or Application (dependency inversion at this boundary). |
| R4 | Entry points import Application and Infrastructure for wiring only; entry-point files contain no business logic. |
| R5 | The `docs/specs/` tree is documentation; runtime code never imports or reads it at build time. |
| R6 | Every dependency between two named modules is declared explicitly (no implicit ambient access, no service-locator lookup). |

**R1–R6 audit against the shipped code (roadmap stages 1–4).** Audited against the entire current tree: `index.ts`, `App.tsx`, `src/domain/README.md`, `src/domain/tabulature/{types,ids,model,fixtures}.ts`, `src/domain/tabulature/__tests__/notebook-model.test.ts`, `src/domain/layout-engine/{config,types,measure,wrap,emit,index,fixtures}.ts`, `src/domain/layout-engine/__tests__/{measure,wrap,emit,layout-engine}.test.ts`, `src/application/README.md`, `src/infrastructure/README.md`, `src/infrastructure/rendering/{plan,skia,theme}.ts`, `src/infrastructure/rendering/NotebookCanvas.tsx`, `src/infrastructure/rendering/__tests__/plan.test.ts`, `src/i18n/{index.ts,ru.ts}` and `src/i18n/__tests__/i18n.test.ts` — the complete set of runtime files (the only layer directory still shipping a README alone is `src/application/`).

- **R1 ✓** — `src/domain/tabulature/*` imports only its own module files (`./types`, `./ids`, `./model`); `src/domain/layout-engine/*` imports only its own modules (`./config`, `./measure`, `./wrap`, `./emit`, `./types`) and the model's vocabulary (`../tabulature/types` — type-only imports of `EntityId`, `Column`; `../tabulature/ids` and `../tabulature/model` — fixture assembly only); no I/O, framework, or infrastructure import exists in Domain.
- **R2 ✓** — no Application code exists yet; vacuously satisfied (nothing imports Infrastructure directly).
- **R3 ✓** — `src/infrastructure/rendering/*` depends downward only: `plan.ts` imports the layout engine's vocabulary (`../../domain/layout-engine` — `TEXT_ROW_SPACING_CHARS` and type-only `LaidOutSystem`, `NotebookLayout`, `TabLineLayout`) and the model's vocabulary (`../../domain/tabulature/types` — type-only `Column`, `EntityId`, `Notebook`, `TabLine`); `NotebookCanvas.tsx` calls `layoutNotebook` and reads `Notebook` types. Framework knowledge (Skia, RN `TextStyle`) stays inside rendering; the one cross-layer seam — proportional text measurement — crosses through the `TextLineMeasurer` interface defined by the consuming plan, with the Skia implementation injected from `skia.ts` and a deterministic fake in tests (dependency inversion per R3).
- **R4 ✓** — `index.ts` imports `expo` and `App` for registration only; `App.tsx` contains no business logic: it holds the demo notebook fixture (a model constant), reads `useWindowDimensions().width`, and delegates everything else to `NotebookCanvas`.
- **R5 ✓** — runtime files import nothing from `docs/specs/`; the tree is documentation only.
- **R6 ✓** — every import in the tree (`expo`, `expo-status-bar`, `react-native`, `@shopify/react-native-skia`, `./App`, `./src/...` module paths, `../tabulature/*`, `../layout-engine`, `./plan`, `./skia`, `./theme`, `react` hooks) is explicit; no ambient access or service-locator lookup exists; the id generator is passed explicitly into every model factory and mutation, and the text measurer is passed explicitly into `buildNotebookDrawPlan` (no default measurer exists).

Re-run this audit whenever a new module lands inside `src/` and update the bullet list here.

## Invariants

- The dependency graph over runtime code is always acyclic.
- Domain code always compiles without infrastructure or framework dependencies.
- Infrastructure capabilities always reach Application code through interfaces defined on the consuming side.
- Entry points always stay free of business logic.
- Every rule in this document corresponds to a checkable import pattern (R1 and the R2/R4
  counterparts are enforced by ESLint `no-restricted-imports` guards in `eslint.config.mjs`;
  R5 and R6 are enforced by review and the audit note above).

## Anti-Patterns

- **Domain reaching up** — importing an HTTP framework, ORM, or CLI library from domain code couples core rules to delivery and makes them untestable in isolation.
- **Sideways imports between infrastructure providers** — two persistence/network helpers importing each other creates hidden coupling; compose them at the Application layer instead.
- **Business logic in entry points** — logic that lives in `main`/handler glue is logic that cannot be reused by a second entry point.
- **Ambient global access** — global singletons reachable from any layer void R6 and make the dependency graph a lie.
- **Retro-fitting layers onto existing code** — adopting these rules only after accidental dependencies form is exactly the cost this document exists to avoid.

## Related Specs

- [Data Flow](data-flow.md) — how data moves across the layers defined here.
- [META.md](../META.md) — document format and update rules.
