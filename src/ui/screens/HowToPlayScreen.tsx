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
import { fonts, space, STATE, useThemedStyles, type Theme } from '@/ui/theme';

const makeStyles = (c: Theme) => ({
  section: { gap: space.sm, paddingVertical: space.xs },
  heading: { fontSize: 20, lineHeight: 26, fontFamily: fonts.heading, color: c.text },
  number: { color: c.accent },
  note: { color: STATE.goldInk, fontFamily: fonts.semibold, fontSize: 14, backgroundColor: STATE.gold, borderRadius: 14, padding: 12, overflow: 'hidden' as const },
  throwRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  throwValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: c.accent, width: 28, marginLeft: 8 },
  throwText: { color: c.text, fontSize: 13, lineHeight: 18, fontFamily: fonts.semibold, flexShrink: 1 },
  seats: { flexDirection: 'row' as const, gap: 12, flexWrap: 'wrap' as const },
  seat: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  seatText: { color: c.text, fontFamily: fonts.body, fontSize: 14 },
});

/** A numbered section heading: "3 · Moving". */
function Heading({ n, children, styles }: { n: number; children: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Text style={styles.heading} accessibilityRole="header">
      <Text style={styles.number}>{`${n} · `}</Text>
      {children}
    </Text>
  );
}

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
  const boardSize = Math.min(width - 32, 300);
  const noSelection = { playableThrowIds: [], activeThrowId: null, movablePawnIds: [], canEnter: false, preview: null };

  return (
    <Screen scroll>
      <Header title={t('howToPlay.title')} />
      {game && <Text style={styles.note}>{t('howToPlay.yourRules')}</Text>}

      <View style={styles.section}>
        <Heading n={1} styles={styles}>
          {t('howToPlay.board.title')}
        </Heading>
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
        <Heading n={2} styles={styles}>
          {t('howToPlay.throws.title')}
        </Heading>
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
              <Cowrie key={i} up={i < upCount(value)} size={22} />
            ))}
            <Text style={styles.throwValue}>{value}</Text>
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
        <Heading n={3} styles={styles}>
          {t('howToPlay.moving.title')}
        </Heading>
        <Body>{t(`howToPlay.moving.entry.${rules.entryRule}`)}</Body>
        <Body>{t('howToPlay.moving.body')}</Body>
        <Body>{t(`howToPlay.moving.noHit.${rules.noHitBehavior}`)}</Body>
      </View>

      <View style={styles.section}>
        <Heading n={4} styles={styles}>
          {t('howToPlay.hits.title')}
        </Heading>
        <Body>{t('howToPlay.hits.body')}</Body>
        {rules.hitNeedsEntry && <Body>{t('howToPlay.hits.hitNeedsEntry')}</Body>}
      </View>

      <View style={styles.section}>
        <Heading n={5} styles={styles}>
          {t('howToPlay.doubles.title')}
        </Heading>
        <Body>
          {rules.doubles
            ? t(`howToPlay.doubles.on.${rules.doubleCrossing}`)
            : t('howToPlay.doubles.off')}
        </Body>
      </View>

      <View style={styles.section}>
        <Heading n={6} styles={styles}>
          {t('howToPlay.winning.title')}
        </Heading>
        <Body>{t('howToPlay.winning.body')}</Body>
        <Body>{t(`howToPlay.winning.playToEnd.${String(rules.playToEnd)}`)}</Body>
        {rules.bonusOnHome && <Body>{t('howToPlay.winning.bonusOnHome')}</Body>}
      </View>

      <View style={styles.section}>
        <Heading n={7} styles={styles}>
          {t('howToPlay.names.title')}
        </Heading>
        <Body>{t('howToPlay.names.body', { app: APP_NAME })}</Body>
      </View>

      <Button label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}
