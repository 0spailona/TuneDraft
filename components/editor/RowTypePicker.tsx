// Мини-выбор типа строки (№36): открывается кнопкой «+» — вставить
// таб-строку или текст-строку. Entry-уровень (R4): клей над контроллером —
// позицию вставки и ёмкость таб-строки считает экран (EditorScreen).
// Все видимые строки — из словаря (№31). Цвета — из UI-темы (находка 20).

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { uiTheme } from './theme';
import { t } from '../../src/i18n';

export interface RowTypePickerProps {
  /** Выбрана таб-строка. */
  readonly onPickTab: () => void;
  /** Выбрана текст-строка. */
  readonly onPickText: () => void;
}

/**
 * Мини-выбор типа строки (№36; ревью ST-5, находка 15): две равнозначные
 * кнопки «Таб-строка / Текст-строка» — без «радио»-точек, ни один вариант
 * не нарисован выбранным заранее: выбор происходит только нажатием.
 */
export function RowTypePicker({ onPickTab, onPickText }: RowTypePickerProps) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('picker.rowType.title')}</Text>
      <View style={styles.row}>
        <Pressable style={styles.option} onPress={onPickTab} testID="picker-tab-line">
          <Text style={styles.optionText}>{t('picker.rowType.tab')}</Text>
        </Pressable>
        <Pressable style={styles.option} onPress={onPickText} testID="picker-text-line">
          <Text style={styles.optionText}>{t('picker.rowType.text')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: uiTheme.surface,
    borderTopWidth: 1,
    borderTopColor: uiTheme.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: 13,
    color: uiTheme.textMuted,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  option: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: uiTheme.textMuted,
    backgroundColor: uiTheme.paper,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 4,
  },
  optionText: {
    fontSize: 15,
    color: uiTheme.text,
  },
});
