// Entry-точка (R4): только wiring. Демо-тетрадь «как тетрадь» (этап 4):
// фикстура модели → NotebookCanvas, который на каждой ширине экрана сам
// пересобирает layout и план. Поворот экрана (useWindowDimensions) меняет
// ширину — layout перестраивается под неё (№23), модель не меняется.
// Видимых строк в компоненте нет (№31): весь контент — из модели тетради.
import { StatusBar } from 'expo-status-bar';
import { useWindowDimensions } from 'react-native';

import { demoNotebookFixture } from './src/domain/tabulature/fixtures';
import { NotebookCanvas } from './src/infrastructure/rendering/NotebookCanvas';

const demoNotebook = demoNotebookFixture();

export default function App() {
  const { width } = useWindowDimensions();
  return (
    <>
      <NotebookCanvas notebook={demoNotebook} widthPx={width} />
      <StatusBar style="dark" />
    </>
  );
}
