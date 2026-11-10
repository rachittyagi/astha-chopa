import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { APP_NAME } from '@/config/app';
import { CLASSIC, createGame, THROW_ODDS, THROW_VALUES, type RuleConfig, type ThrowValue } from '@/engine';
import { useGame, useSettings } from '@/store/app';
import { defaultRules } from '@/store/settings';
import { Body, Button, Header, Screen } from '@/ui/common';
import { Board } from '@/ui/game/Board';
import { Cowrie } from '@/ui/game/Cowrie';
import { SeatMark } from '@/ui/game/Controls';
import { presetSeats } from '@/ui/setup/presets';
import { font, space, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  section: { gap: space.sm, paddingVertical: space.xs },
  heading: { fontSize: font.heading, fontWeight: '700' as const, color: c.text },
  note: { color: c.accent, fontWeight: '600' as const },
  throwRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  throwText: { color: c.text, fontSize: 15, marginLeft: 8, flexShrink: 1 },
  seats: { flexDirection: 'row' as const, gap: 12, flexWrap: 'wrap' as const },
  seat: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  seatText: { color: c.text },
});

/** Mouth-up shells for a throw value: 8 is none up, 4 is all up. */
const upCount = (value: ThrowValue) => (value === 8 ? 0 : value);

/** Illustrated rules; opened from a game, they follow that game's house rules (PRD section 6). */
export function HowToPlayScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { styles } = useThemedStyles(makeStyles);
  const game = useGame((s) => s.game);
  const settings = useSettings((s) => s);
  const rules: RuleConfig = game?.ruleConfig ?? defaultRules(settings);
  const demo = useMemo(
    () => createGame(presetSeats(4), { ...CLASSIC, entryRule: 'onStart' }, 1, 'demo', 0),
    [],
  );
  const boardSize = Math.min(width - 32, 320);
  const noSelection = { playableThrowIds: [], activeThrowId: null, movablePawnIds: [], canEnter: false, preview: null };

  return (
    <Screen scroll>
      <Header title={t('howToPlay.title')} />
      {game && <Text style={styles.note}>{t('howToPlay.yourRules')}</Text>}

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('howToPlay.board.title')}
        </Text>
        <View style={{ alignItems: 'center' }} accessible accessibilityLabel={t('howToPlay.board.picture')}>
          <Board state={demo} size={boardSize} view={noSelection} onPawnPress={() => undefined} />
        </View>
        <Body>{t('howToPlay.board.body')}</Body>
        <View style={styles.seats}>
          {demo.seats.map((s) => (
            <View key={s.id} style={styles.seat}>
              <SeatMark seat={s.id} color={s.color} />
              <Text style={styles.seatText}>{t(`setup.seat.${s.id}`)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('howToPlay.throws.title')}
        </Text>
        <Body>{t('howToPlay.throws.body')}</Body>
        {THROW_VALUES.map((value) => (
          <View
            key={value}
            style={styles.throwRow}
            accessible
            accessibilityLabel={t('howToPlay.throws.row', {
              value,
              up: upCount(value),
              percent: Math.round(THROW_ODDS[value] * 100),
            })}
          >
            {[0, 1, 2, 3].map((i) => (
              <Cowrie key={i} up={i < upCount(value)} size={30} />
            ))}
            <Text style={styles.throwText}>
              {t('howToPlay.throws.row', { value, up: upCount(value), percent: Math.round(THROW_ODDS[value] * 100) })}
            </Text>
          </View>
        ))}
        <Body>{t('howToPlay.throws.extra')}</Body>
        {rules.rethrowOnOne && <Body>{t('howToPlay.throws.rethrowOnOne')}</Body>}
        <Body>{t(`howToPlay.throws.triple.${String(rules.triplePenalty)}`)}</Body>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('howToPlay.moving.title')}
        </Text>
        <Body>{t(`howToPlay.moving.entry.${rules.entryRule}`)}</Body>
        <Body>{t('howToPlay.moving.body')}</Body>
        <Body>{t(`howToPlay.moving.noHit.${rules.noHitBehavior}`)}</Body>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('howToPlay.hits.title')}
        </Text>
        <Body>{t('howToPlay.hits.body')}</Body>
        {rules.hitNeedsEntry && <Body>{t('howToPlay.hits.hitNeedsEntry')}</Body>}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('howToPlay.doubles.title')}
        </Text>
        <Body>
          {rules.doubles
            ? t(`howToPlay.doubles.on.${rules.doubleCrossing}`)
            : t('howToPlay.doubles.off')}
        </Body>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('howToPlay.winning.title')}
        </Text>
        <Body>{t('howToPlay.winning.body')}</Body>
        <Body>{t(`howToPlay.winning.playToEnd.${String(rules.playToEnd)}`)}</Body>
        {rules.bonusOnHome && <Body>{t('howToPlay.winning.bonusOnHome')}</Body>}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading} accessibilityRole="header">
          {t('howToPlay.names.title')}
        </Text>
        <Body>{t('howToPlay.names.body', { app: APP_NAME })}</Body>
      </View>

      <Button label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
