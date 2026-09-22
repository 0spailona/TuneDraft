// Юнит-тесты шага EMIT (этап 3, №34): координаты систем — x-офсеты колонок
// накапливаемой суммой ширин (№20), x текста = x его колонки-владельца и стопка
// текстов под таб-строкой (№24), y строк струн из tuning модели (№2) — и связка
// MEASURE → WRAP → EMIT (layoutTabLine, layoutNotebook): текст переезжает вместе
// со своей колонкой при переносе (№24), каждая строка раскладывается независимо
// (№28), повторный прогон на тех же входах даёт идентичную геометрию (№14).
// Данные синтетические: таб-строки и текст-строки модели.

import type { Column, ColumnText, Notebook, Note, TabLine, TextLine } from '../../tabulature/types';
import { DEFAULT_DURATION, DEFAULT_TUNING } from '../../tabulature/types';
import { MIN_COLUMN_WIDTH_CHARS, ROW_SPACING_CHARS, TEXT_ROW_SPACING_CHARS } from '../config';
import { emitStringYChars, emitSystem, layoutNotebook, layoutTabLine } from '../emit';
import { systemCapacity } from '../measure';
import type { LaidOutSystem } from '../types';

// ─── Помощники ──────────────────────────────────────────────────────────────

/** Счётчик id нот: детерминированные идентификаторы note-1, note-2, … (№19). */
let nextNoteId = 0;

/** Нота с детерминированным id (№19); параметры по умолчанию — для простоты. */
function note(stringIndex = 0, fret = 1): Note {
  nextNoteId += 1;
  return { id: `note-${nextNoteId}`, stringIndex, fret, duration: DEFAULT_DURATION };
}

/** Контентная колонка с нотами (№18, №20); тексты живут в line.texts (№35). */
function content(id: string, notes: readonly Note[] = []): Column {
  return { id, kind: 'content', notes: [...notes] };
}

/** Колонка-черта: вертикальная линия, без нот (№18). */
function barline(id: string): Column {
  return { id, kind: 'barline', notes: [] };
}

/** Текст колонки (№19, №35): привязка по columnId, не по позиции. */
function colText(id: string, columnId: string, text: string): ColumnText {
  return { id, columnId, text };
}

/** Таб-строка модели (№6, №20): колонки, строй, тексты колонок. */
function tabLine(
  id: string,
  columns: readonly Column[],
  texts: readonly ColumnText[] = [],
): TabLine {
  return { kind: 'tab', id, columns: [...columns], tuning: [...DEFAULT_TUNING], texts: [...texts] };
}

/** Текст-строка модели (№6): pass-through для движка. */
function textLine(id: string, text: string): TextLine {
  return { kind: 'text', id, text };
}

/**
 * Инвариант №24 для всех систем: x каждого текста равен x его колонки-владельца,
 * а сама колонка есть в этой системе (текст не может остаться без колонки).
 */
function expectTextsAlignedWithColumns(systems: readonly LaidOutSystem[]): void {
  for (const system of systems) {
    const xOf = new Map(system.columns.map((col) => [col.columnId, col.xChars]));
    for (const text of system.texts) {
      const columnX = xOf.get(text.columnId);
      expect(columnX).toBeDefined();
      expect(text.xChars).toBe(columnX);
    }
  }
}

/** y нижней строки струн: (число струн − 1) · ROW_SPACING_CHARS (№2). */
const BOTTOM_STRING_Y = (DEFAULT_TUNING.length - 1) * ROW_SPACING_CHARS;

// ─── (a) y строк струн — из tuning модели (№2) ──────────────────────────────

describe('(a) y строк струн: stringYChars[i] = i · ROW_SPACING_CHARS (№2)', () => {
  it('базовый строй (4 струны): длина == tuning.length, значения 0, 2, 4, 6', () => {
    const stringY = emitStringYChars(DEFAULT_TUNING);
    expect(stringY).toHaveLength(DEFAULT_TUNING.length);
    expect([...stringY]).toEqual([0, 2, 4, 6]);
    expect([...stringY]).toEqual(DEFAULT_TUNING.map((_, i) => i * ROW_SPACING_CHARS));
  });

  it('пятая струна (low B): строй из 5 записей → 5 строк без правок движка (№2)', () => {
    const fiveString = [...DEFAULT_TUNING, 35];
    const stringY = emitStringYChars(fiveString);
    expect(stringY).toHaveLength(5);
    expect([...stringY]).toEqual([0, 2, 4, 6, 8]);
  });

  it('layout таб-строки несёт stringCount и stringYChars длины tuning (№2)', () => {
    const layout = layoutTabLine(tabLine('line-1', [content('c-1', [note()])]), 100);
    expect(layout.stringCount).toBe(DEFAULT_TUNING.length);
    expect(layout.stringYChars).toHaveLength(layout.stringCount);
    expect([...layout.stringYChars]).toEqual([
      0,
      ROW_SPACING_CHARS,
      2 * ROW_SPACING_CHARS,
      3 * ROW_SPACING_CHARS,
    ]);
  });
});

// ─── (b) x-офсеты колонок системы — сумма ширин (№20) ───────────────────────

describe('(b) x колонок — накапливаемая сумма ширин (№20)', () => {
  it('колонки идут слева направо: x = сумма ширин предыдущих (№20)', () => {
    const layout = layoutTabLine(
      tabLine('line-1', [content('c-1', [note()]), content('c-2', [note()]), barline('b-1')]),
      100,
    );
    expect(layout.systems).toHaveLength(1);
    const system = layout.systems[0];
    expect(system.index).toBe(0);
    expect(system.columns.map((col) => col.xChars)).toEqual([
      0,
      MIN_COLUMN_WIDTH_CHARS,
      2 * MIN_COLUMN_WIDTH_CHARS,
    ]);
    expect(system.columns.map((col) => col.widthChars)).toEqual([4, 4, 4]);
  });

  it('колонка раздвинулась под текст → следующие колонки сдвинулись (№20, №24)', () => {
    // Текст «тоника» (6 символов) растит первую колонку с 4 до 6 (№20):
    // x второй колонки — 6, x черты — 10, а не 4 и 8.
    const layout = layoutTabLine(
      tabLine(
        'line-1',
        [content('c-1'), content('c-2', [note()]), barline('b-1')],
        [colText('t-1', 'c-1', 'тоника')],
      ),
      100,
    );
    const system = layout.systems[0];
    expect(system.columns.map((col) => [col.xChars, col.widthChars])).toEqual([
      [0, 6],
      [6, 4],
      [10, 4],
    ]);
  });

  it('ширина системы — полоса MEASURE (85% целевой ширины, №20)', () => {
    const layout = layoutTabLine(tabLine('line-1', [content('c-1', [note()])]), 100);
    expect(layout.systems[0].widthChars).toBe(systemCapacity(100).stripWidthChars);
    expect(layout.systems[0].widthChars).toBe(85);
  });
});

// ─── (c) Тексты под таб-строкой — стопкой, x = x колонки (№24) ──────────────

describe('(c) тексты: x текста = x его колонки, стопка под строками струн (№24)', () => {
  it('x текста == x его колонки в каждой системе (№24)', () => {
    const layout = layoutTabLine(
      tabLine(
        'line-1',
        [content('c-1'), content('c-2', [note()]), barline('b-1'), content('c-3')],
        [colText('t-1', 'c-1', 'тоника'), colText('t-2', 'c-3', 'G')],
      ),
      100,
    );
    expectTextsAlignedWithColumns(layout.systems);
    // c-1 раздвинулась до 6 («тоника», №20): x = 0, 6, 10, 14; «G» на c-3 — при x=14.
    expect(layout.systems[0].texts.map((text) => [text.textId, text.xChars])).toEqual([
      ['t-1', 0],
      ['t-2', 14],
    ]);
  });

  it('тексты одной колонки и соседней — общая стопка: y растёт по строке на текст', () => {
    // c-1 с текстами «G», «Am» (строки стопки 0 и 1), c-2 с текстом «D» (строка 2).
    const layout = layoutTabLine(
      tabLine(
        'line-1',
        [content('c-1'), content('c-2', [note()])],
        [colText('t-1', 'c-1', 'G'), colText('t-2', 'c-1', 'Am'), colText('t-3', 'c-2', 'D')],
      ),
      100,
    );
    const system = layout.systems[0];
    expect(system.texts.map((text) => [text.textId, text.xChars, text.yChars])).toEqual([
      ['t-1', 0, BOTTOM_STRING_Y + TEXT_ROW_SPACING_CHARS],
      ['t-2', 0, BOTTOM_STRING_Y + 2 * TEXT_ROW_SPACING_CHARS],
      ['t-3', MIN_COLUMN_WIDTH_CHARS, BOTTOM_STRING_Y + 3 * TEXT_ROW_SPACING_CHARS],
    ]);
  });

  it('стопка начинается ниже нижней строки струн: y > y последней струны (№24)', () => {
    const layout = layoutTabLine(
      tabLine('line-1', [content('c-1')], [colText('t-1', 'c-1', 'G')]),
      100,
    );
    for (const text of layout.systems[0].texts) {
      expect(text.yChars).toBeGreaterThan(BOTTOM_STRING_Y);
    }
  });
});

// ─── (d) Текст едет с колонкой при переносе (№24, №18, №36) ────────────────

describe('(d) перенос: текст появляется в системе, содержащей его колонку (№24)', () => {
  // Строка из трёх тактов, 8 колонок × 4 символа = 32 > полосы 22 (W=26):
  // m1 = [c-1, c-2, b-1] (12), m2 = [c-3, c-4, b-2] (12), m3 = [c-5, c-6] (8).
  // Жадный перенос: система 1 = m1 (12 ≤ 22; +m2 = 24 > 22); система 2 =
  // m2 + m3 (12 + 8 = 20 ≤ 22).
  function wrappingLine(): TabLine {
    return tabLine(
      'line-1',
      [
        content('c-1', [note()]),
        content('c-2', [note()]),
        barline('b-1'),
        content('c-3', [note()]),
        content('c-4', [note()]),
        barline('b-2'),
        content('c-5', [note()]),
        content('c-6', [note()]),
      ],
      [colText('t-1', 'c-1', 'Am'), colText('t-2', 'c-5', 'G')],
    );
  }

  it('строка рвётся на две системы по границе такта (№18, №36)', () => {
    const layout = layoutTabLine(wrappingLine(), 26);
    expect(layout.systems).toHaveLength(2);
    expect(layout.systems[0].columns.map((col) => col.columnId)).toEqual(['c-1', 'c-2', 'b-1']);
    expect(layout.systems[1].columns.map((col) => col.columnId)).toEqual([
      'c-3',
      'c-4',
      'b-2',
      'c-5',
      'c-6',
    ]);
  });

  it('текст колонки системы 1 — в системе 1, колонки системы 2 — в системе 2 (№24)', () => {
    const layout = layoutTabLine(wrappingLine(), 26);
    const [first, second] = layout.systems;

    // «Am» стоит на c-1 → едет в систему 1 (x c-1 = 0), в систему 2 не попадает.
    expect(first.texts.map((text) => text.textId)).toEqual(['t-1']);
    expect(first.texts[0].columnId).toBe('c-1');
    expect(first.texts[0].xChars).toBe(first.columns[0].xChars);
    expect(second.texts.map((text) => text.textId)).not.toContain('t-1');

    // «G» стоит на c-5 → переезжает вместе с колонкой в систему 2: x c-5 = 12
    // (c-3: 0, c-4: 4, b-2: 8, c-5: 12), а не x начала системы.
    expect(second.texts.map((text) => text.textId)).toEqual(['t-2']);
    expect(second.texts[0].columnId).toBe('c-5');
    const c5 = second.columns.find((col) => col.columnId === 'c-5');
    expect(c5?.xChars).toBe(12);
    expect(second.texts[0].xChars).toBe(c5?.xChars);
    expect(first.texts.map((text) => text.textId)).not.toContain('t-2');
  });

  it('инвариант №24 держится на переносе: x текста == x его колонки во всех системах', () => {
    expectTextsAlignedWithColumns(layoutTabLine(wrappingLine(), 26).systems);
  });
});

// ─── (e) Связка прохода: пустая строка, текст-строка, порядок ленты (№6) ────

describe('(e) проход по тетради: пустая строка, pass-through, порядок ленты (№6, №28)', () => {
  it('пустая таб-строка → одна пустая система, минимум одна (№20)', () => {
    const layout = layoutTabLine(tabLine('line-1', []), 100);
    expect(layout.systems).toHaveLength(1);
    expect(layout.systems[0].columns).toEqual([]);
    expect(layout.systems[0].texts).toEqual([]);
    expect(layout.stringYChars).toHaveLength(DEFAULT_TUNING.length);
  });

  it('emitSystem на сыром входе WRAP: x-сумма и y стопки (№20, №24)', () => {
    const system = emitSystem({
      index: 0,
      columnIds: ['a', 'b'],
      widths: new Map([
        ['a', 4],
        ['b', 6],
      ]),
      texts: [colText('t-1', 'b', 'xx')],
      stripWidthChars: 85,
      stringCount: DEFAULT_TUNING.length,
    });
    expect(system.columns).toEqual([
      { columnId: 'a', xChars: 0, widthChars: 4 },
      { columnId: 'b', xChars: 4, widthChars: 6 },
    ]);
    expect(system.texts).toEqual([
      {
        textId: 't-1',
        columnId: 'b',
        xChars: 4,
        yChars: BOTTOM_STRING_Y + TEXT_ROW_SPACING_CHARS,
      },
    ]);
  });

  it('текст-строка — pass-through, порядок ленты сохранён (№6)', () => {
    const notebook: Notebook = {
      version: 1,
      id: 'nb-1',
      name: 'Тетрадь',
      albumId: null,
      lines: [
        tabLine('line-1', [content('c-1', [note()])]),
        textLine('tx-1', 'Интро'),
        tabLine('line-2', []),
      ],
    };
    const layout = layoutNotebook(notebook, 100);
    expect(layout.ribbon.map((entry) => entry.kind)).toEqual(['tab', 'text', 'tab']);
    expect(layout.ribbon[0].lineId).toBe('line-1');
    expect(layout.ribbon[1]).toEqual({ kind: 'text', lineId: 'tx-1', text: 'Интро' });
    expect(layout.ribbon[2].lineId).toBe('line-2');
  });
});

// ─── (f) Детерминизм (№14) ─────────────────────────────────────────────────

describe('(f) детерминизм: повторный прогон — идентичный результат (№14)', () => {
  it('layoutNotebook на тех же входах даёт deep-equal структуру (№14)', () => {
    const notebook: Notebook = {
      version: 1,
      id: 'nb-1',
      name: 'Тетрадь',
      albumId: null,
      lines: [
        wrappingLineOf(note),
        textLine('tx-1', 'Припев'),
        tabLine(
          'line-2',
          [content('c-1', [note()]), content('c-2', [note()])],
          [colText('t-1', 'c-1', 'тоника')],
        ),
      ],
    };
    const first = layoutNotebook(notebook, 100);
    const second = layoutNotebook(notebook, 100);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('layoutTabLine тоже детерминирован: две системы, тексты, y струн (№14)', () => {
    const line = tabLine(
      'line-1',
      [
        content('c-1', [note()]),
        content('c-2', [note()]),
        barline('b-1'),
        content('c-3', [note()]),
      ],
      [colText('t-1', 'c-3', 'G')],
    );
    expect(layoutTabLine(line, 100)).toEqual(layoutTabLine(line, 100));
  });
});

/** Такт-строка из сценария (d) — переиспользуется тестом детерминизма. */
function wrappingLineOf(noteFactory: typeof note): TabLine {
  return tabLine(
    'line-1',
    [
      content('c-1', [noteFactory()]),
      content('c-2', [noteFactory()]),
      barline('b-1'),
      content('c-3', [noteFactory()]),
      content('c-4', [noteFactory()]),
      barline('b-2'),
      content('c-5', [noteFactory()]),
      content('c-6', [noteFactory()]),
    ],
    [colText('t-1', 'c-1', 'Am'), colText('t-2', 'c-5', 'G')],
  );
}
