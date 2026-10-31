import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { gameStore, useGame } from '@/store/app';
import { Button, Screen } from '@/ui/common';
import { useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  hero: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 },
  title: { fontSize: 40, fontWeight: '800' as const, color: c.accent, textAlign: 'center' as const },
  subtitle: { fontSize: 15, color: c.muted, textAlign: 'center' as const },
  notice: { color: c.danger, textAlign: 'center' as const },
  actions: { gap: 12, paddingBottom: 24, width: '100%' as const, maxWidth: 480, alignSelf: 'center' as const },
});

export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const saved = useGame((s) => s.saved);
  const problem = useGame((s) => s.saveProblem);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title} accessibilityRole="header">
          {APP_NAME}
        </Text>
        <Text style={styles.subtitle}>{t('home.tagline')}</Text>
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
