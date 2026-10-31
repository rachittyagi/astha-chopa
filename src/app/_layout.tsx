import i18next from '@/i18n';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { gameStore, settingsStore, useSettings } from '@/store/app';

export default function RootLayout() {
  const theme = useSettings((s) => s.theme);
  const language = useSettings((s) => s.language);

  useEffect(() => {
    void settingsStore.getState().load();
    void gameStore.getState().loadSaved();
  }, []);

  useEffect(() => {
    void i18next.changeLanguage(language);
  }, [language]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={theme === 'chalk' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
