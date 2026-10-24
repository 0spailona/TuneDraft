// Строки интерфейса через словарь (№31): русский — база, компоненты получают
// строки только через t(key). Хардкод видимых строк в компонентах запрещён.

import { ru, type TranslationKey } from './ru';

const dictionary = ru;

/**
 * Возвращает строку интерфейса по ключу.
 * Ключи типизированы: несуществующий ключ — ошибка компиляции.
 *
 * Подстраховка от динамически собранных ключей:
 * — в dev/тестах отсутствие ключа — явная ошибка (fail fast);
 * — в проде — graceful degradation: возвращается сам ключ
 *   (например, «toolbar.undo» вместо пустой кнопки), чтобы баг
 *   был виден в UI, но не ронял экран.
 */
export function t(key: TranslationKey): string {
  if (!(key in dictionary)) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error(`i18n: ключ «${String(key)}» отсутствует в словаре ru`);
    }
    return key;
  }
  return dictionary[key];
}

export { ru, type TranslationKey };
