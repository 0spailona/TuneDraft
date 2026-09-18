// Строки интерфейса через словарь (№31): русский — база, компоненты получают
// строки только через t(key). Хардкод видимых строк в компонентах запрещён.

import { ru, type TranslationKey } from './ru';

const dictionary = ru;

/**
 * Возвращает строку интерфейса по ключу.
 * Ключи типизированы: несуществующий ключ — ошибка компиляции.
 * Подстраховка от динамически собранных ключей: в dev/тестах отсутствие
 * ключа в словаре — явная ошибка, а не пустая строка в UI.
 */
export function t(key: TranslationKey): string {
  if (process.env.NODE_ENV !== 'production' && !(key in dictionary)) {
    throw new Error(`i18n: ключ «${String(key)}» отсутствует в словаре ru`);
  }
  return dictionary[key];
}

export { ru, type TranslationKey };
