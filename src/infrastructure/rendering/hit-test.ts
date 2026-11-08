// Чистый hit-тест «тап → цель» (№5, №35): план уже содержит зоны тапа (hitZones
// plan.ts) в готовых px — здесь только поиск зоны, содержащей точку тапа.
// Никакой геометрии (№14): координаты приходят из плана, никакого фреймворка
// (R1/R3): чистая функция над планом, пригодная для экрана, превью и тестов.
//
// Слой Infrastructure (rendering): локальный словарь rendering поверх domain-id
// (№19); application-типов нет (R3: инфраструктура не импортирует вверх).

import type { HitZone, HitZoneTarget, NotebookDrawPlan, PxRect } from './plan';

/**
 * Результат hit-теста: цель, вычисленная ПЛАНОМ (не приложением) — ячейка или
 * колонка (№5, №35); вне зон (поля, зазор над документом, текст-строки, зазор
 * под полосой системы) — null (№5: тап всегда разрешается ровно в одну цель,
 * «вне» — отказ от выбора, не цель).
 */
export type HitTestResult = HitZoneTarget | null;

/**
 * Точка тапа в px документа (канвы, №14): локальные координаты канвы = координаты
 * документа, потому что канва вмещает весь документ (plan.heightPx, №28).
 */
export interface HitTestPoint {
  readonly xPx: number;
  readonly yPx: number;
}

/** Точка внутри прямоугольника зоны: левый край/верх включительно, правый/низ — нет. */
function contains(rect: PxRect, point: HitTestPoint): boolean {
  return (
    point.xPx >= rect.xPx &&
    point.xPx < rect.xPx + rect.widthPx &&
    point.yPx >= rect.yPx &&
    point.yPx < rect.yPx + rect.heightPx
  );
}

/**
 * Hit-тест точки документа (№5, №35): тап в зону ячейки → ячейка (lineId/
 * columnId/stringIndex); тап в зону заголовка колонки (полоса колонки выше
 * первой струны, №35) → колонка; тап вне зон (поля документа, зазор под
 * полосой системы, текст-строки, зазор над документом) → null.
 *
 * Порядок проверки детерминирован: зоны плана идут в порядке построения
 * (системы и колонки слева направо, у колонки — заголовок, затем ячейки по
 * струнам); проверка — первый содержащий прямоугольник (№14: повторный вызов
 * на тех же входах даёт идентичный результат).
 *
 * Зоны не перекрываются (заголовок [верх−advance, первая струна), ячейки —
 * от середины зазора к соседней струне), поэтому «первая содержащая зона»
 * однозначна.
 *
 * @param plan план отрисовки (источник зон, №14)
 * @param point точка тапа в px документа
 * @returns цель выделения или null — см. HitTestResult
 */
export function hitTestPlan(plan: NotebookDrawPlan, point: HitTestPoint): HitTestResult {
  for (const zone of plan.hitZones) {
    if (contains(zone.rect, point)) {
      return zone.target;
    }
  }
  return null;
}

/**
 * Зоны плана, содержащие точку (для тестов и отладки): все, а не только первая —
 * перекрытие зон было бы дефектом геометрии плана, тесты пинят его отсутствие.
 */
export function hitTestPlanAll(plan: NotebookDrawPlan, point: HitTestPoint): readonly HitZone[] {
  return plan.hitZones.filter((zone) => contains(zone.rect, point));
}
