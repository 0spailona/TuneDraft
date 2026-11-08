// Контроллер редактора (этап 5) — конвейер «интент → мутация модели →
// push undo (№25) → сброс redo (№37) → эффект кармана (№26)».
// Спеки: docs/specs/domains/editing/README.md (конвейер), data-flow.md
// (пятистадийный конвейер), cell-and-column-menus.md (отказ не пишет историю).
// Слой Application (R2): вызывает Domain напрямую, карман (Infrastructure)
// получает только через интерфейс PocketWriter (см. types.ts), реализацию
// которого вводит Entry-уровень; фреймворков и тестовых библиотек нет.

import type { IdGenerator } from '../../domain/tabulature/ids';
import type { ModelResult, Notebook, TabLine } from '../../domain/tabulature/types';
import {
  addColumnText,
  clearColumn,
  createTabLine,
  createTextLine,
  deleteColumn,
  editColumnText,
  editNoteFret,
  insertColumn,
  insertLine,
  insertNote,
  removeNote,
  setBarline,
} from '../../domain/tabulature/model';
import type { HistoryStep } from './history';
import { emptyHistory, popRedo, popUndo, pushSnapshot } from './history';
import type { ApplyResult, EditorIntent, EditorState, MutationIntent, Selection } from './types';

// ─── Начальное состояние ────────────────────────────────────────────────────

/**
 * Начальное состояние редактора (№38, №40): тетрадь и режим задаёт вызывающая
 * сторона — новая тетрадь открывается сразу в правке, существующая — в чтении;
 * выделение пустое, предупреждений нет, история пуста.
 */
export function initialEditorState(notebook: Notebook, mode: EditorState['mode']): EditorState {
  return {
    notebook,
    mode,
    selection: null,
    warning: null,
    history: emptyHistory(),
  };
}

// ─── Диспетчер мутаций ──────────────────────────────────────────────────────

/**
 * Одна мутация модели по интенту — стадия 3 EXECUTE (data-flow.md): чистый
 * вызов домена, ошибки — значения. Цели заданы явными id; id-генератор
 * передаётся явно (R6) — свежие сущности получают свежие id (№19).
 * Аргументы, известные контроллеру, валидируются до фабрик строк (тур-3
 * ревью ST-5, находка 2а; columnCount — с тур-2 находки 5): отказ вставки
 * строки не сжигает выданные id — фабрика при отказе не вызывается вовсе.
 */
/**
 * Контракт позиции insertLine — целое в 0..lines.length — поднят в контроллер
 * (тур-3 ревью ST-5, находка 2а): обе фабрики строк вызываются только после
 * проверки позиции, чтобы отказ вставки не сжигал выданные id. Проверка
 * дублирует insertLine (модель валидирует после фабрики) — копия контракта
 * принята сознательно, вариантом «а» ревью.
 */
function positionOutOfRange(notebook: Notebook, position: number): ModelResult<Notebook> | null {
  if (Number.isInteger(position) && position >= 0 && position <= notebook.lines.length) {
    return null;
  }
  return {
    ok: false,
    error: {
      code: 'position-out-of-range',
      message: `позиция ${String(position)} вне диапазона 0..${String(notebook.lines.length)} (№36)`,
    },
  };
}

function runMutation(
  notebook: Notebook,
  intent: MutationIntent,
  gen: IdGenerator,
): ModelResult<Notebook> {
  switch (intent.type) {
    case 'insert-note':
      return insertNote(
        notebook,
        { lineId: intent.lineId, columnId: intent.columnId, stringIndex: intent.stringIndex },
        intent.fret,
        gen,
      );
    case 'edit-note':
      return editNoteFret(
        notebook,
        { lineId: intent.lineId, columnId: intent.columnId, stringIndex: intent.stringIndex },
        intent.fret,
      );
    case 'delete-note':
      return removeNote(notebook, {
        lineId: intent.lineId,
        columnId: intent.columnId,
        stringIndex: intent.stringIndex,
      });
    case 'set-barline':
      return setBarline(notebook, intent.lineId, intent.columnId);
    case 'insert-column':
      return insertColumn(notebook, intent.lineId, intent.columnId, intent.side, gen);
    case 'clear-column':
      return clearColumn(notebook, intent.lineId, intent.columnId);
    case 'delete-column':
      return deleteColumn(notebook, intent.lineId, intent.columnId);
    case 'add-column-text':
      return addColumnText(notebook, intent.lineId, intent.columnId, intent.text, gen);
    case 'edit-column-text':
      return editColumnText(notebook, intent.lineId, intent.textId, intent.text);
    case 'insert-tab-line': {
      // Контракты columnCount и позиции валидирует контроллер до фабрики
      // (тур-2 ревью ST-5, находка 5; тур-3 находка 2а): createTabLine
      // columnCount не проверяет — NaN дал бы «успешную» строку без колонок,
      // позицию проверяет insertLine, но уже после фабрики. Обе проверки до
      // createTabLine: на отказе не сгорают выданные id. Скрытую возможность
      // UI гарантирует Math.max(1, systemCapacity(...)); intent —
      // транспортный вход.
      if (!Number.isInteger(intent.columnCount) || intent.columnCount < 0) {
        return {
          ok: false,
          error: {
            code: 'invalid-notebook',
            message: `columnCount таб-строки — целое ≥ 0, получено ${intent.columnCount}`,
          },
        };
      }
      const refusedPosition = positionOutOfRange(notebook, intent.position);
      if (refusedPosition !== null) {
        return refusedPosition;
      }
      const line: TabLine = createTabLine(intent.columnCount, gen);
      return insertLine(notebook, line, intent.position);
    }
    case 'insert-text-line': {
      // Та же дисциплина, что у таб-строки (2а): позиция до createTextLine —
      // отказ вставки не сжигает id строки.
      const refusedPosition = positionOutOfRange(notebook, intent.position);
      if (refusedPosition !== null) {
        return refusedPosition;
      }
      const line = createTextLine(intent.text, gen);
      return insertLine(notebook, line, intent.position);
    }
  }
}

// ─── Санитизация выделения (ревью ST-5, находка 5в) ─────────────────────────

/**
 * Стирает ссылки выделения, не резолвящиеся в получившейся тетради:
 * undo/redo откатил строку или колонку, мутация удалила цель — до экрана
 * не доходит «призрачное» выделение, меню которого действует по
 * несуществующим id. Валидное выделение сохраняется: undo вставки строки
 * не гасит панели, если выбранная ячейка жива. Undo и redo симметричны.
 * Ячейка жива, только если её струна существует (тур-3 ревью ST-5,
 * находка 1а): stringIndex вне tuning строки стирает выделение — иначе
 * панель ладов оставалась бы над несуществующей струной и каждое её
 * действие давало бы string-index-out-of-range. На текущем коде сценарий
 * недостижим (tuning постоянен, строки не редактируются) — проверка
 * страхует этап 6 (редактирование строк).
 */
function sanitizeSelection(notebook: Notebook, selection: Selection | null): Selection | null {
  if (selection === null) {
    return null;
  }
  const line = notebook.lines.find((l) => l.id === selection.lineId);
  if (line === undefined || line.kind !== 'tab') {
    return null;
  }
  const column = line.columns.find((c) => c.id === selection.columnId);
  if (column === undefined) {
    return null;
  }
  if (selection.kind === 'cell' && selection.stringIndex >= line.tuning.length) {
    return null;
  }
  return selection;
}

// ─── Конвейер applyIntent ───────────────────────────────────────────────────

/**
 * Применяет интент к состоянию редактора — конвейер этапа 5:
 *
 *   интент → гейтинг режима (№40) → мутация модели → push undo (№25) →
 *   → сброс redo (№37) → эффект кармана (№26).
 *
 * - В режиме чтения все интенты игнорируются без ошибок (№40); undo/redo
 *   разрешены — тулбар (№37) доступен в обоих режимах.
 * - Отказ мутации (ModelResult err) не меняет тетрадь, не пишет историю,
 *   не пишет карман; предупреждение кладётся в состояние.
 * - Успешная мутация снимает прежнее предупреждение; выделение Entry-уровень
 *   меняет по тапам, а конвейер только санитизирует: ссылки на строки и
 *   колонки, не существующие в получившейся тетради (откат undo/redo,
 *   удаление цели), стираются до доставки на экран — undo и redo симметричны
 *   (ревью ST-5, находка 5в).
 * - undo/redo обслуживает история (№25, №37): откат не толкает снимок, но
 *   меняет модель — карман следует за тетрадью и на откате (№26, pocket.md):
 *   отменённое действие не должно воскреснуть после крэша/kill процесса.
 *
 * Чистая функция: состояние не мутирует, эффекты возвращаются списком —
 * их исполняет Entry-уровень.
 */
export function applyIntent(
  state: EditorState,
  intent: EditorIntent,
  gen: IdGenerator,
): ApplyResult {
  // Гейтинг режима (№40): ввод игнорируется, тулбар живёт (№37).
  const isHistoryIntent = intent.type === 'undo' || intent.type === 'redo';
  if (state.mode === 'read' && !isHistoryIntent) {
    return { state, effects: [] };
  }

  const cleared: EditorState = { ...state, warning: null };

  if (intent.type === 'undo' || intent.type === 'redo') {
    // Ветки симметричны (13а ревью ST-5): направление задаёт pop,
    // дальше — общий конвейер «снимок → санитизация → карман (№26)».
    const pop = intent.type === 'undo' ? popUndo : popRedo;
    const step: HistoryStep | null = pop(state.history, state.notebook);
    if (step === null) {
      return { state, effects: [] };
    }
    return {
      state: {
        ...cleared,
        notebook: step.notebook,
        history: step.history,
        selection: sanitizeSelection(step.notebook, state.selection),
      },
      effects: [{ kind: 'write-pocket', notebook: step.notebook }],
    };
  }

  // Снимок ДО мутации (№25) — та же ссылка, что ляжет в историю.
  const snapshot = state.notebook;

  const result = runMutation(state.notebook, intent, gen);
  if (!result.ok) {
    // Отказ: тетрадь, история и карман не тронуты; предупреждение в состоянии.
    return {
      state: { ...state, warning: { code: result.error.code } },
      effects: [],
    };
  }

  return {
    state: {
      ...cleared,
      notebook: result.value,
      history: pushSnapshot(state.history, snapshot),
      selection: sanitizeSelection(result.value, state.selection),
    },
    effects: [{ kind: 'write-pocket', notebook: result.value }],
  };
}
