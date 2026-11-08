// Тесты чистого hit-теста «тап → цель» (№5, №35): тап в центр существующей
// ячейки возвращает её lineId/columnId/stringIndex; тап в верхнюю зону колонки
// (заголовок, №35) — колонку; тап вне полос систем/документа — null. Геометрия
// плана — фиксированным advancePx на demo-фикстуре, координаты тапа — из
// тех же слагаемых, что в плане (сдвиг центрирования №23 + отступ ключа №36
// + x колонок layout, верх документа №32 + высоты строк ленты), не хардкодом.

import type { Notebook, TabLine } from '../../../domain/tabulature/types';
import { layoutNotebook } from '../../../domain/layout-engine';
import { demoNotebookFixture } from '../../../domain/layout-engine/fixtures';
import { hitTestPlan, hitTestPlanAll } from '../hit-test';
import { buildNotebookDrawPlan } from '../plan';
import type { CellTarget, TextLineMeasurer } from '../plan';
import { theme } from '../theme';

// ─── Помощники ──────────────────────────────────────────────────────────────

/** Фейк-measurer: 10 px за символ, без платформы (как в plan.test.ts). */
const fakeMeasurer: TextLineMeasurer = {
  measureTextWidthPx: (text) => text.length * 10,
};

/** ФИКСИРОВАННЫЙ advancePx — единица перевода символов движка в px (№32). */
const ADVANCE_PX = 10;
const LAYOUT_WIDTH_CHARS = 50;
const WIDTH_PX = 500;

/** Слагаемые x плана: сдвиг центрирования (№23) + отступ ключа (№36). */
const LEFT_OFFSET_PX = (WIDTH_PX - (theme.clefMarginChars * ADVANCE_PX + 42 * ADVANCE_PX)) / 2;
/** Верхний отступ документа (№7, №32). */
const DOC_TOP_PX = theme.documentTopPaddingPx;
/** Высота строки текст-строки: строки переноса · lineHeight + 2·отступ (№32). */
const TEXT_LINE_HEIGHT_PX = theme.fonts.textLine.lineHeight + 2 * theme.textLinePaddingPx;

interface DemoContext {
  readonly notebook: Notebook;
  readonly tabA: TabLine;
  readonly plan: ReturnType<typeof buildNotebookDrawPlan>;
}

/** Стандартный вход: demo-тетрадь, layout на 50 символов, план на 500 px. */
function buildDemo(): DemoContext {
  const notebook = demoNotebookFixture();
  const layout = layoutNotebook(notebook, { widthChars: LAYOUT_WIDTH_CHARS });
  const plan = buildNotebookDrawPlan(notebook, layout, {
    theme,
    advancePx: ADVANCE_PX,
    widthPx: WIDTH_PX,
    measurer: fakeMeasurer,
  });
  const first = notebook.lines[1];
  if (first === undefined || first.kind !== 'tab') {
    throw new Error('фикстура сломана: вторая строка ленты — не таб-строка');
  }
  return { notebook, tabA: first, plan };
}

/** Центр ячейки струна×колонка таб-строки A: из слагаемых плана, не хардкод. */
function cellCenter(context: DemoContext, columnModelIndex: number, stringIndex: number) {
  const { tabA, plan } = context;
  const columnId = tabA.columns[columnModelIndex].id;
  const zone = plan.hitZones.find(
    (entry) => entry.target.kind === 'cell' && entry.target.columnId === columnId,
  );
  if (zone === undefined) {
    throw new Error(`в плане нет зоны ячейки колонки ${columnId}`);
  }
  const cellZones = plan.hitZones.filter(
    (entry) => entry.target.kind === 'cell' && entry.target.columnId === columnId,
  );
  const targetZone = cellZones[stringIndex];
  if (targetZone === undefined) {
    throw new Error(`в плане нет зоны ячейки струны ${stringIndex} колонки ${columnId}`);
  }
  void zone;
  return {
    xPx: targetZone.rect.xPx + targetZone.rect.widthPx / 2,
    yPx: targetZone.rect.yPx + targetZone.rect.heightPx / 2,
  };
}

// ─── (a) Тап в ячейку ───────────────────────────────────────────────────────

describe('(a) тап в центр существующей ячейки (№5, №20)', () => {
  it('возвращает lineId/columnId/stringIndex ячейки', () => {
    const context = buildDemo();
    const point = cellCenter(context, 0, 3);
    const hit = hitTestPlan(context.plan, point);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('cell');
    if (hit === null || hit.kind !== 'cell') {
      return;
    }
    expect(hit.lineId).toBe(context.tabA.id);
    expect(hit.columnId).toBe(context.tabA.columns[0].id);
    expect(hit.stringIndex).toBe(3);
  });

  it('пустая ячейка (пауза, №20) выбирается так же, как занятая', () => {
    const context = buildDemo();
    // Колонка 1 таб-строки B (короткая, 4 колонки) не занята на струне 1.
    const tabB = context.notebook.lines[3];
    if (tabB === undefined || tabB.kind !== 'tab') {
      throw new Error('фикстура сломана: четвёртая строка ленты — не таб-строка');
    }
    const columnId = tabB.columns[1].id;
    const zones = context.plan.hitZones.filter(
      (entry) => entry.target.kind === 'cell' && entry.target.columnId === columnId,
    );
    const zone = zones[1];
    if (zone === undefined) {
      throw new Error('в плане нет зоны струны 1 колонки 1 таб-строки B');
    }
    const hit = hitTestPlan(context.plan, {
      xPx: zone.rect.xPx + zone.rect.widthPx / 2,
      yPx: zone.rect.yPx + zone.rect.heightPx / 2,
    });
    expect(hit?.kind).toBe('cell');
    if (hit === null || hit.kind !== 'cell') {
      return;
    }
    expect(hit.lineId).toBe(tabB.id);
    expect(hit.columnId).toBe(columnId);
    expect(hit.stringIndex).toBe(1);
  });
});

// ─── (b) Тап в зону заголовка колонки ───────────────────────────────────────

describe('(b) тап в верхнюю зону колонки возвращает колонку (№35)', () => {
  it('тап над первой струной в пределах колонки — kind column, те же lineId/columnId', () => {
    const context = buildDemo();
    const columnId = context.tabA.columns[2].id;
    const header = context.plan.hitZones.find(
      (entry) => entry.target.kind === 'column' && entry.target.columnId === columnId,
    );
    expect(header).toBeDefined();
    if (header === undefined || header.target.kind !== 'column') {
      return;
    }
    // Тап в центр зоны заголовка: полоса колонки выше первой струны (№35).
    const hit = hitTestPlan(context.plan, {
      xPx: header.rect.xPx + header.rect.widthPx / 2,
      yPx: header.rect.yPx + header.rect.heightPx / 2,
    });
    expect(hit?.kind).toBe('column');
    if (hit === null || hit.kind !== 'column') {
      return;
    }
    expect(hit.lineId).toBe(context.tabA.id);
    expect(hit.columnId).toBe(columnId);
  });

  it('зона заголовка — ровно один символ advance над первой струной системы', () => {
    const context = buildDemo();
    for (const entry of context.plan.hitZones) {
      if (entry.target.kind !== 'column') {
        continue;
      }
      expect(entry.rect.heightPx).toBe(ADVANCE_PX);
      // Низ заголовка лежит НА линии первой струны его системы: ищем линию
      // струны с тем же lineId, струной 0 и y, совпадающим с низом зоны.
      const bottomYPx = entry.rect.yPx + entry.rect.heightPx;
      const firstString = context.plan.primitives.find(
        (primitive) =>
          primitive.kind === 'stringLine' &&
          primitive.lineId === entry.target.lineId &&
          primitive.stringIndex === 0 &&
          primitive.yPx === bottomYPx,
      );
      expect(firstString).toBeDefined();
    }
  });
});

// ─── (c) Тап вне документа ──────────────────────────────────────────────────

describe('(c) тап вне полос систем/документа возвращает null (№5)', () => {
  it('вне документа (левее полосы, ниже документа, над документом) — null', () => {
    const context = buildDemo();
    // Левее блока систем: зона отступа ключа не содержит зон (зоны начинаются
    // с левого края полосы, отступ ключа — вне, №36).
    expect(hitTestPlan(context.plan, { xPx: 1, yPx: DOC_TOP_PX + 50 })).toBeNull();
    // Над документом (верхний отступ №7 — поля, не зона).
    expect(hitTestPlan(context.plan, { xPx: WIDTH_PX / 2, yPx: DOC_TOP_PX - 5 })).toBeNull();
    // Ниже документа.
    expect(
      hitTestPlan(context.plan, { xPx: WIDTH_PX / 2, yPx: context.plan.heightPx + 10 }),
    ).toBeNull();
  });

  it('текст-строка ленты, отступ ключа и верхний отступ документа — null', () => {
    const context = buildDemo();
    // Слот текст-строки (строка 0 «Разминка…»): зон там нет — тап по тексту
    // не выбирает ни ячейку, ни колонку (№35: цели — ячейки и колонки).
    const textRowMidYPx = DOC_TOP_PX + TEXT_LINE_HEIGHT_PX / 2;
    expect(hitTestPlan(context.plan, { xPx: WIDTH_PX / 2, yPx: textRowMidYPx })).toBeNull();
    // Отступ ключа (№36) левее полосы систем: зоны начинаются с полосы.
    const anyStringYPx = DOC_TOP_PX + TEXT_LINE_HEIGHT_PX;
    expect(hitTestPlan(context.plan, { xPx: LEFT_OFFSET_PX + 5, yPx: anyStringYPx })).toBeNull();
    // Верхний отступ документа (№7) — поля тетради, не зона.
    expect(hitTestPlan(context.plan, { xPx: WIDTH_PX / 2, yPx: DOC_TOP_PX - 5 })).toBeNull();
  });
});

// ─── (d) Детерминированность и целостность зон ──────────────────────────────

describe('(d) hit-тест детерминирован, зоны плана не перекрываются (№14, №5)', () => {
  it('повторный вызов на тех же входах даёт идентичный результат (№14)', () => {
    const context = buildDemo();
    const point = cellCenter(context, 4, 2);
    const first = hitTestPlan(context.plan, point);
    const second = hitTestPlan(context.plan, point);
    expect(second).toEqual(first);
  });

  it('ни одна точка не попадает больше чем в одну зону (№5: ровно одна цель)', () => {
    const context = buildDemo();
    // Сэмплируем сеткой внутри и вокруг блока систем: перекрытие зон — дефект
    // геометрии плана, а не hit-теста.
    for (let x = 0; x <= WIDTH_PX; x += 5) {
      for (let y = 0; y <= context.plan.heightPx; y += 5) {
        const point = { xPx: x, yPx: y };
        const matches = hitTestPlanAll(context.plan, point);
        expect(matches.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('границы зон: тап ровно на левом краю/верху зоны — попадание, на правом/нижнем — нет', () => {
    const context = buildDemo();
    const zone = context.plan.hitZones.find((entry) => entry.target.kind === 'cell');
    expect(zone).toBeDefined();
    if (zone === undefined || zone.target.kind !== 'cell') {
      return;
    }
    const target: CellTarget = zone.target;
    const leftTop = hitTestPlan(context.plan, { xPx: zone.rect.xPx, yPx: zone.rect.yPx });
    expect(leftTop).toEqual(target);
    const rightEdge = hitTestPlan(context.plan, {
      xPx: zone.rect.xPx + zone.rect.widthPx,
      yPx: zone.rect.yPx,
    });
    expect(rightEdge).not.toEqual(target);
  });
});
