// Публичный фасад layout-движка (этап 3 дорожной карты, КАРТА §3): одна точка
// входа для потребителей — Skia-рендера экрана (этап 4), превью (№30) и
// HTML→PDF (№8). Проход MEASURE → WRAP → EMIT выполняют measure.ts / wrap.ts /
// emit.ts; фасад фиксирует контракт вызова: целевая ширина передаётся опциями
// { widthChars } в символах (№32, №23), лента обходится в порядке следования
// строк модели (№6) — таб-строки раскладываются, текст-строки проводятся
// насквозь (их перенос — забота рендерера, №32).
// Слой Domain (R1): без I/O и фреймворков; детерминированная функция
// (модель, ширина) — повторный вызов даёт идентичную геометрию (№14).
// Генератора id у движка нет: он ничего не создаёт, id рождаются в модели (№19).

import type { Notebook } from '../tabulature/types';
import { layoutNotebook as runLayoutPass } from './emit';
import type { NotebookLayout } from './types';

// Публичный словарь результата (types.ts) и шаги прохода — одна поверхность
// импорта для потребителей движка (№14: геометрия пишется один раз).
export type {
  LaidOutColumn,
  LaidOutColumnText,
  LaidOutSystem,
  NotebookLayout,
  RibbonLayoutEntry,
  TabLineLayout,
  TextLineLayout,
} from './types';
export { columnWidthChars, systemCapacity } from './measure';
export { wrapTabLine } from './wrap';
export type { WrapColumn, WrapSystem } from './wrap';
export { emitStringYChars, emitSystem, layoutTabLine } from './emit';
export {
  MAX_COLUMN_WIDTH_CHARS,
  MIN_COLUMN_WIDTH_CHARS,
  ROW_SPACING_CHARS,
  STRIP_WIDTH_FRACTION,
  TEXT_ROW_SPACING_CHARS,
} from './config';

/**
 * Опции прохода (№23): целевая ширина потребителя — экран/A4/превью —
 * в символах, advance моноширинного шрифта цифр лада (№32).
 */
export interface LayoutNotebookOptions {
  /** Целевая ширина в символах; полоса систем — floor(85% от неё, №20). */
  readonly widthChars: number;
}

/**
 * Полный проход движка по тетради (№14, №23): каждая строка ленты раскладывается
 * независимо от остальных (№28), порядок ленты модели сохранён (№6). Таб-строка —
 * MEASURE → WRAP → EMIT (№20, №18, №24); текст-строка — pass-through (№6).
 *
 * @param notebook тетрадь — корневой агрегат модели (валидность предпоставлена)
 * @param options целевая ширина потребителя, см. LayoutNotebookOptions
 * @returns layout тетради (NotebookLayout, types.ts)
 */
export function layoutNotebook(notebook: Notebook, options: LayoutNotebookOptions): NotebookLayout {
  return runLayoutPass(notebook, options.widthChars);
}
