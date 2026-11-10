import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_NAME } from '@/config/app';
import { SEAT_IDS, type SeatConfig } from '@/engine';
import { gameStore, useGame, useSettings } from '@/store/app';
import { Button, ConfirmSheet, Overline } from '@/ui/common';
import { Board } from '@/ui/game/Board';
import { SeatMark } from '@/ui/game/Controls';
import { Cowrie } from '@/ui/game/Cowrie';
import { firstSetup } from '@/ui/setup/presets';
import { font, fonts, MIN_TOUCH, radius, shadow, space, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  screen: { flex: 1, backgroundColor: c.background },
  content: { flex: 1, padding: space.xl, gap: space.lg, width: '100%' as const, maxWidth: 520, alignSelf: 'center' as const },
  hero: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, minHeight: 200 },
  shells: { width: 220, height: 96, marginBottom: 4 },
  title: { fontSize: 52, lineHeight: 60, fontFamily: fonts.display, color: c.accent, textAlign: 'center' as const },
  titleSmall: { fontSize: 48, lineHeight: 54 },
  subtitle: { fontSize: font.body, lineHeight: 22, fontFamily: fonts.body, color: c.muted, textAlign: 'center' as const },
  notice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: c.danger,
    backgroundColor: c.dangerSurface,
  },
  noticeText: { flex: 1, color: c.danger, fontSize: font.label, fontFamily: fonts.body },
  dismiss: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center' as const, paddingHorizontal: space.sm },
  dismissText: { color: c.accent, fontSize: font.label, fontFamily: fonts.bold },
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  players: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  player: {
    flexBasis: '47%' as const,
    flexGrow: 1,
    minHeight: 48,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  playerName: { flexShrink: 1, fontSize: 14, fontFamily: fonts.semibold, color: c.text },
  saved: {
    borderRadius: radius.xl,
    backgroundColor: c.surface,
    borderWidth: 3,
    borderColor: c.accent,
    padding: space.lg,
    gap: 14,
    ...shadow.panel,
  },
  savedRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14 },
  savedText: { flex: 1, gap: 4 },
  savedTitle: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 26, color: c.text },
  savedLine: { fontFamily: fonts.body, fontSize: 14, color: c.muted },
  actions: { gap: 10 },
  links: { flexDirection: 'row' as const, gap: 10 },
  link: { flex: 1 },
  note: { fontSize: 13, fontFamily: fonts.body, color: c.muted, textAlign: 'center' as const },
});

const sameKey = (seats: readonly Pick<SeatConfig, 'kind' | 'name' | 'color'>[]) =>
  JSON.stringify(seats.map(({ kind, name, color }) => [kind, name, color]));

/** Four shells resting mouth up, tilted as if just thrown. */
const HERO: [number, number, number][] = [
  [10, 40, -20],
  [60, 10, 12],
  [112, 34, -8],
  [160, 6, 22],
];

const noSelection = { playableThrowIds: [], activeThrowId: null, movablePawnIds: [], canEnter: false, preview: null };

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
  const savedSeat = saved?.seats.find((s) => s.id === saved.currentSeat);
  const savedHome = saved ? saved.pawns.filter((p) => p.seat === saved.currentSeat && p.pathIndex === 24).length : 0;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.hero}>
          {!saved && (
            <View style={styles.shells} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {HERO.map(([left, top, turn], i) => (
                <View key={i} style={{ position: 'absolute', left, top, transform: [{ rotate: `${turn}deg` }] }}>
                  <Cowrie up size={64} />
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.title, saved && styles.titleSmall]} accessibilityRole="header">
            {APP_NAME}
          </Text>
          <Text style={styles.subtitle}>{saved ? t('home.welcome') : t('home.tagline')}</Text>
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

        {saved && savedSeat && (
          <View style={styles.saved}>
            <View style={styles.savedRow}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Board state={saved} size={112} view={noSelection} onPawnPress={() => undefined} />
              </View>
              <View style={styles.savedText}>
                <Overline>{t('home.savedGame')}</Overline>
                <Text style={styles.savedTitle}>{t('home.savedTurn', { name: savedSeat.name, home: savedHome })}</Text>
              </View>
            </View>
            <Button
              label={t('home.continue')}
              size="large"
              onPress={() => {
                if (gameStore.getState().resume()) router.push('/game');
              }}
            />
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Overline>{t('home.whoPlays')}</Overline>
          </View>
          <PlayerGrid seats={players} label={t('home.whoPlays')} styles={styles} />
          {nextPlayers && (
            <>
              <Overline>{t('home.nextPlayers')}</Overline>
              <PlayerGrid seats={nextPlayers} label={t('home.nextPlayers')} styles={styles} />
            </>
          )}
        </View>

        <View style={styles.actions}>
          {saved ? (
            <Button label={t('home.newGame')} variant="secondary" onPress={newGame} />
          ) : (
            <Button label={t('home.play')} size="large" onPress={play} />
          )}
          <Button label={t('home.playersAndRules')} variant="secondary" onPress={() => router.push('/setup')} />
          <View style={styles.links}>
            <View style={styles.link}>
              <Button label={t('home.howToPlay')} onPress={() => router.push('/how-to-play')} variant="ghost" />
            </View>
            <View style={styles.link}>
              <Button label={t('home.settings')} onPress={() => router.push('/settings')} variant="ghost" />
            </View>
          </View>
          {saved && <Text style={styles.note}>{t('home.replaceNote')}</Text>}
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
    </SafeAreaView>
  );
}

function PlayerGrid({
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
            <SeatMark seat={SEAT_IDS[i]!} color={seat.color} size={28} />
            <Text style={styles.playerName} numberOfLines={1}>
              {seat.kind === 'bot' ? t('home.computer', { name: seat.name }) : seat.name}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}
