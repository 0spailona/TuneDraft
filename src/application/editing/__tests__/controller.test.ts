// Юнит-тесты контроллера редактора (этап 5): конвейер «интент → мутация →
// push undo (№25) → сброс redo (№37) → эффект кармана (№26)», гейтинг
// режима чтения (№40), отказ без записи истории. Конвенции: ошибки —
// значения; история — снимки до мутации; jest-глобалы без импорта (R2).

import type { EditorIntent, EditorState, PocketWriter } from '../types';
import { applyIntent, initialEditorState } from '../controller';
import { canRedo, canUndo, MAX_HISTORY_DEPTH } from '../history';
import type { IdGenerator } from '../../../domain/tabulature/ids';
import { createIdGenerator } from '../../../domain/tabulature/ids';
import {
  addColumnText,
  createNotebook,
  createTabLine,
  createTextLine,
  insertLine,
  insertNote,
} from '../../../domain/tabulature/model';
import type { Notebook, TabLine } from '../../../domain/tabulature/types';

// ─── Помощники ──────────────────────────────────────────────────────────────

/** Распаковка ok-результата доменной мутации (отказ = падение теста). */
function must<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`ожидали ok: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

/** Тетрадь с одной таб-строкой на 4 колонки, открытая в режиме правки. */
function baseState(): { state: EditorState; line: TabLine; notebook: Notebook } {
  const gen = createIdGenerator();
  let nb = createNotebook('Тестовая', gen);
  const line = createTabLine(4, gen);
  nb = must(insertLine(nb, line, 0));
  return { state: initialEditorState(nb, 'edit'), line, notebook: nb };
}

/** Фиктивный карман: считает записи и копит тетради (эффект №26). */
function makePocket(): { writes: Notebook[]; writer: PocketWriter } {
  const writes: Notebook[] = [];
  return { writes, writer: { write: (nb) => writes.push(nb) } };
}

/** Применяет интент, исполняет эффекты кармана и возвращает состояние. */
function apply(
  state: EditorState,
  intent: EditorIntent,
  pocket: { writer: PocketWriter } | null,
): EditorState {
  const result = applyIntent(state, intent, createIdGenerator());
  if (pocket !== null) {
    // R2-шов (5е ревью ST-5): записи идут строго через PocketWriter — тот
    // же контракт, что исполняет Entry-уровень, а не прямой push в массив.
    for (const effect of result.effects) {
      pocket.writer.write(effect.notebook);
    }
  }
  return result.state;
}

// ─── Базовый конвейер: мутация + push undo + эффект кармана (№25, №26) ──────

describe('конвейер мутации (№25, №26, №37)', () => {
  it('успешная мутация меняет тетрадь, толкает снимок и пишет карман', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    const next = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 7,
      },
      pocket,
    );

    const col = (next.notebook.lines[0] as TabLine).columns[0];
    expect(col.notes).toHaveLength(1);
    expect(col.notes[0].fret).toBe(7);
    expect(canUndo(next.history)).toBe(true);
    expect(canRedo(next.history)).toBe(false);
    expect(pocket.writes).toHaveLength(1);
    expect(pocket.writes[0]).toBe(next.notebook);
  });

  it('предупреждение от прежнего отказа снимается успешной мутацией', () => {
    const { state, line } = baseState();
    // Черта в пустую колонку, затем повторная черта в неё же = отказ.
    const barred = apply(
      state,
      { type: 'set-barline', lineId: line.id, columnId: line.columns[1].id },
      null,
    );
    const refused = apply(
      barred,
      { type: 'set-barline', lineId: line.id, columnId: line.columns[1].id },
      null,
    );
    expect(refused.warning).not.toBeNull();

    const recovered = apply(
      refused,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 5,
      },
      null,
    );
    expect(recovered.warning).toBeNull();
  });
});

// ─── Мутации нот и колонок: конвейер для каждого интента (№21, №35) ─────────

describe('мутации нот и колонок через конвейер (№21, №35)', () => {
  /** Тетрадь baseState с нотой (лад 7) в ячейке «струна 0 × колонка 1». */
  function stateWithNote(): { state: EditorState; line: TabLine } {
    const { state, line } = baseState();
    const withNote = must(
      insertNote(
        state.notebook,
        { lineId: line.id, columnId: line.columns[1].id, stringIndex: 0 },
        7,
        createIdGenerator(),
      ),
    );
    return { state: { ...state, notebook: withNote }, line };
  }

  /** stateWithNote плюс текст «сустейн» на той же колонке (setup через домен). */
  function stateWithNoteAndText(): { state: EditorState; line: TabLine } {
    const { state, line } = stateWithNote();
    const withText = must(
      addColumnText(state.notebook, line.id, line.columns[1].id, 'сустейн', createIdGenerator()),
    );
    return { state: { ...state, notebook: withText }, line };
  }

  it('edit-note меняет лад, id ноты сохраняется; push undo и карман как у любой мутации', () => {
    const { state, line } = stateWithNote();
    const noteId = (state.notebook.lines[0] as TabLine).columns[1].notes[0].id;
    const pocket = makePocket();

    const next = apply(
      state,
      {
        type: 'edit-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 0,
        fret: 9,
      },
      pocket,
    );

    const note = (next.notebook.lines[0] as TabLine).columns[1].notes[0];
    expect(note.fret).toBe(9);
    expect(note.id).toBe(noteId);
    expect(canUndo(next.history)).toBe(true);
    expect(pocket.writes).toHaveLength(1);
    expect(pocket.writes[0]).toBe(next.notebook);
  });

  it('delete-note очищает ячейку, колонка остаётся; push undo и карман', () => {
    const { state, line } = stateWithNote();
    const pocket = makePocket();

    const next = apply(
      state,
      {
        type: 'delete-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 0,
      },
      pocket,
    );

    const lineAfter = next.notebook.lines[0] as TabLine;
    expect(lineAfter.columns[1].notes).toHaveLength(0);
    expect(lineAfter.columns).toHaveLength(4);
    expect(canUndo(next.history)).toBe(true);
    expect(pocket.writes).toHaveLength(1);
    expect(pocket.writes[0]).toBe(next.notebook);
  });

  it('insert-column слева вставляет пустую колонку между соседями; push undo и карман', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    const next = apply(
      state,
      {
        type: 'insert-column',
        lineId: line.id,
        columnId: line.columns[1].id,
        side: 'left',
      },
      pocket,
    );

    const columns = (next.notebook.lines[0] as TabLine).columns;
    expect(columns).toHaveLength(5);
    expect(columns[1].notes).toHaveLength(0);
    expect(columns[2].id).toBe(line.columns[1].id);
    expect(canUndo(next.history)).toBe(true);
    expect(pocket.writes).toHaveLength(1);
    expect(pocket.writes[0]).toBe(next.notebook);
  });

  it('clear-column снимает ноты и тексты, колонка остаётся; push undo и карман', () => {
    const { state, line } = stateWithNoteAndText();
    const pocket = makePocket();

    const next = apply(
      state,
      {
        type: 'clear-column',
        lineId: line.id,
        columnId: line.columns[1].id,
      },
      pocket,
    );

    const lineAfter = next.notebook.lines[0] as TabLine;
    expect(lineAfter.columns[1].notes).toHaveLength(0);
    expect(lineAfter.texts.filter((text) => text.columnId === line.columns[1].id)).toHaveLength(0);
    expect(lineAfter.columns).toHaveLength(4);
    expect(lineAfter.columns[1].id).toBe(line.columns[1].id);
    expect(canUndo(next.history)).toBe(true);
    expect(pocket.writes).toHaveLength(1);
    expect(pocket.writes[0]).toBe(next.notebook);
  });

  it('delete-column удаляет колонку с нотами и текстами, соседние целы; push undo и карман', () => {
    const { state, line } = stateWithNoteAndText();
    const pocket = makePocket();

    const next = apply(
      state,
      {
        type: 'delete-column',
        lineId: line.id,
        columnId: line.columns[1].id,
      },
      pocket,
    );

    const lineAfter = next.notebook.lines[0] as TabLine;
    expect(lineAfter.columns).toHaveLength(3);
    expect(lineAfter.columns[1].id).toBe(line.columns[2].id);
    expect(lineAfter.texts.some((text) => text.columnId === line.columns[1].id)).toBe(false);
    expect(canUndo(next.history)).toBe(true);
    expect(pocket.writes).toHaveLength(1);
    expect(pocket.writes[0]).toBe(next.notebook);
  });
});

// ─── Глубина 3 и вытеснение старейшего (№25) ────────────────────────────────

describe('глубина истории ≤ 3 (№25)', () => {
  it('три мутации дают ровно три undo (undo доступен ровно 3 раза)', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    let s = state;
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 1,
      },
      pocket,
    );
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 1,
        fret: 2,
      },
      pocket,
    );
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[2].id,
        stringIndex: 2,
        fret: 3,
      },
      pocket,
    );
    expect(s.history.undo).toHaveLength(3);

    s = apply(s, { type: 'undo' }, pocket);
    expect(canUndo(s.history)).toBe(true);
    s = apply(s, { type: 'undo' }, pocket);
    expect(canUndo(s.history)).toBe(true);
    s = apply(s, { type: 'undo' }, pocket);
    expect(s.notebook).toBe(state.notebook); // вернулись к исходной тетради
    expect(canUndo(s.history)).toBe(false); // четвёртого undo нет
    expect(canRedo(s.history)).toBe(true);
    // Карман: 3 мутации + 3 отката — карман равен видимому черновику (№26),
    // последняя запись — исходная тетрадь (отменённое не воскреснет).
    expect(pocket.writes).toHaveLength(6);
    expect(pocket.writes[5]).toBe(state.notebook);
  });

  it('четвёртая мутация вытесняет старейший снимок — восстановится второй', () => {
    const { state, line } = baseState();
    let s = state;
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 1,
      },
      null,
    );
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 1,
        fret: 2,
      },
      null,
    );
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[2].id,
        stringIndex: 2,
        fret: 3,
      },
      null,
    );
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[3].id,
        stringIndex: 3,
        fret: 4,
      },
      null,
    );

    expect(s.history.undo).toHaveLength(MAX_HISTORY_DEPTH);
    // Снимок исходной тетради вытеснен: три undo приводят к состоянию
    // после ПЕРВОЙ мутации — нота fret=1 в колонке 0, остальные пусты.
    s = apply(s, { type: 'undo' }, null);
    s = apply(s, { type: 'undo' }, null);
    s = apply(s, { type: 'undo' }, null);
    expect(canUndo(s.history)).toBe(false);
    expect(canRedo(s.history)).toBe(true);

    const columns = (s.notebook.lines[0] as TabLine).columns;
    expect(columns[0].notes).toHaveLength(1);
    expect(columns[0].notes[0].fret).toBe(1);
    expect(columns[1].notes).toHaveLength(0);
    expect(columns[2].notes).toHaveLength(0);
    expect(columns[3].notes).toHaveLength(0);
  });

  it('интерливинг (5г): undo → три мутации — redo оборван, лимит 3 и вытеснение держатся', () => {
    const { state, line } = baseState();
    let s = state;
    // M1–M3: три вставки колонок.
    for (let i = 0; i < 3; i++) {
      s = apply(
        s,
        { type: 'insert-column', lineId: line.id, columnId: line.columns[0].id, side: 'right' },
        null,
      );
    }
    s = apply(s, { type: 'undo' }, null);
    s = apply(s, { type: 'undo' }, null);
    const afterFirstMutation = s.notebook; // после M1: последний отнятый снимок
    expect(canRedo(s.history)).toBe(true);

    // M4–M6: три новые мутации — обрывают redo-ветку и вытесняют снимок
    // исходной тетради (старейший в стеке).
    for (let i = 0; i < 3; i++) {
      s = apply(
        s,
        { type: 'insert-column', lineId: line.id, columnId: line.columns[0].id, side: 'right' },
        null,
      );
    }
    expect(s.history.undo).toHaveLength(MAX_HISTORY_DEPTH);
    expect(canRedo(s.history)).toBe(false);

    // Ровно три undo: вернулись к состоянию после M1 — исходный снимок
    // вытеснен, но лимит глубины не сломан интерливингом.
    s = apply(s, { type: 'undo' }, null);
    s = apply(s, { type: 'undo' }, null);
    s = apply(s, { type: 'undo' }, null);
    expect(canUndo(s.history)).toBe(false);
    expect(canRedo(s.history)).toBe(true);
    expect(s.notebook).toBe(afterFirstMutation);
    expect(s.notebook).not.toBe(state.notebook); // снимок исходной тетради вытеснен
  });
});

// ─── Redo-ветка (№37) ───────────────────────────────────────────────────────

describe('redo-ветка (№37)', () => {
  it('undo → redo восстанавливает состояние', () => {
    const { state, line } = baseState();
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 9,
      },
      null,
    );
    const mutated = s.notebook;

    s = apply(s, { type: 'undo' }, null);
    expect(s.notebook).toBe(state.notebook);
    expect(canRedo(s.history)).toBe(true);

    s = apply(s, { type: 'redo' }, null);
    expect(s.notebook).toBe(mutated); // самый свежий отменённый снимок
    expect(canRedo(s.history)).toBe(false);
    expect(canUndo(s.history)).toBe(true);
  });

  it('новая мутация после undo очищает redo-ветку (Redo становится недоступен)', () => {
    const { state, line } = baseState();
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 9,
      },
      null,
    );
    s = apply(s, { type: 'undo' }, null);
    expect(canRedo(s.history)).toBe(true);

    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 1,
        fret: 8,
      },
      null,
    );
    expect(canRedo(s.history)).toBe(false);
    expect(canUndo(s.history)).toBe(true); // отмена новой мутации доступна
  });

  it('redo при пустой ветке ничего не меняет', () => {
    const { state } = baseState();
    const s = apply(state, { type: 'redo' }, null);
    expect(s).toBe(state);
  });

  it('undo при пустой истории ничего не меняет', () => {
    const { state } = baseState();
    const s = apply(state, { type: 'undo' }, null);
    expect(s).toBe(state);
  });

  it('несколько undo/redo подряд идут по стеку в правильном порядке', () => {
    const { state, line } = baseState();
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 1,
      },
      null,
    );
    const m1 = s.notebook;
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 1,
        fret: 2,
      },
      null,
    );
    const m2 = s.notebook;

    s = apply(s, { type: 'undo' }, null);
    expect(s.notebook).toBe(m1);
    s = apply(s, { type: 'undo' }, null);
    expect(s.notebook).toBe(state.notebook);
    s = apply(s, { type: 'redo' }, null);
    expect(s.notebook).toBe(m1);
    s = apply(s, { type: 'redo' }, null);
    expect(s.notebook).toBe(m2);
  });
});

// ─── Отказ мутации: без истории, без кармана, с предупреждением ─────────────

// ─── Карман следует за тетрадью на undo/redo (№26, №37) ─────────────────────

describe('undo/redo пишут карман (№26): карман равен видимому черновику', () => {
  /** Черта-7 в первой ячейке — общая setup-мутация для тестов отката. */
  function mutate(
    state: EditorState,
    line: TabLine,
    pocket: { writer: PocketWriter },
  ): EditorState {
    return apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 7,
      },
      pocket,
    );
  }

  it('undo после мутации пишет карман с восстановленной тетрадью', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    const mutated = mutate(state, line, pocket);
    const undone = apply(mutated, { type: 'undo' }, pocket);

    expect(canUndo(undone.history)).toBe(false);
    expect(canRedo(undone.history)).toBe(true);
    expect(pocket.writes).toHaveLength(2);
    expect(pocket.writes[0]).toBe(mutated.notebook);
    expect(pocket.writes[1]).toBe(undone.notebook);
    expect(undone.notebook).toBe(state.notebook);
  });

  it('redo пишет карман с восстановленным снимком', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    const mutated = mutate(state, line, pocket);
    const undone = apply(mutated, { type: 'undo' }, pocket);
    const redone = apply(undone, { type: 'redo' }, pocket);

    expect(pocket.writes).toHaveLength(3);
    expect(pocket.writes[2]).toBe(redone.notebook);
  });

  it('undo в режиме чтения тоже пишет карман (исключение «чтение не трогает карман»)', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    const mutated = mutate(state, line, pocket);
    const readMode: EditorState = { ...mutated, mode: 'read' };
    const undone = apply(readMode, { type: 'undo' }, pocket);

    expect(pocket.writes).toHaveLength(2);
    expect(pocket.writes[1]).toBe(undone.notebook);
  });

  it('redo в режиме чтения тоже пишет карман (симметрия с undo, 5в)', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    const mutated = mutate(state, line, pocket);
    const readMode: EditorState = { ...mutated, mode: 'read' };
    const undone = apply(readMode, { type: 'undo' }, pocket);
    const redone = apply(undone, { type: 'redo' }, pocket);

    expect(pocket.writes).toHaveLength(3);
    expect(pocket.writes[2]).toBe(redone.notebook);
    expect(redone.notebook).toBe(mutated.notebook);
  });

  it('undo при пустой истории карман не пишет (состояние не тронуто)', () => {
    const { state } = baseState();
    const pocket = makePocket();

    const untouched = apply(state, { type: 'undo' }, pocket);

    expect(pocket.writes).toHaveLength(0);
    expect(untouched).toBe(state);
  });
});

describe('отказ мутации (ModelResult err)', () => {
  it('черта в колонку с нотами: тетрадь/история не тронуты, предупреждение, карман чист', () => {
    const { state, line } = baseState();
    const pocket = makePocket();

    // Нота в колонку 0, затем черта в ту же колонку → отказ (№18).
    const withNote = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 3,
      },
      pocket,
    );
    expect(withNote.history.undo).toHaveLength(1);
    expect(pocket.writes).toHaveLength(1);

    const refused = apply(
      withNote,
      { type: 'set-barline', lineId: line.id, columnId: line.columns[0].id },
      pocket,
    );

    expect(refused.notebook).toBe(withNote.notebook); // тетрадь не изменилась
    expect(refused.history).toBe(withNote.history); // история не изменилась
    expect(refused.warning?.code).toBe('barline-column-not-empty');
    expect(pocket.writes).toHaveLength(1); // карман не записан
    expect(canRedo(refused.history)).toBe(false);
  });

  it('отказ не чистит redo-ветку — её обрывает только новая мутация', () => {
    const { state, line } = baseState();
    // Ноты в колонки 0 и 1; undo снимает только последнюю (нота колонки 1),
    // в колонке 0 нота остаётся — на ней и отказываемся.
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 1,
      },
      null,
    );
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 1,
        fret: 2,
      },
      null,
    );
    s = apply(s, { type: 'undo' }, null);
    expect(canRedo(s.history)).toBe(true);

    const refused = apply(
      s,
      { type: 'set-barline', lineId: line.id, columnId: line.columns[0].id },
      null,
    );
    expect(refused.warning?.code).toBe('barline-column-not-empty');
    expect(refused.history).toBe(s.history); // отказ историю не трогает
    expect(canRedo(refused.history)).toBe(true); // redo уцелел
  });

  it('undo снимает прежнее предупреждение (снятие — не только у успешной мутации)', () => {
    const { state, line } = baseState();
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 3,
      },
      null,
    );
    // Черта в колонку с нотой — отказ, предупреждение в состоянии (5а).
    s = apply(s, { type: 'set-barline', lineId: line.id, columnId: line.columns[0].id }, null);
    expect(s.warning).not.toBeNull();

    s = apply(s, { type: 'undo' }, null);
    expect(s.warning).toBeNull();
    expect(s.notebook).toBe(state.notebook); // откат сработал
  });

  it('redo снимает прежнее предупреждение (симметрично undo, 5а)', () => {
    const { state, line } = baseState();
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 3,
      },
      null,
    );
    s = apply(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[1].id,
        stringIndex: 1,
        fret: 4,
      },
      null,
    );
    s = apply(s, { type: 'set-barline', lineId: line.id, columnId: line.columns[0].id }, null);
    expect(s.warning).not.toBeNull();
    s = apply(s, { type: 'undo' }, null);
    expect(s.warning).toBeNull();

    // Отказ после undo снова кладёт предупреждение; redo его снимает.
    s = apply(s, { type: 'set-barline', lineId: line.id, columnId: line.columns[0].id }, null);
    expect(s.warning).not.toBeNull();
    s = apply(s, { type: 'redo' }, null);
    expect(s.warning).toBeNull();
    expect((s.notebook.lines[0] as TabLine).columns[0].notes).toHaveLength(1); // redo вернул ноту
    expect((s.notebook.lines[0] as TabLine).columns[1].notes).toHaveLength(1); // и вторую тоже
  });

  it('отказ мутации сохраняет валидное выделение (5б: отказ трогает только warning)', () => {
    const { state, line } = baseState();
    const withNote = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 3,
      },
      null,
    );
    const selected: EditorState = {
      ...withNote,
      selection: { kind: 'cell', lineId: line.id, columnId: line.columns[1].id, stringIndex: 2 },
    };
    const refused = apply(
      selected,
      { type: 'set-barline', lineId: line.id, columnId: line.columns[0].id },
      null,
    );
    expect(refused.warning?.code).toBe('barline-column-not-empty');
    // Выделение живой цели пережило отказ — панель не мигнула.
    expect(refused.selection).toEqual(selected.selection);
  });
});

// ─── Гейтинг режима чтения (№40) ───────────────────────────────────────────

describe('гейтинг режима чтения (№40)', () => {
  it('в режиме чтения интенты ввода игнорируются без ошибок и без кармана', () => {
    const { state, line } = baseState();
    const readState: EditorState = { ...state, mode: 'read' };
    const pocket = makePocket();

    const s = apply(
      readState,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 5,
      },
      pocket,
    );

    expect(s).toBe(readState); // состояние не менялось вовсе
    expect((s.notebook.lines[0] as TabLine).columns[0].notes).toHaveLength(0);
    expect(s.history.undo).toHaveLength(0);
    expect(pocket.writes).toHaveLength(0);
  });

  it('в режиме чтения undo/redo разрешены (тулбар №37 доступен в обоих режимах)', () => {
    const { state, line } = baseState();
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 6,
      },
      null,
    );
    s = { ...s, mode: 'read' };

    s = apply(s, { type: 'undo' }, null);
    expect(s.notebook).toBe(state.notebook); // отмена сработала в чтении

    s = apply(s, { type: 'redo' }, null);
    expect((s.notebook.lines[0] as TabLine).columns[0].notes).toHaveLength(1); // возврат тоже
  });
});

// ─── Строки ленты и тексты колонок через конвейер ───────────────────────────

describe('операции строк и текстов (№36, №35)', () => {
  it('insert-tab-line вставляет строку с колонками и пишет карман', () => {
    const { state } = baseState();
    const pocket = makePocket();
    const s = apply(state, { type: 'insert-tab-line', position: 1, columnCount: 2 }, pocket);
    expect(s.notebook.lines).toHaveLength(2);
    const inserted = s.notebook.lines[1] as TabLine;
    expect(inserted.kind).toBe('tab');
    expect(inserted.columns).toHaveLength(2);
    expect(pocket.writes).toHaveLength(1);
    expect(canUndo(s.history)).toBe(true);
  });

  it('insert-text-line вставляет текст-строку с заданным текстом', () => {
    const { state } = baseState();
    const s = apply(state, { type: 'insert-text-line', position: 0, text: 'Припев' }, null);
    expect(s.notebook.lines[0]).toMatchObject({ kind: 'text', text: 'Припев' });
  });

  it('insertLine с недопустимой позицией даёт предупреждение без мутации', () => {
    const { state } = baseState();
    const s = apply(state, { type: 'insert-tab-line', position: 99, columnCount: 2 }, null);
    expect(s.warning?.code).toBe('position-out-of-range');
    expect(s.notebook).toBe(state.notebook);
  });

  it('columnCount нецелый/отрицательный — отказ invalid-notebook до мутации (тур-2 находка 5)', () => {
    const { state } = baseState();
    for (const columnCount of [2.5, -1, Number.NaN]) {
      const refused = apply(state, { type: 'insert-tab-line', position: 1, columnCount }, null);
      expect(refused.warning?.code).toBe('invalid-notebook');
      expect(refused.notebook).toBe(state.notebook); // тетрадь не тронута
      expect(refused.history).toBe(state.history); // «успешной» пустой строки нет
    }
  });

  it('add-column-text добавляет текст; четвёртый текст — отказ column-text-limit', () => {
    const { state, line } = baseState();
    let s = state;
    for (let i = 0; i < 3; i++) {
      s = apply(
        s,
        {
          type: 'add-column-text',
          lineId: line.id,
          columnId: line.columns[0].id,
          text: `т${String(i)}`,
        },
        null,
      );
    }
    expect(s.warning).toBeNull();
    const fourth = apply(
      s,
      { type: 'add-column-text', lineId: line.id, columnId: line.columns[0].id, text: 'лишний' },
      null,
    );
    expect(fourth.warning?.code).toBe('column-text-limit');
    expect(fourth.notebook).toBe(s.notebook);
  });

  it('add-column-text длиннее порога — отказ column-text-too-long (№24)', () => {
    const { state, line } = baseState();
    const refused = apply(
      state,
      {
        type: 'add-column-text',
        lineId: line.id,
        columnId: line.columns[0].id,
        text: '1234567890123',
      },
      null,
    );
    expect(refused.warning?.code).toBe('column-text-too-long');
    expect(refused.notebook).toBe(state.notebook); // тетрадь не тронута
    expect(refused.history).toBe(state.history); // отказ историю не пишет (№25)
  });
});

// ─── Детерминизм конвейера (R6, №19; 2-й тур ревью ST-5, находка 7) ─────────

describe('детерминизм конвейера (R6, №19)', () => {
  /**
   * Одна и та же последовательность интентов поверх одного стартового
   * состояния, с одним генератором на весь прогон — как в Entry-экране
   * (модульный idGen). Возвращает конечное состояние.
   */
  function runSequence(state: EditorState, line: TabLine, gen: IdGenerator): EditorState {
    let s = state;
    s = applyIntent(s, { type: 'insert-tab-line', position: 1, columnCount: 3 }, gen).state;
    s = applyIntent(
      s,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 5,
      },
      gen,
    ).state;
    s = applyIntent(s, { type: 'undo' }, gen).state;
    s = applyIntent(s, { type: 'redo' }, gen).state;
    return s;
  }

  it('одинаковые интенты с эквивалентными (свежими) генераторами дают одинаковые тетради', () => {
    const { state, line } = baseState();
    const first = runSequence(state, line, createIdGenerator());
    const second = runSequence(state, line, createIdGenerator());
    // Сквозная нумерация id воспроизводима: сгенерированные id и структура
    // тетради совпадают (детерминированная фабрика id, №19).
    expect(first.notebook).toEqual(second.notebook);
    expect(first.history).toEqual(second.history);
  });

  it('отказ вставки по позиции не сжигает id — повтор с тем же генератором даёт те же id, что и свежий (тур-3 находка 2а)', () => {
    const { state } = baseState();
    const gen = createIdGenerator();
    const refused = applyIntent(
      state,
      { type: 'insert-tab-line', position: 99, columnCount: 1 },
      gen,
    ).state;
    expect(refused.warning?.code).toBe('position-out-of-range');
    expect(refused.notebook).toBe(state.notebook);

    // Позиция валидируется до фабрики: генератор не потрачен — повтор с тем
    // же генератором даёт ровно те же id, что и свежий генератор (tl-2/c-1).
    const continued = applyIntent(
      refused,
      { type: 'insert-tab-line', position: 1, columnCount: 1 },
      gen,
    ).state;
    const fresh = applyIntent(
      refused,
      { type: 'insert-tab-line', position: 1, columnCount: 1 },
      createIdGenerator(),
    ).state;
    const continuedLine = continued.notebook.lines[1] as TabLine;
    const freshLine = fresh.notebook.lines[1] as TabLine;
    expect(continuedLine.id).toBe('tl-2');
    expect(continuedLine.columns.map((c) => c.id)).toEqual(['c-1']);
    expect(freshLine.id).toBe('tl-2');
    expect(freshLine.columns.map((c) => c.id)).toEqual(['c-1']);
    // Идентичность не только по форме: нумерация не сдвинута вовсе.
    expect(continued.notebook).toEqual(fresh.notebook);
    expect(continued.warning).toBeNull(); // повтор успешен — предупреждение снято
  });

  it('отказ вставки текст-строки по позиции тоже не сжигает id (тур-3 находка 2а)', () => {
    const { state } = baseState();
    const gen = createIdGenerator();
    const refused = applyIntent(
      state,
      { type: 'insert-text-line', position: 99, text: 'Проигрыш' },
      gen,
    ).state;
    expect(refused.warning?.code).toBe('position-out-of-range');
    expect(refused.notebook).toBe(state.notebook);

    const continued = applyIntent(
      refused,
      { type: 'insert-text-line', position: 1, text: 'Проигрыш' },
      gen,
    ).state;
    const fresh = applyIntent(
      refused,
      { type: 'insert-text-line', position: 1, text: 'Проигрыш' },
      createIdGenerator(),
    ).state;
    // Генератор не потрачен отказом — id совпадают со свежим генератором.
    expect(continued.notebook).toEqual(fresh.notebook);
  });
});

// ─── Выделение и начальное состояние ────────────────────────────────────────

describe('выделение и initialEditorState', () => {
  it('конвейер не меняет выделение ячейки при успешной мутации', () => {
    const { state, line } = baseState();
    const selected: EditorState = {
      ...state,
      selection: { kind: 'cell', lineId: line.id, columnId: line.columns[0].id, stringIndex: 2 },
    };
    const s = apply(
      selected,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 2,
        fret: 4,
      },
      null,
    );
    expect(s.selection).toEqual(selected.selection);
  });

  it('undo/redo сохраняют валидное выделение (5в: санитизация точечная)', () => {
    const { state, line } = baseState();
    let s = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 0,
        fret: 2,
      },
      null,
    );
    s = {
      ...s,
      selection: { kind: 'cell', lineId: line.id, columnId: line.columns[0].id, stringIndex: 0 },
    };
    s = apply(s, { type: 'undo' }, null);
    // Цель жива в откате — выделение сохранено (раньше redo сбрасывал целиком).
    expect(s.selection).toEqual({
      kind: 'cell',
      lineId: line.id,
      columnId: line.columns[0].id,
      stringIndex: 0,
    });
    s = apply(s, { type: 'redo' }, null);
    // Симметрично: redo тоже хранит валидное выделение.
    expect(s.selection).toEqual({
      kind: 'cell',
      lineId: line.id,
      columnId: line.columns[0].id,
      stringIndex: 0,
    });
  });

  it('undo стирает висячее выделение — строка не резолвится (5в: симметрия с redo)', () => {
    const { state, line } = baseState();
    const s0 = apply(
      state,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 1,
        fret: 3,
      },
      null,
    );
    const s = apply(
      {
        ...s0,
        selection: { kind: 'column', lineId: 'ghost-line', columnId: 'ghost-column' },
      },
      { type: 'undo' },
      null,
    );
    expect(s.selection).toBeNull();
    expect(line.id).not.toBe('ghost-line');
  });

  it('undo стирает выделение на текст-строке — санитизация требует таб-строку (5f)', () => {
    const { state, line } = baseState();
    const gen = createIdGenerator();
    let nb = state.notebook;
    const textLine = createTextLine('Припев', gen);
    nb = must(insertLine(nb, textLine, 1));
    const withTextLine: EditorState = { ...state, notebook: nb };

    let s = apply(
      withTextLine,
      {
        type: 'insert-note',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: 1,
        fret: 5,
      },
      null,
    );
    // Выделение ссылается на текст-строку: строка резолвится, но не таб.
    s = {
      ...s,
      selection: { kind: 'column', lineId: textLine.id, columnId: textLine.id },
    };
    s = apply(s, { type: 'undo' }, null);
    // Строка жива в откате, но ячеек у текст-строки нет — выделение стирается.
    expect(s.selection).toBeNull();
  });

  it('delete-column стирает выделение удалённой колонки, соседняя живёт (5в: меню-призрак)', () => {
    const { state, line } = baseState();
    const s = apply(
      {
        ...state,
        selection: { kind: 'column', lineId: line.id, columnId: line.columns[0].id },
      },
      { type: 'delete-column', lineId: line.id, columnId: line.columns[0].id },
      null,
    );
    // Удалённая цель не резолвится — меню колонки-призрака не открывается.
    expect(s.selection).toBeNull();
    // Валидная цель при той же мутации сохраняется.
    const s2 = apply(
      {
        ...state,
        selection: { kind: 'column', lineId: line.id, columnId: line.columns[1].id },
      },
      { type: 'delete-column', lineId: line.id, columnId: line.columns[0].id },
      null,
    );
    expect(s2.selection).toEqual({
      kind: 'column',
      lineId: line.id,
      columnId: line.columns[1].id,
    });
  });

  it('санитизация стирает ячейку с stringIndex вне tuning строки (тур-3 находка 1а)', () => {
    const { state, line } = baseState();
    // Страховочный сценарий (сегодня недостижим через UI): ячейка ссылается
    // на струну за пределами tuning — панель ладов не должна над ней висеть.
    const ghostString: EditorState = {
      ...state,
      selection: {
        kind: 'cell',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: line.tuning.length,
      },
    };
    const s = apply(ghostString, { type: 'insert-tab-line', position: 1, columnCount: 1 }, null);
    expect(s.selection).toBeNull();
    // Контроль: валидная ячейка при той же мутации сохраняется.
    const valid: EditorState = {
      ...state,
      selection: {
        kind: 'cell',
        lineId: line.id,
        columnId: line.columns[0].id,
        stringIndex: line.tuning.length - 1,
      },
    };
    const s2 = apply(valid, { type: 'insert-tab-line', position: 1, columnCount: 1 }, null);
    expect(s2.selection).toEqual(valid.selection);
  });

  it('initialEditorState: пустое выделение, нет предупреждений, пустая история', () => {
    const nb = createNotebook('Чистая', createIdGenerator());
    const s = initialEditorState(nb, 'edit');
    expect(s.notebook).toBe(nb);
    expect(s.mode).toBe('edit');
    expect(s.selection).toBeNull();
    expect(s.warning).toBeNull();
    expect(s.history.undo).toEqual([]);
    expect(s.history.redo).toEqual([]);
  });
});
