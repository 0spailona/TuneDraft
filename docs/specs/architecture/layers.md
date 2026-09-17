# Layers and Dependency Rules

> **Bootstrap placeholder.** This spec is written before any source code exists. It defines the dependency discipline the future code MUST follow, not a description of existing code. Resolve every `TODO: verify` marker when the relevant code lands (see [WORKFLOW.md](../WORKFLOW.md) §6).

## Context

Layer discipline keeps a codebase of any size changeable: it defines which parts may depend on which, so that core logic stays isolated from I/O, delivery mechanisms, and tooling. TuneDraft has no code yet, so this document fixes the rules **now**, while they cost nothing to adopt, rather than reconstructing them later from accreted imports.

## Layer Model

The canonical layer model below is technology-neutral. Map concrete directories/packages onto it when the first code lands.

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

The six specified domains map onto the canonical layers as follows. The mapping is at **spec level** — it names which domain's responsibilities fall into which layer; concrete packages/files are named inside each domain spec when its code lands.

| Canonical layer | Domain spec(s) | Responsibilities in TuneDraft |
| --------------- | -------------- | ---------------------------- |
| Entry Points | [app-shell](../domains/app-shell.md) (entirely); [editing](../domains/editing/README.md) (gesture & menu UI glue) | Library/Editor screens, toolbar, mode switch, Android Back contract, bottom input panels |
| Application | [editing](../domains/editing/README.md) (mutation orchestration, undo/redo history) | Turns validated user intent into model mutations; owns the ≤ 3-step history (№25) |
| Domain | [tabulature](../domains/tabulature/README.md) (notebook model); [layout-engine](../domains/layout-engine.md) (geometry) | Pure TS: notebook entities and rules; deterministic `(model, width) → coordinates` pass (№14) |
| Infrastructure | [storage](../domains/storage/README.md) (JSON files, pocket, AsyncStorage); [rendering](../domains/rendering/README.md) (Skia canvas adapter, HTML→PDF export) | expo-file-system, AsyncStorage, expo-print / expo-sharing — all I/O and delivery |
| Spec / Docs / Tooling | this tree (`docs/specs/`) | Governance only; never imported by runtime code (R5) |

`TODO: verify` — this table maps specs, not code; when the first packages land, extend it with the concrete directory names per layer.


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

`TODO: verify` — rules R1–R6 are unexercised: no code exists to check them against. On first code, audit imports against this table and update it to name the actual packages.

## Invariants

- The dependency graph over runtime code is always acyclic.
- Domain code always compiles without infrastructure or framework dependencies.
- Infrastructure capabilities always reach Application code through interfaces defined on the consuming side.
- Entry points always stay free of business logic.
- Every rule in this document corresponds to a checkable import pattern (enforced by review, or by a lint/tool once one is adopted).

## Anti-Patterns

- **Domain reaching up** — importing an HTTP framework, ORM, or CLI library from domain code couples core rules to delivery and makes them untestable in isolation.
- **Sideways imports between infrastructure providers** — two persistence/network helpers importing each other creates hidden coupling; compose them at the Application layer instead.
- **Business logic in entry points** — logic that lives in `main`/handler glue is logic that cannot be reused by a second entry point.
- **Ambient global access** — global singletons reachable from any layer void R6 and make the dependency graph a lie.
- **Retro-fitting layers onto existing code** — adopting these rules only after accidental dependencies form is exactly the cost this document exists to avoid.

## Related Specs

- [Data Flow](data-flow.md) — how data moves across the layers defined here.
- [META.md](../META.md) — document format and update rules.
