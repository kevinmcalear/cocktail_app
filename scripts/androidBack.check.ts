import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Android back must reach React Native. With predictiveBackGestureEnabled the
// manifest opts in to OnBackInvokedCallback, so Android 13-15 stop calling
// onBackPressed, and RN 0.88's ReactActivity only registers its own back
// callback on Android 16+ devices. Back then skips JS entirely: every BackHandler
// (sheets, the add-drink wizard, React Navigation's pop) is ignored and the app
// goes to the launcher. Android 16 with targetSdk 36 gets predictive back anyway.
// ponytail: turn it back on once ReactActivity registers its callback on API 33+.
const app = JSON.parse(readFileSync('app.json', 'utf8'));
assert.notEqual(app.expo.android.predictiveBackGestureEnabled, true, 'predictiveBackGestureEnabled breaks back on Android 13-15');

console.log('androidBack ✓');
