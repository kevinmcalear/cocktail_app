import assert from 'node:assert/strict';

import { iconBackground } from '../supabase/functions/_shared/iconBackground';

const venue = { icon_background: null, primary_color: '#D0643B', ground_tint: '#1A1410' } as const;

// Nothing picked: the logo keeps its own corner colour.
assert.equal(iconBackground(venue), null);
// Rust, Walnut, Cream: the accent, the dark ground, cream, each opaque.
assert.equal(iconBackground({ ...venue, icon_background: 'accent' }), 0xd0643bff);
assert.equal(iconBackground({ ...venue, icon_background: 'ground' }), 0x1a1410ff);
assert.equal(iconBackground({ ...venue, icon_background: 'cream' }), 0xf3eee6ff);
// No accent or tint of its own: the app's.
assert.equal(iconBackground({ icon_background: 'accent', primary_color: null, ground_tint: null }), 0xe4b062ff);
assert.equal(iconBackground({ icon_background: 'ground', primary_color: null, ground_tint: null }), 0x0e0d0cff);
// A stored value that isn't a colour never reaches the drawing.
assert.equal(iconBackground({ icon_background: 'accent', primary_color: 'red', ground_tint: null }), null);

console.log('iconBackground: ok');
