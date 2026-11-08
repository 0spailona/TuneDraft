// Экран редактора (этап 5 дорожной карты, КАРТА §3) — Entry-уровень (R4):
// клей «жесты/панели → интенты → контроллер (src/application/editing) →
// NotebookCanvas (src/infrastructure/rendering)». Собственной бизнес-логики
// нет: applyIntent исполняется на уровне события (3а ревью ST-5 — редьюсер
// без эффектов и генерации id), эффект кармана (№26) исполняет стабильный
// no-op writer (реальный карман — этап 7). Тапы канвы
// разрешаются hit-тестом плана (№5, №35), отказ модели → предупреждение из
// словаря (№31). Все видимые строки — из словаря (№31).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { StatusBar, StyleSheet, Text, Pressable, View } from 'react-native';

import { applyIntent, initialEditorState } from '../../src/application/editing/controller';
import type {
  EditorIntent,
  EditorState,
  PocketWriter,
  Selection,
} from '../../src/application/editing/types';
import { canRedo, canUndo } from '../../src/application/editing/history';
import type { IdGenerator } from '../../src/domain/tabulature/ids';
import type { ModelErrorCode, Notebook, TabLine } from '../../src/domain/tabulature/types';
import { NotebookCanvas } from '../../src/infrastructure/rendering/NotebookCanvas';
import type { HitTestResult } from '../../src/infrastructure/rendering/hit-test';
import type { SelectionTarget } from '../../src/infrastructure/rendering/plan';
import { stripCapacityChars } from '../../src/infrastructure/rendering/plan';
import { getNotebookFonts, measureMonoAdvancePx } from '../../src/infrastructure/rendering/skia';
import { systemCapacity } from '../../src/domain/layout-engine';
import { t } from '../../src/i18n';
import type { TranslationKey } from '../../src/i18n';
import { ColumnMenu } from './ColumnMenu';
import { FretPanel } from './FretPanel';
import { RowTypePicker } from './RowTypePicker';
import { TextEntryModal } from './TextEntryModal';
import type { TextEntryKind } from './TextEntryModal';
import { uiTheme } from './theme';

// ─── Карман автосохранения (№26): интерфейс объявлен приложением (этап 5) ───

/** Заглушка кармана: запись никуда не идёт, реальный карман — этап 7 (№26). */
const pocketWriter: PocketWriter = {
  write: () => undefined,
};

/**
 * Код отказа модели → ключ словаря (№31): Entry мапит код в своё сообщение,
 * не зная, какая операция отказала (контракт EditorWarning).
 */
const WARNING_KEYS: Readonly<Record<ModelErrorCode, TranslationKey>> = {
  'fret-out-of-range': 'warning.fret-out-of-range',
  'string-index-out-of-range': 'warning.string-index-out-of-range',
  'line-not-found': 'warning.line-not-found',
  'column-not-found': 'warning.column-not-found',
  'note-not-found': 'warning.note-not-found',
  'text-not-found': 'warning.text-not-found',
  'cell-not-empty': 'warning.cell-not-empty',
  'column-is-barline': 'warning.column-is-barline',
  'barline-already-set': 'warning.barline-already-set',
  'barline-not-set': 'warning.barline-not-set',
  'barline-column-not-empty': 'warning.barline-column-not-empty',
  'column-text-limit': 'warning.column-text-limit',
  'column-text-too-long': 'warning.column-text-too-long',
  'position-out-of-range': 'warning.position-out-of-range',
  'line-id-duplicate': 'warning.line-id-duplicate',
  'invalid-notebook': 'warning.invalid-notebook',
};

/** Действие UI-слоя: посчитанный контроллером стейт или локальное изменение экрана. */
type ScreenAction =
  | { readonly type: 'mutation'; readonly state: EditorState }
  | { readonly type: 'select'; readonly selection: Selection | null }
  | { readonly type: 'set-mode'; readonly mode: EditorState['mode'] };

/**
 * Редьюсер экрана — чистый setter (3а ревью ST-5): applyIntent исполняется
 * на уровне события (dispatchIntent), здесь только сохранение результата.
 * Повторные прогоны редьюсера (StrictMode, конкурентные re-base) не исполняют
 * побочных эффектов и не потребляют генератор id.
 */
function screenReducer(state: EditorState, action: ScreenAction): EditorState {
  switch (action.type) {
    case 'mutation':
      return action.state;
    case 'select':
      return { ...state, selection: action.selection };
    case 'set-mode':
      // Смена режима чистит выделение и последнее предупреждение (№40, №31):
      // отказ предыдущего правочного действия не должен висеть над «Чтением»
      // до следующего успешного интента.
      return { ...state, mode: action.mode, selection: null, warning: null };
  }
}

/** Какие данные редактирует нижняя панель/модалка прямо сейчас. */
interface PanelState {
  /** Панель: 'cell' — панель ладов, 'column' — меню колонки. */
  readonly kind: 'cell' | 'column';
  /** lineId цели (для поиска актуального состояния в тетради). */
  readonly lineId: string;
  readonly columnId: string;
  /** Для панели ячейки: индекс струны. */
  readonly stringIndex: number;
}

/** Модалка ввода текста: что вводится и для какой цели. */
interface TextDraft {
  readonly kind: TextEntryKind;
  /** Для текста колонки: цель. Для текст-строки — не задано. */
  readonly lineId?: string;
  readonly columnId?: string;
  readonly initialValue: string;
}

export interface EditorScreenProps {
  /**
   * Модель тетради (демо-фикстура этапа 4; владелец — App). Контракт ремонта
   * (2-й тур ревью ST-5, находка 9): читается один раз — инициализатором
   * useReducer при монтировании; смена пропа после монтирования экраном
   * не отслеживается. Открытие другой тетради — новый экземпляр экрана
   * с key={notebook.id} (правило ремонта; Library → Editor — этап 7).
   */
  readonly notebook: Notebook;
  /** Начальный режим (№40): новая тетрадь — правка, открытая — чтение. */
  readonly initialMode: EditorState['mode'];
  /** Ширина канвы (поворот меняет её, №23) — прокидывается в канву. */
  readonly widthPx: number;
  /**
   * Генератор id мутаций (R6; 21.1 ревью ST-5): один на тетрадь, создаёт
   * App — общий с фикстурой, чтобы нумерация продолжалась после неё
   * (свой счётчик экрана с нуля коллидил с id фикстуры: tx-2 был «занят»).
   */
  readonly idGen: IdGenerator;
}

/**
 * Экран редактора (№40): тулбар №37 + переключатель Править/Чтение + канва +
 * нижние панели (№21, №35, №36). Тап по канве: hit-тест плана → выделение и
 * панель (только в правке, №40); лонг-тап мимо полос → текст-строка через
 * модалку (№27, №36) в конец ленты (позиционная вставка — этап 6).
 */
export function EditorScreen({ notebook, initialMode, widthPx, idGen }: EditorScreenProps) {
  const [state, dispatch] = useReducer(screenReducer, notebook, (nb) =>
    initialEditorState(nb, initialMode),
  );
  // Актуальное состояние для обработчиков событий (3а): интент применяется
  // к нему вне редьюсера. Ref синхронизируется в layout-эффекте (2-й тур
  // ревью ST-5, находка 8), а не в теле рендера: запись во внешнее
  // состояние во время рендера небезопасна при конкурентных re-base
  // (React 18), а события до коммита видят последний засоммиченный стейт.
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  /**
   * Правка существующего текста колонки (№27, №35; 6а и 2b ревью ST-5):
   * цель — id текста (edit-column-text сохраняет id текста), начальное
   * значение — выбранный в меню текст колонки (один текст — он и выбран,
   * 2–3 — выбор в списке меню колонки).
   */
  const [textEdit, setTextEdit] = useState<{
    readonly lineId: string;
    readonly textId: string;
    readonly initialValue: string;
  } | null>(null);

  // Advance единицы геометрии (№32, ADR-0004): тот же шрифт, что и в канве —
  // ёмкость новой таб-строки считается в тех же символах движка (№20).
  // Шрифты — общий экземпляр на процесс (тур-3 ревью ST-5, находка 4а):
  // один замер advance на оба потребителя, расхождение исключено.
  const fonts = getNotebookFonts();
  const advancePx = measureMonoAdvancePx(fonts.fretDigits);

  const isEdit = state.mode === 'edit';

  /**
   * Интент → контроллер (3а ревью ST-5): applyIntent исполняется на
   * актуальном состоянии на уровне события, эффекты конвейера (карман, №26)
   * исполняются здесь же — редьюсер остаётся чистым setter'ом.
   */
  const dispatchIntent = useCallback(
    (intent: EditorIntent) => {
      const outcome = applyIntent(stateRef.current, intent, idGen);
      for (const effect of outcome.effects) {
        if (effect.kind === 'write-pocket') {
          pocketWriter.write(effect.notebook);
        }
      }
      dispatch({ type: 'mutation', state: outcome.state });
    },
    [idGen],
  );

  // ─── Актуальные данные выделенной цели ────────────────────────────────

  /** Таб-строка выделенной цели, если она ещё существует (undo мог убрать). */
  const selectedTabLine: TabLine | null = useMemo(() => {
    if (panel === null) {
      return null;
    }
    const line = state.notebook.lines.find((l) => l.id === panel.lineId);
    return line !== undefined && line.kind === 'tab' ? line : null;
  }, [panel, state.notebook]);

  const selectedColumn = selectedTabLine?.columns.find((c) => c.id === panel?.columnId) ?? null;
  const selectedCellNote =
    selectedColumn?.notes.find((n) => n.stringIndex === panel?.stringIndex) ?? null;
  const selectedTexts =
    selectedTabLine?.texts.filter((tx) => tx.columnId === panel?.columnId) ?? [];

  // ─── Тапы канвы (№5, №35, №40) ─────────────────────────────────────────

  const handleTap = useCallback(
    (hit: SelectionTarget | null) => {
      if (!isEdit) {
        // Чтение (№40): тапы не открывают панели, выделение не меняется.
        return;
      }
      // Любой новый тап в правке закрывает пикер типов строки (№36): и тап
      // по пустому месту (сброс выделения), и тап по цели — пикер не должен
      // переживать новый жест. Сама «+» при этом остаётся доступной (№36):
      // она скрыта только пока открыт сам пикер.
      setPickerVisible(false);
      if (hit === null) {
        setPanel(null);
        dispatch({ type: 'select', selection: null });
        return;
      }
      setPanel({
        kind: hit.kind,
        lineId: hit.lineId,
        columnId: hit.columnId,
        stringIndex: hit.kind === 'cell' ? hit.stringIndex : 0,
      });
      dispatch({
        type: 'select',
        selection:
          hit.kind === 'cell'
            ? {
                kind: 'cell',
                lineId: hit.lineId,
                columnId: hit.columnId,
                stringIndex: hit.stringIndex,
              }
            : { kind: 'column', lineId: hit.lineId, columnId: hit.columnId },
      });
    },
    [isEdit],
  );

  // ─── Лонг-тап по пустому месту → текст-строка (№36, №27) ──────────────

  const handleLongPress = useCallback(
    (hit: HitTestResult | null) => {
      if (!isEdit || hit !== null) {
        // Ввод текст-строки — только по пустому месту (№36/№27; 18а ревью
        // ST-5): лонг-тап по зоне — базис жестов строк редактирования (этап 6).
        return;
      }
      // Новый жест вытесняет открытый пикер типов строки (№36).
      setPickerVisible(false);
      // Позиционная вставка — этап 6: пока текст-строка вставляется в конец
      // ленты (модель принимает position = lines.length, №36).
      setTextDraft({ kind: 'line', initialValue: '' });
    },
    [isEdit],
  );

  // ─── Панель ладов (№21) ────────────────────────────────────────────────

  const handleFret = useCallback(
    (fret: number) => {
      if (panel === null || panel.kind !== 'cell' || selectedTabLine === null) {
        return;
      }
      const lineId = panel.lineId;
      const columnId = panel.columnId;
      const stringIndex = panel.stringIndex;
      dispatchIntent(
        selectedCellNote === null
          ? { type: 'insert-note', lineId, columnId, stringIndex, fret }
          : { type: 'edit-note', lineId, columnId, stringIndex, fret },
      );
    },
    [panel, selectedTabLine, selectedCellNote, dispatchIntent],
  );

  const handleBarline = useCallback(() => {
    if (panel === null || panel.kind !== 'cell') {
      return;
    }
    dispatchIntent({ type: 'set-barline', lineId: panel.lineId, columnId: panel.columnId });
  }, [panel, dispatchIntent]);

  const handleDeleteNote = useCallback(() => {
    if (panel === null || panel.kind !== 'cell') {
      return;
    }
    dispatchIntent({
      type: 'delete-note',
      lineId: panel.lineId,
      columnId: panel.columnId,
      stringIndex: panel.stringIndex,
    });
  }, [panel, dispatchIntent]);

  // ─── Меню колонки (№35) ────────────────────────────────────────────────

  const handleColumnAction = useCallback(
    (
      intent:
        | { type: 'insert-column'; side: 'left' | 'right' }
        | { type: 'clear-column' }
        | { type: 'delete-column' },
    ) => {
      if (panel === null || panel.kind !== 'column') {
        return;
      }
      if (intent.type === 'insert-column') {
        dispatchIntent({
          type: 'insert-column',
          lineId: panel.lineId,
          columnId: panel.columnId,
          side: intent.side,
        });
        return;
      }
      dispatchIntent({ type: intent.type, lineId: panel.lineId, columnId: panel.columnId });
    },
    [panel, dispatchIntent],
  );

  const handleAddText = useCallback(() => {
    if (panel === null || panel.kind !== 'column') {
      return;
    }
    setTextDraft({
      kind: 'column',
      lineId: panel.lineId,
      columnId: panel.columnId,
      initialValue: '',
    });
  }, [panel]);

  /** «Править текст» (№27, №35; 6а/2b ревью ST-5): модалка с выбранным текстом. */
  const handleEditColumnText = useCallback(
    (index: number) => {
      if (panel === null || panel.kind !== 'column') {
        return;
      }
      const target = selectedTexts[index];
      if (target === undefined) {
        return;
      }
      setTextEdit({ lineId: panel.lineId, textId: target.id, initialValue: target.text });
      setPanel(null);
      dispatch({ type: 'select', selection: null });
    },
    [panel, selectedTexts],
  );

  const handleRemoveBarline = useCallback(() => {
    // «Убрать черту» (№18, №35): очистка колонки-черты снимает черту
    // (модель: clearColumn для barline → clearBarline).
    if (panel === null || panel.kind !== 'column') {
      return;
    }
    dispatchIntent({ type: 'clear-column', lineId: panel.lineId, columnId: panel.columnId });
  }, [panel, dispatchIntent]);

  // ─── Кнопка «+» и выбор типа строки (№36) ─────────────────────────────

  const handlePickTab = useCallback(() => {
    setPickerVisible(false);
    // Ёмкость строки считает экран (№36, №20): минимум колонок полосы на
    // текущую ширину в символах движка (advance моно-шрифта цифр, №32).
    const widthChars = stripCapacityChars(widthPx, advancePx);
    const capacity = Math.max(1, systemCapacity(widthChars).capacityColumns);
    dispatchIntent({
      type: 'insert-tab-line',
      position: state.notebook.lines.length,
      columnCount: capacity,
    });
  }, [dispatchIntent, state.notebook.lines.length, widthPx, advancePx]);

  const handlePickText = useCallback(() => {
    setPickerVisible(false);
    setTextDraft({ kind: 'line', initialValue: '' });
  }, []);

  // ─── Модалка текста (№27) ──────────────────────────────────────────────

  const handleTextConfirm = useCallback(
    (text: string) => {
      const draft = textDraft;
      setTextDraft(null);
      if (draft === null) {
        return;
      }
      if (draft.kind === 'line') {
        dispatchIntent({
          type: 'insert-text-line',
          position: state.notebook.lines.length,
          text,
        });
        return;
      }
      if (draft.lineId !== undefined && draft.columnId !== undefined) {
        // Текст колонки: максимум 3 — 4-й даст предупреждение (№35).
        dispatchIntent({
          type: 'add-column-text',
          lineId: draft.lineId,
          columnId: draft.columnId,
          text,
        });
      }
    },
    [textDraft, dispatchIntent, state.notebook.lines.length],
  );

  /** Подтверждение правки текста колонки (6а): edit-column-text, id сохраняется. */
  const handleTextEditDone = useCallback(
    (text: string) => {
      const edit = textEdit;
      setTextEdit(null);
      if (edit === null) {
        return;
      }
      dispatchIntent({ type: 'edit-column-text', lineId: edit.lineId, textId: edit.textId, text });
    },
    [textEdit, dispatchIntent],
  );

  // ─── Тулбар (№37) ──────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    // Undo/redo вытесняют открытый пикер типов строки (тур-3 ревью ST-5,
    // находка 5а) — как любой новый жест: пикер не переживает тап и лонг-тап,
    // не должен переживать и откат. Черновики не трогаем: модалка перекрывает
    // тулбар, до undo при открытом черновике не добраться.
    setPickerVisible(false);
    setTextEdit(null);
    dispatchIntent({ type: 'undo' });
  }, [dispatchIntent]);

  const handleRedo = useCallback(() => {
    setPickerVisible(false);
    setTextEdit(null);
    dispatchIntent({ type: 'redo' });
  }, [dispatchIntent]);

  // ─── Переключатель режимов (№40) ───────────────────────────────────────

  const handleToggleMode = useCallback(() => {
    // 4а ревью ST-5: смена режима чистит локальный UI — панель, пикер и
    // текстовые черновики не «воскресают» при возврате в правку.
    setPanel(null);
    setPickerVisible(false);
    setTextDraft(null);
    setTextEdit(null);
    dispatch({ type: 'set-mode', mode: isEdit ? 'read' : 'edit' });
  }, [isEdit]);

  // 3b ревью ST-5: панель живёт только при живой цели. Контроллер санитизирует
  // выделение (undo «вставки» колонки, delete-column из самого меню) — когда
  // выделение стало пустым, локальная панель закрывается следом, а не остаётся
  // висеть над несуществующей колонкой («Колонка не найдена» на каждое
  // действие). Пикер и черновики не трогаем: они с выделением не связаны.
  useEffect(() => {
    if (state.selection === null) {
      setPanel(null);
    }
  }, [state.selection]);

  // 7 ревью ST-5: панель ячейки не остаётся над колонкой, ставшей чертой.
  // «Тактовая черта» из панели ладов делает колонку чертой (№18): ячейка
  // черты всегда пуста, поэтому цифры и повторная черта в панели ячейки
  // только отклоняются (column-is-barline / barline-already-set) — вместо
  // этого панель переключается на меню колонки (№35, «Убрать черту»).
  // useLayoutEffect: панель ладов не должна мигнуть кадром над чертой.
  useLayoutEffect(() => {
    if (panel?.kind === 'cell' && selectedColumn?.kind === 'barline') {
      const { lineId, columnId } = panel;
      setPanel({ kind: 'column', lineId, columnId, stringIndex: 0 });
      // 7а ревью ST-5: канва рисует рамку по выделению — вместе с панелью
      // выделение становится колоночным, иначе над чертой остаётся рамка
      // пустой ячейки при открытом меню колонки.
      dispatch({ type: 'select', selection: { kind: 'column', lineId, columnId } });
    }
  }, [panel, selectedColumn, dispatch]);

  // Выделение канве отдаётся в словаре rendering (SelectionTarget) —
  // типы структурно идентичны application-типу Selection (№19).
  const canvasSelection: SelectionTarget | undefined = state.selection ?? undefined;

  return (
    <View style={styles.screen}>
      {/* Тулбар №37: Сохранить/Закрыть/Отменить/Вернуть/Экспорт PDF.
          До этапов 7–8 Save/Close/PDF показаны отключёнными.
          №40 (приёмка 2026-11-09): Сохранить/Отменить/Вернуть рендерятся
          только в правке; Закрыть и Экспорт PDF — в обоих режимах.
          Контроллер по-прежнему принимает undo/redo-интенты в чтении
          (ADR-0006) — экран их просто не предлагает. */}
      <View style={styles.toolbar} testID="editor-toolbar">
        {isEdit && <ToolButton label={t('toolbar.save')} disabled />}
        <ToolButton label={t('toolbar.close')} disabled />
        {isEdit && (
          <>
            <ToolButton
              label={t('toolbar.undo')}
              disabled={!canUndo(state.history)}
              onPress={handleUndo}
              testID="toolbar-undo"
            />
            <ToolButton
              label={t('toolbar.redo')}
              disabled={!canRedo(state.history)}
              onPress={handleRedo}
              testID="toolbar-redo"
            />
          </>
        )}
        <ToolButton label={t('toolbar.exportPdf')} disabled />
        <View style={styles.modeSwitch}>
          <Pressable
            style={[styles.modeButton, isEdit && styles.modeButtonActive]}
            disabled={isEdit}
            onPress={handleToggleMode}
            testID="mode-edit"
          >
            <Text style={[styles.modeText, isEdit && styles.modeTextActive]}>{t('mode.edit')}</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, !isEdit && styles.modeButtonActive]}
            disabled={!isEdit}
            onPress={handleToggleMode}
            testID="mode-read"
          >
            <Text style={[styles.modeText, !isEdit && styles.modeTextActive]}>
              {t('mode.read')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Предупреждение (№18, №35): код отказа → строка словаря (№31). */}
      {state.warning !== null && (
        <View style={styles.warning} testID="editor-warning">
          <Text style={styles.warningText}>{t(WARNING_KEYS[state.warning.code])}</Text>
        </View>
      )}

      {/* Канва (№23): тап → hit-тест → выделение и панель; лонг-тап —
          базис жестов строк (№36). */}
      <NotebookCanvas
        notebook={state.notebook}
        widthPx={widthPx}
        selection={canvasSelection}
        onTap={handleTap}
        onLongPress={handleLongPress}
      />

      {/* Нижние панели — только в правке (№40). */}
      {isEdit && (
        <View>
          {panel?.kind === 'cell' && selectedTabLine !== null && (
            <FretPanel
              cellOccupied={selectedCellNote !== null}
              onFret={handleFret}
              onBarline={handleBarline}
              onDeleteNote={handleDeleteNote}
            />
          )}
          {panel?.kind === 'column' && selectedTabLine !== null && (
            <ColumnMenu
              key={panel.columnId}
              isBarline={selectedColumn?.kind === 'barline'}
              hasTexts={selectedTexts.length > 0}
              texts={selectedTexts.map((tx) => ({ id: tx.id, text: tx.text }))}
              onInsertLeft={() => handleColumnAction({ type: 'insert-column', side: 'left' })}
              onInsertRight={() => handleColumnAction({ type: 'insert-column', side: 'right' })}
              onClear={() => handleColumnAction({ type: 'clear-column' })}
              onDelete={() => handleColumnAction({ type: 'delete-column' })}
              onAddText={handleAddText}
              onEditText={handleEditColumnText}
              onRemoveBarline={handleRemoveBarline}
            />
          )}
          {pickerVisible && <RowTypePicker onPickTab={handlePickTab} onPickText={handlePickText} />}
          {/* «+» — постоянный контроль правки (№36): доступна и при открытой
              панели/меню колонки; скрыта только пока открыт сам пикер. */}
          {pickerVisible === false && (
            <View style={styles.plusRow}>
              <Pressable
                style={styles.plusButton}
                onPress={() => setPickerVisible(true)}
                testID="button-plus"
              >
                <Text style={styles.plusText}>+</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Модалка монтируется только с активным черновиком (2а ревью ST-5):
          свежий стейт на каждый черновик — ввод текст-строки/текста колонки
          и правка существующего текста (6а/2b: initialValue — выбранный
          текст, edit-column-text сохраняет id текста, №27/№35). */}
      {(textDraft !== null || textEdit !== null) && (
        <TextEntryModal
          visible
          kind={textDraft !== null ? textDraft.kind : 'column'}
          initialValue={
            textDraft !== null ? textDraft.initialValue : (textEdit?.initialValue ?? '')
          }
          onConfirm={textDraft !== null ? handleTextConfirm : handleTextEditDone}
          onCancel={textDraft !== null ? () => setTextDraft(null) : () => setTextEdit(null)}
        />
      )}
    </View>
  );
}

/** Кнопка тулбара (№37): активная или отключённая. */
function ToolButton({
  label,
  onPress,
  disabled = false,
  testID,
}: {
  readonly label: string;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly testID?: string;
}) {
  return (
    <Pressable
      style={[styles.toolButton, disabled && styles.toolButtonDisabled]}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
    >
      <Text style={[styles.toolButtonText, disabled && styles.toolButtonTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: uiTheme.paper,
    // Edge-to-edge Android 15: приложение рисуется и ПОД статус-баром, поэтому
    // без компенсации верх тулбара №37 (включая текст кнопок) попадает в
    // несистемную мёртвую зону — тапы в верхнюю половину кнопок глотает
    // статус-бар (находка приёмки 2026-11-09: «Отменить/Вернуть работают,
    // только если тап не попадает на текст» — живой низ кнопки).
    paddingTop: StatusBar.currentHeight ?? 0,
    // Тот же edge-to-edge, низ: приложение рисуется и ПОД таскбаром Android 12+
    // (56dp на целевом планшете: зона navigationBarBackground 1488–1600px при
    // плотности 320). Без компенсации нижние контролы правки (№36: «+»,
    // пикер типов строки, панель ладов, меню колонки) уходят целиком под
    // таскбар — визуально «ни в одном режиме нет знака +» (находка приёмки
    // 2026-11-09; тот же дефект значился в смоук-прогоне 26.10 замечанием
    // среды). react-native-safe-area-context в зависимостях нет, поэтому
    // константа — до введения полноценного safe-area-решения.
    paddingBottom: 56,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: uiTheme.textMuted,
    backgroundColor: uiTheme.surface,
  },
  toolButton: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginHorizontal: 2,
    backgroundColor: uiTheme.paper,
    borderWidth: 1,
    borderColor: uiTheme.textMuted,
  },
  toolButtonText: {
    fontSize: 13,
    color: uiTheme.text,
  },
  toolButtonDisabled: {
    opacity: 0.4,
  },
  toolButtonTextDisabled: {
    color: uiTheme.textMuted,
  },
  modeSwitch: {
    flexDirection: 'row',
    marginLeft: 'auto',
  },
  modeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  modeButtonActive: {
    backgroundColor: uiTheme.accent,
  },
  modeText: {
    fontSize: 13,
    color: uiTheme.textMuted,
  },
  modeTextActive: {
    color: uiTheme.textOnAccent,
    fontWeight: '600',
  },
  warning: {
    backgroundColor: uiTheme.danger,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  warningText: {
    color: uiTheme.textOnAccent,
    fontSize: 13,
  },
  plusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: uiTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: {
    color: uiTheme.textOnAccent,
    fontSize: 24,
    lineHeight: 28,
  },
});
