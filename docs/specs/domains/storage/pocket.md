# Autosave Pocket

> Pre-code spec: describes intended behavior of code that does not exist yet
> ([ADR-0001](../../decisions/0001-bootstrap-spec-system-before-code.md)). <!-- TODO: verify when pocket code lands (roadmap stage 7) -->

## Role

The single per-application draft slot that captures the currently edited (opened but not
saved) notebook after every action, so that a crash or process kill never loses more than
one action (№26).

## Key Files

None yet — this domain's code is not implemented yet (the stage-1 scaffold, [ADR-0003](../../decisions/0003-src-layer-directories.md), ships only the layer skeleton and i18n). <!-- TODO: verify when pocket code lands -->

## Behavior

### Write policy

The pocket is written **after every model-changing action** performed in edit mode (№26).
Reading mode does not mutate the model and does not touch the pocket.

### Lifecycle

```
                +--------------------+
                |      (empty)       |
                +--------------------+
   open notebook |                 ^ clear pocket
   for editing   v                 | (all four paths below)
        +------------------+       |
        |  notebook open   |-------+
        |  (pocket updated |
        |  after every     |
        |  action)         |
        +------------------+
          |            |
 toolbar  |            | «Закрыть» (№26, №39)
 «Сохранить»           |
          v            v
   write tet-<id>.json   prompt «save before closing?»
   + clear pocket        +-- save   -> write tet-<id>.json + clear pocket
   (file created at      +-- refuse -> clear pocket IMMEDIATELY
   FIRST save only)          (pocket protects against crashes
                             only, not a deliberate "no")
```

### Startup restore prompt (№26)

At application start, if the pocket is non-empty, the user is asked whether to restore:

| Prompt answer | Effect |
| ------------- | ------ |
| «да» (yes) | Pocket version is written to the permanent file `tet-<id>.json`; if the notebook was deleted from the library while the pocket held it, the file is **recreated**; then the pocket is cleared |
| «нет» (no) | The pocket is cleared; no permanent file is touched |

### Relationship to the permanent file

- The pocket exists to cover the window between notebook creation/editing and the first
  «Сохранить», and between saves during a session (№26).
- `tet-<id>.json` is physically created only at the first «Сохранить» (№26); until then
  the notebook lives only in the pocket (see [README.md](README.md#flow)).
- A restore may recreate a deleted file — restoration always leaves a valid
  `tet-<id>.json` on disk (№26).

## Error Handling

None yet — no code exists. Intended rules: <!-- TODO: verify when pocket code lands -->

- A failed pocket write never blocks or crashes editing; the action itself always
  completes. <!-- TODO: verify -->
- A failed permanent-file write on «Сохранить» or restore leaves the pocket **intact**
  (the draft is the only copy until the write succeeds). <!-- TODO: verify -->
- An unreadable pocket at startup is treated as empty; the restore prompt is skipped.
  <!-- TODO: verify -->

## Invariants

The following hold for the pocket code once it exists. <!-- TODO: verify each invariant when pocket code lands -->

- The pocket is one per application and holds at most the single currently open notebook
  (only one notebook can be open at a time, №26, №40).
- The pocket is updated after every model-changing action in edit mode. (№26)
- A deliberate refusal at «Закрыть» clears the pocket immediately. (№26)
- A successful restore or save always ends with a cleared pocket. (№26)
- Restore recreates `tet-<id>.json` when that file is missing. (№26)
- The pocket holds notebook content only; application settings live in AsyncStorage
  (№29) and are never stored in the pocket.

## Related Specs

- [README.md](README.md) — storage domain overview: file layout, save flow, configuration.
- [library.md](library.md) — the library that restore interacts with (deleted notebook → file recreation).
- [architecture/data-flow.md](../../architecture/data-flow.md) — the five-stage pipeline a pocket write follows.
