// Модалка ввода текста (№27): TextInput — стандартная клавиатура; для
// текст-строки — multiline (№6, №27), для текста колонки — одна строка.
// Entry-уровень (R4): клей над контроллером — сам модель не касается.
// Все видимые строки — из словаря (№31).
//
// Закрытие модалки (№27): тап по подложке вне карточки — подтверждение
// (тот же confirm-путь, что «Готово»: мутация → undo → карман №26);
// нечего подтверждать (текст пустой после trim) — тот же тап работает
// как отмена. Аппаратный «назад» (onRequestClose) — всегда отмена.
// Карточка — перехватывающий Pressable: тапы по ней не проваливаются
// на подложку.
//
// Клавиатура (№27): на современных Android (edge-to-edge) adjustResize
// на отдельное окно Modal не действует, клавиатура рисуется поверх —
// поле поднимает KeyboardAvoidingView (behavior padding), сам режим
// окна модалки (SOFT_INPUT_ADJUST_RESIZE в ReactModalHostView) при
// этом не ресайзится и задвоения компенсации нет.

import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { uiTheme } from './theme';
import { t } from '../../src/i18n';

/** Что вводится: текст-строка ленты или текст колонки (№27, №35). */
export type TextEntryKind = 'line' | 'column';

export interface TextEntryModalProps {
  /** Показана ли модалка. */
  readonly visible: boolean;
  /** Что вводится — от него зависят заголовок и многострочность. */
  readonly kind: TextEntryKind;
  /** Начальный текст (правка существующего) или пустая строка. */
  readonly initialValue: string;
  /** Подтверждение ввода: текст без изменений по краям. */
  readonly onConfirm: (text: string) => void;
  /** Отмена ввода: модалка закрывается, модель не меняется. */
  readonly onCancel: () => void;
}

/**
 * Модалка ввода текста (№27): стандартная клавиатура, для текст-строки —
 * multiline. Подтверждение отдаёт trimmed-текст; пустой текст подтверждением
 * не является (кнопка Готово неактивна) — пустые строки в модели не живут.
 */
export function TextEntryModal({
  visible,
  kind,
  initialValue,
  onConfirm,
  onCancel,
}: TextEntryModalProps) {
  const [text, setText] = useState(initialValue);
  const multiline = kind === 'line';
  const title = multiline ? t('modal.text.title.line') : t('modal.text.title.column');
  const trimmed = text.trim();
  const canConfirm = trimmed.length > 0;

  // Тап по подложке (№27): есть что сохранить — подтверждаем (confirm-путь),
  // нет — отмена (пустой текст подтверждением быть не может, №6/№35).
  const handleBackdropPress = useCallback(() => {
    if (canConfirm) {
      onConfirm(trimmed);
    } else {
      onCancel();
    }
  }, [canConfirm, trimmed, onConfirm, onCancel]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
        <Pressable
          style={styles.backdrop}
          onPress={handleBackdropPress}
          testID="text-entry-backdrop"
        >
          {/* Карточка без onPress — только перехват тапов, чтобы жест по
              карточке не трактовался как тап по подложке (№27). */}
          <Pressable style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <TextInput
              style={[styles.input, multiline && styles.inputMultiline]}
              value={text}
              onChangeText={setText}
              multiline={multiline}
              autoFocus
              placeholder={title}
              testID="text-entry-input"
            />
            <View style={styles.buttons}>
              <Pressable
                style={[styles.button, styles.buttonSecondary]}
                onPress={onCancel}
                testID="text-entry-cancel"
              >
                <Text style={styles.buttonSecondaryText}>{t('modal.text.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.button, canConfirm ? styles.buttonPrimary : styles.buttonDisabled]}
                disabled={!canConfirm}
                onPress={() => onConfirm(trimmed)}
                testID="text-entry-confirm"
              >
                <Text style={canConfirm ? styles.buttonPrimaryText : styles.buttonDisabledText}>
                  {t('modal.text.confirm')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  /** Контейнер клавиатурной компенсации (№27): занимает весь экран модалки. */
  screen: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: uiTheme.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: uiTheme.paper,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 24,
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: uiTheme.text,
  },
  input: {
    borderWidth: 1,
    borderColor: uiTheme.textMuted,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    color: uiTheme.text,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  button: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 8,
  },
  buttonPrimary: {
    backgroundColor: uiTheme.accent,
  },
  buttonPrimaryText: {
    color: uiTheme.textOnAccent,
    fontSize: 15,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
  },
  buttonSecondaryText: {
    color: uiTheme.accent,
    fontSize: 15,
  },
  buttonDisabled: {
    backgroundColor: uiTheme.disabled,
  },
  buttonDisabledText: {
    color: uiTheme.textDisabled,
    fontSize: 15,
  },
});
