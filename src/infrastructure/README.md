# Infrastructure — I/O и внешние сервисы

Слой окружения TuneDraft: всё, что касается устройства и внешнего мира.
Домены по [layers.md](../../docs/specs/architecture/layers.md): storage
(JSON-файлы `tet-<id>.json` через expo-file-system, AsyncStorage, карман)
и rendering (Skia-адаптер экрана, HTML→PDF через expo-print/expo-sharing).

## Правила слоя

- Реализует интерфейсы, объявленные в Domain или Application (R3):
  зависимость направлена вниз, к потребителю.
- Не импортирует слои выше и не обменивается импортами с другими
  инфраструктурными провайдерами «по-соседски» — композиция происходит
  в Application (антипаттерн layers.md «sideways imports»).
- Бизнес-правил не содержит: только механику доставки и хранения.

## Что сюда кладём

Адаптеры файловой системы и AsyncStorage, скрипты экспорта PDF,
обёртки Skia-канвы.

## Чего здесь не будет

Правила модели и геометрии (Domain), сценарии undo/redo (Application),
навигация и панели ввода (Entry Points).
