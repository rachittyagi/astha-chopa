// Four projects: the pure engine and bot, and the repo scripts, run in plain Node; the app runs under jest-expo.
const pureProject = (name) => ({
  displayName: name,
  preset: 'jest-expo/node',
  roots: [`<rootDir>/src/${name}`],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
});

module.exports = {
  projects: [
    pureProject('engine'),
    pureProject('bot'),
    { ...pureProject('scripts'), roots: ['<rootDir>/scripts'] },
    {
      displayName: 'app',
      preset: 'jest-expo',
      roots: ['<rootDir>/src'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/engine/', '<rootDir>/src/bot/'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
  // A suite's first screen render loads React Native's components (~2 s cold here, more on CI
  // runners with no transform cache), which can pass Jest's default 5 s on its own.
  testTimeout: 15_000,
  collectCoverageFrom:['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/**/testing/**', '!src/app/**'],
  // 90% line coverage on engine and bot (R-TEST-01).
  coverageThreshold: {
    './src/engine/': { lines: 90 },
    './src/bot/': { lines: 90 },
  },
};
