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
import { useReduceMotion } from '@/ui/common';
import { textOn } from '@/ui/contrast';
import { PAWN_COLORS, SEAT_SHAPES, useThemedStyles, type Theme } from '@/ui/theme';

import type { TrailMark } from './follow';
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
  /** Bot moves since the human last moved: a numbered badge where each pawn landed, a hollow one where it left. */
  trail?: TrailMark[];
}

const ROWS = [0, 1, 2, 3, 4];
const keyOf = ([r, c]: Square) => r * 5 + c;
const useNative = Platform.OS !== 'web';
const BORDER = 3;
/** The halo round a movable pawn, relative to the pawn; smaller when pawns share a square. */
const HALO = 1.4;
const CROWDED_HALO = 1.2;
const PULSE_MS = 650;

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
    borderColor: c.pawnOutline,
  },
  movable: { borderColor: c.highlight, borderWidth: 3 },
  // Shape and motion, not just colour, mark a movable pawn (R-UX-02).
  halo: {
    position: 'absolute' as const,
    borderWidth: 3,
    borderColor: c.highlight,
    backgroundColor: c.preview,
  },
  waiting: { opacity: 0.7, borderStyle: 'dashed' as const, borderColor: c.boardLine },
  label: { fontWeight: '700' as const },
  badge: {
    position: 'absolute' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: c.pawnOutline,
  },
  badgeFrom: { backgroundColor: c.board, borderStyle: 'dashed' as const, borderWidth: 2 },
  badgeText: { fontWeight: '800' as const },
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
  trail = [],
}: Props) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const cell = (size - 2 * BORDER) / 5;
  const preview = new Set((view.preview ?? []).map(keyOf));
  const movable = new Set(view.movablePawnIds);
  const active = motions[0];
  const [progress] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();
  const anyTappable = movable.size > 0 || view.canEnter;

  useEffect(() => {
    pulse.setValue(0);
    if (!anyTappable || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
        Animated.timing(pulse, { toValue: 0, duration: PULSE_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: useNative }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anyTappable, reduceMotion, pulse]);
  const haloMotion = {
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
  };

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
        const halo = tokenSize * (grid === 1 ? HALO : CROWDED_HALO);

        return (
          <Animated.View
            key={tok.pawn.id}
            style={{ position: 'absolute', left, top, width: tokenSize, height: tokenSize, transform: translate }}
          >
            {tappable && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.halo,
                  {
                    width: halo,
                    height: halo,
                    borderRadius: halo / 2,
                    left: (tokenSize - halo) / 2,
                    top: (tokenSize - halo) / 2,
                  },
                  haloMotion,
                ]}
              />
            )}
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

      {trailBadges(trail, motions).map((b) => {
        const color = PAWN_COLORS[state.seats.find((s) => s.id === b.mark.seat)!.color]!;
        const badge = Math.max(14, cell * 0.24);
        // Along the bottom edge, which a lone pawn or a double leaves clear: landings from the
        // bottom-right corner stepping left, departures from the bottom-left stepping right.
        const step = (b.index % 3) * (badge - 3);
        const left = b.square[1] * cell + (b.end === 'to' ? cell - badge - 1 - step : 1 + step);
        const top = b.square[0] * cell + cell - badge - 1;
        return (
          <View
            key={`${b.end}${b.mark.seat}${b.mark.turn}-${b.mark.n}`}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID={`trail-${b.end}-${b.mark.seat}${b.mark.n}`}
            style={[
              styles.badge,
              { left, top, width: badge, height: badge, borderRadius: badge / 2 },
              b.end === 'to' ? { backgroundColor: color } : [styles.badgeFrom, { borderColor: color }],
            ]}
          >
            <Text style={[styles.badgeText, { fontSize: badge * 0.6, color: b.end === 'to' ? textOn(color) : color }]}>
              {b.mark.n}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One badge per end of each trail move, with its place among the badges in the same corner.
 * A pawn's latest landing badge waits until it has finished moving, so it never runs ahead of it.
 */
function trailBadges(trail: TrailMark[], motions: Motion[]) {
  const moving = new Set(motions.flatMap((m) => m.pawnIds));
  const latest = new Map<string, TrailMark>();
  trail.forEach((mark) => mark.pawnIds.forEach((id) => latest.set(id, mark)));
  const arriving = (mark: TrailMark) => mark.pawnIds.some((id) => moving.has(id) && latest.get(id) === mark);
  const seen = new Map<string, number>();
  const out: { mark: TrailMark; end: 'from' | 'to'; square: Square; index: number }[] = [];
  for (const mark of trail) {
    for (const end of ['from', 'to'] as const) {
      const square = mark[end];
      if (!square || (end === 'to' && arriving(mark))) continue;
      const key = `${end}${keyOf(square)}`;
      const index = seen.get(key) ?? 0;
      seen.set(key, index + 1);
      out.push({ mark, end, square, index });
    }
  }
  return out;
}
