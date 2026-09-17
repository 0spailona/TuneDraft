# Rendering

> **Bootstrap spec.** This document is written before any source code exists (see [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)). Every claim about future code carries a `<!-- TODO: verify -->` marker per the bootstrap protocol. Decision numbers `(№NN)` refer to the decisions table in `docs/КАРТА-ПРОЕКТА.md`.

## Purpose

Turns the geometry produced by the layout engine into visible output through two renderers: a Skia renderer draws the interactive screen, and an HTML→PDF pipeline (`expo-print` + `expo-sharing`) produces the exported document (№14). Rendering owns drawing only — it computes no geometry of its own.

## Key Files

None yet — the repository contains no source code. <!-- TODO: verify when renderer code lands -->

## Core Types

None yet — this domain owns no data model; it consumes the layout engine's output, which is specified by the layout domain (№14). <!-- TODO: verify when renderer code lands -->

## Flow

```
              notebook model (tab rows + text rows)
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │   layout engine (pure JS) (№14)     │
            │   computes geometry per target      │
            │   width — never inside a renderer   │
            └───────┬───────────┬────────────┬────┘
                    │           │            │
        screen width│    A4 print width      │preview width
                    ▼           ▼            ▼
          ┌───────────────┐ ┌──────────┐ ┌────────────────┐
          │ Skia renderer │ │ HTML→PDF │ │ preview render │
          │ <Canvas>:     │ │ A4       │ │ first system   │
          │ string lines, │ │ portrait │ │ → tet-<id>.png │
          │ fret digits,  │ │ (№7,№33) │ │ cached next to │
          │ bar lines,    │ │          │ │ tet-<id>.json  │
          │ texts; draws  │ │ see      │ │ (№30)          │
          │ only the      │ │ pdf-     │ │                │
          │ window (№28)  │ │ export   │ │                │
          └───────────────┘ └──────────┘ └────────────────┘
```

Screen happy path:

1. The editor hosts a Skia `<Canvas>`; the renderer draws string lines, fret digits, bar lines, and column texts for the virtualization window — visible rows plus a reserve margin, never the whole document (№28). The bass-clef glyph doubles as the tab-row drag handle on screen (№36).
2. On rotation the shell re-runs layout for the new screen width and the renderer redraws (№23).

Export happy path (detail: [pdf-export.md](pdf-export.md)):

1. The user taps «Экспорт PDF» in the editor toolbar.
2. Rendering requests layout at the fixed A4 print width — independent of the current screen orientation (№23).
3. The HTML→PDF pipeline paginates by row boundaries and hands the document to the OS (№7, №8).

Preview happy path:

1. The user taps «Сохранить» (storage domain writes `tet-<id>.json`).
2. Rendering regenerates the preview — the first system (the tab row up to its first line break) — and caches it as `tet-<id>.png` next to the JSON file, where the library card picks it up (№30).

The pipelines above are unimplemented: no renderer, export command, or preview generation exists yet. <!-- TODO: verify when first rendering code lands -->

## Invariants

- Both renderers always consume the output of the single layout engine; rendering code always stays free of geometry computation (№14).
- The screen renderer always draws only the virtualization window — visible rows plus a reserve margin — rather than the whole document (№28).
- Fret digits are always drawn in a monospace font (№32).
- The exported document is always A4 portrait (№7, №33).
- A page break always falls on a row boundary; a row always appears whole on one page (№7).
- An overlong tab system is always resolved by wrapping the system, never by rotating the page to landscape (№7).
- Every PDF page always carries the notebook title in the top-right corner and the page number bottom-center, both in small type (№33).
- The preview always shows the first system of the notebook and is always regenerated when the user taps «Сохранить», caching to `tet-<id>.png` (№30).
- PDF and preview geometry is always computed at its own target width, never inherited from the current screen orientation (№23).

## Configuration

None exists yet. <!-- TODO: verify when configuration is introduced -->

Intended parameters, from decisions:

| Parameter | Intended value | Source |
| --- | --- | --- |
| PDF page format | A4 portrait (210 × 297 mm), fixed | №7, №33 |
| PDF header/footer type size | small (exact size chosen at implementation) | №33 |
| Preview cache file | `tet-<id>.png` beside `tet-<id>.json` | №30 |
| Screen render window | visible rows ± reserve margin | №28 |

## Extension Points

- A third renderer (for example a full-page image or a print theme) plugs in by consuming the same layout output; adding a renderer never duplicates geometry logic (№14).
- Preview size options (large / small / none) extend the preview cache without touching the layout engine (№30).
- «Share PDF» from a library card reuses the same PDF pipeline after MVP (№30).
- Font and color themes for headings and texts arrive after MVP; the MVP ships exactly one built-in theme (№32).

## Related Specs

- [pdf-export.md](pdf-export.md) — detail spec for the HTML→PDF export pipeline (page format, pagination, page chrome).
- [Layers](../../architecture/layers.md) — the layout engine stays pure Domain logic; renderers act as delivery/infrastructure adapters and never feed geometry back upstream.
- [Data Flow](../../architecture/data-flow.md) — the five-stage pipeline every export and save-triggered preview pass follows.
- [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md) — the bootstrap/TODO-marker protocol this spec follows.
- [App Shell](../app-shell.md) — hosts the Skia Canvas and the toolbar actions («Сохранить», «Экспорт PDF»).
- [Storage: Library](../storage/library.md) — the library card that consumes the cached `tet-<id>.png` preview.
- [Tabulature](../tabulature/README.md) — the notebook model every rendering pipeline starts from.
- `domains/layout-engine.md` — the upstream geometry provider (path fixed by the formalization plan; created by its step 2, which may still be in flight).
