// Smaller game-screen pieces: seat marks, seat status, shells, pool chips, turn banner, move choice.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Platform, Pressable, Text, View } from 'react-native';

import type { GameState, Seat, SeatId, Throw } from '@/engine';
import type { TFunction } from 'i18next';
import { Button } from '@/ui/common';
import { textOn } from '@/ui/contrast';
import { Cowrie } from '@/ui/game/Cowrie';
import { PAWN_COLORS, SEAT_SHAPES, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  shells: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  value: { fontSize: 28, fontWeight: '700' as const, color: c.text, marginLeft: 8, minWidth: 24 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 12, minHeight: 60 },
  chip: {
    minWidth: 60,
    minHeight: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: c.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: c.surface,
  },
  chipActive: { backgroundColor: c.accent },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 26, fontWeight: '800' as const, color: c.accent },
  chipTextActive: { color: c.onAccent },
  banner: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14 },
  bannerName: { fontSize: 24, fontWeight: '800' as const },
  bannerTurn: { fontSize: 18 },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, padding: 32 },
  sheet: { backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 12 },
  mark: { alignItems: 'center' as const, justifyContent: 'center' as const },
  markText: { fontSize: 11, fontWeight: '700' as const },
  status: { flexDirection: 'row' as const, gap: 6 },
  statusCard: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: c.surface,
  },
  statusHead: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  statusName: { flexShrink: 1, color: c.text, fontSize: 14, fontWeight: '700' as const },
  statusLine: { color: c.muted, fontSize: 13 },
  statusLocked: { color: c.text, fontWeight: '700' as const },
});

const PAWNS_PER_SEAT = 4;

/** What a seat has achieved so far: pawns home, and (when the rules gate it) whether its inner ring is open. */
export function seatStatus(game: GameState, seat: Seat, t: TFunction) {
  const home = game.pawns.filter((p) => p.seat === seat.id && p.pathIndex === 24).length;
  const ring =
    game.ruleConfig.noHitBehavior === 'free' ? null : { open: seat.hasHit, text: t(seat.hasHit ? 'game.hasHit' : 'game.noHitYet') };
  const homeText = t('game.home', { count: home, total: PAWNS_PER_SEAT });
  return { homeText, ring, label: [seat.name, homeText, ring?.text].filter(Boolean).join(', ') };
}

/** One card per player in the game: pawns home and inner-ring state, always on screen (phones). */
export function SeatStatus({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.status}>
      {game.seats
        .filter((seat) => seat.kind !== 'empty')
        .map((seat) => {
          const { homeText, ring, label } = seatStatus(game, seat, t);
          const current = seat.id === game.currentSeat;
          return (
            <View
              key={seat.id}
              style={[styles.statusCard, current && { borderColor: PAWN_COLORS[seat.color] }]}
              accessible
              accessibilityLabel={label}
            >
              <View style={styles.statusHead}>
                <SeatMark seat={seat.id} color={seat.color} size={16} />
                <Text style={styles.statusName} numberOfLines={1}>
                  {seat.name}
                </Text>
              </View>
              <Text style={styles.statusLine}>{homeText}</Text>
              {ring && <Text style={[styles.statusLine, !ring.open && styles.statusLocked]}>{ring.text}</Text>}
            </View>
          );
        })}
    </View>
  );
}

/** A seat's pawn in miniature: its colour, shape and symbol (R-UX-02). */
export function SeatMark({ seat, color, size = 18 }: { seat: SeatId; color: string; size?: number }) {
  const { styles } = useThemedStyles(makeStyles);
  const fill = PAWN_COLORS[color]!;
  const { shape, symbol } = SEAT_SHAPES[seat];
  const radius = shape === 'circle' ? size / 2 : shape === 'rounded' ? size / 3 : size * 0.15;
  return (
    <View
      style={[
        styles.mark,
        {
          width: shape === 'diamond' ? size * 0.8 : size,
          height: shape === 'diamond' ? size * 0.8 : size,
          borderRadius: radius,
          backgroundColor: fill,
          transform: shape === 'diamond' ? [{ rotate: '45deg' }] : [],
        },
      ]}
    >
      <Text
        style={[styles.markText, { color: textOn(fill), transform: shape === 'diamond' ? [{ rotate: '-45deg' }] : [] }]}
      >
        {symbol}
      </Text>
    </View>
  );
}

/** The four shells: they tumble for `rollMs`, then show their faces and the value (R-THROW-04, R-UI-01). */
export function Shells({ thrown, rollMs, size = 48 }: { thrown: Throw | undefined; rollMs: number; size?: number }) {
  return thrown ? <RollingShells key={thrown.id} thrown={thrown} rollMs={rollMs} size={size} /> : <EmptyShells size={size} />;
}

function EmptyShells({ size }: { size: number }) {
  const { styles } = useThemedStyles(makeStyles);
  return <View style={[styles.shells, { minHeight: size + 4 }]} />;
}

function RollingShells({ thrown, rollMs, size }: { thrown: Throw; rollMs: number; size: number }) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const [tick, setTick] = useState(0);
  const [rolling, setRolling] = useState(rollMs > 0);
  const [wobble] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (rollMs <= 0) return;
    const spin = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 90, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(wobble, { toValue: -1, duration: 90, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    spin.start();
    const flicker = setInterval(() => setTick((n) => n + 1), 90);
    const done = setTimeout(() => {
      clearInterval(flicker);
      spin.stop();
      wobble.setValue(0);
      setRolling(false);
    }, rollMs);
    return () => {
      clearInterval(flicker);
      clearTimeout(done);
      spin.stop();
    };
  }, [rollMs, wobble]);

  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-25deg', '25deg'] });
  const faces = rolling ? thrown.shells.map((_, i) => (tick + i) % 2 === 0) : thrown.shells;
  return (
    <View
      style={[styles.shells, { minHeight: size + 4 }]}
      accessible
      accessibilityLabel={
        rolling
          ? undefined
          : `${thrown.value}: ${thrown.shells.map((up) => t(up ? 'game.a11y.shellUp' : 'game.a11y.shellDown')).join(', ')}`
      }
    >
      {faces.map((up, i) => (
        <Animated.View key={i} style={rolling ? { transform: [{ rotate }] } : undefined}>
          <Cowrie up={up} size={size} />
        </Animated.View>
      ))}
      <Text style={styles.value}>{rolling ? '' : thrown.value}</Text>
    </View>
  );
}

export function PoolChips({
  pool,
  playable,
  active,
  onPress,
}: {
  pool: Throw[];
  playable: number[];
  active: number | null;
  onPress(id: number): void;
}) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.chips} accessibilityLabel={t('game.pool')}>
      {pool.map((thrown) => {
        const enabled = playable.includes(thrown.id);
        return (
          <Pressable
            key={thrown.id}
            disabled={!enabled}
            onPress={() => onPress(thrown.id)}
            accessibilityRole="button"
            accessibilityLabel={t('game.a11y.chip', { value: thrown.value })}
            accessibilityState={{ selected: active === thrown.id, disabled: !enabled }}
            style={[styles.chip, active === thrown.id && styles.chipActive, !enabled && styles.chipDisabled]}
          >
            <Text style={[styles.chipText, active === thrown.id && styles.chipTextActive]}>{thrown.value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TurnBanner({ seat }: { seat: Seat }) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const fill = PAWN_COLORS[seat.color]!;
  const ink = { color: textOn(fill) };
  return (
    <View style={[styles.banner, { backgroundColor: fill }]} accessibilityRole="header" accessibilityLiveRegion="polite">
      <Text style={[styles.bannerName, ink]}>{seat.name}</Text>
      <Text style={[styles.bannerTurn, ink]}>
        {seat.kind === 'bot' ? t('game.botTurn', { name: seat.name }) : t('game.yourTurn')}
      </Text>
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
      <Pressable style={styles.overlay} onPress={onCancel}>
        <View style={styles.sheet}>
          <Button label={t('game.moveOne')} onPress={onOne} />
          <Button label={t('game.moveBoth')} onPress={onBoth} />
          <Button label={t('common.cancel')} onPress={onCancel} variant="secondary" />
        </View>
      </Pressable>
    </Modal>
  );
}
