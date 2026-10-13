import assert from 'node:assert/strict';

import { drinksLine, isPreviewBot, isShareSlug, isUuid, menuVersion, nightLabel, previewHtml, previewMeta, type PreviewDrink, type SharedMenuRow } from './menuPreview';
import { createdBy, drinkKickerFor, drinkLine, drinkPreviewMeta, drinkVersion, madeBy, type PreviewDrinkCard } from './drinkPreview';
import { paintSketch } from './sketch/paint';
import { sceneToSvg } from './sketch/svg';
import type { SketchInputs } from './sketch/types';

// --- who gets the preview page: link-preview bots, never people ---
assert.ok(isPreviewBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0')); // iMessage
assert.ok(isPreviewBot('WhatsApp/2.23.20.0 A'));
assert.ok(isPreviewBot('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'));
assert.ok(isPreviewBot('Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'));
assert.ok(isPreviewBot('TelegramBot (like TwitterBot)'));
assert.ok(!isPreviewBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'));
assert.ok(!isPreviewBot(null));

assert.ok(isUuid('00000000-0000-4000-c000-00000000aa01'));
assert.ok(!isUuid('[id]'));
assert.ok(!isUuid("x' or 1=1"));

// --- readable links (/d/penicillin, /m/halloween-party): share_slug_base()'s shape ---
for (const slug of ['penicillin', 'halloween-party', 'penicillin-0c2b', 'negroni-1929', 'Penicillin']) assert.ok(isShareSlug(slug), slug);
for (const bad of ['', '-penicillin', 'penicillin-', 'pen--icillin', 'pen icillin', 'pénicillin', "x' or 1=1", '../etc', '[id]', 'a'.repeat(101)]) assert.ok(!isShareSlug(bad), bad);
// A uuid is always read as the id, never looked up as a slug.
assert.ok(!isShareSlug('00000000-0000-4000-c000-00000000aa01'));

// --- the words ---
assert.equal(nightLabel('2026-10-31'), 'Saturday 31 October');
assert.equal(nightLabel(null), null);
assert.equal(nightLabel('31/10/2026'), null);

const menu: SharedMenuRow = {
  id: '00000000-0000-4000-c000-00000000aa01',
  name: 'Halloween "party" <3',
  menu_date: '2026-10-31',
  cover_url: null,
  owner: { name: 'Sam', handle: 'sam' },
  sections: [
    { name: 'Drinks', item_ids: ['a', null, 'b'] },
    { name: 'Nightcap', item_ids: [null] },
  ],
};
const drinks: PreviewDrink[] = [
  { id: 'a', name: 'Americano', image_url: null, image_is_generated: false },
  { id: 'b', name: 'Last Word', image_url: null, image_is_generated: false },
];
// Drinks that aren't public are counted, never named.
assert.equal(drinksLine(menu, drinks), 'Americano, Last Word and 2 house drinks');
assert.equal(drinksLine({ ...menu, sections: [{ name: 'Drinks', item_ids: ['a', null] }] }, drinks), 'Americano and a house drink');
assert.equal(drinksLine({ ...menu, sections: [{ name: 'Drinks', item_ids: ['a'] }] }, drinks), 'Americano');

// The image URL changes when what it shows changes, and not otherwise.
assert.equal(menuVersion(menu), menuVersion({ ...menu }));
assert.notEqual(menuVersion(menu), menuVersion({ ...menu, name: 'Halloween' }));
assert.notEqual(menuVersion(menu), menuVersion({ ...menu, sections: [{ name: 'Drinks', item_ids: ['b', 'a'] }] }));

const meta = previewMeta(menu, drinks, 'https://babyvom.it');
assert.equal(meta.title, 'Halloween "party" <3');
assert.equal(meta.description, '4 drinks for Saturday 31 October. A menu on Cocktail.');
assert.equal(previewMeta({ ...menu, menu_date: null, sections: [{ name: 'Drinks', item_ids: ['a'] }] }, drinks, 'https://babyvom.it').description, '1 drink. A menu on Cocktail.');
assert.equal(meta.url, 'https://babyvom.it/m/00000000-0000-4000-c000-00000000aa01');
assert.ok(meta.image.startsWith('https://babyvom.it/api/menu-og?id=00000000-0000-4000-c000-00000000aa01&v='));
// Shared by its slug, the preview names that link; the image still asks by id.
assert.equal(previewMeta(menu, drinks, 'https://babyvom.it', 'halloween-party').url, 'https://babyvom.it/m/halloween-party');

// A menu's name is someone's text: it can't break out of the tags.
const html = previewHtml(meta);
assert.ok(html.includes('<meta property="og:title" content="Halloween &quot;party&quot; &lt;3">'));
assert.ok(!html.includes('"party"'));
assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));

// --- a sketch drawn outside the app is a whole SVG document ---
const inputs: SketchInputs = {
  v: 1, glass: 'coupe', ice: 'none', method: 'shake', liquid: { hex: '#b8c96a', alpha: 0.85 }, foam: 'froth', float: null, bleed: null,
  fizz: false, garnish: 'lime_wheel', from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
};
const svg = sceneToSvg(paintSketch(inputs, { seed: 'last-word' }), { size: 256 });
assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 512 512">'));
assert.ok(svg.endsWith('</svg>'));
assert.ok(!/undefined|NaN/.test(svg));
assert.ok(svg.includes('<linearGradient'));
// Every gradient and clip a shape points at is defined.
for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(svg.includes(`id="${ref}"`), `missing #${ref}`);
// The same drink and seed always draw the same.
assert.equal(svg, sceneToSvg(paintSketch(inputs, { seed: 'last-word' }), { size: 256 }));


// --- a drink's preview (lib/drinkPreview.ts) ---
const penicillin: PreviewDrinkCard = {
  id: '0c2bead3-1ed9-4b1d-b79d-073f85eef5d2',
  name: 'Penicillin',
  description: 'Scotch, lemon, honey-ginger, an Islay float.',
  origin: 'Modern Classic',
  origin_year: 2005,
  riff_of_id: null,
  bar_id: null,
  publish_mode: 'description',
  image_url: null,
  image_is_generated: null,
  creator: 'Sam Ross',
  bar: 'Milk & Honey',
  ingredients: [],
};
const drinkMeta = drinkPreviewMeta(penicillin, 'https://babyvom.it');
assert.equal(drinkMeta.title, 'Penicillin');
assert.equal(drinkMeta.description, 'Scotch, lemon, honey-ginger, an Islay float. Sam Ross, 2005. On Cocktail.');
assert.equal(drinkMeta.url, 'https://babyvom.it/d/0c2bead3-1ed9-4b1d-b79d-073f85eef5d2');
assert.equal(drinkPreviewMeta(penicillin, 'https://babyvom.it', 'penicillin').url, 'https://babyvom.it/d/penicillin');
assert.ok(drinkMeta.image.startsWith('https://babyvom.it/api/drink-og?id=0c2bead3-1ed9-4b1d-b79d-073f85eef5d2&v='));
assert.equal(createdBy(penicillin), 'Created by Sam Ross · Milk & Honey');
assert.equal(drinkKickerFor(penicillin), 'Modern classic · 2005');
// A shared spec names its ingredients; a bar's own drink is "Little Rye original".
const shared = { ...penicillin, ingredients: ['Scotch', 'Lemon', 'Honey Syrup'], bar_id: 'b', bar: 'Little Rye', creator: null, origin: 'Original', origin_year: null };
assert.equal(drinkLine(shared), 'Scotch, lemon, honey syrup');
assert.equal(madeBy(shared), 'Little Rye');
assert.equal(drinkKickerFor(shared), 'Little Rye original');
assert.notEqual(drinkVersion(penicillin), drinkVersion(shared));

console.log('menuPreview: ok');
