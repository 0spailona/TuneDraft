// Валидные фикстуры layout-движка (этап 3, №34): тест-данные для приёмочных
// тестов прохода на целевую ширину. По образцу fixtures.ts этапа 2 —
// строятся публичными фабриками и операциями модели (createTabLine / insertNote /
// setBarline / addColumnText / createTextLine + createIdGenerator), поэтому
// фикстура валидна по построению и проверяется validateNotebook в тестах (№34).
// Сам layout id не создаёт (№19) — генератор живёт только в сборке фикстур.

import type { Notebook } from '../tabulature/types';
import { createIdGenerator } from '../tabulature/ids';
import type { IdGenerator } from '../tabulature/ids';
import {
  addColumnText,
  appendLine,
  createNotebook,
  createTabLine,
  createTextLine,
  insertNote,
  setBarline,
} from '../tabulature/model';
import type { ModelResult } from '../tabulature/types';

/**
 * Распаковка результата операции для фикстур: операции модели возвращают
 * ошибки значениями; фикстура по построению корректна, поэтому отказ —
 * это дефект самой фикстуры (throw в сборке тест-данных, не в доменной
 * логике — конвенция «ошибки значениями» не нарушается).
 */
function must<T>(result: ModelResult<T>): T {
  if (!result.ok) {
    throw new Error(`фикстура сломана: ${result.error.message}`);
  }
  return result.value;
}

/**
 * Пустая тетрадь — degenerate-фикстура: проход на любой ширине даёт пустую
 * ленту результата, ошибок нет.
 */
export function emptyNotebookFixture(): Notebook {
  return createNotebook('Пустая тетрадь', createIdGenerator());
}

/**
 * Широкая таб-строка — сборка в переданную тетрадь (общий gen: id уникальны
 * в пределах одной тетради, №19). 30 колонок с чертами и текстами колонок
 * (№6, №20): 4 такта по 6 колонок, каждый замкнут чертой (колонки 5, 11, 17,
 * 23), и замыкающий такт 24–29, финал которого — аккорд с текстами. Ширины:
 * все колонки минимальные (4), кроме аккордной — она раздвинута под текст
 * «тоника» до 6 (№24), полная ширина строки 29·4 + 6 = 122 символа.
 * На цели W ≥ 144 (полоса ≥ 122) строка влезает в одну систему; на узких
 * целях такты расходятся по двум и более системам (№18: такт не рвётся).
 */
function appendWideTabLine(nb: Notebook, gen: IdGenerator): Notebook {
  const COLUMNS = 30;
  const line = createTabLine(COLUMNS, gen);
  let result = appendLine(nb, line);
  const tab = line.id;
  const col = (i: number): string => line.columns[i].id;

  // 4 такта по 6 колонок: черта замыкает каждый — колонки 5, 11, 17, 23.
  for (let i = 5; i < COLUMNS - 1; i += 6) {
    result = must(setBarline(result, tab, col(i)));
  }
  // Ноты по гамме на струне G (index 3) во всех контентных колонках до
  // финального аккорда: ходы 0-3-5 (№3) — колонки не пустые, сокращения нет.
  const scale = [0, 3, 5];
  for (let i = 0; i < COLUMNS - 1; i++) {
    if (i % 6 === 5) {
      continue; // черта — нот нет (№18)
    }
    result = must(
      insertNote(result, { lineId: tab, columnId: col(i), stringIndex: 3 }, scale[i % 3], gen),
    );
  }
  // Финальный аккорд E1+A1 (№20) в замыкающей колонке (29 — контентная, черты
  // нет: такт 24–29 замыкается аккордом) с текстами колонки (№24).
  const last = col(COLUMNS - 1);
  result = must(insertNote(result, { lineId: tab, columnId: last, stringIndex: 0 }, 0, gen));
  result = must(insertNote(result, { lineId: tab, columnId: last, stringIndex: 1 }, 0, gen));
  result = must(addColumnText(result, tab, last, 'E', gen));
  result = must(addColumnText(result, tab, last, 'тоника', gen));

  return result;
}

/**
 * Тетрадь с одной широкой таб-строкой (30 колонок, см. appendWideTabLine) —
 * без текст-строк: минимальная обёртка для проверок переноса одной строки.
 */
export function wideLineNotebookFixture(): Notebook {
  const gen = createIdGenerator();
  return appendWideTabLine(createNotebook('Широкая строка', gen), gen);
}

/**
 * Демонстрационная тетрадь «Широкая разминка»: лента со всеми видами строк —
 * текст-строки до, между и после таб-строк (№6); широкая таб-строка A
 * (30 колонок, 4 такта + замыкающий, черты и тексты колонок) и короткая
 * строка B без черт (такт = вся строка, №36 — не рвётся никогда).
 *
 * Схема ленты:
 *   текст-строка  «Разминка по гамме E»          (до первой таб-строки)
 *   таб-строка    A: широкая, 5 тактов + аккорд (см. wideLineNotebookFixture)
 *   текст-строка  «Переход на A»                 (между таб-строками)
 *   таб-строка    B: короткая, без черт — такт = вся строка (№36)
 *   текст-строка  «Проверь звучание»             (после последней таб-строки)
 */
export function demoNotebookFixture(): Notebook {
  const gen = createIdGenerator();
  let nb = createNotebook('Широкая разминка', gen);

  // Текст-строка до первой таб-строки (№6).
  nb = appendLine(nb, createTextLine('Разминка по гамме E', gen));

  // Таб-строка A: широкая, собирается тем же генератором — id уникальны
  // в пределах тетради (№19).
  nb = appendWideTabLine(nb, gen);

  // Текст-строка между таб-строками (№6).
  nb = appendLine(nb, createTextLine('Переход на A', gen));

  // Таб-строка B: короткая без черт — ноты + текст колонки (максимальная
  // связка без черты); такт = вся строка (№36), перенос невозможен (№18).
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

/**
 * Вырожденные цели (№20): нулевая и отрицательная ширина — полоса 0, ёмкость 0.
 * Пустые таб-строки остаются одной пустой системой (wrap.ts, №20); непустые
 * такты открывают системы по одному (перепуск допускается, №18) — проход
 * тотален: ошибок нет, системы ≥ 1 на строку.
 */
export const DEGENERATE_WIDTHS: readonly number[] = [0, -40];
