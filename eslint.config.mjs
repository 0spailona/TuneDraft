// ESLint 10 flat config. Слои под защитой линтера:
//   src/domain/**         — R1: без I/O, фреймворков, UI- и тестовых библиотек;
//   src/application/**    — R2: без фреймворков/UI, entry-файлов и infrastructure
//                           (превентивно, до появления кода слоя);
//   src/infrastructure/** — R4-симметрия: без entry-файлов (превентивно).
// Правила форматирования отданы prettier (eslint-config-prettier последним).
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
// eslint-plugin-import 2.x несовместим с ESLint 10 (peer eslint@^9) — используем
// поддерживаемый форк с тем же API правил (drop-in).
import importX from 'eslint-plugin-import-x';

export default tseslint.config(
  { ignores: ['node_modules/', 'dist/', '.expo/', '.idea/'] },
  // Регистрация плагина под именем "import" — для правил import/* ниже.
  { plugins: { import: importX } },
  // node-резолвер плагина по умолчанию не знает расширение .ts; без этого
  // import-правила молча пропускают неразрешённые относительные импорты.
  {
    settings: {
      'import-x/resolver': {
        node: { extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'] },
      },
    },
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // jest-globals в тестах; типы подключены через tsconfig (jest-expo)
      'no-undef': 'off',
    },
  },
  {
    files: ['jest.config.js'],
    languageOptions: {
      globals: { module: 'readonly' },
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      // R1: Domain чистый — только относительные импорты внутри слоя
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'expo',
                'expo/*',
                'react-native',
                'react-native/*',
                'react',
                'react/*',
                'expo-status-bar',
                'jest',
                '@jest/*',
                '@testing-library/*',
              ],
              message: 'Слой Domain (R1) не зависит от фреймворков, UI- и тестовых библиотек.',
            },
          ],
        },
      ],
      // R1-гард (3b) настроен ниже в общем блоке import/no-restricted-paths:
      // зоны объявлены в ОДНОМ конфиг-объекте — в flat config одноимённое правило
      // из последнего объекта перезаписывает предыдущее, а не мержится.
    },
  },
  {
    // R1-гард (3b): domain не импортирует остальные слои; entry-файлы (App.tsx,
    // index.ts) недоступны из всех слоёв src/ (R4: их зона — только wiring).
    // Path-алиасов в проекте нет — межслойные импорты будут относительными,
    // а group-паттерны no-restricted-imports матчат лишь bare-спецификаторы;
    // import/no-restricted-paths работает по зонам (target → from) и ловит их.
    // ВАЖНО: все зоны в одном объекте (в flat config одноимённое правило из
    // последнего объекта перезаписывает предыдущее), а from/except — директории,
    // не globs: glob-`from` в import-x v4 не применяет except.
    files: ['src/**/*.ts'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              // Зона 1: в файлах src/domain запрещены импорты из src вне domain
              // (except — подкаталог from, относительный путь не 'parent' → валиден).
              target: './src/domain',
              from: './src',
              except: ['./domain'],
              message:
                'Domain (R1) не импортирует остальные слои (application, infrastructure, i18n).',
            },
            // Зона 2: entry-файлы — только wiring, из слоёв не импортируются
            // (from — конкретные файлы: не-glob валидаторы, точное совпадение пути).
            { target: './src', from: ['./App.tsx', './index.ts'] },
          ],
        },
      ],
    },
  },
  {
    // R2 (превентивно, до появления кода слоя): Application вызывает Domain и
    // получает возможности Infrastructure только через собственные интерфейсы —
    // ни фреймворков и UI, ни entry-файлов, ни прямых импортов из infrastructure/.
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'expo',
                'expo/*',
                'expo-status-bar',
                'react',
                'react/*',
                'react-native',
                'react-native/*',
                'jest',
                '@jest/*',
                '@testing-library/*',
              ],
              message: 'Application (R2) не зависит от фреймворков, UI- и тестовых библиотек.',
            },
            {
              // Локальные модули в Expo/Metro импортируются только относительными
              // путями, поэтому entry-файлы и infrastructure/ ловятся regex-паттернами
              // (group-паттерны матчат лишь bare-спецификаторы, нерезолвимые здесь).
              regex: '^(\\./|\\.\\./)+(App|index)$',
              message: 'Application (R4): entry-файлы недоступны — их зона только wiring.',
            },
            {
              regex: '(^|\\/)infrastructure(\\/|$)',
              message:
                'Application (R2): Infrastructure доступна только через интерфейсы, объявленные здесь.',
            },
          ],
        },
      ],
    },
  },
  {
    // R4-симметрия (превентивно): Infrastructure — реализации интерфейсов, а не
    // точки входа; expo-* здесь разрешены (expo-file-system, expo-print — его зона).
    files: ['src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(\\./|\\.\\./)+(App|index)$',
              message: 'Infrastructure не импортирует entry-файлы (R4: их зона — только wiring).',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
