# PDF Export

> **Bootstrap spec.** This document is written before any source code exists (see [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)). Every claim about future code carries a `<!-- TODO: verify -->` marker. Decision numbers `(№NN)` refer to the decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Role

Produces the exported PDF document from layout output through the HTML→PDF pipeline (`expo-print` + `expo-sharing`): A4 portrait pages, notebook title top-right, page number bottom-center (№7, №8, №14, №33).

## Key Files

None yet — this domain's code is not implemented yet (the stage-1 scaffold, [ADR-0003](../../decisions/0003-src-layer-directories.md), ships only the layer skeleton and i18n). <!-- TODO: verify when export code lands -->

## Behavior

### Pipeline

```
«Экспорт PDF» tapped (editor toolbar, №37)
        │
        ▼
[1] request layout at A4 print width (independent of screen orientation, №23)
        │
        ▼
[2] build HTML document from layout output
    (string lines, fret digits, bar lines, column texts — geometry from layout engine only)
        │
        ▼
[3] paginate by row boundaries; stamp page chrome on every page (№7, №33)
        │
        ▼
[4] expo-print renders HTML → PDF
        │
        ▼
[5] expo-sharing hands the PDF to the OS share sheet
        │
        ▼
user saves / sends the PDF
```

The pipeline above is unimplemented. <!-- TODO: verify when export code lands -->

### Page geometry and pagination rules

| Rule | Value | Source |
| --- | --- | --- |
| Page format | A4 portrait (210 × 297 mm) | №7, №33 |
| Page break position | only at a row boundary; a row always appears whole on one page | №7 |
| Page chrome — title | notebook title, top-right corner, small type, on every page | №33 |
| Page chrome — page number | bottom-center, small type, on every page | №33 |
| Overlong system resolution | wrap the system to the next page by re-running layout, never rotate to landscape | №7 |

Pagination example — a row taller than the space left on the current page moves to the next page as a whole unit; trailing empty space on the earlier page is accepted:

```
page N                          page N+1
┌─────────────────────┐         ┌─────────────────────┐
│ title           (1/2)│   ──▶  │ title           (2/2)│
│ …row 5 (whole)     │         │ row 6 (whole)      │
│                    │         │                     │
│   [free space]     │         │                     │
└─────────────────────┘         └─────────────────────┘
```

### Page chrome layout

```
┌─────────────────────────────────┐
│                      title    ▲ │  ▲ small type, top-right (№33)
│  content area                   │
│  …                              │
│                                 │
│              3                  │  ▼ small type, bottom-center (№33)
└─────────────────────────────────┘
```

## Error Handling

No export implementation exists; the intended handling follows the platform pipeline (stages per [data-flow.md](../../architecture/data-flow.md) — export is an operation with I/O side effects):

- The export operation always reports the failure to the user through the shell UI instead of silently swallowing it; the editor stays usable after a failed export. <!-- TODO: verify when export code lands -->
- Pagination and geometry failures are always prevented upstream by the layout engine's own validation; the renderer treats layout output as trusted input and always maps an unexpected shape to a visible error rather than to a malformed document. <!-- TODO: verify when export code lands -->

## Invariants

- The export pipeline always requests layout at the fixed A4 print width, independent of the current screen orientation (№23).
- A page break always falls on a row boundary; a row always appears whole on one page (№7).
- Every PDF page always carries the notebook title top-right and the page number bottom-center, both small type (№33).
- The exported document is always A4 portrait; overlong systems are always resolved by wrapping, never by rotating the page (№7).
- The export format is always PDF — no other export format ships in MVP (№8).
- The pipeline always uses `expo-print` to render and `expo-sharing` to deliver (№14).
- The export command always originates from the editor toolbar (№37); «share PDF» from a library card arrives after MVP (№30).

## Related Specs

- [Rendering README](README.md) — the domain overview: shared pipeline from layout output, screen renderer, preview.
- [Layers](../../architecture/layers.md) — export is delivery/infrastructure: it consumes layout output and never computes geometry.
- [Data Flow](../../architecture/data-flow.md) — the five-stage pipeline the export operation follows.
- [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md) — the bootstrap/TODO-marker protocol this spec follows.
- [App Shell](../app-shell.md) — the toolbar action that starts the pipeline.
- `domains/layout-engine.md` — the geometry input (path fixed by the formalization plan; created by its step 2, which may still be in flight).
