# Layers and Dependency Rules

> **Scaffold landed.** The repository now contains the first code (roadmap stage 1: Expo scaffold + the `src/` layer skeleton, see [ADR-0003](../decisions/0003-src-layer-directories.md)). The layer model below is realized by the directories listed in Domain Mapping; layer rules R1–R6 are audited against that code (see the audit note under Dependency Rules). Remaining `TODO: verify` markers in this tree refer to features not yet implemented.

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
| Infrastructure | `src/infrastructure/` | [storage](../domains/storage/README.md) (JSON files, pocket, AsyncStorage); [rendering](../domains/rendering/README.md) (Skia canvas adapter, HTML→PDF export) | expo-file-system, AsyncStorage, expo-print / expo-sharing — all I/O and delivery |
| Spec / Docs / Tooling | this tree (`docs/specs/`) | — | Governance only; never imported by runtime code (R5) |

Current code state: the shipped modules are the root entry files, the i18n dictionary (`src/i18n/`), and — since roadmap stage 2 — the tabulature notebook model in `src/domain/tabulature/` (entities, mutations, fixtures, unit tests, №34). Layout-engine, editing, storage, and rendering code is pending their roadmap stages (3–8).


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

**R1–R6 audit against the shipped code (roadmap stages 1–2).** Audited against the entire current tree: `index.ts`, `App.tsx`, `src/domain/README.md`, `src/domain/tabulature/{types,ids,model,fixtures}.ts`, `src/domain/tabulature/__tests__/notebook-model.test.ts`, `src/application/README.md`, `src/infrastructure/README.md`, `src/i18n/{index.ts,ru.ts}` and `src/i18n/__tests__/i18n.test.ts` — the complete set of runtime files (other layer directories ship READMEs only).

- **R1 ✓** — `src/domain/tabulature/*` imports only its own module files (`./types`, `./ids`); no I/O, framework, or infrastructure import exists in Domain.
- **R2 ✓** — no Application code exists yet; vacuously satisfied (nothing imports Infrastructure directly).
- **R3 ✓** — no Infrastructure code exists yet; vacuously satisfied.
- **R4 ✓** — `index.ts` imports `expo` and `App` for registration only; `App.tsx` contains no business logic (stub screen reading one dictionary key).
- **R5 ✓** — runtime files import nothing from `docs/specs/`; the tree is documentation only.
- **R6 ✓** — every import in the tree (`expo`, `expo-status-bar`, `react-native`, `./App`, `./src/i18n`, `./ru`, `./types`, `./ids`) is explicit; no ambient access or service-locator lookup exists; the id generator is passed explicitly into every factory and mutation (no default generator exists).

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
