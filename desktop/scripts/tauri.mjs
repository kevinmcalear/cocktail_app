#!/usr/bin/env node
// Runs the Tauri CLI with the app's own brand: the product name comes from
// constants/brand.json and the icons are generated from assets/images/icon.png,
// so the desktop app can't drift from web and mobile. Everything after the
// script name is passed through, e.g. `node scripts/tauri.mjs build --debug`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = join(desktopDir, '..');
const iconSource = join(repoDir, 'assets/images/icon.png');
const iconsDir = join(desktopDir, 'src-tauri/icons');
const bin = join(desktopDir, 'node_modules/.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');

if (!existsSync(bin)) {
  console.error('Tauri CLI not installed. Run `npm --prefix desktop ci` first.');
  process.exit(1);
}

function tauri(args) {
  const result = spawnSync(bin, args, {
    cwd: desktopDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const args = process.argv.slice(2);
const command = args[0];

// --- icons: regenerate when missing or older than the source ---
const builtIcon = join(iconsDir, 'icon.icns');
if (
  (command === 'dev' || command === 'build') &&
  (!existsSync(builtIcon) || statSync(builtIcon).mtimeMs < statSync(iconSource).mtimeMs)
) {
  tauri(['icon', iconSource, '--output', iconsDir]);
}

// --- product name: merged over tauri.conf.json ---
if (command === 'dev' || command === 'build') {
  const brand = JSON.parse(readFileSync(join(repoDir, 'constants/brand.json'), 'utf8'));
  args.push('--config', JSON.stringify({ productName: brand.productName }));
}

tauri(args);
