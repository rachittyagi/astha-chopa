import i18next from '@/i18n';

import { Baloo2_700Bold, Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2';
import { Hind_400Regular, Hind_500Medium, Hind_600SemiBold, Hind_700Bold } from '@expo-google-fonts/hind';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { gameStore, settingsStore, useSettings } from '@/store/app';

export default function RootLayout() {
  const language = useSettings((s) => s.language);
  // Loaded at runtime so they work on web too; until then text shows in the system font.
  useFonts({ Baloo2_700Bold, Baloo2_800ExtraBold, Hind_400Regular, Hind_500Medium, Hind_600SemiBold, Hind_700Bold });

  useEffect(() => {
    void settingsStore.getState().load();
    void gameStore.getState().loadSaved();
  }, []);

  useEffect(() => {
    void i18next.changeLanguage(language);
  }, [language]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F2E6D0' } }} />
      {/* Every screen sits on the cream courtyard, whatever the board theme. */}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
