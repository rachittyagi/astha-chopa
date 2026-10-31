import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { gameStore, useGame } from '@/store/app';
import { Button, Screen } from '@/ui/common';
import { colors } from '@/ui/theme';

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const saved = useGame((s) => s.saved);
  const problem = useGame((s) => s.saveProblem);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title} accessibilityRole="header">
          {APP_NAME}
        </Text>
      </View>
      {problem && (
        <Text style={styles.notice} onPress={() => gameStore.getState().dismissSaveProblem()}>
          {t(problem === 'oldVersion' ? 'home.saveOldVersion' : 'home.saveUnreadable')}
        </Text>
      )}
      <View style={styles.actions}>
        {saved && (
          <Button
            label={t('home.resume')}
            onPress={() => {
              if (gameStore.getState().resume()) router.push('/game');
            }}
          />
        )}
        <Button
          label={t('home.play')}
          onPress={() => router.push('/setup')}
          variant={saved ? 'secondary' : 'primary'}
        />
        <Button label={t('home.howToPlay')} onPress={() => router.push('/how-to-play')} variant="secondary" />
        <Button label={t('home.settings')} onPress={() => router.push('/settings')} variant="secondary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 40, fontWeight: '800', color: colors.accent },
  notice: { color: colors.danger, textAlign: 'center' },
  actions: { gap: 12, paddingBottom: 24 },
});
