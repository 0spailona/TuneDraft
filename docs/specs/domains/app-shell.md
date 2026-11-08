# App Shell

> **Editor screen landed** (roadmap stage 5: editing controller + `components/editor/`, [ADR-0006](../decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md); earlier: stages 1 and 4 — Expo scaffold + `src/` skeleton, [ADR-0003](../decisions/0003-src-layer-directories.md); draw plan + Skia executor, [ADR-0005](../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md)). Claims about implemented code below are verified against the tree; claims about features not yet built (Library screen, Save/Close/PDF actions, virtualization, drag gestures) still carry `<!-- TODO: verify -->` markers. Decision references `(№NN)` point to [КАРТА-ПРОЕКТА.md](../../КАРТА-ПРОЕКТА.md).

## Purpose

The app shell is the outermost runtime layer of TuneDraft: it owns screen navigation (Library ↔ Editor), the Android system Back contract, the Read/Edit mode switch, and the editor toolbar (Save, Close, Undo, Redo, Export PDF). It forwards user intent to the editing, layout-engine, storage, and rendering domains and owns no tabulature logic of its own.

## Key Files

- `App.tsx` — root component (Expo entry point); pure wiring (R4): `GestureHandlerRootView` + `EditorScreen` with the demo notebook fixture (`demoNotebookFixture(idGen)`) opened in Edit mode (№40: a new notebook opens in Edit) and the width from `useWindowDimensions` — rotation re-runs layout and plan at the new width, the model stays fixed (№23). ONE `createIdGenerator()` per notebook (R6): the same `idGen` builds the fixture and goes to `EditorScreen` as a prop — edit-mode inserts continue the counter after the fixture (a screen-local counter restarted at 1 and collided with fixture ids: the 2nd text insert was refused `line-id-duplicate`; regression: notebook-model.test.ts «фикстура и правка на одном генераторе»). Library navigation, save/close confirm flows land in stages 6–7. <!-- TODO: verify when stage-6/7 shell code lands -->
- `index.ts` — component registration (`registerRootComponent`), wiring only (R4).
- `components/editor/EditorScreen.tsx` — the editor screen (stage 5, Entry glue per ADR-0006): toolbar №37 (Save/Undo/Redo render in Edit mode only per №40 — acceptance 2026-11-09; Close/Export PDF render in both modes; Save/Close/PDF stay disabled until stages 7–8; Undo/Redo wire `canUndo`/`canRedo` enablement), the «Править»/«Чтение» mode switch №40 (mode change clears the selection; in Read mode taps open no panels and Save/Undo/Redo are not rendered), tap → hit-test dispatch, bottom panels (№21, №35, №36), warning strip mapping model error codes to dictionary strings (№31). Screen root carries `paddingTop: StatusBar.currentHeight` — Android 15 edge-to-edge draws the app under the status bar, and without the inset the upper half of the №37 toolbar is swallowed by the status bar (untappable "dead zone"; found 2026-11-09). The same rule applies to the bottom: root `paddingBottom: 56` compensates the Android 12+ tablet taskbar (56dp; `navigationBarBackground` occupies 1488–1600px at density 320) — without it the edit-mode bottom controls (№36 «+», row-type picker, fret panel, column menu) sit entirely under the taskbar and are invisible/untappable ("no + sign in any mode", found 2026-11-09; the same defect was logged as an environment note in the 26.10 smoke run). `react-native-safe-area-context` is not installed; replace both hand-compensations with real insets if it gets introduced.
- `components/editor/FretPanel.tsx`, `components/editor/ColumnMenu.tsx` — the bottom-panel menus (№21, №35).
- `components/editor/RowTypePicker.tsx`, `components/editor/TextEntryModal.tsx` — the «+» mini-picker (№36) and the text input modal (№27).
- `src/i18n/index.ts` — `t(key)` lookup over the dictionary; the single channel components use for user-visible strings (№31).
- `src/i18n/ru.ts` — the Russian dictionary: `app.name`, the five `toolbar.*` keys (№37), and the stage-5 groups `menu.*`, `panel.*`, `picker.*`, `mode.*`, `modal.text.*`, `warning.*` (a string for every `ModelErrorCode`).
- `src/i18n/__tests__/i18n.test.ts` — dictionary smoke tests plus stage-5 completeness checks (toolbar, menus, panel, modal, one warning per error code) (№34).

The Library screen has no files yet — stage 7. The demo screen's visible content comes from the notebook model and the dictionary; no strings are hardcoded in shell components (№31).

## Core Types

Shell-owned types shipped so far:

```ts
// src/i18n/ru.ts — dictionary types (№31)
export const ru = {
  'app.name': 'TuneDraft',
  'toolbar.save': 'Сохранить',
  // ... toolbar.* (№37), menu.*, panel.*, picker.*, mode.*, modal.text.*, warning.*
} as const;

export type Dictionary = typeof ru;
export type TranslationKey = keyof Dictionary;

// src/i18n/index.ts
export declare function t(key: TranslationKey): string;
// A key missing from the dictionary is a compile-time error; at runtime, a
// dynamically-built key that bypasses the compile-time check throws in
// non-production builds (fail fast) and degrades gracefully in production —
// `t()` returns the key itself (№31).
```

```ts
// src/application/editing/types.ts — shell-facing editor state (stage 5)
export type EditMode = 'read' | 'edit';                  // №40
export interface EditorState { /* notebook, mode, selection, warning, history */ }
```

Screen/navigation types beyond `EditMode` (Library ↔ Editor state, Back contract) land with stages 6–7. <!-- TODO: verify when stage-6/7 shell code lands -->

## Flow

Current flow (stage 5: editor screen on the demo notebook):

```
 app launch ──▶ App.tsx (wiring only, R4)
                    │  idGen = createIdGenerator() — ONE generator for the
                    │  notebook (R6): demoNotebookFixture(idGen) — module-level
                    │  model constant; the SAME idGen goes to EditorScreen, so
                    │  edit-mode inserts continue the numbering after the
                    │  fixture (a screen-local counter collided with fixture
                    │  ids: the 2nd text insert hit line-id-duplicate)
                    │  useWindowDimensions() — width in px (rotation re-runs, №23)
                    ▼
        EditorScreen (components/editor/, ADR-0006):
        toolbar №37 + mode switch №40
                    │
                    ▼
        NotebookCanvas (src/infrastructure/rendering/):
        floor(width / advance) → layoutNotebook → draw plan → SkPicture
        tap → hit-test plan → selection + bottom panel (edit mode, №40)
        intents → applyIntent (src/application/editing) → model + history
        rendered in a ScrollView — the notebook «как тетрадь» (№14, №23)
```

Planned shell flow (stages 6–7; Library not built yet):

```
 app launch ──▶ LIBRARY (start screen, №39)
                    │   tap card ──────▶ EDITOR opens in Read mode (№40)
                    │   "new notebook" ▶ EDITOR opens in Edit mode (№40)
                    ▼
        ┌────────── EDITOR — one notebook open at a time (№26) ──────────┐
        │  mode switch:   Read ◀──────▶ Edit                  (№40)     │
        │  toolbar: Close | PDF — both modes                  (№37)     │
        │  Save | Undo ↶ | Redo ↷ — Edit mode only       (№37, №40)    │
        │  input menus & panels visible in Edit mode only     (№40)     │
        └───────────────────────────────────────────────────────────────┘
                    │   "Close" or system Back ──▶ confirm save? (№26, №39)
                    ▼
                 LIBRARY ──▶ system Back here = exit application (№39)
```

Toolbar action dispatch (every action follows the five-stage pipeline of [architecture/data-flow.md](../architecture/data-flow.md)):

1. User activates a toolbar control (№37); Close and Export PDF are reachable in both modes, while Save, Undo, and Redo render only in Edit mode (№40 — acceptance 2026-11-09).
2. The shell routes the command to the owning domain:
   - **Undo ↶ / Redo ↷** → editing domain history, up to 3 steps (№25, №37) — dispatched as controller intents; live in stage 5.
   - **Save** and **Close** → storage domain (file write / pocket cleanup per №26); rendered disabled until stage 7. <!-- TODO: verify when stage-7 storage code lands -->
   - **Export PDF** → rendering domain; rendered disabled until stage 8. <!-- TODO: verify when stage-8 export code lands -->
3. The shell re-renders the affected strip region from layout-engine output inside the virtualization window (№28). <!-- TODO: verify when stage-6 virtualization code lands -->

## Invariants

- The Library screen is always the start screen of the application (№39). <!-- TODO: verify when stage-7 library code lands -->
- System Back in the editor always acts as "Close" and always raises the save confirmation before leaving (№26, №39). <!-- TODO: verify when stage-6/7 shell code lands -->
- System Back on the Library screen always exits the application (№39). <!-- TODO: verify when stage-7 library code lands -->
- Exactly one notebook is open at a time, in exactly one mode, Read or Edit (№26, №40).
- A newly created notebook always opens directly in Edit mode (№40).
- Input menus, panels, and the Save/Undo/Redo toolbar buttons appear only while the editor is in Edit mode (№40; verified: `EditorScreen` gates panels, tap handling, and those buttons on the mode — acceptance 2026-11-09).
- The editor toolbar always exposes Close and Export PDF in both modes; Save, Undo, and Redo are always present in Edit mode and never rendered in Read mode (№37, №40). The controller keeps accepting undo/redo intents in either mode (ADR-0006) — the screen simply does not offer them in Read mode.
- The rendered strip always draws only the virtualization window — visible rows plus a reserve margin around the screen — and always leaves the rest of the document undrawn (№28). <!-- TODO: verify when stage-6 virtualization code lands -->
- The app always runs in both portrait and landscape; a rotation always triggers re-flow of system breaks at the new width (№23).
- Every user-visible string always comes from the string dictionary, and components always receive their strings through the dictionary; Russian is the base language (№31).
- MVP always ships exactly one built-in theme; fret digits always render in a monospace font (№32).
- All gesture recognition always runs on the `react-native-gesture-handler` + `reanimated` stack, with taps handled as selection commands and gestures (finger movements the system interprets as commands) handled separately (№11).

## Configuration

| Parameter | Default | Valid values / notes | Source |
| --------- | ------- | -------------------- | ------ |
| `minSdkVersion` | 24 (Android 7.0) | Floor of the current stack — verified statically (Expo SDK 57, RN 0.86.3: `expo export` passes; default `minSdkVersion` 24 comes from the `expo-root-project` Gradle plugin and RN's own manifest, no override present); raised later only via `expo-build-properties` when a library demands it | №23 |
| UI language | Russian (base) | English as an addable option; all strings via dictionary | №31 |
| Theme | Single hardcoded MVP theme | Font + color theme system arrives after MVP | №32 |
| Undo/Redo depth | 3 steps | Applies to every model mutation | №25, №37 |
| Virtualization window | Visible rows ± reserve margin | Exact margin size chosen at implementation <!-- TODO: verify --> | №28 |
| Test device | Acer Iconia X12 tablet | Stage 0 checks Android ≥ 7.0; if lower, test on emulator and keep `minSdk` at 24 | №23 |

## Extension Points

- **Add a UI language** — add dictionary entries for the new locale; components stay untouched because they read strings only through the dictionary (№31; the pattern is proven by the stage-5 groups — screens reference only `TranslationKey`s).
- **Theme selection** — after MVP, replace the single hardcoded theme with selectable font/color themes; the monospace rule for fret digits carries over (№32).
- **Raise `minSdk`** — bump via `expo-build-properties` when a dependency requires a newer API level; the rest of this spec is unaffected (№23).
- **Extend the toolbar** — new commands plug into the same routing table in Flow step 2; the five MVP actions remain present (№37).
- **Register new gestures** — declare them on the `react-native-gesture-handler` stack inside `NotebookCanvas` (pinch zoom is a candidate); tap-as-selection semantics stay reserved for the editing domain (№11; the tap/long-press → JS via `runOnJS` pattern is in place since stage 5). Drag-specific disambiguation lands with stage 6. <!-- TODO: verify when stage-6 gesture code lands -->
- **Tune the virtualization window** — change the reserve margin without touching the renderers, because renderers always receive the window as an input (№28).

## Related Specs

- [architecture/layers.md](../architecture/layers.md) — the dependency discipline the shell follows as the Entry Points layer.
- [architecture/data-flow.md](../architecture/data-flow.md) — the five-stage pipeline every shell-dispatched action follows.
- [Rendering](rendering/README.md) — the screen pipeline `App.tsx` wires in ([ADR-0005](../decisions/0005-screen-renderer-draw-plan-and-skia-executor.md)).
- [decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md](../decisions/0006-editing-application-controller-entry-glue-plan-hit-test.md) — where the editor screen glue lives and how the shell dispatches into the controller.
- [decisions/0001-bootstrap-spec-system-before-code.md](../decisions/0001-bootstrap-spec-system-before-code.md) — the TODO-marker protocol used across this pre-code spec.
- [КАРТА-ПРОЕКТА.md](../../КАРТА-ПРОЕКТА.md) — source of every `(№NN)` decision reference.
