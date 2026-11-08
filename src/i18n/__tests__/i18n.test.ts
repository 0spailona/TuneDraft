// Smoke-тест словаря i18n (№31, №34): t() возвращает строку по ключу,
// базовый словарь — русский. Конвейер тестов этапа настроен здесь же.

import { t, ru, TranslationKey } from '../index';
import { MODEL_ERROR_CODES } from '../../domain/tabulature/types';

describe('i18n словарь (smoke)', () => {
  it('t() возвращает непустую строку для существующего ключа', () => {
    expect(t('app.name')).toBe(ru['app.name']);
    expect(typeof t('app.name')).toBe('string');
    expect(t('app.name').length).toBeGreaterThan(0);
  });

  it('t() бросает на отсутствующем ключе (dev-ассерт)', () => {
    // Jest гоняет код с NODE_ENV=test, поэтому ассерт активен.
    // @ts-expect-error — намеренно протаскиваем несуществующий ключ.
    expect(() => t('app.nonexistent')).toThrow(/отсутствует в словаре/);
  });

  it('t() в проде возвращает сам ключ (graceful degradation)', () => {
    // В production dev-ассерт отключён: вместо throw и вместо undefined
    // t() возвращает сам ключ, чтобы пропущенная строка была видна в UI,
    // а не превратилась в пустую кнопку.
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      // @ts-expect-error — намеренно протаскиваем несуществующий ключ.
      const fallback: string = t('app.nonexistent');
      expect(fallback).toBe('app.nonexistent');
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it('словарь содержит полный состав тулбара (№37)', () => {
    // №37: панель редактора всегда содержит Сохранить/Закрыть/Отменить/
    // Вернуть/Экспорт PDF — все пять строк обязаны быть в словаре.
    const toolbar: Array<[TranslationKey, string]> = [
      ['toolbar.save', 'Сохранить'],
      ['toolbar.close', 'Закрыть'],
      ['toolbar.undo', 'Отменить'],
      ['toolbar.redo', 'Вернуть'],
      ['toolbar.exportPdf', 'Экспорт PDF'],
    ];
    for (const [key, text] of toolbar) {
      expect(ru[key]).toBe(text);
      expect(t(key)).toBe(text);
    }
  });

  it('меню колонки и панель ладов переведены (№21, №35)', () => {
    const menuKeys: TranslationKey[] = [
      'menu.column.title',
      'menu.column.insertLeft',
      'menu.column.insertRight',
      'menu.column.clear',
      'menu.column.delete',
      'menu.column.addText',
      'menu.column.removeBarline',
      'panel.fret.deleteNote',
      'panel.fret.barline',
    ];
    for (const key of menuKeys) {
      expect(typeof t(key)).toBe('string');
      expect(t(key).length).toBeGreaterThan(0);
    }
    expect(t('panel.fret.barline')).toBe('Тактовая черта');
    expect(t('panel.fret.deleteNote')).toBe('Удалить ноту');
    // У меню колонки-черты вместо текстов — «Убрать черту» (№18, №35).
    expect(t('menu.column.removeBarline')).toBe('Убрать черту');
  });

  it('выбор типа строки и переключатель режимов переведены (№36, №40)', () => {
    expect(t('picker.rowType.title')).toBe('Добавить строку');
    expect(t('picker.rowType.tab')).toBe('Таб-строка');
    expect(t('picker.rowType.text')).toBe('Текст-строка');
    expect(t('mode.edit')).toBe('Править');
    expect(t('mode.read')).toBe('Чтение');
  });

  it('предупреждение есть для каждого кода ошибки модели (полный кортеж домена)', () => {
    // Entry мапит код отказа модели в строку словаря (№31): для каждого кода
    // доменного кортежа MODEL_ERROR_CODES обязан найтись ключ warning.<code> —
    // и наоборот, в словаре нет лишних warning-ключей. Кортеж — источник
    // union ModelErrorCode (2б ревью ST-5): новый код домена автоматически
    // попадает в проверку полноты.
    const expectedKeys = MODEL_ERROR_CODES.map((code) => `warning.${code}`).sort();
    const actualKeys = (Object.keys(ru) as TranslationKey[])
      .filter((key) => key.startsWith('warning.'))
      .sort();
    expect(actualKeys).toEqual(expectedKeys);

    for (const code of MODEL_ERROR_CODES) {
      const key = `warning.${code}` as TranslationKey;
      expect(() => t(key)).not.toThrow();
      expect(t(key).length).toBeGreaterThan(0);
    }
  });

  it('модалка текста переведена (№27)', () => {
    expect(t('modal.text.title.line')).toBe('Текст-строка');
    expect(t('modal.text.title.column')).toBe('Текст колонки');
    expect(t('modal.text.confirm')).toBe('Готово');
    expect(t('modal.text.cancel')).toBe('Отмена');
  });

  it('t() возвращает русскую строку для ключей словаря', () => {
    // Русский — базовый язык (№31): в базовом словаре обязаны быть
    // строки с кириллицей. Проверяем, что такие ключи вообще есть,
    // и что t() по каждому из них возвращает строку с кириллицей.
    const cyrillicKeys = (Object.keys(ru) as TranslationKey[]).filter((key) =>
      /[А-ЯЁа-яё]/.test(ru[key]),
    );
    expect(cyrillicKeys.length).toBeGreaterThan(0);
    for (const key of cyrillicKeys) {
      expect(t(key)).toMatch(/[А-ЯЁа-яё]/);
    }
  });
});
