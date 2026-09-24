// Шаг MEASURE прохода layout-движка (этап 3 дорожной карты, КАРТА §3): ширины
// колонок и ёмкость системы в символах. Спека: docs/specs/domains/layout-engine.md
// (Flow, шаг 1 MEASURE, разделы Invariants, Configuration) и решения №20, №24.
// Слой Domain (R1): чистые детерминированные функции — без I/O, случайности,
// времени и фреймворков (№14); единица измерения — символ, advance моноширинного
// шрифта цифр лада (№32), поэтому результат не зависит от рендерера (№23).
//
// Предусловие обеих функций (документированное, не проверяемое): модель валидна
// (validateNotebook, ../tabulature/model), тексты длиннее MAX_COLUMN_WIDTH_CHARS
// символов в валидной модели невозможны — ввод отклоняется выше по стеку
// с предупреждением (№24). Поэтому функции тотальны: ошибок не возвращают,
// текст движок не обрезает и не переносит (№24).

import type { Column } from '../tabulature/types';
import { MAX_COLUMN_WIDTH_CHARS, MIN_COLUMN_WIDTH_CHARS, STRIP_WIDTH_FRACTION } from './config';

/**
 * Ёмкость таб-строки (№20): ширина полосы систем в символах и число
 * минимальных ячеек, вмещающихся в полосу. Полоса — floor(доля
 * STRIP_WIDTH_FRACTION от целевой ширины), остаток — поля рендерера (№23).
 */
export interface SystemCapacity {
  /** Ширина полосы систем, в символах: floor(W · STRIP_WIDTH_FRACTION) (№20). */
  readonly stripWidthChars: number;
  /** Ёмкость полосы: floor(stripWidthChars / MIN_COLUMN_WIDTH_CHARS) (№20). */
  readonly capacityColumns: number;
}

/**
 * Ширина колонки в символах (№20, №24): минимум MIN_COLUMN_WIDTH_CHARS
 * (2 символа на цифру лада + по 1 отступа с каждой стороны), рост под самый
 * длинный текст колонки, жёсткий потолок MAX_COLUMN_WIDTH_CHARS. Тексты едут
 * под своей колонкой (№24), поэтому ширина считается по ним, а не по нотам.
 *
 * Колонка-черта всегда MIN_COLUMN_WIDTH_CHARS (№18): в черте текстов нет
 * (валидация №18), нот тоже — рисуется вертикальная линия во всю ширину ячейки.
 *
 * Предусловие: модель валидна (см. шапку файла) — тексты длиннее потолка
 * невозможны, поэтому функция тотальна: возвращает число, ошибок не несёт.
 *
 * @param column вид колонки: 'content' или 'barline' (№18)
 * @param texts  тексты этой колонки (№24: до MAX_COLUMN_TEXTS на колонку, №6)
 * @returns ширина колонки, в символах: от 4 до 12 (№20, №24)
 */
export function columnWidthChars(column: Pick<Column, 'kind'>, texts: readonly string[]): number {
  if (column.kind === 'barline') {
    return MIN_COLUMN_WIDTH_CHARS;
  }
  const longestTextChars = texts.reduce((max, text) => Math.max(max, text.length), 0);
  return Math.min(MAX_COLUMN_WIDTH_CHARS, Math.max(MIN_COLUMN_WIDTH_CHARS, longestTextChars));
}

/**
 * Ёмкость таб-строки на целевую ширину (№20): арифметика из двух floor —
 * полоса floor(W · 0.85), ёмкость floor(полоса / MIN_COLUMN_WIDTH_CHARS).
 * Целочисленная арифметика держит перенос (шаг WRAP, wrap.ts) детерминированным:
 * одинаковые (модель, ширина) всегда дают одинаковые системы (№14).
 *
 * @param targetWidthChars целевая ширина потребителя в символах: экран/A4/превью (№23)
 * @returns ширина полосы и ёмкость системы (см. SystemCapacity)
 */
export function systemCapacity(targetWidthChars: number): SystemCapacity {
  const stripWidthChars = Math.floor(targetWidthChars * STRIP_WIDTH_FRACTION);
  return {
    stripWidthChars,
    capacityColumns: Math.floor(stripWidthChars / MIN_COLUMN_WIDTH_CHARS),
  };
}
