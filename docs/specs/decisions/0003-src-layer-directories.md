# ADR-0003: Source code lives in layer directories under `src/`

## Status

Accepted

## Context

The first code in the repository (roadmap stage 1: Expo scaffold + toolchain) needed a home. [layers.md](../architecture/layers.md) fixes a canonical four-layer model (Entry Points, Application, Domain, Infrastructure) at **spec level** — it names which domain's responsibilities fall into which layer but, by its own TODO marker, defers concrete directory names until code lands. An Expo template by default keeps everything flat at the repository root (`App.tsx`, `index.ts`), which would let accidental cross-layer imports form before any rule pins the layout.

## Decision

All source code lives under `src/`, with one directory per canonical layer plus the string dictionary:

```
src/
├── domain/           pure core: tabulature model, layout-engine geometry (R1)
├── application/      use cases: editing orchestration, undo/redo history (R2)
├── infrastructure/   I/O adapters: storage files, AsyncStorage, Skia, PDF (R3)
└── i18n/             interface string dictionary t(key) — №31
```

Entry Points stay at the repository root as the Expo convention requires: `index.ts` (component registration) and `App.tsx` (root component). Each `src/<layer>/` directory carries a `README.md` restating the layer rules (R1–R6) that apply inside it, so the import discipline is discoverable from the code side too. `src/i18n/` is deliberately not a fifth layer: it is a pure utility without I/O that the app-shell domain owns conceptually (Entry Points vocabulary, №31) and that every layer may import.

The dependency rules of [layers.md](../architecture/layers.md) apply to these directories unchanged: `domain` imports nothing from the project (only stdlib/pure utilities); `application` imports `domain`; `infrastructure` implements interfaces declared by consumers; root entry files import for wiring only.

## Consequences

**Positive**

- The layer model becomes checkable by directory: an import crossing layers upward is visible as a path (`src/domain/...` importing `src/infrastructure/...` is a red flag in review).
- Layer READMEs give every future file a written contract next to where it lands; specs and code state the same rules.
- The Expo root stays minimal: only the two registration files the toolchain requires.

**Negative**

- Two entry files remain outside `src/` — the Entry Points "directory" is the root itself, a small asymmetry to remember during audits.
- Domain detail files (tabulature, layout-engine) do not get subdirectories until their code lands; the mapping from domain specs to layer directories must be maintained in layers.md.

## Alternatives Considered

- **Flat root layout (Expo template default)** — rejected: no structural signal about layers; rules would live only in the spec and be invisible in the file tree.
- **`src/` organized by domain (tabulature/, editing/, storage/, …) instead of by layer** — rejected: the dependency rules R1–R6 are stated over layers, not domains; a domain layout would require re-deriving the rules per folder and would mix pure logic with I/O inside one tree.
- **`src/entry/` directory for entry points** — rejected: Expo requires `App.tsx`/`index.ts` at the project root (the `main` field of `package.json` points there); moving them fights the toolchain for no rule benefit, since R4 is enforceable by review of two files.
