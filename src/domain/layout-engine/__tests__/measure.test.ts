// Юнит-тесты шага MEASURE (этап 3, №34): ширина колонки в символах (№20, №24) —
// минимум 4, рост под самый длинный текст колонки, жёсткий потолок 12, черта
// всегда 4 (в черте текстов нет, №18) — и ёмкость системы (№20): целочисленная
// арифметика полосы (85% целевой ширины) и floor-деления на минимальную ячейку.
// Данные синтетические: вид колонки и список строк текстов.

import type { Column } from '../../tabulature/types';
import { MAX_COLUMN_WIDTH_CHARS, MIN_COLUMN_WIDTH_CHARS, STRIP_WIDTH_FRACTION } from '../config';
import { columnWidthChars, systemCapacity } from '../measure';

/** Вид контентной колонки — повторяется во всех тестах ширины. */
const CONTENT: Pick<Column, 'kind'> = { kind: 'content' };
/** Вид колонки-черты: ширина всегда минимальна (№18). */
const BARLINE: Pick<Column, 'kind'> = { kind: 'barline' };

// ─── (a) Минимум ─────────────────────────────────────────────────────────────

describe('(a) минимум ширины — MIN_COLUMN_WIDTH_CHARS (№20)', () => {
  it('пустая контентная колонка (нет текстов) → 4', () => {
    expect(columnWidthChars(CONTENT, [])).toBe(4);
  });

  it('текст короче минимума («тон», 3) → 4: колонка не сжимается ниже 4', () => {
    expect(columnWidthChars(CONTENT, ['тон'])).toBe(4);
  });

  it('текст ровно минимума («нота», 4) → 4', () => {
    expect(columnWidthChars(CONTENT, ['нота'])).toBe(4);
  });

  it('константы конфигурации согласованы: 4 и 12 (№20, №24)', () => {
    expect(MIN_COLUMN_WIDTH_CHARS).toBe(4);
    expect(MAX_COLUMN_WIDTH_CHARS).toBe(12);
  });
});

// ─── (b) Рост под текст ──────────────────────────────────────────────────────

describe('(b) рост под самый длинный текст колонки (№20, №24)', () => {
  it('текст «тоника» (6 символов) → 6', () => {
    expect(columnWidthChars(CONTENT, ['тоника'])).toBe(6);
  });

  it('несколько текстов → ширина по самому длинному', () => {
    // Самый длинный текст — 9 символов (< потолка): ширина растёт ровно под него.
    expect(columnWidthChars(CONTENT, ['G', 'тоника', 'трезвучие'])).toBe('трезвучие'.length);
    expect(columnWidthChars(CONTENT, ['G', 'тоника', 'трезвучие'])).toBe(9);
  });

  it('текст из 12 символов → 12 (потолок достигнут ростом, без отклонения)', () => {
    expect(columnWidthChars(CONTENT, ['x'.repeat(12)])).toBe(12);
  });

  it('текст из 11 символов → 11: до потолка колонка растёт ровно по тексту', () => {
    expect(columnWidthChars(CONTENT, ['x'.repeat(11)])).toBe(11);
  });
});

// ─── (c) Потолок ─────────────────────────────────────────────────────────────

describe('(c) жёсткий потолок MAX_COLUMN_WIDTH_CHARS (№20, №24)', () => {
  it('текст длиннее 12 в валидной модели невозможен (№24), но потолок держится', () => {
    // Предусловие «модель валидна» (№24): такой текст не должен возникнуть;
    // движок тем не менее тотален — не обрезает текст (№24) и не падает,
    // ширина колонки остаётся на потолке.
    expect(columnWidthChars(CONTENT, ['x'.repeat(20)])).toBe(12);
  });

  it('ширина любой колонки ∈ [4, 12] (№20)', () => {
    for (const len of [0, 1, 4, 6, 11, 12, 15]) {
      const width = columnWidthChars(CONTENT, ['x'.repeat(len)]);
      expect(width).toBeGreaterThanOrEqual(MIN_COLUMN_WIDTH_CHARS);
      expect(width).toBeLessThanOrEqual(MAX_COLUMN_WIDTH_CHARS);
    }
  });
});

// ─── (d) Черта ───────────────────────────────────────────────────────────────

describe('(d) колонка-черта всегда минимальной ширины (№18)', () => {
  it('черта → 4', () => {
    expect(columnWidthChars(BARLINE, [])).toBe(4);
  });

  it('черта → 4, даже если texts переданы: в черте текстов нет (№18)', () => {
    // В валидной модели у черты текстов не бывает (валидация №18); аргумент
    // здесь — проверка, что вид колонки решает ширину, а не содержимое.
    expect(columnWidthChars(BARLINE, ['x'.repeat(12)])).toBe(4);
  });
});

// ─── (e) Ёмкость системы ─────────────────────────────────────────────────────

describe('(e) ёмкость системы — целочисленная арифметика (№20)', () => {
  it('W=100: полоса floor(0.85·100)=85, ёмкость floor(85/4)=21', () => {
    const capacity = systemCapacity(100);
    expect(capacity.stripWidthChars).toBe(85);
    expect(capacity.capacityColumns).toBe(21);
  });

  it('полоса = floor(W · STRIP_WIDTH_FRACTION) с отсечением дробной части (№20)', () => {
    // 0.85 · 375 = 318.75 → floor → 318 (дробь отбрасывается, не округляется).
    expect(systemCapacity(375).stripWidthChars).toBe(Math.floor(375 * STRIP_WIDTH_FRACTION));
    expect(systemCapacity(375).stripWidthChars).toBe(318);
  });

  it('ёмкость = floor(полосы / 4): остаток полосы < 4 символов не даёт ячейки', () => {
    // Полоса 318: 318/4 = 79.5 → 79; остаток 2 символа ячейки не образует.
    const capacity = systemCapacity(375);
    expect(capacity.capacityColumns).toBe(Math.floor(318 / MIN_COLUMN_WIDTH_CHARS));
    expect(capacity.capacityColumns).toBe(79);
  });

  it('двойной floor согласован: capacityColumns = floor(0.85·W / 4) (№20)', () => {
    for (const width of [8, 9, 10, 11, 100, 375, 720, 1188, 1024]) {
      const capacity = systemCapacity(width);
      expect(capacity.stripWidthChars).toBe(Math.floor(width * STRIP_WIDTH_FRACTION));
      expect(capacity.capacityColumns).toBe(
        Math.floor(Math.floor(width * STRIP_WIDTH_FRACTION) / MIN_COLUMN_WIDTH_CHARS),
      );
    }
  });

  it('детерминизм: повторный вызов на тех же входах даёт идентичный результат (№14)', () => {
    expect(systemCapacity(375)).toEqual(systemCapacity(375));
    expect(columnWidthChars(CONTENT, ['тоника'])).toBe(columnWidthChars(CONTENT, ['тоника']));
  });
});
