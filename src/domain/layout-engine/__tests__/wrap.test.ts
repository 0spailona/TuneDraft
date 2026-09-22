// Юнит-тесты переноса таб-строки (этап 3, №34): таблица решений №20 —
// «порядок значим» (сокращение пустого хвоста предшествует переносу) —
// и правило такта №18/№36 (разрез только сразу после колонки-черты,
// такт переезжает целиком, такт шире ёмкости занимает систему без разрыва).
// Данные синтетические: колонки-заглушки с явными ширинами.

import type { EntityId } from '../../tabulature/types';
import type { WrapColumn } from '../wrap';
import { wrapTabLine } from '../wrap';

// ─── Помощники ──────────────────────────────────────────────────────────────

/** Спецификация синтетической колонки: вид, ширина, признак пустоты (№20). */
interface Spec {
  readonly kind: 'content' | 'barline';
  readonly widthChars: number;
  readonly isEmpty?: boolean;
}

/** Счётчик id: детерминированные идентификаторы c-1, c-2, … (№19). */
let nextId = 0;

/** Строит колонки и карту ширин из спецификации: вход `wrapTabLine`. */
function synth(specs: readonly Spec[]): {
  columns: WrapColumn[];
  widths: Map<EntityId, number>;
} {
  // Счётчик сбрасывается на каждый вызов: id уникальны внутри одного
  // вызова `wrapTabLine`, ожидания в тестах стабильны (c-1, c-2, …).
  nextId = 0;
  const columns: WrapColumn[] = [];
  const widths = new Map<EntityId, number>();
  for (const spec of specs) {
    const id = `c-${++nextId}`;
    columns.push({ columnId: id, kind: spec.kind, isEmpty: spec.isEmpty ?? false });
    widths.set(id, spec.widthChars);
  }
  return { columns, widths };
}

/** Суммарная ширина системы по карте ширин — для проверок ёмкости (№20). */
function systemWidth(system: readonly EntityId[], widths: Map<EntityId, number>): number {
  return system.reduce((sum, id) => sum + (widths.get(id) ?? 0), 0);
}

/**
 * Разрезы только по границам тактов (№18): порядок модели сохранён, каждая
 * не-последняя система кончается колонкой-чертой (разрез — сразу после черты).
 */
function expectBreaksOnlyAfterBarlines(
  systems: readonly (readonly EntityId[])[],
  columns: readonly WrapColumn[],
): void {
  expect(systems.flat()).toEqual(columns.map((col) => col.columnId));
  const byId = new Map(columns.map((col) => [col.columnId, col]));
  for (let i = 0; i < systems.length - 1; i++) {
    const lastId = systems[i][systems[i].length - 1];
    expect(byId.get(lastId)?.kind).toBe('barline');
  }
}

// ─── (a) Влезает — одна система ─────────────────────────────────────────────

describe('(a) строка влезает в ёмкость', () => {
  it('сумма ширин ≤ ёмкости → одна система со всеми колонками (№20)', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 2 },
      { kind: 'content', widthChars: 4 },
      { kind: 'barline', widthChars: 2 },
    ]);
    expect(wrapTabLine(columns, widths, 10)).toEqual([['c-1', 'c-2', 'c-3']]);
  });

  it('влезает ровно впритык → одна система', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 4 },
      { kind: 'barline', widthChars: 2 },
    ]);
    expect(wrapTabLine(columns, widths, 10)).toEqual([['c-1', 'c-2', 'c-3']]);
  });

  it('влезающая строка не сокращается, даже если хвост пустой (порядок №20)', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 3 },
      { kind: 'content', widthChars: 3, isEmpty: true },
    ]);
    expect(wrapTabLine(columns, widths, 10)).toEqual([['c-1', 'c-2']]);
  });

  it('пустая строка → одна пустая система (систем минимум одна)', () => {
    const { columns, widths } = synth([]);
    expect(wrapTabLine(columns, widths, 10)).toEqual([[]]);
  });
});

// ─── (b) Сокращение пустого хвоста до переноса ──────────────────────────────

describe('(b) сокращение за счёт пустых хвостов (№20)', () => {
  it('не влезает → пустые хвостовые колонки убираются, остаётся одна система', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 3, isEmpty: true },
      { kind: 'content', widthChars: 3, isEmpty: true },
    ]);
    // 14 > 10 → хвост сокращается до 8 ≤ 10; переноса нет.
    expect(wrapTabLine(columns, widths, 10)).toEqual([['c-1', 'c-2']]);
  });

  it('сокращается минимальный хвост: убирается столько колонок, сколько нужно', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 2, isEmpty: true },
      { kind: 'content', widthChars: 2, isEmpty: true },
    ]);
    // 12 > 10 → одной пустой мало (10 ≤ 10 — влезает!)… убирается одна: 10 ≤ 10.
    expect(wrapTabLine(columns, widths, 10)).toEqual([['c-1', 'c-2', 'c-3']]);
  });

  it('хвост непустых колонок не трогается: пустых нет → перенос', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
    ]);
    // Сокращать нечего (хвост — черта), такты: |c1 b2| = 4, |c3 b4| = 4, |c5 b6| = 4.
    // Жадно: 4+4 = 8 ≤ 10 → система 1; 8+4 > 10 → система 2.
    expect(wrapTabLine(columns, widths, 10)).toEqual([
      ['c-1', 'c-2', 'c-3', 'c-4'],
      ['c-5', 'c-6'],
    ]);
  });

  it('внутренние пустые колонки не удаляются — только хвост (№20)', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 3, isEmpty: true },
      { kind: 'content', widthChars: 4 },
    ]);
    // Хвост (c-3) непустой → сокращать нечего; черт нет → строка не рвётся (№36).
    expect(wrapTabLine(columns, widths, 8)).toEqual([['c-1', 'c-2', 'c-3']]);
  });
});

// ─── (c) Перенос: такт не рвётся ────────────────────────────────────────────

describe('(c) перенос рвёт строку только по границам тактов (№18)', () => {
  it('ни одна система не кончается внутри такта — разрез сразу после черты', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
    ]);
    const systems = wrapTabLine(columns, widths, 10);
    // Такты: [c1..c3]=6, [c4 c5]=4, [c6..c8]=6. Жадно: 6+4 = 10 ≤ 10,
    // +6 > 10 → система 1 = первые два такта, система 2 = третий.
    expect(systems).toEqual([
      ['c-1', 'c-2', 'c-3', 'c-4', 'c-5'],
      ['c-6', 'c-7', 'c-8'],
    ]);
    expectBreaksOnlyAfterBarlines(systems, columns);
    for (const system of systems) {
      expect(systemWidth(system, widths)).toBeLessThanOrEqual(10);
    }
  });

  it('замыкающий такт без завершающей черты переезжает целиком', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 3 },
      { kind: 'content', widthChars: 3 },
      { kind: 'content', widthChars: 3 },
    ]);
    const systems = wrapTabLine(columns, widths, 8);
    // Такты: |c1 b2| = 4 и хвост c3..c5 = 9 (без черты). 4+9 > 8 → хвост
    // переезжает целиком, хотя начни он систему один — тоже 9 > 8.
    expect(systems).toEqual([
      ['c-1', 'c-2'],
      ['c-3', 'c-4', 'c-5'],
    ]);
    expectBreaksOnlyAfterBarlines(systems, columns);
  });
});

// ─── (d) Черт нет — строка не рвётся вовсе ──────────────────────────────────

describe('(d) строка без черт = один такт = не рвётся (№36)', () => {
  it('переполнение без черт и без пустого хвоста → одна система с перепуском', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 4 },
    ]);
    // 12 > 6, сокращать нечего, черт нет: рвать некорректно (№36) → перепуск.
    expect(wrapTabLine(columns, widths, 6)).toEqual([['c-1', 'c-2', 'c-3']]);
  });

  it('после сокращения хвоста строка без черт всё равно одна система', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 4 },
      { kind: 'content', widthChars: 3, isEmpty: true },
    ]);
    // 11 > 6 → хвост c-3 убирается (№20) → 8 > 6, черт нет → не рвётся.
    expect(wrapTabLine(columns, widths, 6)).toEqual([['c-1', 'c-2']]);
  });
});

// ─── (e) Несколько тактов распределяются по системам жадно ──────────────────

describe('(e) жадное распределение тактов по системам (№18)', () => {
  it('такты копятся в системе, пока влезают; переполнение открывает новую', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
    ]);
    const systems = wrapTabLine(columns, widths, 10);
    // Такты по 4: 4+4 = 8 ≤ 10, +4 = 12 > 10 → системы [такт1, такт2], [такт3, такт4].
    expect(systems).toEqual([
      ['c-1', 'c-2', 'c-3', 'c-4'],
      ['c-5', 'c-6', 'c-7', 'c-8'],
    ]);
    expectBreaksOnlyAfterBarlines(systems, columns);
  });

  it('такты разной ширины: система добивается максимально, хвост — отдельно', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 3 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 4 },
      { kind: 'barline', widthChars: 2 },
    ]);
    const systems = wrapTabLine(columns, widths, 9);
    // Такты: 5, 4, 6. Жадно: 5+4 = 9 ≤ 9; +6 > 9 → [5,4], [6].
    expect(systems).toEqual([
      ['c-1', 'c-2', 'c-3', 'c-4'],
      ['c-5', 'c-6'],
    ]);
    expectBreaksOnlyAfterBarlines(systems, columns);
    expect(systemWidth(systems[0], widths)).toBe(9);
    expect(systemWidth(systems[1], widths)).toBe(6);
  });
});

// ─── (f) Такт шире ёмкости — своя система без разрыва ───────────────────────

describe('(f) такт шире ёмкости занимает систему целиком (№18)', () => {
  it('широкий такт не рвётся: перепуск по ширине допускается', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 2 },
      { kind: 'barline', widthChars: 2 },
    ]);
    const systems = wrapTabLine(columns, widths, 8);
    // Такт 1 = 10 > 8 → занимает систему 1 целиком; такт 2 = 4 → система 2.
    expect(systems).toEqual([
      ['c-1', 'c-2', 'c-3', 'c-4', 'c-5'],
      ['c-6', 'c-7'],
    ]);
    expectBreaksOnlyAfterBarlines(systems, columns);
    expect(systemWidth(systems[0], widths)).toBe(10);
    expect(systemWidth(systems[1], widths)).toBeLessThanOrEqual(8);
  });

  it('несколько широких тактов — каждый в своей системе, порядок сохранён', () => {
    const { columns, widths } = synth([
      { kind: 'content', widthChars: 5 },
      { kind: 'barline', widthChars: 2 },
      { kind: 'content', widthChars: 5 },
      { kind: 'barline', widthChars: 2 },
    ]);
    const systems = wrapTabLine(columns, widths, 6);
    // Оба такта по 7 > 6: каждый — отдельная система без разрыва.
    expect(systems).toEqual([
      ['c-1', 'c-2'],
      ['c-3', 'c-4'],
    ]);
    expectBreaksOnlyAfterBarlines(systems, columns);
  });
});

// ─── Контракт вызова ─────────────────────────────────────────────────────────

describe('контракт wrapTabLine', () => {
  it('отсутствие ширины колонки — дефект вызова, а не тихий перенос', () => {
    const { columns, widths } = synth([{ kind: 'content', widthChars: 4 }]);
    widths.delete('c-1');
    expect(() => wrapTabLine(columns, widths, 10)).toThrow('c-1');
  });
});
