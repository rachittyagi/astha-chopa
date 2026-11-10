// Smaller game-screen pieces: seat marks and chips, the cowrie tray, the move choice.
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameState, Seat, SeatId, Throw } from '@/engine';
import type { TFunction } from 'i18next';
import { Button, useReduceMotion } from '@/ui/common';
import { Cowrie } from '@/ui/game/Cowrie';
import { Icon, SeatShape } from '@/ui/icons';
import { fonts, onPlayer, PAWN_COLORS, radius, shadow, TAP, TRAY, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, padding: 24 },
  sheet: { backgroundColor: c.surface, borderRadius: radius.sheet, padding: 24, gap: 10, maxWidth: 440, width: '100%' as const, alignSelf: 'center' as const, ...shadow.overlay },
  sheetTitle: { color: c.accent, fontSize: 28, lineHeight: 32, fontFamily: fonts.display },
  sheetBody: { color: c.muted, fontSize: 16, lineHeight: 23, fontFamily: fonts.body, marginBottom: 4 },
  status: { flexDirection: 'row' as const, gap: 8 },
  chip: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(251,244,230,0.6)',
  },
  chipText: { flex: 1, minWidth: 0 },
  chipName: { color: '#3E2A1A', fontSize: 13, lineHeight: 16, fontFamily: fonts.semibold },
  chipLine: { color: c.muted, fontSize: 11, lineHeight: 14, fontFamily: fonts.body },
  chipLocked: { color: c.text, fontFamily: fonts.semibold },
  // The tray.
  tray: {
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: TRAY.wood,
    borderTopWidth: 2,
    borderTopColor: TRAY.woodTop,
    boxShadow: `inset 0 -3px 0 rgba(0,0,0,0.2), 0 4px 0 ${TRAY.woodEdge}, 0 8px 16px rgba(60,25,5,0.3)`,
  },
  trayRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, minHeight: 84 },
  well: {
    zIndex: 1,
    width: 112,
    height: 84,
    borderRadius: 42,
    backgroundColor: TRAY.cloth,
    boxShadow: 'inset 0 5px 12px rgba(0,0,0,0.55), inset 0 -2px 0 rgba(255,255,255,0.08), 0 1px 0 rgba(255,255,255,0.2)',
  },
  result: { width: 66, alignItems: 'center' as const, gap: 2 },
  disc: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: c.surface,
    boxShadow: 'inset 0 -3px 0 #D9C19A, 0 2px 4px rgba(0,0,0,0.3)',
  },
  discEmpty: { backgroundColor: 'rgba(251,244,230,0.18)', borderWidth: 2, borderStyle: 'dashed' as const, borderColor: 'rgba(251,244,230,0.5)', boxShadow: 'none' },
  discBig: { backgroundColor: '#F7CF6A', boxShadow: '0 0 0 3px #FFF6D6, 0 0 18px 6px rgba(242,182,50,0.6)' },
  discText: { fontFamily: fonts.display, fontSize: 36, lineHeight: 44, color: c.accent, paddingTop: 4 },
  discTextEmpty: { color: TRAY.onWoodMuted, fontSize: 30 },
  discTextBig: { color: c.accentEdge },
  caption: { height: 14, fontFamily: fonts.display, fontSize: 12, lineHeight: 14, letterSpacing: 0.7, color: '#FFE7A8' },
  action: { flex: 1, minWidth: 0, gap: 6 },
  throwButton: {
    minHeight: 60,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
    backgroundColor: TRAY.button,
    boxShadow: `0 4px 0 ${TRAY.buttonEdge}, 0 6px 10px rgba(0,0,0,0.3)`,
    marginBottom: 4,
  },
  throwPressed: { transform: [{ translateY: 3 }], boxShadow: `0 1px 0 ${TRAY.buttonEdge}, inset 0 2px 4px rgba(0,0,0,0.2)` },
  throwDisabled: { opacity: 0.55 },
  passive: {
    minHeight: 60,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: 'rgba(251,244,230,0.45)',
    backgroundColor: 'rgba(43,20,5,0.25)',
  },
  throwText: { fontFamily: fonts.bold, fontSize: 17, color: c.accentEdge, textAlign: 'center' as const },
  passiveText: { color: '#F6E3C6' },
  sub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 15, color: '#F6E3C6', textAlign: 'center' as const },
  banked: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 40, marginTop: 4, paddingHorizontal: 4, flexWrap: 'wrap' as const },
  bankedLabel: { width: 56, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.9, color: TRAY.onWood },
  bankedEmpty: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: TRAY.onWoodMuted },
  coin: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: TRAY.brass,
    borderWidth: 1.5,
    borderColor: '#FFF1C4',
    boxShadow: '0 2px 0 #6E4A10, 0 3px 5px rgba(0,0,0,0.3)',
  },
  coinActive: {
    transform: [{ translateY: -5 }, { scale: 1.12 }],
    boxShadow: `0 0 0 2.5px ${TAP.inner}, 0 0 0 5px ${TAP.gold}, 0 0 14px 6px ${TAP.glow}, 0 8px 8px rgba(0,0,0,0.3)`,
  },
  coinDisabled: { opacity: 0.35 },
  coinText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: c.accentEdge, paddingTop: 2 },
});

const PAWNS_PER_SEAT = 4;

/** Where each shell rests in the cloth well (left, top, turn). */
const REST: [number, number, number][] = [
  [6, 8, -12],
  [60, 6, 10],
  [4, 44, 8],
  [60, 44, -6],
];

/**
 * Each shell's toss: how far it drifts sideways and rises at the top of its arc, and how far it
 * spins (whole turns, so it lands at its resting angle). Heights follow the design's tumble frame.
 */
const TOSS = [
  { dx: -12, dy: -66, spin: -360 },
  { dx: -16, dy: -92, spin: 360 },
  { dx: 18, dy: -94, spin: 720 },
  { dx: 16, dy: -78, spin: -720 },
];
/** When each shell lands, as a share of the throw's time: one by one, the last as the number shows. */
const landsAt = (i: number) => 0.72 + (0.28 * i) / (TOSS.length - 1);
/** Where in its flight a shell is highest. */
const PEAK = 0.45;
/** Height through the flight (share of the peak): up fast, a hang at the top, down, and a little bounce. */
const ARC: [number, number][] = [
  [0, 0],
  [0.15, 0.62],
  [0.3, 0.93],
  [PEAK, 1],
  [0.6, 0.9],
  [0.75, 0.58],
  [0.88, 0],
  [0.94, 0.07],
  [1, 0],
];
/** Squash as the shell turns over in the air, so it reads as flipping. */
const FLIP: [number, number][] = [
  [0, 1],
  [0.12, 0.45],
  [0.25, 1],
  [0.38, 0.35],
  [0.52, 1],
  [0.66, 0.5],
  [0.8, 1],
  [1, 1],
];
/** How often an airborne shell shows its other face. */
const FLICKER_MS = 90;

/** What a seat has achieved so far: pawns home, and (when the rules gate it) whether its inner ring is open. */
export function seatStatus(game: GameState, seat: Seat, t: TFunction) {
  const home = game.pawns.filter((p) => p.seat === seat.id && p.pathIndex === 24).length;
  const ring =
    game.ruleConfig.noHitBehavior === 'free' ? null : { open: seat.hasHit, text: t(seat.hasHit ? 'game.hasHit' : 'game.noHitYet') };
  const homeText = t('game.home', { count: home, total: PAWNS_PER_SEAT });
  return { home, homeText, ring, label: [seat.name, homeText, ring?.text].filter(Boolean).join(', ') };
}

/** The other players, as small dimmed chips above the board (phones). */
export function SeatStatus({ game, exclude }: { game: GameState; exclude?: SeatId }) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.status}>
      {game.seats
        .filter((seat) => seat.kind !== 'empty' && seat.id !== exclude)
        .map((seat) => {
          const { homeText, ring, label } = seatStatus(game, seat, t);
          return (
            <View key={seat.id} style={styles.chip} accessible accessibilityLabel={label}>
              <SeatMark seat={seat.id} color={seat.color} size={28} dim />
              <View style={styles.chipText}>
                <Text style={styles.chipName} numberOfLines={1}>
                  {seat.kind === 'bot' ? `${seat.name} · CPU` : seat.name}
                </Text>
                <Text style={styles.chipLine} numberOfLines={1}>
                  {homeText}
                </Text>
                {ring && (
                  <Text style={[styles.chipLine, !ring.open && styles.chipLocked]} numberOfLines={1}>
                    {ring.text}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
    </View>
  );
}

/** A seat's avatar: a disc in its colour with its shape on top (R-UX-02). */
export function SeatMark({ seat, color, size = 18, dim = false }: { seat: SeatId; color: string; size?: number; dim?: boolean }) {
  const fill = PAWN_COLORS[color]!;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: fill,
        opacity: dim ? 0.6 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: size >= 32 ? 'inset 0 -3px 0 rgba(0,0,0,0.2)' : undefined,
      }}
    >
      <SeatShape seat={seat} size={size * 0.56} color={onPlayer(fill)} />
    </View>
  );
}

/** The four shells in the cloth well: they tumble for `rollMs`, then show their faces (R-THROW-04, R-UI-01). */
function Well({ thrown, rollMs }: { thrown: Throw | undefined; rollMs: number }) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  // With less motion asked for, the shells rest face down while the throw is decided, then turn over.
  const reduceMotion = useReduceMotion();
  const tossing = !!thrown && rollMs > 0;
  const [elapsed, setElapsed] = useState(0);
  const [rolling, setRolling] = useState(tossing);
  // One clock per shell: 0 as it leaves the cloth, 1 when it lands back in its place.
  const [flight] = useState(() => TOSS.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (!tossing) return;
    if (reduceMotion) {
      const done = setTimeout(() => setRolling(false), rollMs);
      return () => clearTimeout(done);
    }
    // All four leave together and land one by one; the last lands as the number shows.
    const toss = Animated.parallel(
      flight.map((value, i) =>
        Animated.timing(value, {
          toValue: 1,
          duration: rollMs * landsAt(i),
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ),
    );
    toss.start();
    const started = Date.now();
    const clock = setInterval(() => setElapsed(Date.now() - started), FLICKER_MS);
    const done = setTimeout(() => {
      clearInterval(clock);
      setRolling(false);
    }, rollMs);
    return () => {
      toss.stop();
      clearInterval(clock);
      clearTimeout(done);
    };
  }, [tossing, rollMs, flight, reduceMotion]);

  const settled = !!thrown && !rolling;
  return (
    <View
      style={styles.well}
      accessible={settled}
      accessibilityLabel={
        settled ? `${thrown.value}: ${thrown.shells.map((up) => t(up ? 'game.a11y.shellUp' : 'game.a11y.shellDown')).join(', ')}` : undefined
      }
      importantForAccessibility={settled ? 'yes' : 'no-hide-descendants'}
    >
      {REST.map(([left, top, turn], i) => {
        const toss = TOSS[i]!;
        const airborne = tossing && rolling && !reduceMotion && elapsed < rollMs * landsAt(i);
        // In the air a shell shows whichever face is turned up as it spins; once landed, its real face.
        const up = !thrown ? false : airborne ? Math.floor(elapsed / FLICKER_MS + i) % 2 === 0 : rolling && reduceMotion ? false : thrown.shells[i]!;
        const v = flight[i]!;
        const motion =
          tossing && !reduceMotion
            ? [
                { translateX: v.interpolate({ inputRange: [0, PEAK, 1], outputRange: [0, toss.dx, 0] }) },
                { translateY: v.interpolate({ inputRange: ARC.map(([x]) => x), outputRange: ARC.map(([, y]) => y * toss.dy) }) },
                { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${toss.spin}deg`] }) },
                { scaleY: v.interpolate({ inputRange: FLIP.map(([x]) => x), outputRange: FLIP.map(([, y]) => y) }) },
              ]
            : [];
        return (
          <View key={i} style={{ position: 'absolute', left, top }}>
            {/* Its shadow on the cloth: small and faint while the shell is high. */}
            {tossing && !reduceMotion && (
              <Animated.View
                style={{
                  position: 'absolute',
                  left: 6,
                  top: 18,
                  width: 34,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: 'rgba(30,5,5,0.45)',
                  opacity: v.interpolate({ inputRange: [0, PEAK, 1], outputRange: [0.6, 0.15, 0.6] }),
                  transform: [{ scale: v.interpolate({ inputRange: [0, PEAK, 1], outputRange: [1, 0.5, 1] }) }],
                }}
              />
            )}
            <Animated.View style={{ transform: [{ rotate: `${turn}deg` }, ...motion] }}>
              <Cowrie up={up} size={46} glow={settled && up} />
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The cowrie tray: the cloth well with the shells, the result disc, the throw button and the
 * banked throws. `action` is shown in the button's place when it is not this player's throw.
 */
export function Tray({
  thrown,
  rolling,
  rollMs,
  canThrow,
  throwLabel,
  throwDisabled,
  onThrow,
  passiveLabel,
  sub,
  pool,
  playable,
  active,
  onCoin,
  action,
}: {
  thrown: Throw | undefined;
  rolling: boolean;
  rollMs: number;
  /** The shells themselves can be tapped to throw (R-UI-01). */
  canThrow: boolean;
  /** Null hides the button (another player's turn, or the moving phase). */
  throwLabel: string | null;
  throwDisabled: boolean;
  onThrow(): void;
  /** The quiet label in the button's place while pawns are being moved. */
  passiveLabel?: string | null;
  sub?: string | null;
  pool: Throw[];
  playable: number[];
  active: number | null;
  onCoin(id: number): void;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const value = thrown && !rolling ? thrown.value : null;
  const big = value === 4 || value === 8;
  return (
    <View style={styles.tray}>
      <View style={styles.trayRow}>
        {/* Always wrapped, so the shells are not remounted (and rolled again) when they become tappable;
            each new throw remounts them, so it rolls from the start. */}
        <Pressable onPress={onThrow} disabled={!canThrow} accessible={false} testID="shells">
          <Well key={thrown?.id ?? 'none'} thrown={thrown} rollMs={rollMs} />
        </Pressable>
        <View style={styles.result} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.disc, value === null && styles.discEmpty, big && styles.discBig]}>
            <Text style={[styles.discText, value === null && styles.discTextEmpty, big && styles.discTextBig]}>
              {value ?? (rolling ? '…' : '–')}
            </Text>
          </View>
          <Text style={styles.caption}>{value === 4 ? t('game.tray.chamma') : value === 8 ? t('game.tray.ashta') : ''}</Text>
        </View>
        <View style={styles.action}>
          {throwLabel !== null ? (
            <Pressable
              onPress={onThrow}
              disabled={throwDisabled}
              accessibilityRole="button"
              accessibilityLabel={throwLabel}
              accessibilityState={{ disabled: throwDisabled }}
              style={({ pressed }) => [styles.throwButton, pressed && styles.throwPressed, throwDisabled && styles.throwDisabled]}
            >
              <Text style={styles.throwText} numberOfLines={1} adjustsFontSizeToFit>
                {throwLabel}
              </Text>
            </Pressable>
          ) : (
            (action ??
            (passiveLabel ? (
              <View style={styles.passive}>
                <Text style={[styles.throwText, styles.passiveText]} numberOfLines={1} adjustsFontSizeToFit>
                  {passiveLabel}
                </Text>
              </View>
            ) : null))
          )}
          {sub && <Text style={styles.sub}>{sub}</Text>}
        </View>
      </View>
      <View style={styles.banked} accessibilityLabel={t('game.pool')}>
        <Text style={styles.bankedLabel} importantForAccessibility="no" accessibilityElementsHidden>
          {t('game.banked').toUpperCase()}
        </Text>
        {pool.length === 0 && <Text style={styles.bankedEmpty}>{t('game.bankedEmpty')}</Text>}
        {pool.map((p) => {
          const enabled = playable.includes(p.id);
          return (
            <Pressable
              key={p.id}
              disabled={!enabled}
              onPress={() => onCoin(p.id)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('game.a11y.chip', { value: p.value })}
              accessibilityState={{ selected: active === p.id, disabled: !enabled }}
              style={[styles.coin, active === p.id && styles.coinActive, !enabled && styles.coinDisabled]}
            >
              <Text style={styles.coinText}>{p.value}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MoveChoice({
  visible,
  onOne,
  onBoth,
  onCancel,
}: {
  visible: boolean;
  onOne(): void;
  onBoth(): void;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        {/* The dimmed backdrop cancels; the sheet sits above it, so taps on its text do not. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessible={false} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {t('game.doubleTitle')}
          </Text>
          <Text style={styles.sheetBody}>{t('game.doubleBody')}</Text>
          <Button label={t('game.moveOne')} onPress={onOne} />
          <Button label={t('game.moveBoth')} onPress={onBoth} variant="secondary" />
          <Button label={t('common.cancel')} onPress={onCancel} variant="ghost" />
        </View>
      </View>
    </Modal>
  );
}

/** A small round icon button (pause, sound) docked beside the board. */
export function IconButton({ icon, label, onPress }: { icon: 'pause' | 'sound' | 'muted'; label: string; onPress(): void }) {
  const { theme } = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: theme.surface,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 0 1px ${theme.line}, 0 3px 8px rgba(122,62,18,0.15)`,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={20} color={theme.accent} strokeWidth={icon === 'pause' ? 2.4 : 2} />
    </Pressable>
  );
}
