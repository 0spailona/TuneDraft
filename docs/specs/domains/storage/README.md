# Storage

> Pre-code spec: every claim below describes intended behavior of code that does not
> exist yet (see [ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)).
> `<!-- TODO: verify -->` markers are resolved when the code lands (roadmap stage 7).

## Purpose

Persists notebooks as portable JSON files (`tet-<id>.json`) with cached card previews
(`tet-<id>.png`), maintains the single per-application autosave pocket, and supplies the
library screen with notebook cards. Application settings live in AsyncStorage (№26, №29,
№30).

## Key Files

None yet — this domain's code is not implemented yet (the stage-1 scaffold, [ADR-0003](../../decisions/0003-src-layer-directories.md), ships only the layer skeleton and i18n). <!-- TODO: verify when storage code lands (roadmap stage 7) -->

## Core Types

None yet. <!-- TODO: verify when storage code lands; expected: notebook JSON file I/O, pocket read/write, library listing/model -->

The deserialization boundary (stage 7) never feeds raw parsed JSON straight into domain operations: `JSON.parse` output is typed `unknown`, wrapped in `try/catch` (a parse error yields the «повреждена» card state, №30), and only after structural checks reach `validateNotebook` — which itself reports malformed arrays (`columns`, `notes`, `texts`, `lines`) as `invalid-notebook` values instead of throwing. <!-- TODO: verify when stage-7 storage code lands -->

## Flow

Primary happy path — edit, save, restart (№26, №29, №30). <!-- TODO: verify once implemented -->

```
edit-mode action
      |
      v
model mutation -> pocket write (after EVERY action, №26)

toolbar «Сохранить» (№26)
      |
      +--> tet-<id>.json   final version; file is physically created
      |                    at the FIRST «Сохранить» only
      +--> tet-<id>.png    preview re-rendered: first system,
                           cached next to the JSON (№30)

app start (№26)
      |
      v
pocket non-empty? --no--> library screen (№39)
      |yes
      v
restore prompt
  +-- «да»  -> pocket version written to tet-<id>.json
  |            (file RECREATED if the notebook was deleted
  |            from the library) -> clear pocket
  +-- «нет» -> clear pocket
```

## Invariants

The following hold for the storage code once it exists. <!-- TODO: verify each invariant when storage code lands -->

- At most one notebook is open at a time, for reading or editing; the pocket holds at most
  that one notebook. (№26, №40)
- The pocket is written after every model-changing action performed in edit mode. (№26)
- The file `tet-<id>.json` is created physically at the first «Сохранить»; closing a
  never-saved notebook without saving leaves no file behind. (№26)
- The visible notebook name lives only inside the JSON; the file name is stable and
  derived from the notebook `id`. (№29)
- Renaming a notebook rewrites the name inside the JSON and keeps the file name
  unchanged. (№29, №30)
- Notebooks persist as JSON files (expo-file-system); application settings persist in
  AsyncStorage. (№29)
- The pocket protects only against crashes (app minimized, process killed); a deliberate
  refusal discards it. (№26)

## Configuration

All parameters below are fixed constants of the format, not user settings. <!-- TODO: verify when storage code lands -->

- Notebook file name pattern: `tet-<id>.json`, `<id>` = stable notebook `id` (№19, №29).
- Preview file name pattern: `tet-<id>.png`, stored next to the JSON (№30).
- Pocket: one slot per application, written after every action (№26).
- Settings store: AsyncStorage, application settings only (№29).
- JSON backup export folder: a separate folder near the `.apk`; the exact path is
  clarified at roadmap stage 7 — Android offers no literal "next to .apk", the nearest
  equivalent is the application's external storage (№30). <!-- TODO: verify at stage 7 -->

## Extension Points

- **Albums** — the model already stores `albumId` from day one, so album grouping is
  added after MVP without migration; until then the library passes `albumId` through
  untouched (№30).
- **JSON import** — export produces a portable `tet-<id>.json`; post-MVP import reuses
  the same format (№30).
- **Card extras** — preview size (large/small/none), edit-date display, and "fork"
  sharing (Telegram/contacts) are post-MVP card features (№30).

## Related Specs

- [pocket.md](pocket.md) — autosave pocket: lifecycle, prompts, crash recovery.
- [library.md](library.md) — library cards, corrupted-JSON handling, context menu, creation flow.
- [architecture/data-flow.md](../../architecture/data-flow.md) — the five-stage pipeline every storage operation follows.
- [architecture/layers.md](../../architecture/layers.md) — layer discipline storage code must follow.
