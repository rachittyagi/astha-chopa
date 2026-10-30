import { StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';

// Placeholder Home until M3 (TASK-43).
export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '600' },
});
