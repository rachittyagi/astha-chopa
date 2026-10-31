import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';

import {
  isSafe,
  pathFor,
  ringOf,
  sameSquare,
  SEAT_IDS,
  squareOf,
  type GameState,
  type Pawn,
  type Square,
} from '@/engine';
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

/** One pawn as drawn: every pawn gets its own token, so stacks are easy to count. */
interface Token {
  pawn: Pawn;
  /** Where it is drawn now: its square, or where its pending animation starts. */
  square: Square;
  /** Its place in the little grid of pawns sharing that square. */
  slot: number;
  /** How many pawns share the square (sets the grid size). */
  crowd: number;
  motion?: Motion;
  /** Not yet in play (needChammaOrAshta), shown on its start square. */
  waiting: boolean;
}

/** Side of the grid used for n pawns on one square: 1, 2×2, 3×3 or 4×4. */
const gridFor = (n: number) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);

function tokensFor(state: GameState, motions: Motion[]): Token[] {
  const moving = new Map<string, Motion>();
  motions.forEach((m) => m.pawnIds.forEach((id) => moving.has(id) || moving.set(id, m)));

  const order = (p: Pawn) => SEAT_IDS.indexOf(p.seat) * 10 + (p.pathIndex === null ? 5 : 0) + Number(p.id.slice(1));
  const placed = state.pawns
    .map((pawn) => {
      const motion = moving.get(pawn.id);
      const waiting = pawn.pathIndex === null;
      const square = motion ? motion.from : waiting ? pathFor(pawn.seat)[0]! : squareOf(pawn)!;
      return { pawn, square, motion, waiting };
    })
    .sort((a, b) => order(a.pawn) - order(b.pawn));

  // Pawns waiting to animate are grouped by their motion; the rest by square.
  const groupKey = (p: (typeof placed)[number]) => (p.motion ? `m${p.motion.id}` : `s${keyOf(p.square)}`);
  const groups = new Map<string, typeof placed>();
  placed.forEach((p) => groups.set(groupKey(p), [...(groups.get(groupKey(p)) ?? []), p]));
  return placed.map((p) => {
    const group = groups.get(groupKey(p))!;
    return { ...p, slot: group.indexOf(p), crowd: group.length };
  });
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
  movable: { borderColor: c.highlight, borderWidth: 3 },
  waiting: { opacity: 0.5, borderStyle: 'dashed' as const, borderColor: c.boardLine },
  label: { fontWeight: '700' as const },
});

export function Board({
  state,
  size,
  view,
  onPawnPress,
  onWaitingPress,
  motions = [],
  stepMs = 140,
  knockbackMs = 320,
  onMotionDone,
}: Props) {
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

  const colorOf = (pawn: Pawn) => state.seats.find((s) => s.id === pawn.seat)!.color;

  const pawnLabel = (pawn: Pawn) => {
    const color = t(`colors.${colorOf(pawn)}`);
    const n = Number(pawn.id.slice(1)) + 1;
    if (pawn.pathIndex === null) return t('game.a11y.waitingPawn', { color, n });
    const index = pawn.pathIndex;
    return t('game.a11y.pawn', {
      color,
      n,
      where:
        index === 24
          ? t('game.a11y.atHome')
          : t('game.a11y.square', { index: index + 1, ring: t(`game.ring.${ringOf(index)}`) }),
    });
  };

  /** A double's square is tinted in its owner's colour, so stacks stand out (R-UI-07). */
  const doubleTint = (square: Square) => {
    const d = state.doubles.find((x) => sameSquare(x.square, square));
    if (!d) return undefined;
    const owner = state.seats.find((s) => s.id === d.owner)!;
    return { backgroundColor: `${PAWN_COLORS[owner.color]}55` };
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
                style={[
                  styles.cell,
                  { width: cell, height: cell },
                  doubleTint(square),
                  preview.has(keyOf(square)) && styles.preview,
                ]}
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

      {tokensFor(state, motions).map((tok) => {
        const grid = gridFor(tok.crowd);
        const box = cell / grid;
        const tokenSize = grid === 1 ? cell * 0.62 : box * 0.84;
        const left = tok.square[1] * cell + (tok.slot % grid) * box + box / 2 - tokenSize / 2;
        const top = tok.square[0] * cell + Math.floor(tok.slot / grid) * box + box / 2 - tokenSize / 2;

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

        const canEnter = tok.waiting && view.canEnter && tok.pawn.seat === state.currentSeat;
        const canMove = !tok.motion && !tok.waiting && movable.has(tok.pawn.id);
        const tappable = canEnter || canMove;
        const color = PAWN_COLORS[colorOf(tok.pawn)]!;
        const { shape, symbol } = SEAT_SHAPES[tok.pawn.seat];
        const radius = shape === 'circle' ? tokenSize / 2 : shape === 'rounded' ? tokenSize / 3 : tokenSize * 0.12;
        const turn = shape === 'diamond' ? [{ rotate: '45deg' }] : [];
        const inner = shape === 'diamond' ? tokenSize * 0.78 : tokenSize;

        return (
          <Animated.View
            key={tok.pawn.id}
            style={{ position: 'absolute', left, top, width: tokenSize, height: tokenSize, transform: translate }}
          >
            <Pressable
              disabled={!tappable}
              onPress={() => (canEnter ? onWaitingPress?.() : onPawnPress(tok.pawn.id))}
              accessibilityRole="button"
              accessibilityLabel={pawnLabel(tok.pawn)}
              accessibilityState={{ disabled: !tappable }}
              hitSlop={Math.max(0, (44 - tokenSize) / 2)}
              style={{ width: tokenSize, height: tokenSize, alignItems: 'center', justifyContent: 'center' }}
            >
              <View
                style={[
                  styles.token,
                  { width: inner, height: inner, borderRadius: radius, backgroundColor: color, transform: turn },
                  tok.waiting && styles.waiting,
                  tappable && styles.movable,
                ]}
              />
              <Text style={[styles.label, { color: textOn(color), fontSize: Math.max(9, tokenSize * 0.38) }]}>
                {symbol}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
