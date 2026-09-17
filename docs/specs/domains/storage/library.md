# Notebook Library

> Pre-code spec: describes intended behavior of code that does not exist yet
> ([ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)). <!-- TODO: verify when library code lands (roadmap stage 7) -->

## Role

The library lists all stored notebooks as cards (name + cached preview), sorts them by
last-modified date, creates new notebooks from the №38 template, and exposes per-card
actions through a context menu (№30, №38).

## Key Files

None yet — the repository contains no source code. <!-- TODO: verify when library code lands -->

## Behavior

### Card

Each card shows the notebook **name** (from inside the JSON, №29) and a **preview** —
the first system (the tab row before the first line break), rendered at «Сохранить» and
cached to `tet-<id>.png` next to the JSON (№30).

### Sorting

Cards are sorted by **modification date, newest first** (№30).

### Corrupted JSON (№30)

| JSON state | Card | Actions available |
| ---------- | ---- | ----------------- |
| Valid | name + preview | tap = open for reading (№40); rename / delete / export |
| Broken (unparseable / invalid) | marked «повреждена» (corrupted) | open is disabled; delete available |

### Context menu (№30)

Opened via the button on the right of a card. Items:

| Item | Effect |
| ---- | ------ |
| Rename | changes the name inside the JSON; file name `tet-<id>.json` stays unchanged (№29) |
| Delete | removes `tet-<id>.json` (and its `tet-<id>.png`); the notebook disappears from the library (№30) |
| Export | MVP export = JSON backup: the file is placed in a separate folder near the `.apk` (№30) |

Import of JSON backups is post-MVP (№30).

### New notebook creation (№26, №38)

1. A **name is requested immediately** at creation (dialog), before the notebook is
   opened (№38).
2. The notebook opens pre-filled from the №38 template:

```
+------------------------------------------+
| text row «название»  = name from dialog  |
| text row «описание»  = empty             |
| one empty tab row                        |
+------------------------------------------+
```

3. The new notebook opens directly in **edit mode** (№40).
4. `tet-<id>.json` is physically created only at the first «Сохранить» — until then the
   draft lives in the pocket (№26, see [pocket.md](pocket.md)); closing without saving
   leaves no orphan file in the library.
5. The model carries `albumId` from day one; albums arrive post-MVP without migration
   (№30).

### Preview rendering

Preview of the first system is rendered at «Сохранить» (the same moment the JSON is
written) and cached as `tet-<id>.png` next to the JSON (№30). It is not re-rendered on
every library visit. <!-- TODO: verify when library code lands -->

## Error Handling

None yet — no code exists. Intended rules: <!-- TODO: verify when library code lands -->

- A broken `tet-<id>.json` yields a «повреждена» card instead of hiding the notebook;
  the user can still delete it (№30). <!-- TODO: verify -->
- A missing `tet-<id>.png` degrades to a card without preview; the card stays
  functional (№30). <!-- TODO: verify -->
- A failed export leaves the source JSON untouched. <!-- TODO: verify -->

## Invariants

The following hold for the library code once it exists. <!-- TODO: verify each invariant when library code lands -->

- Every valid `tet-<id>.json` in storage appears as exactly one library card. (№30)
- Cards are always ordered by modification date, newest first. (№30)
- The visible name shown on a card always equals the `name` field inside the JSON, and
  renaming never changes the file name. (№29, №30)
- A broken JSON always renders as a «повреждена» card that cannot be opened but can be
  deleted. (№30)
- The preview file `tet-<id>.png` is written only together with «Сохранить». (№30)
- Every notebook carries an `albumId` from the moment of creation. (№30)
- Creation always asks for the name first and opens the №38 template directly in edit
  mode. (№38, №40)

## Related Specs

- [README.md](README.md) — storage domain overview: file layout, save flow, configuration.
- [pocket.md](pocket.md) — the draft slot behind "close without saving" during creation.
- [architecture/data-flow.md](../../architecture/data-flow.md) — the five-stage pipeline library operations follow.
