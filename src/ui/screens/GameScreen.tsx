import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { botDelay } from '@/bot';
import { humanStillPlaying, RULE_KEYS, type GameState, type Seat, type Throw } from '@/engine';
import { cuesFor, playCues, speak } from '@/services/feedback';
import { gameStore, settingsStore, useGame, useSettings } from '@/store/app';
import { Button, Title } from '@/ui/common';
import { Board } from '@/ui/game/Board';
import { MoveChoice, PoolChips, SeatMark, SeatPanels, Shells, TurnBanner } from '@/ui/game/Controls';
import { messageFor, throwPhrase } from '@/ui/game/messages';
import { durations, motionsFor, type Motion } from '@/ui/game/motion';
import { selectionView, tapPawn, tapThrow, tapWaiting, type SelectionView, type TapOutcome } from '@/ui/game/selection';
import { useThemedStyles, type Theme } from '@/ui/theme';

const CALLOUT_MS = 1800;
/** Tablets in landscape get a seat at each side of the board (R-LOCAL-04). */
const TABLET_MIN_WIDTH = 900;
const SIDE_PANEL = 170;

/** Plays bot turns after a 600–1000 ms pause (R-BOT-02), halved at Fast speed or with no human left. */
function useBotDriver(game: GameState | null, paused: boolean, fast: boolean) {
  useEffect(() => {
    if (!game || paused || game.phase === 'finished') return;
    const seat = game.seats.find((s) => s.id === game.currentSeat);
    if (seat?.kind !== 'bot') return;
    const { delayMs, botRngState } = botDelay(game.botRngState);
    const wait = fast ? delayMs / 2 : delayMs;
    // Bot decisions take well under 10 ms (R-BOT-04), so running one in a timer is fine.
    const timer = setTimeout(() => gameStore.getState().playBot(botRngState), wait);
    return () => clearTimeout(timer);
  }, [game, paused, fast]);
}

/**
 * Everything the UI does with engine events (R-TECH-05): callouts, screen-reader
 * announcements, pawn animations, sounds and haptics. Events are consumed once handled.
 */
function useEventFeedback() {
  const { t } = useTranslation();
  const [callout, setCallout] = useState<string | null>(null);
  const [motions, setMotions] = useState<Motion[]>([]);
  // The latest throw stays visible even when its turn ends at once (no legal move).
  const [lastThrow, setLastThrow] = useState<Throw | null>(null);
  const nextMotionId = useRef(1);
  const calloutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      gameStore.subscribe(({ events, game }) => {
        if (!game || events.length === 0) return;
        const messages = events.map((e) => messageFor(e, game, t));
        const shown = messages.map((m) => m.callout).filter(Boolean);
        const spoken = messages.map((m) => m.announce).filter(Boolean);
        const thrown = events.filter((e) => e.type === 'ThrowResolved').pop();
        if (thrown?.type === 'ThrowResolved') setLastThrow(thrown.throw);
        // Let the shells finish rolling before the result is called out or announced.
        const settings = settingsStore.getState();
        const wait = thrown ? durations(settings.speed === 'fast' || !humanStillPlaying(game)).shellsMs : 0;
        const show = () => {
          // Call out the result once the shells settle ("It's 3", "Chamma!").
          if (thrown?.type === 'ThrowResolved' && settings.callouts) {
            speak(throwPhrase(thrown.throw.value, t), settings.language);
          }
          if (shown.length > 0) setCallout(shown[shown.length - 1]!);
          if (spoken.length > 0) AccessibilityInfo.announceForAccessibility(spoken.join('. '));
        };
        if (calloutTimer.current) clearTimeout(calloutTimer.current);
        if (wait > 0) calloutTimer.current = setTimeout(show, wait);
        else show();

        const added = motionsFor(events, nextMotionId.current);
        nextMotionId.current += added.length;
        if (added.length > 0) setMotions((queue) => [...queue, ...added]);

        const humans = game.seats.filter((s) => s.kind === 'human').map((s) => s.id);
        playCues(cuesFor(events, humans), settingsStore.getState());
        gameStore.getState().consumeEvents(events.length);
      }),
    [t],
  );

  useEffect(
    () => () => {
      if (calloutTimer.current) clearTimeout(calloutTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!callout) return;
    const timer = setTimeout(() => setCallout(null), CALLOUT_MS);
    return () => clearTimeout(timer);
  }, [callout]);

  const motionDone = useCallback((id: number) => setMotions((queue) => queue.filter((m) => m.id !== id)), []);
  return { callout, motions, motionDone, lastThrow };
}

const makeStyles = (c: Theme) => ({
  safe: { flex: 1, backgroundColor: c.background },
  phone: { flex: 1, padding: 16, gap: 10 },
  top: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  flex: { flex: 1 },
  center: { alignItems: 'center' as const, justifyContent: 'center' as const },
  callout: {
    position: 'absolute' as const,
    backgroundColor: c.overlay,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  calloutText: { color: c.onOverlay, fontSize: 20, fontWeight: '700' as const, textAlign: 'center' as const },
  hint: { color: c.muted, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, padding: 24 },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    maxWidth: 480,
    width: '100%' as const,
    alignSelf: 'center' as const,
  },
  rule: { color: c.text, fontSize: 14 },
  tablet: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  column: { alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 },
  side: {
    padding: 10,
    gap: 8,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    alignItems: 'center' as const,
    alignContent: 'center' as const,
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sideCurrent: { borderColor: c.accent },
  sideName: { color: c.text, fontSize: 18, fontWeight: '700' as const },
  tabletCorner: { position: 'absolute' as const, top: 12, right: 12, gap: 8 },
});

type Styles = ReturnType<typeof makeStyles>;

interface TurnControlsProps {
  game: GameState;
  seat: Seat;
  human: boolean;
  view: SelectionView;
  lastThrow: Throw | null;
  rollMs: number;
  styles: Styles;
  onTap(outcome: TapOutcome): void;
}

/** Shells, pool chips, hint and the throw button for the player whose turn it is. */
function TurnControls({ game, seat, human, view, lastThrow, rollMs, styles, onTap }: TurnControlsProps) {
  const { t } = useTranslation();
  const selectedPawnId = useGame((s) => s.selectedPawnId);
  const hint =
    game.phase === 'moving' && human
      ? view.activeThrowId === null
        ? t('game.pickThrow')
        : view.movablePawnIds.length === 0 && view.canEnter
          ? t('game.pickEnter')
          : t('game.pickPawn')
      : null;
  return (
    <>
      <Shells thrown={lastThrow ?? undefined} rollMs={rollMs} />
      {game.phase === 'moving' && (
        <PoolChips
          pool={game.pool}
          playable={human ? view.playableThrowIds : []}
          active={view.activeThrowId}
          onPress={(id) => onTap(tapThrow(game, id, selectedPawnId))}
        />
      )}
      {hint && <Text style={styles.hint}>{hint}</Text>}
      {human && game.phase === 'throwing' && (
        <Button
          label={game.pool.length > 0 ? t('game.throwAgain') : t('game.throw')}
          onPress={() => gameStore.getState().dispatch({ type: 'Throw', seat: seat.id })}
        />
      )}
    </>
  );
}

export function GameScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const game = useGame((s) => s.game);
  const setup = useGame((s) => s.setup);
  const selectedThrowId = useGame((s) => s.selectedThrowId);
  const selectedPawnId = useGame((s) => s.selectedPawnId);
  const speedFast = useSettings((s) => s.speed === 'fast');
  const [choice, setChoice] = useState<Extract<TapOutcome, { kind: 'choose' }> | null>(null);
  const [paused, setPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Bot-only play runs at Fast automatically (R-UX-04).
  const fast = speedFast || (!!game && !humanStillPlaying(game));
  const timing = durations(fast);
  useBotDriver(game, paused, fast);
  const { callout, motions, motionDone, lastThrow } = useEventFeedback();

  useEffect(() => {
    if (game?.phase === 'finished') router.replace('/result');
  }, [game?.phase, router]);

  if (!game) return <Redirect href="/" />;

  const store = gameStore.getState();
  const seat = game.seats.find((s) => s.id === game.currentSeat)!;
  const human = seat.kind === 'human' && game.phase !== 'finished';
  const view = selectionView(game, selectedThrowId, selectedPawnId);
  const tablet = width >= TABLET_MIN_WIDTH && width > height;

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

  const boardSize = tablet
    ? Math.min(height - 2 * SIDE_PANEL - 40, width - 2 * SIDE_PANEL - 40)
    : Math.min(width - 32, height * 0.5);
  const board = (
    <View style={styles.center}>
      <Board
        state={game}
        size={boardSize}
        view={human ? view : { ...view, movablePawnIds: [], preview: null }}
        onPawnPress={(id) => handle(tapPawn(game, selectedThrowId, id))}
        onWaitingPress={() => handle(tapWaiting(game, selectedThrowId))}
        motions={motions}
        stepMs={timing.stepMs}
        knockbackMs={timing.knockbackMs}
        onMotionDone={motionDone}
      />
      {callout && (
        <View style={styles.callout} pointerEvents="none" accessibilityElementsHidden>
          <Text style={styles.calloutText}>{callout}</Text>
        </View>
      )}
    </View>
  );
  const controls = (
    <TurnControls
      game={game}
      seat={seat}
      human={human}
      view={view}
      lastThrow={lastThrow}
      rollMs={timing.shellsMs}
      styles={styles}
      onTap={handle}
    />
  );
  const endNow = !humanStillPlaying(game) && game.phase !== 'finished' && (
    <Button label={t('game.endNow')} onPress={() => store.endNow()} variant="secondary" />
  );
  const pauseButton = <Button label={t('game.pause')} onPress={() => setPaused(true)} variant="secondary" />;

  /** A seat's side panel on tablets, turned to face that player. */
  const side = (id: Seat['id'], rotate: string, w: number, h: number) => {
    const s = game.seats.find((x) => x.id === id)!;
    const current = s.id === game.currentSeat;
    const vertical = rotate === '90deg' || rotate === '-90deg';
    return (
      <View style={{ width: vertical ? h : w, height: vertical ? w : h }}>
        {s.kind !== 'empty' && (
          <View
            style={[
              styles.side,
              current && styles.sideCurrent,
              {
                position: 'absolute',
                width: w,
                height: h,
                left: vertical ? (h - w) / 2 : 0,
                top: vertical ? (w - h) / 2 : 0,
                transform: [{ rotate }],
              },
            ]}
          >
            <SeatMark seat={s.id} color={s.color} />
            <Text style={styles.sideName}>{s.name}</Text>
            {current && controls}
          </View>
        )}
      </View>
    );
  };

  const menus = (
    <>
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
                  {t('pause.ruleLine', {
                    label: t(`rules.${key}.label`),
                    value: t(`rules.${key}.${String(game.ruleConfig[key])}`),
                  })}
                </Text>
              ))}
            <Button
              label={t('howToPlay.title')}
              variant="secondary"
              onPress={() => {
                setPaused(false);
                router.push('/how-to-play');
              }}
            />
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
    </>
  );

  if (tablet) {
    const w = boardSize;
    const h = SIDE_PANEL;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.tablet}>
          {side('D', '90deg', w, h)}
          <View style={styles.column}>
            {side('C', '180deg', w, h)}
            {board}
            {side('A', '0deg', w, h)}
          </View>
          {side('B', '-90deg', w, h)}
        </View>
        <View style={styles.tabletCorner}>
          {pauseButton}
          {endNow}
        </View>
        {menus}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.phone}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <TurnBanner seat={seat} />
          </View>
          {pauseButton}
        </View>
        <SeatPanels state={game} />
        {board}
        {controls}
        {endNow}
      </View>
      {menus}
    </SafeAreaView>
  );
}
