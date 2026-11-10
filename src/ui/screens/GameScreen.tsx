import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { botDelay } from '@/bot';
import { humanStillPlaying, RULE_KEYS, type GameState, type Seat, type SeatId, type Throw } from '@/engine';
import { cuesFor, playCues, playSound, speak, specialThrowSound } from '@/services/feedback';
import { gameStore, settingsStore, useGame, useSettings } from '@/store/app';
import { Button, ConfirmSheet, Title } from '@/ui/common';
import { Board } from '@/ui/game/Board';
import { Celebration } from '@/ui/game/Celebration';
import { botPlan, trailAfter, type TrailMark } from '@/ui/game/follow';
import { MoveChoice, PoolChips, SeatMark, seatStatus, SeatStatus, Shells, TurnBanner } from '@/ui/game/Controls';
import { messageFor, throwPhrase } from '@/ui/game/messages';
import { durations, motionsFor, type Motion } from '@/ui/game/motion';
import { selectionView, tapPawn, tapThrow, tapWaiting, type SelectionView, type TapOutcome } from '@/ui/game/selection';
import { useThemedStyles, type Theme } from '@/ui/theme';

const CALLOUT_MS = 1800;
/** A callout with more waiting behind it gives way sooner. */
const QUEUED_CALLOUT_MS = 1200;
/** Callouts kept waiting at most; older ones are dropped so fast bot turns do not pile up. */
const MAX_CALLOUTS = 3;
/** After the shells settle, a bot waits this much longer before moving, so everyone can read the throw. */
const READ_PAUSE_MS = 900;
/** A throw that ends the turn at once (no legal move) stays up this long after it settles, then the shells reset. */
const THROW_HOLD_MS = 1200;
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
  // Every event callout is shown in turn, so a hit is not hidden by the "inner ring unlocked" after it.
  const [callouts, setCallouts] = useState<{ id: number; text: string }[]>([]);
  const nextCalloutId = useRef(1);
  const [motions, setMotions] = useState<Motion[]>([]);
  // The latest throw, shown until the turn passes; a throw that ends the turn at once (no legal
  // move) is held briefly first. The next player then starts from face-down shells.
  const [lastThrow, setLastThrow] = useState<Throw | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The seat that just finished first, celebrated on screen once its winning move has played.
  const [winner, setWinner] = useState<SeatId | null>(null);
  // True while the shells tumble: the result stays hidden until they settle.
  const [rolling, setRolling] = useState(false);
  const nextMotionId = useRef(1);
  const calloutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The reveal waiting for the shells to settle; a new batch runs it at once instead of dropping it.
  const pendingReveal = useRef<(() => void) | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bot moves since the human last moved, numbered on the board so a run of 8, 8, 4, 2 can be followed.
  const [trail, setTrail] = useState<TrailMark[]>([]);

  useEffect(
    () =>
      gameStore.subscribe(({ events, game }, prev) => {
        if (!game || events.length === 0) return;
        const poolBefore = prev.game?.pool ?? [];
        setTrail((marks) => trailAfter(marks, game, poolBefore));
        const messages = events.map((e) => messageFor(e, game, t));
        const shown = messages.map((m) => m.callout).filter(Boolean);
        const spoken = messages.map((m) => m.announce).filter(Boolean);
        const thrown = events.filter((e) => e.type === 'ThrowResolved').pop();
        if (thrown?.type === 'ThrowResolved') setLastThrow(thrown.throw);
        // Let the shells finish rolling before the result is called out or announced.
        const settings = settingsStore.getState();
        const wait = thrown ? durations(settings.speed === 'fast' || !humanStillPlaying(game)).shellsMs : 0;
        if (thrown && resetTimer.current) clearTimeout(resetTimer.current);
        if (events.some((e) => e.type === 'TurnPassed')) {
          if (resetTimer.current) clearTimeout(resetTimer.current);
          const clear = () => setLastThrow(null);
          if (thrown) resetTimer.current = setTimeout(clear, wait + THROW_HOLD_MS);
          else clear();
        }
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
          if (shown.length > 0) {
            const added = shown.map((text) => ({ id: nextCalloutId.current++, text: text! }));
            setCallouts((queue) => [...queue, ...added].slice(-MAX_CALLOUTS));
          }
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
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const current = callouts[0];
  // Each callout is timed once, from when it appears: one arriving later does not restart it.
  const waiting = useRef(0);
  useEffect(() => {
    waiting.current = callouts.length - 1;
  }, [callouts]);
  const currentId = current?.id;
  useEffect(() => {
    if (currentId === undefined) return;
    const ms = waiting.current > 0 ? QUEUED_CALLOUT_MS : CALLOUT_MS;
    const timer = setTimeout(() => setCallouts((queue) => queue.slice(1)), ms);
    return () => clearTimeout(timer);
  }, [currentId]);
  const callout = current?.text ?? null;

  const motionDone = useCallback((id: number) => setMotions((queue) => queue.filter((m) => m.id !== id)), []);
  const clearWinner = useCallback(() => setWinner(null), []);
  // Bots and the results screen wait from the moment of the win; the overlay waits for the pawns.
  const celebrating = winner !== null;
  const shownWinner = motions.length === 0 ? winner : null;
  return { callout, motions, motionDone, lastThrow, rolling, winner: shownWinner, celebrating, clearWinner, trail };
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
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, padding: 24 },
  sheet: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    maxWidth: 480,
    maxHeight: '100%' as const,
    // A ScrollView grows to fill by default; the sheet should hug its content.
    flexGrow: 0,
    width: '100%' as const,
    alignSelf: 'center' as const,
  },
  sheetScroll: { gap: 10 },
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

/** What the player whose turn it is should do next, while they may act. */
function hintFor(game: GameState, view: SelectionView, canAct: boolean, t: TFunction): string | null {
  if (game.phase !== 'moving' || !canAct) return null;
  if (view.activeThrowId === null) return t('game.pickThrow');
  return view.movablePawnIds.length === 0 && view.canEnter ? t('game.pickEnter') : t('game.pickPawn');
}

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
  /** Tablet side panels: smaller shells and the hint (phones show it in the turn banner). */
  compact?: boolean;
  /** Shown in the throw button's place when nobody human is left to throw (End now). */
  idleAction?: ReactNode;
  /** Compact only: the seat's name and status, shown above the shells. */
  header?: ReactNode;
}

/**
 * Shells, pool chips and the throw button for the player whose turn it is. On phones each part
 * keeps its height whether or not it has anything to show, so the board above stays put.
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
  const selectedPawnId = useGame((s) => s.selectedPawnId);
  const hint = hintFor(game, view, canAct, t);
  const canThrow = human && game.phase === 'throwing' && !rolling;
  const throwNow = () => gameStore.getState().dispatch({ type: 'Throw', seat: seat.id });
  // The shells themselves can be tapped to throw, like picking them up (R-UI-01).
  const shells = (
    <Shells thrown={lastThrow ?? undefined} rollMs={rollMs} size={compact ? 36 : 48} onPress={canThrow ? throwNow : undefined} />
  );
  const chips = game.phase === 'moving' && (
    <PoolChips
      pool={rolling ? game.pool.filter((p) => p.id !== lastThrow?.id) : game.pool}
      playable={view.playableThrowIds}
      active={view.activeThrowId}
      onPress={(id) => onTap(tapThrow(game, id, selectedPawnId))}
    />
  );
  const action =
    human && game.phase === 'throwing' ? (
      <Button
        label={game.pool.length > 0 && !rolling ? t('game.throwAgain') : t('game.throw')}
        size={compact ? 'normal' : 'large'}
        disabled={rolling}
        onPress={throwNow}
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
          {hint && (
            <Text style={styles.sideHint} numberOfLines={2}>
              {hint}
            </Text>
          )}
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
  // Pause asks before a step that loses the game: restarting it, or quitting without saving.
  const [confirm, setConfirm] = useState<'restart' | 'discard' | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Height left for the board on phones, measured once the banner, status and controls are laid out.
  const [slot, setSlot] = useState<number | null>(null);

  // Bot-only play runs at Fast automatically (R-UX-04).
  const fast = speedFast || (!!game && !humanStillPlaying(game));
  const timing = durations(fast);
  const { callout, motions, motionDone, lastThrow, rolling, winner, celebrating, clearWinner, trail } = useEventFeedback();
  // Bots wait while the winner is being celebrated, and until the shells and pawns are still.
  const busy = rolling || motions.length > 0;
  useBotDriver(game, paused || celebrating, busy, fast);
  // While a bot waits to move, its chosen throw and the squares its pawn will cover are shown.
  const plan = useMemo(() => (game && !busy ? botPlan(game) : null), [game, busy]);

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
  const view = canAct
    ? selection
    : {
        ...selection,
        movablePawnIds: [],
        playableThrowIds: plan ? [plan.throwId] : [],
        activeThrowId: plan ? plan.throwId : selection.activeThrowId,
        preview: plan?.squares ?? null,
      };
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
        trail={trail}
      />
      {callout && (
        <View style={styles.callout} pointerEvents="none" accessibilityElementsHidden>
          <Text style={styles.calloutText}>{callout}</Text>
        </View>
      )}
    </View>
  );
  const endGameNow = () => setConfirmEnd(true);
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
        onRequestClose={() => (confirm ? setConfirm(null) : setPaused(false))}
      >
        <View style={styles.overlay}>
          {confirm ? (
            <View style={styles.sheet}>
              <Title>{t(confirm === 'restart' ? 'pause.restartTitle' : 'pause.discardTitle')}</Title>
              <Text style={styles.confirm}>{t(confirm === 'restart' ? 'pause.restartBody' : 'pause.discardBody')}</Text>
              <Button
                label={t(confirm === 'restart' ? 'pause.restartConfirm' : 'pause.discardConfirm')}
                onPress={() => {
                  setConfirm(null);
                  setPaused(false);
                  if (confirm === 'restart') {
                    if (setup) store.startGame(setup);
                    return;
                  }
                  // Delete the save, then leave: Home then offers Play, not Continue.
                  void store.discardSaved();
                  router.replace('/');
                }}
              />
              <Button label={t('common.cancel')} variant="secondary" onPress={() => setConfirm(null)} />
            </View>
          ) : (
            // Scrolls when the rules summary or large text makes it taller than the screen.
            <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetScroll}>
              <Title>{t('pause.title')}</Title>
              <Button label={t('pause.resume')} onPress={() => setPaused(false)} />
              <Button label={t('pause.restart')} variant="secondary" onPress={() => setConfirm('restart')} />
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
              <Button label={t('pause.discard')} variant="secondary" onPress={() => setConfirm('discard')} />
            </ScrollView>
          )}
        </View>
      </Modal>
      <ConfirmSheet
        visible={confirmEnd}
        title={t('game.endNowTitle')}
        body={t('game.endNowBody')}
        confirmLabel={t('game.endNowConfirm')}
        onConfirm={() => {
          setConfirmEnd(false);
          store.endNow();
        }}
        onCancel={() => setConfirmEnd(false)}
      />
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
            <TurnBanner seat={seat} hint={hintFor(game, view, canAct, t)} />
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
