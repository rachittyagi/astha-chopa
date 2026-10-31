import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isSafe, ringOf, squareOf, type GameState, type Pawn, type Square } from '@/engine';
import { colors, PAWN_COLORS } from '@/ui/theme';

import type { SelectionView } from './selection';

interface Props {
  state: GameState;
  size: number;
  view: SelectionView;
  onPawnPress(pawnId: string): void;
}

const ROWS = [0, 1, 2, 3, 4];
const key = ([r, c]: Square) => r * 5 + c;

/** Pawns on the board grouped by square, then by seat (R-UI-07). */
function groups(state: GameState): Map<number, Pawn[][]> {
  const bySquare = new Map<number, Map<string, Pawn[]>>();
  for (const pawn of state.pawns) {
    const square = squareOf(pawn);
    if (!square) continue;
    const seats = bySquare.get(key(square)) ?? new Map<string, Pawn[]>();
    seats.set(pawn.seat, [...(seats.get(pawn.seat) ?? []), pawn]);
    bySquare.set(key(square), seats);
  }
  return new Map([...bySquare].map(([k, seats]) => [k, [...seats.values()]]));
}

export function Board({ state, size, view, onPawnPress }: Props) {
  const { t } = useTranslation();
  const cell = size / 5;
  const stacks = groups(state);
  const preview = new Set((view.preview ?? []).map(key));
  const movable = new Set(view.movablePawnIds);

  const colorOf = (pawn: Pawn) => state.seats.find((s) => s.id === pawn.seat)!.color;

  const pawnLabel = (pawn: Pawn) => {
    const index = pawn.pathIndex ?? 0;
    return t('game.a11y.pawn', {
      color: t(`colors.${colorOf(pawn)}`),
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
            const here = stacks.get(key(square)) ?? [];
            const token = here.length > 1 ? cell * 0.42 : cell * 0.66;
            return (
              <View
                key={c}
                style={[
                  styles.cell,
                  { width: cell, height: cell },
                  preview.has(key(square)) && styles.preview,
                ]}
              >
                {isSafe(square) && (
                  <>
                    <View style={[styles.cross, { width: cell * 1.1, transform: [{ rotate: '45deg' }] }]} />
                    <View style={[styles.cross, { width: cell * 1.1, transform: [{ rotate: '-45deg' }] }]} />
                  </>
                )}
                <View style={styles.stack}>
                  {here.map((pawns) => {
                    const target = pawns.find((p) => movable.has(p.id));
                    return (
                      <Pressable
                        key={pawns[0]!.seat}
                        disabled={!target}
                        onPress={() => target && onPawnPress(target.id)}
                        accessibilityRole="button"
                        accessibilityLabel={pawnLabel(pawns[0]!)}
                        accessibilityState={{ disabled: !target }}
                        hitSlop={Math.max(0, (44 - token) / 2)}
                        style={[
                          styles.token,
                          {
                            width: token,
                            height: token,
                            borderRadius: token / 2,
                            backgroundColor: PAWN_COLORS[colorOf(pawns[0]!)],
                          },
                          target && styles.movable,
                        ]}
                      >
                        {pawns.length > 1 && <Text style={styles.badge}>{pawns.length}</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { backgroundColor: colors.board, borderWidth: 2, borderColor: colors.boardLine },
  row: { flexDirection: 'row' },
  cell: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.boardLine,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: { backgroundColor: colors.preview },
  cross: { position: 'absolute', height: 2, backgroundColor: colors.safeMark, opacity: 0.6 },
  stack: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 2 },
  token: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffffaa' },
  movable: { borderColor: colors.highlight, borderWidth: 4 },
  badge: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
