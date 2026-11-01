import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import type { SeatConfig } from '@/engine';
import { gameStore, useGame, useSettings } from '@/store/app';
import { Button, ConfirmSheet, Screen } from '@/ui/common';
import { SeatMark } from '@/ui/game/Controls';
import { Cowrie } from '@/ui/game/Cowrie';
import { firstSetup } from '@/ui/setup/presets';
import { font, MIN_TOUCH, radius, space, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  hero: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 10 },
  title: { fontSize: 44, fontWeight: '800' as const, color: c.accent, textAlign: 'center' as const },
  subtitle: { fontSize: 18, color: c.muted, textAlign: 'center' as const },
  notice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: c.danger,
    backgroundColor: c.surface,
  },
  noticeText: { flex: 1, color: c.danger, fontSize: font.label },
  dismiss: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center' as const, paddingHorizontal: space.sm },
  dismissText: { color: c.accent, fontSize: font.label, fontWeight: '700' as const },
  shells: { flexDirection: 'row' as const, gap: 14, marginTop: 18 },
  players: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, justifyContent: 'center' as const, gap: 14 },
  player: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  playerName: { fontSize: 18, color: c.text },
  nextLabel: { fontSize: 14, color: c.muted, textAlign: 'center' as const },
  actions: { gap: 14, paddingBottom: 24, width: '100%' as const, maxWidth: 480, alignSelf: 'center' as const },
  links: { flexDirection: 'row' as const, gap: 12 },
  link: { flex: 1 },
});

const sameKey = (seats: readonly Pick<SeatConfig, 'kind' | 'name' | 'color'>[]) =>
  JSON.stringify(seats.map(({ kind, name, color }) => [kind, name, color]));

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
  // With a game to continue, show who is in that game; the setup saved for the next one is
  // shown by New game when it differs, so a saved change is visible before it is used.
  const players = saved ? saved.seats : setup.seats;
  const nextPlayers = saved && sameKey(saved.seats) !== sameKey(setup.seats) ? setup.seats : null;

  const play = () => {
    gameStore.getState().startGame(setup);
    router.push('/game');
  };
  // New game replaces the unfinished one, so it asks first.
  const [confirmReplace, setConfirmReplace] = useState(false);
  const newGame = () => setConfirmReplace(true);

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={styles.title} accessibilityRole="header">
          {APP_NAME}
        </Text>
        <Text style={styles.subtitle}>{t('home.tagline')}</Text>
        <View style={styles.shells} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {[true, false, true, true].map((up, i) => (
            <View key={i} style={{ transform: [{ rotate: `${[-14, 8, -4, 16][i]}deg` }] }}>
              <Cowrie up={up} size={64} />
            </View>
          ))}
        </View>
      </View>
      {problem && (
        <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeText}>{t(problem === 'oldVersion' ? 'home.saveOldVersion' : 'home.saveUnreadable')}</Text>
          <Pressable
            onPress={() => gameStore.getState().dismissSaveProblem()}
            accessibilityRole="button"
            accessibilityLabel={t('home.dismiss')}
            style={styles.dismiss}
          >
            <Text style={styles.dismissText}>{t('home.dismiss')}</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.actions}>
        <PlayerRow seats={players} label={t('home.whoPlays')} styles={styles} />
        {saved ? (
          <>
            <Button
              label={t('home.continue')}
              size="large"
              onPress={() => {
                if (gameStore.getState().resume()) router.push('/game');
              }}
            />
            {nextPlayers && (
              <>
                <Text style={styles.nextLabel}>{t('home.nextPlayers')}</Text>
                <PlayerRow seats={nextPlayers} label={t('home.nextPlayers')} styles={styles} />
              </>
            )}
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
      <ConfirmSheet
        visible={confirmReplace}
        title={t('setup.replaceTitle')}
        body={t('setup.replaceBody')}
        confirmLabel={t('setup.replace')}
        onConfirm={() => {
          setConfirmReplace(false);
          play();
        }}
        onCancel={() => setConfirmReplace(false)}
      />
    </Screen>
  );
}

function PlayerRow({
  seats,
  label,
  styles,
}: {
  seats: readonly Pick<SeatConfig, 'kind' | 'name' | 'color'>[];
  label: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.players} accessible accessibilityLabel={label}>
      {seats.map((seat, i) =>
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
  );
}
