// Three projects: the pure engine and bot run in plain Node; the app runs under jest-expo.
const pureProject = (name) => ({
  displayName: name,
  preset: 'jest-expo',
  testEnvironment: 'node',
  roots: [`<rootDir>/src/${name}`],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
});

module.exports = {
  projects: [
    pureProject('engine'),
    pureProject('bot'),
    {
      displayName: 'app',
      preset: 'jest-expo',
      roots: ['<rootDir>/src'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/engine/', '<rootDir>/src/bot/'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/app/**'],
  // 90% line coverage on engine and bot (R-TEST-01).
  coverageThreshold: {
    './src/engine/': { lines: 90 },
    './src/bot/': { lines: 90 },
  },
};
