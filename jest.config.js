// https://docs.expo.dev/develop/unit-testing/
module.exports = {
  preset: 'jest-expo',
  // jest-expo's list plus Tamagui, which ships untranspiled ESM. The prefixes
  // already cover expo-* and react-native-* packages.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|tamagui|@tamagui))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  // Jest's default also matches `test.tsx`, which is a route in app/(tabs).
  testMatch: ['**/*.test.[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.tsx'],
};
