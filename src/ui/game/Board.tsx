import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';

import { isSafe, pathFor, ringOf, squareOf, type GameState, type Pawn, type SeatId, type Square } from '@/engine';
import { textOn } from '@/ui/contrast';
import { PAWN_COLORS, SEAT_SHAPES, useThemedStyles, type Theme } from '@/ui/theme';

import type { Motion } from './motion';
import type { SelectionView } from './selection';

interface Props {
  state: GameState;
  size: number;
  view: SelectionView;
  onPawnPress(pawnId: string): void;
  /** Tap on the current player's waiting pawns (drawn on their start square) to enter one. */
  onWaitingPress?(): void;
  /** Queued animations; the first plays now, the rest wait at their starting squares. */
  motions?: Motion[];
  stepMs?: number;
  knockbackMs?: number;
  onMotionDone?(id: number): void;
}

const ROWS = [0, 1, 2, 3, 4];
const keyOf = ([r, c]: Square) => r * 5 + c;
const useNative = Platform.OS !== 'web';
const BORDER = 3;

interface Token {
  key: string;
  seat: SeatId;
  pawns: Pawn[];
  square: Square;
  motion?: Motion;
  /** Pawns not yet in play, shown on their start square (needChammaOrAshta). */
  waiting?: boolean;
}

/** Tokens to draw: pawns grouped by square and seat, with animating pawns drawn on their own. */
function tokensFor(state: GameState, motions: Motion[]): Token[] {
  const moving = new Map<string, Motion>();
  motions.forEach((m) => m.pawnIds.forEach((id) => moving.has(id) || moving.set(id, m)));

  const groups = new Map<string, Token>();
  const loose: Token[] = [];
  for (const pawn of state.pawns) {
    const motion = moving.get(pawn.id);
    if (motion) {
      const key = `m${motion.id}`;
      const existing = loose.find((t) => t.key === key);
      if (existing) existing.pawns.push(pawn);
      else loose.push({ key, seat: pawn.seat, pawns: [pawn], square: motion.from, motion });
      continue;
    }
    const waiting = pawn.pathIndex === null;
    const square = waiting ? pathFor(pawn.seat)[0]! : squareOf(pawn)!;
    const key = waiting ? `w${pawn.seat}` : `${pawn.seat}${keyOf(square)}`;
    const group = groups.get(key) ?? { key, seat: pawn.seat, pawns: [], square, waiting };
    group.pawns.push(pawn);
    groups.set(key, group);
  }
  return [...groups.values(), ...loose];
}

const makeStyles = (c: Theme) => ({
  board: { backgroundColor: c.board, borderWidth: BORDER, borderColor: c.boardLine },
  row: { flexDirection: 'row' as const },
  cell: {
    borderWidth: 1,
    borderColor: c.boardLine,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  preview: { backgroundColor: c.preview },
  cross: { position: 'absolute' as const, height: 2, backgroundColor: c.safeMark, opacity: 0.75 },
  token: {
    position: 'absolute' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#ffffffcc',
  },
  movable: { borderColor: c.highlight, borderWidth: 4 },
  waiting: { opacity: 0.55, borderStyle: 'dashed' as const, borderColor: c.boardLine },
  label: { fontWeight: '700' as const, fontSize: 13 },
});

export function Board({ state, size, view, onPawnPress, onWaitingPress, motions = [], stepMs = 140, knockbackMs = 320, onMotionDone }: Props) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const cell = (size - 2 * BORDER) / 5;
  const preview = new Set((view.preview ?? []).map(keyOf));
  const movable = new Set(view.movablePawnIds);
  const active = motions[0];
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;
    progress.setValue(0);
    const steps = active.path.length;
    const animation = Animated.timing(progress, {
      toValue: steps,
      duration: active.kind === 'knockback' ? knockbackMs : steps * stepMs,
      easing: active.kind === 'knockback' ? Easing.out(Easing.quad) : Easing.linear,
      useNativeDriver: useNative,
    });
    animation.start(({ finished }) => finished && onMotionDone?.(active.id));
    return () => animation.stop();
  }, [active, progress, stepMs, knockbackMs, onMotionDone]);

  const colorOf = (seat: SeatId) => state.seats.find((s) => s.id === seat)!.color;
  const tokens = tokensFor(state, motions);
  const perSquare = new Map<number, Token[]>();
  tokens.forEach((tok) => perSquare.set(keyOf(tok.square), [...(perSquare.get(keyOf(tok.square)) ?? []), tok]));

  const pawnLabel = (pawn: Pawn) => {
    const index = pawn.pathIndex ?? 0;
    return t('game.a11y.pawn', {
      color: t(`colors.${colorOf(pawn.seat)}`),
      n: Number(pawn.id.slice(1)) + 1,
      where:
        pawn.pathIndex === 24
          ? t('game.a11y.atHome')
          : t('game.a11y.square', { index: index + 1, ring: t(`game.ring.${ringOf(index)}`) }),
    });
  };

  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {ROWS.map((r) => (
        <View key={r} style={styles.row}>
          {ROWS.map((c) => {
            const square: Square = [r, c];
            return (
              <View
                key={c}
                style={[styles.cell, { width: cell, height: cell }, preview.has(keyOf(square)) && styles.preview]}
              >
                {isSafe(square) && (
                  <>
                    <View style={[styles.cross, { width: cell * 1.2, transform: [{ rotate: '45deg' }] }]} />
                    <View style={[styles.cross, { width: cell * 1.2, transform: [{ rotate: '-45deg' }] }]} />
                  </>
                )}
              </View>
            );
          })}
        </View>
      ))}

      {tokens.map((tok) => {
        const shared = perSquare.get(keyOf(tok.square)) ?? [tok];
        const slot = shared.indexOf(tok);
        const crowded = shared.length > 1;
        const tokenSize = crowded ? cell * 0.44 : cell * 0.66;
        const slotX = crowded ? (slot % 2) * (cell / 2) + cell / 4 : cell / 2;
        const slotY = crowded ? Math.floor(slot / 2) * (cell / 2) + cell / 4 : cell / 2;
        const left = tok.square[1] * cell + slotX - tokenSize / 2;
        const top = tok.square[0] * cell + slotY - tokenSize / 2;

        const isActive = tok.motion !== undefined && tok.motion === active;
        const points = [tok.square, ...(tok.motion?.path ?? [])];
        const translate = isActive
          ? [
              {
                translateX: progress.interpolate({
                  inputRange: points.map((_, i) => i),
                  outputRange: points.map(([, col]) => (col - tok.square[1]) * cell),
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: points.map((_, i) => i),
                  outputRange: points.map(([row]) => (row - tok.square[0]) * cell),
                }),
              },
            ]
          : [];

        const canEnter = !!tok.waiting && view.canEnter && tok.seat === state.currentSeat;
        const target = tok.motion || tok.waiting ? undefined : tok.pawns.find((p) => movable.has(p.id));
        const tappable = !!target || canEnter;
        const seatName = state.seats.find((s) => s.id === tok.seat)!.name;
        const color = PAWN_COLORS[colorOf(tok.seat)]!;
        const { shape, symbol } = SEAT_SHAPES[tok.seat];
        const radius =
          shape === 'circle' ? tokenSize / 2 : shape === 'rounded' ? tokenSize / 3 : tokenSize * 0.12;
        const turn = shape === 'diamond' ? [{ rotate: '45deg' }] : [];
        const inner = shape === 'diamond' ? tokenSize * 0.8 : tokenSize;

        return (
          <Animated.View
            key={tok.key}
            style={{ position: 'absolute', left, top, width: tokenSize, height: tokenSize, transform: translate }}
          >
            <Pressable
              disabled={!tappable}
              onPress={() => (canEnter ? onWaitingPress?.() : target && onPawnPress(target.id))}
              accessibilityRole="button"
              accessibilityLabel={
                tok.waiting
                  ? t('game.a11y.waitingArea', { name: seatName, count: tok.pawns.length })
                  : pawnLabel(tok.pawns[0]!)
              }
              accessibilityState={{ disabled: !tappable }}
              hitSlop={Math.max(0, (44 - tokenSize) / 2)}
              style={{ width: tokenSize, height: tokenSize, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={[
                  styles.token,
                  {
                    width: inner,
                    height: inner,
                    borderRadius: radius,
                    backgroundColor: color,
                    transform: turn,
                  },
                  tok.waiting && styles.waiting,
                  tappable && styles.movable,
                ]}
              />
              <Text style={[styles.label, { color: textOn(color) }]}>
                {tok.pawns.length > 1 ? tok.pawns.length : symbol}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
