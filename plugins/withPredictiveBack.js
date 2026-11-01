// Predictive back on Android 13 to 15 (Kevin, 1 Nov 2026: "Add the native fix").
//
// With android:enableOnBackInvokedCallback="true", Android 13+ stops calling
// Activity.onBackPressed. React Native 0.88's ReactActivity only adds its own
// OnBackPressedDispatcher callback when the device and targetSdk are 36+, so on
// 13 to 15 Back skipped JS entirely (sheets, the wizard and stack pops were
// ignored; the app went to the launcher). This adds the same callback on API
// 33 to 35 and switches it off while JS falls through to the default, so the
// default can't loop back into JS. Android 16 keeps React Native's own.
// ponytail: drop this once React Native registers its callback on API 33+.
const { withMainActivity } = require('expo/config-plugins');

const MARK = '// predictive back on API 33-35 (plugins/withPredictiveBack.js)';

function withPredictiveBack(config) {
  return withMainActivity(config, (mod) => {
    let src = mod.modResults.contents;
    if (src.includes(MARK)) return mod;
    if (mod.modResults.language !== 'kt') throw new Error('withPredictiveBack expects a Kotlin MainActivity');
    src = src.replace('import android.os.Bundle\n', 'import android.os.Bundle\nimport androidx.activity.OnBackPressedCallback\n');
    src = src.replace(
      'class MainActivity : ReactActivity() {\n',
      `class MainActivity : ReactActivity() {
  ${MARK}
  private val backToJs = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      isEnabled = false
      onBackPressed()
      isEnabled = true
    }
  }

`
    );
    src = src.replace(
      '    super.onCreate(null)\n',
      `    super.onCreate(null)
    if (Build.VERSION.SDK_INT in 33..35) onBackPressedDispatcher.addCallback(this, backToJs)
`
    );
    src = src.replace(
      '  override fun invokeDefaultOnBackPressed() {\n',
      `  override fun invokeDefaultOnBackPressed() {
      // JS let Back through: off while the default runs, or it calls back into JS.
      backToJs.isEnabled = false
      try {
        defaultBack()
      } finally {
        backToJs.isEnabled = true
      }
  }

  private fun defaultBack() {
`
    );
    for (const needle of ['backToJs)', 'private val backToJs', 'private fun defaultBack()']) {
      if (!src.includes(needle)) throw new Error(`withPredictiveBack: MainActivity changed shape (${needle} missing)`);
    }
    mod.modResults.contents = src;
    return mod;
  });
}

module.exports = withPredictiveBack;
