// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Edge functions are Deno code with URL and npm: imports; they are type
    // checked with `deno check`, not this config. ios/, android/ and
    // supabase/.temp are generated. .claude/ holds agent worktrees (full copies
    // of the repo) that aren't this checkout's code.
    ignores: ['dist/*', 'ios/**', 'android/**', 'supabase/functions/**', 'supabase/.temp/**', '.claude/**'],
  },
  {
    // React Compiler rules that eslint-plugin-react-hooks 7 (Expo SDK 57) turns
    // on as errors. The compiler skips components that break them rather than
    // miscompiling, so they are warnings until the existing violations are
    // fixed; new code should not add more.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
]);
