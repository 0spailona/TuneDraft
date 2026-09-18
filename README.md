# TuneDraft

Табулатурная тетрадь для бас-гитариста — Android-приложение (Expo + TypeScript):
4 струны E–A–D–G, лады 0–24, экспорт в PDF A4 портрет.

Состояние: этап 1 дорожной карты — каркас Expo (TypeScript) и скелет слоёв `src/`
([ADR-0003](docs/specs/decisions/0003-src-layer-directories.md)). Доменные фичи
(модель, layout-движок, ввод, хранение, рендер) — этапы 2–8.

## Запуск

Требования: Node.js (LTS), JDK 17, Android SDK (platform-tools, platforms; API ≥ 24).

1. Установить зависимости:

   ```bash
   npm install
   ```

2. Подключить устройство с включённой USB-отладкой (или запустить эмулятор AVD)
   и проверить, что оно видно:

   ```bash
   adb devices
   ```

3. Собрать и запустить на устройстве:

   ```bash
   npx expo run:android
   ```

Переменные окружения для шага 3 (если SDK не найден автоматически):
`ANDROID_HOME=~/Android/Sdk` (или `ANDROID_SDK_ROOT`), `JAVA_HOME` → JDK 17.
На Arch Linux JDK 17 ставится, например, так: `sudo pacman -S jdk17-openjdk`.

Без нативной сборки приложение можно открыть в Expo Go: `npm start`.

## Разработка

- `npm run typecheck` — проверка типов (`tsc --noEmit`);
- `npm test` — юнит-тесты (jest-expo);
- `npm start` — Expo dev-сервер.

Тесты лежат рядом с кодом в каталогах `__tests__/` (например, `src/i18n/__tests__/i18n.test.ts`); в production-сборку они не попадают.

## Specifications

Detailed system specs live in `docs/specs/`. Before making structural changes, read the relevant spec:

- Start with `docs/specs/INDEX.md` to find the right document for your task.
- `docs/specs/META.md` defines spec formats and update rules.
- `agents.md` — правила работы для AI-агентов.
