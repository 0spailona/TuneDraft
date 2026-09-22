// Шаг EMIT прохода layout-движка (этап 3 дорожной карты, КАРТА §3): координаты
// систем — x-офсеты колонок, y-координаты строк струн, позиции текстов под
// таб-строкой. Спека: docs/specs/domains/layout-engine.md (Flow, шаг 3 EMIT,
// Core Types) и решения №20, №24, №2.
//
// Здесь же — связка всего прохода MEASURE → WRAP → EMIT (layoutTabLine) и
// проход по всей тетради (layoutNotebook): ширины колонок считаются в measure.ts
// (№20, №24), системы нарезаются в wrap.ts (№18, №36), координаты выдаются здесь.
//
// Слой Domain (R1): чистые детерминированные функции — без I/O, случайности,
// времени и фреймворков (№14); единица всех координат и ширин — символ (№32),
// поэтому результат не зависит от рендерера (№23). Модель не меняется (№23):
// проход читает её и строит новое значение-геометрию.

import type { ColumnText, EntityId, Notebook, TabLine, TextLine } from '../tabulature/types';
import { ROW_SPACING_CHARS, TEXT_ROW_SPACING_CHARS } from './config';
import { columnWidthChars, systemCapacity } from './measure';
import { wrapTabLine, type WrapColumn } from './wrap';
import type {
  LaidOutColumn,
  LaidOutColumnText,
  LaidOutSystem,
  NotebookLayout,
  RibbonLayoutEntry,
  TabLineLayout,
  TextLineLayout,
} from './types';

/**
 * Вход шага EMIT для одной системы: результат WRAP (список columnId) плюс
 * всё, что нужно для координат — ширины MEASURE, тексты модели и метрики строк.
 */
export interface EmitSystemInput {
  /** Порядковый номер системы внутри таб-строки: 0, 1, 2… */
  readonly index: number;
  /** Колонки системы в порядке модели (результат шага WRAP, wrap.ts). */
  readonly columnIds: readonly EntityId[];
  /** Ширины колонок в символах по columnId (шаг MEASURE, №20/№24). */
  readonly widths: ReadonlyMap<EntityId, number>;
  /** Все тексты таб-строки в порядке модели (№35); выбираются по columnId. */
  readonly texts: readonly ColumnText[];
  /** Ширина полосы систем, в символах (№20): выдаётся в LaidOutSystem как есть. */
  readonly stripWidthChars: number;
  /** Число строк струн — длина tuning модели (№2); от неё — y стопки текстов. */
  readonly stringCount: number;
}

/**
 * y строк струн таб-строки (№2): stringY[i] = i · ROW_SPACING_CHARS — список
 * выводится из tuning модели, поэтому пятая струна (low B) не требует правок
 * движка (№2). Вертикальные метрики ПРОБНЫЕ (provisional, №32).
 *
 * @param tuning строй таб-строки — список MIDI-нот (№2)
 * @returns y строк струн от верха таб-строки, в символах
 */
export function emitStringYChars(tuning: readonly number[]): readonly number[] {
  return tuning.map((_midi, stringIndex) => stringIndex * ROW_SPACING_CHARS);
}

/**
 * y строки текста в стопке под таб-строкой (№24): зазор TEXT_ROW_SPACING_CHARS
 * от нижней строки струн, дальше — по строке на каждый текст стопки. Стопка —
 * на всю систему (тексты всех её колонок), x каждой строки — x его колонки.
 * ПРОБНОЕ ЗНАЧЕНИЕ (provisional): финализируется на этапе 4 (№32).
 */
function textStackYChars(bottomStringYChars: number, row: number): number {
  return bottomStringYChars + (row + 1) * TEXT_ROW_SPACING_CHARS;
}

/**
 * Разложение одной системы (№20): x колонок — накапливаемая сумма ширин слева
 * направо, начиная с 0; x текста — x его колонки-владельца (№24: текст едет под
 * таб-строкой вместе с колонкой, которая под него раздвинулась); тексты — стопкой
 * под строками струн (№24, №6: до 3 на колонку). В систему попадают тексты
 * именно её колонок — при переносе текст переезжает в ту же систему, что и
 * колонка (№24). Ширины не пересчитываются: они приходят из шага MEASURE.
 *
 * @param input см. EmitSystemInput
 * @returns система с координатами (LaidOutSystem, types.ts)
 */
export function emitSystem(input: EmitSystemInput): LaidOutSystem {
  // Колонки: x накапливаемой суммой ширин (№20) — детерминированно (№14),
  // порядок систем WRAP = порядок модели.
  const columns: LaidOutColumn[] = [];
  let xChars = 0;
  for (const columnId of input.columnIds) {
    const widthChars = input.widths.get(columnId);
    if (widthChars === undefined) {
      // Внутренний контракт прохода (MEASURE → EMIT): ширина каждой колонки
      // посчитана раньше. Отсутствие — дефект вызова, а не доменный отказ
      // (ср. wrapTabLine).
      throw new Error(`emitSystem: нет ширины для колонки ${columnId}`);
    }
    columns.push({ columnId, xChars, widthChars });
    xChars += widthChars;
  }

  // Тексты (№24): обход колонок системы в порядке расклада; тексты каждой
  // колонки — в порядке модели (№35), один за другим в общую стопку системы.
  const bottomStringYChars = (input.stringCount - 1) * ROW_SPACING_CHARS;
  const texts: LaidOutColumnText[] = [];
  let row = 0;
  for (const column of columns) {
    for (const columnText of input.texts) {
      if (columnText.columnId !== column.columnId) {
        continue;
      }
      texts.push({
        textId: columnText.id,
        columnId: columnText.columnId,
        xChars: column.xChars,
        yChars: textStackYChars(bottomStringYChars, row),
      });
      row += 1;
    }
  }

  return { index: input.index, columns, texts, widthChars: input.stripWidthChars };
}

/**
 * Полный проход по одной таб-строке — связка MEASURE → WRAP → EMIT (№14, №20):
 * ширины колонок по текстам (№20, №24), нарезка систем по ёмкости полосы
 * (№18, №36), координаты систем и текстов (№24, №2). Детерминированная функция
 * (line, targetWidthChars): повторный вызов даёт идентичную геометрию (№14).
 *
 * @param line таб-строка модели (валидность предпоставлена, как в measure.ts)
 * @param targetWidthChars целевая ширина потребителя в символах (№23)
 * @returns разложенная таб-строка (TabLineLayout, types.ts)
 */
export function layoutTabLine(line: TabLine, targetWidthChars: number): TabLineLayout {
  // MEASURE (№20, №24) + вход переноса: пустая колонка — контентная без нот
  // и текстов (№20); черта не пуста по виду (№18) — линия рисуется всегда.
  const widths = new Map<EntityId, number>();
  const wrapColumns: WrapColumn[] = [];
  for (const column of line.columns) {
    const columnTexts = line.texts.filter((text) => text.columnId === column.id);
    widths.set(
      column.id,
      columnWidthChars(
        column,
        columnTexts.map((text) => text.text),
      ),
    );
    wrapColumns.push({
      columnId: column.id,
      kind: column.kind,
      isEmpty: column.kind === 'content' && column.notes.length === 0 && columnTexts.length === 0,
    });
  }

  // WRAP (№20, №18, №36): перенос идёт по ширине полосы в символах — той же
  // единице, что и ширины колонок (№32); capacityColumns (число минимальных
  // ячеек) — производная метрика, в сравнении ширин не участвует.
  const { stripWidthChars } = systemCapacity(targetWidthChars);
  const systems = wrapTabLine(wrapColumns, widths, stripWidthChars);

  // EMIT (№24, №2): координаты каждой системы независимо от остальных (№28).
  const stringYChars = emitStringYChars(line.tuning);
  return {
    lineId: line.id,
    stringCount: line.tuning.length,
    stringYChars,
    systems: systems.map((columnIds, index) =>
      emitSystem({
        index,
        columnIds,
        widths,
        texts: line.texts,
        stripWidthChars,
        stringCount: line.tuning.length,
      }),
    ),
  };
}

/**
 * Проход по текст-строке — pass-through (№6, №35): текст-строка не привязана
 * к нотам и колонкам, перенос — забота рендерера с пропорциональным шрифтом
 * (№32); движок лишь сохраняет позицию строки в ленте и сам текст.
 */
function layoutTextLine(line: TextLine): TextLineLayout & { readonly kind: 'text' } {
  return { kind: 'text', lineId: line.id, text: line.text };
}

/**
 * Полный проход движка по тетради (№14, №23): каждая строка ленты раскладывается
 * независимо от остальных (№28), порядок ленты сохранён (№6). Таб-строка —
 * связка MEASURE → WRAP → EMIT; текст-строка — pass-through (№6).
 *
 * @param notebook тетрадь — корневой агрегат модели (№22)
 * @param targetWidthChars целевая ширина потребителя в символах (№23)
 * @returns layout тетради (NotebookLayout, types.ts)
 */
export function layoutNotebook(notebook: Notebook, targetWidthChars: number): NotebookLayout {
  const ribbon: RibbonLayoutEntry[] = notebook.lines.map((line) => {
    if (line.kind === 'tab') {
      return { kind: 'tab', ...layoutTabLine(line, targetWidthChars) };
    }
    return layoutTextLine(line);
  });
  return { ribbon };
}
