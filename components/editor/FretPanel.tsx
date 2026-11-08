// Панель ладов (№21): сетка цифр 0–24 в несколько рядов внизу экрана
// (зона клавиатуры, №21, №36). Два режима по состоянию ячейки:
// пустая ячейка → кнопка «Тактовая черта» (№18) + цифры (вставка ноты,
// свежий id — забота контроллера); занятая → «Удалить ноту» (№21) и БЕЗ
// кнопки черты (№21, №18: черта только в пустую колонку).
// Entry-уровень (R4): клей — интенты собирает EditorScreen.
// Все видимые строки — из словаря (№31).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { uiTheme } from './theme';
import { t } from '../../src/i18n';
import { MAX_FRET } from '../../src/domain/tabulature/types';

export interface FretPanelProps {
  /** Занята ли ячейка нотой: режим вставки (false) или правки (true). */
  readonly cellOccupied: boolean;
  /** Нажата цифра лада 0–24. */
  readonly onFret: (fret: number) => void;
  /** Нажата «Тактовая черта» (только для пустой ячейки). */
  readonly onBarline: () => void;
  /** Нажата «Удалить ноту» (только для занятой ячейки). */
  readonly onDeleteNote: () => void;
}

/** Цифры лада панели (№3, №21): ровно 0–24. */
const FRET_DIGITS: readonly number[] = Array.from({ length: MAX_FRET + 1 }, (_, fret) => fret);

/**
 * Панель ладов (№21): цифры 0–24 в несколько рядов; у пустой ячейки —
 * «Тактовая черта», у занятой — «Удалить ноту» (кнопка черты скрыта, №21).
 */
export function FretPanel({ cellOccupied, onFret, onBarline, onDeleteNote }: FretPanelProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.grid}>
        {FRET_DIGITS.map((fret) => (
          <Pressable
            key={fret}
            style={styles.fretButton}
            onPress={() => onFret(fret)}
            testID={`fret-${fret}`}
          >
            <Text style={styles.fretText}>{String(fret)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.actionsRow}>
        {cellOccupied ? (
          <Pressable
            style={[styles.actionButton, styles.deleteButton]}
            onPress={onDeleteNote}
            testID="panel-delete-note"
          >
            <Text style={styles.deleteText}>{t('panel.fret.deleteNote')}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.actionButton, styles.barlineButton]}
            onPress={onBarline}
            testID="panel-barline"
          >
            <Text style={styles.barlineText}>{t('panel.fret.barline')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const BUTTONS_PER_ROW = 9;

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'column',
    backgroundColor: uiTheme.surface,
    borderTopWidth: 1,
    borderTopColor: uiTheme.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  fretButton: {
    width: `${100 / BUTTONS_PER_ROW}%` as `${number}%`,
    alignItems: 'center',
    paddingVertical: 8,
  },
  fretText: {
    fontSize: 16,
    color: uiTheme.text,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  barlineButton: {
    // 9 ревью ST-5: черта — обычное действие, не «опасное» — нейтральный стиль.
    backgroundColor: uiTheme.paper,
    borderWidth: 1,
    borderColor: uiTheme.textMuted,
  },
  barlineText: {
    color: uiTheme.text,
    fontSize: 15,
  },
  deleteButton: {
    // 9 ревью ST-5: всё, что удаляет, — акцентный синий (один цвет удаления).
    backgroundColor: uiTheme.accent,
  },
  deleteText: {
    color: uiTheme.textOnAccent,
    fontSize: 15,
  },
});
