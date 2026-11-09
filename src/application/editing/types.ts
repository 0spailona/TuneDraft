// Типы контроллера редактора (этап 5) — первый код слоя Application.
// Спеки: docs/specs/domains/editing/README.md (конвейер мутаций, №26),
// cell-and-column-menus.md (№21, №35), lines-and-gestures.md (№36, №25,
// №37, №40), docs/specs/architecture/data-flow.md (пятистадийный конвейер).
// Слой Application (R2): импортирует только Domain; карман автосохранения
// (№26, Infrastructure) достижим исключительно через объявленный здесь
// интерфейс PocketWriter — реализацию вводят на Entry-уровне (R3).

import type { EntityId, ModelErrorCode, Notebook } from '../../domain/tabulature/types';
import type { EditorHistory } from './history';

// ─── Режим и выделение (№40, №5, №35) ───────────────────────────────────────

/** Режим редактора (№40): 'read' — чтение, 'edit' — правка. */
export type EditMode = 'read' | 'edit';

/** Выделенная ячейка: пересечение струны и колонки таб-строки (№5, №20). */
export interface CellSelection {
  readonly kind: 'cell';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  readonly stringIndex: number;
}

/** Выделенная колонка (№35): тап по шапке колонки открывает меню колонки. */
export interface ColumnSelection {
  readonly kind: 'column';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
}

/** Выделение — ровно одна цель: ячейка или колонка (№5, №35). */
export type Selection = CellSelection | ColumnSelection;

// ─── Интенты: все операции этапа 5 + undo/redo тулбара (№37) ────────────────

/**
 * Намерение пользователя — транспортно-нейтральный вход конвейера
 * (data-flow.md: это уже результат стадии 2 PARSE & VALIDATE, выполненной
 * вызывающей стороной — hit-test тапа, панель ладов, меню). Цели операций
 * заданы явными id (R6): контроллер не читает «текущее выделение» —
 * выделение живёт в состоянии для UI, а не в разрешении операций.
 */
export type EditorIntent =
  | {
      /** Вставить ноту в пустую ячейку: свежий id, лад 0–24 (№21, №3, №4). */
      readonly type: 'insert-note';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
      readonly stringIndex: number;
      readonly fret: number;
    }
  | {
      /** Правка лада существующей ноты — id ноты сохраняется (№21). */
      readonly type: 'edit-note';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
      readonly stringIndex: number;
      readonly fret: number;
    }
  | {
      /** Удалить ноту: ячейка очищается и остаётся паузой (№21, №20). */
      readonly type: 'delete-note';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
      readonly stringIndex: number;
    }
  | {
      /** Черта: колонка без нот и текстов, иначе отказ (№18). */
      readonly type: 'set-barline';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
    }
  | {
      /** Вставить пустую колонку слева/справа от целевой (№35). */
      readonly type: 'insert-column';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
      readonly side: 'left' | 'right';
    }
  | {
      /** Очистить колонку: ноты и тексты уходят, колонка остаётся (№35). */
      readonly type: 'clear-column';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
    }
  | {
      /** Удалить колонку целиком, каскад текстов (№19, №35). */
      readonly type: 'delete-column';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
    }
  | {
      /** Добавить текст колонке: максимум 3, четвёртый — отказ (№6, №35). */
      readonly type: 'add-column-text';
      readonly lineId: EntityId;
      readonly columnId: EntityId;
      readonly text: string;
    }
  | {
      /** Править текст колонки — id текста сохраняется (№27, №35). */
      readonly type: 'edit-column-text';
      readonly lineId: EntityId;
      readonly textId: EntityId;
      readonly text: string;
    }
  | {
      /**
       * Вставить таб-строку (№36): position — 0..lines.length; columnCount —
       * ёмкость строки, её считает вызывающая сторона (layout/экран).
       * Контракт columnCount: целое ≥ 0 — нецелое и отрицательное контроллер
       * отклоняет с invalid-notebook до генерации id (2-й тур ревью ST-5,
       * находка 5).
       */
      readonly type: 'insert-tab-line';
      readonly position: number;
      readonly columnCount: number;
    }
  | {
      /** Вставить текст-строку (№36: кнопка «+» или лонг-тап пустого места). */
      readonly type: 'insert-text-line';
      readonly position: number;
      readonly text: string;
    }
  | {
      /** Отменить последнее действие: снимок тетради до мутации (№25, №37). */
      readonly type: 'undo';
    }
  | {
      /** Вернуть отменённое: восстановить последний отменённый снимок (№37). */
      readonly type: 'redo';
    };

/** Интенты-мутации: всё, кроме undo/redo — те обслуживает история (№25, №37). */
export type MutationIntent = Exclude<
  EditorIntent,
  { readonly type: 'undo' } | { readonly type: 'redo' }
>;

// ─── Предупреждение, эффекты, карман (№26) ──────────────────────────────────

/**
 * Предупреждение об отказанной операции — код ошибки модели (11а ревью
 * ST-5): экранного текста в состоянии нет, Entry мапит код в строку
 * словаря (№31), не зная, какая операция отказала. Доменный debug-текст
 * (ModelError.message) остаётся в домене и в UI-состояние не попадает.
 */
export interface EditorWarning {
  readonly code: ModelErrorCode;
}

/**
 * Эффект конвейера — побочное действие стадии 4 PERSIST (data-flow.md).
 * Единственный эффект этапа 5 — запись черновика в карман (№26); новые виды
 * побочных действий добавляются вариантами этого union.
 */
export type EditorEffect = {
  readonly kind: 'write-pocket';
  readonly notebook: Notebook;
};

/**
 * Запись черновика в карман автосохранения (№26) — единственная
 * инфраструктурная возможность контроллера редактора (R2-инверсия):
 * интерфейс объявлен потребителем, реализацию (expo-file-system, этап 7)
 * вводят на Entry-уровне (R3). Реализация обязана не бросать: отказ записи
 * не блокирует и не отменяет действие (спека pocket.md).
 */
export interface PocketWriter {
  write(notebook: Notebook): void;
}

/** Состояние редактора — единственный источник истины для Entry-уровня. */
export interface EditorState {
  readonly notebook: Notebook;
  readonly mode: EditMode;
  /** Выделение для UI; операции ссылаются на цели по явным id. */
  readonly selection: Selection | null;
  /** Последнее предупреждение об отказе; успешное действие его снимает. */
  readonly warning: EditorWarning | null;
  /** История отмен (№25, №37) — см. history.ts. */
  readonly history: EditorHistory;
}

/** Результат applyIntent: новое состояние + эффекты стадии PERSIST. */
export interface ApplyResult {
  readonly state: EditorState;
  readonly effects: readonly EditorEffect[];
}
