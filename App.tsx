// Entry-точка (R4): только wiring. Демо-тетрадь «как тетрадь» (этап 4) на
// экране редактора (этап 5): фикстура модели → EditorScreen, который держит
// состояние через контроллер editing (этап 5) и рендерит через
// NotebookCanvas. Поворот экрана (useWindowDimensions) меняет ширину —
// layout перестраивается под неё (№23), модель не меняется.
// Демо-тетрадь открывается в правке (№40: новая тетрадь — сразу правка).
// Видимых строк в App нет (№31) — весь контент из модели и словаря.
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useWindowDimensions } from 'react-native';

import { EditorScreen } from './components/editor/EditorScreen';
import { demoNotebookFixture } from './src/domain/tabulature/fixtures';
import { createIdGenerator } from './src/domain/tabulature/ids';

// Один генератор id на тетрадь (R6, №19): общий для фикстуры и экрана —
// нумерация сквозная, вставки из правки продолжают её после фикстуры
// (раньше у экрана был свой счётчик с нуля, и tx-2 коллидил с id фикстуры).
const idGen = createIdGenerator();
const demoNotebook = demoNotebookFixture(idGen);

export default function App() {
  const { width } = useWindowDimensions();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <EditorScreen notebook={demoNotebook} initialMode="edit" widthPx={width} idGen={idGen} />
      <StatusBar style="dark" />
    </GestureHandlerRootView>
  );
}
