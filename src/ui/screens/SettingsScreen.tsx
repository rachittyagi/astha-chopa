import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { gameStore, settingsStore, useGame, useSettings } from '@/store/app';
import type { Settings } from '@/store/settings';
import { Button, Screen, Segmented, Title, Toggle } from '@/ui/common';
import { useThemedStyles, type Theme } from '@/ui/theme';

const THEMES: Settings['theme'][] = ['chalk', 'wood', 'flat'];
const SPEEDS: Settings['speed'][] = ['normal', 'fast'];
const LANGUAGES: Settings['language'][] = ['en', 'hi'];
const INNER_RING: Settings['innerRing'][] = ['open', 'hit'];

const makeStyles = (c: Theme) => ({
  label: { fontSize: 16, fontWeight: '700' as const, color: c.text, marginTop: 8 },
  group: { gap: 8 },
  hint: { fontSize: 13, color: c.muted },
});

export function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { styles } = useThemedStyles(makeStyles);
  const settings = useSettings((s) => s);
  const saved = useGame((s) => s.saved);
  const update = (patch: Partial<Settings>) => settingsStore.getState().update(patch);

  const reset = () =>
    Alert.alert(t('settings.resetTitle'), t('settings.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.reset'), style: 'destructive', onPress: () => void gameStore.getState().discardSaved() },
    ]);

  return (
    <Screen scroll>
      <Title>{t('settings.title')}</Title>

      <View style={styles.group}>
        <Text style={styles.label}>{t('settings.theme')}</Text>
        <Segmented
          options={THEMES}
          value={settings.theme}
          labelOf={(v) => t(`settings.themes.${v}`)}
          accessibilityLabel={t('settings.theme')}
          onChange={(theme) => update({ theme })}
        />
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
        <Text style={styles.label}>{t('settings.innerRing')}</Text>
        <Segmented
          options={INNER_RING}
          value={settings.innerRing}
          labelOf={(v) => t(`settings.innerRings.${v}`)}
          accessibilityLabel={t('settings.innerRing')}
          onChange={(innerRing) => update({ innerRing })}
        />
        <Text style={styles.hint}>{t('settings.innerRingHint')}</Text>
      </View>

      {saved && <Button label={t('settings.reset')} variant="secondary" onPress={reset} />}
      <Button label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
