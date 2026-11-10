// The winner's moment: confetti, a trophy and their name, until they tap Continue.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Easing, Modal, Platform, Text, useWindowDimensions, View } from 'react-native';

import type { Seat } from '@/engine';
import { playSound } from '@/services/feedback';
import { settingsStore } from '@/store/app';
import { Button, useReduceMotion } from '@/ui/common';
import { SeatMark } from '@/ui/game/Controls';
import { Trophy } from '@/ui/game/Trophy';
import { fonts, PAWN_COLORS, shadow, useThemedStyles, type Theme } from '@/ui/theme';

const PIECES = 40;
const FALL_MS = 2600;
const FESTIVE = ['#C23B2A', '#E39B0B', '#2F7D4E', '#2E5AA8', '#F2B632', '#E85D75', '#F28C28'];

interface Piece {
  x: number;
  delay: number;
  size: number;
  color: string;
  spin: number;
  drift: number;
}

const makeStyles = (c: Theme) => ({
  overlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center' as const, alignItems: 'center' as const },
  card: {
    backgroundColor: c.surface,
    borderRadius: 28,
    ...shadow.overlay,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    gap: 14,
    width: '86%' as const,
    maxWidth: 420,
  },
  title: { fontSize: 36, lineHeight: 42, fontFamily: fonts.display, color: c.accent, textAlign: 'center' as const, flexShrink: 1 },
  subtitle: { fontSize: 18, fontFamily: fonts.body, color: c.muted, textAlign: 'center' as const },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  button: { alignSelf: 'stretch' as const },
});

export function Celebration({ seat, onDone }: { seat: Seat | null; onDone(): void }) {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const { width, height } = useWindowDimensions();
  const [fall] = useState(() => new Animated.Value(0));
  // Confetti is decoration: left out when the system asks for less motion.
  const reduceMotion = useReduceMotion();
  // Random once per celebration: where each piece starts, how it spins and drifts.
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: PIECES }, () => ({
      x: Math.random(),
      delay: Math.random() * 0.35,
      size: 8 + Math.random() * 10,
      color: FESTIVE[Math.floor(Math.random() * FESTIVE.length)]!,
      spin: (Math.random() - 0.5) * 1440,
      drift: (Math.random() - 0.5) * 80,
    })),
  );

  // Once per winner: announced, and applauded as the card appears (the fanfare already played
  // on the winning move). Kept apart from the confetti, which restarts if the motion setting changes.
  const winnerName = seat?.name;
  useEffect(() => {
    if (winnerName === undefined) return;
    AccessibilityInfo.announceForAccessibility(t('game.celebrate.title', { name: winnerName }));
    playSound('clap', settingsStore.getState());
  }, [winnerName, t]);

  useEffect(() => {
    if (!seat) return;
    fall.setValue(0);
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.timing(fall, {
        toValue: 1,
        duration: FALL_MS,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
      { iterations: 2 },
    );
    animation.start();
    return () => animation.stop();
  }, [seat, fall, reduceMotion]);

  if (!seat) return null;
  const colors = [PAWN_COLORS[seat.color]!, ...FESTIVE];

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDone}>
      <View style={styles.overlay}>
        {!reduceMotion &&
          pieces.map((p, i) => {
            const start = p.delay;
            const translateY = fall.interpolate({
              inputRange: [0, start, 1],
              outputRange: [-40, -40, height + 40],
            });
            const translateX = fall.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
            const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] });
            return (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: p.x * width,
                  width: p.size,
                  height: p.size * 0.5,
                  borderRadius: 2,
                  backgroundColor: i % 3 === 0 ? colors[0] : p.color,
                  transform: [{ translateY }, { translateX }, { rotate }],
                }}
              />
            );
          })}
        <View style={styles.card} accessibilityViewIsModal>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Trophy />
          </View>
          <View style={styles.row}>
            <SeatMark seat={seat.id} color={seat.color} size={30} />
            <Text style={styles.title} accessibilityRole="header">
              {t('game.celebrate.title', { name: seat.name })}
            </Text>
          </View>
          <Text style={styles.subtitle}>{t('game.celebrate.subtitle')}</Text>
          <View style={styles.button}>
            <Button label={t('game.celebrate.continue')} size="large" onPress={onDone} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
