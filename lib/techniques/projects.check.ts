import assert from 'node:assert/strict';

import { TECHNIQUES } from './index';
import { labFromNames, labNeeds, projectsFor } from './projects';

const byId = (id: string) => TECHNIQUES.find((t) => t.id === id)!;

// Parts name the lab ingredients; a grade in brackets doesn't hide them.
assert.deepEqual(labNeeds(byId('acid-adjust')), ['citric', 'malic']);
assert.deepEqual(labNeeds(byId('siphon-foam')).sort(), ['gelatin', 'xanthan']);
assert.deepEqual(labNeeds(byId('milk-wash')), []);

// Shelf names become lab ids.
assert.deepEqual([...labFromNames(['Citric Acid', 'Malic Acid', 'London Dry Gin'])].sort(), ['citric', 'malic']);

const ids = (list: { technique: { id: string } }[]) => list.map((p) => p.technique.id);

// No kit, no lab: only what needs nothing, and acid-adjusting is one fine scale away once the acids are in.
const bare = projectsFor(new Set(), new Set());
assert.ok(ids(bare.ready).includes('milk-wash'));
assert.ok(!ids(bare.ready).includes('acid-adjust'));
const awayIds = (list: { techniques: { id: string }[] }[]) => list.flatMap((g) => g.techniques.map((t) => t.id));
assert.ok(!awayIds(bare.away).includes('acid-adjust'), 'three things short is not one away');
const acids = projectsFor(new Set(), new Set(['citric', 'malic']));
const fineScale = acids.away.find((g) => g.missing.id === 'scale-fine');
assert.deepEqual(fineScale?.missing, { kind: 'kit', id: 'scale-fine', name: 'Fine scale (0.01 g)' });
assert.ok(fineScale?.techniques.some((t) => t.id === 'acid-adjust'));
// One group per missing piece, the one that opens most first.
assert.equal(new Set(bare.away.map((g) => g.missing.id)).size, bare.away.length);
assert.ok(bare.away.every((g, i) => i === 0 || bare.away[i - 1].techniques.length >= g.techniques.length));

// With the kit and the acids it's ready, and it sorts above the ones that need nothing.
const ready = projectsFor(new Set(['scale-fine', 'scale']), new Set(['citric', 'malic'])).ready;
assert.ok(ids(ready).indexOf('acid-adjust') < ids(ready).indexOf('milk-wash'));
assert.deepEqual(ready.find((p) => p.technique.id === 'acid-adjust')?.uses, ['Fine scale (0.01 g)', 'Citric acid', 'Malic acid']);

// Gated techniques never show, even with the kit.
const all = projectsFor(new Set(['ln2', 'rotovap', 'whipper']), new Set());
assert.ok(!ids(all.ready).includes('liquid-nitrogen'));
assert.ok(all.ready.every((p) => !p.technique.gate));

console.log('projects: ok');
