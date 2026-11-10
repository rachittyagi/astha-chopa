import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { gameStore, settingsStore, useSettings } from '@/store/app';
import { defaultRules, HOUSE_RULE_KEYS, type Settings } from '@/store/settings';
import { Button, Card, ChoiceRow, ConfirmSheet, Header, Overline, Segmented } from '@/ui/common';
import { SeatMark } from '@/ui/game/Controls';
import { firstSetup, nextColor, PLAYER_COUNTS, presetSeats, setKind, type PlayerCount } from '@/ui/setup/presets';
import { fonts, MIN_TOUCH, PAWN_COLORS, radius, space, useThemedStyles, type Theme } from '@/ui/theme';

const KINDS: SeatKind[] = ['human', 'bot', 'empty'];
const INNER_RING: Settings['innerRing'][] = ['open', 'hit'];

const makeStyles = (colors: Theme) => ({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.lg, gap: 14, width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const },
  seat: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: space.md,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 5,
  },
  seatHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, gap: 10 },
  seatTitle: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, flexShrink: 1 },
  side: { fontFamily: fonts.bold, color: colors.text, fontSize: 15 },
  colour: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: MIN_TOUCH, paddingLeft: 6 },
  colourText: { color: colors.muted, fontSize: 14, fontFamily: fonts.body },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.surface, boxShadow: `0 0 0 1.5px ${colors.lineStrong}` },
  fieldLabel: { color: colors.muted, fontSize: 12, fontFamily: fonts.semibold },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1.5,
    borderColor: '#D9C19A',
    borderRadius: radius.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  field: { gap: 4 },
  problem: { color: colors.danger, fontFamily: fonts.semibold, fontSize: 15 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
  bar: {
    flexDirection: 'row' as const,
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: 'rgba(251,244,230,0.97)',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    boxShadow: '0 -10px 20px rgba(122,62,18,0.08)',
  },
  barInner: { flexDirection: 'row' as const, gap: space.sm, width: '100%' as const, maxWidth: 640, alignSelf: 'center' as const },
  grow: { flex: 1 },
});

/** Rules chosen here: the house rules are left to Settings, which applies them to every new game. */
const SETUP_RULE_KEYS = RULE_KEYS.filter((key) => !(HOUSE_RULE_KEYS as readonly string[]).includes(key));
const setupRules = (config: RuleConfig) => SETUP_RULE_KEYS.map((key) => config[key]);

/** The Classic rules with this inner-ring choice, or null when the config is not Classic. */
function classicRing(config: RuleConfig): Settings['innerRing'] | null {
  const same = (innerRing: Settings['innerRing']) =>
    JSON.stringify(setupRules(config)) === JSON.stringify(setupRules(defaultRules({ innerRing })));
  return INNER_RING.find(same) ?? null;
}

export function SetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // From Results ("Change players"), Save starts the next game straight away.
  const { then } = useLocalSearchParams<{ then?: string }>();
  const playNext = then === 'play';
  const { theme, styles } = useThemedStyles(makeStyles);
  const innerRing = useSettings((s) => s.innerRing);
  // Start from the players and rules used last time (remembered between launches).
  const [initial] = useState(() => gameStore.getState().lastSetup ?? firstSetup(innerRing));
  const humans = initial.seats.filter((s) => s.kind === 'human').length;
  const [count, setCount] = useState<PlayerCount>(Math.min(4, Math.max(1, humans)) as PlayerCount);
  const [seats, setSeats] = useState<SeatConfig[]>(initial.seats);
  const initialRing = classicRing(initial.config);
  const [mode, setMode] = useState<'classic' | 'custom'>(initialRing ? 'classic' : 'custom');
  // Classic rules differ only in whether the inner ring needs a hit first; it is chosen here.
  const [ring, setRing] = useState<Settings['innerRing']>(initialRing ?? innerRing);
  const [custom, setCustom] = useState<RuleConfig>(initial.config);

  const problems = validateSeats(seats);
  const update = (index: number, patch: Partial<SeatConfig>) =>
    setSeats((all) => all.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  // Setup can be the first screen (a deep link, a web reload), so there may be nothing to go back to.
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const chosen = () => ({ seats, config: mode === 'classic' ? defaultRules({ innerRing: ring }) : custom });
  // The Classic inner-ring choice also becomes the default for later games and How to play,
  // once the user has committed to it (not when they cancel the replace question).
  const keepRing = () => {
    if (mode === 'classic') settingsStore.getState().update({ innerRing: ring });
  };

  // Save only remembers the choice; Home's Play then starts a game with it.
  const save = () => {
    keepRing();
    gameStore.getState().saveSetup(chosen());
    leave();
  };

  const play = () => {
    keepRing();
    gameStore.getState().startGame(chosen());
    router.replace('/game');
  };

  // Starting now replaces an unfinished game, so ask first, as Home's New game does.
  const [confirmReplace, setConfirmReplace] = useState(false);
  const saveAndPlay = () => {
    if (playNext || !gameStore.getState().saved) return play();
    setConfirmReplace(true);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Header title={t('setup.title')} onBack={leave} />

      <Overline>{t('setup.quickChoice')}</Overline>
      <Segmented
        options={PLAYER_COUNTS.map(String)}
        value={String(count)}
        labelOf={(c) => (c === '1' ? t('setup.playersSolo') : t('setup.playersCount', { count: Number(c) }))}
        accessibilityLabel={t('setup.players')}
        onChange={(c) => {
          const n = Number(c) as PlayerCount;
          setCount(n);
          setSeats((current) => presetSeats(n, current));
        }}
      />

      <Overline>{t('setup.seats')}</Overline>
      {seats.map((seat, i) => {
        const side = t(`setup.seat.${SEAT_IDS[i]}`);
        const colour = t(`colors.${seat.color}`);
        return (
          <View
            key={SEAT_IDS[i]}
            style={[styles.seat, { borderLeftColor: seat.kind === 'empty' ? theme.lineStrong : PAWN_COLORS[seat.color] }]}
          >
            <View style={styles.seatHeader}>
              <View style={styles.seatTitle}>
                {seat.kind !== 'empty' && <SeatMark seat={SEAT_IDS[i]!} color={seat.color} size={32} />}
                <Text style={styles.side}>{t('setup.seatTitle', { side })}</Text>
              </View>
              {seat.kind !== 'empty' && (
                <Pressable
                  onPress={() => update(i, { color: nextColor(seats, i) })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('setup.colour')}: ${colour}`}
                  accessibilityHint={t('setup.colourHint')}
                  style={styles.colour}
                >
                  <Text style={styles.colourText}>{colour}</Text>
                  <View style={[styles.swatch, { backgroundColor: PAWN_COLORS[seat.color] }]} />
                </Pressable>
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
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('setup.nameLabel')}</Text>
                <TextInput
                  value={seat.name}
                  onChangeText={(name) => update(i, { name })}
                  accessibilityLabel={t('setup.name', { side })}
                  placeholder={t('setup.namePlaceholder')}
                  maxLength={20}
                  placeholderTextColor={theme.muted}
                  style={styles.input}
                />
              </View>
            )}
            {seat.kind === 'bot' && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>{t('setup.levelLabel')}</Text>
                <Segmented<BotLevel>
                  options={BOT_LEVELS}
                  value={seat.botLevel ?? 'medium'}
                  labelOf={(l) => t(`setup.level.${l}`)}
                  accessibilityLabel={t('setup.levelLabel')}
                  onChange={(botLevel) => update(i, { botLevel })}
                />
              </View>
            )}
          </View>
        );
      })}

      <Overline>{t('setup.rules')}</Overline>
      <Card>
      <Segmented<'classic' | 'custom'>
        options={['classic', 'custom']}
        value={mode}
        labelOf={(m) => t(`setup.${m}`)}
        accessibilityLabel={t('setup.rules')}
        onChange={setMode}
      />
      {mode === 'classic' && (
        <ChoiceRow<Settings['innerRing']>
          label={t('setup.innerRing')}
          options={INNER_RING}
          value={ring}
          labelOf={(v) => t(`setup.innerRings.${v}`)}
          onChange={setRing}
        />
      )}
      {mode === 'custom' &&
        SETUP_RULE_KEYS.map((key) => (
          <ChoiceRow<string | boolean>
            key={key}
            label={t(`rules.${key}.label`)}
            options={RULE_OPTIONS[key] as readonly (string | boolean)[]}
            value={custom[key]}
            labelOf={(v) => t(`rules.${key}.${String(v)}`)}
            onChange={(v) => setCustom((c) => ({ ...c, [key]: v }))}
          />
        ))}
      </Card>

      <Text style={styles.hint}>{t('setup.houseRulesHint')}</Text>

      {problems.map((p) => (
        <Text key={p} style={styles.problem} accessibilityLiveRegion="polite">
          {t(`setup.problem.${p}`)}
        </Text>
      ))}
      {!playNext && <Text style={styles.hint}>{t('setup.saveHint')}</Text>}
      </ScrollView>
      {/* Sticky actions: always in reach, however long the seats and rules get. */}
      <SafeAreaView edges={['bottom']} style={styles.bar}>
        <View style={styles.barInner}>
          <Button label={t('common.cancel')} onPress={leave} variant="ghost" dense />
          {!playNext && <Button label={t('setup.save')} onPress={save} variant="secondary" disabled={problems.length > 0} dense />}
          <View style={styles.grow}>
            <Button label={t('setup.saveAndPlay')} onPress={saveAndPlay} disabled={problems.length > 0} dense />
          </View>
        </View>
      </SafeAreaView>
      <ConfirmSheet
        visible={confirmReplace}
        title={t('setup.replaceTitle')}
        body={t('setup.replaceBody')}
        confirmLabel={t('setup.replace')}
        onConfirm={() => {
          setConfirmReplace(false);
          play();
        }}
        onCancel={() => setConfirmReplace(false)}
      />
    </SafeAreaView>
  );
}
