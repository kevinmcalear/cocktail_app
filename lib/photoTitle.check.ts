// Checks for the photo scan and where the title goes, on real photos (the
// mid-tone rail, themes-midtone: "trust the rail, check real photos").
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { decode } from 'jpeg-js';

import { backbar } from '@/constants/tokens';
import { asTextZone, readPhotoLayout, shrinkForLayout } from '@/supabase/functions/_shared/photoLayout';

import { LIGHT_PHOTO } from './itemImages';
import { TITLE_ROOM, titleReads, titleSpot } from './photoTitle';

function scan(path: string) {
  const { data, width, height } = decode(readFileSync(path), { useTArray: true, formatAsRGBA: true });
  const small = shrinkForLayout(data, width, height);
  return readPhotoLayout(small.rgba, small.width, small.height);
}
const cream = backbar.dark.muted;
const ink = backbar.light.muted;

// A dark photo: the room is above the glass, and only there.
const martini = scan('assets/images/cocktails/house_martini.jpg');
assert.ok(martini.brightness < LIGHT_PHOTO, 'a dark photo stays dark');
assert.ok(martini.textZone, 'room above the glass');
assert.ok(martini.textZone.bottom <= 0.14, `the room stops above the rim (${martini.textZone.bottom})`);
assert.ok(titleReads(cream, martini.textZone), 'cream reads on the dark wall');

// A busy mid-tone room: no quiet room, and it doesn't make a light page.
const window = scan('assets/images/cocktails/mulholland_drive.jpg');
assert.ok(window.brightness > 0.4 && window.brightness < LIGHT_PHOTO, `mid-tone (${window.brightness})`);
assert.equal(window.textZone, null);

// Every mid-tone photo we have: the same.
for (const name of ['bolo_tie', 'champ_stamp', 'champagne_pina_colada', 'midori_splice', 'mr_blonde_milk_punch', 'nod_to_nothing']) {
  const { brightness, textZone } = scan(`assets/images/cocktails/${name}.jpg`);
  assert.ok(brightness < LIGHT_PHOTO, `${name} is not bright (${brightness})`);
  assert.equal(textZone, null, `${name} has no room`);
}

// A bright page: the room never crosses a thin stem (one cell wide at the scan's scale).
const white = scan('assets/images/wines/crisp_white.jpg');
assert.ok(white.brightness >= LIGHT_PHOTO, 'a bright photo makes a light page');
assert.ok(white.textZone && white.textZone.bottom < 0.15, `room only above the glass (${white.textZone?.bottom}), not beside the stem`);
assert.ok(white.textZone && titleReads(ink, white.textZone), 'dark ink reads on paper');

// The rail: a mid-tone room fails in either ink, so the title goes under the photo.
assert.equal(titleReads(cream, { top: 0, bottom: 0.4, light: 0.6 }), false);
assert.equal(titleReads(ink, { top: 0, bottom: 0.4, light: 0.45 }), false);
assert.equal(titleReads(cream, { top: 0, bottom: 0.4, light: 0.15 }), true);

const zone = { top: 0.02, bottom: 0.5, light: 0.1 };
type Room = { zone?: typeof zone | null; aspect?: number | null };
const one = (room: Room = {}) => [{ zone, aspect: 4 / 5, ...room }];
const phone = { width: 390, from: 110, muted: cream };
const top = (spot: { top: number } | null) => spot?.top ?? null;
// The board's 585 frame shows the whole of a 4:5 photo's height: room from under the bar.
assert.deepEqual(titleSpot({ ...phone, photos: one(), height: 585, to: 505 }), { top: 110, bottom: 293 });
// Today's 30% hero: cover crops the top of a 4:5 photo and leaves no 150 points of room.
assert.equal(titleSpot({ ...phone, photos: one(), height: 286, to: 206 }), null);
// Desktop's panel: the full height of the photo.
const desk = { width: 500, height: 900, from: 76, to: 900, muted: cream };
assert.equal(top(titleSpot({ ...desk, photos: one() })), 76);
// Room too short once it's clear of the bar.
assert.equal(titleSpot({ ...phone, photos: one({ zone: { ...zone, bottom: 0.3 } }), height: 585, to: 505 }), null);
assert.equal(TITLE_ROOM, 150);
// No room found, a room the ink can't read on, and an unknown size taken as 4:5.
assert.equal(titleSpot({ ...phone, photos: one({ zone: null }), height: 585, to: 505 }), null);
assert.equal(titleSpot({ ...phone, photos: one({ zone: { ...zone, light: 0.6 } }), height: 585, to: 505 }), null);
assert.equal(top(titleSpot({ ...phone, photos: one({ aspect: null }), height: 585, to: 505 })), 110);
// Several photos: the title stays put as they swipe, so only the room they all share counts.
assert.deepEqual(titleSpot({ ...desk, photos: [...one(), ...one({ zone: { ...zone, top: 0.1, bottom: 0.4 } })] }), { top: 90, bottom: 360 });
assert.equal(titleSpot({ ...desk, photos: [...one(), ...one({ zone: { ...zone, top: 0.45, bottom: 0.9 } })] }), null);
assert.equal(titleSpot({ ...desk, photos: [...one(), ...one({ zone: null })] }), null);
assert.equal(titleSpot({ ...desk, photos: [] }), null);

// The column as the app reads it.
assert.deepEqual(asTextZone({ top: 0, bottom: 0.2, light: 0.1 }), { top: 0, bottom: 0.2, light: 0.1 });
assert.equal(asTextZone(null), null);
assert.equal(asTextZone({ top: 0.5, bottom: 0.2, light: 0.1 }), null);
assert.equal(asTextZone('quiet'), null);
