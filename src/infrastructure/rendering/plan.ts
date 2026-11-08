// Детерминированный план отрисовки тетради (этап 4 дорожной карты, КАРТА §3):
// декларативные примитивы (линии струн, цифры лада, тактовые черты, стопки
// текстов колонок, ключи, перенесённые текст-строки, подсветка выделения №40)
// с px-координатами, зоны тапов (№5, №35) и общая высота документа. Спека:
// docs/specs/domains/rendering/README.md (Invariants, Flow) и
// docs/specs/domains/layout-engine.md (Core Types — вход плана).
//
// Рендеринг не считает геометрию сам (№14): план — тонкий перевод словаря
// layout-движка (символы, ADR-0004) в пиксели умножением на advancePx, плюс
// собственные заботы рендерера: перенос текст-строк пропорциональным шрифтом
// (№6, ADR-0004 п. 4) через инъекцию measurer и раскладка готового контента
// по странице — таб-системы сдвигаются единым центрированным блоком, документ
// начинается с верхнего отступа темы (остаток полосы — поля рендерера, №23;
// «тетрадь», №7). План ничего не рисует и
// ничего не знает о Skia/HTML: потребители (Skia-рендер экрана, HTML→PDF, превью)
// обходят примитивы и рисуют каждый своим способом (№14, №23).
//
// Слой Infrastructure (rendering): импортирует Domain вниз по слоям (R1–R3),
// без entry-файлов (R4-симметрия, eslint); детерминированная функция
// (модель, layout, опции) — повторный вызов даёт идентичный план (№14).
// Ошибки здесь — дефекты контракта «layout построен из этой же модели», а не
// доменные отказы: движок тотален на валидной модели (measure.ts, emit.ts).

import type { Column, EntityId, Notebook, TabLine } from '../../domain/tabulature/types';
import { TEXT_ROW_SPACING_CHARS } from '../../domain/layout-engine';
import type { LaidOutSystem, NotebookLayout, TabLineLayout } from '../../domain/layout-engine';
import type { Theme } from './theme';

/**
 * Измеритель пропорционального шрифта (№32, theme.fonts.textLine): инъекция,
 * разрывающая зависимость плана от платформы. Потребитель (Skia-рендер экрана,
 * HTML→PDF) измеряет своим шрифтом текст-строк; тесты подставляют детерминированный
 * фейк (например, 10 px на символ).
 */
export interface TextLineMeasurer {
  /** Ширина строки текста в px при шрифте текст-строк темы (№32, ADR-0004 п. 4). */
  measureTextWidthPx(text: string): number;
}

/**
 * Окно отрисовки (№28): срез строк ленты — видимые строки плюс резервный запас.
 * Индексы — абсолютные номера строк ленты (0 — первая), включительно с обеих
 * границ; выход за пределы ленты обрезается. Окно режет только ПРИМИТИВЫ:
 * y-координаты остаются абсолютными координатами документа, а heightPx плана —
 * полной высотой документа (размер скролла считается по всему документу, №28).
 */
export interface DrawWindow {
  /** Индекс первой строки ленты окна (включительно). */
  readonly firstRow: number;
  /** Индекс последней строки ленты окна (включительно). */
  readonly lastRow: number;
}

/** Линия струны системы (№2): горизонталь во всю ширину полосы системы (№20). */
export interface StringLinePrimitive {
  readonly kind: 'stringLine';
  readonly lineId: EntityId;
  readonly systemIndex: number;
  /** Индекс струны: 0 — верхняя (E1 в v1, №2). */
  readonly stringIndex: number;
  /** Левый край линии: отступ под ключ (№36) + единый сдвиг центрирования (№23). */
  readonly xPx: number;
  /** y линии струны: верх системы + stringYChars[stringIndex] · advance (№2). */
  readonly yPx: number;
  /** Ширина полосы системы: widthChars системы из layout · advance (№20). */
  readonly widthPx: number;
}

/**
 * Цифра лада (№3, №19): лежит на пересечении своей струны и колонки —
 * x = сдвиг центрирования (№23) + центр ячейки (xChars + widthChars/2) · advance,
 * y = stringYChars · advance (цифра рисуется по центру линии струны). kind черты
 * не имеет: в черте нот нет (№18).
 */
export interface FretDigitPrimitive {
  readonly kind: 'fretDigit';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  readonly noteId: EntityId;
  readonly systemIndex: number;
  readonly stringIndex: number;
  /** Лад 0–24; рендерер рисует его текстом (моноширинный шрифт цифр, №32). */
  readonly fret: number;
  readonly xPx: number;
  readonly yPx: number;
}

/**
 * Тактовая черта (№18, №36): вертикаль через все струны системы, по центру
 * своей колонки-черты. kind колонки берётся из модели по columnId: в layout-словаре
 * (LaidOutColumn) вида колонки нет — план сверяется с моделью напрямую.
 */
export interface BarlinePrimitive {
  readonly kind: 'barline';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  readonly systemIndex: number;
  /** x вертикали: центр колонки-черты + единый сдвиг центрирования (№23). */
  readonly xPx: number;
  /** Верх вертикали: линия верхней струны системы. */
  readonly yTopPx: number;
  /** Низ вертикали: линия нижней струны системы. */
  readonly yBottomPx: number;
}

/**
 * Текст колонки (№24, №35): едет под таб-строкой вместе со своей колонкой —
 * x = x колонки-владельца (из layout, №24) + сдвиг центрирования (№23),
 * y — своя строка общей стопки системы.
 */
export interface ColumnTextPrimitive {
  readonly kind: 'columnText';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  readonly textId: EntityId;
  /** Текст из модели без изменений (движок и план его не режут, №24). */
  readonly text: string;
  readonly xPx: number;
  /** y строки стопки: верх системы + yChars из layout · advance (№24). */
  readonly yPx: number;
}

/**
 * Басовый ключ 𝄢 в левом отступе каждой системы (№36): прямоугольник отступа,
 * в котором рендерер центрирует глиф; на экране зона ключа — ещё и ручка drag
 * строки (№36, забота рендерера/жестов, не плана).
 */
export interface ClefPrimitive {
  readonly kind: 'clef';
  readonly lineId: EntityId;
  readonly systemIndex: number;
  /** Левый край отступа: единый сдвиг центрирования блока (№23), у всех систем один. */
  readonly xPx: number;
  /** Верх прямоугольника: верх системы (линия первой струны). */
  readonly yPx: number;
  /** Ширина отступа: theme.clefMarginChars · advance (№36, №32). */
  readonly widthPx: number;
  /** Высота: от первой до последней струны системы. */
  readonly heightPx: number;
}

/**
 * Строка перенесённого текста текст-строки (№6): текст-строка не привязана к
 * нотам и колонкам (№6, №35), её перенос — забота рендерера (ADR-0004 п. 4),
 * выполняется здесь пропорциональным шрифтом темы через measurer (№32).
 */
export interface TextRowPrimitive {
  readonly kind: 'textRow';
  readonly lineId: EntityId;
  /** Номер строки переноса внутри текст-строки: 0, 1, 2… */
  readonly rowIndex: number;
  /** Текст строки переноса — слова, склеенные одинарными пробелами. */
  readonly text: string;
  /**
   * x строки: центрирование по своей измеренной ширине —
   * max(0, (widthPx − ширина строки)/2); строка на всю полосу и перепуск
   * (слово шире полосы, ADR-0004 п. 3) остаются у левого края.
   */
  readonly xPx: number;
  /**
   * y строки: верх текст-строки + theme.textLinePaddingPx (вертикальный отступ,
   * №32) + rowIndex · theme.fonts.textLine.lineHeight. Отступ держит первую
   * строку переноса на расстоянии от контента предыдущей строки ленты.
   */
  readonly yPx: number;
}

/**
 * Цель выделения (№40, №35): локальный словарь rendering поверх domain-id
 * (№19) — ячейка (пересечение струны и колонки, №20) или колонка целиком.
 * Один словарь на вход и выход интерактивности: опция selection плана и
 * результат hit-теста (hit-test.ts) говорят на одном языке, application-типов
 * здесь нет (R3: инфраструктура не импортирует вверх).
 */
export interface CellTarget {
  readonly kind: 'cell';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  /** Индекс струны ячейки: 0 — верхняя (№2). */
  readonly stringIndex: number;
}

/** Цель выделения «колонка» (№35): строка ленты + колонка модели. */
export interface ColumnTarget {
  readonly kind: 'column';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
}

/** Выделение — ровно одна цель: ячейка или колонка (№5, №35). */
export type SelectionTarget = CellTarget | ColumnTarget;

/**
 * Рамка выделенной ячейки (№40): прямоугольник вокруг пересечения струны и
 * колонки — по границам колонки по x, от середины зазора до соседней струны
 * сверху до середины зазора снизу по y. Рисуется поверх контента (№40).
 */
export interface SelectionCellFramePrimitive {
  readonly kind: 'selectionCellFrame';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  readonly stringIndex: number;
  readonly systemIndex: number;
  /** Левый край ячейки (= левый край колонки, px). */
  readonly xPx: number;
  /** Верх рамки: y линии струны минус полувысота ячейки, px. */
  readonly yPx: number;
  /** Ширина ячейки = ширина колонки (px). */
  readonly widthPx: number;
  /** Высота рамки: удвоенная полувысота ячейки (px). */
  readonly heightPx: number;
}

/**
 * Полоса выделенной колонки (№40, №35): вертикальная полоса по границам
 * колонки от верха полосы системы (зона заголовка, №35) до её низа.
 */
export interface SelectionColumnBandPrimitive {
  readonly kind: 'selectionColumnBand';
  readonly lineId: EntityId;
  readonly columnId: EntityId;
  readonly systemIndex: number;
  /** Левый край полосы (= левый край колонки, px). */
  readonly xPx: number;
  /** Верх полосы: зона заголовка — полоса в один advance над первой струной (№35). */
  readonly yTopPx: number;
  /** Ширина полосы = ширина колонки (px). */
  readonly widthPx: number;
  /** Низ полосы: низ полосы системы (замыкание с зазором текстов, №32). */
  readonly yBottomPx: number;
}

/** Примитив плана — один из видов ниже; рендерер диспатчит по kind. */
export type DrawPrimitive =
  | StringLinePrimitive
  | FretDigitPrimitive
  | BarlinePrimitive
  | ColumnTextPrimitive
  | ClefPrimitive
  | TextRowPrimitive
  | SelectionCellFramePrimitive
  | SelectionColumnBandPrimitive;

/** План отрисовки документа (№14, №23): примитивы в порядке построения ленты. */
export interface NotebookDrawPlan {
  /** Примитивы окна (или всего документа, если окно не задано), №28. */
  readonly primitives: readonly DrawPrimitive[];
  /**
   * Зоны тапа (№5, №35) — px-прямоугольники с готовыми координатами, тем же
   * детерминированным переводом символов движка в px (№14): cell — рамка
   * пересечения струна×колонка, columnHeader — полоса колонки высотой в один
   * advance над первой струной (зона заголовка, №35; см. эмиссию в
   * emitSystemPrimitives). Порядок: слева направо по системам и строкам
   * ленты; hit-test (hit-test.ts) — чистая функция над ними.
   */
  readonly hitZones: readonly HitZone[];
  /** Ширина документа в px — эхо опции: полоса, по которой резались текст-строки. */
  readonly widthPx: number;
  /**
   * Полная высота документа в px — верхний отступ документа (№7, №32:
   * theme.documentTopPaddingPx входит один раз) плюс сумма высот ВСЕХ строк
   * ленты, независимо от окна: окно режет примитивы, но не геометрию
   * документа (№28).
   */
  readonly heightPx: number;
}

/**
 * Зона тапа (№5, №35): px-прямоугольник плана с id сущностей модели —
 * «в этот прямоугольник тапнули → это сущность». Ячейка — пересечение
 * струна×колонка; зона заголовка колонки — полоса колонки высотой в один
 * advance над первой струной (заголовок, №35). Координаты — готовые px из
 * того же перевода, что и примитивы (№14).
 */
export interface HitZone {
  /** Прямоугольник зоны в px документа. */
  readonly rect: PxRect;
  /** Сущности модели, выбираемые тапом в зону. */
  readonly target: HitZoneTarget;
}

/**
 * Прямоугольник в px документа (инфраструктурный, №14): левый край и верх —
 * xPx/yPx, размеры — widthPx/heightPx.
 */
export interface PxRect {
  readonly xPx: number;
  readonly yPx: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

/**
 * Цель зоны тапа (№5, №35): ячейка (id строки, колонки, индекс струны) или
 * колонка (id строки, id колонки). Ровно один из двух — выбор между ячейкой
 * и колонкой делает hit-test по зоне, не потребитель (№5: тап всегда
 * разрешается ровно в одну цель).
 */
export type HitZoneTarget = CellTarget | ColumnTarget;

/**
 * Ёмкость полосы в символах движка (№20, №23; ревью ST-5, находка 17):
 * floor(ширина / advance), минимум 1 — единственное место перевода px
 * экрана в символы движка. Потребители — канва (layoutNotebook) и экран
 * (ёмкость новой таб-строки, №36): одна арифметика вместо двух копий.
 */
export function stripCapacityChars(widthPx: number, advancePx: number): number {
  return Math.max(1, Math.floor(widthPx / advancePx));
}

/** Опции построения плана: тема, единица перевода символов в px, measurer, окно. */
export interface DrawPlanOptions {
  /** Зашитая тема MVP (№32): отступ ключа и высота строки текст-строк. */
  readonly theme: Theme;
  /** Advance моноширинного шрифта цифр лада в px — единица перевода (№32, ADR-0004). */
  readonly advancePx: number;
  /** Ширина документа в px — полоса переноса текст-строк (№6, ADR-0004 п. 4). */
  readonly widthPx: number;
  /** Измеритель пропорционального шрифта текст-строк (см. TextLineMeasurer). */
  readonly measurer: TextLineMeasurer;
  /** Окно отрисовки (№28); не задано — план строится на всю ленту. */
  readonly window?: DrawWindow;
  /**
   * Выделение (№40): примитивы подсветки выбранной ячейки/колонки (№35).
   * Не задано — примитивов выделения нет, план идентичен прежнему выводу
   * (кроме новой, пустой, зоны тапов hitZones — она не примитив).
   */
  readonly selection?: SelectionTarget;
}

/** Вход шага «примитивы одной системы»: layout системы + словари модели строки. */
interface SystemPrimitivesInput {
  readonly out: DrawPrimitive[];
  /** Куда класть зоны тапов системы (№5, №35): ячейки и заголовки колонок. */
  readonly hitZones: HitZone[];
  readonly tabLayout: TabLineLayout;
  readonly system: LaidOutSystem;
  /** Колонки модели строки по id: план берёт из модели kind и ноты (№18, №19). */
  readonly columnsById: ReadonlyMap<EntityId, Column>;
  /** Тексты модели строки по id: план переносит текст без изменений (№24). */
  readonly textsById: ReadonlyMap<EntityId, string>;
  /** Абсолютный верх системы в документе, px. */
  readonly topPx: number;
  /** Левый отступ под ключ (theme.clefMarginChars · advance, №36). */
  readonly leftMarginPx: number;
  /**
   * Единый сдвиг центрирования всех таб-систем документа (№23, №7): блок
   * «отступ ключа + полоса системы» центрируется в widthPx. Одинаков для
   * всех систем (полоса у систем одна — widthChars из MEASURE, №20).
   */
  readonly leftOffsetPx: number;
  readonly advancePx: number;
  /** y нижней струны системы от её верха, в символах (строк струн ≥ 1, №2). */
  readonly bottomStringYChars: number;
  /**
   * Выделение (№40), если оно относится к этой таб-строке: подсветка выбранной
   * ячейки/колонки рисуется в системе, где лежит целевая колонка (колонка
   * не рвётся между системами — перенос по тактам, №18).
   */
  readonly selection?: SelectionTarget;
}

/**
 * Перенос текста текст-строки по ширине полосы (№6, ADR-0004 п. 4): жадная
 * укладка слов — слово добавляется к строке, пока measurer укладывает его
 * в полосу; не влезло — строка закрывается. Одиночное слово шире полосы уходит
 * строкой целиком (перепуск допустим — по аналогии с тактом шире полосы,
 * ADR-0004 п. 3; резать слово план не имеет права — №24 о запрете тихой обрезки).
 * Пустой текст — одна пустая строка. Разделитель слов — любая пробельная
 * подпоследовательность (ADR-0005 п. 5): переводы строк и табуляции считаются
 * обычными пробелами — текст-строка в MVP это один текучий абзац, явная
 * многострочность модели на рендер не проносится. Детерминировано: никаких
 * срезов по-другому.
 */
function wrapTextLine(text: string, bandWidthPx: number, measurer: TextLineMeasurer): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) {
    return [''];
  }
  const rows: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (measurer.measureTextWidthPx(candidate) <= bandWidthPx) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      rows.push(current);
    }
    current = word;
  }
  if (current.length > 0) {
    rows.push(current);
  }
  return rows;
}

/**
 * Низ полосы системы в символах (№24, №32): до самого низкого текста стопки,
 * а без текстов — до нижней струны; зазор строки текстов (TEXT_ROW_SPACING_CHARS)
 * замыкает полосу. Единственная точка формулы: и высота полосы в высоте строки
 * ленты (№28), и низ полосы выделенной колонки (№40, №35) замыкаются в одной
 * точке — полоса выделения не обрезает текстовую стопку своей системы.
 */
function systemStripBottomChars(system: LaidOutSystem, bottomStringYChars: number): number {
  return system.texts.reduce((max, text) => Math.max(max, text.yChars), bottomStringYChars);
}

/**
 * Примитивы одной системы (№20): ключ в левом отступе (№36), линии струн по
 * y из layout (№2), цифры на пересечениях струна×колонка с центрированием,
 * черта — вертикаль через все струны (kind из модели по columnId, №18), тексты
 * колонок — стопкой под нижней струной, x = x колонки-владельца (№24).
 * Порядок примитивов детерминирован: ключ, струны, колонки слева направо,
 * тексты стопки по порядку layout (№14).
 */
function emitSystemPrimitives(input: SystemPrimitivesInput): void {
  const {
    out,
    hitZones,
    tabLayout,
    system,
    columnsById,
    textsById,
    topPx,
    leftMarginPx,
    leftOffsetPx,
    advancePx,
    bottomStringYChars,
    selection,
  } = input;
  const lineId = tabLayout.lineId;
  // y нижней струны в px — единственный перевод символов в px на систему
  // (умножение на advance, №14/№32); делений в плане нет.
  const bottomStringYPx = bottomStringYChars * advancePx;

  // Ключ 𝄢 (№36): прямоугольник левого отступа каждой системы; левый край —
  // единый сдвиг центрирования блока «отступ + полоса» (№23, №7).
  out.push({
    kind: 'clef',
    lineId,
    systemIndex: system.index,
    xPx: leftOffsetPx,
    yPx: topPx,
    widthPx: leftMarginPx,
    heightPx: bottomStringYPx,
  });

  // Линии струн (№2): y из layout — stringYChars выводится из tuning модели.
  tabLayout.stringYChars.forEach((yChars, stringIndex) => {
    out.push({
      kind: 'stringLine',
      lineId,
      systemIndex: system.index,
      stringIndex,
      xPx: leftOffsetPx + leftMarginPx,
      yPx: topPx + yChars * advancePx,
      widthPx: system.widthChars * advancePx,
    });
  });

  // Колонки системы слева направо (№20): черта или цифры нот (№18, №3).
  for (const column of system.columns) {
    const modelColumn = columnsById.get(column.columnId);
    if (modelColumn === undefined) {
      throw new Error(`emitSystemPrimitives: в модели нет колонки ${column.columnId}`);
    }
    // Центр ячейки — точка пересечения струны и колонки (№20); черта ставится
    // по центру своей колонки (№18). x сдвинут центрированием блока (№23).
    const centerX =
      leftOffsetPx + leftMarginPx + (column.xChars + column.widthChars / 2) * advancePx;
    if (modelColumn.kind === 'barline') {
      out.push({
        kind: 'barline',
        lineId,
        columnId: column.columnId,
        systemIndex: system.index,
        xPx: centerX,
        yTopPx: topPx,
        yBottomPx: topPx + bottomStringYPx,
      });
      continue;
    }
    for (const note of modelColumn.notes) {
      const yChars = tabLayout.stringYChars[note.stringIndex];
      if (yChars === undefined) {
        throw new Error(
          `emitSystemPrimitives: у таб-строки ${lineId} нет строки струн ${note.stringIndex}`,
        );
      }
      out.push({
        kind: 'fretDigit',
        lineId,
        columnId: column.columnId,
        noteId: note.id,
        systemIndex: system.index,
        stringIndex: note.stringIndex,
        fret: note.fret,
        xPx: centerX,
        yPx: topPx + yChars * advancePx,
      });
    }
  }

  // Тексты колонок (№24): x — x колонки-владельца из layout, y — строка стопки.
  for (const text of system.texts) {
    const value = textsById.get(text.textId);
    if (value === undefined) {
      throw new Error(`emitSystemPrimitives: в модели нет текста колонки ${text.textId}`);
    }
    out.push({
      kind: 'columnText',
      lineId,
      columnId: text.columnId,
      textId: text.textId,
      text: value,
      xPx: leftOffsetPx + leftMarginPx + text.xChars * advancePx,
      yPx: topPx + text.yChars * advancePx,
    });
  }

  // Зоны тапа (№5, №35): по зоне заголовка на каждую колонку — полоса в один
  // символ над первой струной системы (заголовок, №35) — и по ячейке на каждое
  // пересечение струна×колонка. Координаты — тот же перевод символов движка
  // в px (№14): x колонок — из layout, y струн — из stringYChars. Зоны не
  // перекрываются и замащивают полосу системы колонки: заголовок [верх−advance,
  // первая струна], ячейки — от середины зазора до соседней струны (у верхней
  // струны рамка стянута к верху системы — выше неё зона заголовка, №35).
  // Порядок детерминирован: колонки слева направо, у колонки — заголовок,
  // затем ячейки по струнам сверху вниз.
  const stripLeftPx = leftOffsetPx + leftMarginPx;
  const firstStringYPx = topPx + (tabLayout.stringYChars[0] ?? 0) * advancePx;
  for (const column of system.columns) {
    const columnLeftPx = stripLeftPx + column.xChars * advancePx;
    const columnWidthPx = column.widthChars * advancePx;
    hitZones.push({
      rect: {
        xPx: columnLeftPx,
        yPx: firstStringYPx - advancePx,
        widthPx: columnWidthPx,
        heightPx: advancePx,
      },
      target: { kind: 'column', lineId, columnId: column.columnId },
    });
    tabLayout.stringYChars.forEach((yChars, stringIndex) => {
      const stringYPx = topPx + yChars * advancePx;
      const topYPx = Math.max(topPx, stringYPx - advancePx);
      const bottomYPx = stringYPx + advancePx;
      hitZones.push({
        rect: {
          xPx: columnLeftPx,
          yPx: topYPx,
          widthPx: columnWidthPx,
          heightPx: bottomYPx - topYPx,
        },
        target: { kind: 'cell', lineId, columnId: column.columnId, stringIndex },
      });
    });
  }

  // Подсветка выделения (№40): в системе, где лежит выбранная колонка (колонка
  // не рвётся между системами — перенос по тактам, №18). Ячейка — рамка
  // пересечения струна×колонка (по y — границы зоны ячейки, №5), колонка —
  // полоса по границам колонки от зоны заголовка до низа полосы системы (№35).
  // Примитивы выделения идут ПОСЛЕ контентных — рендерер рисует поверх (№40).
  if (selection !== undefined && selection.lineId === lineId) {
    for (const column of system.columns) {
      if (column.columnId !== selection.columnId) {
        continue;
      }
      const columnLeftPx = stripLeftPx + column.xChars * advancePx;
      const columnWidthPx = column.widthChars * advancePx;
      if (selection.kind === 'column') {
        out.push({
          kind: 'selectionColumnBand',
          lineId,
          columnId: column.columnId,
          systemIndex: system.index,
          xPx: columnLeftPx,
          yTopPx: firstStringYPx - advancePx,
          widthPx: columnWidthPx,
          // Низ полосы системы — с текстовой стопкой (см. systemStripBottomChars):
          // та же точка замыкания, что в высоте полосы (№24, №32).
          yBottomPx:
            topPx +
            (systemStripBottomChars(system, bottomStringYChars) + TEXT_ROW_SPACING_CHARS) *
              advancePx,
        });
        continue;
      }
      const yChars = tabLayout.stringYChars[selection.stringIndex];
      if (yChars === undefined) {
        throw new Error(
          `emitSystemPrimitives: у таб-строки ${lineId} нет строки струн ${selection.stringIndex}`,
        );
      }
      const stringYPx = topPx + yChars * advancePx;
      const topYPx = Math.max(topPx, stringYPx - advancePx);
      const bottomYPx = stringYPx + advancePx;
      out.push({
        kind: 'selectionCellFrame',
        lineId,
        columnId: column.columnId,
        stringIndex: selection.stringIndex,
        systemIndex: system.index,
        xPx: columnLeftPx,
        yPx: topYPx,
        widthPx: columnWidthPx,
        heightPx: bottomYPx - topYPx,
      });
    }
  }
}

/** Индекс строки ленты, обрезанный по границам ленты (окно №28 не выходит наружу). */
function clampRowIndex(value: number, rowCount: number): number {
  const upper = Math.max(rowCount - 1, 0);
  return Math.min(Math.max(value, 0), upper);
}

/**
 * План отрисовки тетради (№14, №23): лента строк топ-даун — строки ленты модели
 * в порядке следования (№6), системы таб-строки одна под другой (№18), текст-строки —
 * стопкой своих строк переноса. Каждая строка раскладывается независимо от остальных
 * (№28): офсеты строк — накопительная сумма высот. Детерминированная функция:
 * повторный вызов на тех же входах даёт идентичный план (№14).
 *
 * Высота строки ленты, в px:
 * - таб-строка — сумма высот полос своих систем; полоса системы — нижняя струна
 *   плюс стопка её текстов (№24) плюс один символ зазора (TEXT_ROW_SPACING_CHARS, №32);
 * - текст-строка — число строк переноса · theme.fonts.textLine.lineHeight
 *   плюс вертикальный отступ сверху и снизу (theme.textLinePaddingPx, №32).
 *
 * Поля страницы (№7): документ начинается с theme.documentTopPaddingPx
 * (входит в heightPx один раз), таб-системы едут единым блоком, центрированным
 * в widthPx (№23), строки переноса текст-строк — по центру своих ширин.
 *
 * @param notebook модель тетради — источник kind колонок, нот и текстов (№19, №23)
 * @param layout результат прохода движка по этой же модели (layoutNotebook, №14);
 *   расхождение множеств строк ленты — таб-строк и текст-строк — модели и layout
 *   в любую сторону — контракт-дефект: один throw до построения плана с
 *   перечнем расхождений
 * @param options тема, advancePx, ширина документа, measurer и окно (№28)
 * @returns план с px-примитивами и полной высотой документа
 */
export function buildNotebookDrawPlan(
  notebook: Notebook,
  layout: NotebookLayout,
  options: DrawPlanOptions,
): NotebookDrawPlan {
  const { theme, advancePx, widthPx, measurer } = options;
  const leftMarginPx = theme.clefMarginChars * advancePx;
  const textRowHeightPx = theme.fonts.textLine.lineHeight;
  const textLinePaddingPx = theme.textLinePaddingPx;
  const documentTopPaddingPx = theme.documentTopPaddingPx;

  // Центрирование контента по горизонтальной оси документа (№23: остаток
  // полосы — поля рендерера): блок «отступ под ключ + полоса системы» берётся
  // из ПЕРВОЙ таб-системы layout (полоса у всех систем одна — widthChars
  // фиксируется в MEASURE, №20; системы одной строки делят её). max(0, …):
  // при ширине документа уже блока документ остаётся у левого края.
  let tabStripChars: number | undefined;
  for (const entry of layout.ribbon) {
    if (entry.kind === 'tab') {
      const first = entry.systems[0];
      if (first !== undefined) {
        tabStripChars = first.widthChars;
        break;
      }
    }
  }
  const leftOffsetPx =
    tabStripChars === undefined
      ? 0
      : Math.max(0, (widthPx - (leftMarginPx + tabStripChars * advancePx)) / 2);

  // Модель — источник истины о kind колонок, нотах и текстах (№19, №23):
  // layout-словарь координат их не дублирует.
  const tabLineById = new Map<EntityId, TabLine>();
  for (const line of notebook.lines) {
    if (line.kind === 'tab') {
      tabLineById.set(line.id, line);
    }
  }

  // Контракт «layout построен по этой модели» (№19, №23) сверяется в ОБЕ
  // стороны до цикла — по ВСЕМ видам строк ленты: таб-строкам И текст-строкам.
  // Без сверки поведение асимметрично: строка layout без модели — таб-строка
  // падает throw'ом в цикле, а текст-строка молча отрисовалась бы устаревшей;
  // строка модели без layout молча выпадает из плана (цикл идёт по
  // layout.ribbon) — тихая порча вывода. Одно invariant-сообщение называет
  // обе стороны расхождения; сверка дешёвая — два прохода по множествам id,
  // без роста сложности цикла.
  const modelLineIds = new Set<EntityId>();
  for (const line of notebook.lines) {
    modelLineIds.add(line.id);
  }
  const layoutLineIds = new Set<EntityId>();
  for (const entry of layout.ribbon) {
    layoutLineIds.add(entry.lineId);
  }
  const modelOnlyIds: EntityId[] = [];
  const layoutOnlyIds: EntityId[] = [];
  for (const id of modelLineIds) {
    if (!layoutLineIds.has(id)) {
      modelOnlyIds.push(id);
    }
  }
  for (const id of layoutLineIds) {
    if (!modelLineIds.has(id)) {
      layoutOnlyIds.push(id);
    }
  }
  if (modelOnlyIds.length > 0 || layoutOnlyIds.length > 0) {
    throw new Error(
      `buildNotebookDrawPlan: layout не соответствует модели — ` +
        `в модели нет в layout: [${modelOnlyIds.join(', ')}]; ` +
        `в layout нет в модели: [${layoutOnlyIds.join(', ')}]`,
    );
  }

  const rowPrimitives: DrawPrimitive[][] = [];
  const rowHitZones: HitZone[][] = [];
  const rowHeights: number[] = [];
  // Поля «тетради» (№7): лента начинается с верхнего отступа документа (№32,
  // theme.documentTopPaddingPx) — зазор между статус-баром/краем и первой строкой.
  let yCursorPx = documentTopPaddingPx;

  for (const entry of layout.ribbon) {
    const rowTopPx = yCursorPx;
    const prims: DrawPrimitive[] = [];
    const zones: HitZone[] = [];
    let heightPx: number;

    if (entry.kind === 'tab') {
      const modelLine = tabLineById.get(entry.lineId);
      if (modelLine === undefined) {
        throw new Error(`buildNotebookDrawPlan: в модели нет таб-строки ${entry.lineId}`);
      }
      const columnsById = new Map<EntityId, Column>(
        modelLine.columns.map((column) => [column.id, column]),
      );
      const textsById = new Map<EntityId, string>(
        modelLine.texts.map((text) => [text.id, text.text]),
      );
      const stringYChars = entry.stringYChars;
      const lastStringIndex = stringYChars.length - 1;
      if (lastStringIndex < 0) {
        throw new Error(`buildNotebookDrawPlan: таб-строка ${entry.lineId} без строк струн`);
      }
      const bottomStringYChars = stringYChars[lastStringIndex];

      // Системы одна под другой (№18): офсеты систем — накопительная сумма высот.
      heightPx = 0;
      const rowSelection =
        options.selection?.lineId === entry.lineId ? options.selection : undefined;
      for (const system of entry.systems) {
        emitSystemPrimitives({
          out: prims,
          hitZones: zones,
          tabLayout: entry,
          system,
          columnsById,
          textsById,
          topPx: rowTopPx + heightPx,
          leftMarginPx,
          leftOffsetPx,
          advancePx,
          bottomStringYChars,
          selection: rowSelection,
        });
        // Полоса системы в символах — до самого низкого текста стопки (№24),
        // а без текстов — до нижней струны; зазор строки текстов замыкает
        // полосу (TEXT_ROW_SPACING_CHARS, №32) — согласовано с emit.ts.
        heightPx +=
          (systemStripBottomChars(system, bottomStringYChars) + TEXT_ROW_SPACING_CHARS) * advancePx;
      }
    } else {
      // Текст-строка (№6): перенос пропорциональным шрифтом — единственная
      // геометрическая забота рендеринга (ADR-0004 п. 4, №32). Вертикальный
      // отступ (theme.textLinePaddingPx) опускает глифы от верха слота и
      // добавляется к высоте блока сверху и снизу: первая/последняя строка
      // переноса не прилипают к контенту соседних строк ленты. Каждая строка
      // переноса центрируется по своей измеренной ширине (№7, №23): строка
      // на всю полосу и перепуск (слово шире полосы, ADR-0004 п. 3) остаются
      // у левого края — max(0, …) страхует узкий документ.
      const rows = wrapTextLine(entry.text, widthPx, measurer);
      rows.forEach((rowText, rowIndex) => {
        const rowWidthPx = measurer.measureTextWidthPx(rowText);
        prims.push({
          kind: 'textRow',
          lineId: entry.lineId,
          rowIndex,
          text: rowText,
          xPx: Math.max(0, (widthPx - rowWidthPx) / 2),
          yPx: rowTopPx + textLinePaddingPx + rowIndex * textRowHeightPx,
        });
      });
      heightPx = rows.length * textRowHeightPx + 2 * textLinePaddingPx;
    }

    rowPrimitives.push(prims);
    rowHitZones.push(zones);
    rowHeights.push(heightPx);
    yCursorPx += heightPx;
  }

  // Окно (№28): срез строк ленты по абсолютным индексам; y-координаты и высота
  // документа остаются полными — окно режет примитивы, не геометрию (№28).
  // Зоны тапов режутся тем же окном: тап в строку за окном не выбирает цель —
  // она не отрисована (№28).
  const rowCount = rowPrimitives.length;
  const firstRow = clampRowIndex(options.window?.firstRow ?? 0, rowCount);
  const lastRow = clampRowIndex(options.window?.lastRow ?? rowCount - 1, rowCount);
  const primitives: DrawPrimitive[] = [];
  const hitZones: HitZone[] = [];
  if (rowCount > 0) {
    for (let index = firstRow; index <= lastRow; index += 1) {
      primitives.push(...rowPrimitives[index]);
      hitZones.push(...rowHitZones[index]);
    }
  }

  return {
    primitives,
    hitZones,
    widthPx,
    // Полная высота: верхний отступ документа (№7, №32) входит один раз —
    // лента начинается с него, дальше — накопительная сумма строк (№28).
    heightPx: documentTopPaddingPx + rowHeights.reduce((sum, height) => sum + height, 0),
  };
}
