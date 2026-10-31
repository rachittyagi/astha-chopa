// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

// Platform and UI packages the pure layers must never import (R-TECH-02, R-TECH-03).
const PLATFORM_IMPORTS = [
  'react',
  'react/*',
  'react-native',
  'react-native/*',
  'react-native-*',
  'expo',
  'expo-*',
  'expo/*',
  '@expo/*',
  '@react-native/*',
  '@react-native-async-storage/*',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/engine',
              from: './src',
              except: ['./engine'],
              message: 'The engine is pure: it may import only from src/engine.',
            },
            {
              target: './src/bot',
              from: './src',
              except: ['./bot', './engine'],
              message: 'The bot may import only from src/bot and src/engine.',
            },
          ],
        },
      ],
    },
  },
  {
    // Jest mock factories must use require().
    files: ['**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-named-as-default-member': 'off',
    },
  },
  {
    // All user-facing text comes from translation files (R-I18N-01).
    files: ['src/app/**/*.tsx', 'src/ui/**/*.tsx'],
    ignores: ['**/__tests__/**', '**/testing/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': ['error', { mode: 'jsx-text-only' }],
    },
  },
  {
    files: ['src/engine/**/*.ts', 'src/bot/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PLATFORM_IMPORTS,
              message: 'Engine and bot must not import React, React Native or Expo.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'The engine must not read the clock (R-TECH-03).' },
        { name: 'localStorage', message: 'The engine must not read storage (R-TECH-03).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded PRNG in the game state (R-RNG-01).' },
      ],
    },
  },
]);
