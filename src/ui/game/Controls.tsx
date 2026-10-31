// Smaller game-screen pieces: waiting areas, shells, pool chips, banner, seat panels.
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { GameState, Seat, Throw } from '@/engine';
import { Button } from '@/ui/common';
import { colors, MIN_TOUCH, PAWN_COLORS } from '@/ui/theme';

export function WaitingArea({
  state,
  seat,
  canEnter,
  onPress,
}: {
  state: GameState;
  seat: Seat;
  canEnter: boolean;
  onPress(): void;
}) {
  const { t } = useTranslation();
  const waiting = state.pawns.filter((p) => p.seat === seat.id && p.pathIndex === null).length;
  if (waiting === 0) return null;
  const active = canEnter && seat.id === state.currentSeat;
  return (
    <Pressable
      disabled={!active}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${seat.name}: ${t('game.waiting')} ${waiting}`}
      accessibilityState={{ disabled: !active }}
      style={[styles.waiting, active && styles.waitingActive]}
    >
      <Text style={styles.waitingLabel}>{seat.name}</Text>
      <View style={styles.waitingPawns}>
        {Array.from({ length: waiting }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: PAWN_COLORS[seat.color] }]} />
        ))}
      </View>
    </Pressable>
  );
}

export function Shells({ thrown }: { thrown: Throw | undefined }) {
  const { t } = useTranslation();
  if (!thrown) return <View style={styles.shells} />;
  return (
    <View
      style={styles.shells}
      accessible
      accessibilityLabel={thrown.shells.map((up) => t(up ? 'game.a11y.shellUp' : 'game.a11y.shellDown')).join(', ')}
    >
      {thrown.shells.map((up, i) => (
        <View key={i} style={[styles.shell, up ? styles.shellUp : styles.shellDown]}>
          {up && <View style={styles.slit} />}
        </View>
      ))}
      <Text style={styles.value}>{thrown.value}</Text>
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
  return (
    <View
      style={[styles.banner, { backgroundColor: PAWN_COLORS[seat.color] }]}
      accessibilityRole="header"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.bannerName}>{seat.name}</Text>
      <Text style={styles.bannerTurn}>
        {seat.kind === 'bot' ? t('game.botTurn', { name: seat.name }) : t('game.yourTurn')}
      </Text>
    </View>
  );
}

export function SeatPanels({ state }: { state: GameState }) {
  const { t } = useTranslation();
  return (
    <View style={styles.panels}>
      {state.seats
        .filter((s) => s.kind !== 'empty')
        .map((seat) => {
          const home = state.pawns.filter((p) => p.seat === seat.id && p.pathIndex === 24).length;
          return (
            <View key={seat.id} style={[styles.panel, seat.id === state.currentSeat && styles.panelCurrent]}>
              <View style={[styles.dot, { backgroundColor: PAWN_COLORS[seat.color] }]} />
              <View>
                <Text style={styles.panelName} numberOfLines={1}>
                  {seat.name}
                </Text>
                <Text style={styles.panelInfo}>
                  {t('game.home', { count: home })} · {t(seat.hasHit ? 'game.hasHit' : 'game.noHitYet')}
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

const styles = StyleSheet.create({
  waiting: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
  },
  waitingActive: { borderColor: colors.highlight },
  waitingLabel: { fontSize: 12, color: colors.muted },
  waitingPawns: { flexDirection: 'row', gap: 4, marginTop: 2 },
  dot: { width: 18, height: 18, borderRadius: 9 },
  shells: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  shell: { width: 26, height: 36, borderRadius: 13, borderWidth: 2, borderColor: colors.boardLine, alignItems: 'center' },
  shellUp: { backgroundColor: '#fffaf0', justifyContent: 'center' },
  shellDown: { backgroundColor: '#d8c7a8' },
  slit: { width: 3, height: 24, borderRadius: 2, backgroundColor: colors.boardLine },
  value: { fontSize: 28, fontWeight: '700', color: colors.text, marginLeft: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, minHeight: MIN_TOUCH },
  chip: {
    minWidth: MIN_TOUCH,
    minHeight: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 20, fontWeight: '700', color: colors.accent },
  chipTextActive: { color: colors.onAccent },
  banner: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 12 },
  bannerName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  bannerTurn: { color: '#fff', fontSize: 15 },
  panels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  panelCurrent: { borderColor: colors.accent },
  panelName: { fontWeight: '600', color: colors.text, maxWidth: 120 },
  panelInfo: { fontSize: 12, color: colors.muted },
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 32 },
  sheet: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 12 },
});
