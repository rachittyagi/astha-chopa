import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { gameStore, useGame } from '@/store/app';
import { Button, Screen, Title } from '@/ui/common';
import { SeatMark } from '@/ui/game/Controls';
import { Trophy } from '@/ui/game/Trophy';
import { font, PAWN_COLORS, radius, space, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  list: { flex: 1, gap: space.md, paddingTop: space.md },
  // The winner gets a card of their own, in their colour, so the result still feels like a win.
  winner: {
    alignItems: 'center' as const,
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.xl,
    borderWidth: 3,
    backgroundColor: c.surface,
  },
  winnerLabel: { fontSize: font.label, fontWeight: '700' as const, color: c.muted, textTransform: 'uppercase' as const },
  winnerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md },
  winnerName: { fontSize: font.title, fontWeight: '800' as const, color: c.text, flexShrink: 1 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md, paddingHorizontal: space.sm },
  rank: { fontSize: font.heading, fontWeight: '800' as const, color: c.text, minWidth: 36 },
  name: { fontSize: font.body, color: c.text },
  actions: { gap: space.md, paddingBottom: space.xl },
});

export function ResultScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  // A snapshot: "Play again" replaces the store's game while this screen is leaving.
  const [game] = useState(() => gameStore.getState().game);
  const setup = useGame((s) => s.setup);

  if (!game || game.phase !== 'finished') return <Redirect href="/" />;

  const seatOf = (id: string) => game.seats.find((s) => s.id === id)!;
  const [first, ...rest] = game.rankings;
  const winner = first ? seatOf(first) : null;

  return (
    <Screen>
      <Title>{t('result.title')}</Title>
      <View style={styles.list}>
        {winner && (
          <View
            style={[styles.winner, { borderColor: PAWN_COLORS[winner.color] }]}
            accessible
            accessibilityLabel={t('result.a11y', { rank: 1, name: winner.name })}
          >
            <Trophy size={56} />
            <Text style={styles.winnerLabel}>{t('result.winner')}</Text>
            <View style={styles.winnerRow}>
              <SeatMark seat={winner.id} color={winner.color} size={30} />
              <Text style={styles.winnerName}>{winner.name}</Text>
            </View>
          </View>
        )}
        {rest.map((id, i) => {
          const seat = seatOf(id);
          const rank = i + 2;
          return (
            <View key={id} style={styles.row} accessible accessibilityLabel={t('result.a11y', { rank, name: seat.name })}>
              <Text style={styles.rank}>{t('result.place', { rank })}</Text>
              <SeatMark seat={seat.id} color={seat.color} size={26} />
              <Text style={styles.name}>{seat.name}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button
          label={t('result.playAgain')}
          size="large"
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
