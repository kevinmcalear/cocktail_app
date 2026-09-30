// Checks for lib/drinkStyles.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { findKinds, spiritsOf, stylesOf } from './drinkStyles';

const d = (name: string, description = '', ingredients: string[] = [], riffOf: string | null = null) => ({ name, description, ingredients, riffOf });

// --- styles: from the classic it riffs on, its name, its build, its description ---
assert.deepEqual(stylesOf(d('Za’atar Martini', '', [], 'Martini')), ['martini']);
assert.ok(stylesOf(d('Mezcal Negroni')).includes('negroni'));
assert.ok(!stylesOf(d('Espresso Martini')).includes('martini'), 'an Espresso Martini is not a Martini');
assert.ok(stylesOf(d('Espresso Martini')).includes('espresso-martini'));
assert.ok(stylesOf(d('Gimme Gimlet', 'Roku gin with a peach cordial, a take on the Gimlet.')).includes('sour'));
assert.ok(stylesOf(d('Lavender Milk', 'Negroni variation with lavender and milk.')).includes('negroni'));
assert.ok(!stylesOf(d('Cloud', 'Served in a Martini glass with a gin float.')).includes('martini'), 'a glass is not a style');
assert.ok(stylesOf(d('Benton’s Old Fashioned')).includes('old-fashioned'));
assert.ok(stylesOf(d('Boulevardier')).includes('negroni'));
assert.ok(stylesOf(d('Anything', '', ['Rye', 'Lemon Juice', 'Simple Syrup'])).includes('sour'));
assert.ok(!stylesOf(d('Anything', '', ['Gin', 'Lemon Juice', 'Simple Syrup', 'Soda Water'])).includes('sour'), 'a topped drink is a highball, not a sour');
assert.ok(stylesOf(d('Anything', '', ['Gin', 'Lemon Juice', 'Simple Syrup', 'Soda Water'])).includes('highball'));
assert.ok(stylesOf(d('Anything', '', ['Aperol', 'Prosecco', 'Soda Water'])).includes('spritz'));
assert.ok(!stylesOf(d('Anything', '', ['Aperol', 'Prosecco', 'Soda Water'])).includes('highball'), 'bubbles make it a spritz');
assert.ok(stylesOf(d('Garden', 'Also offered alcohol-free.')).includes('zero-proof'));
assert.ok(!stylesOf(d('Anything', '', ['Lemon Twist', 'Gin', 'Sweet Vermouth'])).includes('sour'), 'a twist is not citrus juice');

// --- spirits: lines first, then words ---
assert.deepEqual(spiritsOf(d('Gimme Gimlet', 'Roku gin with peach cordial', ['Roku Gin', 'Gin', 'Peach Cordial'])), ['gin']);
assert.deepEqual(spiritsOf(d('Silent Sky', 'Cognac drink with mustard, golden turnip, Riesling and honey.')), ['brandy']);
assert.deepEqual(spiritsOf(d('Ginger Snap', 'Vodka with ginger syrup')), ['vodka'], 'ginger is not gin');
assert.deepEqual(spiritsOf(d('Paloma', '', ['Blanco Tequila', 'Grapefruit Soda'])), ['agave']);
assert.ok(!spiritsOf(d('X', '', ['Agave Syrup', 'Rye'])).includes('agave'), 'agave syrup is not tequila');
assert.deepEqual(spiritsOf(d('X', '', ['Añejo Rum'])), ['rum'], 'an añejo rum is rum');
assert.deepEqual(spiritsOf(d('Negroni', '', ['Gin', 'Campari', 'Sweet Vermouth'])), ['gin', 'aperitivo']);
assert.deepEqual(spiritsOf(d('Sakura', 'Junmai sake with ume')), ['sake']);

// --- findKinds: labels and classics by word prefix ---
assert.deepEqual(findKinds('gin').map((k) => k.id), ['gin']);
assert.deepEqual(findKinds('marg').map((k) => k.id), ['margarita']);
assert.deepEqual(findKinds('boulevardier').map((k) => k.id), ['negroni']);
assert.deepEqual(findKinds('mezcal').map((k) => k.id), ['agave']);
assert.deepEqual(findKinds('g'), [], 'one letter finds nothing');
assert.ok(!stylesOf(d('Mole Negroni', '', ['Mezcal', 'Chocolate Bitters', 'Campari'])).includes('highball'), 'chocolate is not cola');
