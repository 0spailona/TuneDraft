// Модель тетради TuneDraft — чистые типы (этап 2 дорожной карты).
// Спека: docs/specs/domains/tabulature/notebook-model.md (сущности, инварианты).
// Слой Domain (R1): без I/O, фреймворков и инфраструктурных импортов.
// Модель хранит данные, а не координаты (№23); geometry — layout-движок (№14).

/** Стабильный идентификатор сущности: генерируется при создании, не меняется (№19). */
export type EntityId = string;

/**
 * Длительность ноты (№4): поле в модели с первого дня, по умолчанию — четверть.
 * Словарь значений финализируется вместе с палитрой длительностей после MVP,
 * поэтому тип открытый (alias string), а не закрытый union.
 */
export type Duration = string;

/** Длительность по умолчанию — четверть (№4). */
export const DEFAULT_DURATION: Duration = 'quarter';

/**
 * Версия формата JSON тетради (№22): страховка будущих миграций.
 * Определяется первым сериализатором (этап 2); миграции диспатчатся по этому полю.
 */
export const FORMAT_VERSION = 1;

/** Базовый строй v1: 4 струны E1–A1–D2–G2 как MIDI-ноты (№2). Расширяемо списком. */
export const DEFAULT_TUNING: readonly number[] = [28, 33, 38, 43];

/** Минимальный лад (открытая струна, №3). */
export const MIN_FRET = 0;
/** Максимальный лад (№3). */
export const MAX_FRET = 24;
/** Максимум текстов на колонку (№6, №24). */
export const MAX_COLUMN_TEXTS = 3;

/**
 * Нота: цифра лада на струне (№19, №3, №4). Живёт в контентной колонке,
 * максимум одна на струну в колонке (№20). Правка лада сохраняет id (№21).
 */
export interface Note {
  readonly id: EntityId;
  /** Индекс струны в списке настройки таб-строки, 0 = верхняя (E1 в v1). */
  readonly stringIndex: number;
  /** Лад: целое 0–24; 0 — открытая струна (№3). */
  readonly fret: number;
  /** Длительность (№4); всегда заполнена, по умолчанию quarter. */
  readonly duration: Duration;
}

/**
 * Текст колонки (№19, №35): привязан к колонке по columnId — не по позиции
 * и не к ноте. Максимум 3 на колонку (№6). В колонке-черте текстов нет (№18).
 */
export interface ColumnText {
  readonly id: EntityId;
  readonly columnId: EntityId;
  readonly text: string;
}

/**
 * Колонка (№18, №20): объединяет ячейки всех струн таб-строки; в колонке —
 * одновременно играемые ноты (аккорд), максимум одна нота на струну.
 * Ровно одно из двух состояний: контентная или колонка-черта (№18).
 * Колонка-черта — вертикальная линия через все струны, без нот и текстов.
 */
export interface Column {
  readonly id: EntityId;
  readonly kind: 'content' | 'barline';
  /** Ноты колонки (только у контентной; у черты всегда пусто, №18). */
  readonly notes: readonly Note[];
}

/**
 * Таб-строка (№6, №20): система табулатуры — сетка ячеек (струны × колонки).
 * Ячейка = пересечение струны и колонки; пустая ячейка — пауза (№20).
 * kind — дискриминант вида строки ленты (№6: ровно два вида).
 */
export interface TabLine {
  readonly kind: 'tab';
  readonly id: EntityId;
  readonly columns: readonly Column[];
  /** Строй: список MIDI-нот (№2); v1 — ровно 4 записи E1 A1 D2 G2. */
  readonly tuning: readonly number[];
  /**
   * Тексты колонок этой таб-строки (№35). Отдельный список, а не поле
   * колонки: текст привязан по columnId (№19), каскад удаления колонки
   * чистит его из этого списка (№19).
   */
  readonly texts: readonly ColumnText[];
}

/**
 * Текст-строка (№6): отдельная строка ленты, многострочный текст,
 * не привязан к нотам и колонкам. Количество и позиция не ограничены.
 */
export interface TextLine {
  readonly kind: 'text';
  readonly id: EntityId;
  readonly text: string;
}

/** Строка ленты — ровно один из двух видов (№6). */
export type RibbonLine = TabLine | TextLine;

/**
 * Тетрадь — корневой агрегат (№22, №29, №30). Сериализуется одним JSON-документом
 * `tet-<id>.json` (№29); id тетради стабилен и даёт имя файла.
 */
export interface Notebook {
  /** Версия формата JSON (№22). */
  readonly version: number;
  /** Стабильный id тетради — имя файла tet-<id>.json (№19, №29). */
  readonly id: EntityId;
  /** Видимое имя тетради — живёт только внутри JSON (№29). */
  readonly name: string;
  /** Альбом для группировки: с первого дня, альбомы — после MVP (№30). */
  readonly albumId: EntityId | null;
  /** Лента строк: таб- и текст-строки в любом порядке (№6). */
  readonly lines: readonly RibbonLine[];
}

/**
 * Уникальный тег результата операции: ok или код нарушения инварианта.
 * Коды, совпадающие текстуально, но возникшие в разных операциях, различаются
 * отдельными именами (barline-already-set / barline-not-set, а не общий
 * «column-is-barline» в двух смыслах): UI мапит код в сообщение, не зная,
 * какая операция его вернула.
 */
export type ModelErrorCode =
  | 'fret-out-of-range'
  | 'string-index-out-of-range'
  | 'line-not-found'
  | 'column-not-found'
  | 'note-not-found'
  | 'text-not-found'
  | 'cell-not-empty'
  | 'column-is-barline'
  | 'barline-already-set'
  | 'barline-not-set'
  | 'barline-column-not-empty'
  | 'column-text-limit'
  | 'invalid-notebook';

/**
 * Ошибка модели — значение, не исключение (EXECUTE-конвенция data-flow.md):
 * домен никогда не бросает через границы, UI мапит коды в свои сообщения.
 */
export interface ModelError {
  readonly code: ModelErrorCode;
  /** Человекочитаемое пояснение для логов/отладки; UI показывает своё. */
  readonly message: string;
}

/** Успех операции с полезной нагрузкой. */
export interface ModelOk<T> {
  readonly ok: true;
  readonly value: T;
}

/** Отказ операции с кодом нарушения. */
export interface ModelErr {
  readonly ok: false;
  readonly error: ModelError;
}

/** Результат доменной операции: ошибки пересекают границы как значения. */
export type ModelResult<T> = ModelOk<T> | ModelErr;

/** Свободная ячейка — пауза («не играть»), собственного id не несёт (№20). */
export interface Cell {
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  readonly stringIndex: number;
  readonly note: Note | null;
}
