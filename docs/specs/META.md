# Specification System

This document defines the format, rules, and procedures for creating and maintaining project specifications. It is the source of truth for how specs are structured.

## Purpose

Specifications provide AI coding agents with deterministic context about system behavior, interfaces, and architectural decisions. They enable agents to make safe, informed changes without extensive codebase exploration.

## Current Project State

TuneDraft has passed the bootstrap threshold: **roadmap stages 1–2 are complete** — the repository contains the Expo scaffold and the `src/` layer skeleton (see [ADR-0003](decisions/0003-src-layer-directories.md)) plus the tabulature notebook model in `src/domain/tabulature/` (entities, mutations, fixtures; unit tests per №34). `src/application/` and `src/infrastructure/` still hold layer-rule READMEs only; layout, editing, storage, and rendering remain for stages 3–8.

The spec system itself is complete: the six real domains of the intended system — `tabulature`, `layout-engine`, `editing`, `app-shell`, `storage`, `rendering` — are fully specified (see [INDEX.md](INDEX.md)), derived from the 40 numbered decisions of `docs/КАРТА-ПРОЕКТА.md` (referenced as `(№NN)`). The bootstrap exemplar `domains/placeholder-domain/` was deleted when these domains landed, per its own banner.

The `architecture/` placeholders have transitioned: [layers.md](architecture/layers.md) now maps the canonical layers onto the real `src/` directories and records an R1–R6 audit of the shipped code; [data-flow.md](architecture/data-flow.md) keeps its five-stage contract forward-looking until the first editor operation lands (roadmap stages 4–8).

Implications for all spec authors:

1. Claims about code that does not exist yet still carry a `<!-- TODO: verify -->` marker; claims about shipped code are stated plainly (verified against the tree).
2. When code for a marked feature lands, a `vibespec-create` pass (or manual update) resolves each TODO marker: verify the claim against the code, correct it, or delete the section if it no longer applies.
3. A TODO marker is a **claim against code that does not exist yet**. It is never a permanent state: a marker surviving past the introduction of the relevant code is a defect in the spec system.

## Principles

1. **Self-standing documents** — specs are NOT generated from code. They describe intended behavior; a discrepancy between spec and code indicates a bug (in the code or in the spec — determine by context).
2. **Agent-optimized** — predictable structure, explicit cross-references, no filler prose. Every section has a purpose.
3. **Living documents** — updated after code changes that alter documented behavior. Never silently drifting.
4. **Domain-based** — organized by conceptual domains, NOT by file/directory structure.
5. **Contracts are first-class** — cross-boundary interfaces deserve their own documents.

## File Organization

```
docs/specs/
├── META.md                         this file
├── INDEX.md                        navigation: task -> spec file(s)
├── WORKFLOW.md                     reference guide for spec system usage
│
├── architecture/                   system-level (layers, flows, security)
│   ├── layers.md                   layer/dependency rules, mapped to the six domains
│   └── data-flow.md                request/data lifecycle + worked example (placeholder)
│
├── domains/                        by business domain (NOT file structure)
│   ├── app-shell.md                navigation, modes, toolbar, Back, i18n, theme
│   ├── layout-engine.md            column geometry: model -> coordinates, wrap rules
│   ├── tabulature/                 pure notebook data model
│   │   ├── README.md               domain overview: notebook, lines, columns, notes
│   │   └── notebook-model.md       entity catalog, column states, cascades
│   ├── editing/                    touch input -> model mutations
│   │   ├── README.md               selection, menus, gestures, undo/redo overview
│   │   ├── cell-and-column-menus.md  fret panel, barline, column operations
│   │   └── lines-and-gestures.md   ribbon rows: insert/move/delete, drag handles
│   ├── storage/                    JSON persistence, pocket, library
│   │   ├── README.md               domain overview: files, previews, settings
│   │   ├── pocket.md               single autosave pocket lifecycle
│   │   └── library.md              cards, sorting, corrupted JSON, creation flow
│   └── rendering/                  model geometry -> pixels
│       ├── README.md               Skia screen + HTML->PDF pipelines overview
│       └── pdf-export.md           A4 export: pagination, page chrome, sharing
│
├── contracts/                      interfaces between layers
│   └── _template.md                contract template (no real boundaries yet)
│
└── decisions/                      Architecture Decision Records
    ├── _template.md                ADR template
    ├── 0001-bootstrap-spec-system-before-code.md
    └── 0002-specs-live-in-docs-specs.md
```

When the first real domain is identified: create `domains/<domain>/README.md`, update `INDEX.md`. (The bootstrap exemplar `domains/placeholder-domain/` was deleted when the six real domains landed.) When the first real boundary is identified: create `contracts/<layer-a>-<layer-b>.md` from `contracts/_template.md` and update `INDEX.md`.

## Naming Conventions

- Files: `kebab-case.md`
- Directories within `domains/`: created when a domain requires multiple files
- `README.md` inside a domain directory: overview and entry point for that domain
- `_template.md` prefix: template files (not actual specs)
- ADR files: `NNN-kebab-case-slug.md` (three-digit number, kebab-case slug)

## Document Formats

### Domain README (`domains/*/README.md` or `domains/*.md`)

Required sections in order:

```markdown
# [Domain Name]

## Purpose

1-3 sentences. What this domain does in the system.

## Key Files

- `path/from/repo/root/file.ext` — role description

## Core Types

Key type definitions (code blocks) with brief explanations.

## Flow

ASCII diagram or numbered sequence showing the primary happy path.

## Invariants

Bullet list of properties that ALWAYS hold. Use affirmative phrasing.

## Configuration

Key parameters from configuration with defaults and valid values.

## Extension Points

How to add new behavior without breaking existing functionality.

## Related Specs

- [link](relative/path.md) — context of relationship
```

**Bootstrap rule:** for as long as a domain has no code, its `Key Files` and `Core Types` sections state `None yet` with a TODO marker instead of inventing paths or types. When the domain's code lands, fill these sections with real paths and types and resolve the marker.

### Domain Detail (`domains/*/<name>.md`)

For individual components within a domain:

```markdown
# [Component Name]

## Role

1 sentence: what this component does within its domain.

## Key Files

- `path/to/file.ext` — description

## Behavior

Detailed description. May include:
- State machines (ASCII)
- Decision tables
- Pseudocode
- Sequence diagrams

## Error Handling

How this component handles and propagates errors.

## Invariants

Properties that always hold for this component.

## Related Specs

- [link](relative/path.md) — relationship context
```

### Contract (`contracts/*.md`)

Template file: [`contracts/_template.md`](contracts/_template.md)

```markdown
# Contract: [Layer A] <-> [Layer B]

## Boundary Rule

One sentence: direction of dependency and what is NOT allowed.

## Interfaces

| Interface | Package | Consumed By | Purpose |
| --------- | ------- | ----------- | ------- |

## Initialization

How components are wired together at startup.

## Data Flow Across Boundary

What data crosses the boundary, in what form, in which direction.

## Error Propagation

Rules for wrapping/transforming errors at this boundary.

## Breaking Change Checklist

If you change X, you MUST also update Y.
```

### Architecture (`architecture/*.md`)

```markdown
# [Topic]

## Context

Why this architectural aspect matters.

## [Main Content]

Diagrams, rules, descriptions. Structure varies by topic.

## Invariants

Architectural rules that must never be violated.

## Anti-Patterns

What NOT to do, with brief explanation of why.
```

### ADR (`decisions/NNN-slug.md`)

```markdown
# ADR-NNN: [Title]

## Status

Accepted | Superseded by [NNN](./NNN-slug.md)

## Context

The problem or question that required a decision.

## Decision

What was decided.

## Consequences

Positive and negative impacts on the codebase.

## Alternatives Considered

What was evaluated and why it was rejected.
```

## Cross-References

- Always use relative paths from `docs/specs/` directory
- Format: `[display text](relative/path.md)`
- For intra-file section references: `[display text](relative/path.md#section-name)` (lowercase, hyphens)
- When referencing source code: backtick path from repo root, e.g. `src/core/router.go`

## Update Protocol

### When to update specs

- After any change that alters documented behavior
- After adding/removing/renaming interfaces that appear in a contract
- After changing architectural boundaries or invariants
- After making a new architectural decision (create ADR)
- **Bootstrap-specific:** when code is introduced that a TODO marker refers to, resolve that marker in the same change

### How to update

1. Read the current spec fully before modifying
2. Preserve the document format (sections, ordering) defined in this META.md
3. Update cross-references if file paths changed
4. After adding or removing a spec file, update `INDEX.md`
5. ADRs with `Status: Accepted` are immutable; create a new ADR to supersede

### Validation checklist

- [ ] All sections from the template are present
- [ ] Cross-references point to existing files
- [ ] Code paths in Key Files are accurate
- [ ] Invariants are stated affirmatively
- [ ] INDEX.md reflects the current file set
- [ ] No `TODO: verify` marker refers to code that already exists
