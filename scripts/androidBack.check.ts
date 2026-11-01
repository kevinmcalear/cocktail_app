import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Android back must reach React Native. Predictive back is on (Kevin, 1 Nov
// 2026), so Android 13+ stops calling onBackPressed, and RN 0.88's
// ReactActivity only registers its own back callback on Android 16+ devices.
// plugins/withPredictiveBack.js adds the same callback on API 33 to 35 and
// switches it off while JS falls through to the default; without it every
// BackHandler (sheets, the add-drink wizard, React Navigation's pop) is
// skipped on 13 to 15 and the app goes to the launcher.
const app = JSON.parse(readFileSync('app.json', 'utf8'));
const config = readFileSync('app.config.ts', 'utf8');
const plugin = readFileSync('plugins/withPredictiveBack.js', 'utf8');
assert.equal(app.expo.android.predictiveBackGestureEnabled, true, 'predictive back is on');
assert.ok(config.includes("'./plugins/withPredictiveBack'"), 'the API 33-35 back callback plugin is wired in app.config.ts');
assert.ok(plugin.includes('SDK_INT in 33..35'), 'the callback covers Android 13 to 15, where React Native adds none');
assert.ok(plugin.includes('backToJs.isEnabled = false'), 'the callback is off while the default runs, so Back cannot loop into JS');

console.log('androidBack ✓');
