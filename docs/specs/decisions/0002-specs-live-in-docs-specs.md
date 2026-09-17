# ADR-0002: Specs live at docs/specs/

## Status

Accepted

## Context

The spec system needs a home in the repository. The default convention of the initialization procedure is `specs/` at the repository root; a nested location under a `docs/` tree was offered as an alternative. The project owner chose the nested location.

## Decision

All specification documents live under `docs/specs/`, with cross-references relative to `docs/specs/` (rules in [META.md](../META.md)). The structure is:

```
docs/specs/
├── META.md, INDEX.md, WORKFLOW.md
├── architecture/
├── domains/
├── contracts/
└── decisions/
```

## Consequences

**Positive**

- The repository root stays minimal — the spec system reads as part of the project's documentation, not as a peer of future source trees.
- All agent-facing documentation can later converge under one `docs/` prefix.

**Negative**

- Deviates from the skill's `specs/`-at-root default: agents habituated to that convention must be pointed to `docs/specs/` explicitly (handled by the pointer added to `README.md` and by [INDEX.md](../INDEX.md) as the navigation entry).
- One extra path segment in every relative cross-reference.

## Alternatives Considered

- **`specs/` at repository root** — the default; rejected by the owner in favor of keeping the root minimal.
- **`docs/` flattening (specs as `docs/*.md` without a `specs/` subtree)** — rejected: the system has enough file kinds (architecture, domains, contracts, decisions) that a subtree is warranted.
