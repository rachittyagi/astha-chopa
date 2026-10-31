import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { gameStore, useGame, useSettings } from '@/store/app';
import { Button, Screen } from '@/ui/common';
import { SeatMark } from '@/ui/game/Controls';
import { firstSetup } from '@/ui/setup/presets';
import { useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  hero: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10 },
  title: { fontSize: 44, fontWeight: '800' as const, color: c.accent, textAlign: 'center' as const },
  subtitle: { fontSize: 18, color: c.muted, textAlign: 'center' as const },
  notice: { color: c.danger, textAlign: 'center' as const, fontSize: 16 },
  players: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const, gap: 14 },
  player: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  playerName: { fontSize: 18, color: c.text },
  actions: { gap: 14, paddingBottom: 24, width: '100%' as const, maxWidth: 480, alignSelf: 'center' as const },
  links: { flexDirection: 'row' as const, gap: 12 },
  link: { flex: 1 },
});

/** Home: one big button. Play starts straight away with the players and rules used last time. */
export function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const saved = useGame((s) => s.saved);
  const lastSetup = useGame((s) => s.lastSetup);
  const problem = useGame((s) => s.saveProblem);
  const innerRing = useSettings((s) => s.innerRing);
  const setup = lastSetup ?? firstSetup(innerRing);

  const play = () => {
    gameStore.getState().startGame(setup);
    router.push('/game');
  };
  const newGame = () =>
    Alert.alert(t('setup.replaceTitle'), t('setup.replaceBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('setup.replace'), style: 'destructive', onPress: play },
    ]);

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
        <View style={styles.players} accessible accessibilityLabel={t('home.whoPlays')}>
          {setup.seats.map((seat, i) =>
            seat.kind === 'empty' ? null : (
              <View key={i} style={styles.player}>
                <SeatMark seat={(['A', 'B', 'C', 'D'] as const)[i]!} color={seat.color} size={22} />
                <Text style={styles.playerName}>
                  {seat.kind === 'bot' ? t('home.computer', { name: seat.name }) : seat.name}
                </Text>
              </View>
            ),
          )}
        </View>
        {saved ? (
          <>
            <Button
              label={t('home.continue')}
              size="large"
              onPress={() => {
                if (gameStore.getState().resume()) router.push('/game');
              }}
            />
            <Button label={t('home.newGame')} variant="secondary" onPress={newGame} />
          </>
        ) : (
          <Button label={t('home.play')} size="large" onPress={play} />
        )}
        <Button label={t('home.playersAndRules')} variant="secondary" onPress={() => router.push('/setup')} />
        <View style={styles.links}>
          <View style={styles.link}>
            <Button label={t('home.howToPlay')} onPress={() => router.push('/how-to-play')} variant="secondary" />
          </View>
          <View style={styles.link}>
            <Button label={t('home.settings')} onPress={() => router.push('/settings')} variant="secondary" />
          </View>
        </View>
      </View>
    </Screen>
  );
}
