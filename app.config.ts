import type { ExpoConfig } from 'expo/config';

import appConfig from './src/config/app.json';

const { name: APP_NAME, slug: APP_SLUG, scheme: APP_SCHEME, bundleId: BUNDLE_ID } = appConfig;

const config: ExpoConfig = {
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: APP_SCHEME,
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: BUNDLE_ID,
    supportsTablet: true,
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    // Sound playback only: no microphone, recording or background audio (R-LOCAL-02).
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false }],
  ],
  extra: {
    // development | preview | release, set by the EAS build profile (eas.json).
    variant: process.env.APP_VARIANT ?? 'development',
  },
};

export default config;
