import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Alert, Modal, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { botDelay } from '@/bot';
import { humanStillPlaying, RULE_KEYS, type GameState, type Seat, type SeatId, type Throw } from '@/engine';
import { cuesFor, playCues, playSound, speak, specialThrowSound } from '@/services/feedback';
import { gameStore, settingsStore, useGame, useSettings } from '@/store/app';
import { Button, Title } from '@/ui/common';
import { Board } from '@/ui/game/Board';
import { Celebration } from '@/ui/game/Celebration';
import { MoveChoice, PoolChips, SeatMark, seatStatus, SeatStatus, Shells, TurnBanner } from '@/ui/game/Controls';
import { messageFor, throwPhrase } from '@/ui/game/messages';
import { durations, motionsFor, type Motion } from '@/ui/game/motion';
import { selectionView, tapPawn, tapThrow, tapWaiting, type SelectionView, type TapOutcome } from '@/ui/game/selection';
import { useThemedStyles, type Theme } from '@/ui/theme';

const CALLOUT_MS = 1800;
/** After the shells settle, a bot waits this much longer before moving, so everyone can read the throw. */
const READ_PAUSE_MS = 900;
/** Tablets in landscape get a seat at each side of the board (R-LOCAL-04). */
const TABLET_MIN_WIDTH = 900;
/** Height of a tablet seat panel at normal text size; it grows with the system font scale. */
const SIDE_PANEL = 180;
/** The phone board never shrinks below this; past it the screen scrolls instead (R-A11Y-03). */
const MIN_BOARD = 260;
/** Large-button height: the throw slot keeps it even when empty, so the board never jumps. */
const ACTION_SLOT = 72;

/**
 * Plays bot turns after a 600–1000 ms pause (R-BOT-02), halved at Fast speed or with no human left.
 * The pause starts only once the shells have settled and every pawn has finished moving (`busy`),
 * and a move gets an extra read pause so the throw can be seen before the pawn goes.
 */
function useBotDriver(game: GameState | null, paused: boolean, busy: boolean, fast: boolean) {
  useEffect(() => {
    if (!game || paused || busy || game.phase === 'finished') return;
    const seat = game.seats.find((s) => s.id === game.currentSeat);
    if (seat?.kind !== 'bot') return;
    const { delayMs, botRngState } = botDelay(game.botRngState);
    const total = delayMs + (game.phase === 'moving' ? READ_PAUSE_MS : 0);
    const wait = fast ? total / 2 : total;
    // Bot decisions take well under 10 ms (R-BOT-04), so running one in a timer is fine.
    const timer = setTimeout(() => gameStore.getState().playBot(botRngState), wait);
    return () => clearTimeout(timer);
  }, [game, paused, busy, fast]);
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
  // The seat that just finished first, celebrated on screen once its winning move has played.
  const [winner, setWinner] = useState<SeatId | null>(null);
  // True while the shells tumble: the result stays hidden until they settle.
  const [rolling, setRolling] = useState(false);
  const nextMotionId = useRef(1);
  const calloutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The reveal waiting for the shells to settle; a new batch runs it at once instead of dropping it.
  const pendingReveal = useRef<(() => void) | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setRolling(false);
          // Once the shells settle: Chamma and Ashta get their own sound, then the result is
          // spoken ("3", "Chamma!"), just after the special sound so the two do not clash.
          if (thrown?.type === 'ThrowResolved') {
            const special = specialThrowSound(thrown.throw.value);
            if (special) playSound(special, settings);
            if (settings.callouts) {
              const phrase = throwPhrase(thrown.throw.value, t);
              if (speechTimer.current) clearTimeout(speechTimer.current);
              if (special && settings.sound) speechTimer.current = setTimeout(() => speak(phrase, settings.language), 450);
              else speak(phrase, settings.language);
            }
          }
          if (shown.length > 0) setCallout(shown[shown.length - 1]!);
          if (spoken.length > 0) AccessibilityInfo.announceForAccessibility(spoken.join('. '));
        };
        if (calloutTimer.current) clearTimeout(calloutTimer.current);
        const earlier = pendingReveal.current;
        pendingReveal.current = null;
        earlier?.();
        if (wait > 0) {
          setRolling(true);
          pendingReveal.current = show;
          calloutTimer.current = setTimeout(() => {
            pendingReveal.current = null;
            show();
          }, wait);
        } else show();

        const added = motionsFor(events, nextMotionId.current);
        nextMotionId.current += added.length;
        if (added.length > 0) setMotions((queue) => [...queue, ...added]);

        const first = events.find((e) => e.type === 'PlayerFinished' && e.rank === 1);
        if (first?.type === 'PlayerFinished') setWinner(first.seat);

        playCues(cuesFor(events), settingsStore.getState());
        gameStore.getState().consumeEvents(events.length);
      }),
    [t],
  );

  useEffect(
    () => () => {
      if (calloutTimer.current) clearTimeout(calloutTimer.current);
      if (speechTimer.current) clearTimeout(speechTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!callout) return;
    const timer = setTimeout(() => setCallout(null), CALLOUT_MS);
    return () => clearTimeout(timer);
  }, [callout]);

  const motionDone = useCallback((id: number) => setMotions((queue) => queue.filter((m) => m.id !== id)), []);
  const clearWinner = useCallback(() => setWinner(null), []);
  // Bots and the results screen wait from the moment of the win; the overlay waits for the pawns.
  const celebrating = winner !== null;
  const shownWinner = motions.length === 0 ? winner : null;
  return { callout, motions, motionDone, lastThrow, rolling, winner: shownWinner, celebrating, clearWinner };
}

const makeStyles = (c: Theme) => ({
  safe: { flex: 1, backgroundColor: c.background },
  phone: { flexGrow: 1, padding: 12, gap: 12 },
  boardSlot: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  controls: { gap: 10 },
  chipSlot: { minHeight: 60 },
  actionSlot: { minHeight: ACTION_SLOT, justifyContent: 'center' as const },
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
  hint: { color: c.text, fontSize: 18, lineHeight: 24 },
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
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sideCurrent: { borderColor: c.accent },
  sideContent: { flexGrow: 1, flexDirection: 'row' as const, gap: 12 },
  sideInfo: { flex: 3, gap: 4 },
  sideActions: { flex: 2, gap: 8, justifyContent: 'center' as const },
  sideHint: { color: c.text, fontSize: 15, lineHeight: 20 },
  sideHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  sideName: { flexShrink: 1, color: c.text, fontSize: 18, fontWeight: '700' as const },
  sideStatus: { color: c.muted, fontSize: 14 },
  confirm: { color: c.text, fontSize: 17, lineHeight: 24 },
  tabletCorner: { position: 'absolute' as const, top: 12, right: 12, gap: 8 },
});

type Styles = ReturnType<typeof makeStyles>;

interface TurnControlsProps {
  game: GameState;
  seat: Seat;
  human: boolean;
  /** The human whose turn it is may tap now: not while the shells tumble. */
  canAct: boolean;
  view: SelectionView;
  lastThrow: Throw | null;
  rollMs: number;
  /** The shells are still tumbling: hide the new throw's chip, the hint and Throw again. */
  rolling: boolean;
  styles: Styles;
  onTap(outcome: TapOutcome): void;
  /** Tablet side panels: smaller shells, and no reserved space (the panel has a fixed size). */
  compact?: boolean;
  /** Shown in the throw button's place when nobody human is left to throw (End now). */
  idleAction?: ReactNode;
  /** Compact only: the seat's name and status, shown above the shells. */
  header?: ReactNode;
}

/**
 * Shells, pool chips, hint and the throw button for the player whose turn it is. On phones each
 * part keeps its height whether or not it has anything to show, so the board above stays put.
 */
function TurnControls({
  game,
  seat,
  human,
  canAct,
  view,
  lastThrow,
  rollMs,
  rolling,
  styles,
  onTap,
  compact = false,
  idleAction,
  header,
}: TurnControlsProps) {
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const selectedPawnId = useGame((s) => s.selectedPawnId);
  const hint =
    game.phase === 'moving' && canAct
      ? view.activeThrowId === null
        ? t('game.pickThrow')
        : view.movablePawnIds.length === 0 && view.canEnter
          ? t('game.pickEnter')
          : t('game.pickPawn')
      : null;
  const shells = <Shells thrown={lastThrow ?? undefined} rollMs={rollMs} size={compact ? 36 : 48} />;
  const chips = game.phase === 'moving' && (
    <PoolChips
      pool={rolling ? game.pool.filter((p) => p.id !== lastThrow?.id) : game.pool}
      playable={view.playableThrowIds}
      active={view.activeThrowId}
      onPress={(id) => onTap(tapThrow(game, id, selectedPawnId))}
    />
  );
  // Two lines are kept for the hint, so a longer one does not push the controls down.
  const hintText = (
    <Text style={compact ? styles.sideHint : [styles.hint, { minHeight: 2 * 24 * fontScale }]} numberOfLines={2}>
      {hint ?? ''}
    </Text>
  );
  const action =
    human && game.phase === 'throwing' ? (
      <Button
        label={game.pool.length > 0 && !rolling ? t('game.throwAgain') : t('game.throw')}
        size={compact ? 'normal' : 'large'}
        disabled={rolling}
        onPress={() => gameStore.getState().dispatch({ type: 'Throw', seat: seat.id })}
      />
    ) : (
      idleAction
    );

  if (compact) {
    return (
      <>
        <View style={styles.sideInfo}>
          {header}
          {shells}
          {hint && hintText}
        </View>
        <View style={styles.sideActions}>
          {chips}
          {action}
        </View>
      </>
    );
  }
  return (
    <View style={styles.controls}>
      {shells}
      <View style={styles.chipSlot}>{chips}</View>
      {hintText}
      <View style={styles.actionSlot}>{action}</View>
    </View>
  );
}

/**
 * One mounted view per game: Restart starts a new game id, which remounts the view so no
 * animations, throw display or timers carry over from the previous game.
 */
export function GameScreen() {
  const id = useGame((s) => s.game?.id);
  if (!id) return <Redirect href="/" />;
  return <GameView key={id} />;
}

function GameView() {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const { width, height, fontScale } = useWindowDimensions();
  const game = useGame((s) => s.game);
  const setup = useGame((s) => s.setup);
  const selectedThrowId = useGame((s) => s.selectedThrowId);
  const selectedPawnId = useGame((s) => s.selectedPawnId);
  const speedFast = useSettings((s) => s.speed === 'fast');
  const [choice, setChoice] = useState<Extract<TapOutcome, { kind: 'choose' }> | null>(null);
  const [paused, setPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Height left for the board on phones, measured once the banner, status and controls are laid out.
  const [slot, setSlot] = useState<number | null>(null);

  // Bot-only play runs at Fast automatically (R-UX-04).
  const fast = speedFast || (!!game && !humanStillPlaying(game));
  const timing = durations(fast);
  const { callout, motions, motionDone, lastThrow, rolling, winner, celebrating, clearWinner } = useEventFeedback();
  // Bots wait while the winner is being celebrated, and until the shells and pawns are still.
  useBotDriver(game, paused || celebrating, rolling || motions.length > 0, fast);

  useEffect(() => {
    // Go to the results once the game is over and the celebration has been dismissed.
    if (game?.phase === 'finished' && !celebrating) router.replace('/result');
  }, [game?.phase, celebrating, router]);

  if (!game) return <Redirect href="/" />;

  const store = gameStore.getState();
  const seat = game.seats.find((s) => s.id === game.currentSeat)!;
  const human = seat.kind === 'human' && game.phase !== 'finished';
  const canAct = human && !rolling;
  const selection = selectionView(game, selectedThrowId, selectedPawnId);
  // What may be tapped: nothing for bots, or while the shells are still tumbling.
  const view = canAct ? selection : { ...selection, movablePawnIds: [], playableThrowIds: [], preview: null };
  const tablet = width >= TABLET_MIN_WIDTH && width > height;

  const handle = (outcome: TapOutcome) => {
    if (!canAct) return;
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

  // Seat panels grow with large text, up to half again at 150% (R-A11Y-03).
  const sidePanel = Math.round(SIDE_PANEL * (1 + Math.min(0.5, Math.max(0, fontScale - 1))));
  const phoneMax = width - 24;
  const boardSize = tablet
    ? Math.min(height - 2 * sidePanel - 40, width - 2 * sidePanel - 40)
    : Math.min(phoneMax, Math.max(Math.min(phoneMax, MIN_BOARD), slot ?? height * 0.45));
  const board = (
    <View style={styles.center}>
      <Board
        state={game}
        size={boardSize}
        view={view}
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
  const endGameNow = () =>
    Alert.alert(t('game.endNowTitle'), t('game.endNowBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('game.endNowConfirm'), style: 'destructive', onPress: () => store.endNow() },
    ]);
  const endNow = !humanStillPlaying(game) && game.phase !== 'finished' && (
    <Button label={t('game.endNow')} onPress={endGameNow} variant="secondary" />
  );
  const controls = (compact: boolean, header?: ReactNode) => (
    <TurnControls
      game={game}
      seat={seat}
      human={human}
      canAct={canAct}
      view={view}
      lastThrow={lastThrow}
      rollMs={timing.shellsMs}
      rolling={rolling}
      styles={styles}
      onTap={handle}
      compact={compact}
      idleAction={compact ? undefined : endNow}
      header={header}
    />
  );
  const pauseButton = <Button label={t('game.pause')} onPress={() => setPaused(true)} variant="secondary" />;

  /** A seat's side panel on tablets, turned to face that player. */
  const side = (id: Seat['id'], rotate: string, w: number, h: number) => {
    const s = game.seats.find((x) => x.id === id)!;
    const current = s.id === game.currentSeat;
    const status = seatStatus(game, s, t);
    const header = (
      <View accessible accessibilityLabel={status.label}>
        <View style={styles.sideHead}>
          <SeatMark seat={s.id} color={s.color} />
          <Text style={styles.sideName} numberOfLines={1}>
            {s.name}
          </Text>
        </View>
        <Text style={styles.sideStatus}>{[status.homeText, status.ring?.text].filter(Boolean).join(' · ')}</Text>
      </View>
    );
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
            <ScrollView contentContainerStyle={styles.sideContent}>
              {current ? controls(true, header) : <View style={styles.sideInfo}>{header}</View>}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  const menus = (
    <>
      <Celebration seat={game.seats.find((s) => s.id === winner) ?? null} onDone={clearWinner} />
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
      <Modal
        transparent
        visible={paused}
        animationType="fade"
        onRequestClose={() => (confirmRestart ? setConfirmRestart(false) : setPaused(false))}
      >
        <View style={styles.overlay}>
          {confirmRestart ? (
            <View style={styles.sheet}>
              <Title>{t('pause.restartTitle')}</Title>
              <Text style={styles.confirm}>{t('pause.restartBody')}</Text>
              <Button
                label={t('pause.restartConfirm')}
                onPress={() => {
                  if (setup) store.startGame(setup);
                  setConfirmRestart(false);
                  setPaused(false);
                }}
              />
              <Button label={t('common.cancel')} variant="secondary" onPress={() => setConfirmRestart(false)} />
            </View>
          ) : (
            <View style={styles.sheet}>
              <Title>{t('pause.title')}</Title>
              <Button label={t('pause.resume')} onPress={() => setPaused(false)} />
              <Button label={t('pause.restart')} variant="secondary" onPress={() => setConfirmRestart(true)} />
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
          )}
        </View>
      </Modal>
    </>
  );

  if (tablet) {
    const w = boardSize;
    const h = sidePanel;
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
      <ScrollView contentContainerStyle={styles.phone} bounces={false}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <TurnBanner seat={seat} />
          </View>
          {pauseButton}
        </View>
        <SeatStatus game={game} />
        <View
          style={[styles.boardSlot, { minHeight: Math.min(phoneMax, MIN_BOARD) }]}
          onLayout={(e) => setSlot(Math.floor(e.nativeEvent.layout.height))}
        >
          {board}
        </View>
        {controls(false)}
      </ScrollView>
      {menus}
    </SafeAreaView>
  );
}
