import type { ExpoConfig } from 'expo/config';

import appConfig from './src/config/app.json';

const { name: APP_NAME, slug: APP_SLUG, scheme: APP_SCHEME, bundleId: BUNDLE_ID } = appConfig;

// development | preview | release, set by the EAS build profile (eas.json).
const VARIANT = process.env.APP_VARIANT ?? 'development';

/**
 * Permissions React Native and Expo add by default that the game never needs (R-LOCAL-02).
 * Development builds keep INTERNET for the Metro bundler; preview and release builds,
 * which are what testers and players install, drop them all.
 */
const BLOCKED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.RECORD_AUDIO',
];

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
    config: { usesNonExemptEncryption: false },
    // No tracking, no data collected; UserDefaults is read by MMKV/AsyncStorage for local saves (R-NET-03).
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
      ],
    },
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
    blockedPermissions: VARIANT === 'development' ? [] : BLOCKED_PERMISSIONS,
  },
  plugins: [
    'expo-router',
    // Sound playback only: no microphone, recording or background audio (R-LOCAL-02).
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false, enableBackgroundPlayback: false }],
  ],
  extra: {
    variant: VARIANT,
  },
};

export default config;
