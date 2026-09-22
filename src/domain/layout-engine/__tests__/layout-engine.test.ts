// Приёмочные тесты layout-движка (этап 3 дорожной карты, КАРТА §3, №34):
// критерий этапа — «перенос таб-строк по системам на фикстурах, такт не рвётся,
// текст едет вместе со своей колонкой, юнит-тесты layout зелёные».
// Данные — фикстуры fixtures.ts: валидные тетради, собранные публичными
// фабриками и операциями модели; вход — публичный фасад layoutNotebook
// (../index) с целевой шириной в опциях { widthChars } (№23, №32).
//
// Арифметика фикстур (см. fixtures.ts): широкая строка — 30 колонок,
// ширины 4, кроме аккордной (6 под текст «тоника», №24) → сумма 122 символа;
// такты: 4 по 6 колонок (24 символа, замкнуты чертой) + замыкающий (26).
// Перенос сравнивает суммы ширин с шириной полосы floor(0.85·W) (№20):
// W=580 → полоса 493 (122 ≤ 493 — 1 система), W=80 → 68 (M1+M2 = 48 ≤ 68,
// +M3 = 72 > 68 → 3 системы), W=28 → 23 (любой такт ≥ 24 > 23 — такт
// на систему, с перепуском, №18), W=0/-40 → 0 (тоже перепуск, №18).

import { layoutNotebook } from '../index';
import {
  DEGENERATE_WIDTHS,
  demoNotebookFixture,
  emptyNotebookFixture,
  wideLineNotebookFixture,
} from '../fixtures';
import { ROW_SPACING_CHARS, TEXT_ROW_SPACING_CHARS } from '../config';
import { systemCapacity } from '../measure';
import { validateNotebook } from '../../tabulature/model';
import type { LaidOutSystem, NotebookLayout, RibbonLayoutEntry, TabLineLayout } from '../types';
import type { Notebook, TabLine } from '../../tabulature/types';

/** Цели ширины из арифметики фикстур: одна система / группировка / по такту. */
const WIDE_W = 580;
const GROUPING_W = 80;
const NARROW_W = 28;

const tabEntries = (layout: NotebookLayout): readonly TabLineLayout[] =>
  layout.ribbon.filter((entry): entry is TabLineLayout & { kind: 'tab' } => entry.kind === 'tab');

const textEntries = (layout: NotebookLayout): readonly (RibbonLayoutEntry & { kind: 'text' })[] =>
  layout.ribbon.filter(
    (entry): entry is RibbonLayoutEntry & { kind: 'text' } => entry.kind === 'text',
  );

/** Единственная таб-строка фикстуры (тест-навигация; в фикстурах она есть). */
function onlyTabLine(notebook: Notebook): TabLine {
  const found = notebook.lines.find((line) => line.kind === 'tab');
  if (!found || found.kind !== 'tab') {
    throw new Error('фикстура сломана: в тетради нет таб-строки');
  }
  return found;
}

// ─── (a) Фикстуры валидны по построению (№34) ────────────────────────────────

describe('(a) фикстуры валидны по построению (№34)', () => {
  it('emptyNotebookFixture проходит validateNotebook', () => {
    expect(validateNotebook(emptyNotebookFixture()).ok).toBe(true);
  });

  it('wideLineNotebookFixture проходит validateNotebook', () => {
    expect(validateNotebook(wideLineNotebookFixture()).ok).toBe(true);
  });

  it('demoNotebookFixture проходит validateNotebook', () => {
    expect(validateNotebook(demoNotebookFixture()).ok).toBe(true);
  });
});

// ─── (b) Широкая цель: каждая таб-строка — одна система (№20) ────────────────

describe('(b) широкая цель: каждая таб-строка — одна система (№20)', () => {
  it('широкая строка (122 симв.) на W=580 (полоса 493) — одна система', () => {
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: WIDE_W });
    const tabs = tabEntries(layout);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].systems).toHaveLength(1);
    expect(systemCapacity(WIDE_W).stripWidthChars).toBe(493);
  });

  it('все 30 колонок в системе в порядке модели, аккорд раздвинут до 6 (№24)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: WIDE_W });
    const system = tabEntries(layout)[0].systems[0];
    expect(system.columns.map((col) => col.columnId)).toEqual(line.columns.map((col) => col.id));
    expect(system.columns[0]).toEqual({ columnId: line.columns[0].id, xChars: 0, widthChars: 4 });
    const last = system.columns[29];
    expect(last).toEqual({ columnId: line.columns[29].id, xChars: 116, widthChars: 6 });
  });

  it('демо-тетрадь на W=580: обе таб-строки по одной системе (№20)', () => {
    const layout = layoutNotebook(demoNotebookFixture(), { widthChars: WIDE_W });
    for (const tab of tabEntries(layout)) {
      expect(tab.systems).toHaveLength(1);
    }
    expect(tabEntries(layout)).toHaveLength(2);
  });

  it('порядок ленты сохранён, текст-строки — pass-through без геометрии (№6, №32)', () => {
    const layout = layoutNotebook(demoNotebookFixture(), { widthChars: WIDE_W });
    expect(layout.ribbon.map((entry) => entry.kind)).toEqual([
      'text',
      'tab',
      'text',
      'tab',
      'text',
    ]);
    expect(textEntries(layout).map((entry) => entry.text)).toEqual([
      'Разминка по гамме E',
      'Переход на A',
      'Проверь звучание',
    ]);
    for (const entry of textEntries(layout)) {
      expect(Object.keys(entry).sort()).toEqual(['kind', 'lineId', 'text']);
    }
  });
});

// ─── (c) Узкая цель: перенос по тактам, такт не рвётся (№18, №36) ────────────

describe('(c) узкая цель: перенос по системам, такт не рвётся (№18, №36)', () => {
  it('широкая строка на W=80 — 3 системы: [такт 1–2], [такт 3–4], [замыкающий]', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: GROUPING_W });
    const systems = tabEntries(layout)[0].systems;
    expect(systems).toHaveLength(3);
    expect(systems.map((system) => system.index)).toEqual([0, 1, 2]);
    expect(systems[0].columns.map((col) => col.columnId)).toEqual(
      line.columns.slice(0, 12).map((col) => col.id),
    );
    expect(systems[1].columns.map((col) => col.columnId)).toEqual(
      line.columns.slice(12, 24).map((col) => col.id),
    );
    expect(systems[2].columns.map((col) => col.columnId)).toEqual(
      line.columns.slice(24).map((col) => col.id),
    );
  });

  it('такты целы: конкатенация систем = колонки модели, дублей и потерь нет (№18)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: GROUPING_W });
    const concatenated = tabEntries(layout)[0].systems.flatMap((system) =>
      system.columns.map((col) => col.columnId),
    );
    expect(concatenated).toEqual(line.columns.map((col) => col.id));
  });

  it('каждая система начинается с такта и не начинается с середины такта (№36)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const barlineIds = new Set(
      line.columns.filter((col) => col.kind === 'barline').map((col) => col.id),
    );
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: NARROW_W });
    const systems = tabEntries(layout)[0].systems;
    // W=28: полоса 23 < 24 (любой такт) — каждый такт в собственной системе.
    expect(systems).toHaveLength(5);
    for (let i = 1; i < systems.length; i++) {
      const previous = systems[i - 1].columns[systems[i - 1].columns.length - 1];
      expect(barlineIds.has(previous.columnId)).toBe(true);
    }
  });

  it('строка без черт не рвётся никогда: lineB демо-тетради — одна система (№36)', () => {
    const notebook = demoNotebookFixture();
    const lineB = notebook.lines[3];
    if (!lineB || lineB.kind !== 'tab') {
      throw new Error('фикстура сломана: строка B не таб-строка');
    }
    const layout = layoutNotebook(notebook, { widthChars: NARROW_W });
    const lineBLayout = tabEntries(layout).find((tab) => tab.lineId === lineB.id);
    expect(lineBLayout?.systems).toHaveLength(1);
    expect(lineBLayout?.systems[0].columns).toHaveLength(lineB.columns.length);
  });

  it('на вырожденно узкой цели такт перепускает полосу, но остаётся цел (№18)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: 28 });
    const systems = tabEntries(layout)[0].systems;
    // Полоса 23 символа меньше любого такта (24) — такт занимает систему один.
    expect(systems).toHaveLength(5);
    for (const system of systems) {
      expect(system.columns).toHaveLength(6);
      const width = system.columns.reduce((sum, col) => sum + col.widthChars, 0);
      expect(width).toBeGreaterThan(systemCapacity(28).stripWidthChars);
    }
    const concatenated = systems.flatMap((system) => system.columns.map((col) => col.columnId));
    expect(concatenated).toEqual(line.columns.map((col) => col.id));
  });
});

// ─── (d) Текст едет вместе со своей колонкой (№24) ───────────────────────────

describe('(d) текст едет вместе со своей колонкой (№24)', () => {
  const WIDTHS = [WIDE_W, GROUPING_W, NARROW_W];

  it('x текста == x его колонки в её системе, на любой ширине (№24)', () => {
    for (const width of WIDTHS) {
      const systems = layoutNotebook(wideLineNotebookFixture(), { widthChars: width });
      for (const tab of tabEntries(systems)) {
        for (const system of tab.systems) {
          const xOf = new Map(system.columns.map((col) => [col.columnId, col.xChars]));
          for (const text of system.texts) {
            expect(xOf.has(text.columnId)).toBe(true);
            expect(text.xChars).toBe(xOf.get(text.columnId));
          }
        }
      }
    }
  });

  it('тексты аккорда — в системе его колонки, и только в ней (№24, №18)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const chordId = line.columns[29].id;
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: GROUPING_W });
    const systems = tabEntries(layout)[0].systems;
    const withChord = systems.filter((system) =>
      system.columns.some((col) => col.columnId === chordId),
    );
    expect(withChord).toHaveLength(1);
    expect(withChord[0].texts.map((text) => text.textId)).toHaveLength(2);
    // Тексты в стопке под строками струн (№24, №6): y ниже нижней струны.
    const bottomY = 3 * ROW_SPACING_CHARS;
    expect(withChord[0].texts.map((text) => text.yChars)).toEqual([
      bottomY + TEXT_ROW_SPACING_CHARS,
      bottomY + 2 * TEXT_ROW_SPACING_CHARS,
    ]);
    const rest = systems.filter((system) => system !== withChord[0]);
    for (const system of rest) {
      expect(system.texts).toHaveLength(0);
    }
  });

  it('каждый текст линии выводится ровно один раз на всех системах (№24)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: NARROW_W });
    const textIds = tabEntries(layout)[0].systems.flatMap((system) =>
      system.texts.map((text) => text.textId),
    );
    expect(textIds).toHaveLength(line.texts.length);
    expect(new Set(textIds).size).toBe(textIds.length);
    expect(new Set(textIds)).toEqual(new Set(line.texts.map((text) => text.id)));
  });
});

// ─── (e) Детерминизм (№14) ───────────────────────────────────────────────────

describe('(e) детерминизм: повторный проход — идентичный результат (№14)', () => {
  it('демо-тетрадь: два прохода на той же ширине deep-equal и JSON-равны (№14)', () => {
    for (const width of [WIDE_W, NARROW_W]) {
      const first = layoutNotebook(demoNotebookFixture(), { widthChars: width });
      const second = layoutNotebook(demoNotebookFixture(), { widthChars: width });
      expect(second).toEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    }
  });

  it('другая ширина — другая нарезка систем, тот же порядок ленты (№23)', () => {
    const wide = layoutNotebook(demoNotebookFixture(), { widthChars: WIDE_W });
    const narrow = layoutNotebook(demoNotebookFixture(), { widthChars: NARROW_W });
    expect(wide.ribbon.map((entry) => entry.kind)).toEqual(narrow.ribbon.map((e) => e.kind));
    expect(tabEntries(narrow)[0].systems.length).toBeGreaterThan(
      tabEntries(wide)[0].systems.length,
    );
  });
});

// ─── (f) Вырожденные ширины и пустая тетрадь (№20, №18) ──────────────────────

describe('(f) вырожденные ширины: проход тотален, систем ≥ 1 (№20, №18)', () => {
  it('пустая тетрадь — пустая лента результата, ошибок нет (№6)', () => {
    for (const width of [...DEGENERATE_WIDTHS, WIDE_W]) {
      const layout = layoutNotebook(emptyNotebookFixture(), { widthChars: width });
      expect(layout.ribbon).toEqual([]);
    }
  });

  it('W=0 и W<0: широкая строка — по такту на систему, без исключений (№18)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    for (const width of DEGENERATE_WIDTHS) {
      const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: width });
      const systems = tabEntries(layout)[0].systems;
      expect(systems).toHaveLength(5);
      const concatenated = systems.flatMap((system) => system.columns.map((c) => c.columnId));
      expect(concatenated).toEqual(line.columns.map((c) => c.id));
      for (const system of systems) {
        expect(system.widthChars).toBe(systemCapacity(width).stripWidthChars);
      }
    }
  });

  it('пустая таб-строка на нулевой ширине — одна пустая система (№20)', () => {
    const line = onlyTabLine(wideLineNotebookFixture());
    const empty: TabLine = { ...line, columns: [], texts: [] };
    const notebook: Notebook = { ...wideLineNotebookFixture(), lines: [empty] };
    const layout = layoutNotebook(notebook, { widthChars: 0 });
    const systems = tabEntries(layout)[0].systems;
    expect(systems).toHaveLength(1);
    expect(systems[0].columns).toEqual([]);
    expect(systems[0].texts).toEqual([]);
  });

  it('полоса систем — floor(85% цели): ширина каждой системы равна полосе (№20, №23)', () => {
    const layout = layoutNotebook(wideLineNotebookFixture(), { widthChars: GROUPING_W });
    const strip = systemCapacity(GROUPING_W).stripWidthChars;
    for (const system of tabEntries(layout)[0].systems as readonly LaidOutSystem[]) {
      expect(system.widthChars).toBe(strip);
    }
  });
});
