import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import type { Seat } from '@/engine';
import { gameStore, useGame } from '@/store/app';
import { Button, Overline, Screen } from '@/ui/common';
import { SeatMark } from '@/ui/game/Controls';
import { fonts, space, useThemedStyles, type Theme } from '@/ui/theme';

/** Podium steps: height, top colour, bottom colour, ink. 1st is gold and in the middle. */
const STEPS = {
  1: { h: 180, top: '#E9B44C', bottom: '#B07A1C', ink: '#3B1D08', avatar: 70, size: 36 },
  2: { h: 130, top: '#C98E52', bottom: '#9A5E2A', ink: '#FFF6E6', avatar: 54, size: 30 },
  3: { h: 96, top: '#B98A62', bottom: '#8A5B36', ink: '#FFF6E6', avatar: 50, size: 28 },
} as const;

const CONFETTI = ['#C23B2A', '#E39B0B', '#2F7D4E', '#2E5AA8', '#F2B632', '#E85D75'];

const makeStyles = (c: Theme) => ({
  head: { alignItems: 'center' as const, gap: 2, paddingTop: space.xl },
  title: { fontFamily: fonts.display, fontSize: 48, lineHeight: 54, color: c.accent, textAlign: 'center' as const },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: c.muted },
  podium: { flex: 1, flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 10, paddingHorizontal: space.sm, minHeight: 300 },
  place: { flex: 1, alignItems: 'center' as const, gap: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: c.text, textAlign: 'center' as const },
  step: { width: '100%' as const, borderTopLeftRadius: 14, borderTopRightRadius: 14, alignItems: 'center' as const, paddingTop: 10 },
  stepText: { fontFamily: fonts.display },
  rest: { gap: 6 },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: space.sm },
  rank: { fontFamily: fonts.bold, fontSize: 14, color: c.muted },
  restName: { fontFamily: fonts.body, fontSize: 14, color: c.muted },
  actions: { gap: 10, paddingBottom: space.lg },
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
  const ranked = game.rankings.map(seatOf);
  const winner = ranked[0] ?? null;
  // 2nd on the left, 1st in the middle, 3rd on the right.
  const podium = [ranked[1], ranked[0], ranked[2]]
    .map((seat, i) => (seat ? { seat, rank: ([2, 1, 3] as const)[i]! } : null))
    .filter((p): p is { seat: Seat; rank: 1 | 2 | 3 } => p !== null);

  return (
    <Screen>
      {/* A few still petals and strips: decoration, not motion. */}
      <View style={{ position: 'absolute', inset: 0 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 24 }, (_, i) => {
          const petal = i % 3 === 0;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: `${((i * 37) % 96) + 2}%`,
                top: `${((i * 23) % 60) + 2}%`,
                width: petal ? 13 : 7,
                height: petal ? 13 : 14,
                borderRadius: petal ? 0 : 2,
                borderTopLeftRadius: petal ? 7 : 2,
                borderBottomRightRadius: petal ? 7 : 2,
                backgroundColor: CONFETTI[i % CONFETTI.length],
                opacity: 0.85,
                transform: [{ rotate: `${(i * 53) % 180}deg` }],
              }}
            />
          );
        })}
      </View>
      <View style={styles.head}>
        <Overline>{t('result.winner')}</Overline>
        {winner && (
          <Text style={styles.title} accessibilityRole="header">
            {t('game.celebrate.title', { name: winner.name })}
          </Text>
        )}
        <Text style={styles.subtitle}>{t('result.subtitle')}</Text>
      </View>
      <View style={styles.podium}>
        {podium.map(({ seat, rank }) => {
          const step = STEPS[rank];
          return (
            <View
              key={seat.id}
              style={[styles.place, rank === 1 && { flex: 1.1 }]}
              accessible
              accessibilityLabel={t('result.a11y', { rank, name: seat.name })}
            >
              <View style={rank === 1 ? { borderRadius: 999, boxShadow: '0 0 0 7px rgba(242,182,50,0.5)' } : undefined}>
                <SeatMark seat={seat.id} color={seat.color} size={step.avatar} />
              </View>
              <Text style={[styles.name, rank === 1 && { fontFamily: fonts.bold, fontSize: 16 }]} numberOfLines={2}>
                {seat.name}
              </Text>
              <View
                style={[
                  styles.step,
                  { height: step.h, backgroundColor: step.top, experimental_backgroundImage: `linear-gradient(${step.top}, ${step.bottom})` },
                ]}
              >
                <Text style={[styles.stepText, { color: step.ink, fontSize: step.size, lineHeight: step.size * 1.2 }]}>
                  {t('result.place', { rank })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      {ranked.length > 3 && (
        <View style={styles.rest}>
          {ranked.slice(3).map((seat, i) => {
            const rank = i + 4;
            return (
              <View key={seat.id} style={styles.row} accessible accessibilityLabel={t('result.a11y', { rank, name: seat.name })}>
                <Text style={styles.rank}>{t('result.place', { rank })}</Text>
                <SeatMark seat={seat.id} color={seat.color} size={22} />
                <Text style={styles.restName}>{seat.name}</Text>
              </View>
            );
          })}
        </View>
      )}
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
