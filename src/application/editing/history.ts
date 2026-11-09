// История отмен редактора (№25, №37) — чистые структуры и операции.
// Спека: docs/specs/domains/editing/lines-and-gestures.md («Undo / Redo»).
// Модель — снимки тетради ДО мутации: undo снимает последний снимок и
// уносит текущее состояние в redo-ветку; redo возвращает снимок и возвращает
// текущее состояние в стек отмены. Глубина стека отмены ≤ 3 (№25): старейший
// снимок вытесняется; redo-ветка не превышает глубину стека (каждая её запись
// появляется только при undo). Новая мутация всегда чистит redo-ветку (№37).
// Слой Application (R2): работает только с типами Domain, без эффектов.

import type { Notebook } from '../../domain/tabulature/types';

/** Глубина истории отмен в MVP (№25): фиксировано 3. */
export const MAX_HISTORY_DEPTH = 3;

/**
 * История отмен. `undo` — снимки тетради до мутаций, от старых к новым;
 * `redo` — снимки состояний, снятых отменой (последняя отменённая — последняя
 * в списке, №37: redo всегда восстанавливает именно её).
 */
export interface EditorHistory {
  readonly undo: readonly Notebook[];
  readonly redo: readonly Notebook[];
}

/** Пустая история: отменять и возвращать нечего. */
export function emptyHistory(): EditorHistory {
  return { undo: [], redo: [] };
}

/** Есть ли что отменять (активна ли кнопка Undo ↶ тулбара, №37). */
export function canUndo(history: EditorHistory): boolean {
  return history.undo.length > 0;
}

/** Есть ли что возвращать (активна ли кнопка Redo ↷ тулбара, №37). */
export function canRedo(history: EditorHistory): boolean {
  return history.redo.length > 0;
}

/**
 * Кладёт снимок тетради, сделанный ДО успешной мутации (№25): redo-ветка
 * очищается (№37 — новая мутация обрывает ветку возврата), старейший снимок
 * вытесняется при переполнении глубины 3 (№25). История иммутабельна —
 * возвращается новая.
 */
export function pushSnapshot(history: EditorHistory, snapshot: Notebook): EditorHistory {
  const undo = [...history.undo, snapshot];
  if (undo.length > MAX_HISTORY_DEPTH) {
    undo.splice(0, undo.length - MAX_HISTORY_DEPTH);
  }
  return { undo, redo: [] };
}

/** Результат успешного undo/redo: обновлённая история + тетрадь-снимок. */
export interface HistoryStep {
  readonly history: EditorHistory;
  readonly notebook: Notebook;
}

/**
 * Отмена (№25, №37): текущее состояние уходит в redo-ветку (в конец —
 * «самая свежая из отменённых»), последний снимок становится тетрадью.
 * null — истории пуста: отменять нечего, состояние не меняется.
 */
export function popUndo(history: EditorHistory, current: Notebook): HistoryStep | null {
  if (history.undo.length === 0) {
    return null;
  }
  const notebook = history.undo[history.undo.length - 1];
  return {
    history: {
      undo: history.undo.slice(0, -1),
      redo: [...history.redo, current],
    },
    notebook,
  };
}

/**
 * Возврат (№37): текущее состояние возвращается в стек отмены, последний
 * отменённый снимок становится тетрадью. null — redo-ветка пуста.
 */
export function popRedo(history: EditorHistory, current: Notebook): HistoryStep | null {
  if (history.redo.length === 0) {
    return null;
  }
  const notebook = history.redo[history.redo.length - 1];
  return {
    history: {
      undo: [...history.undo, current],
      redo: history.redo.slice(0, -1),
    },
    notebook,
  };
}
