// Словарь строк интерфейса. Русский — базовый язык (№31, КАРТА-ПРОЕКТА).
// Все видимые пользователю строки всегда приходят из словаря — без хардкода.
// Английский добавляется позже как отдельный словарь той же формы.

export const ru = {
  'app.name': 'TuneDraft',
  // №37: редакторская панель всегда содержит Сохранить/Закрыть/
  // Отменить (Undo ↶)/Вернуть (Redo ↷)/Экспорт PDF. Формулировки —
  // по КАРТЕ-ПРОЕКТА №37. Русский — базовый язык (№31).
  'toolbar.save': 'Сохранить',
  'toolbar.close': 'Закрыть',
  'toolbar.undo': 'Отменить',
  'toolbar.redo': 'Вернуть',
  'toolbar.exportPdf': 'Экспорт PDF',
  // №21/№35/№36: нижние панели — меню колонки и панель ладов (этап 5, экран редактора).
  'menu.column.title': 'Колонка',
  'menu.column.insertLeft': 'Вставить слева',
  'menu.column.insertRight': 'Вставить справа',
  'menu.column.clear': 'Очистить',
  'menu.column.delete': 'Удалить',
  'menu.column.addText': 'Добавить текст',
  'menu.column.editText': 'Править текст',
  'menu.column.removeBarline': 'Убрать черту',
  // Панель ладов (№21): сетка 0–24 + кнопки черты и удаления ноты.
  'panel.fret.deleteNote': 'Удалить ноту',
  'panel.fret.barline': 'Тактовая черта',
  // Выбор типа строки (№36): кнопка «+».
  'picker.rowType.title': 'Добавить строку',
  'picker.rowType.tab': 'Таб-строка',
  'picker.rowType.text': 'Текст-строка',
  // Переключатель режимов (№40).
  'mode.edit': 'Править',
  'mode.read': 'Чтение',
  // Модалка ввода текста (№27).
  'modal.text.title.line': 'Текст-строка',
  'modal.text.title.column': 'Текст колонки',
  'modal.text.confirm': 'Готово',
  'modal.text.cancel': 'Отмена',
  // Предупреждения (№18, №24, №35): коды ошибок модели → строки интерфейса.
  'warning.fret-out-of-range': 'Лад вне диапазона 0–24',
  'warning.string-index-out-of-range': 'Струна вне диапазона',
  'warning.line-not-found': 'Строка не найдена',
  'warning.column-not-found': 'Колонка не найдена',
  'warning.note-not-found': 'Нота не найдена',
  'warning.text-not-found': 'Текст не найден',
  'warning.cell-not-empty': 'Ячейка занята нотой',
  'warning.column-is-barline': 'Колонка — тактовая черта',
  'warning.barline-already-set': 'Тактовая черта уже стоит',
  'warning.barline-not-set': 'Тактовой черты нет',
  'warning.barline-column-not-empty': 'В колонке с нотами черту ставить нельзя',
  'warning.column-text-limit': 'Максимум 3 текста на колонку',
  'warning.column-text-too-long': 'Текст колонки длиннее 12 символов',
  'warning.position-out-of-range': 'Недопустимая позиция строки',
  'warning.invalid-notebook': 'Недопустимая тетрадь',
  'warning.line-id-duplicate': 'Такая строка уже есть в ленте',
} as const;

export type Dictionary = typeof ru;
export type TranslationKey = keyof Dictionary;
