// Smaller game-screen pieces: seat marks, shells, pool chips, turn banner, move choice.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, Platform, Pressable, Text, View } from 'react-native';

import type { Seat, SeatId, Throw } from '@/engine';
import { Button } from '@/ui/common';
import { textOn } from '@/ui/contrast';
import { Cowrie } from '@/ui/game/Cowrie';
import { PAWN_COLORS, SEAT_SHAPES, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  shells: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 52 },
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
