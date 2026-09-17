// Smoke-тест словаря i18n (№31, №34): t() возвращает строку по ключу,
// базовый словарь — русский. Конвейер тестов этапа настроен здесь же.

import { t, ru, TranslationKey } from '../index';

describe('i18n словарь (smoke)', () => {
  it('t() возвращает непустую строку для существующего ключа', () => {
    expect(t('app.name')).toBe(ru['app.name']);
    expect(typeof t('app.name')).toBe('string');
    expect(t('app.name').length).toBeGreaterThan(0);
  });

  it('t() возвращает русскую строку для ключей словаря', () => {
    // Русский — базовый язык (№31): в базовом словаре обязаны быть
    // строки с кириллицей. Проверяем, что такие ключи вообще есть,
    // и что t() по каждому из них возвращает строку с кириллицей.
    const cyrillicKeys = (Object.keys(ru) as TranslationKey[]).filter(
      (key) => /[А-ЯЁа-яё]/.test(ru[key]),
    );
    expect(cyrillicKeys.length).toBeGreaterThan(0);
    for (const key of cyrillicKeys) {
      expect(t(key)).toMatch(/[А-ЯЁа-яё]/);
    }
  });
});
