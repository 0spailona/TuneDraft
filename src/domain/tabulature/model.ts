// Операции модели тетради (этап 2): чистые функции, иммутабельные обновления,
// ошибки — значения, не исключения (EXECUTE-конвенция data-flow.md).
// Инварианты и правила: docs/specs/domains/tabulature/notebook-model.md.
// Слой Domain (R1): без I/O и фреймворков; id-генератор передаётся явно (R6).
// Вставка/перемещение/удаление строк ленты — этап 6 (editing, №36);
// undo-история (№25) и запись в карман (№26) — Application/Infrastructure.

import type {
  Column,
  ColumnText,
  ModelErr,
  ModelError,
  ModelOk,
  ModelResult,
  Notebook,
  Note,
  RibbonLine,
  TabLine,
  TextLine,
} from './types';
import {
  DEFAULT_DURATION,
  DEFAULT_TUNING,
  FORMAT_VERSION,
  MAX_COLUMN_TEXTS,
  MAX_FRET,
  MIN_FRET,
} from './types';
import { createIdGenerator, type IdGenerator } from './ids';

// ─── Конструкторы результата ────────────────────────────────────────────────

function ok<T>(value: T): ModelOk<T> {
  return { ok: true, value };
}

function err(code: ModelError['code'], message: string): ModelErr {
  return { ok: false, error: { code, message } };
}

/** Генератор по умолчанию для фабрик; мутации требуют явный gen (R6). */
export const defaultIds = createIdGenerator;

// ─── Фабрики сущностей ──────────────────────────────────────────────────────

/** Создаёт тетрадь: version (№22), стабильный id (№29), пустая лента (№6). */
export function createNotebook(
  name: string,
  gen: IdGenerator = createIdGenerator(),
): Notebook {
  return {
    version: FORMAT_VERSION,
    id: gen('nb-'),
    name,
    albumId: null,
    lines: [],
  };
}

/**
 * Создаёт таб-строку из columnCount пустых контентных колонок (№20):
 * каждая ячейка — пауза. Ёмкость строки (сколько колонок влезает на экран)
 * считает вызывающая сторона — это layout/редактирование, не модель.
 */
export function createTabLine(
  columnCount: number,
  gen: IdGenerator = createIdGenerator(),
): TabLine {
  const columns: Column[] = [];
  for (let i = 0; i < columnCount; i++) {
    columns.push({ id: gen('c-'), kind: 'content', notes: [] });
  }
  return { kind: 'tab', id: gen('tl-'), columns, tuning: DEFAULT_TUNING, texts: [] };
}

/** Создаёт текст-строку (№6): многострочный текст, к нотам не привязан. */
export function createTextLine(
  text: string,
  gen: IdGenerator = createIdGenerator(),
): TextLine {
  return { kind: 'text', id: gen('tx-'), text };
}

/** Добавляет строку в конец ленты (для фикстур; вставка по позиции — этап 6). */
export function appendLine(notebook: Notebook, line: RibbonLine): Notebook {
  return { ...notebook, lines: [...notebook.lines, line] };
}

// ─── Внутренние помощники навигации ─────────────────────────────────────────

interface TabLineRef {
  line: TabLine;
  index: number;
}

function findTabLine(
  notebook: Notebook,
  lineId: string,
): ModelResult<TabLineRef> {
  const index = notebook.lines.findIndex((l) => l.id === lineId);
  if (index === -1) {
    return err('line-not-found', `строка «${lineId}» не найдена в ленте`);
  }
  const line = notebook.lines[index];
  if (line.kind !== 'tab') {
    return err('line-not-found', `строка «${lineId}» — не таб-строка`);
  }
  return ok({ line, index });
}

interface ColumnRef {
  line: TabLine;
  lineIndex: number;
  column: Column;
  columnIndex: number;
}

function findColumn(
  notebook: Notebook,
  lineId: string,
  columnId: string,
): ModelResult<ColumnRef> {
  const lineRes = findTabLine(notebook, lineId);
  if (!lineRes.ok) {
    return lineRes;
  }
  const { line, index: lineIndex } = lineRes.value;
  const columnIndex = line.columns.findIndex((c) => c.id === columnId);
  if (columnIndex === -1) {
    return err(
      'column-not-found',
      `колонка «${columnId}» не найдена в таб-строке «${lineId}»`,
    );
  }
  return ok({ line, lineIndex, column: line.columns[columnIndex], columnIndex });
}

/** Заменяет колонку на новую по индексу; возвращает обновлённую тетрадь. */
function replaceColumn(
  notebook: Notebook,
  ref: ColumnRef,
  column: Column,
): Notebook {
  const line: TabLine = {
    ...ref.line,
    columns: ref.line.columns.map((c, i) => (i === ref.columnIndex ? column : c)),
  };
  return replaceLine(notebook, ref.lineIndex, line);
}

function replaceLine(notebook: Notebook, index: number, line: RibbonLine): Notebook {
  return {
    ...notebook,
    lines: notebook.lines.map((l, i) => (i === index ? line : l)),
  };
}

/** Проверяет лад: целое в 0–24 (№3). */
function checkFret(fret: number): ModelErr | null {
  if (!Number.isInteger(fret) || fret < MIN_FRET || fret > MAX_FRET) {
    return err(
      'fret-out-of-range',
      `лад ${String(fret)} вне диапазона ${MIN_FRET}–${MAX_FRET} (№3)`,
    );
  }
  return null;
}

// ─── Ноты (№19, №20, №21) ───────────────────────────────────────────────────

export interface NoteTarget {
  readonly lineId: string;
  readonly columnId: string;
  readonly stringIndex: number;
}

/**
 * Вставляет ноту в пустую ячейку (№21): свежий id (№19), duration по
 * умолчанию — четверть (№4). Отказы: лад вне 0–24, струна вне строя,
 * ячейка занята (одна нота на струну в колонке, №20), колонка — черта (№18).
 */
export function insertNote(
  notebook: Notebook,
  target: NoteTarget,
  fret: number,
  gen: IdGenerator,
  duration: string = DEFAULT_DURATION,
): ModelResult<Notebook> {
  const fretErr = checkFret(fret);
  if (fretErr) {
    return fretErr;
  }
  const refRes = findColumn(notebook, target.lineId, target.columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  if (ref.column.kind === 'barline') {
    return err(
      'column-is-barline',
      `в колонку-черту «${target.columnId}» ноты не вставляются (№18)`,
    );
  }
  if (target.stringIndex < 0 || target.stringIndex >= ref.line.tuning.length) {
    return err(
      'string-index-out-of-range',
      `струна ${target.stringIndex} вне строя (${ref.line.tuning.length} струн)`,
    );
  }
  if (ref.column.notes.some((n) => n.stringIndex === target.stringIndex)) {
    return err(
      'cell-not-empty',
      `ячейка (колонка «${target.columnId}», струна ${target.stringIndex}) занята (№20)`,
    );
  }
  const note: Note = {
    id: gen('n-'),
    stringIndex: target.stringIndex,
    fret,
    duration,
  };
  return ok(
    replaceColumn(notebook, ref, {
      ...ref.column,
      notes: [...ref.column.notes, note],
    }),
  );
}

/**
 * Меняет лад существующей ноты — id сохраняется (№21). Отказы: лад вне 0–24,
 * нота не найдена (пустая ячейка), колонка — черта (№18, там нот нет).
 */
export function editNoteFret(
  notebook: Notebook,
  target: NoteTarget,
  fret: number,
): ModelResult<Notebook> {
  const fretErr = checkFret(fret);
  if (fretErr) {
    return fretErr;
  }
  const refRes = findColumn(notebook, target.lineId, target.columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  if (ref.column.kind === 'barline') {
    return err('column-is-barline', `в колонке-черте «${target.columnId}» нот нет (№18)`);
  }
  const note = ref.column.notes.find((n) => n.stringIndex === target.stringIndex);
  if (!note) {
    return err(
      'note-not-found',
      `в ячейке (колонка «${target.columnId}», струна ${target.stringIndex}) нет ноты`,
    );
  }
  return ok(
    replaceColumn(notebook, ref, {
      ...ref.column,
      notes: ref.column.notes.map((n) =>
        n.stringIndex === target.stringIndex ? { ...n, fret } : n,
      ),
    }),
  );
}

/**
 * Удаляет ноту: ячейка очищается и остаётся в сетке как пауза (№20, №21).
 * Колонка сохраняется. Отказ: ноты в ячейке нет.
 */
export function removeNote(
  notebook: Notebook,
  target: NoteTarget,
): ModelResult<Notebook> {
  const refRes = findColumn(notebook, target.lineId, target.columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  const has = ref.column.notes.some((n) => n.stringIndex === target.stringIndex);
  if (!has) {
    return err(
      'note-not-found',
      `в ячейке (колонка «${target.columnId}», струна ${target.stringIndex}) нет ноты`,
    );
  }
  return ok(
    replaceColumn(notebook, ref, {
      ...ref.column,
      notes: ref.column.notes.filter((n) => n.stringIndex !== target.stringIndex),
    }),
  );
}

// ─── Тактовые черты (№18, №35) ──────────────────────────────────────────────

/**
 * Превращает колонку в колонку-черту (№18): колонка обязана быть контентной,
 * без нот и без текстов (в черте текстов нет, №18; отказ вместо тихой потери).
 * Отказы: уже черта, колонка с нотами/текстами, не найдено.
 */
export function setBarline(
  notebook: Notebook,
  lineId: string,
  columnId: string,
): ModelResult<Notebook> {
  const refRes = findColumn(notebook, lineId, columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  if (ref.column.kind === 'barline') {
    return err('column-is-not-barline', `колонка «${columnId}» уже черта (№18)`);
  }
  if (ref.column.notes.length > 0) {
    return err(
      'barline-column-not-empty',
      `в колонке «${columnId}» есть ноты — черта заблокирована (№18)`,
    );
  }
  const textCount = ref.line.texts.filter((t) => t.columnId === columnId).length;
  if (textCount > 0) {
    return err(
      'barline-column-not-empty',
      `у колонки «${columnId}» ${textCount} текст(ов) — в черте текстов нет (№18)`,
    );
  }
  return ok(
    replaceColumn(notebook, ref, { id: ref.column.id, kind: 'barline', notes: [] }),
  );
}

/**
 * Снимает черту: остаётся обычная пустая контентная колонка (№35, №18).
 * Отказ: колонка не черта.
 */
export function clearBarline(
  notebook: Notebook,
  lineId: string,
  columnId: string,
): ModelResult<Notebook> {
  const refRes = findColumn(notebook, lineId, columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  if (ref.column.kind !== 'barline') {
    return err('column-is-barline', `колонка «${columnId}» не черта (№18)`);
  }
  return ok(
    replaceColumn(notebook, ref, { id: ref.column.id, kind: 'content', notes: [] }),
  );
}

// ─── Колонки (№35) ──────────────────────────────────────────────────────────

/**
 * Вставляет пустую контентную колонку слева/справа от целевой (№35).
 * Работает и рядом с колонкой-чертой (№35: вставка для черты — как обычно).
 */
export function insertColumn(
  notebook: Notebook,
  lineId: string,
  columnId: string,
  side: 'left' | 'right',
  gen: IdGenerator,
): ModelResult<Notebook> {
  const refRes = findColumn(notebook, lineId, columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  const at = side === 'left' ? ref.columnIndex : ref.columnIndex + 1;
  const columns = [...ref.line.columns];
  columns.splice(at, 0, { id: gen('c-'), kind: 'content', notes: [] });
  return ok(replaceLine(notebook, ref.lineIndex, { ...ref.line, columns }));
}

/**
 * Очищает контентную колонку: ноты и тексты удаляются, колонка остаётся (№35).
 * Для колонки-черты «очистить» = снять черту (№35, №18).
 */
export function clearColumn(
  notebook: Notebook,
  lineId: string,
  columnId: string,
): ModelResult<Notebook> {
  const refRes = findColumn(notebook, lineId, columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  if (ref.column.kind === 'barline') {
    return clearBarline(notebook, lineId, columnId);
  }
  const line: TabLine = {
    ...ref.line,
    columns: ref.line.columns.map((c, i) =>
      i === ref.columnIndex ? { ...c, notes: [] } : c,
    ),
    texts: ref.line.texts.filter((t) => t.columnId !== columnId),
  };
  return ok(replaceLine(notebook, ref.lineIndex, line));
}

/**
 * Удаляет колонку целиком — с нотами и текстами, каскад (№19, №35).
 * Тексты других колонок не задеты; текст-строки не задеты (№6).
 */
export function deleteColumn(
  notebook: Notebook,
  lineId: string,
  columnId: string,
): ModelResult<Notebook> {
  const refRes = findColumn(notebook, lineId, columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  const line: TabLine = {
    ...ref.line,
    columns: ref.line.columns.filter((c) => c.id !== columnId),
    texts: ref.line.texts.filter((t) => t.columnId !== columnId), // каскад (№19)
  };
  return ok(replaceLine(notebook, ref.lineIndex, line));
}

// ─── Тексты колонки (№6, №19, №35) ─────────────────────────────────────────

/**
 * Добавляет текст колонки: привязка по columnId (№19), максимум 3 на колонку
 * (№6) — 4-й отказывается (№35, по аналогии с №24: предупреждение, не обрезка).
 * В колонку-черту тексты не добавляются (№18).
 */
export function addColumnText(
  notebook: Notebook,
  lineId: string,
  columnId: string,
  text: string,
  gen: IdGenerator,
): ModelResult<Notebook> {
  const refRes = findColumn(notebook, lineId, columnId);
  if (!refRes.ok) {
    return refRes;
  }
  const ref = refRes.value;
  if (ref.column.kind === 'barline') {
    return err(
      'column-is-barline',
      `к колонке-черте «${columnId}» тексты не привязываются (№18)`,
    );
  }
  const count = ref.line.texts.filter((t) => t.columnId === columnId).length;
  if (count >= MAX_COLUMN_TEXTS) {
    return err(
      'column-text-limit',
      `у колонки «${columnId}» уже ${MAX_COLUMN_TEXTS} текста — максимум (№6)`,
    );
  }
  const columnText: ColumnText = { id: gen('t-'), columnId, text };
  return ok(
    replaceLine(notebook, ref.lineIndex, {
      ...ref.line,
      texts: [...ref.line.texts, columnText],
    }),
  );
}

/** Меняет содержимое текста колонки — id сохраняется (№27, №35). */
export function editColumnText(
  notebook: Notebook,
  lineId: string,
  textId: string,
  text: string,
): ModelResult<Notebook> {
  const lineRes = findTabLine(notebook, lineId);
  if (!lineRes.ok) {
    return lineRes;
  }
  const { line, index } = lineRes.value;
  const has = line.texts.some((t) => t.id === textId);
  if (!has) {
    return err('note-not-found', `текст «${textId}» не найден в таб-строке «${lineId}»`);
  }
  return ok(
    replaceLine(notebook, index, {
      ...line,
      texts: line.texts.map((t) => (t.id === textId ? { ...t, text } : t)),
    }),
  );
}

/** Убирает текст колонки (привязка удаляется, колонка остаётся). */
export function removeColumnText(
  notebook: Notebook,
  lineId: string,
  textId: string,
): ModelResult<Notebook> {
  const lineRes = findTabLine(notebook, lineId);
  if (!lineRes.ok) {
    return lineRes;
  }
  const { line, index } = lineRes.value;
  const has = line.texts.some((t) => t.id === textId);
  if (!has) {
    return err('note-not-found', `текст «${textId}» не найден в таб-строке «${lineId}»`);
  }
  return ok(
    replaceLine(notebook, index, {
      ...line,
      texts: line.texts.filter((t) => t.id !== textId),
    }),
  );
}

// ─── Валидация всего агрегата (№34: контракт юнит-тестов этапа 2) ───────────

/**
 * Проверяет инварианты тетради целиком (сводка валидации notebook-model.md):
 * fret 0–24; одна нота на струну в колонке; ≤ 3 текстов на колонку; черта
 * без нот и текстов; привязка текстов по существующему columnId; уникальность
 * и наличие id (№19); version/name/albumId у корня (№22, №29, №30).
 * Возвращает ok(true) либо invalid-notebook со списком всех нарушений.
 */
export function validateNotebook(notebook: Notebook): ModelResult<true> {
  const violations: string[] = [];

  if (typeof notebook.version !== 'number') {
    violations.push('version не число (№22)');
  }
  if (typeof notebook.id !== 'string' || notebook.id === '') {
    violations.push('id тетради пуст/не строка (№29)');
  }
  if (typeof notebook.name !== 'string') {
    violations.push('name не строка (№29)');
  }
  if (notebook.albumId !== null && typeof notebook.albumId !== 'string') {
    violations.push('albumId не строка и не null (№30)');
  }

  const seenIds = new Set<string>([notebook.id]);
  const checkId = (id: string, what: string): void => {
    if (typeof id !== 'string' || id === '') {
      violations.push(`${what} без id (№19)`);
      return;
    }
    if (seenIds.has(id)) {
      violations.push(`id «${id}» дублируется (№19)`);
      return;
    }
    seenIds.add(id);
  };

  if (!Array.isArray(notebook.lines)) {
    violations.push('lines не массив (№6)');
    return err('invalid-notebook', violations.join('; '));
  }

  for (const line of notebook.lines) {
    if (line.kind === 'tab') {
      // Таб-строка.
      checkId(line.id, 'таб-строка');
      if (!Array.isArray(line.tuning) || line.tuning.length === 0) {
        violations.push(`таб-строка «${line.id}»: строй пуст (№2)`);
      }
      if (!Array.isArray(line.columns)) {
        violations.push(`таб-строка «${line.id}»: columns не массив (№20)`);
        continue;
      }
      for (const column of line.columns) {
        checkId(column.id, 'колонка');
        if (column.kind !== 'content' && column.kind !== 'barline') {
          violations.push(`колонка «${column.id}»: вид не content/barline (№18)`);
          continue;
        }
        const notes = Array.isArray(column.notes) ? column.notes : [];
        const stringsSeen = new Set<number>();
        for (const note of notes) {
          checkId(note.id, 'нота');
          if (!Number.isInteger(note.fret) || note.fret < MIN_FRET || note.fret > MAX_FRET) {
            violations.push(`нота «${note.id}»: лад вне 0–${MAX_FRET} (№3)`);
          }
          if (stringsSeen.has(note.stringIndex)) {
            violations.push(
              `колонка «${column.id}»: две ноты на струне ${note.stringIndex} (№20)`,
            );
          }
          stringsSeen.add(note.stringIndex);
          if (note.stringIndex < 0 || note.stringIndex >= line.tuning.length) {
            violations.push(
              `нота «${note.id}»: струна вне строя (${note.stringIndex}, №20)`,
            );
          }
          if (typeof note.duration !== 'string' || note.duration === '') {
            violations.push(`нота «${note.id}»: нет duration (№4)`);
          }
        }
        if (column.kind === 'barline') {
          if (notes.length > 0) {
            violations.push(`колонка-черта «${column.id}» содержит ноты (№18)`);
          }
        }
      }
      const perColumn = new Map<string, number>();
      for (const text of line.texts) {
        checkId(text.id, 'текст колонки');
        if (!line.columns.some((c: Column) => c.id === text.columnId)) {
          violations.push(
            `текст «${text.id}»: columnId «${text.columnId}» не существует (№19)`,
          );
          continue;
        }
        const column = line.columns.find((c: Column) => c.id === text.columnId);
        if (column.kind === 'barline') {
          violations.push(`текст «${text.id}» привязан к черте «${column.id}» (№18)`);
        }
        const count = (perColumn.get(text.columnId) ?? 0) + 1;
        perColumn.set(text.columnId, count);
        if (count > MAX_COLUMN_TEXTS) {
          violations.push(
            `колонка «${text.columnId}»: больше ${MAX_COLUMN_TEXTS} текстов (№6)`,
          );
        }
      }
    } else if (line.kind === 'text') {
      // Текст-строка.
      checkId(line.id, 'текст-строка');
      if (typeof line.text !== 'string') {
        violations.push(`текст-строка «${line.id}»: text не строка (№6)`);
      }
    } else {
      violations.push(`строка «${String((line as { id?: string }).id)}»: неизвестный вид строки (№6)`);
    }
  }

  if (violations.length > 0) {
    return err('invalid-notebook', violations.join('; '));
  }
  return ok(true);
}
