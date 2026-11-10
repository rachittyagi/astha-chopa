import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { gameStore, settingsStore, useGame, useSettings } from '@/store/app';
import type { Settings } from '@/store/settings';
import { Button, ConfirmSheet, Header, Screen, Segmented, Toggle } from '@/ui/common';
import { font, radius, space, THEMES as PALETTES, useThemedStyles, type Theme } from '@/ui/theme';

const THEMES: Settings['theme'][] = ['festive', 'chalk', 'wood', 'flat'];
const SWATCH = 44;
const SPEEDS: Settings['speed'][] = ['normal', 'fast'];
const LANGUAGES: Settings['language'][] = ['en', 'hi'];

const makeStyles = (c: Theme) => ({
  label: { fontSize: font.label, fontWeight: '700' as const, color: c.text, marginTop: space.sm },
  group: { gap: space.sm },
  themes: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: space.sm },
  themeCard: {
    flexBasis: '47%' as const,
    flexGrow: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.muted,
    backgroundColor: c.surface,
  },
  themeSelected: { borderColor: c.accent, borderWidth: 3 },
  hint: { color: c.muted, fontSize: font.caption },
  themeName: { flex: 1, color: c.text, fontSize: font.label, fontWeight: '600' as const },
});

/** A tiny board in a theme's colours: its squares, a safe-square cross and a button-coloured pawn. */
function ThemeSwatch({ name }: { name: Settings['theme'] }) {
  const p = PALETTES[name];
  const line = { position: 'absolute' as const, width: SWATCH * 0.7, height: 2, backgroundColor: p.safeMark };
  return (
    <View
      style={{
        width: SWATCH,
        height: SWATCH,
        backgroundColor: p.board,
        borderWidth: 2,
        borderColor: p.boardLine,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={[line, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[line, { transform: [{ rotate: '-45deg' }] }]} />
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.accent, borderWidth: 1.5, borderColor: p.pawnOutline }} />
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

      <View style={styles.group}>
        <Text style={styles.label}>{t('settings.theme')}</Text>
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
                <Text style={styles.themeName}>{t(`settings.themes.${theme}`)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Toggle label={t('settings.sound')} value={settings.sound} onChange={(sound) => update({ sound })} />
      <Toggle label={t('settings.haptics')} value={settings.haptics} onChange={(haptics) => update({ haptics })} />
      <Toggle label={t('settings.callouts')} value={settings.callouts} onChange={(callouts) => update({ callouts })} />

      <View style={styles.group}>
        <Text style={styles.label}>{t('settings.speed')}</Text>
        <Segmented
          options={SPEEDS}
          value={settings.speed}
          labelOf={(v) => t(`settings.speeds.${v}`)}
          accessibilityLabel={t('settings.speed')}
          onChange={(speed) => update({ speed })}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('settings.language')}</Text>
        <Segmented
          options={LANGUAGES}
          value={settings.language}
          labelOf={(v) => t(`settings.languages.${v}`)}
          accessibilityLabel={t('settings.language')}
          onChange={(language) => update({ language })}
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('settings.houseRules')}</Text>
        <Text style={styles.hint}>{t('settings.houseRulesHint')}</Text>
        <Toggle
          label={t('settings.rethrowOnOne')}
          value={settings.rethrowOnOne}
          onChange={(rethrowOnOne) => update({ rethrowOnOne })}
        />
        <Toggle
          label={t('settings.hitNeedsEntry')}
          value={settings.hitNeedsEntry}
          onChange={(hitNeedsEntry) => update({ hitNeedsEntry })}
        />
        <Toggle
          label={t('settings.bonusOnHome')}
          value={settings.bonusOnHome}
          onChange={(bonusOnHome) => update({ bonusOnHome })}
        />
      </View>

      {saved && <Button label={t('settings.reset')} variant="secondary" onPress={() => setConfirmReset(true)} />}
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
