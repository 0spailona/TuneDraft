# ADR-0001: Bootstrap the spec system before any code exists

## Status

Accepted

## Context

The TuneDraft repository contains no source code — only a `README.md` ("My note book") with a single initial commit. The spec-system initialization procedure (vibespec-init) normally derives specs from an existing codebase; that input does not exist. The project owner was offered the options of aborting until code exists, generating a lean skeleton, or generating a full speculative spec set; the owner chose the full speculative set with specs kept neutral (project intent deliberately undecided), accepting `TODO: verify` markers on every code-dependent claim.

## Decision

1. Generate the full spec set now — governance files (META.md, WORKFLOW.md, INDEX.md), architecture specs, a placeholder domain spec, a contract template, and initial ADRs — at `docs/specs/` (per [ADR-0002](0002-specs-live-in-docs-specs.md)).
2. All specs are technology- and intent-neutral: they define dependency discipline ([layers.md](../architecture/layers.md)) and the operation pipeline ([data-flow.md](../architecture/data-flow.md)) as forward-looking MUST rules, not as descriptions of existing code.
3. Every code-dependent claim carries a `<!-- TODO: verify -->` marker. A marker means "claim against code that does not exist yet" and MUST be resolved (verified, corrected, or deleted) in the same change that introduces the relevant code. This rule is codified in [META.md](../META.md) and enforced by the [WORKFLOW.md](../WORKFLOW.md) validation checklist.
4. `domains/placeholder-domain/` demonstrates the Domain README format and is deleted no later than the creation of the first real domain spec.

## Consequences

**Positive**

- The dependency and data-flow rules are fixed while adopting them costs nothing; the first code lands into an existing discipline instead of having one retro-fitted.
- Agents working on the first code get deterministic context (templates, update protocol, navigation) from day one.
- The TODO-marker protocol makes every unverified claim explicit and greppable, so nothing masquerades as verified fact.

**Negative**

- Specs may describe a design the project never adopts (project intent is undecided); the transition workflow in [WORKFLOW.md](../WORKFLOW.md) §6 mitigates this by revising specs before coding when a chosen design invalidates a rule.
- Maintaining TODO markers adds a small ongoing obligation until the codebase materializes.
- Some content will be corrected or deleted rather than confirmed when reality arrives.

## Alternatives Considered

- **Abort and re-run vibespec-init once code exists** — rejected by the owner: the spec system was wanted now, and waiting forfeits the cheap moment to fix architectural rules.
- **Lean skeleton only (governance files + one placeholder)** — rejected by the owner: a fuller set was preferred so the architecture rules are on record before the first design decision.
- **Speculative specs without TODO markers** — rejected: unmarked speculation would be indistinguishable from verified fact, violating the system's core principle that specs are the source of truth.
