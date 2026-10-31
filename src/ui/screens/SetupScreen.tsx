import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  RULE_KEYS,
  RULE_OPTIONS,
  SEAT_IDS,
  validateSeats,
  type BotLevel,
  type RuleConfig,
  type SeatConfig,
  type SeatKind,
} from '@/engine';
import { BOT_LEVELS } from '@/bot';
import { gameStore, useGame, useSettings } from '@/store/app';
import { defaultRules } from '@/store/settings';
import { Button, Screen, Segmented, Title } from '@/ui/common';
import { nextColor, PLAYER_COUNTS, presetSeats, setKind, type PlayerCount } from '@/ui/setup/presets';
import { MIN_TOUCH, PAWN_COLORS, useThemedStyles, type Theme } from '@/ui/theme';

const KINDS: SeatKind[] = ['human', 'bot', 'empty'];

const makeStyles = (colors: Theme) => ({
  label: { fontSize: 16, fontWeight: '700' as const, color: colors.text, marginTop: 4 },
  seat: { backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 8 },
  seatHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  side: { fontWeight: '700' as const, color: colors.text },
  swatch: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, borderWidth: 2, borderColor: '#fff' },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.muted,
    borderRadius: 8,
    paddingHorizontal: 10,
    color: colors.text,
    fontSize: 16,
  },
  rule: { gap: 6 },
  ruleLabel: { color: colors.text, fontWeight: '600' as const },
  problem: { color: colors.danger, fontWeight: '600' as const },
});

export function SetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, styles } = useThemedStyles(makeStyles);
  const saved = useGame((s) => s.saved);
  const [count, setCount] = useState<PlayerCount>(2);
  const [seats, setSeats] = useState<SeatConfig[]>(() => presetSeats(2));
  const [mode, setMode] = useState<'classic' | 'custom'>('classic');
  const innerRing = useSettings((s) => s.innerRing);
  const [custom, setCustom] = useState<RuleConfig>(() => defaultRules({ innerRing }));

  const problems = validateSeats(seats);
  const update = (index: number, patch: Partial<SeatConfig>) =>
    setSeats((all) => all.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const start = () => {
    const begin = () => {
      gameStore.getState().startGame({ seats, config: mode === 'classic' ? defaultRules({ innerRing }) : custom });
      router.replace('/game');
    };
    if (!saved) return begin();
    Alert.alert(t('setup.replaceTitle'), t('setup.replaceBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('setup.replace'), style: 'destructive', onPress: begin },
    ]);
  };

  return (
    <Screen scroll>
      <Title>{t('setup.title')}</Title>

      <Text style={styles.label}>{t('setup.players')}</Text>
      <Segmented
        options={PLAYER_COUNTS.map(String)}
        value={String(count)}
        labelOf={(c) => t('setup.playersCount', { count: Number(c) })}
        accessibilityLabel={t('setup.players')}
        onChange={(c) => {
          const n = Number(c) as PlayerCount;
          setCount(n);
          setSeats((current) => presetSeats(n, current));
        }}
      />

      {seats.map((seat, i) => {
        const side = t(`setup.seat.${SEAT_IDS[i]}`);
        return (
          <View key={SEAT_IDS[i]} style={styles.seat}>
            <View style={styles.seatHeader}>
              <Text style={styles.side}>{side}</Text>
              {seat.kind !== 'empty' && (
                <Pressable
                  onPress={() => update(i, { color: nextColor(seats, i) })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('setup.colour')}: ${t(`colors.${seat.color}`)}`}
                  style={[styles.swatch, { backgroundColor: PAWN_COLORS[seat.color] }]}
                />
              )}
            </View>
            <Segmented
              options={KINDS}
              value={seat.kind}
              labelOf={(k) => t(`setup.kind.${k}`)}
              accessibilityLabel={side}
              onChange={(k) => setSeats((all) => setKind(all, i, k))}
            />
            {seat.kind !== 'empty' && (
              <TextInput
                value={seat.name}
                onChangeText={(name) => update(i, { name })}
                accessibilityLabel={t('setup.name', { side })}
                maxLength={20}
                placeholderTextColor={theme.muted}
                style={styles.input}
              />
            )}
            {seat.kind === 'bot' && (
              <Segmented<BotLevel>
                options={BOT_LEVELS}
                value={seat.botLevel ?? 'medium'}
                labelOf={(l) => t(`setup.level.${l}`)}
                onChange={(botLevel) => update(i, { botLevel })}
              />
            )}
          </View>
        );
      })}

      <Text style={styles.label}>{t('setup.rules')}</Text>
      <Segmented<'classic' | 'custom'>
        options={['classic', 'custom']}
        value={mode}
        labelOf={(m) => t(`setup.${m}`)}
        onChange={setMode}
      />
      {mode === 'custom' &&
        RULE_KEYS.map((key) => (
          <View key={key} style={styles.rule}>
            <Text style={styles.ruleLabel}>{t(`rules.${key}.label`)}</Text>
            <Segmented
              options={RULE_OPTIONS[key] as readonly (string | boolean)[]}
              value={custom[key]}
              labelOf={(v) => t(`rules.${key}.${String(v)}`)}
              accessibilityLabel={t(`rules.${key}.label`)}
              onChange={(v) => setCustom((c) => ({ ...c, [key]: v }))}
            />
          </View>
        ))}

      {problems.map((p) => (
        <Text key={p} style={styles.problem} accessibilityLiveRegion="polite">
          {t(`setup.problem.${p}`)}
        </Text>
      ))}
      <Button label={t('setup.start')} onPress={start} disabled={problems.length > 0} />
      <Button label={t('common.back')} onPress={() => router.back()} variant="secondary" />
    </Screen>
  );
}
