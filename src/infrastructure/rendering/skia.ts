// Skia-рендер плана отрисовки (этап 4 дорожной карты, КАРТА §3): переводит
// декларативные примитивы плана (plan.ts) в вызовы Skia — императивную запись
// в SkPicture через PictureRecorder (Canvas 2.x декларативен, <Picture> — мост).
// Никакой собственной геометрии (№14): все координаты приходят из плана в px;
// здесь только кисти (цвета/толщины из темы, №32), глифы и текст.
//
// Ключ 𝄢 (№36) — встроенный Skia-путь: в системных шрифтах Android U+1D122
// нет, поэтому глиф строится упрощённым контуром (головка-точка, основной
// штрих-«запятая», две точки F) внутри прямоугольника отступа из плана.
//
// Слой Infrastructure (rendering): импортирует Domain вниз (R1–R3), entry-файлы
// не трогает (R4). Единственный внешний пакет — @shopify/react-native-skia;
// шрифты — системные по семействам темы (№32), без загрузки файлов.
import { PaintStyle, Skia, StrokeCap, matchFont } from '@shopify/react-native-skia';
import type {
  SkCanvas,
  SkFont,
  SkPaint,
  SkPath,
  SkPicture,
  SkRect,
} from '@shopify/react-native-skia';

import type {
  ClefPrimitive,
  NotebookDrawPlan,
  SelectionCellFramePrimitive,
  SelectionColumnBandPrimitive,
  TextLineMeasurer,
} from './plan';
import { theme } from './theme';

/** Шрифты рендера тетради: по семействам и кеглям темы (№32). */
export interface NotebookFonts {
  /** Цифры лада: моноширинный, база единицы геометрии (№32, ADR-0004). */
  readonly fretDigits: SkFont;
  /** Тексты колонок: то же моно-семейство меньшим кеглем (№24, №32). */
  readonly columnText: SkFont;
  /** Текст-строки: пропорциональное семейство (№6, №32). */
  readonly textLine: SkFont;
}

/**
 * Шрифты из темы (№32): matchFont по платформенному менеджеру шрифтов
 * подбирает системный typeface семейства. SkFont дорог — потребители берут
 * общий экземпляр через getNotebookFonts (ниже), а не зовут фабрику сами.
 */
export function createNotebookFonts(): NotebookFonts {
  return {
    fretDigits: matchFont({
      fontFamily: theme.fonts.fretDigits.fontFamily,
      fontSize: theme.fonts.fretDigits.fontSize,
    }),
    columnText: matchFont({
      fontFamily: theme.fonts.columnText.fontFamily,
      fontSize: theme.fonts.columnText.fontSize,
    }),
    textLine: matchFont({
      fontFamily: theme.fonts.textLine.fontFamily,
      fontSize: theme.fonts.textLine.fontSize,
    }),
  };
}

/**
 * Общие шрифты рендера — один экземпляр на процесс (тур-3 ревью ST-5,
 * находка 4а): matchFont дорог, и канва (NotebookCanvas) с экраном
 * (EditorScreen) должны мерить advance по одному и тому же шрифту —
 * два независимых замера разъели бы согласованность «ёмкость новой строки
 * ↔ полоса канвы». Ленивая инициализация: matchFont не вызывается до
 * готовности нативного модуля Skia (первый рендер).
 */
let sharedFonts: NotebookFonts | null = null;

export function getNotebookFonts(): NotebookFonts {
  if (sharedFonts === null) {
    sharedFonts = createNotebookFonts();
  }
  return sharedFonts;
}

/** Замер advance кешируется по экземпляру шрифта (4а): метрики константны. */
const advanceByFont = new WeakMap<SkFont, number>();

/**
 * Advance моноширинного шрифта цифр лада в px (№32, ADR-0004): единица
 * геометрии движка, измеряется по метрике глифа «0». Fallback — ширина
 * прямоугольника measureText, если glyph-метрика недоступна. Не положительный
 * результат обоих измерений — дефект платформенного шрифта: единица геометрии
 * не определена, и вся арифметика плана (деление ширины на advance в
 * stripCapacityChars, умножения координат) разъезжается — отказ громко,
 * до построения layout и плана, а не молча искажённой геометрией.
 */
export function measureMonoAdvancePx(font: SkFont): number {
  const cached = advanceByFont.get(font);
  if (cached !== undefined) {
    return cached;
  }
  const advance = font.getGlyphWidths(font.getGlyphIDs('0'))[0];
  let measured = advance;
  if (!(measured > 0)) {
    measured = font.measureText('0').width;
  }
  if (!(measured > 0)) {
    throw new Error(
      `measureMonoAdvancePx: шрифт цифр лада не дал положительный advance ` +
        `(glyph=${advance}, measureText=${measured}) — единица геометрии (№32, ADR-0004) не определена`,
    );
  }
  advanceByFont.set(font, measured);
  return measured;
}

/**
 * Измеритель пропорционального шрифта текст-строк (№6, ADR-0004 п. 4):
 * инъекция в buildNotebookDrawPlan — план считает перенос, платформа меряет.
 */
export function createSkiaTextLineMeasurer(font: SkFont): TextLineMeasurer {
  return {
    measureTextWidthPx: (text: string) => font.measureText(text).width,
  };
}

/** Кисть заливки (№32: цвет из темы, сглаживание включено). */
function fillPaint(color: string): SkPaint {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAntiAlias(true);
  return paint;
}

/** Кисть обводки (толщины из theme.lineThickness, №32). */
function strokePaint(color: string, width: number): SkPaint {
  const paint = fillPaint(color);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  paint.setStrokeCap(StrokeCap.Round);
  return paint;
}

/**
 * Толщина штриха ключа (№36): доля ширины отступа ключа из плана — px приходит
 * из плана (clef.widthPx), своей геометрии здесь нет (№14).
 */
function clefStrokeWidthPx(clef: ClefPrimitive): number {
  return 0.09 * clef.widthPx;
}

/**
 * Кисть подсветки выделения (№40): акцент темы, полупрозрачная заливка —
 * контент под выделением остаётся читаемым.
 */
function selectionFillPaint(): SkPaint {
  const paint = fillPaint(theme.colors.selection);
  paint.setAlphaf(theme.selectionFillAlpha);
  return paint;
}

/** Обводка рамки выделенной ячейки (№40): акцент темы, толщина из темы. */
function selectionStrokePaint(): SkPaint {
  return strokePaint(theme.colors.selection, theme.lineThickness.selection);
}

/** Прямоугольник px-полосы из плана (Skia-перевод, без своей геометрии, №14). */
function selectionRect(xPx: number, yPx: number, widthPx: number, heightPx: number): SkRect {
  return Skia.XYWHRect(xPx, yPx, widthPx, heightPx);
}

/** Полоса выделенной колонки (№40, №35): полупрозрачная заливка по границам колонки. */
function drawSelectionColumnBand(
  canvas: SkCanvas,
  band: SelectionColumnBandPrimitive,
  fill: SkPaint,
): void {
  const rect = selectionRect(band.xPx, band.yTopPx, band.widthPx, band.yBottomPx - band.yTopPx);
  canvas.drawRect(rect, fill);
}

/** Рамка выделенной ячейки (№40): заливка плюс обводка по границам ячейки. */
function drawSelectionCellFrame(
  canvas: SkCanvas,
  frame: SelectionCellFramePrimitive,
  fill: SkPaint,
  stroke: SkPaint,
): void {
  const rect = selectionRect(frame.xPx, frame.yPx, frame.widthPx, frame.heightPx);
  canvas.drawRect(rect, fill);
  canvas.drawRect(rect, stroke);
}

/**
 * Основной штрих ключа 𝄢 (№36): «запятая» от головки у верхней струны,
 * через правый край отступа вниз к хвосту у нижней струны. Координаты —
 * нормированные доли прямоугольника отступа из плана, без своей геометрии.
 */
function bassClefStrokePath(clef: ClefPrimitive): SkPath {
  const x = (nx: number) => clef.xPx + nx * clef.widthPx;
  const y = (ny: number) => clef.yPx + ny * clef.heightPx;
  const path = Skia.Path.Make();
  path.moveTo(x(0.16), y(0.16));
  path.cubicTo(x(0.55), y(0.0), x(0.95), y(0.24), x(0.72), y(0.5));
  path.cubicTo(x(0.55), y(0.7), x(0.36), y(0.78), x(0.12), y(0.92));
  return path;
}

/**
 * Точки ключа 𝄢: головка вверху слева и две точки F справа от хвоста
 * (между соседними линиями струн, как у F-ключа).
 */
function bassClefDotsPath(clef: ClefPrimitive): SkPath {
  const x = (nx: number) => clef.xPx + nx * clef.widthPx;
  const y = (ny: number) => clef.yPx + ny * clef.heightPx;
  const path = Skia.Path.Make();
  path.addCircle(x(0.22), y(0.16), clef.widthPx * 0.12);
  path.addCircle(x(0.82), y(0.68), clef.widthPx * 0.07);
  path.addCircle(x(0.82), y(0.86), clef.widthPx * 0.07);
  return path;
}

/**
 * Запись плана в SkPicture (№23): фон бумаги, затем каждый примитив — своим
 * способом. Диспетч по kind, координаты — готовые px из плана; единственная
 * привязка текста к базовой линии — вертикальное центрирование по метрикам
 * шрифта (асcent/descent), не геометрия колонок и не перенос (№14).
 */
export function buildNotebookPicture(plan: NotebookDrawPlan, fonts: NotebookFonts): SkPicture {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording();
  canvas.drawColor(Skia.Color(theme.colors.background));

  // Метрики шрифтов константны на шрифте — снимаются один раз на картину, а не
  // на каждый примитив; кисти — общие на картину (толщина ключа выставляется
  // на общую кисть по примитиву); ширины цифр кешируются: ладов ≤ 25 («0»…«24»),
  // строка цифры повторяется на каждой ноте — measureText зовётся не на примитив.
  const digitMetrics = fonts.fretDigits.getMetrics();
  const digitBaselinePx = -(digitMetrics.ascent + digitMetrics.descent) / 2;
  const columnTextAscentPx = fonts.columnText.getMetrics().ascent;
  const textLineAscentPx = fonts.textLine.getMetrics().ascent;
  const digitWidthCache = new Map<string, number>();

  const stringPaint = strokePaint(theme.colors.ink, theme.lineThickness.string);
  const barlinePaint = strokePaint(theme.colors.barline, theme.lineThickness.barline);
  const digitPaint = fillPaint(theme.colors.ink);
  const columnTextPaint = fillPaint(theme.colors.ink);
  const textRowPaint = fillPaint(theme.colors.ink);
  const clefFillPaint = fillPaint(theme.colors.ink);
  const clefStrokePaint = strokePaint(theme.colors.ink, 0);
  const selectionFillPaintShared = selectionFillPaint();
  const selectionStrokePaintShared = selectionStrokePaint();

  for (const primitive of plan.primitives) {
    switch (primitive.kind) {
      case 'stringLine':
        canvas.drawLine(
          primitive.xPx,
          primitive.yPx,
          primitive.xPx + primitive.widthPx,
          primitive.yPx,
          stringPaint,
        );
        break;
      case 'fretDigit': {
        const text = String(primitive.fret);
        let digitWidthPx = digitWidthCache.get(text);
        if (digitWidthPx === undefined) {
          digitWidthPx = fonts.fretDigits.measureText(text).width;
          digitWidthCache.set(text, digitWidthPx);
        }
        canvas.drawText(
          text,
          primitive.xPx - digitWidthPx / 2,
          primitive.yPx + digitBaselinePx,
          digitPaint,
          fonts.fretDigits,
        );
        break;
      }
      case 'barline':
        canvas.drawLine(
          primitive.xPx,
          primitive.yTopPx,
          primitive.xPx,
          primitive.yBottomPx,
          barlinePaint,
        );
        break;
      case 'columnText':
        canvas.drawText(
          primitive.text,
          primitive.xPx,
          primitive.yPx - columnTextAscentPx,
          columnTextPaint,
          fonts.columnText,
        );
        break;
      case 'clef': {
        // Толщина штриха ключа — доля его отступа из плана (px от плана,
        // без своей геометрии); кисти общие, ширина выставляется на примитив;
        // точки F — заливкой.
        clefStrokePaint.setStrokeWidth(clefStrokeWidthPx(primitive));
        canvas.drawPath(bassClefStrokePath(primitive), clefStrokePaint);
        canvas.drawPath(bassClefDotsPath(primitive), clefFillPaint);
        break;
      }
      case 'textRow':
        canvas.drawText(
          primitive.text,
          primitive.xPx,
          primitive.yPx - textLineAscentPx,
          textRowPaint,
          fonts.textLine,
        );
        break;
      case 'selectionColumnBand':
        // Выделение поверх контента (№40): рисуется последним — примитивы
        // выделения план кладёт в конец списка.
        drawSelectionColumnBand(canvas, primitive, selectionFillPaintShared);
        break;
      case 'selectionCellFrame':
        drawSelectionCellFrame(
          canvas,
          primitive,
          selectionFillPaintShared,
          selectionStrokePaintShared,
        );
        break;
      default: {
        // Исчерпывающий диспетч (2-й тур ревью ST-5, находка 10): примитив,
        // добавленный в план этапом 6/8 без обработчика здесь, уронит сборку
        // на never-присваивании — вместо тихо не отрисованного примитива.
        const exhaustiveCheck: never = primitive;
        throw new Error(
          `buildNotebookPicture: неизвестный примитив плана: ${JSON.stringify(exhaustiveCheck)}`,
        );
      }
    }
  }
  return recorder.finishRecordingAsPicture();
}
