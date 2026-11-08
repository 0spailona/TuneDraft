// Тесты плана отрисовки (этап 4, №34): детерминированность (повторный вызов —
// идентичный план, №14), цифра лада на пересечении струна×колонка (№20, №2),
// черта — вертикаль через все струны системы (№18), стопка текстов под нижней
// струной с x = x колонки-владельца (№24), перенос текст-строк measurer'ом
// (№6, ADR-0004 п. 4), окно — срез строк ленты (№28) и новая геометрия полей
// (№23, №7): центрирование таб-блока (leftOffset = (widthPx − (отступ+полоса))/2),
// симметрия полей, центрирование текст-строк по измеренной ширине, верхний
// отступ документа в heightPx, clamp сдвига ≥ 0 на узкой ширине.
// Данные: demoNotebookFixture (валидна по построению, №34) + детерминированный
// фейк-measurer (10 px за символ, без платформенных шрифтов). Константы
// геометрии — из systemCapacity фасада движка и темы, не хардкодом.

import type { Notebook } from '../../../domain/tabulature/types';
import {
  layoutNotebook,
  systemCapacity,
  TEXT_ROW_SPACING_CHARS,
} from '../../../domain/layout-engine';
import { demoNotebookFixture } from '../../../domain/layout-engine/fixtures';
import { createIdGenerator } from '../../../domain/tabulature/ids';
import { emptyNotebookFixture } from '../../../domain/tabulature/fixtures';
import { createTextLine, insertLine } from '../../../domain/tabulature/model';
import { buildNotebookDrawPlan } from '../plan';
import type { DrawPrimitive, SelectionTarget, TextLineMeasurer } from '../plan';
import { theme } from '../theme';

// ─── Помощники ──────────────────────────────────────────────────────────────

/** Фейк-measurer: пропорциональный шрифт без платформы — 10 px за символ. */
const fakeMeasurer: TextLineMeasurer = {
  measureTextWidthPx: (text) => text.length * 10,
};

const ADVANCE_PX = 10;
const LAYOUT_WIDTH_CHARS = 50; // полоса систем: floor(50 · 0.85) = 42 символа
const WIDTH_PX = 500;

/** Полоса систем в символах (№20): арифметика движка — floor(50 · 0.85) = 42. */
const STRIP_CHARS = systemCapacity(LAYOUT_WIDTH_CHARS).stripWidthChars;
/** Левый отступ под ключ (№36): theme.clefMarginChars · advance = 4 · 10 = 40 px. */
const CLEF_MARGIN_PX = theme.clefMarginChars * ADVANCE_PX;

/**
 * Единый сдвиг центрирования блока «отступ ключа + полоса» (№23) для
 * стандартного входа — та же арифметика, что в buildNotebookDrawPlan:
 * (500 − (4 + 42) · 10) / 2 = 20 px; полоса — из systemCapacity фасада
 * движка (не из запуска layout и не хардкодом геометрии).
 */
const LEFT_OFFSET_PX = (WIDTH_PX - (CLEF_MARGIN_PX + STRIP_CHARS * ADVANCE_PX)) / 2;

/** Стандартный вход тестов: demo-тетрадь, layout на 50 символов, план на 500 px. */
function buildDemoPlan(notebook: Notebook = demoNotebookFixture()) {
  const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
  const plan = buildNotebookDrawPlan(notebook, layout, {
    theme,
    advancePx: ADVANCE_PX,
    widthPx: WIDTH_PX,
    measurer: fakeMeasurer,
  });
  return { notebook, layout, plan };
}

/** Примитивы плана по виду, в порядке следования — с сужением типа по kind. */
function byKind<K extends DrawPrimitive['kind']>(
  primitives: readonly DrawPrimitive[],
  kind: K,
): Extract<DrawPrimitive, { kind: K }>[] {
  return primitives.filter(
    (primitive): primitive is Extract<DrawPrimitive, { kind: K }> => primitive.kind === kind,
  );
}

/** Ключ плана плана для сравнения на детерминированность (№14). */
function planKey(primitives: readonly DrawPrimitive[]): string {
  return JSON.stringify(primitives);
}

/** Демо-лента: [текст, таб A, текст, таб B, текст] (см. fixtures.ts). */
const DEMO_ROWS = 5;
/** Полная высота однострочной текст-строки: строки переноса · lineHeight + 2·отступ (№32). */
const TEXT_LINE_HEIGHT_PX = theme.fonts.textLine.lineHeight + 2 * theme.textLinePaddingPx;
/** Верхний отступ документа (№7, №32): theme.documentTopPaddingPx = 32. */
const DOC_TOP_PX = theme.documentTopPaddingPx;

// ─── (a) Построение и детерминированность (№14) ─────────────────────────────

describe('(a) план строится из demoNotebookFixture и детерминирован (№14)', () => {
  it('план строится без ошибок: примитивы есть, высота положительна', () => {
    const { plan } = buildDemoPlan();
    expect(plan.primitives.length).toBeGreaterThan(0);
    expect(plan.heightPx).toBeGreaterThan(0);
    expect(plan.widthPx).toBe(WIDTH_PX);
  });

  it('повторный вызов на тех же входах даёт идентичный план (№14)', () => {
    const notebook = demoNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    const options = {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    } as const;
    const first = buildNotebookDrawPlan(notebook, layout, options);
    const second = buildNotebookDrawPlan(notebook, layout, options);
    expect(planKey(second.primitives)).toBe(planKey(first.primitives));
    expect(second.heightPx).toBe(first.heightPx);
    expect(second.widthPx).toBe(first.widthPx);
  });

  it('все виды примитивов присутствуют в demo-плане', () => {
    const { plan } = buildDemoPlan();
    const kinds = new Set(plan.primitives.map((primitive) => primitive.kind));
    expect(kinds).toContain('stringLine');
    expect(kinds).toContain('fretDigit');
    expect(kinds).toContain('barline');
    expect(kinds).toContain('columnText');
    expect(kinds).toContain('clef');
    expect(kinds).toContain('textRow');
  });
});

// ─── Контракт «layout построен по этой модели»: сверка множеств таб-строк ───

describe('расхождение множеств таб-строк модели и layout — throw в обе стороны', () => {
  const demo = demoNotebookFixture();
  const tabIds = demo.lines.flatMap((line) => (line.kind === 'tab' ? [line.id] : []));
  /** Лента demo без второй таб-строки (тексты остаются). */
  const halfNotebook: Notebook = {
    ...demo,
    lines: demo.lines.filter((line) => line.kind !== 'tab' || line.id === tabIds[0]),
  };
  const options = {
    theme,
    advancePx: ADVANCE_PX,
    widthPx: WIDTH_PX,
    measurer: fakeMeasurer,
  } as const;

  it('таб-строка модели без layout — throw, в сообщении обе стороны расхождения', () => {
    const layout = layoutNotebook(halfNotebook, { widthChars: LAYOUT_WIDTH_CHARS });
    expect(() => buildNotebookDrawPlan(demo, layout, options)).toThrow(/в модели нет в layout/);
    expect(() => buildNotebookDrawPlan(demo, layout, options)).toThrow(
      /в layout нет в модели: \[\]/,
    );
  });

  it('таб-строка layout без модели — throw (раньше молча выпадала из плана)', () => {
    const layout = layoutNotebook(demo, { widthChars: LAYOUT_WIDTH_CHARS });
    expect(() => buildNotebookDrawPlan(halfNotebook, layout, options)).toThrow(
      /в layout нет в модели/,
    );
  });
});

// ─── (b) Цифра лада на пересечении струны и колонки (№20, №2) ───────────────

describe('(b) цифра лада — пересечение своей струны и колонки (№20, №2)', () => {
  it('px = (xChars + widthChars/2)·advance + отступ, y = stringY·advance + верх системы', () => {
    const { notebook, layout, plan } = buildDemoPlan();

    // Таб-строка A (вторая строка ленты): колонка 0, нота на струне 3.
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const tabLayoutA = layout.ribbon[1];
    if (tabLayoutA.kind !== 'tab') {
      throw new Error('layout сломан: вторая строка ленты — не таб-раскладка');
    }
    const column0Id = tabA.columns[0].id;
    const system0 = tabLayoutA.systems[0];
    const laidOut = system0.columns.find((column) => column.columnId === column0Id);
    expect(laidOut).toBeDefined();
    if (laidOut === undefined) {
      return;
    }

    // Верх системы 0 таб-строки A: выше — верхний отступ документа (№7) плюс
    // текст-строка (1 строка · lineHeight + отступы); пины задачи: docTop = 32
    // (из темы), вся высота = 32 + 36 + 2·12 = 92.
    expect(DOC_TOP_PX).toBe(32);
    expect(TEXT_LINE_HEIGHT_PX).toBe(theme.fonts.textLine.lineHeight + 2 * theme.textLinePaddingPx);
    const systemTopPx = DOC_TOP_PX + TEXT_LINE_HEIGHT_PX;
    const digit = plan.primitives.find(
      (primitive) =>
        primitive.kind === 'fretDigit' &&
        primitive.lineId === tabA.id &&
        primitive.columnId === column0Id &&
        primitive.stringIndex === 3,
    );
    expect(digit).toBeDefined();
    if (digit === undefined || digit.kind !== 'fretDigit') {
      return;
    }
    // Центр ячейки по x: сдвиг центрирования (№23) + пересечение струна×колонка,
    // линия струны по y; слагаемые пина задачи: сдвиг 20 + отступ ключа 40.
    expect(LEFT_OFFSET_PX + CLEF_MARGIN_PX).toBe(60);
    expect(digit.xPx).toBe(
      LEFT_OFFSET_PX + CLEF_MARGIN_PX + (laidOut.xChars + laidOut.widthChars / 2) * ADVANCE_PX,
    );
    expect(digit.yPx).toBe(systemTopPx + tabLayoutA.stringYChars[3] * ADVANCE_PX);
    // Сам лад из модели: ходы 0-3-5, колонка 0 — лад 0 (открытая, №3).
    expect(digit.fret).toBe(0);
    expect(digit.noteId).toBe(tabA.columns[0].notes[0].id);
  });

  it('у каждой цифры y совпадает с линией её струны той же системы', () => {
    const { plan } = buildDemoPlan();
    const stringLineY = new Map(
      byKind(plan.primitives, 'stringLine').map((primitive) => [
        `${primitive.lineId}:${primitive.systemIndex}:${primitive.stringIndex}`,
        primitive.yPx,
      ]),
    );
    for (const digit of byKind(plan.primitives, 'fretDigit')) {
      if (digit.kind !== 'fretDigit') {
        continue;
      }
      const key = `${digit.lineId}:${digit.systemIndex}:${digit.stringIndex}`;
      const lineY = stringLineY.get(key);
      expect(lineY).toBeDefined();
      // Цифра центрирована на своей струне: y цифры = y линии струны (№20, №2).
      expect(digit.yPx).toBe(lineY);
    }
  });
});

// ─── (c) Черта — вертикаль через все струны (№18) ───────────────────────────

describe('(c) колонка-черта даёт вертикаль через все струны, контентная — нет (№18)', () => {
  it('черта колонки 5 таб-строки A: x — центр колонки, yTop/yBottom — крайние струны', () => {
    const { notebook, layout, plan } = buildDemoPlan();
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const tabLayoutA = layout.ribbon[1];
    if (tabLayoutA.kind !== 'tab') {
      throw new Error('layout сломан: вторая строка ленты — не таб-раскладка');
    }
    const barlineColumnId = tabA.columns[5].id;
    expect(tabA.columns[5].kind).toBe('barline');

    // Черта в той системе, куда попала колонка 5 (система 0: 24 символа ≤ полосы 42).
    const barlines = byKind(plan.primitives, 'barline').filter(
      (primitive): primitive is Extract<DrawPrimitive, { kind: 'barline' }> =>
        primitive.kind === 'barline' && primitive.columnId === barlineColumnId,
    );
    expect(barlines).toHaveLength(1);
    const barline = barlines[0];
    const system = tabLayoutA.systems.find((entry) =>
      entry.columns.some((column) => column.columnId === barlineColumnId),
    );
    expect(system).toBeDefined();
    if (system === undefined) {
      return;
    }
    const column = system.columns.find((entry) => entry.columnId === barlineColumnId);
    expect(column).toBeDefined();
    if (column === undefined) {
      return;
    }
    // Верх системы 0 = верхний отступ документа (№7) + высота текст-строки 0
    // (строки·lineHeight + 2·отступ). Пин слагаемых: 32 + (36 + 2·12) = 92.
    const systemTopPx = DOC_TOP_PX + TEXT_LINE_HEIGHT_PX;
    expect(systemTopPx).toBe(92);
    const bottomStringYPx =
      tabLayoutA.stringYChars[tabLayoutA.stringYChars.length - 1] * ADVANCE_PX;
    // x черты: слагаемые сдвига — 20 (центрирование) + 40 (отступ ключа).
    expect(barline.xPx).toBe(
      LEFT_OFFSET_PX + CLEF_MARGIN_PX + (column.xChars + column.widthChars / 2) * ADVANCE_PX,
    );
    expect(barline.yTopPx).toBe(systemTopPx);
    expect(barline.yBottomPx).toBe(systemTopPx + bottomStringYPx);
  });

  it('каждая черта накрывает все струны своей системы; контентные колонок — без вертикалей', () => {
    const { notebook, plan } = buildDemoPlan();
    const barlineColumns = new Set<string>();
    const contentColumns = new Set<string>();
    for (const line of notebook.lines) {
      if (line.kind === 'tab') {
        for (const column of line.columns) {
          (column.kind === 'barline' ? barlineColumns : contentColumns).add(column.id);
        }
      }
    }
    const barlines = byKind(plan.primitives, 'barline');
    // Вертикалей ровно по одной на каждую колонку-черту модели (kind из модели, №18).
    expect(new Set(barlines.map((primitive) => primitive.columnId))).toEqual(barlineColumns);
    expect(barlines.length).toBe(barlineColumns.size);
    // Ни одна контентная колонка не дала вертикаль.
    for (const primitive of barlines) {
      expect(contentColumns.has(primitive.columnId)).toBe(false);
    }
    // Вертикаль накрывает все струны: от первой до последней линии струн системы.
    for (const primitive of barlines) {
      const systemStrings = byKind(plan.primitives, 'stringLine').filter(
        (line) =>
          line.kind === 'stringLine' &&
          line.lineId === primitive.lineId &&
          line.systemIndex === primitive.systemIndex,
      );
      expect(systemStrings.length).toBe(4); // базовый строй v1: 4 струны (№2)
      const ys = systemStrings.map((line) => line.yPx);
      expect(primitive.yTopPx).toBe(Math.min(...ys));
      expect(primitive.yBottomPx).toBe(Math.max(...ys));
    }
  });
});

// ─── (d) Стопка текстов колонок (№24) ───────────────────────────────────────

describe('(d) тексты колонок — стопкой под нижней струной, x = x колонки (№24)', () => {
  it('тексты финального аккорда таб-строки A: x колонки 29, y — строки стопки', () => {
    const { notebook, layout, plan } = buildDemoPlan();
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const tabLayoutA = layout.ribbon[1];
    if (tabLayoutA.kind !== 'tab') {
      throw new Error('layout сломан: вторая строка ленты — не таб-раскладка');
    }
    const lastColumnId = tabA.columns[29].id;
    const texts = byKind(plan.primitives, 'columnText').filter(
      (primitive): primitive is Extract<DrawPrimitive, { kind: 'columnText' }> =>
        primitive.kind === 'columnText' && primitive.columnId === lastColumnId,
    );
    // Два текста колонки в модели ('E' и 'тоника', №24: до 3 в стопке).
    expect(texts).toHaveLength(2);
    expect(texts.map((primitive) => primitive.text)).toEqual(['E', 'тоника']);

    // Система, куда доехала колонка 29, и её верх: высоты предыдущих систем строки.
    const system = tabLayoutA.systems.find((entry) =>
      entry.columns.some((column) => column.columnId === lastColumnId),
    );
    expect(system).toBeDefined();
    if (system === undefined) {
      return;
    }
    const laidOut = system.columns.find((column) => column.columnId === lastColumnId);
    expect(laidOut).toBeDefined();
    let systemTopPx = DOC_TOP_PX + TEXT_LINE_HEIGHT_PX; // над A: отступ №7 + текст-строка
    for (const entry of tabLayoutA.systems) {
      if (entry.index === system.index) {
        break;
      }
      const bottom = entry.texts.reduce(
        (max, text) => Math.max(max, text.yChars),
        tabLayoutA.stringYChars[tabLayoutA.stringYChars.length - 1],
      );
      systemTopPx += (bottom + TEXT_ROW_SPACING_CHARS) * ADVANCE_PX;
    }
    // x каждого текста = сдвиг центрирования (№23) + левый край его колонки
    // (№24), а не центр и не ширина текста. Слагаемые: 20 + 40 = 60 (пин №23).
    expect(LEFT_OFFSET_PX + CLEF_MARGIN_PX).toBe(60);
    const expectedX = LEFT_OFFSET_PX + CLEF_MARGIN_PX + laidOut!.xChars * ADVANCE_PX;
    // y текстов: строки стопки layout (зазор от нижней струны + по строке на текст, №24).
    const laidOutTexts = system.texts.filter((text) => text.columnId === lastColumnId);
    expect(laidOutTexts).toHaveLength(2);
    texts.forEach((primitive, index) => {
      expect(primitive.xPx).toBe(expectedX);
      expect(primitive.yPx).toBe(systemTopPx + laidOutTexts[index].yChars * ADVANCE_PX);
      // Стопка под нижней струной: ниже линии последней струны системы.
      const bottomStringY = systemTopPx + tabLayoutA.stringYChars[3] * ADVANCE_PX;
      expect(primitive.yPx).toBeGreaterThan(bottomStringY);
    });
    // Стопка: второй текст ниже первого ровно на TEXT_ROW_SPACING_CHARS (№24, №32).
    expect(texts[1].yPx - texts[0].yPx).toBe(TEXT_ROW_SPACING_CHARS * ADVANCE_PX);
  });
});

// ─── (e) Перенос текст-строк measurer'ом (№6, ADR-0004 п. 4) ────────────────

describe('(e) длинный текст текст-строки режется measurer по ширине полосы', () => {
  it('«Разминка по гамме E» при полосе 100 px (10 px/символ) — две строки переноса', () => {
    const notebook = demoNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    const plan = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: 100, // жёсткая полоса: 19 символов текста (= 190 px) не влезают
      measurer: fakeMeasurer,
    });
    const rows = byKind(plan.primitives, 'textRow');
    const firstLineRows = rows.filter(
      (primitive) => primitive.rowIndex >= 0 && primitive.lineId === notebook.lines[0].id,
    );
    expect(firstLineRows.map((primitive) => primitive.text)).toEqual(['Разминка', 'по гамме E']);
    // Каждая строка переноса укладывается в полосу по measurer (№6).
    for (const primitive of firstLineRows) {
      expect(fakeMeasurer.measureTextWidthPx(primitive.text)).toBeLessThanOrEqual(100);
    }
    // x строк — центр своей измеренной ширины в полосе (№7); y — верхний отступ
    // документа + отступ темы + шаг lineHeight (№32, №7).
    const leftPx0 = (100 - fakeMeasurer.measureTextWidthPx('Разминка')) / 2;
    const leftPx1 = (100 - fakeMeasurer.measureTextWidthPx('по гамме E')) / 2;
    expect(firstLineRows[0].xPx).toBe(leftPx0);
    expect(firstLineRows[1].xPx).toBe(leftPx1);
    expect(firstLineRows[0].yPx).toBe(DOC_TOP_PX + theme.textLinePaddingPx);
    expect(firstLineRows[1].yPx - firstLineRows[0].yPx).toBe(theme.fonts.textLine.lineHeight);
  });

  it('вертикальный отступ: первая строка опущена на textLinePaddingPx, высота блока с запасом (№32)', () => {
    const { notebook, plan } = buildDemoPlan();
    const lineHeight = theme.fonts.textLine.lineHeight;
    const padding = theme.textLinePaddingPx;

    // Первая текст-строка демо-ленты (одна строка переноса): глиф опущен на
    // отступ от верха строки ленты, а сама строка ленты — на верхний отступ
    // документа (№7); высота блока = lineHeight + 2·отступ.
    const firstLine = byKind(plan.primitives, 'textRow').find(
      (primitive) => primitive.lineId === notebook.lines[0].id,
    );
    expect(firstLine).toBeDefined();
    expect(firstLine?.yPx).toBe(theme.documentTopPaddingPx + padding);

    // Текст-строка 0 начинается с y=theme.documentTopPaddingPx, поэтому верх
    // таб-строки A (строка ленты 1) = отступ документа + lineHeight + 2·отступ:
    // отступ снизу текст-строки разделяет её с системой.
    const tabAStrings = byKind(plan.primitives, 'stringLine').filter(
      (primitive) => primitive.lineId === notebook.lines[1].id && primitive.systemIndex === 0,
    );
    const minTabAY = Math.min(...tabAStrings.map((primitive) => primitive.yPx));
    expect(minTabAY).toBe(DOC_TOP_PX + lineHeight + 2 * padding);
    // Зазор между базлайном текста и линейками таб-строки A положителен.
    expect(minTabAY).toBeGreaterThan(firstLine!.yPx);
  });

  it('высота текст-строки = число строк переноса · lineHeight + 2·отступ (№32)', () => {
    const notebook = demoNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    const wide = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    });
    const narrow = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: 100,
      measurer: fakeMeasurer,
    });
    // Первая текст-строка: 1 строка → lineHeight + 2·отступ px (№32).
    const lineHeight = theme.fonts.textLine.lineHeight;
    const padding = theme.textLinePaddingPx;
    // Разница полных высот = (число доп. строк переноса) · lineHeight. На полосе
    // 100 px (10 символов) три текст-строки демо-ленты переносятся на 2 строки
    // вместо одной: «Разминка по гамме E» (19 симв.), «Переход на A» (12),
    // «Проверь звучание» (16) — +3 строки всего (таб-строки от ширины документа
    // плана не зависят — их геометрия уже в layout).
    const narrowTextRows = byKind(narrow.primitives, 'textRow').length;
    const wideTextRows = byKind(wide.primitives, 'textRow').length;
    expect(narrowTextRows - wideTextRows).toBe(3);
    expect(narrow.heightPx - wide.heightPx).toBe(3 * lineHeight);
    // Отступ не зависит от числа строк переноса и входит в обе стороны (wide
    // и narrow), поэтому разницу высот он не меняет. Верхний отступ документа
    // (№7) входит в обе высоты по разу и тоже не меняет разницу. Проверим
    // точную арифметику полной высоты: верхний отступ документа + текст-блоки
    // (строки·lineHeight + 2·отступ каждый) + полосы таб-строк (нижняя
    // струна/стопка текстов + TEXT_ROW_SPACING, из layout).
    const textLineCount = notebook.lines.filter((line) => line.kind === 'text').length;
    const textRowsTotal = byKind(wide.primitives, 'textRow').length;
    let tabStrips = 0;
    for (const entry of layout.ribbon) {
      if (entry.kind !== 'tab') {
        continue;
      }
      for (const system of entry.systems) {
        const bottom = system.texts.reduce(
          (max, text) => Math.max(max, text.yChars),
          entry.stringYChars[entry.stringYChars.length - 1],
        );
        tabStrips += (bottom + TEXT_ROW_SPACING_CHARS) * ADVANCE_PX;
      }
    }
    expect(wide.heightPx).toBe(
      DOC_TOP_PX + textRowsTotal * lineHeight + textLineCount * 2 * padding + tabStrips,
    );
    // Слагаемое верхнего отступа пинается: тема 32 входит в высоту один раз
    // (№7), а не в каждую строку ленты.
    expect(DOC_TOP_PX).toBe(theme.documentTopPaddingPx);
    expect(wide.heightPx).toBeGreaterThan(textRowsTotal * lineHeight + tabStrips);
  });

  it('переводы строк и табуляции в тексте — обычные пробелы (ADR-0005 п. 5)', () => {
    const notebook = demoNotebookFixture();
    const textLine = notebook.lines[0];
    if (textLine === undefined || textLine.kind !== 'text') {
      throw new Error('фикстура сломана: строка 0 не текст-строка');
    }
    const withBreaks: Notebook = {
      ...notebook,
      lines: notebook.lines.map((line) =>
        line.id === textLine.id && line.kind === 'text'
          ? { ...line, text: 'Разминка\nпо\tгамме\n\nE' }
          : line,
      ),
    };
    const layout = layoutNotebook(withBreaks, { widthChars: LAYOUT_WIDTH_CHARS });
    const plan = buildNotebookDrawPlan(withBreaks, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    });
    // Разрывы схлопнуты в одинарные пробелы — текст-строка это один текучий
    // абзац (ADR-0005 п. 5); «слова» с \n внутри не уйдут в drawText.
    const rows = byKind(plan.primitives, 'textRow').filter(
      (primitive) => primitive.lineId === textLine.id,
    );
    expect(rows.map((primitive) => primitive.text)).toEqual(['Разминка по гамме E']);
    // Каждый фрагмент свободен от управляющих символов (рисуется как одна строка).
    for (const primitive of rows) {
      expect(primitive.text).not.toMatch(/[\n\r\t]/);
    }
  });
});

// ─── (f) Окно — срез строк ленты (№28) ──────────────────────────────────────

describe('(f) window срезает строки ленты (№28)', () => {
  it('окно [2, 3]: примитивы только строк 2–3, высота документа — полная', () => {
    const { notebook, layout } = buildDemoPlan();
    const full = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    });
    const windowed = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      window: { firstRow: 2, lastRow: 3 },
    });

    // В окне — только строки 2 («Переход на A») и 3 (таб B).
    const lineIds = new Set(windowed.primitives.map((primitive) => primitive.lineId));
    expect(lineIds.has(notebook.lines[0].id)).toBe(false);
    expect(lineIds.has(notebook.lines[1].id)).toBe(false);
    expect(lineIds.has(notebook.lines[2].id)).toBe(true);
    expect(lineIds.has(notebook.lines[3].id)).toBe(true);
    expect(lineIds.has(notebook.lines[4].id)).toBe(false);

    // Окно режет примитивы, но не геометрию документа (№28): y абсолютны,
    // высота документа — как у полного плана.
    expect(windowed.heightPx).toBe(full.heightPx);
    const textRows = byKind(windowed.primitives, 'textRow');
    const fullTextRows = byKind(full.primitives, 'textRow');
    const row2Full = fullTextRows.filter((primitive) => primitive.lineId === notebook.lines[2].id);
    expect(textRows).toEqual(row2Full); // те же абсолютные координаты, что в полном плане

    // Высота окна меньше полного плана только за счёт отсутствующих строк.
    expect(full.primitives.length).toBeGreaterThan(windowed.primitives.length);
    expect(DEMO_ROWS).toBe(notebook.lines.length);
  });

  it('окно за пределами ленты обрезается по границам; весь документ — без окна', () => {
    const { notebook, layout, plan } = buildDemoPlan();
    const clamped = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      window: { firstRow: -10, lastRow: 100 },
    });
    expect(clamped.primitives.length).toBe(plan.primitives.length);
    expect(clamped.heightPx).toBe(plan.heightPx);
  });
});

// ─── (g) Ключ в левом отступе каждой системы (№36) ──────────────────────────

describe('(g) ключ — в левом отступе каждой системы (№36)', () => {
  it('по ключу на каждую систему таб-строки: x = сдвиг центрирования, ширина = clefMarginChars · advance', () => {
    const { notebook, layout, plan } = buildDemoPlan();
    const systemCount = layout.ribbon.reduce(
      (sum, entry) => (entry.kind === 'tab' ? sum + entry.systems.length : sum),
      0,
    );
    const clefs = byKind(plan.primitives, 'clef');
    expect(clefs).toHaveLength(systemCount);
    // Слагаемые пина: сдвиг 20 + ширина отступа 40 — правый край ключа ровно
    // на левом крае полосы (20 + 40 = 60).
    expect(LEFT_OFFSET_PX).toBe(20);
    expect(LEFT_OFFSET_PX + CLEF_MARGIN_PX).toBe(60);
    for (const clef of clefs) {
      expect(clef.xPx).toBe(LEFT_OFFSET_PX);
      expect(clef.widthPx).toBe(CLEF_MARGIN_PX);
      expect(clef.heightPx).toBeGreaterThan(0);
      // Ключ левее линий струн своей системы.
      const firstString = byKind(plan.primitives, 'stringLine').find(
        (line) =>
          line.kind === 'stringLine' &&
          line.lineId === clef.lineId &&
          line.systemIndex === clef.systemIndex &&
          line.stringIndex === 0,
      );
      expect(firstString).toBeDefined();
      if (firstString !== undefined && firstString.kind === 'stringLine') {
        expect(clef.xPx + clef.widthPx).toBe(firstString.xPx);
      }
    }
    // Демо-лента не пуста: системы есть и в строке A (5 систем), и в строке B.
    expect(systemCount).toBeGreaterThan(1);
    expect(notebook.lines.length).toBe(DEMO_ROWS);
  });
});

// ─── (h) Центрирование контента по горизонтали документа (№23, №7) ──────────

describe('(h) таб-системы едут единым центрированным блоком, текст-строки — по центру (№23, №7)', () => {
  it('единый сдвиг у ВСЕХ систем всех таб-строк: (widthPx − (отступ + полоса))/2 (№23)', () => {
    const { notebook, layout, plan } = buildDemoPlan();
    const offset = LEFT_OFFSET_PX;
    // Полоса систем фасада и полоса реального layout совпадают (MEASURE, №20):
    // константа теста — та же арифметика, что поехал в план.
    expect(STRIP_CHARS).toBe(42);
    expect(systemCapacity(LAYOUT_WIDTH_CHARS).stripWidthChars).toBe(
      layout.ribbon.find((entry) => entry.kind === 'tab')?.systems[0]?.widthChars,
    );
    // Пин арифметики из задачи: (500 − (4 + 42) · 10) / 2 = 20 px.
    expect((WIDTH_PX - (CLEF_MARGIN_PX + STRIP_CHARS * ADVANCE_PX)) / 2).toBe(20);
    expect(offset).toBe(20);
    const expectedX = (strip: number) =>
      Math.max(0, (WIDTH_PX - (CLEF_MARGIN_PX + strip * ADVANCE_PX)) / 2);
    expect(expectedX(STRIP_CHARS)).toBe(offset);

    // Каждая система: левый край струн = сдвиг + отступ; правый край блока —
    // по центру документа в сумме со сдвигом.
    const strings = byKind(plan.primitives, 'stringLine');
    for (const line of strings) {
      if (line.kind !== 'stringLine') {
        continue;
      }
      expect(line.xPx).toBe(offset + CLEF_MARGIN_PX);
      expect(line.widthPx).toBe(STRIP_CHARS * ADVANCE_PX);
    }
    // Симметрия полей (№23): правый край струн = widthPx − leftOffset, то есть
    // правое поле равно левому ровно (все слагаемые целые — сравнение точное).
    for (const line of strings) {
      if (line.kind !== 'stringLine') {
        continue;
      }
      expect(line.xPx + line.widthPx).toBe(WIDTH_PX - offset);
      expect(WIDTH_PX - (line.xPx + line.widthPx)).toBe(offset);
    }
    // Цифры, черты и тексты колонок сдвинуты тем же сдвигом (без исключений).
    for (const digit of byKind(plan.primitives, 'fretDigit')) {
      if (digit.kind !== 'fretDigit') {
        continue;
      }
      expect(digit.xPx).toBeGreaterThan(offset + CLEF_MARGIN_PX);
    }
    for (const clef of byKind(plan.primitives, 'clef')) {
      if (clef.kind !== 'clef') {
        continue;
      }
      expect(clef.xPx).toBe(offset);
    }
    // Систем несколько и они в разных таб-строках (сдвиг общий, не по строке).
    const lineIds = new Set(strings.map((line) => (line.kind === 'stringLine' ? line.lineId : '')));
    expect(lineIds.size).toBeGreaterThan(1);
    expect(notebook.lines.length).toBe(DEMO_ROWS);
  });

  it('документ уже блока: сдвиг зажат max(0, …) — контент у левого края', () => {
    const notebook = demoNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    // Узкая ширина: на 10 px уже блока «отступ + полоса» (4·10 + 42·10 = 460).
    const narrowPx = CLEF_MARGIN_PX + STRIP_CHARS * ADVANCE_PX - 10;
    expect(narrowPx).toBe(450); // 460 − 10: отрицательный сдвиг (−5) зажат в 0
    const plan = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: narrowPx,
      measurer: fakeMeasurer,
    });
    // Формула без clamp дала бы (450 − 460)/2 = −5 < 0; зажатая max(0, …) — 0,
    // и план обязан выдать именно её (№23).
    const rawOffset = (narrowPx - (CLEF_MARGIN_PX + STRIP_CHARS * ADVANCE_PX)) / 2;
    expect(rawOffset).toBeLessThan(0);
    expect(Math.max(0, rawOffset)).toBe(0);
    for (const line of byKind(plan.primitives, 'stringLine')) {
      if (line.kind !== 'stringLine') {
        continue;
      }
      expect(line.xPx).toBe(CLEF_MARGIN_PX); // сдвиг = 0
    }
    for (const clef of byKind(plan.primitives, 'clef')) {
      if (clef.kind !== 'clef') {
        continue;
      }
      expect(clef.xPx).toBe(0);
    }
    // Цифры и тексты колонок тоже прижаты к левому краю без отрицательного
    // сдвига: левее отступа ключа никто не уехал.
    const minDigitX = Math.min(...byKind(plan.primitives, 'fretDigit').map((d) => d.xPx));
    expect(minDigitX).toBeGreaterThanOrEqual(CLEF_MARGIN_PX);
  });

  it('каждая строка переноса центрирована по своей измеренной ширине (№7)', () => {
    const notebook = demoNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    const plan = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: 100, // узкая полоса: перенос на несколько строк
      measurer: fakeMeasurer,
    });
    const rows = byKind(plan.primitives, 'textRow');
    expect(rows.length).toBeGreaterThan(1);
    // Детерминированный пин: 8 символов · 10 px = 80 px в полосе 100 → x = 10.
    expect((100 - 8 * 10) / 2).toBe(10);
    for (const row of rows) {
      if (row.kind !== 'textRow') {
        continue;
      }
      const rowWidth = fakeMeasurer.measureTextWidthPx(row.text);
      // Влезающая в полосу строка — ровно по центру; перепуск (шире полосы,
      // ADR-0004 п. 3) — у левого края.
      if (rowWidth <= 100) {
        expect(row.xPx).toBe((100 - rowWidth) / 2);
      } else {
        expect(row.xPx).toBe(0);
      }
    }
    // На СТАНДАРТНОЙ ширине 500 текст-строка центрируется по ширине документа,
    // без сдвига таб-блока: «Переход на A» = 12 симв. → (500 − 120)/2 = 190.
    const { plan: widePlan } = buildDemoPlan();
    const wideRow = byKind(widePlan.primitives, 'textRow').find(
      (primitive) => primitive.text === 'Переход на A',
    );
    expect(wideRow).toBeDefined();
    if (wideRow !== undefined) {
      expect(fakeMeasurer.measureTextWidthPx('Переход на A')).toBe(120);
      expect(wideRow.xPx).toBe((WIDTH_PX - 120) / 2);
      expect(wideRow.xPx).toBe(190);
      // Никакого второго слагаемого: x текст-строки ≠ сдвиг таб-блока + центр.
      expect(wideRow.xPx).not.toBe(LEFT_OFFSET_PX + (WIDTH_PX - 120) / 2);
    }
  });

  it('heightPx = верхний отступ документа + сумма строк ленты, окно отступ не режет (№7, №28)', () => {
    const { notebook, layout, plan } = buildDemoPlan();
    // Пин задачи: верхний отступ — из темы (32), входит в высоту один раз.
    const topPadding = DOC_TOP_PX;
    expect(topPadding).toBe(32);
    expect(topPadding).toBeGreaterThan(0);

    // Полная высота без окна: отступ входит один раз.
    let rowsSum = 0;
    for (const entry of layout.ribbon) {
      if (entry.kind === 'text') {
        const rows = wrapRowsForTest(entry.text);
        rowsSum += rows * theme.fonts.textLine.lineHeight + 2 * theme.textLinePaddingPx;
        continue;
      }
      for (const system of entry.systems) {
        const bottom = system.texts.reduce(
          (max, text) => Math.max(max, text.yChars),
          entry.stringYChars[entry.stringYChars.length - 1],
        );
        rowsSum += (bottom + TEXT_ROW_SPACING_CHARS) * ADVANCE_PX;
      }
    }
    expect(plan.heightPx).toBe(topPadding + rowsSum);

    // Окно режет примитивы, но не геометрию: высота с отступом полная (№28).
    const windowed = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      window: { firstRow: 1, lastRow: 1 },
    });
    expect(windowed.heightPx).toBe(plan.heightPx);

    // Первая строка ленты начинается ровно на отступе документа.
    const firstTextRow = byKind(plan.primitives, 'textRow').find(
      (primitive) => primitive.lineId === notebook.lines[0].id,
    );
    expect(firstTextRow?.yPx).toBe(topPadding + theme.textLinePaddingPx);
  });
});

/** Число строк переноса текст-строки фейк-measurer'ом (зеркало plan.wrapTextLine). */
function wrapRowsForTest(text: string): number {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return 1;
  }
  let rows = 1;
  let current = '';
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (fakeMeasurer.measureTextWidthPx(candidate) <= WIDTH_PX) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      rows += 1;
    }
    current = word;
  }
  return rows;
}

// ─── (i) Выделение и зоны тапа (№40, №35, №5) ───────────────────────────────

describe('(i) выделение и зоны тапа в плане (№40, №35, №5)', () => {
  it('план без выделения идентичен прежнему выводу: примитивы не изменились (сравнение)', () => {
    const notebook = demoNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    const options = {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    } as const;
    const without = buildNotebookDrawPlan(notebook, layout, options);
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const selection: SelectionTarget = {
      kind: 'cell',
      lineId: tabA.id,
      columnId: tabA.columns[0].id,
      stringIndex: 2,
    };
    const withSelection = buildNotebookDrawPlan(notebook, layout, { ...options, selection });

    // Примитивы без выделения — ровно прежний вывод: у плана с выделением
    // к прежнему набору ДОБАВЛЯЮТСЯ только примитивы подсветки (kind
    // selection*), контентные примитивы байт-в-байт те же (сравнение JSON).
    const nonSelection = (primitives: readonly DrawPrimitive[]) =>
      primitives.filter((primitive) => !primitive.kind.startsWith('selection'));
    expect(JSON.stringify(nonSelection(withSelection.primitives))).toBe(
      JSON.stringify(nonSelection(without.primitives)),
    );
    // Высота и ширина тоже не изменились.
    expect(withSelection.heightPx).toBe(without.heightPx);
    expect(withSelection.widthPx).toBe(without.widthPx);
    // Зоны тапа — отдельное поле, одинаковое в обоих планах (не зависит
    // от выделения).
    expect(withSelection.hitZones).toEqual(without.hitZones);
    // С выделением появились примитивы подсветки, ровно один.
    const selected = withSelection.primitives.filter((primitive) =>
      primitive.kind.startsWith('selection'),
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.kind).toBe('selectionCellFrame');
  });

  it('выделенная ячейка даёт selectionCellFrame в системе своей колонки (№40)', () => {
    const { notebook, layout } = buildDemoPlan();
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const column = tabA.columns[0];
    const layoutA = layout.ribbon[1];
    if (layoutA.kind !== 'tab') {
      throw new Error('layout сломан: вторая строка ленты — не таб-раскладка');
    }
    const system0 = layoutA.systems[0];
    const laidOut = system0.columns.find((entry) => entry.columnId === column.id);
    expect(laidOut).toBeDefined();
    if (laidOut === undefined) {
      return;
    }
    const selection: SelectionTarget = {
      kind: 'cell',
      lineId: tabA.id,
      columnId: column.id,
      stringIndex: 3,
    };
    const selected = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      selection,
    });
    const frames = selected.primitives.filter(
      (primitive): primitive is Extract<DrawPrimitive, { kind: 'selectionCellFrame' }> =>
        primitive.kind === 'selectionCellFrame',
    );
    // Колонка не рвётся между системами (№18): рамка ровно одна.
    expect(frames).toHaveLength(1);
    const frame = frames[0];
    if (frame === undefined) {
      return;
    }
    expect(frame.lineId).toBe(tabA.id);
    expect(frame.columnId).toBe(column.id);
    expect(frame.stringIndex).toBe(3);
    expect(frame.systemIndex).toBe(0);
    // Границы по колонке из layout (№20) и по струне из stringYChars (№2):
    // слагаемые — сдвиг центрирования (№23) + отступ ключа (№36).
    const stripLeftPx = LEFT_OFFSET_PX + CLEF_MARGIN_PX;
    expect(frame.xPx).toBe(stripLeftPx + laidOut.xChars * ADVANCE_PX);
    expect(frame.widthPx).toBe(laidOut.widthChars * ADVANCE_PX);
    const stringYPx = DOC_TOP_PX + TEXT_LINE_HEIGHT_PX + layoutA.stringYChars[3] * ADVANCE_PX;
    // Рамка ячейки: по границам зоны ячейки — полоса [max(верх системы, y−advance),
    // y+advance] (№5); у струны 3 (не верхней) верх не зажат.
    expect(frame.yPx).toBe(stringYPx - ADVANCE_PX);
    expect(frame.heightPx).toBe(ADVANCE_PX * 2);
  });

  it('выделенная колонка даёт selectionColumnBand от заголовка до низа полосы (№35, №40)', () => {
    const { notebook, layout } = buildDemoPlan();
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const column = tabA.columns[1];
    const layoutA = layout.ribbon[1];
    if (layoutA.kind !== 'tab') {
      throw new Error('layout сломан: вторая строка ленты — не таб-раскладка');
    }
    const system0 = layoutA.systems[0];
    const laidOut = system0.columns.find((entry) => entry.columnId === column.id);
    expect(laidOut).toBeDefined();
    if (laidOut === undefined) {
      return;
    }
    const selection: SelectionTarget = {
      kind: 'column',
      lineId: tabA.id,
      columnId: column.id,
    };
    const selected = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      selection,
    });
    const bands = selected.primitives.filter(
      (primitive): primitive is Extract<DrawPrimitive, { kind: 'selectionColumnBand' }> =>
        primitive.kind === 'selectionColumnBand',
    );
    expect(bands).toHaveLength(1);
    const band = bands[0];
    if (band === undefined) {
      return;
    }
    expect(band.lineId).toBe(tabA.id);
    expect(band.columnId).toBe(column.id);
    expect(band.systemIndex).toBe(0);
    const stripLeftPx = LEFT_OFFSET_PX + CLEF_MARGIN_PX;
    expect(band.xPx).toBe(stripLeftPx + laidOut.xChars * ADVANCE_PX);
    expect(band.widthPx).toBe(laidOut.widthChars * ADVANCE_PX);
    // Верх полосы — зона заголовка (один advance над первой струной, №35),
    // низ — низ полосы системы (нижняя струна + зазор текстов, №32).
    const systemTopPx = DOC_TOP_PX + TEXT_LINE_HEIGHT_PX;
    const bottomStringYChars = layoutA.stringYChars[layoutA.stringYChars.length - 1];
    expect(band.yTopPx).toBe(systemTopPx - ADVANCE_PX);
    expect(band.yBottomPx).toBe(
      systemTopPx + (bottomStringYChars + TEXT_ROW_SPACING_CHARS) * ADVANCE_PX,
    );
  });

  it('полоса выделенной колонки замыкает низ полосы системы со стопкой текстов (№24, №32)', () => {
    const { notebook, layout } = buildDemoPlan();
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const layoutA = layout.ribbon[1];
    if (layoutA.kind !== 'tab') {
      throw new Error('layout сломан: вторая строка ленты — не таб-раскладка');
    }
    // Система со стопкой текстов — последняя система таб-строки A: в ней
    // колонка финального аккорда с текстами «E»/«тоника» (№24, fixtures.ts).
    const systemWithTexts = layoutA.systems[layoutA.systems.length - 1];
    expect(systemWithTexts.texts.length).toBeGreaterThan(0);
    const chordColumnId = systemWithTexts.texts[0]?.columnId;
    if (chordColumnId === undefined) {
      throw new Error('layout сломан: текст без колонки-владельца');
    }
    const selection: SelectionTarget = {
      kind: 'column',
      lineId: tabA.id,
      columnId: chordColumnId,
    };
    const selected = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      selection,
    });
    const bands = selected.primitives.filter(
      (primitive): primitive is Extract<DrawPrimitive, { kind: 'selectionColumnBand' }> =>
        primitive.kind === 'selectionColumnBand',
    );
    expect(bands).toHaveLength(1);
    const band = bands[0];
    if (band === undefined) {
      return;
    }
    expect(band.systemIndex).toBe(systemWithTexts.index);
    // Верх системы — по линии первой струны самой системы (независимый
    // пересчёт, не суммой высот строк ленты).
    const firstStringLine = byKind(selected.primitives, 'stringLine').find(
      (primitive) =>
        primitive.lineId === tabA.id && primitive.systemIndex === systemWithTexts.index,
    );
    expect(firstStringLine).toBeDefined();
    if (firstStringLine === undefined) {
      return;
    }
    const systemTopPx = firstStringLine.yPx - (layoutA.stringYChars[0] ?? 0) * ADVANCE_PX;
    const bottomStringYChars = layoutA.stringYChars[layoutA.stringYChars.length - 1];
    // Низ полосы системы — до самого низкого текста стопки (№24), зазор
    // замыкает полосу (№32): та же точка, что в высоте полосы (№28), —
    // полоса выделения не обрезает тексты своей системы.
    const contentBottomYChars = systemWithTexts.texts.reduce(
      (max, text) => Math.max(max, text.yChars),
      bottomStringYChars,
    );
    // Стопка реально ниже нижней струны — иначе тест ничего не пинит.
    expect(contentBottomYChars).toBeGreaterThan(bottomStringYChars);
    expect(band.yBottomPx).toBe(
      systemTopPx + (contentBottomYChars + TEXT_ROW_SPACING_CHARS) * ADVANCE_PX,
    );
    // И полоса накрывает тексты своей колонки: низ ниже всех базовых линий.
    const chordTexts = byKind(selected.primitives, 'columnText').filter(
      (primitive) => primitive.lineId === tabA.id && primitive.columnId === chordColumnId,
    );
    expect(chordTexts.length).toBeGreaterThan(0);
    const lowestTextYPx = Math.max(...chordTexts.map((primitive) => primitive.yPx));
    expect(band.yBottomPx).toBeGreaterThan(lowestTextYPx);
  });

  it('примитивы выделения идут после контентных, выделение чужой строки игнорируется', () => {
    const { notebook, layout, plan } = buildDemoPlan();
    // План без выделения: ни одного примитива подсветки.
    expect(plan.primitives.some((primitive) => primitive.kind.startsWith('selection'))).toBe(false);

    // Выделение в другой строке ленты (текст-строка не бывает целью — №35).
    const otherLineId = notebook.lines[0].id;
    const selected = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      selection: { kind: 'cell', lineId: otherLineId, columnId: 'c-1', stringIndex: 0 },
    });
    expect(selected.primitives.some((primitive) => primitive.kind.startsWith('selection'))).toBe(
      false,
    );

    // С выделением: примитивы подсветки — в конце списка примитивов.
    const selection: SelectionTarget = {
      kind: 'cell',
      lineId: notebook.lines[1].id,
      columnId: notebook.lines[1].kind === 'tab' ? notebook.lines[1].columns[0].id : '',
      stringIndex: 1,
    };
    const withSelection = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      selection,
    });
    // С выделением: примитивы подсветки идут ПОСЛЕ контентных примитивов своей
    // системы (рендерер рисует поверх, №40): индекс рамки — после всех
    // контентных видов своего lineId.
    const kinds = withSelection.primitives.map((primitive) => primitive.kind);
    const frameIndex = kinds.indexOf('selectionCellFrame');
    expect(frameIndex).toBeGreaterThan(0);
    // Всё до рамки — контентные примитивы (не подсветка).
    for (let i = 0; i < frameIndex; i += 1) {
      expect(kinds[i]?.startsWith('selection')).toBe(false);
    }
    // Ровно одна рамка: колонка не рвётся между системами (№18).
    expect(kinds.filter((kind) => kind === 'selectionCellFrame')).toHaveLength(1);
  });

  it('зоны тапа: по ячейке на каждое пересечение струна×колонка + по заголовку на колонку', () => {
    const { layout, plan } = buildDemoPlan();
    // Считаем ожидаемое из layout: системы × (колонки × (1 заголовок + 4 ячейки)).
    let expectedZones = 0;
    for (const entry of layout.ribbon) {
      if (entry.kind !== 'tab') {
        continue;
      }
      for (const system of entry.systems) {
        expectedZones += system.columns.length * (1 + entry.stringYChars.length);
      }
    }
    expect(plan.hitZones.length).toBe(expectedZones);
    expect(expectedZones).toBeGreaterThan(0);

    // Зона заголовка ровно одна на колонку системы; ячеек на колонку — по
    // числу струн.
    const headersByColumn = new Map<string, number>();
    const cellsByColumn = new Map<string, number>();
    for (const zone of plan.hitZones) {
      const key = `${zone.target.lineId}:${zone.target.columnId}`;
      if (zone.target.kind === 'column') {
        headersByColumn.set(key, (headersByColumn.get(key) ?? 0) + 1);
      } else {
        cellsByColumn.set(key, (cellsByColumn.get(key) ?? 0) + 1);
      }
    }
    for (const entry of layout.ribbon) {
      if (entry.kind !== 'tab') {
        continue;
      }
      for (const system of entry.systems) {
        for (const column of system.columns) {
          const key = `${entry.lineId}:${column.columnId}`;
          expect(headersByColumn.get(key)).toBe(1);
          expect(cellsByColumn.get(key)).toBe(entry.stringYChars.length);
        }
      }
    }

    // Координаты зон сходятся с примитивами: прямоугольник зоны ячейки
    // накрывает центр цифры лада своей ячейки, зона заголовка — прямо над
    // линией первой струны.
    for (const digit of byKind(plan.primitives, 'fretDigit')) {
      if (digit.kind !== 'fretDigit') {
        continue;
      }
      const zone = plan.hitZones.find(
        (entry) =>
          entry.target.kind === 'cell' &&
          entry.target.lineId === digit.lineId &&
          entry.target.columnId === digit.columnId &&
          entry.target.stringIndex === digit.stringIndex,
      );
      expect(zone).toBeDefined();
      if (zone === undefined || zone.target.kind !== 'cell') {
        continue;
      }
      expect(digit.xPx).toBeGreaterThanOrEqual(zone.rect.xPx);
      expect(digit.xPx).toBeLessThanOrEqual(zone.rect.xPx + zone.rect.widthPx);
      expect(digit.yPx).toBeGreaterThanOrEqual(zone.rect.yPx);
      expect(digit.yPx).toBeLessThanOrEqual(zone.rect.yPx + zone.rect.heightPx);
    }
  });

  it('окно режет зоны тапа вместе с примитивами (№28)', () => {
    const { notebook, layout } = buildDemoPlan();
    const full = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    });
    const windowed = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      window: { firstRow: 3, lastRow: 3 },
    });
    // В окне — только зоны строки 3 (таб-строка B).
    const lineIds = new Set(windowed.hitZones.map((zone) => zone.target.lineId));
    expect(lineIds).toEqual(new Set([notebook.lines[3].id]));
    expect(windowed.hitZones.length).toBeGreaterThan(0);
    expect(full.hitZones.length).toBeGreaterThan(windowed.hitZones.length);
  });

  it('детерминированность с выделением и зонами (№14)', () => {
    const notebook = demoNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    const tabA = notebook.lines[1];
    if (tabA.kind !== 'tab') {
      throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
    }
    const selection: SelectionTarget = {
      kind: 'column',
      lineId: tabA.id,
      columnId: tabA.columns[3].id,
    };
    const options = {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
      selection,
    } as const;
    const first = buildNotebookDrawPlan(notebook, layout, options);
    const second = buildNotebookDrawPlan(notebook, layout, options);
    expect(JSON.stringify(second.primitives)).toBe(JSON.stringify(first.primitives));
    expect(second.hitZones).toEqual(first.hitZones);
    expect(second.heightPx).toBe(first.heightPx);
  });
});

// ─── Дегенеративные входы (14 ревью ST-5) ──────────────────────────────────

describe('дегенеративные входы (14 ревью ST-5)', () => {
  it('пустая тетрадь: «чистый лист» — высота в верхний отступ, примитивов и зон нет', () => {
    const notebook = emptyNotebookFixture();
    const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
    const plan = buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    });
    expect(plan.heightPx).toBe(theme.documentTopPaddingPx);
    expect(plan.primitives).toEqual([]);
    expect(plan.hitZones).toEqual([]);
  });

  it('текст-строка из одних пробельных символов: одна пустая строка переноса', () => {
    const gen = createIdGenerator();
    const inserted = insertLine(emptyNotebookFixture(), createTextLine('  \n\t', gen), 0);
    if (!inserted.ok) {
      throw new Error('фикстура сломана: вставка whitespace-строки отказала');
    }
    const layout = layoutNotebook(inserted.value, { widthChars: LAYOUT_WIDTH_CHARS });
    const plan = buildNotebookDrawPlan(inserted.value, layout, {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    });
    const rows = byKind(plan.primitives, 'textRow');
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toBe('');
  });

  it('инвертированное окно (firstRow > lastRow): пустой срез, высота ленты не тронута', () => {
    const { notebook, layout } = buildDemoPlan();
    const options = {
      theme,
      advancePx: ADVANCE_PX,
      widthPx: WIDTH_PX,
      measurer: fakeMeasurer,
    } as const;
    const full = buildNotebookDrawPlan(notebook, layout, options);
    const inverted = buildNotebookDrawPlan(notebook, layout, {
      ...options,
      window: { firstRow: 5, lastRow: 2 },
    });
    expect(inverted.primitives).toEqual([]);
    expect(inverted.hitZones).toEqual([]);
    expect(inverted.heightPx).toBe(full.heightPx);
  });
});
