import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { botDelay } from '@/bot';
import { humanStillPlaying, RULE_KEYS, type GameState } from '@/engine';
import { gameStore, useGame, useSettings } from '@/store/app';
import { Button, Screen, Title } from '@/ui/common';
import { Board } from '@/ui/game/Board';
import { MoveChoice, PoolChips, SeatPanels, Shells, TurnBanner, WaitingArea } from '@/ui/game/Controls';
import { messageFor } from '@/ui/game/messages';
import { selectionView, tapPawn, tapThrow, tapWaiting, type TapOutcome } from '@/ui/game/selection';
import { colors } from '@/ui/theme';

const CALLOUT_MS = 1800;

/** Plays bot turns after a 600–1000 ms pause (R-BOT-02), halved at Fast speed or with no human left. */
function useBotDriver(game: GameState | null, paused: boolean, fast: boolean) {
  useEffect(() => {
    if (!game || paused || game.phase === 'finished') return;
    const seat = game.seats.find((s) => s.id === game.currentSeat);
    if (seat?.kind !== 'bot') return;
    const { delayMs, botRngState } = botDelay(game.botRngState);
    const wait = fast || !humanStillPlaying(game) ? delayMs / 2 : delayMs;
    // Bot decisions take well under 10 ms (R-BOT-04), so running one in a timer is fine.
    const timer = setTimeout(() => gameStore.getState().playBot(botRngState), wait);
    return () => clearTimeout(timer);
  }, [game, paused, fast]);
}

/** Shows callouts and announces events to screen readers, then marks them consumed. */
function useEventMessages() {
  const { t } = useTranslation();
  const [callout, setCallout] = useState<string | null>(null);

  useEffect(
    () =>
      gameStore.subscribe(({ events, game }) => {
        if (!game || events.length === 0) return;
        const messages = events.map((e) => messageFor(e, game, t));
        const shown = messages.map((m) => m.callout).filter(Boolean);
        const spoken = messages.map((m) => m.announce).filter(Boolean);
        if (shown.length > 0) setCallout(shown[shown.length - 1]!);
        if (spoken.length > 0) AccessibilityInfo.announceForAccessibility(spoken.join('. '));
        gameStore.getState().consumeEvents(events.length);
      }),
    [t],
  );

  useEffect(() => {
    if (!callout) return;
    const timer = setTimeout(() => setCallout(null), CALLOUT_MS);
    return () => clearTimeout(timer);
  }, [callout]);

  return callout;
}

export function GameScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const game = useGame((s) => s.game);
  const setup = useGame((s) => s.setup);
  const selectedThrowId = useGame((s) => s.selectedThrowId);
  const selectedPawnId = useGame((s) => s.selectedPawnId);
  const fast = useSettings((s) => s.speed === 'fast');
  const [choice, setChoice] = useState<Extract<TapOutcome, { kind: 'choose' }> | null>(null);
  const [paused, setPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useBotDriver(game, paused, fast);
  const callout = useEventMessages();

  useEffect(() => {
    if (game?.phase === 'finished') router.replace('/result');
  }, [game?.phase, router]);

  if (!game) return <Redirect href="/" />;

  const store = gameStore.getState();
  const seat = game.seats.find((s) => s.id === game.currentSeat)!;
  const human = seat.kind === 'human' && game.phase !== 'finished';
  const view = selectionView(game, selectedThrowId, selectedPawnId);
  const boardSize = Math.min(width - 32, height * 0.5);
  const lastThrow = game.pool[game.pool.length - 1];

  const handle = (outcome: TapOutcome) => {
    if (!human) return;
    switch (outcome.kind) {
      case 'move':
        store.dispatch(outcome.action);
        break;
      case 'choose':
        setChoice(outcome);
        break;
      case 'selectPawn':
        store.selectPawn(outcome.pawnId);
        break;
      case 'selectThrow':
        store.selectThrow(outcome.throwId);
        break;
    }
  };

  const hint =
    game.phase === 'moving' && human
      ? view.activeThrowId === null
        ? t('game.pickThrow')
        : view.movablePawnIds.length === 0 && view.canEnter
          ? t('game.pickEnter')
          : t('game.pickPawn')
      : null;

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.flex}>
          <TurnBanner seat={seat} />
        </View>
        <Button label={t('game.pause')} onPress={() => setPaused(true)} variant="secondary" />
      </View>
      <SeatPanels state={game} />

      <View style={styles.center}>
        <Board
          state={game}
          size={boardSize}
          view={human ? view : { ...view, movablePawnIds: [], preview: null }}
          onPawnPress={(id) => handle(tapPawn(game, selectedThrowId, id))}
        />
        {callout && (
          <View style={styles.callout} pointerEvents="none">
            <Text style={styles.calloutText}>{callout}</Text>
          </View>
        )}
      </View>

      <View style={styles.waitingRow}>
        {game.seats
          .filter((s) => s.kind !== 'empty')
          .map((s) => (
            <WaitingArea
              key={s.id}
              state={game}
              seat={s}
              canEnter={human && view.canEnter}
              onPress={() => handle(tapWaiting(game, selectedThrowId))}
            />
          ))}
      </View>

      <Shells thrown={lastThrow} />
      {game.phase === 'moving' && (
        <PoolChips
          pool={game.pool}
          playable={human ? view.playableThrowIds : []}
          active={view.activeThrowId}
          onPress={(id) => handle(tapThrow(game, id, selectedPawnId))}
        />
      )}
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {human && game.phase === 'throwing' && (
        <Button
          label={game.pool.length > 0 ? t('game.throwAgain') : t('game.throw')}
          onPress={() => store.dispatch({ type: 'Throw', seat: seat.id })}
        />
      )}
      {!humanStillPlaying(game) && game.phase !== 'finished' && (
        <Button label={t('game.endNow')} onPress={() => store.endNow()} variant="secondary" />
      )}

      <MoveChoice
        visible={choice !== null}
        onOne={() => {
          if (choice) store.dispatch(choice.one);
          setChoice(null);
        }}
        onBoth={() => {
          if (choice) store.dispatch(choice.both);
          setChoice(null);
        }}
        onCancel={() => setChoice(null)}
      />

      <Modal transparent visible={paused} animationType="fade" onRequestClose={() => setPaused(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Title>{t('pause.title')}</Title>
            <Button label={t('pause.resume')} onPress={() => setPaused(false)} />
            <Button
              label={t('pause.restart')}
              variant="secondary"
              onPress={() => {
                if (setup) store.startGame(setup);
                setPaused(false);
              }}
            />
            <Button label={t('pause.rules')} variant="secondary" onPress={() => setShowRules((v) => !v)} />
            {showRules &&
              RULE_KEYS.map((key) => (
                <Text key={key} style={styles.rule}>
                  {t(`rules.${key}.label`)}: {t(`rules.${key}.${String(game.ruleConfig[key])}`)}
                </Text>
              ))}
            <Button
              label={t('pause.quit')}
              variant="secondary"
              onPress={() => {
                setPaused(false);
                store.quit();
                router.replace('/');
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  callout: {
    position: 'absolute',
    backgroundColor: colors.overlay,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  calloutText: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  waitingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { color: colors.muted, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  rule: { color: colors.text, fontSize: 14 },
});
