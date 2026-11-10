import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { botDelay } from '@/bot';
import { humanStillPlaying, isSafe, RULE_KEYS, sameSquare, squareOf, type GameState, type Seat, type SeatId, type Throw } from '@/engine';
import { cuesFor, playCues, playSound, speak, specialThrowSound } from '@/services/feedback';
import { gameStore, settingsStore, useGame, useSettings } from '@/store/app';
import { Button, ConfirmSheet } from '@/ui/common';
import { Board } from '@/ui/game/Board';
import { Celebration } from '@/ui/game/Celebration';
import { botPlan, trailAfter, type TrailMark } from '@/ui/game/follow';
import { IconButton, MoveChoice, SeatMark, seatStatus, SeatStatus, Tray } from '@/ui/game/Controls';
import { Icon, SeatShape, type IconName } from '@/ui/icons';
import { messageFor, throwPhrase } from '@/ui/game/messages';
import { durations, motionsFor, type Motion } from '@/ui/game/motion';
import { selectionView, tapPawn, tapThrow, tapWaiting, type SelectionView, type TapOutcome } from '@/ui/game/selection';
import { fonts, onPlayer, PAWN_COLORS, radius, shadow, STATE, useThemedStyles, type Theme } from '@/ui/theme';

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
const SIDE_PANEL = 236;
/** The phone board never shrinks below this; past it the screen scrolls instead (R-A11Y-03). */
const MIN_BOARD = 260;

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
  const [callouts, setCallouts] = useState<{ id: number; text: string; seat: SeatId | null }[]>([]);
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
        // Whoever was playing when these events happened: their colour carries the toast.
        const actor = prev.game?.currentSeat ?? game.currentSeat;
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
            const added = shown.map((text) => ({ id: nextCalloutId.current++, text: text!, seat: actor }));
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
  const callout = current ? { text: current.text, seat: current.seat } : null;

  const motionDone = useCallback((id: number) => setMotions((queue) => queue.filter((m) => m.id !== id)), []);
  const clearWinner = useCallback(() => setWinner(null), []);
  // Bots and the results screen wait from the moment of the win; the overlay waits for the pawns.
  const celebrating = winner !== null;
  const shownWinner = motions.length === 0 ? winner : null;
  return { callout, motions, motionDone, lastThrow, rolling, winner: shownWinner, celebrating, clearWinner, trail };
}

const makeStyles = (c: Theme) => ({
  safe: { flex: 1, backgroundColor: c.background },
  phone: { flexGrow: 1, padding: 16, paddingTop: 12, gap: 10, width: '100%' as const, maxWidth: 520, alignSelf: 'center' as const },
  boardSlot: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  topBar: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  flex: { flex: 1 },
  center: { alignItems: 'center' as const, justifyContent: 'center' as const },
  race: { height: 40, borderRadius: 20, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  raceEnd: { position: 'absolute' as const, top: 12, fontSize: 10, lineHeight: 14, letterSpacing: 0.5, fontFamily: fonts.bold, color: '#6B4F38' },
  toastWrap: { position: 'absolute' as const, left: 0, right: 0, bottom: 4, alignItems: 'flex-start' as const },
  toast: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    maxWidth: '100%' as const,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    boxShadow: '0 6px 16px rgba(80,30,10,0.3)',
  },
  toastText: { flexShrink: 1, flexDirection: 'row' as const, flexWrap: 'wrap' as const },
  toastWho: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bold },
  toastBody: { fontSize: 15, lineHeight: 20, fontFamily: fonts.body },
  tail: { marginLeft: 26, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  panel: { borderRadius: radius.xl, backgroundColor: c.surface, borderWidth: 4, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 10 },
  panelHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 40 },
  panelName: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 24, color: c.text },
  panelSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: c.muted },
  pill: { alignSelf: 'flex-start' as const, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 1 },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18 },
  homeCount: { alignItems: 'flex-end' as const },
  homeValue: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 24, color: c.text },
  homeWord: { fontFamily: fonts.body, fontSize: 11, color: c.muted },
  hint: { minHeight: 38, borderRadius: 12, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  hintText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' as const },
  centered: { justifyContent: 'center' as const, padding: 24 },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxWidth: 520,
    maxHeight: '92%' as const,
    flexGrow: 0,
    width: '100%' as const,
    alignSelf: 'center' as const,
    boxShadow: '0 -10px 40px rgba(43,26,14,0.35)',
  },
  card: { backgroundColor: c.surface, borderRadius: radius.sheet, padding: 24, gap: 10, maxWidth: 440, width: '100%' as const, alignSelf: 'center' as const, ...shadow.overlay },
  sheetScroll: { gap: 10 },
  grabber: { alignSelf: 'center' as const, width: 44, height: 5, borderRadius: 3, backgroundColor: '#D9C19A', marginBottom: 8 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: c.accent },
  sheetSub: { fontFamily: fonts.body, fontSize: 14, color: c.muted, marginBottom: 6 },
  divider: { height: 1, backgroundColor: c.line, marginVertical: 4 },
  rule: { color: c.text, fontSize: 14, fontFamily: fonts.body },
  confirm: { color: c.muted, fontSize: 16, lineHeight: 23, fontFamily: fonts.body },
  tablet: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
  column: { alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8 },
  side: { padding: 10, borderRadius: 20, backgroundColor: 'rgba(251,244,230,0.6)', borderWidth: 4, borderColor: 'transparent' },
  sideContent: { flexGrow: 1, gap: 8 },
  tabletCorner: { position: 'absolute' as const, top: 12, right: 12, gap: 8, alignItems: 'flex-end' as const },
});

type Styles = ReturnType<typeof makeStyles>;

type HintKind = 'info' | 'gold' | 'safe' | 'hit' | 'pass';
const HINTS: Record<HintKind, { bg: string; ink: string; icon: IconName }> = {
  info: { bg: STATE.info, ink: STATE.infoInk, icon: 'info' },
  gold: { bg: STATE.gold, ink: STATE.goldInk, icon: 'star' },
  safe: { bg: STATE.safeSurface, ink: STATE.safeInk, icon: 'safe' },
  hit: { bg: STATE.hitSurface, ink: STATE.hitInk, icon: 'hit' },
  pass: { bg: STATE.info, ink: STATE.infoInk, icon: 'arrow' },
};

/** What the player whose turn it is should do next, shown under the tray. */
function hintFor(game: GameState, seat: Seat, view: SelectionView, canAct: boolean, rolling: boolean, t: TFunction): { kind: HintKind; text: string } | null {
  if (game.phase === 'finished') return null;
  if (seat.kind === 'bot') return { kind: 'info', text: t('game.botThinking') };
  if (rolling) return { kind: 'info', text: t('game.tray.throwing') };
  if (game.phase === 'throwing') {
    return game.pool.length > 0 ? { kind: 'gold', text: t('game.hint.banked') } : { kind: 'info', text: t('game.hint.throw') };
  }
  if (!canAct) return null;
  if (view.activeThrowId === null) return { kind: 'info', text: t('game.pickThrow') };
  const landing = view.preview?.[view.preview.length - 1];
  if (landing) {
    if (isSafe(landing)) return { kind: 'safe', text: t('game.hint.safe') };
    const victim = game.pawns.find((p) => p.seat !== game.currentSeat && p.pathIndex !== null && squareOf(p) && sameSquare(squareOf(p)!, landing));
    if (victim) return { kind: 'hit', text: t('game.hint.hit', { name: game.seats.find((s) => s.id === victim.seat)!.name }) };
    return { kind: 'info', text: t('game.hint.move') };
  }
  return { kind: 'info', text: view.movablePawnIds.length === 0 && view.canEnter ? t('game.pickEnter') : t('game.pickPawn') };
}

function Hint({ hint, styles }: { hint: { kind: HintKind; text: string } | null; styles: Styles }) {
  if (!hint) return <View style={styles.hint} />;
  const look = HINTS[hint.kind];
  return (
    <View style={[styles.hint, { backgroundColor: look.bg }]}>
      <Icon name={look.icon} size={18} color={look.ink} />
      <Text style={[styles.hintText, { color: look.ink }]}>{hint.text}</Text>
    </View>
  );
}

/** Lanes on the race strip, so pawns of different seats at the same distance do not cover each other. */
const LANES: Record<SeatId, number> = { A: -8, B: -3, C: 2, D: 7 };

/** How far along every pawn on the board is, from start to home, with a tick where the inner ring begins. */
function RaceStrip({ game, styles }: { game: GameState; styles: Styles }) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const L = 46;
  const R = 44;
  const span = Math.max(0, width - L - R);
  const dots = game.pawns.filter((p) => p.pathIndex !== null);
  return (
    <View
      style={[styles.race, styles.flex]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.raceEnd, { left: 10 }]}>{t('game.race.start').toUpperCase()}</Text>
      <Text style={[styles.raceEnd, { right: 10 }]}>{t('game.race.home').toUpperCase()}</Text>
      <View style={{ position: 'absolute', left: L, width: span, top: 18, height: 2, backgroundColor: '#D9C19A' }} />
      <View style={{ position: 'absolute', left: L + (16 / 24) * span, top: 9, width: 2, height: 20, backgroundColor: '#B58A55' }} />
      {width > 0 &&
        dots.map((p) => {
          const seat = game.seats.find((s) => s.id === p.seat)!;
          return (
            <View key={p.id} style={{ position: 'absolute', left: L + ((p.pathIndex ?? 0) / 24) * span - 6, top: 13 + LANES[p.seat] }}>
              <SeatShape seat={p.seat} size={12} color={PAWN_COLORS[seat.color]!} />
            </View>
          );
        })}
    </View>
  );
}

/** A callout as a speech bubble in the colour of whoever caused it, pointing down at the panel. */
function Toast({ callout, game, styles }: { callout: { text: string; seat: SeatId | null }; game: GameState; styles: Styles }) {
  const seat = game.seats.find((s) => s.id === callout.seat) ?? null;
  const fill = seat ? PAWN_COLORS[seat.color]! : '#2B1A0E';
  const ink = seat ? onPlayer(fill) : '#FFF6E6';
  return (
    <View style={styles.toastWrap} pointerEvents="none" accessibilityElementsHidden>
      <View style={[styles.toast, { backgroundColor: fill }]}>
        {seat && (
          <View style={{ marginTop: 2 }}>
            <SeatShape seat={seat.id} size={16} color={ink} />
          </View>
        )}
        <View style={styles.toastText}>
          {seat && <Text style={[styles.toastWho, { color: ink }]}>{`${seat.name} · `}</Text>}
          <Text style={[styles.toastBody, { color: ink }]}>{callout.text}</Text>
        </View>
      </View>
      <View style={[styles.tail, { borderTopColor: fill }]} />
    </View>
  );
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
  /** The shells are still tumbling: hide the new throw's coin and Throw again. */
  rolling: boolean;
  onTap(outcome: TapOutcome): void;
  /** Shown in the throw button's place when nobody human is left to throw (End now). */
  idleAction?: ReactNode;
}

/** The tray for the player whose turn it is: shells, result, throw button and banked throws. */
function TurnControls({ game, seat, human, canAct, view, lastThrow, rollMs, rolling, onTap, idleAction }: TurnControlsProps) {
  const { t } = useTranslation();
  const selectedPawnId = useGame((s) => s.selectedPawnId);
  const throwing = human && game.phase === 'throwing';
  const canThrow = throwing && !rolling;
  const throwNow = () => gameStore.getState().dispatch({ type: 'Throw', seat: seat.id });
  const big = !!lastThrow && (lastThrow.value === 4 || lastThrow.value === 8);
  // While the shells tumble the new throw's coin stays hidden, so it does not give the result away.
  const pool = rolling ? game.pool.filter((p) => p.id !== lastThrow?.id) : game.pool;
  return (
    <Tray
      thrown={lastThrow ?? undefined}
      rolling={rolling}
      rollMs={rollMs}
      canThrow={canThrow}
      throwLabel={throwing ? (game.pool.length > 0 && !rolling ? t('game.throwAgain') : t('game.throw')) : null}
      throwDisabled={rolling}
      onThrow={throwNow}
      passiveLabel={game.phase === 'moving' && human ? t('game.tray.pick') : null}
      sub={throwing && !rolling ? (big && game.pool.length > 0 ? t('game.tray.bigSub') : game.pool.length === 0 ? t('game.tray.idleSub') : null) : null}
      pool={pool}
      playable={game.phase === 'moving' ? view.playableThrowIds : []}
      active={game.phase === 'moving' ? view.activeThrowId : null}
      onCoin={(id) => canAct && onTap(tapThrow(game, id, selectedPawnId))}
      action={idleAction}
    />
  );
}

/** The docked panel of the player whose turn it is: larger, with a thick border in their colour. */
function ActivePanel({ game, seat, children, styles }: { game: GameState; seat: Seat; children: ReactNode; styles: Styles }) {
  const { t } = useTranslation();
  const fill = PAWN_COLORS[seat.color]!;
  const status = seatStatus(game, seat, t);
  const who =
    seat.kind === 'bot'
      ? t('game.seatBot', { level: t(`setup.level.${seat.botLevel ?? 'medium'}`), side: t(`setup.seat.${seat.id}`) })
      : t('game.seatHuman', { side: t(`setup.seat.${seat.id}`) });
  return (
    <View style={[styles.panel, { borderColor: fill, boxShadow: `0 0 0 5px ${fill}22, 0 10px 26px rgba(122,62,18,0.25)` }]}>
      <View style={styles.panelHead} accessible accessibilityLabel={status.label}>
        <SeatMark seat={seat.id} color={seat.color} size={38} />
        <View style={styles.flex}>
          <Text style={styles.panelName} numberOfLines={1}>
            {seat.name}
          </Text>
          <Text style={styles.panelSub} numberOfLines={1}>
            {[who, status.ring?.text].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {seat.kind === 'human' && game.phase !== 'finished' && (
          <View style={[styles.pill, { backgroundColor: fill }]}>
            <Text style={[styles.pillText, { color: onPlayer(fill) }]}>{t('game.yourTurn')}</Text>
          </View>
        )}
        <View style={styles.homeCount}>
          <Text style={styles.homeValue}>{`${status.home}/4`}</Text>
          <Text style={styles.homeWord}>{t('game.homeWord')}</Text>
        </View>
      </View>
      {children}
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
  const sound = useSettings((s) => s.sound);
  const [choice, setChoice] = useState<Extract<TapOutcome, { kind: 'choose' }> | null>(null);
  const [paused, setPaused] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // Pause asks before a step that loses the game: restarting it, or quitting without saving.
  const [confirm, setConfirm] = useState<'restart' | 'discard' | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Height left for the board on phones, measured once the chips, strip and panel are laid out.
  const [slot, setSlot] = useState<{ w: number; h: number } | null>(null);

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
        canEnter: false,
        playableThrowIds: plan ? [plan.throwId] : [],
        activeThrowId: plan ? plan.throwId : selection.activeThrowId,
        preview: plan?.squares ?? null,
      };
  const tablet = width >= TABLET_MIN_WIDTH && width > height;
  const activeColor = game.phase === 'finished' ? undefined : PAWN_COLORS[seat.color];

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
  const phoneMax = Math.min(width - 32, 488);
  const boardSize = tablet
    ? Math.min(height - 2 * sidePanel - 40, width - 2 * sidePanel - 40)
    : Math.min(phoneMax, Math.max(Math.min(phoneMax, MIN_BOARD), slot ? Math.min(slot.h, slot.w) : height * 0.42));
  const hint = hintFor(game, seat, view, canAct, rolling, t);
  const board = (
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
      activeColor={activeColor}
    />
  );
  const endGameNow = () => setConfirmEnd(true);
  const endNow = !humanStillPlaying(game) && game.phase !== 'finished' && (
    <Button label={t('game.endNow')} onPress={endGameNow} variant="secondary" />
  );
  const controls = (
    <TurnControls
      game={game}
      seat={seat}
      human={human}
      canAct={canAct}
      view={view}
      lastThrow={lastThrow}
      rollMs={timing.shellsMs}
      rolling={rolling}
      onTap={handle}
      idleAction={tablet || !endNow ? undefined : endNow}
    />
  );
  const pauseButton = <IconButton icon="pause" label={t('game.pause')} onPress={() => setPaused(true)} />;
  const soundButton = (
    <IconButton
      icon={sound ? 'sound' : 'muted'}
      label={t(sound ? 'game.mute' : 'game.unmute')}
      onPress={() => settingsStore.getState().update({ sound: !sound })}
    />
  );

  /** A seat's side panel on tablets, turned to face that player. */
  const side = (id: Seat['id'], rotate: string, w: number, h: number) => {
    const s = game.seats.find((x) => x.id === id)!;
    const current = s.id === game.currentSeat;
    const status = seatStatus(game, s, t);
    const vertical = rotate === '90deg' || rotate === '-90deg';
    const fill = PAWN_COLORS[s.color]!;
    return (
      <View style={{ width: vertical ? h : w, height: vertical ? w : h }}>
        {s.kind !== 'empty' && (
          <View
            style={[
              styles.side,
              current && { backgroundColor: '#FBF4E6', borderColor: fill, boxShadow: `0 0 0 5px ${fill}22, 0 10px 26px rgba(122,62,18,0.25)` },
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
              <View style={styles.panelHead} accessible accessibilityLabel={status.label}>
                <SeatMark seat={s.id} color={s.color} size={34} dim={!current} />
                <View style={styles.flex}>
                  <Text style={styles.panelName} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text style={styles.panelSub} numberOfLines={1}>
                    {[status.homeText, status.ring?.text].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {current && s.kind === 'human' && (
                  <View style={[styles.pill, { backgroundColor: fill }]}>
                    <Text style={[styles.pillText, { color: onPlayer(fill) }]}>{t('game.yourTurn')}</Text>
                  </View>
                )}
              </View>
              {current && controls}
              {current && <Hint hint={hint} styles={styles} />}
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
        <View style={[styles.overlay, confirm && styles.centered]}>
          {confirm ? (
            <View style={styles.card}>
              <Text style={styles.sheetTitle} accessibilityRole="header">
                {t(confirm === 'restart' ? 'pause.restartTitle' : 'pause.discardTitle')}
              </Text>
              <Text style={styles.confirm}>{t(confirm === 'restart' ? 'pause.restartBody' : 'pause.discardBody')}</Text>
              <Button
                label={t(confirm === 'restart' ? 'pause.restartConfirm' : 'pause.discardConfirm')}
                variant={confirm === 'discard' ? 'danger' : 'primary'}
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
            <>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setPaused(false)} accessible={false} />
              {/* A bottom sheet; it scrolls when the rules summary or large text makes it taller than the screen. */}
              <ScrollView style={styles.sheet} contentContainerStyle={styles.sheetScroll}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle} accessibilityRole="header">
                  {t('pause.title')}
                </Text>
                <Text style={styles.sheetSub}>{t('pause.saved')}</Text>
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
                <View style={styles.divider} />
                <Button label={t('pause.discard')} variant="danger" onPress={() => setConfirm('discard')} />
              </ScrollView>
            </>
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
            <View style={styles.center}>
              {board}
              {callout && (
                <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
                  <Toast callout={callout} game={game} styles={styles} />
                </View>
              )}
            </View>
            {side('A', '0deg', w, h)}
          </View>
          {side('B', '-90deg', w, h)}
        </View>
        <View style={styles.tabletCorner}>
          <View style={styles.topBar}>
            {pauseButton}
            {soundButton}
          </View>
          {endNow}
        </View>
        {menus}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.phone} bounces={false}>
        <SeatStatus game={game} exclude={seat.id} />
        <View style={styles.topBar}>
          <RaceStrip game={game} styles={styles} />
          {pauseButton}
          {soundButton}
        </View>
        <View
          style={[styles.boardSlot, { minHeight: Math.min(phoneMax, MIN_BOARD) }]}
          onLayout={(e) => setSlot({ w: Math.floor(e.nativeEvent.layout.width), h: Math.floor(e.nativeEvent.layout.height) })}
        >
          {board}
          {callout && <Toast callout={callout} game={game} styles={styles} />}
        </View>
        <ActivePanel game={game} seat={seat} styles={styles}>
          {controls}
          <Hint hint={hint} styles={styles} />
        </ActivePanel>
      </ScrollView>
      {menus}
    </SafeAreaView>
  );
}
