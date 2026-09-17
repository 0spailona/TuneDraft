# Contract: [Layer A] <-> [Layer B]

> Template. Copy to `contracts/<layer-a>-<layer-b>.md`, fill in every section, delete this banner, and update [INDEX.md](../INDEX.md). A contract documents one boundary between two layers/modules. It is created only when a real boundary exists in code — TuneDraft has none yet (see [ADR-0001](../decisions/0001-bootstrap-spec-system-before-code.md)).

## Boundary Rule

[One sentence: direction of dependency and what is NOT allowed.]

## Interfaces

| Interface | Package | Consumed By | Purpose |
| --------- | ------- | ----------- | ------- |
| [name]    | [package] | [consumer layer] | [what it provides] |

## Initialization

[How components on both sides are wired together at startup. Name the composition root / entry point file.]

## Data Flow Across Boundary

[What data crosses the boundary, in what form, in which direction. Distinguish transport-neutral types (crossing) from internal types (never crossing) — see `../architecture/data-flow.md`.]

## Error Propagation

[Rules for wrapping/transforming errors at this boundary. Which error vocabulary enters, which leaves, what is never leaked.]

## Breaking Change Checklist

If you change X, you MUST also update Y:

- [ ] [interface signature] → [all consumers listed above] + [this contract] + [INDEX.md if renamed]
- [ ] [wire/data format] → [the other side's parser] + [this contract]
- [ ] [initialization order] → [composition root] + [this contract]

## Related Specs

- [layers.md](../architecture/layers.md) — dependency direction rules this boundary obeys.
- [data-flow.md](../architecture/data-flow.md) — the five-stage pipeline this boundary participates in.
