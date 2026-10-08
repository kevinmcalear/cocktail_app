import assert from 'node:assert/strict';

import { kindForCopy, matchIngredient, matchKey, matchName, type CatalogItem, type Match } from './match';

const item = (id: string, name: string, genericId: string | null = null, barId: string | null = null): CatalogItem => ({ id, name, genericId, barId });
const catalog: CatalogItem[] = [
  item('gin', 'Gin'),
  item('ldg', 'London Dry Gin', 'gin'),
  item('sv', 'Sweet Vermouth'),
  item('simple', 'Simple Syrup'),
  item('bee', 'Beefeater Gin', 'gin'),
  item('bee-ldg', 'Beefeater London Dry Gin', 'ldg'),
  item('bee-pink', 'Beefeater Pink Strawberry Gin', 'gin'),
  item('roku', 'Roku', 'gin'),
  item('campari', 'Campari'),
  item('campari-2', 'Campari', 'bitter'),
  item('coffee-campari', 'Coffee-Infused Campari', 'campari'),
  item('cpa', 'Carpano Antica Formula Sweet Vermouth', 'sv'),
  item('cpa-2', 'Carpano Antica Sweet Vermouth', 'sv'),
  item('cp-v', 'Carpano Vermouth'),
  item('cp-r', 'Carpano Rosso', 'sv'),
  item('hampden', 'Hampden Estate 8 Year Old Rum'),
  item('codigo', 'Codigo 1530 Blanco Tequila'),
  item('tq-ten', 'Tanqueray No. Ten', 'gin'),
  item('venue-bee', 'Beefeater Gin', 'gin', 'bar-1'),
  item('other-venue', 'Pocket Fox Brandy', null, 'bar-2'),
];
const aliases = [{ key: '1:1 sugar syrup', item_id: 'simple' }];
const id = (m: Match) => (m.kind === 'one' ? m.item.id : m.kind === 'pick' ? m.items.map((i) => i.id) : `none:${m.kindItem?.id ?? ''}`);

// One key for everything: the database's, plus label spellings.
assert.equal(matchKey('Código 1530 Añejo'), 'codigo 1530 anejo');
assert.equal(matchKey('Hampden Estate 8 Years Old'), 'hampden estate 8yo');
assert.equal(matchKey('Hampden 8-year-old'), 'hampden 8yo');
assert.equal(matchKey('Tanqueray Nº Ten'), 'tanqueray no ten');
assert.equal(matchKey("Warre's"), 'warres');
assert.equal(matchKey('Rye & Fig'), 'rye and fig');
assert.equal(matchKey('1:1 Sugar Syrup'), '1:1 sugar syrup');

// Drinks by name: "&" and "and", accents and spacing don't matter; two of one name is a pick.
assert.equal(id(matchName('Rye and Fig Old Fashioned', [item('a', 'Rye & Fig Old Fashioned')]) as Match), 'a');
assert.equal(matchName('Martini', [{ name: 'Martini' }, { name: 'Martini' }]).kind, 'pick');
assert.equal(matchName('', [{ name: '' }]).kind, 'none');

// A typed name: the same name, the venue's own copy first, else another name for one.
assert.equal(id(matchIngredient('gin', catalog, null)), 'gin');
assert.equal(id(matchIngredient('Beefeater Gin', catalog, 'bar-1')), 'venue-bee');
assert.equal(id(matchIngredient('1:1 sugar syrup', catalog, null, aliases)), 'simple');
assert.equal(id(matchIngredient('1:1 sugar syrup', catalog, null)), 'none:');
assert.equal(id(matchIngredient('Tanqueray Nº Ten', catalog, null)), 'tq-ten');
// Not there: the kind it is, the most specific one the name contains.
assert.equal(id(matchIngredient('Roku Gin', catalog, null)), 'none:gin');
assert.equal(id(matchIngredient('Sipsmith London Dry Gin', catalog, null)), 'none:ldg');
// A kind only known through the venue's bottles: which bottle. Other venues' items never count.
const venueOnly = [item('beef', 'Beefeater', 'gin-x', 'bar'), item('tanq', 'Tanqueray', 'gin-x', 'bar'), item('gin-x', 'Gin', null, 'other')];
assert.deepEqual(id(matchIngredient('Gin', venueOnly, 'bar')), ['beef', 'tanq']);
assert.equal(id(matchIngredient('Pocket Fox Brandy', catalog, 'bar-1')), 'none:');

// A label: the fullest name the label covers wins; generics never do, they carry no brand.
assert.equal(id(matchIngredient({ brand: 'Beefeater', name: 'Beefeater London Dry Gin', kind: 'London dry gin' }, catalog, null)), 'bee-ldg');
assert.equal(id(matchIngredient({ brand: 'Beefeater', name: 'Beefeater', kind: 'Gin' }, catalog, null)), 'bee');
// Exact repeats collapse to the one other items name as their kind.
assert.equal(id(matchIngredient({ brand: 'Campari', name: 'Campari', kind: 'Bitter aperitivo' }, catalog, null)), 'campari');
// Infusions and flavours whose words aren't on the label never match.
assert.equal(id(matchIngredient({ brand: 'Campari', name: 'Campari Bitter', kind: 'Aperitivo' }, catalog, null)), 'campari');
// Word order, accents and age statements don't matter.
assert.equal(id(matchIngredient({ brand: 'Código', name: 'Código 1530 Tequila Blanco', kind: 'Blanco tequila' }, catalog, null)), 'codigo');
assert.equal(id(matchIngredient({ brand: 'Hampden Estate', name: 'Hampden Estate Pure Single Jamaican Rum Aged 8 Years', kind: 'Jamaican rum' }, catalog, null)), 'hampden');
assert.equal(id(matchIngredient({ brand: 'Carpano', name: 'Carpano Antica Formula', kind: 'Sweet vermouth' }, catalog, null)), 'cpa');
// A long name missing one word, tied with a short one: someone picks, best first.
assert.deepEqual(id(matchIngredient({ brand: 'Carpano', name: 'Carpano Antica Formula', kind: 'Vermouth' }, catalog, null)), ['cpa', 'cp-v', 'cpa-2']);
// The venue's own copy wins over the shared one; other venues' items never show.
assert.equal(id(matchIngredient({ brand: 'Beefeater', name: 'Beefeater Gin', kind: 'Gin' }, catalog, 'bar-1')), 'venue-bee');
assert.equal(id(matchIngredient({ brand: 'Pocket Fox', name: 'Pocket Fox Brandy', kind: 'Brandy' }, catalog, 'bar-1')), 'none:');
// Not in the catalog: the plain kind, the most specific one inside the words.
assert.equal(id(matchIngredient({ brand: 'Sipsmith', name: 'Sipsmith London Dry Gin', kind: 'London dry gin' }, catalog, null)), 'none:ldg');
assert.equal(id(matchIngredient({ brand: 'Sipsmith', name: 'Sipsmith VJOP', kind: 'Navy strength gin' }, catalog, null)), 'none:gin');
assert.equal(id(matchIngredient({ brand: null, name: 'Something Unreadable', kind: null }, catalog, null)), 'none:');

// The point of one matcher: a label and the same words typed agree.
for (const name of ['Campari', 'Beefeater Gin', 'Codigo 1530 Blanco Tequila', 'Gin']) {
  for (const venue of [null, 'bar-1']) {
    assert.deepEqual(id(matchIngredient(name, catalog, venue)), id(matchIngredient({ name, brand: name.split(' ')[0], kind: null }, catalog, venue)), `${name} at ${venue}`);
  }
}

assert.equal(kindForCopy(item('a', 'Beefeater Gin', 'gin')), 'gin');
assert.equal(kindForCopy(item('campari', 'Campari')), 'campari');

console.log('match: ok');
