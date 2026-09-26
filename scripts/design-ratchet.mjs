// Design ratchet: raw colours, font sizes and corner radii belong in the design
// tokens, not in screens; screens get data through hooks/, not Supabase; no new
// `any`; and screen files stay small enough for a person or an agent to hold in
// their head. The codebase predates both rules, so instead of
// failing on every existing violation this compares against a checked-in
// baseline and fails only when a file gets worse.
//
//   node scripts/design-ratchet.mjs            check (CI)
//   node scripts/design-ratchet.mjs --update   rewrite the baseline after fixing things
//
// ponytail: counts are per file, so fixing one raw value and adding another in
// the same file passes. Good enough to stop the drift; tighten to per-line if
// that loophole gets used.
import { readFileSync, writeFileSync, globSync } from 'node:fs';
import { ESLint } from 'eslint';
import tsParser from '@typescript-eslint/parser';

const BASELINE = 'scripts/design-ratchet.baseline.json';
const MAX_LINES = 300;
const SOURCES = '{app,components,hooks,lib,store,ctx}/**/*.{ts,tsx}';
// Where raw values are allowed: the token sources themselves, and scripts.
const TOKEN_FILES = ['constants/**', 'tamagui.config.ts', '**/*.check.ts', '**/*.selfcheck.ts', '**/*.test.*'];

const RAW_NUMBER = '/^(?!0$)[0-9.]/';
const RULES = [
  ['Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]', 'Raw hex colour: use a theme token ($color, $background, ...) or constants/palette.ts.'],
  ['Literal[value=/^(?:rgba?|hsla?)\\(/i]', 'Raw rgb/hsl colour: use a theme token or constants/palette.ts.'],
  [`Property[key.name="fontSize"][value.raw=${RAW_NUMBER}]`, 'Raw font size: use a type token ($1...$9) or a text style.'],
  [`JSXAttribute[name.name="fontSize"] > JSXExpressionContainer > Literal[raw=${RAW_NUMBER}]`, 'Raw font size: use a type token ($1...$9) or a text style.'],
  [`Property[key.name=/^(?:br|borderRadius|border(?:Top|Bottom)(?:Left|Right)Radius)$/][value.raw=${RAW_NUMBER}]`, 'Raw corner radius: use a radius token.'],
  [`JSXAttribute[name.name=/^(?:br|borderRadius|border(?:Top|Bottom)(?:Left|Right)Radius)$/] > JSXExpressionContainer > Literal[raw=${RAW_NUMBER}]`, 'Raw corner radius: use a radius token.'],
  ['TSAnyKeyword', 'No `any`: type it (see types/ and the generated Supabase types).'],
].map(([selector, message]) => ({ selector, message }));

// Screens and components get data through TanStack Query hooks in hooks/.
const UI_RULES = [
  ['MemberExpression[object.name="supabase"][property.name=/^(?:from|rpc|storage|functions)$/]', 'Supabase call in UI: move it into a hook in hooks/.'],
].map(([selector, message]) => ({ selector, message }));

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx}'],
      ignores: TOKEN_FILES,
      languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
      rules: { 'no-restricted-syntax': ['error', ...RULES] },
    },
    {
      files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
      ignores: TOKEN_FILES,
      rules: { 'no-restricted-syntax': ['error', ...RULES, ...UI_RULES] },
    },
  ],
});

const files = globSync(SOURCES).sort();
const results = await eslint.lintFiles(files);

const current = { violations: {}, longFiles: {} };
for (const r of results) {
  const file = r.filePath.slice(process.cwd().length + 1);
  const count = r.messages.filter((m) => m.ruleId === 'no-restricted-syntax').length;
  if (count) current.violations[file] = count;
  const fatal = r.messages.find((m) => m.fatal);
  if (fatal) throw new Error(`${file}: ${fatal.message}`);
}
for (const file of files) {
  if (!file.endsWith('.tsx')) continue;
  const lines = readFileSync(file, 'utf8').split('\n').length;
  if (lines > MAX_LINES) current.longFiles[file] = lines;
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  const total = Object.values(current.violations).reduce((a, b) => a + b, 0);
  console.log(`Baseline written: ${total} violations in ${Object.keys(current.violations).length} files, ${Object.keys(current.longFiles).length} files over ${MAX_LINES} lines.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
const worse = [];
const better = [];
for (const [file, count] of Object.entries(current.violations)) {
  const before = baseline.violations[file] ?? 0;
  if (count > before) worse.push(`${file}: ${before} -> ${count} violations (raw colour/size/radius, any, or Supabase in UI)`);
}
for (const [file, lines] of Object.entries(current.longFiles)) {
  const before = baseline.longFiles[file];
  if (before === undefined) worse.push(`${file}: ${lines} lines, over the ${MAX_LINES}-line limit for screen files`);
  else if (lines > before) worse.push(`${file}: grew from ${before} to ${lines} lines; it's already over ${MAX_LINES}, split it instead`);
}
for (const [file, count] of Object.entries(baseline.violations)) {
  if ((current.violations[file] ?? 0) < count) better.push(file);
}

if (better.length) {
  console.log(`${better.length} file(s) improved. Run \`npm run check:design -- --update\` to lock that in.`);
}
if (worse.length) {
  console.error(`Design ratchet failed. New code must use design tokens, typed data from hooks/, and small screen files:\n  ${worse.join('\n  ')}`);
  console.error('\nSee docs/design_system.md. Line-level detail: npx eslint --rule ... is noisy, so open the file and search for the raw value.');
  process.exit(1);
}
console.log('Design ratchet passed.');
