// Меню колонки (№35): нижняя панель действий над выделенной колонкой —
// вставить слева/справа, очистить, удалить, добавить/править текст (№27, №35).
// У колонки-черты (№18) «Очистить» скрыта, а вместо текстовых действий —
// «Убрать черту» (№35: clearColumn черты снимает черту, отдельная «Очистить»
// дублировала бы то же действие).
// Entry-уровень (R4): клей над контроллером. Все строки — из словаря (№31).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { uiTheme } from './theme';
import { t } from '../../src/i18n';

/**
 * Текст колонки для списка правки (тур-3 ревью ST-5, находка 3а): id —
 * стабильный ключ списка React (не index — фрагильны при будущих
 * анимациях/переупорядочении), text — метка кнопки.
 */
export interface ColumnTextItem {
  readonly id: string;
  readonly text: string;
}

export interface ColumnMenuProps {
  /**
   * Колонка — черта (№18): «Очистить» скрыта, вместо текстовых действий —
   * «Убрать черту» (№35: clearColumn черты снимает черту).
   */
  readonly isBarline: boolean;
  /** Есть ли у колонки хотя бы один текст (№35: правка текста — через меню). */
  readonly hasTexts: boolean;
  /**
   * Тексты колонки в порядке модели (2b ревью ST-5) — пары id/текст
   * (3а ревью ST-5): метки списка правки, id — ключ списка. Пустой список —
   * правка недоступна, только добавление.
   */
  readonly texts: readonly ColumnTextItem[];
  readonly onInsertLeft: () => void;
  readonly onInsertRight: () => void;
  readonly onClear: () => void;
  readonly onDelete: () => void;
  /** Добавить текст (максимум 3 — отказ даст предупреждение, №35). */
  readonly onAddText: () => void;
  /** Править текст по индексу (№27, №35): один текст — сразу модалка, 2–3 —
   * сначала раскрывается список текстов (2b ревью ST-5). */
  readonly onEditText: (index: number) => void;
  /** Убрать черту (только у колонки-черты, №18, №35). */
  readonly onRemoveBarline: () => void;
}

/** Строка меню — обычная кнопка панели; destructive — удаляющая (синий акцент). */
function MenuButton({
  label,
  testID,
  onPress,
  destructive = false,
}: {
  readonly label: string;
  readonly testID: string;
  readonly onPress: () => void;
  readonly destructive?: boolean;
}) {
  return (
    <Pressable
      style={[styles.button, destructive && styles.buttonDelete]}
      onPress={onPress}
      testID={testID}
    >
      <Text style={[styles.buttonText, destructive && styles.buttonTextDelete]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Меню колонки (№35): вставка слева/справа, очистка, удаление (каскад текстов,
 * №19); у обычной колонки — текстовые действия (№27, №35), у черты —
 * «Убрать черту» (№18, №35).
 */
export function ColumnMenu({
  isBarline,
  hasTexts,
  texts,
  onInsertLeft,
  onInsertRight,
  onClear,
  onDelete,
  onAddText,
  onEditText,
  onRemoveBarline,
}: ColumnMenuProps) {
  // Список правки (2b ревью ST-5): при 2–3 текстах «Править текст» сначала
  // раскрывает список; компонент пересоздаётся на каждую колонку (EditorScreen
  // задаёт key = columnId), поэтому локальное раскрытие не перетекает между
  // колонками.
  const [textListOpen, setTextListOpen] = useState(false);
  const handleEditTextPress = () => {
    if (texts.length === 1) {
      onEditText(0);
      return;
    }
    setTextListOpen((open) => !open);
  };
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t('menu.column.title')}</Text>
      <View style={styles.row}>
        <MenuButton
          label={t('menu.column.insertLeft')}
          testID="column-insert-left"
          onPress={onInsertLeft}
        />
        <MenuButton
          label={t('menu.column.insertRight')}
          testID="column-insert-right"
          onPress={onInsertRight}
        />
      </View>
      <View style={styles.row}>
        {/* «Очистить» только у обычной колонки (6 ревью ST-5): у черты
            clearColumn снимает черту — дублировала бы «Убрать черту» (№35).
            Удаляющие кнопки — синий акцент (9 ревью ST-5). */}
        {!isBarline && (
          <MenuButton
            label={t('menu.column.clear')}
            testID="column-clear"
            onPress={onClear}
            destructive
          />
        )}
        <MenuButton
          label={t('menu.column.delete')}
          testID="column-delete"
          onPress={onDelete}
          destructive
        />
      </View>
      <View style={styles.row}>
        {isBarline ? (
          <MenuButton
            label={t('menu.column.removeBarline')}
            testID="column-remove-barline"
            onPress={onRemoveBarline}
            destructive
          />
        ) : (
          // Обе текстовые кнопки в одном ряду (2b ревью ST-5): добавление
          // доступно всегда (до 3 текстов, 4-й — отказ с предупреждением),
          // правка — когда тексты уже есть (№35, №27).
          <>
            <MenuButton
              label={t('menu.column.addText')}
              testID="column-add-text"
              onPress={onAddText}
            />
            {hasTexts && (
              <MenuButton
                label={t('menu.column.editText')}
                testID="column-edit-text"
                onPress={handleEditTextPress}
              />
            )}
          </>
        )}
      </View>
      {textListOpen && texts.length > 1 && (
        <View>
          {texts.map((item, index) => (
            <MenuButton
              key={item.id}
              label={item.text}
              testID={`column-edit-text-${index}`}
              onPress={() => {
                setTextListOpen(false);
                onEditText(index);
              }}
            />
          ))}
        </View>
      )}
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
  button: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 4,
    backgroundColor: uiTheme.paper,
    borderWidth: 1,
    borderColor: uiTheme.textMuted,
  },
  buttonText: {
    fontSize: 15,
    color: uiTheme.text,
  },
  buttonDelete: {
    // 9 ревью ST-5: всё, что удаляет содержимое, — акцентный синий.
    borderColor: uiTheme.accent,
  },
  buttonTextDelete: {
    color: uiTheme.accent,
  },
});
