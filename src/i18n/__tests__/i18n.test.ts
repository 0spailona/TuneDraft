// Smoke-тест словаря i18n (№31, №34): t() возвращает строку по ключу,
// базовый словарь — русский. Конвейер тестов этапа настроен здесь же.

import { t, ru, TranslationKey } from '../index';

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
