# App Shell

> **Bootstrap-era spec.** Written before any source code exists (see [ADR-0001](../decisions/0001-bootstrap-spec-system-before-code.md)). Every claim about code that does not exist yet carries a `<!-- TODO: verify -->` marker. Decision references `(№NN)` point to [КАРТА-ПРОЕКТА.md](../../КАРТА-ПРОЕКТА.md).

## Purpose

The app shell is the outermost runtime layer of TuneDraft: it owns screen navigation (Library ↔ Editor), the Android system Back contract, the Read/Edit mode switch, and the editor toolbar (Save, Close, Undo, Redo, Export PDF). It forwards user intent to the editing, layout-engine, storage, and rendering domains and owns no tabulature logic of its own.

## Key Files

None yet — the repository contains no source code. <!-- TODO: verify -->

## Core Types

None yet. <!-- TODO: verify -->

## Flow

Primary happy path (open an existing notebook and play from it):

```
 app launch ──▶ LIBRARY (start screen, №39)
                    │   tap card ──────▶ EDITOR opens in Read mode (№40)
                    │   "new notebook" ▶ EDITOR opens in Edit mode (№40)
                    ▼
        ┌────────── EDITOR — one notebook open at a time (№26) ──────────┐
        │  mode switch:   Read ◀──────▶ Edit                  (№40)     │
        │  toolbar: Save | Close | Undo ↶ | Redo ↷ | PDF      (№37)     │
        │  input menus & panels visible in Edit mode only     (№40)     │
        └───────────────────────────────────────────────────────────────┘
                    │   "Close" or system Back ──▶ confirm save? (№26, №39)
                    ▼
                 LIBRARY ──▶ system Back here = exit application (№39)
```

Toolbar action dispatch (every action follows the five-stage pipeline of [architecture/data-flow.md](../architecture/data-flow.md)):

1. User activates a toolbar control (№37); controls are reachable in the editor in both modes.
2. The shell routes the command to the owning domain:
   - **Save** and **Close** → storage domain (file write / pocket cleanup per №26);
   - **Undo ↶ / Redo ↷** → editing domain history, up to 3 steps (№25, №37);
   - **Export PDF** → rendering domain.
3. The shell re-renders the affected strip region from layout-engine output inside the virtualization window (№28).

## Invariants

- The Library screen is always the start screen of the application (№39).
- System Back in the editor always acts as "Close" and always raises the save confirmation before leaving (№26, №39).
- System Back on the Library screen always exits the application (№39).
- Exactly one notebook is open at a time, in exactly one mode, Read or Edit (№26, №40).
- A newly created notebook always opens directly in Edit mode (№40).
- Input menus and panels appear only while the editor is in Edit mode (№40).
- The editor toolbar always exposes Save, Close, Undo, Redo, and Export PDF (№37).
- The rendered strip always draws only the virtualization window — visible rows plus a reserve margin around the screen — and always leaves the rest of the document undrawn (№28).
- The app always runs in both portrait and landscape; a rotation always triggers re-flow of system breaks at the new width (№23).
- Every user-visible string always comes from the string dictionary, and components always receive their strings through the dictionary; Russian is the base language (№31).
- MVP always ships exactly one built-in theme; fret digits always render in a monospace font (№32).
- All gesture recognition always runs on the `react-native-gesture-handler` + `reanimated` stack, with taps handled as selection commands and gestures (finger movements the system interprets as commands) handled separately (№11).

## Configuration

| Parameter | Default | Valid values / notes | Source |
| --------- | ------- | -------------------- | ------ |
| `minSdkVersion` | 24 (Android 7.0) | Floor of the current stack (Expo SDK 54+, Skia ≥ 21, RN 0.86 ≥ 24); raised later only via `expo-build-properties` when a library demands it | №23 |
| UI language | Russian (base) | English as an addable option; all strings via dictionary | №31 |
| Theme | Single hardcoded MVP theme | Font + color theme system arrives after MVP | №32 |
| Undo/Redo depth | 3 steps | Applies to every model mutation | №25, №37 |
| Virtualization window | Visible rows ± reserve margin | Exact margin size chosen at implementation <!-- TODO: verify --> | №28 |
| Test device | Acer Iconia X12 tablet | Stage 0 checks Android ≥ 7.0; if lower, test on emulator and keep `minSdk` at 24 | №23 |

## Extension Points

- **Add a UI language** — add dictionary entries for the new locale; components stay untouched because they read strings only through the dictionary (№31). <!-- TODO: verify -->
- **Theme selection** — after MVP, replace the single hardcoded theme with selectable font/color themes; the monospace rule for fret digits carries over (№32).
- **Raise `minSdk`** — bump via `expo-build-properties` when a dependency requires a newer API level; the rest of this spec is unaffected (№23).
- **Extend the toolbar** — new commands plug into the same routing table in Flow step 2; the five MVP actions remain present (№37).
- **Register new gestures** — declare them on the `react-native-gesture-handler` stack (pinch zoom is a candidate); tap-as-selection semantics stay reserved for the editing domain (№11). <!-- TODO: verify -->
- **Tune the virtualization window** — change the reserve margin without touching the renderers, because renderers always receive the window as an input (№28).

## Related Specs

- [architecture/layers.md](../architecture/layers.md) — the dependency discipline the shell follows as the Entry Points layer.
- [architecture/data-flow.md](../architecture/data-flow.md) — the five-stage pipeline every shell-dispatched action follows.
- [decisions/0001-bootstrap-spec-system-before-code.md](../decisions/0001-bootstrap-spec-system-before-code.md) — the TODO-marker protocol used across this pre-code spec.
- [КАРТА-ПРОЕКТА.md](../../КАРТА-ПРОЕКТА.md) — source of every `(№NN)` decision reference.
