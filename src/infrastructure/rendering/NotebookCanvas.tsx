// Экранный рендер тетради «как тетрадь» (этап 4 дорожной карты, КАРТА §3):
// ScrollView, внутри которого Skia-канва шириной с полосу отрисовки и высотой
// не меньше вьюпорта: сама картинка вмещает весь документ (plan.heightPx,
// №28), а канва дотягивается до низа окна, чтобы короткий документ не
// оставлял неокрашенный «хвост» под бумагой.
//
// Advance единицы геометрии (ADR-0004, №32) измеряется по метрикам моно-шрифта
// цифр лада из темы; целевая ширина движка — floor(widthPx / advance) в
// символах (№23). Поворот экрана меняет widthPx → layout и план строятся
// заново (№23), модель тетради не меняется.
//
// Интерактивность (№11, №40): GestureDetector от react-native-gesture-handler
// поверх канвы — тап через hit-тест плана (hit-test.ts) превращается в цель
// (ячейка/колонка/null, №5, №35) и уходит наверх через onTap; long-press
// отдаёт сырую точку (базис длинных жестов редактирования, №36). ScrollView
// остаётся: прокрутка не отнята, виртуализация — этап 6 (№28).
//
// Слой Infrastructure (rendering): импортирует Domain вниз (R1–R3);
// геометрии в компоненте нет — только перевод ширины экрана в символы движка
// и делегирование плану (plan.ts), hit-тесту (hit-test.ts) и Skia-переводчику
// (skia.ts).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PixelRatio, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Canvas, Picture } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { layoutNotebook } from '../../domain/layout-engine';
import type { Notebook } from '../../domain/tabulature/types';
import { hitTestPlan } from './hit-test';
import type { HitTestPoint, HitTestResult } from './hit-test';
import { buildNotebookDrawPlan, stripCapacityChars } from './plan';
import type { SelectionTarget } from './plan';
import {
  buildNotebookPicture,
  createSkiaTextLineMeasurer,
  getNotebookFonts,
  measureMonoAdvancePx,
} from './skia';
import { canvasTextureHeightWarning } from './texture-limit';
import { theme } from './theme';

export interface NotebookCanvasProps {
  /** Модель тетради (владелец данных, №23): фиксируется на весь сеанс. */
  readonly notebook: Notebook;
  /** Ширина полосы отрисовки в px (ширина экрана; поворот меняет её, №23). */
  readonly widthPx: number;
  /**
   * Выделение (№40): подсвечивается планом — рамка ячейки или полоса колонки
   * (№35). Не задано — подсветки нет.
   */
  readonly selection?: SelectionTarget;
  /**
   * Тап по канве (№5, №35): цель из hit-теста плана — ячейка, колонка или
   * null (тап мимо зон). Не задан — тапы не обрабатываются.
   */
  readonly onTap?: (hit: HitTestResult) => void;
  /**
   * Long-press по канве (№36; ревью ST-5, находка 18а): hit-тест плана до
   * доставки — зона (ячейка/колонка; базис жестов строк — этап 6) или null
   * (пустое место; №36/№27 — приложение открывает ввод текст-строки).
   * Выбор действия — забота приложения, не канвы.
   */
  readonly onLongPress?: (hit: HitTestResult | null) => void;
}

/**
 * Рендер тетради на Skia-канве (№23): детерминированная цепочка
 * модель → layout (движок) → план → Skia-картинка; повторный рендер тех же
 * входов даёт то же изображение (№14). Все изменения ширины проходят через
 * пересборку layout — в компоненте нет собственной арифметики переносов.
 */
export function NotebookCanvas({
  notebook,
  widthPx,
  selection,
  onTap,
  onLongPress,
}: NotebookCanvasProps) {
  const { height: windowHeightPx } = useWindowDimensions();
  // Высота вьюпорта скролла (ревью ST-5, находка 12а): высота окна —
  // приближение (тулбар съедает высоту и оставляет лишнюю «бумагу» в конце
  // прокрутки); реальный вьюпорт приходит из onLayout ScrollView.
  const [measuredHeightPx, setMeasuredHeightPx] = useState<number | null>(null);
  const handleScrollLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.floor(event.nativeEvent.layout.height);
    if (height > 0) {
      setMeasuredHeightPx(height);
    }
  }, []);
  // Шрифты и advance — общий экземпляр на процесс (тур-3 ревью ST-5, находка
  // 4а): экран мерит ёмкость по тому же шрифту, замер кешируется в skia.ts.
  const fonts = getNotebookFonts();
  const advancePx = measureMonoAdvancePx(fonts.fretDigits);
  const measurer = useMemo(() => createSkiaTextLineMeasurer(fonts.textLine), [fonts]);

  const plan = useMemo(() => {
    const layout = layoutNotebook(notebook, {
      widthChars: stripCapacityChars(widthPx, advancePx),
    });
    return buildNotebookDrawPlan(notebook, layout, {
      theme,
      advancePx,
      widthPx,
      measurer,
      selection,
    });
  }, [notebook, widthPx, advancePx, measurer, selection]);

  const picture = useMemo(() => buildNotebookPicture(plan, fonts), [plan, fonts]);

  // Жесты канвы (№11): hit-тест — чистая JS-функция над планом, из worklet-потока
  // жестов обычный объект недоступен, поэтому точка уезжает в JS через runOnJS,
  // и тап разрешается в цель на JS-потоке над актуальным планом (№5, №35).
  // Long-press отдаёт сырую точку без выбора цели (№36: выбор — забота
  // приложения). ScrollView остаётся распознавать прокрутку.
  const onTapPoint = useMemo(() => {
    if (onTap === undefined) {
      return undefined;
    }
    return (point: HitTestPoint) => onTap(hitTestPlan(plan, point));
  }, [onTap, plan]);
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onStart((event) => {
          'worklet';
          if (onTapPoint !== undefined) {
            runOnJS(onTapPoint)({ xPx: event.x, yPx: event.y });
          }
        }),
    [onTapPoint],
  );
  // Long-press (№36, находка 18а): как и тап, разрешается hit-тестом плана
  // на JS-потоке — приложение получает зону или null (пустое место), а не
  // сырую точку: выбор «ввод текст-строки или жест строки» требует знания
  // целей (№36/№27).
  const onLongPressPoint = useMemo(() => {
    if (onLongPress === undefined) {
      return undefined;
    }
    return (point: HitTestPoint) => onLongPress(hitTestPlan(plan, point));
  }, [onLongPress, plan]);
  const longPress = useMemo(
    () =>
      Gesture.LongPress()
        // 4 ревью ST-5: тап — до 250 мс, лонг-тап — от 300 мс. Дефолтная
        // minDuration (~500 мс) оставляла «мёртвую зону» 250–500 мс:
        // удержание такой длины не срабатывало ни как тап, ни как лонг-тап.
        // 6б ревью ST-5: остаточная зона 250–300 мс сознательная — press
        // короче 300 мс не должен открывать ввод текст-строки (случайный
        // удерж при прокрутке), а стык «в точку» 250 мс сделал бы жест
        // слишком чувствительным.
        .minDuration(300)
        .onStart((event) => {
          'worklet';
          if (onLongPressPoint !== undefined) {
            runOnJS(onLongPressPoint)({ xPx: event.x, yPx: event.y });
          }
        }),
    [onLongPressPoint],
  );
  const gestures = useMemo(() => Gesture.Exclusive(tap, longPress), [tap, longPress]);

  // Канва не ниже вьюпорта: сама картинка вмещает весь документ (№28), но при
  // коротком документе остаток экрана ниже документа остаётся за пределами
  // канвы — красим его бумагой, растягивая канву до вьюпорта скролла
  // (измеренного onLayout; до первого кадра — высота окна; фон канвы —
  // colors.background, см. skia.ts drawColor).
  const canvasHeight = Math.max(plan.heightPx, measuredHeightPx ?? windowHeightPx);

  // Guard лимита GPU-текстуры (ревью ST-5, находка 5): канва выше лимита
  // железа рисуется пустой при живой прокрутке — отказ незаметен. log — из
  // эффекта, а не из тела рендера: side-effect в рендере срабатывал бы на
  // каждом кадре и заспамил бы журнал. Виртуализация (DrawWindow, №28) — этап 6.
  // Сравнение — в физических пикселях (2-й тур ревью ST-5, находка 2а):
  // canvasHeight и весь план — логические px (dp), а GL_MAX_TEXTURE_SIZE —
  // физические; плотность применяется здесь, в месте вызова, — сама функция
  // guard'а остаётся чистой, без платформы (проверяется юнит-тестом).
  useEffect(() => {
    const warning = canvasTextureHeightWarning(canvasHeight * PixelRatio.get());
    if (warning !== null) {
      console.warn(warning);
    }
  }, [canvasHeight]);

  // Детектор крепится к канве, а не к ScrollView (ревью ST-5, находка 1а):
  // координаты жеста (event.x/y) локальны для view, к которой прикреплён
  // обработчик. Канва вмещает весь документ (plan.heightPx), поэтому её
  // локальные координаты совпадают с координатами документа — компенсация
  // прокрутки не нужна. Детектор на ScrollView отдавал бы вьюпорт-относительные
  // координаты: после скролла тап выбирал бы чужую ячейку.
  return (
    <ScrollView style={styles.scroll} onLayout={handleScrollLayout}>
      <GestureDetector gesture={gestures}>
        <Canvas style={{ width: widthPx, height: canvasHeight }}>
          <Picture picture={picture} />
        </Canvas>
      </GestureDetector>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
});
