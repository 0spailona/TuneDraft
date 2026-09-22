# Spec Index

Navigation for TuneDraft's specification system. Project status: **model landed** — roadmap stages 1–2 are complete: the Expo toolchain, the `src/` layer skeleton ([ADR-0003](decisions/0003-src-layer-directories.md)) and the tabulature notebook model (`src/domain/tabulature/`, unit-tested per №34) exist; layout, editing, storage, and rendering are not implemented yet. Formats and rules: [META.md](META.md). Usage guide: [WORKFLOW.md](WORKFLOW.md). Decision references `(№NN)` point to the numbered decisions table in [КАРТА-ПРОЕКТА.md](../КАРТА-ПРОЕКТА.md).

## Task → Spec

| Task | Read first | Then |
| --- | --- | --- |
| Add code to the `src/` layer skeleton (roadmap stages 2–10; stage 1 is done, see [ADR-0003](decisions/0003-src-layer-directories.md)) | [architecture/layers.md](architecture/layers.md) | [architecture/data-flow.md](architecture/data-flow.md), [WORKFLOW.md](WORKFLOW.md) §6 |
| Implement the notebook data model (roadmap stage 2 — **done**: `src/domain/tabulature/`) | [domains/tabulature/README.md](domains/tabulature/README.md) | [domains/tabulature/notebook-model.md](domains/tabulature/notebook-model.md) |
| Implement the layout engine: geometry, column widths, wrap rules (stage 3) | [domains/layout-engine.md](domains/layout-engine.md) | [domains/tabulature/notebook-model.md](domains/tabulature/notebook-model.md), [domains/rendering/README.md](domains/rendering/README.md) |
| Implement the Skia screen renderer (stage 4) | [domains/rendering/README.md](domains/rendering/README.md) | [domains/layout-engine.md](domains/layout-engine.md), [architecture/layers.md](architecture/layers.md) |
| Implement note input: cell/column menus, fret panel, undo/redo (stage 5) | [domains/editing/README.md](domains/editing/README.md) | [domains/editing/cell-and-column-menus.md](domains/editing/cell-and-column-menus.md), [domains/tabulature/notebook-model.md](domains/tabulature/notebook-model.md) |
| Implement ribbon rows: insertion, drag, delete, scroll window (stage 6) | [domains/editing/lines-and-gestures.md](domains/editing/lines-and-gestures.md) | [domains/editing/README.md](domains/editing/README.md), [domains/rendering/README.md](domains/rendering/README.md) (virtualization №28) |
| Implement save/load, autosave pocket, library screen (stage 7) | [domains/storage/README.md](domains/storage/README.md) | [domains/storage/pocket.md](domains/storage/pocket.md), [domains/storage/library.md](domains/storage/library.md) |
| Implement PDF export (stage 8) | [domains/rendering/pdf-export.md](domains/rendering/pdf-export.md) | [domains/rendering/README.md](domains/rendering/README.md), [domains/layout-engine.md](domains/layout-engine.md) |
| Change navigation, Read/Edit modes, toolbar, or Back behavior | [domains/app-shell.md](domains/app-shell.md) | [architecture/layers.md](architecture/layers.md) |
| Change tab-line wrapping, column widths, or geometry behavior | [domains/layout-engine.md](domains/layout-engine.md) | [domains/rendering/README.md](domains/rendering/README.md), [domains/editing/README.md](domains/editing/README.md) |
| Change what a mutation may do to the model (cascades, limits, ids) | [domains/tabulature/notebook-model.md](domains/tabulature/notebook-model.md) | [domains/editing/README.md](domains/editing/README.md) |
| Add a new domain spec | [META.md](META.md) (Domain README format) | [WORKFLOW.md](WORKFLOW.md) §3–4 |
| Define an interface between two layers | [contracts/_template.md](contracts/_template.md) | [architecture/layers.md](architecture/layers.md) |
| Change dependency/architecture rules | [architecture/layers.md](architecture/layers.md) | create an ADR from [decisions/_template.md](decisions/_template.md) |
| Understand why a decision was made | [decisions/](decisions/) | [КАРТА-ПРОЕКТА.md](../КАРТА-ПРОЕКТА.md) (source of №NN) |
| Resolve a `TODO: verify` marker | [WORKFLOW.md](WORKFLOW.md) §5–6 | [META.md](META.md) "Current Project State" |
| Learn how to maintain specs | [WORKFLOW.md](WORKFLOW.md) | [META.md](META.md) |

## Dependency Graph

The runtime tree is the stage-1 scaffold (root `App.tsx`/`index.ts` + `src/` layer skeleton, [ADR-0003](decisions/0003-src-layer-directories.md)) plus the stage-2 tabulature model (`src/domain/tabulature/`), which imports nothing outside its own module — the runtime dependency graph is still trivial. The intended dependency structure of the six specified domains (downward-only, per [architecture/layers.md](architecture/layers.md); `app-shell` is the Entry Points layer, `tabulature`/`layout-engine` are Domain, `editing` orchestration is Application, `storage`/`rendering` are Infrastructure):

```
                ┌─────────────────────────────────┐
                │           app-shell             │  navigation, Read/Edit modes,
                │ (№23, №28, №31, №32, №37, №39,  │  toolbar, Back contract,
                │            №40)                 │  rotation, i18n, theme
                └────────┬───────────────┬────────┘
         dispatches      │               │  «Сохранить»/close/restore
         user intent     ▼               ▼
              ┌───────────────┐   ┌───────────────┐
              │    editing    │   │    storage    │
              │ (№5, №21, №25,│   │ (№26, №29,    │
              │ №35–№37, №40) │   │  №30, №38)    │
              └───────┬───────┘   └───────┬───────┘
              mutates │         persists │
                model │       as JSON    │
                      ▼                   ▼
                ┌─────────────────────────────────┐
                │           tabulature            │  pure data model:
                │ (№1–№4, №6, №18–№22, №35)       │  notebook, lines, columns,
                └────────────────┬────────────────┘  notes, texts, tuning
                          model │
                                ▼
                        ┌───────────────┐  geometry,    ┌────────────────┐
                        │ layout-engine │  own width    │   rendering    │
                        │ (№14, №20,    │  (№14, №23)   │ (№7, №8, №14,  │
                        │ №23, №24, №28)│──────────────▶│ №30, №33)      │
                        └───────────────┘               └────────────────┘
```

The three chains: **model → layout → render** (geometry flows from the tabulature model through the layout engine into both renderers); **model ← editing ← shell** (the shell dispatches intent to editing, editing mutates the model); **storage under shell** (the shell's toolbar Save/Close and the startup restore prompt drive storage, which persists the model as `tet-<id>.json`).

## Directory

```
docs/specs/
├── META.md                                    spec formats, rules, update protocol
├── INDEX.md                                   this file
├── WORKFLOW.md                                how to work with the spec system
├── architecture/
│   ├── layers.md                              layer model + dependency rules, mapped to domains
│   └── data-flow.md                           five-stage operation pipeline + worked example
├── domains/
│   ├── app-shell.md                           navigation, modes, toolbar, Back, i18n, theme (№23, №28, №31, №32, №37, №39, №40)
│   ├── layout-engine.md                       column geometry: model → coordinates, wrap rules (№14, №20, №23, №24, №28)
│   ├── tabulature/
│   │   ├── README.md                          notebook/lines/columns/notes model overview (№1–№4, №6, №18–№22)
│   │   └── notebook-model.md                  entity catalog, column states, cascades, error semantics (№19, №20, №22, №35)
│   ├── editing/
│   │   ├── README.md                          selection, menus, gestures, undo/redo, mode gating (№5, №11, №21, №25, №35–№37, №40)
│   │   ├── cell-and-column-menus.md           fret panel 0–24, barline, column menu operations (№5, №21, №24, №35)
│   │   └── lines-and-gestures.md              ribbon rows: insert/move/delete, drag handles, trash (№11, №36)
│   ├── storage/
│   │   ├── README.md                          JSON files, previews, pocket, AsyncStorage overview (№26, №29, №30)
│   │   ├── pocket.md                          single autosave pocket: lifecycle, startup restore (№26)
│   │   └── library.md                         cards, sorting, corrupted JSON, creation flow (№30, №38–№40)
│   └── rendering/
│       ├── README.md                          Skia screen + HTML→PDF pipelines from layout output (№14, №23, №28, №30)
│       └── pdf-export.md                      A4 export: pagination, page chrome, sharing (№7, №8, №33)
├── contracts/
│   └── _template.md                           contract template — no real boundaries yet
└── decisions/
    ├── _template.md                           ADR template
    ├── 0001-bootstrap-spec-system-before-code.md
    ├── 0002-specs-live-in-docs-specs.md
    └── 0003-src-layer-directories.md          src/ layer directories: domain/application/infrastructure/i18n (stage 1)
```
