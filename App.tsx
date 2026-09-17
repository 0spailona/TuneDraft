import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { t } from './src/i18n';

// Экран-заглушка: все видимые строки — из словаря (№31), без хардкода.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.name}>{t('app.name')}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
  },
});
