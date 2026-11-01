import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { gameStore, useGame } from '@/store/app';
import { Button, Screen, Title } from '@/ui/common';
import { SeatMark } from '@/ui/game/Controls';
import { useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  list: { flex: 1, gap: 12, paddingTop: 12 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  rank: { fontSize: 24, fontWeight: '800' as const, color: c.text, minWidth: 36 },
  name: { fontSize: 20, color: c.text },
  actions: { gap: 12, paddingBottom: 24 },
});

export function ResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  // A snapshot: "Play again" replaces the store's game while this screen is leaving.
  const [game] = useState(() => gameStore.getState().game);
  const setup = useGame((s) => s.setup);

  if (!game || game.phase !== 'finished') return <Redirect href="/" />;

  return (
    <Screen>
      <Title>{t('result.title')}</Title>
      <View style={styles.list}>
        {game.rankings.map((id, i) => {
          const seat = game.seats.find((s) => s.id === id)!;
          return (
            <View key={id} style={styles.row} accessible accessibilityLabel={t('result.a11y', { rank: i + 1, name: seat.name })}>
              <Text style={styles.rank}>{t('result.place', { rank: i + 1 })}</Text>
              <SeatMark seat={seat.id} color={seat.color} size={26} />
              <Text style={styles.name}>{seat.name}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button
          label={t('result.playAgain')}
          onPress={() => {
            if (setup) gameStore.getState().startGame(setup);
            router.replace('/game');
          }}
        />
        <Button
          label={t('result.changePlayers')}
          variant="secondary"
          onPress={() => router.replace({ pathname: '/setup', params: { then: 'play' } })}
        />
        <Button
          label={t('result.home')}
          variant="secondary"
          onPress={() => {
            gameStore.getState().quit();
            router.replace('/');
          }}
        />
      </View>
    </Screen>
  );
}
