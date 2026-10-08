import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The web map loads maplibre's stylesheet from public/ when it opens
// (components/screens/home/DiscoverMap.web.tsx). Importing it from JS made
// Expo link it, render-blocking, on every page. The copy must match the
// installed maplibre-gl, so refresh it after an upgrade:
//   cp node_modules/maplibre-gl/dist/maplibre-gl.css public/maplibre-gl.css
const installed = readFileSync('node_modules/maplibre-gl/dist/maplibre-gl.css', 'utf8');
const copy = readFileSync('public/maplibre-gl.css', 'utf8');
assert.equal(copy, installed, 'public/maplibre-gl.css is out of date with node_modules/maplibre-gl; copy it again');

console.log('maplibreCss.check: ok');
