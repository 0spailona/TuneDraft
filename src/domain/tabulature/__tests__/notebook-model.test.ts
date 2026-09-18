// Юнит-тесты модели тетради (этап 2, №34): сводка валидации из
// docs/specs/domains/tabulature/notebook-model.md — «intended contract
// of stage-2 model unit tests». Конвенции: ошибки — значения (не throw),
// id стабильны и уникальны (№19), мутации иммутабельны.

import type { Column, ModelResult, Notebook, TabLine } from '../types';
import { DEFAULT_DURATION, FORMAT_VERSION, MAX_COLUMN_TEXTS } from '../types';
import { createIdGenerator } from '../ids';
import {
  addColumnText,
  clearBarline,
  clearColumn,
  createNotebook,
  createTabLine,
  deleteColumn,
  editColumnText,
  editNoteFret,
  insertColumn,
  insertNote,
  removeColumnText,
  removeNote,
  setBarline,
  validateNotebook,
  appendLine,
} from '../model';
import { demoNotebookFixture, emptyNotebookFixture } from '../fixtures';

// ─── Помощники ──────────────────────────────────────────────────────────────

/** Распаковка ok-результата в цепочках мутаций (отказ = падение теста). */
function must<T>(result: ModelResult<T>): T {
  if (!result.ok) {
    throw new Error(`ожидали ok: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

function expectOk<T>(result: { ok: boolean; error?: unknown }): asserts result is { ok: true; value: T } {
  if (!result.ok) {
    throw new Error(`ожидали ok, получили отказ: ${JSON.stringify(result.error)}`);
  }
}

function expectErr(result: ModelResult<unknown>, code: string): void {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(code);
  }
}

/** Тетрадь с одной таб-строкой на 4 колонки — база большинства кейсов. */
function baseNotebook(): { nb: Notebook; line: TabLine } {
  const gen = createIdGenerator();
  let nb = createNotebook('Тестовая', gen);
  const line = createTabLine(4, gen);
  nb = appendLine(nb, line);
  return { nb, line };
}

const columnId = (line: TabLine, i: number): string => line.columns[i].id;

// ─── Фикстуры валидны по построению ────────────────────────────────────────

describe('фикстуры (этап 2: тест-данные валидны)', () => {
  it('пустая тетрадь валидна', () => {
    const res = validateNotebook(emptyNotebookFixture());
    expectOk(res);
    expect(res.value).toBe(true);
  });

  it('демо-тетрадь валидна: все виды строк и сущностей', () => {
    const nb = demoNotebookFixture();
    expectOk(validateNotebook(nb));
    // Лента: текст | таб | текст | таб | текст — текст-строки до, между и после (№6).
    const kinds = nb.lines.map((l) => l.kind);
    expect(kinds).toEqual(['text', 'tab', 'text', 'tab', 'text']);
  });

  it('демо-тетрадь содержит аккорд, черты и тексты колонок', () => {
    const nb = demoNotebookFixture();
    const tabLines = nb.lines.filter((l): l is TabLine => l.kind === 'tab');
    const barlines = tabLines.flatMap((l) => l.columns.filter((c) => c.kind === 'barline'));
    expect(barlines.length).toBeGreaterThanOrEqual(2);
    const chord = tabLines[0].columns.find(
      (c) => c.notes.length >= 2,
    ) as Column;
    expect(chord.notes.length).toBe(2);
    const texts = tabLines[0].texts.filter((t) => t.columnId === chord.id);
    expect(texts.length).toBe(2);
    expect(texts.length).toBeLessThanOrEqual(MAX_COLUMN_TEXTS);
  });
});

// ─── Корневые поля ──────────────────────────────────────────────────────────

describe('корневые поля тетради (№22, №29, №30)', () => {
  it('createNotebook ставит version, id, name, albumId=null и пустую ленту', () => {
    const nb = createNotebook('Моя тетрадь');
    expect(nb.version).toBe(FORMAT_VERSION);
    expect(nb.id).toMatch(/^nb-/);
    expect(nb.name).toBe('Моя тетрадь');
    expect(nb.albumId).toBeNull();
    expect(nb.lines).toEqual([]);
  });

  it('createTabLine: колонки пустые, контентные, строй E1 A1 D2 G2', () => {
    const line = createTabLine(3);
    expect(line.kind).toBe('tab');
    expect(line.tuning).toEqual([28, 33, 38, 43]);
    expect(line.columns).toHaveLength(3);
    for (const c of line.columns) {
      expect(c.kind).toBe('content');
      expect(c.notes).toEqual([]);
    }
  });
});

// ─── Ноты (№3, №19, №20, №21) ───────────────────────────────────────────────

describe('вставка и правка нот', () => {
  it('вставляет ноту: свежий id, duration по умолчанию quarter (№4)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const res = insertNote(
      nb,
      { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 },
      7,
      gen,
    );
    expectOk(res);
    const note = res.value.lines[0] as TabLine;
    expect(note.columns[0].notes).toHaveLength(1);
    const n = (note.columns[0] as Column).notes[0];
    expect(n).toMatchObject({ stringIndex: 0, fret: 7, duration: DEFAULT_DURATION });
    expect(n.id).toMatch(/^n-/);
  });

  it('иммутабельность: исходная тетрадь не меняется', () => {
    const { nb, line } = baseNotebook();
    const before = JSON.stringify(nb);
    insertNote(
      nb,
      { lineId: line.id, columnId: columnId(line, 1), stringIndex: 1 },
      5,
      createIdGenerator(),
    );
    expect(JSON.stringify(nb)).toBe(before);
  });

  it('граничные лады 0 и 24 допустимы (№3)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const a = insertNote(nb, { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 }, 0, gen);
    const b = insertNote(nb, { lineId: line.id, columnId: columnId(line, 1), stringIndex: 0 }, 24, gen);
    expectOk(a);
    expectOk(b);
  });

  it('лад вне 0–24 и нецелый — отказ fret-out-of-range (№3)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    for (const bad of [-1, 25, 3.5, NaN]) {
      const res = insertNote(nb, { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 }, bad, gen);
      expectErr(res, 'fret-out-of-range');
    }
  });

  it('одна нота на струну в колонке: вторая — отказ cell-not-empty (№20)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const target = { lineId: line.id, columnId: columnId(line, 0), stringIndex: 2 };
    const withNote = must(insertNote(nb, target, 3, gen));
    expectErr(insertNote(withNote, target, 5, gen), 'cell-not-empty');
  });

  it('аккорд: ноты на разных струнах одной колонки — ок (№20)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const col = columnId(line, 0);
    expectOk(insertNote(nb, { lineId: line.id, columnId: col, stringIndex: 0 }, 0, gen));
    expectOk(insertNote(nb, { lineId: line.id, columnId: col, stringIndex: 1 }, 0, gen));
    expectOk(insertNote(nb, { lineId: line.id, columnId: col, stringIndex: 3 }, 2, gen));
  });

  it('струна вне строя — отказ string-index-out-of-range', () => {
    const { nb, line } = baseNotebook();
    for (const bad of [-1, 4, 100]) {
      const res = insertNote(
        nb,
        { lineId: line.id, columnId: columnId(line, 0), stringIndex: bad },
        1,
        createIdGenerator(),
      );
      expectErr(res, 'string-index-out-of-range');
    }
  });

  it('вставка в колонку-черту — отказ column-is-barline (№18)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const withBar = setBarline(nb, line.id, columnId(line, 2));
    expectOk(withBar);
    const res = insertNote(
      withBar.value,
      { lineId: line.id, columnId: columnId(line, 2), stringIndex: 0 },
      1,
      gen,
    );
    expectErr(res, 'column-is-barline');
  });

  it('editNoteFret меняет лад, id сохраняется (№21)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const target = { lineId: line.id, columnId: columnId(line, 0), stringIndex: 1 };
    const inserted = insertNote(nb, target, 3, gen);
    expectOk(inserted);
    const idBefore = ((inserted.value.lines[0] as TabLine).columns[0] as Column).notes[0].id;
    const edited = editNoteFret(inserted.value, target, 12);
    expectOk(edited);
    const note = ((edited.value.lines[0] as TabLine).columns[0] as Column).notes[0];
    expect(note.fret).toBe(12);
    expect(note.id).toBe(idBefore);
  });

  it('removeNote очищает ячейку, колонка остаётся (№20, №21)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const target = { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 };
    const withNote = insertNote(nb, target, 9, gen);
    expectOk(withNote);
    const removed = removeNote(withNote.value, target);
    expectOk(removed);
    const col = ((removed.value.lines[0] as TabLine).columns[0] as Column);
    expect(col.notes).toHaveLength(0);
    expect(removed.value.lines[0].id).toBe(line.id);
    expect((removed.value.lines[0] as TabLine).columns).toHaveLength(4);
    // Ячейка снова доступна для вставки (пауза — самостоятельная сущность).
    expectOk(insertNote(removed.value, target, 2, gen));
  });

  it('правка/удаление в пустой ячейке — отказ note-not-found', () => {
    const { nb, line } = baseNotebook();
    const target = { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 };
    expectErr(editNoteFret(nb, target, 5), 'note-not-found');
    expectErr(removeNote(nb, target), 'note-not-found');
  });
});

// ─── Тактовые черты (№18, №35) ──────────────────────────────────────────────

describe('тактовые черты', () => {
  it('setBarline на пустую колонку — ок; повторно — отказ (№18)', () => {
    const { nb, line } = baseNotebook();
    const res = setBarline(nb, line.id, columnId(line, 1));
    expectOk(res);
    const col = (res.value.lines[0] as TabLine).columns[1];
    expect(col.kind).toBe('barline');
    expectErr(setBarline(res.value, line.id, columnId(line, 1)), 'column-is-not-barline');
  });

  it('setBarline на колонку с нотами — отказ (№18)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const withNote = insertNote(
      nb,
      { lineId: line.id, columnId: columnId(line, 1), stringIndex: 0 },
      1,
      gen,
    );
    expectOk(withNote);
    expectErr(setBarline(withNote.value, line.id, columnId(line, 1)), 'barline-column-not-empty');
  });

  it('setBarline на колонку с текстами — отказ (№18: в черте текстов нет)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const withText = addColumnText(nb, line.id, columnId(line, 1), 'комментарий', gen);
    expectOk(withText);
    expectErr(setBarline(withText.value, line.id, columnId(line, 1)), 'barline-column-not-empty');
  });

  it('clearBarline возвращает пустую контентную колонку, id сохраняется (№35)', () => {
    const { nb, line } = baseNotebook();
    const bar = setBarline(nb, line.id, columnId(line, 2));
    expectOk(bar);
    const idBefore = (bar.value.lines[0] as TabLine).columns[2].id;
    const cleared = clearBarline(bar.value, line.id, columnId(line, 2));
    expectOk(cleared);
    const col = (cleared.value.lines[0] as TabLine).columns[2];
    expect(col.kind).toBe('content');
    expect(col.id).toBe(idBefore);
    expect(col.notes).toEqual([]);
  });

  it('clearBarline на контентной колонке — отказ column-is-barline', () => {
    const { nb, line } = baseNotebook();
    expectErr(clearBarline(nb, line.id, columnId(line, 0)), 'column-is-barline');
  });
});

// ─── Колонки (№35) и каскад (№19) ───────────────────────────────────────────

describe('операции с колонками', () => {
  it('insertColumn слева/справа: пустая контентная колонка в нужном месте', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const left = insertColumn(nb, line.id, columnId(line, 1), 'left', gen);
    expectOk(left);
    const colsL = (left.value.lines[0] as TabLine).columns;
    expect(colsL).toHaveLength(5);
    expect(colsL[1].kind).toBe('content');
    expect(colsL[1].notes).toEqual([]);
    expect(colsL[1].id).not.toBe(columnId(line, 1));
    expect(colsL[2].id).toBe(columnId(line, 1)); // исходная колонка сместилась вправо

    const right = insertColumn(left.value, line.id, columnId(line, 0), 'right', gen);
    expectOk(right);
    const colsR = (right.value.lines[0] as TabLine).columns;
    expect(colsR).toHaveLength(6);
    expect(colsR[1].kind).toBe('content');
    expect(colsR[0].id).toBe(columnId(line, 0));
  });

  it('clearColumn удаляет ноты и тексты, колонка остаётся (№35)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const col = columnId(line, 0);
    let cur = nb;
    cur = must(insertNote(cur, { lineId: line.id, columnId: col, stringIndex: 0 }, 3, gen));
    cur = must(addColumnText(cur, line.id, col, 'текст', gen));
    const cleared = clearColumn(cur, line.id, col);
    expectOk(cleared);
    const tab = cleared.value.lines[0] as TabLine;
    expect(tab.columns.some((c) => c.id === col)).toBe(true);
    expect(tab.columns.find((c) => c.id === col)?.notes).toHaveLength(0);
    expect(tab.texts.filter((t) => t.columnId === col)).toHaveLength(0);
  });

  it('clearColumn для черты = снять черту (№35, №18)', () => {
    const { nb, line } = baseNotebook();
    const bar = setBarline(nb, line.id, columnId(line, 0));
    expectOk(bar);
    const cleared = clearColumn(bar.value, line.id, columnId(line, 0));
    expectOk(cleared);
    expect((cleared.value.lines[0] as TabLine).columns[0].kind).toBe('content');
  });

  it('deleteColumn: каскадно удаляет ноты и тексты, соседние не задеты (№19)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const victim = columnId(line, 1);
    const neighbour = columnId(line, 2);
    let cur = nb;
    cur = must(insertNote(cur, { lineId: line.id, columnId: victim, stringIndex: 0 }, 5, gen));
    cur = must(addColumnText(cur, line.id, victim, 'уходит с колонкой', gen));
    cur = must(addColumnText(cur, line.id, neighbour, 'остаётся', gen));
    const deleted = deleteColumn(cur, line.id, victim);
    expectOk(deleted);
    const tab = deleted.value.lines[0] as TabLine;
    expect(tab.columns.some((c) => c.id === victim)).toBe(false);
    expect(tab.texts.filter((t) => t.columnId === victim)).toHaveLength(0);
    expect(tab.texts.filter((t) => t.columnId === neighbour)).toHaveLength(1);
    expect(tab.columns).toHaveLength(3);
    expectOk(validateNotebook(deleted.value));
  });

  it('deleteColumn колонки-черты работает как обычно', () => {
    const { nb, line } = baseNotebook();
    const bar = setBarline(nb, line.id, columnId(line, 3));
    expectOk(bar);
    const deleted = deleteColumn(bar.value, line.id, columnId(line, 3));
    expectOk(deleted);
    expect((deleted.value.lines[0] as TabLine).columns).toHaveLength(3);
  });

  it('несуществующие line/column — отказы line-not-found / column-not-found', () => {
    const { nb, line } = baseNotebook();
    expectErr(setBarline(nb, 'нет-строки', columnId(line, 0)), 'line-not-found');
    expectErr(setBarline(nb, line.id, 'нет-колонки'), 'column-not-found');
  });
});

// ─── Тексты колонки (№6, №19, №35) ──────────────────────────────────────────

describe('тексты колонки', () => {
  it('addColumnText привязывает по columnId; максимум 3, 4-й — отказ (№6)', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const col = columnId(line, 0);
    let cur = nb;
    for (let i = 1; i <= MAX_COLUMN_TEXTS; i++) {
      const res = addColumnText(cur, line.id, col, `текст ${i}`, gen);
      expectOk(res);
      cur = res.value;
    }
    expect(cur.lines[0].kind === 'tab' ? (cur.lines[0] as TabLine).texts : []).toHaveLength(3);
    const fourth = addColumnText(cur, line.id, col, 'лишний', gen);
    expectErr(fourth, 'column-text-limit');
  });

  it('editColumnText меняет текст, id сохраняется; removeColumnText убирает', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const col = columnId(line, 0);
    const added = addColumnText(nb, line.id, col, 'до правки', gen);
    expectOk(added);
    const tab = added.value.lines[0] as TabLine;
    const textId = tab.texts[0].id;
    const edited = editColumnText(added.value, line.id, textId, 'после правки');
    expectOk(edited);
    const editedText = (edited.value.lines[0] as TabLine).texts[0];
    expect(editedText.text).toBe('после правки');
    expect(editedText.id).toBe(textId);
    const removed = removeColumnText(edited.value, line.id, textId);
    expectOk(removed);
    expect((removed.value.lines[0] as TabLine).texts).toHaveLength(0);
  });

  it('текст в колонку-черту не добавляется (№18)', () => {
    const { nb, line } = baseNotebook();
    const bar = setBarline(nb, line.id, columnId(line, 2));
    expectOk(bar);
    expectErr(
      addColumnText(bar.value, line.id, columnId(line, 2), 'текст', createIdGenerator()),
      'column-is-barline',
    );
  });
});

// ─── Валидация агрегата (сводка notebook-model.md) ─────────────────────────

describe('validateNotebook ловит нарушения инвариантов', () => {
  type Mutate = (nb: Notebook) => Notebook;

  /** Валидная база → одно намеренное нарушение → invalid-notebook. */
  function expectInvalid(mutation: Mutate, fragment: string): void {
    const nb = mutation(demoNotebookFixture());
    const res = validateNotebook(nb);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('invalid-notebook');
      expect(res.error.message).toContain(fragment);
    }
  }

  const firstTab = (nb: Notebook): TabLine =>
    nb.lines.find((l): l is TabLine => l.kind === 'tab') as TabLine;

  it('лад вне диапазона (№3)', () => {
    expectInvalid(
      (nb) => ({
        ...nb,
        lines: nb.lines.map((l, i) => {
          if (i !== nb.lines.indexOf(firstTab(nb))) return l;
          const tab = l as TabLine;
          return {
            ...tab,
            columns: tab.columns.map((c) =>
              c.notes.length > 0
                ? { ...c, notes: c.notes.map((n, j) => (j === 0 ? { ...n, fret: 99 } : n)) }
                : c,
            ),
          };
        }),
      }),
      'лад вне',
    );
  });

  it('две ноты на одной струне в колонке (№20)', () => {
    expectInvalid(
      (nb) => {
        const tab = firstTab(nb);
        const col = tab.columns.find((c) => c.kind === 'content' && c.notes.length > 0) as Column;
        const doubled: Column = {
          ...col,
          notes: [...col.notes, { ...col.notes[0], id: 'n-dup-string' }],
        };
        return {
          ...nb,
          lines: nb.lines.map((l) =>
            l.kind === 'tab' && l.id === tab.id
              ? { ...tab, columns: tab.columns.map((c) => (c.id === col.id ? doubled : c)) }
              : l,
          ),
        };
      },
      'две ноты',
    );
  });

  it('4-й текст колонки (№6)', () => {
    expectInvalid(
      (nb) => {
        const tab = firstTab(nb);
        const victim = tab.columns.find(
          (c) => tab.texts.filter((t) => t.columnId === c.id).length === 2,
        );
        if (!victim) throw new Error('в демо-фикстуре нет колонки с 2 текстами');
        // У колонки уже 2 текста; добавляем ещё 2 → 4-й нарушает лимит (№6).
        const extra = [
          { id: 't-extra-3', columnId: victim.id, text: 'третий' },
          { id: 't-extra-4', columnId: victim.id, text: 'четвёртый' },
        ];
        return {
          ...nb,
          lines: nb.lines.map((l) =>
            l.kind === 'tab' && l.id === tab.id ? { ...tab, texts: [...tab.texts, ...extra] } : l,
          ),
        };
      },
      'текстов',
    );
  });

  it('columnId указывает на несуществующую колонку (№19)', () => {
    expectInvalid(
      (nb) => {
        const tab = firstTab(nb);
        const orphan = { id: 't-orphan', columnId: 'c-nope', text: 'висящий' };
        return {
          ...nb,
          lines: nb.lines.map((l) =>
            l.kind === 'tab' && l.id === tab.id ? { ...tab, texts: [...tab.texts, orphan] } : l,
          ),
        };
      },
      'не существует',
    );
  });

  it('нота без duration (№4)', () => {
    expectInvalid(
      (nb) => {
        const tab = firstTab(nb);
        return {
          ...nb,
          lines: nb.lines.map((l) => {
            if (l.kind !== 'tab' || l.id !== tab.id) return l;
            return {
              ...tab,
              columns: tab.columns.map((c) =>
                c.notes.length > 0
                  ? {
                      ...c,
                      notes: c.notes.map((n, j) =>
                        j === 0 ? { ...n, duration: '' } : n,
                      ),
                    }
                  : c,
              ),
            };
          }),
        };
      },
      'duration',
    );
  });

  it('дублирующийся id (№19)', () => {
    expectInvalid(
      (nb) => {
        const tab = firstTab(nb);
        return {
          ...nb,
          lines: nb.lines.map((l) =>
            l.kind === 'tab' && l.id === tab.id
              ? { ...tab, columns: [...tab.columns, { ...tab.columns[0] }] } // тот же id
              : l,
          ),
        };
      },
      'дублируется',
    );
  });

  it('черта с нотами (№18)', () => {
    expectInvalid(
      (nb) => {
        const tab = firstTab(nb);
        const barCol = tab.columns.find((c) => c.kind === 'barline');
        if (!barCol) throw new Error('в демо-фикстуре нет черты');
        const spoiled: Column = {
          ...barCol,
          notes: [{ id: 'n-in-bar', stringIndex: 0, fret: 1, duration: 'quarter' }],
        };
        return {
          ...nb,
          lines: nb.lines.map((l) =>
            l.kind === 'tab' && l.id === tab.id
              ? { ...tab, columns: tab.columns.map((c) => (c.id === barCol.id ? spoiled : c)) }
              : l,
          ),
        };
      },
      'содержит ноты',
    );
  });
});

// ─── Конвенция ошибок-значений (data-flow.md, EXECUTE) ──────────────────────

describe('ошибки — значения, не исключения', () => {
  it('все операции возвращают {ok:false,error} вместо throw', () => {
    const { nb, line } = baseNotebook();
    const attempts: Array<{ run: () => unknown }> = [
      { run: () => insertNote(nb, { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 }, 99, createIdGenerator()) },
      { run: () => setBarline(nb, 'nope', 'nope') },
      { run: () => deleteColumn(nb, line.id, 'nope') },
      { run: () => addColumnText(nb, 'nope', 'nope', 'x', createIdGenerator()) },
      { run: () => editNoteFret(nb, { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 }, 1) },
      { run: () => removeNote(nb, { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 }) },
    ];
    for (const a of attempts) {
      expect(() => a.run()).not.toThrow();
      const res = a.run() as { ok: boolean };
      expect(res.ok).toBe(false);
    }
  });

  it('отказ ничего не мутирует: тетрадь до == тетрадь после', () => {
    const { nb, line } = baseNotebook();
    const gen = createIdGenerator();
    const withNote = insertNote(nb, { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 }, 1, gen);
    expectOk(withNote);
    const before = JSON.stringify(withNote.value);
    const refused = insertNote(
      withNote.value,
      { lineId: line.id, columnId: columnId(line, 0), stringIndex: 0 },
      2,
      gen,
    );
    expect(refused.ok).toBe(false);
    expect(JSON.stringify(withNote.value)).toBe(before);
  });
});

// ─── Уникальность и стабильность id (№19) ──────────────────────────────────

describe('id: уникальность и стабильность (№19)', () => {
  it('все id демо-тетради уникальны', () => {
    const nb = demoNotebookFixture();
    const ids = [nb.id];
    for (const line of nb.lines) {
      ids.push(line.id);
      if (line.kind === 'tab') {
        for (const c of line.columns) {
          ids.push(c.id);
          for (const n of c.notes) ids.push(n.id);
        }
        for (const t of line.texts) ids.push(t.id);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('генератор детерминирован: две идентичные сборки дают одинаковые id', () => {
    const a = demoNotebookFixture();
    const b = demoNotebookFixture();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
