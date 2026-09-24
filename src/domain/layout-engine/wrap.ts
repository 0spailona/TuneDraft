// Переполнение таб-строки (этап 3 дорожной карты): сокращение и перенос.
// Спека: docs/specs/domains/layout-engine.md (Flow, шаг 2 WRAP) и таблица
// решений №20 — «порядок значим»: сокращение за счёт пустых хвостов всегда
// предшествует переносу на новую систему. Такт переезжает целиком (№18, №36):
// точка разреза разрешена только сразу после колонки-черты (черта завершает
// такт); черт нет — такт = вся строка, и строка не рвётся вовсе.
// Слой Domain (R1): чистая функция без I/O (№14); движок модель не меняет (№23) —
// «сокращение» здесь означает лишь невывод хвостовых пустых колонок в layout.

import type { EntityId } from '../tabulature/types';

/**
 * Колонка на входе переноса: идентификатор, вид (№18) и признак пустоты.
 * Пустая колонка (№20) — контентная без нот и текстов: единственный
 * кандидат на сокращение хвоста. Черта не пуста по виду (вертикальная
 * линия рисуется всегда), колонка с нотами или текстами хранит контент,
 * который нельзя исчезнуть из layout (№24: тексты едут с колонкой).
 */
export interface WrapColumn {
  readonly columnId: EntityId;
  readonly kind: 'content' | 'barline';
  /** Пуста ли колонка: контентная без нот и без текстов (№20). */
  readonly isEmpty: boolean;
}

/**
 * Система результата переноса: подсписок columnId в порядке модели.
 * Сумма ширин системы ≤ ёмкости — кроме вырожденного случая (№18):
 * такт шире ёмкости занимает собственную систему целиком, перепуск
 * по ширине допускается, разрыв внутри такта запрещён.
 */
export type WrapSystem = readonly EntityId[];

/**
 * Перенос одной таб-строки по ёмкости системы (№20, №18, №36). Порядок
 * решений таблицы №20 значим:
 *
 * 1. влезает — одна система (хвост не трогается, даже если он пустой);
 * 2. не влезает → пока в конце есть пустые колонки — удалять их из layout,
 *    пока строка не влезет; влезло после сокращения — снова одна система;
 * 3. пустого хвоста нет → перенос: строка рвётся только по границам тактов.
 *    Такт = диапазон черта → черта (черта завершает такт, №18/№36); разрез
 *    разрешён только сразу после колонки-черты; хвост после последней черты —
 *    замыкающий такт. Черт нет вовсе — такт = вся строка, переноса не будет.
 *    Такт шире ёмкости занимает систему целиком (перепуск допускается).
 *
 * Такты распределяются по системам жадно: текущая система копит такты,
 * пока влезают; первый не влезший такт открывает следующую систему.
 *
 * @param columns  колонки таб-строки в порядке модели
 * @param widths   ширины колонок в символах по columnId (шаг MEASURE, №20/№24)
 * @param capacity ёмкость системы в символах (ширина полосы ленты, №20)
 * @returns список систем — списков columnId; минимум одна (даже пустая строка)
 */
export function wrapTabLine(
  columns: readonly WrapColumn[],
  widths: ReadonlyMap<EntityId, number>,
  capacity: number,
): readonly WrapSystem[] {
  const widthOf = (columnId: EntityId): number => {
    const width = widths.get(columnId);
    if (width === undefined) {
      // Внутренний контракт прохода (MEASURE → WRAP): ширина каждой колонки
      // посчитана раньше. Отсутствие — дефект вызова, а не доменный отказ.
      throw new Error(`wrapTabLine: нет ширины для колонки ${columnId}`);
    }
    return width;
  };

  const totalWidth = (cols: readonly WrapColumn[]): number =>
    cols.reduce((sum, col) => sum + widthOf(col.columnId), 0);
  const toIds = (cols: readonly WrapColumn[]): EntityId[] => cols.map((col) => col.columnId);

  // Пустая строка — одна пустая система: систем минимум одна (types.ts, №20).
  if (columns.length === 0) {
    return [[]];
  }

  // (1) Влезает — одна система (№20): хвост не сокращается, даже пустой.
  if (totalWidth(columns) <= capacity) {
    return [toIds(columns)];
  }

  // (2) Сокращение (№20): пока не влезает и в конце пустая колонка — убираем
  // её из layout. Останавливаемся на первой непустой или на влезании.
  const shrunk = [...columns];
  while (totalWidth(shrunk) > capacity && shrunk.length > 0 && shrunk[shrunk.length - 1].isEmpty) {
    shrunk.pop();
  }
  if (totalWidth(shrunk) <= capacity) {
    return [toIds(shrunk)];
  }

  // (3) Перенос (№18, №36): рвём только по границам тактов — сразу после черты.
  const systems: WrapSystem[] = [];
  let current: EntityId[] = [];
  let currentWidth = 0;
  for (const measure of splitIntoMeasures(shrunk)) {
    const measureWidth = totalWidth(measure);
    if (current.length === 0) {
      // Такт открывает систему, даже если он шире ёмкости (№18):
      // перепуск допускается, разрыв внутри такта запрещён.
      current = toIds(measure);
      currentWidth = measureWidth;
    } else if (currentWidth + measureWidth <= capacity) {
      current = [...current, ...toIds(measure)];
      currentWidth += measureWidth;
    } else {
      systems.push(current);
      current = toIds(measure);
      currentWidth = measureWidth;
    }
  }
  if (current.length > 0) {
    systems.push(current);
  }
  return systems;
}

/**
 * Разрез колонок на такты (№18, №36): такт — диапазон от предыдущей черты
 * до следующей включительно (черта завершает такт); хвост после последней
 * черты — замыкающий такт без завершающей черты. Черт нет вовсе — вся
 * строка один такт: строка без черт не рвётся никогда (№36).
 */
function splitIntoMeasures(columns: readonly WrapColumn[]): readonly (readonly WrapColumn[])[] {
  if (columns.length === 0) {
    return [];
  }
  if (!columns.some((col) => col.kind === 'barline')) {
    return [columns];
  }
  const measures: (readonly WrapColumn[])[] = [];
  let current: WrapColumn[] = [];
  for (const col of columns) {
    current = [...current, col];
    if (col.kind === 'barline') {
      measures.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    measures.push(current);
  }
  return measures;
}
