import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import {
  isSafe,
  pathFor,
  ringOf,
  sameSquare,
  SEAT_IDS,
  squareOf,
  type GameState,
  type Pawn,
  type SeatId,
  type Square,
} from '@/engine';
import { useReduceMotion } from '@/ui/common';
import { Icon } from '@/ui/icons';
import { textOn } from '@/ui/contrast';
import { fonts, mix, onPlayer, PAWN_COLORS, SEAT_SHAPES, STATE, TAP, useTheme, type Theme } from '@/ui/theme';

import type { TrailMark } from './follow';
import type { Motion } from './motion';
import type { SelectionView } from './selection';

interface Props {
  state: GameState;
  size: number;
  view: SelectionView;
  onPawnPress(pawnId: string): void;
  /** Tap on the current player's waiting pawns (in their nest at the board's edge) to enter one. */
  onWaitingPress?(): void;
  /** Queued animations; the first plays now, the rest wait at their starting squares. */
  motions?: Motion[];
  stepMs?: number;
  knockbackMs?: number;
  onMotionDone?(id: number): void;
  /** Bot moves since the human last moved: a numbered badge where each pawn landed, a hollow one where it left. */
  trail?: TrailMark[];
  /** The seat whose turn it is: the frame glows in its colour. Leave out for a still picture. */
  activeColor?: string;
}

const ROWS = [0, 1, 2, 3, 4];
const keyOf = ([r, c]: Square) => r * 5 + c;
const useNative = Platform.OS !== 'web';
/** The frame round the squares, as a share of the board; the nests sit in it. */
const FRAME = 0.08;
const PULSE_MS = 650;
/** White inner ring, gold ring and the theme's outer edge, in points. */
const RING = { white: 2.5, gold: 3, edge: 1.5 };

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
}

/** Side of the grid used for n pawns on one square: 1, 2×2, 3×3 or 4×4. */
const gridFor = (n: number) => (n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4);

function tokensFor(state: GameState, motions: Motion[]): Token[] {
  const moving = new Map<string, Motion>();
  motions.forEach((m) => m.pawnIds.forEach((id) => moving.has(id) || moving.set(id, m)));

  const order = (p: Pawn) => SEAT_IDS.indexOf(p.seat) * 10 + Number(p.id.slice(1));
  const placed = state.pawns
    .flatMap((pawn) => {
      const motion = moving.get(pawn.id);
      // Waiting pawns sit in their nest, unless an animation is about to bring them on.
      if (pawn.pathIndex === null && !motion) return [];
      const square = motion ? motion.from : squareOf(pawn)!;
      return [{ pawn, square, motion }];
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

/** A glossy wooden pawn: a domed disc in the seat's colour with the seat's shape carved on top. */
function PawnBody({ seat, color, size, outline }: { seat: SeatId; color: string; size: number; outline: string }) {
  const id = `pawn-${color.slice(1)}`;
  const carve = onPlayer(color) === '#FFFFFF' ? '#FFF1DE' : '#3B1D08';
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 24 26.4">
      <Defs>
        <RadialGradient id={id} cx="34%" cy="28%" r="75%">
          <Stop offset="0" stopColor={mix(color, '#FFFFFF', 0.5)} />
          <Stop offset="0.48" stopColor={color} />
          <Stop offset="1" stopColor={mix(color, '#000000', 0.3)} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={12} cy={15.2} rx={11} ry={10.6} fill="rgba(30,12,2,0.35)" />
      <Circle cx={12} cy={13.6} r={11} fill={mix(color, '#000000', 0.42)} />
      <Circle cx={12} cy={12} r={11} fill={`url(#${id})`} stroke={outline} strokeWidth={0.9} />
      <G transform="translate(5.3 5.3) scale(0.56)">
        <Path d={SEAT_SHAPES[seat].path} fill={carve} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
      </G>
    </Svg>
  );
}

/** The ring that says "you can tap this": white, gold and a glow, with the theme's edge outside. */
function TapRing({ size, pulse, theme }: { size: number; pulse: Animated.Value | null; theme: Theme }) {
  const outer = size + 2 * (RING.white + RING.gold + RING.edge);
  const motion = pulse
    ? {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
      }
    : null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (size - outer) / 2,
          top: (size - outer) / 2,
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderWidth: RING.edge,
          borderColor: theme.highlight,
          boxShadow: `0 0 16px 6px ${TAP.glow}`,
        },
        motion,
      ]}
    >
      <View style={{ flex: 1, borderRadius: outer, borderWidth: RING.gold, borderColor: TAP.gold }}>
        <View style={{ flex: 1, borderRadius: outer, borderWidth: RING.white, borderColor: TAP.inner }} />
      </View>
    </Animated.View>
  );
}

/** Carved cross on a safe square. */
function Cross({ size, color, bold }: { size: number; color: string; bold: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
      <Path d="M10 10L90 90M90 10L10 90" stroke={color} strokeWidth={bold ? 7 : 5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

/** A lit clay lamp on a safe square (Festival). */
function Diya({ size }: { size: number }) {
  return (
    <Svg width={size * 0.84} height={size * 0.84} viewBox="0 0 40 40" style={{ position: 'absolute' }}>
      <Circle cx={20} cy={16} r={12} fill="rgba(255,190,60,0.35)" />
      <Path d="M20 6C25 13 25 19 20 23C15 19 15 13 20 6Z" fill="#FF9A1F" />
      <Path d="M20 12C22 16 22 19 20 21C18 19 18 16 20 12Z" fill="#FFE58A" />
      <Path d="M5 24Q20 38 35 24Z" fill="#B5651D" stroke="#7A2A12" strokeWidth={1.5} />
      <Ellipse cx={20} cy={24} rx={15} ry={2.6} fill="#D98A3A" stroke="#7A2A12" strokeWidth={1.2} />
    </Svg>
  );
}

/** The lotus drawn on the home square. */
function Lotus({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size * 0.88} height={size * 0.88} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
      <G fill="none" stroke={color} strokeWidth={3}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <Ellipse key={a} cx={50} cy={26} rx={10} ry={22} transform={`rotate(${a} 50 50)`} />
        ))}
        <Circle cx={50} cy={50} r={9} />
      </G>
    </Svg>
  );
}

/** A small round badge in a square's top-right corner (safe landing, hit, lock). */
function Badge({ x, y, size, bg, children }: { x: number; y: number; size: number; bg: string; children: React.ReactNode }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 0 2px #FFF8EA, 0 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </View>
  );
}

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
  activeColor,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const frame = Math.round(size * FRAME);
  const grid = size - 2 * frame;
  const cell = grid / 5;
  const line = Math.max(1.5, size / 260);
  const previewOrder = new Map((view.preview ?? []).map((sq, i) => [keyOf(sq), i + 1]));
  const landing = view.preview?.[view.preview.length - 1] ?? null;
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

  const seatOf = (id: SeatId) => state.seats.find((s) => s.id === id)!;
  const colorOf = (pawn: Pawn) => seatOf(pawn.seat).color;
  const current = seatOf(state.currentSeat);

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

  // Start squares are tinted in their owner's colour, so each seat's corner reads at a glance.
  const startOwner = new Map<number, string>();
  state.seats.forEach((s) => s.kind !== 'empty' && startOwner.set(keyOf(pathFor(s.id)[0]!), PAWN_COLORS[s.color]!));

  const cellBackground = ([r, c]: Square) => {
    const centre = r === 2 && c === 2;
    const inner = r > 0 && r < 4 && c > 0 && c < 4 && !centre;
    const base = centre ? theme.boardCentre : inner ? theme.boardInner : theme.board;
    const owner = startOwner.get(keyOf([r, c]));
    return owner ? mix(base, owner, theme.startTint) : base;
  };

  const xy = ([r, c]: Square) => [frame + c * cell, frame + r * cell] as const;

  // The landing square of the chosen move: safe, or a hit on someone.
  const landingKind =
    landing === null
      ? null
      : isSafe(landing)
        ? 'safe'
        : state.pawns.some((p) => p.seat !== state.currentSeat && p.pathIndex !== null && squareOf(p) && sameSquare(squareOf(p)!, landing))
          ? 'hit'
          : null;

  // The inner ring is gated until the current player has hit someone (unless the rules leave it open).
  const gated = state.ruleConfig.noHitBehavior !== 'free';
  const ringOpen = !gated || current.hasHit;
  const badge = Math.max(18, cell * 0.36);
  const tint = activeColor ?? null;

  const nestPawn = Math.max(16, frame * 0.7);
  const nestGap = nestPawn * 1.14;
  const nestXY = (seat: SeatId, i: number): [number, number] => {
    const off = (i - 1.5) * nestGap;
    switch (seat) {
      case 'A':
        return [size / 2 + off, size - frame / 2];
      case 'C':
        return [size / 2 + off, frame / 2];
      case 'B':
        return [size - frame / 2, size / 2 + off];
      default:
        return [frame / 2, size / 2 + off];
    }
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.035,
        backgroundColor: theme.boardFrame,
        boxShadow: [
          tint ? `0 0 0 ${Math.max(3, size * 0.007)}px ${tint}` : null,
          tint ? `0 0 ${size * 0.06}px ${size * 0.01}px ${tint}55` : null,
          'inset 0 0 0 2px rgba(255,255,255,0.1)',
          `0 ${size * 0.03}px ${size * 0.06}px rgba(43,20,5,0.35)`,
        ]
          .filter(Boolean)
          .join(', '),
      }}
    >
      {/* Rangoli dots on the Festival frame. */}
      {theme.diyas && (
        <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
          {Array.from({ length: Math.floor(size / 16) }, (_, i) => i * 16 + 8).flatMap((p) =>
            [
              [p, frame * 0.22],
              [p, size - frame * 0.22],
              [frame * 0.22, p],
              [size - frame * 0.22, p],
            ].map(([x, y], j) => <Circle key={`${p}-${j}`} cx={x} cy={y} r={1.8} fill={j % 2 ? '#F07A93' : '#F2B632'} />),
          )}
        </Svg>
      )}

      {/* Grid lines show through the gaps between squares. */}
      <View
        style={{
          position: 'absolute',
          left: frame - line / 2,
          top: frame - line / 2,
          width: grid + line,
          height: grid + line,
          backgroundColor: theme.boardLine,
          borderRadius: cell * 0.06,
        }}
      />
      {ROWS.flatMap((r) =>
        ROWS.map((c) => {
          const square: Square = [r, c];
          const [x, y] = xy(square);
          const centre = r === 2 && c === 2;
          const step = previewOrder.get(keyOf(square));
          const double = state.doubles.find((d) => sameSquare(d.square, square));
          return (
            <View
              key={`${r}${c}`}
              style={{
                position: 'absolute',
                left: x + line / 2,
                top: y + line / 2,
                width: cell - line,
                height: cell - line,
                borderRadius: Math.max(2, cell * 0.05),
                backgroundColor: cellBackground(square),
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {isSafe(square) &&
                !centre &&
                (theme.diyas ? <Diya size={cell} /> : <Cross size={cell} color={theme.safeMark} bold={theme.boardFrame === '#211A16'} />)}
              {centre && <Lotus size={cell} color={theme.safeMark} />}
              {double && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 2,
                    borderRadius: cell * 0.08,
                    backgroundColor: `${PAWN_COLORS[seatOf(double.owner).color]}40`,
                  }}
                />
              )}
              {step !== undefined && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 1,
                    borderRadius: cell * 0.08,
                    backgroundColor: theme.preview,
                    boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.75)',
                    paddingHorizontal: cell * 0.08,
                    paddingVertical: cell * 0.05,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: Math.max(10, cell * 0.2), lineHeight: Math.max(12, cell * 0.24), color: theme.previewInk }}>
                    {step}
                  </Text>
                </View>
              )}
            </View>
          );
        }),
      )}

      {/* The inner ring: dashed while locked, gold once it is open to the current player. */}
      {gated && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: frame + cell - 2,
            top: frame + cell - 2,
            width: 3 * cell + 4,
            height: 3 * cell + 4,
            borderRadius: cell * 0.08,
            ...(ringOpen
              ? { borderWidth: 3, borderColor: STATE.unlock, boxShadow: `0 0 0 2px rgba(212,160,23,0.35), 0 0 ${cell * 0.3}px rgba(242,182,50,0.7)` }
              : { borderWidth: 2.5, borderStyle: 'dashed' as const, borderColor: theme.safeMark, opacity: 0.85 }),
          }}
        />
      )}

      {/* Landing marker for the chosen move. */}
      {landing && landingKind && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: xy(landing)[0] + line + 1,
            top: xy(landing)[1] + line + 1,
            width: cell - 2 * line - 2,
            height: cell - 2 * line - 2,
            borderRadius: cell * 0.1,
            borderWidth: 3,
            borderColor: landingKind === 'safe' ? STATE.safe : STATE.hit,
            backgroundColor: landingKind === 'safe' ? 'rgba(63,143,90,0.18)' : 'rgba(198,40,40,0.18)',
          }}
        />
      )}

      {/* Nest grooves in the frame, where each seat's waiting pawns rest. */}
      {state.seats
        .filter((s) => s.kind !== 'empty')
        .map((s) => {
          const [cx, cy] = nestXY(s.id, 1.5);
          const across = s.id === 'A' || s.id === 'C';
          const w = across ? nestGap * 4 + 4 : nestPawn + 6;
          const h = across ? nestPawn + 6 : nestGap * 4 + 4;
          return (
            <View
              key={`nest${s.id}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: cx - w / 2,
                top: cy - h / 2,
                width: w,
                height: h,
                borderRadius: 999,
                backgroundColor: 'rgba(0,0,0,0.28)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.12)',
              }}
            />
          );
        })}
      {state.seats.flatMap((s) =>
        state.pawns
          .filter((p) => p.seat === s.id && p.pathIndex === null && !motions.some((m) => m.pawnIds.includes(p.id)))
          .map((pawn, i) => {
            const [cx, cy] = nestXY(s.id, i);
            const canEnter = view.canEnter && pawn.seat === state.currentSeat;
            const d = canEnter ? nestPawn * 1.05 : nestPawn;
            return (
              <View key={pawn.id} style={{ position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d }}>
                {canEnter && <TapRing size={d} pulse={reduceMotion ? null : pulse} theme={theme} />}
                <Pressable
                  disabled={!canEnter}
                  onPress={() => onWaitingPress?.()}
                  accessibilityRole="button"
                  accessibilityLabel={pawnLabel(pawn)}
                  accessibilityState={{ disabled: !canEnter }}
                  hitSlop={Math.max(0, (44 - d) / 2)}
                  style={{ width: d, height: d, opacity: canEnter ? 1 : 0.62 }}
                >
                  <PawnBody seat={pawn.seat} color={PAWN_COLORS[s.color]!} size={d} outline={theme.pawnOutline} />
                </Pressable>
              </View>
            );
          }),
      )}

      {tokensFor(state, motions).map((tok) => {
        const crowd = gridFor(tok.crowd);
        const box = cell / crowd;
        const atHome = tok.pawn.pathIndex === 24 && !tok.motion;
        const tokenSize = (crowd === 1 ? cell * 0.56 : box * 0.8) * (atHome ? 0.85 : 1);
        const left = frame + tok.square[1] * cell + (tok.slot % crowd) * box + box / 2 - tokenSize / 2;
        const top = frame + tok.square[0] * cell + Math.floor(tok.slot / crowd) * box + box / 2 - tokenSize / 2;

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

        const canMove = !tok.motion && movable.has(tok.pawn.id);
        const color = PAWN_COLORS[colorOf(tok.pawn)]!;

        return (
          <Animated.View
            key={tok.pawn.id}
            style={{ position: 'absolute', left, top, width: tokenSize, height: tokenSize, transform: translate }}
          >
            {canMove && <TapRing size={tokenSize} pulse={reduceMotion ? null : pulse} theme={theme} />}
            <Pressable
              disabled={!canMove}
              onPress={() => onPawnPress(tok.pawn.id)}
              accessibilityRole="button"
              accessibilityLabel={pawnLabel(tok.pawn)}
              accessibilityState={{ disabled: !canMove }}
              hitSlop={Math.max(0, (44 - tokenSize) / 2)}
              style={{ width: tokenSize, height: tokenSize }}
            >
              <PawnBody seat={tok.pawn.seat} color={color} size={tokenSize} outline={theme.pawnOutline} />
            </Pressable>
          </Animated.View>
        );
      })}

      {landing && landingKind && (
        <Badge x={xy(landing)[0] + cell - badge * 0.3} y={xy(landing)[1] + badge * 0.3} size={badge} bg={landingKind === 'safe' ? STATE.safe : STATE.hit}>
          <Icon name={landingKind === 'safe' ? 'safe' : 'hit'} size={badge * 0.66} color="#FFFFFF" strokeWidth={2.4} />
        </Badge>
      )}

      {gated && (
        <Badge x={frame + cell} y={frame + cell} size={badge * 1.05} bg={ringOpen ? STATE.unlock : theme.boardFrame === '#1B1F1D' ? '#F4F0E4' : theme.safeMark}>
          <Icon
            name={ringOpen ? 'unlocked' : 'locked'}
            size={badge * 0.66}
            color={ringOpen ? '#3B1D08' : theme.boardFrame === '#1B1F1D' ? '#2B302E' : '#FFF1DE'}
            strokeWidth={2.4}
          />
        </Badge>
      )}

      {trailBadges(trail, motions).map((b) => {
        const color = PAWN_COLORS[seatOf(b.mark.seat).color]!;
        const size = Math.max(14, cell * 0.24);
        // Along the bottom edge, which a lone pawn or a double leaves clear: landings from the
        // bottom-right corner stepping left, departures from the bottom-left stepping right.
        const step = (b.index % 3) * (size - 3);
        const left = frame + b.square[1] * cell + (b.end === 'to' ? cell - size - 1 - step : 1 + step);
        const top = frame + b.square[0] * cell + cell - size - 1;
        return (
          <View
            key={`${b.end}${b.mark.seat}${b.mark.turn}-${b.mark.n}`}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID={`trail-${b.end}-${b.mark.seat}${b.mark.n}`}
            style={[
              {
                position: 'absolute',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: theme.pawnOutline,
                left,
                top,
                width: size,
                height: size,
                borderRadius: size / 2,
              },
              b.end === 'to'
                ? { backgroundColor: color }
                : { backgroundColor: theme.board, borderStyle: 'dashed', borderWidth: 2, borderColor: color },
            ]}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.6, lineHeight: size * 0.75, color: b.end === 'to' ? textOn(color) : color }}>
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
