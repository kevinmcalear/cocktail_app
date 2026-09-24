// Writes dist/manifest.webmanifest for the network web app from
// constants/brand.json, so "Add to Home Screen" / "Install app" shows the
// product's name and icon. Run after `expo export -p web` (see build:web).
import { readFileSync, writeFileSync } from 'node:fs';

const brand = JSON.parse(readFileSync('constants/brand.json', 'utf8'));

const manifest = {
  name: brand.productName,
  short_name: brand.productName,
  description: 'Recipes, menus and staff training for bars.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#161618',
  theme_color: '#161618',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

writeFileSync('dist/manifest.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);
console.log('wrote dist/manifest.webmanifest');
