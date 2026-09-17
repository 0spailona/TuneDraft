// Строки интерфейса через словарь (№31): русский — база, компоненты получают
// строки только через t(key). Хардкод видимых строк в компонентах запрещён.

import { ru, type TranslationKey } from './ru';

const dictionary = ru;

/**
 * Возвращает строку интерфейса по ключу.
 * Ключи типизированы: несуществующий ключ — ошибка компиляции.
 */
export function t(key: TranslationKey): string {
  return dictionary[key];
}

export { ru, type TranslationKey };
