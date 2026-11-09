// Тесты guard-а лимита высоты GPU-текстуры (ревью ST-5, находка 5): чистая
// функция canvasTextureHeightWarning предупреждает только при высоте канвы
// выше порога (граница включительно — корректна), называет в сообщении и
// фактическую высоту, и лимит, и тотальна по вырожденным входам (NaN,
// отрицательные — null: сравнение «>» ложно для NaN).

import { MAX_CANVAS_TEXTURE_HEIGHT_PX, canvasTextureHeightWarning } from '../texture-limit';

describe('(a) предупреждение только выше лимита (ревью ST-5, находка 5)', () => {
  it('короткий документ и высота ровно на границе — null', () => {
    expect(canvasTextureHeightWarning(1000)).toBeNull();
    expect(canvasTextureHeightWarning(MAX_CANVAS_TEXTURE_HEIGHT_PX)).toBeNull();
  });

  it('на 1 px выше лимита — предупреждение с фактической высотой и лимитом', () => {
    const aboveLimit = MAX_CANVAS_TEXTURE_HEIGHT_PX + 1;
    const warning = canvasTextureHeightWarning(aboveLimit);
    expect(warning).not.toBeNull();
    expect(warning).toContain(String(aboveLimit));
    expect(warning).toContain(String(MAX_CANVAS_TEXTURE_HEIGHT_PX));
  });

  it('длинный документ (~12000 px, десятки строк ленты) — предупреждение', () => {
    expect(canvasTextureHeightWarning(12000)).not.toBeNull();
  });
});

describe('(b) тотальность: вырожденные входы не предупреждают', () => {
  it('NaN и отрицательная высота — null', () => {
    expect(canvasTextureHeightWarning(Number.NaN)).toBeNull();
    expect(canvasTextureHeightWarning(-5000)).toBeNull();
    expect(canvasTextureHeightWarning(0)).toBeNull();
  });
});
