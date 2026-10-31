// Smaller game-screen pieces: waiting areas, shells, pool chips, banner, seat panels.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Platform, Pressable, Text, View } from 'react-native';

import type { GameState, Seat, SeatId, Throw } from '@/engine';
import { Button } from '@/ui/common';
import { textOn } from '@/ui/contrast';
import { Cowrie } from '@/ui/game/Cowrie';
import { MIN_TOUCH, PAWN_COLORS, SEAT_SHAPES, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  shells: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 52 },
  value: { fontSize: 28, fontWeight: '700' as const, color: c.text, marginLeft: 8, minWidth: 24 },
  chips: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8, minHeight: MIN_TOUCH },
  chip: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: 2,
    borderColor: c.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: c.surface,
  },
  chipActive: { backgroundColor: c.accent },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 20, fontWeight: '700' as const, color: c.accent },
  chipTextActive: { color: c.onAccent },
  banner: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  bannerName: { fontSize: 20, fontWeight: '700' as const },
  bannerTurn: { fontSize: 15 },
  panels: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  panel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    padding: 6,
    borderRadius: 8,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  panelCurrent: { borderColor: c.accent },
  panelName: { fontWeight: '600' as const, color: c.text, maxWidth: 140 },
  panelInfo: { fontSize: 12, color: c.muted },
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, padding: 32 },
  sheet: { backgroundColor: c.surface, borderRadius: 16, padding: 16, gap: 12 },
  mark: { alignItems: 'center' as const, justifyContent: 'center' as const },
  markText: { fontSize: 11, fontWeight: '700' as const },
});

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
export function Shells({ thrown, rollMs }: { thrown: Throw | undefined; rollMs: number }) {
  return thrown ? <RollingShells key={thrown.id} thrown={thrown} rollMs={rollMs} /> : <EmptyShells />;
}

function EmptyShells() {
  const { styles } = useThemedStyles(makeStyles);
  return <View style={styles.shells} />;
}

function RollingShells({ thrown, rollMs }: { thrown: Throw; rollMs: number }) {
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
      style={styles.shells}
      accessible
      accessibilityLabel={
        rolling
          ? undefined
          : `${thrown.value}: ${thrown.shells.map((up) => t(up ? 'game.a11y.shellUp' : 'game.a11y.shellDown')).join(', ')}`
      }
    >
      {faces.map((up, i) => (
        <Animated.View key={i} style={rolling ? { transform: [{ rotate }] } : undefined}>
          <Cowrie up={up} size={48} />
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

export function SeatPanels({ state }: { state: GameState }) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.panels}>
      {state.seats
        .filter((s) => s.kind !== 'empty')
        .map((seat) => {
          const home = state.pawns.filter((p) => p.seat === seat.id && p.pathIndex === 24).length;
          return (
            <View key={seat.id} style={[styles.panel, seat.id === state.currentSeat && styles.panelCurrent]}>
              <SeatMark seat={seat.id} color={seat.color} />
              <View>
                <Text style={styles.panelName} numberOfLines={1}>
                  {seat.name}
                </Text>
                <Text style={styles.panelInfo}>
                  {t('game.panelInfo', {
                    home: t('game.home', { count: home }),
                    hit: t(seat.hasHit ? 'game.hasHit' : 'game.noHitYet'),
                  })}
                </Text>
              </View>
            </View>
          );
        })}
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
