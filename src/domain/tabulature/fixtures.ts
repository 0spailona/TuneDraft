// Валидные фикстуры-тетради (этап 2): тест-данные для юнит-тестов модели
// и будущих фикстур layout-движка (этап 3). Строятся публичными фабриками
// и операциями модели — фикстура валидна по построению и проверяется
// validateNotebook в тестах (№34). Детерминированные id — общий генератор.

import type { ModelResult, Notebook } from './types';
import { createIdGenerator } from './ids';
import {
  addColumnText,
  appendLine,
  createNotebook,
  createTabLine,
  createTextLine,
  insertNote,
  setBarline,
} from './model';

/**
 * Распаковка результата операции для фикстур: операции модели возвращают
 * ошибки значениями; фикстура по построению корректна, поэтому отказ —
 * это дефект самой фикстуры, и его видно сразу (throw в сборке тест-данных,
 * не в доменной логике — конвенция «ошибки значениями» не нарушается).
 */
function must<T>(result: ModelResult<T>): T {
  if (!result.ok) {
    throw new Error(`фикстура сломана: ${result.error.message}`);
  }
  return result.value;
}

/**
 * Пустая тетрадь: только корневые поля (version, id, name, albumId) и
 * пустая лента. Минимальный валидный агрегат.
 */
export function emptyNotebookFixture(): Notebook {
  return createNotebook('Пустая тетрадь', createIdGenerator());
}

/**
 * Демонстрационная тетрадь «Басовая разминка»: лента со всеми видами строк
 * и сущностей — до первой таб-строки, между и после таб-строк текст-строки
 * (№6); таб-строки с аккордами (несколько нот в колонке, №20), одиночными
 * нотами, тактовыми чертами (№18) и текстами колонок ≤ 3 (№6, №24).
 *
 * Схема ленты:
 *   текст-строка  «Разминка: 1-я позиция»      (до первой таб-строки, №6)
 *   таб-строка    A: | 0 3 5 | 0 3 5 + аккорд   (черта, ноты, черта, аккорд)
 *                 тексты колонок: под колонкой с аккордом (2 шт ≤ 3)
 *   текст-строка  «Переход на A»                (между таб-строками, №6)
 *   таб-строка    B: ноты + текст колонки
 *   текст-строка  «Проверь звучание»            (после последней таб-строки, №6)
 */
export function demoNotebookFixture(): Notebook {
  const gen = createIdGenerator();
  let nb = createNotebook('Басовая разминка', gen);

  // Текст-строка до первой таб-строки (№6).
  nb = appendLine(nb, createTextLine('Разминка: 1-я позиция', gen));

  // Таб-строка A: 9 колонок — | 0 3 5 | 0 3 5 | + финальный аккорд.
  const lineA = createTabLine(9, gen);
  nb = appendLine(nb, lineA);
  const tabA = lineA.id;
  const colA = (i: number): string => lineA.columns[i].id;
  nb = must(setBarline(nb, tabA, colA(0)));
  const scale = [5, 3, 0, 5, 3, 0];
  for (let i = 0; i < scale.length; i++) {
    // Ноты на струне G (index 3) — ходы 0-3-5 по гамме E (№3).
    nb = must(
      insertNote(nb, { lineId: tabA, columnId: colA(i + 1), stringIndex: 3 }, scale[i], gen),
    );
  }
  nb = must(setBarline(nb, tabA, colA(7)));
  // Аккорд E1+A1 в последней колонке (№20: одновременно играемые ноты).
  nb = must(insertNote(nb, { lineId: tabA, columnId: colA(8), stringIndex: 0 }, 0, gen));
  nb = must(insertNote(nb, { lineId: tabA, columnId: colA(8), stringIndex: 1 }, 0, gen));
  // Тексты колонок под аккордом (№24): 2 из 3 допустимых.
  nb = must(addColumnText(nb, tabA, colA(8), 'E', gen));
  nb = must(addColumnText(nb, tabA, colA(8), 'тоника', gen));

  // Текст-строка между таб-строками (№6).
  nb = appendLine(nb, createTextLine('Переход на A', gen));

  // Таб-строка B: ноты + текст колонки (максимальная связка без черты).
  const lineB = createTabLine(4, gen);
  nb = appendLine(nb, lineB);
  const tabB = lineB.id;
  const colB = (i: number): string => lineB.columns[i].id;
  nb = must(insertNote(nb, { lineId: tabB, columnId: colB(0), stringIndex: 0 }, 7, gen));
  nb = must(insertNote(nb, { lineId: tabB, columnId: colB(1), stringIndex: 2 }, 7, gen));
  nb = must(addColumnText(nb, tabB, colB(0), 'сустейн', gen));

  // Текст-строка после последней таб-строки (№6).
  nb = appendLine(nb, createTextLine('Проверь звучание', gen));

  return nb;
}
