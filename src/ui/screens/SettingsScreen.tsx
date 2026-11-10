import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { gameStore, settingsStore, useGame, useSettings } from '@/store/app';
import type { Settings } from '@/store/settings';
import { Button, Card, ConfirmSheet, Header, Overline, Screen, Segmented, Toggle } from '@/ui/common';
import { Icon } from '@/ui/icons';
import { fonts, space, THEMES as PALETTES, useThemedStyles, type Theme } from '@/ui/theme';

const THEMES: Settings['theme'][] = ['wood', 'festive', 'chalk', 'flat'];
const SWATCH = 84;
const SPEEDS: Settings['speed'][] = ['normal', 'fast'];
const LANGUAGES: Settings['language'][] = ['en', 'hi'];

const makeStyles = (c: Theme) => ({
  themes: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },
  themeCard: {
    flexBasis: '45%' as const,
    flexGrow: 1,
    padding: space.sm,
    gap: 6,
    borderRadius: 18,
    backgroundColor: c.surface,
    boxShadow: '0 0 0 1.5px #D9C19A',
  },
  themeSelected: { backgroundColor: c.accent, boxShadow: `0 0 0 3px ${c.accent}` },
  themeName: { color: c.text, fontSize: 14, fontFamily: fonts.bold, paddingHorizontal: 2 },
  themeNameSelected: { color: c.onAccent },
  check: {
    position: 'absolute' as const,
    right: 14,
    top: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF6E6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
  },
  rows: { paddingVertical: 4, gap: 0 },
  divider: { height: 1, backgroundColor: '#EFE2C9' },
  hint: { color: c.muted, fontSize: 13, lineHeight: 18, fontFamily: fonts.body },
});

/** A board in miniature, in a theme's colours: frame, squares and a safe-square cross. */
function ThemeSwatch({ name }: { name: Settings['theme'] }) {
  const p = PALETTES[name];
  return (
    <View style={{ height: SWATCH, borderRadius: 12, backgroundColor: p.boardFrame, padding: 9 }}>
      <View style={{ flex: 1, borderRadius: 4, backgroundColor: p.board, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 40, height: 3, borderRadius: 2, backgroundColor: p.safeMark, transform: [{ rotate: '45deg' }] }} />
        <View style={{ position: 'absolute', width: 40, height: 3, borderRadius: 2, backgroundColor: p.safeMark, transform: [{ rotate: '-45deg' }] }} />
      </View>
    </View>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const { styles } = useThemedStyles(makeStyles);
  const settings = useSettings((s) => s);
  const saved = useGame((s) => s.saved);
  const update = (patch: Partial<Settings>) => settingsStore.getState().update(patch);

  const [confirmReset, setConfirmReset] = useState(false);
  const reset = () => {
    setConfirmReset(false);
    void gameStore.getState().discardSaved();
  };

  return (
    <Screen scroll>
      <Header title={t('settings.title')} />

      <Overline>{t('settings.boardTheme')}</Overline>
      <View style={styles.themes} accessibilityRole="radiogroup" accessibilityLabel={t('settings.theme')}>
        {THEMES.map((theme) => {
          const selected = theme === settings.theme;
          return (
            <Pressable
              key={theme}
              onPress={() => update({ theme })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={t(`settings.themes.${theme}`)}
              style={[styles.themeCard, selected && styles.themeSelected]}
            >
              <ThemeSwatch name={theme} />
              <Text style={[styles.themeName, selected && styles.themeNameSelected]}>{t(`settings.themes.${theme}`)}</Text>
              {selected && (
                <View style={styles.check}>
                  <Icon name="check" size={16} strokeWidth={3} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Overline>{t('settings.soundAndPlay')}</Overline>
      <Card style={styles.rows}>
        <Toggle label={t('settings.sound')} sub={t('settings.soundSub')} value={settings.sound} onChange={(sound) => update({ sound })} />
        <View style={styles.divider} />
        <Toggle label={t('settings.haptics')} sub={t('settings.hapticsSub')} value={settings.haptics} onChange={(haptics) => update({ haptics })} />
        <View style={styles.divider} />
        <Toggle label={t('settings.callouts')} sub={t('settings.calloutsSub')} value={settings.callouts} onChange={(callouts) => update({ callouts })} />
      </Card>

      <Overline>{t('settings.speed')}</Overline>
      <Segmented
        options={SPEEDS}
        value={settings.speed}
        labelOf={(v) => t(`settings.speeds.${v}`)}
        accessibilityLabel={t('settings.speed')}
        onChange={(speed) => update({ speed })}
      />

      <Overline>{t('settings.language')}</Overline>
      <Segmented
        options={LANGUAGES}
        value={settings.language}
        labelOf={(v) => t(`settings.languages.${v}`)}
        accessibilityLabel={t('settings.language')}
        onChange={(language) => update({ language })}
      />

      <Overline>{t('settings.houseRules')}</Overline>
      <Card style={styles.rows}>
        <Text style={[styles.hint, { paddingTop: 8 }]}>{t('settings.houseRulesHint')}</Text>
        <Toggle
          label={t('settings.rethrowOnOne')}
          value={settings.rethrowOnOne}
          onChange={(rethrowOnOne) => update({ rethrowOnOne })}
        />
        <View style={styles.divider} />
        <Toggle
          label={t('settings.hitNeedsEntry')}
          value={settings.hitNeedsEntry}
          onChange={(hitNeedsEntry) => update({ hitNeedsEntry })}
        />
        <View style={styles.divider} />
        <Toggle
          label={t('settings.bonusOnHome')}
          value={settings.bonusOnHome}
          onChange={(bonusOnHome) => update({ bonusOnHome })}
        />
      </Card>

      <Text style={styles.hint}>{t('settings.motionNote')}</Text>

      {saved && <Button label={t('settings.reset')} variant="danger" onPress={() => setConfirmReset(true)} />}
      <ConfirmSheet
        visible={confirmReset}
        title={t('settings.resetTitle')}
        body={t('settings.resetBody')}
        confirmLabel={t('settings.reset')}
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </Screen>
  );
}
