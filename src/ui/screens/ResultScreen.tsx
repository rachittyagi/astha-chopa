import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { gameStore, useGame } from '@/store/app';
import { Button, Screen, Title } from '@/ui/common';
import { colors, PAWN_COLORS } from '@/ui/theme';

export function ResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
            <View key={id} style={styles.row} accessible>
              <Text style={styles.rank}>{t('result.place', { rank: i + 1 })}</Text>
              <View style={[styles.dot, { backgroundColor: PAWN_COLORS[seat.color] }]} />
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
        <Button label={t('result.newGame')} variant="secondary" onPress={() => router.replace('/setup')} />
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

const styles = StyleSheet.create({
  list: { flex: 1, gap: 12, paddingTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { fontSize: 24, fontWeight: '800', color: colors.text, width: 36 },
  dot: { width: 24, height: 24, borderRadius: 12 },
  name: { fontSize: 20, color: colors.text },
  actions: { gap: 12, paddingBottom: 24 },
});
