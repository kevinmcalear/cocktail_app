import assert from 'node:assert/strict';

import { bottleKey, kindForCopy, matchBottle } from './bottleMatch';
import type { CatalogItem } from './paste';

const item = (id: string, name: string, genericId: string | null = null, barId: string | null = null): CatalogItem => ({ id, name, genericId, barId });
const catalog: CatalogItem[] = [
  item('gin', 'Gin'),
  item('ldg', 'London Dry Gin', 'gin'),
  item('sv', 'Sweet Vermouth'),
  item('bee', 'Beefeater Gin', 'gin'),
  item('bee-ldg', 'Beefeater London Dry Gin', 'ldg'),
  item('bee-pink', 'Beefeater Pink Strawberry Gin', 'gin'),
  item('campari', 'Campari'),
  item('campari-2', 'Campari', 'bitter'),
  item('coffee-campari', 'Coffee-Infused Campari', 'campari'),
  item('cpa', 'Carpano Antica Formula Sweet Vermouth', 'sv'),
  item('cpa-2', 'Carpano Antica Sweet Vermouth', 'sv'),
  item('cp-v', 'Carpano Vermouth'),
  item('cp-r', 'Carpano Rosso', 'sv'),
  item('hampden', 'Hampden Estate 8 Year Old Rum'),
  item('codigo', 'Codigo 1530 Blanco Tequila'),
  item('venue-bee', 'Beefeater Gin', 'gin', 'bar-1'),
  item('other-venue', 'Pocket Fox Brandy', null, 'bar-2'),
];
const id = (m: ReturnType<typeof matchBottle>) => (m.kind === 'one' ? m.item.id : m.kind === 'pick' ? m.items.map((i) => i.id) : `none:${m.kindItem?.id ?? ''}`);

assert.equal(bottleKey('Código 1530 Añejo'), 'codigo 1530 anejo');
assert.equal(bottleKey('Hampden Estate 8 Years Old'), 'hampden estate 8yo');
assert.equal(bottleKey('Hampden 8-year-old'), 'hampden 8yo');
assert.equal(bottleKey('Tanqueray Nº Ten'), 'tanqueray no ten');
assert.equal(bottleKey("Warre's"), 'warres');

// The fullest name the label covers wins; generics never do, they carry no brand.
assert.equal(id(matchBottle({ brand: 'Beefeater', name: 'Beefeater London Dry Gin', kind: 'London dry gin' }, catalog, null)), 'bee-ldg');
assert.equal(id(matchBottle({ brand: 'Beefeater', name: 'Beefeater', kind: 'Gin' }, catalog, null)), 'bee');
// Exact repeats collapse to the one other items name as their kind.
assert.equal(id(matchBottle({ brand: 'Campari', name: 'Campari', kind: 'Bitter aperitivo' }, catalog, null)), 'campari');
// Infusions and flavours whose words aren't on the label never match.
assert.equal(id(matchBottle({ brand: 'Campari', name: 'Campari Bitter', kind: 'Aperitivo' }, catalog, null)), 'campari');
// Word order, accents and age statements don't matter.
assert.equal(id(matchBottle({ brand: 'Código', name: 'Código 1530 Tequila Blanco', kind: 'Blanco tequila' }, catalog, null)), 'codigo');
assert.equal(id(matchBottle({ brand: 'Hampden Estate', name: 'Hampden Estate Pure Single Jamaican Rum Aged 8 Years', kind: 'Jamaican rum' }, catalog, null)), 'hampden');
assert.equal(id(matchBottle({ brand: 'Carpano', name: 'Carpano Antica Formula', kind: 'Sweet vermouth' }, catalog, null)), 'cpa');
// A long name missing one word, tied with a short one: someone picks, best first.
assert.deepEqual(id(matchBottle({ brand: 'Carpano', name: 'Carpano Antica Formula', kind: 'Vermouth' }, catalog, null)), ['cpa', 'cp-v', 'cpa-2']);

// The venue's own copy wins over the shared one; other venues' items never show.
assert.equal(id(matchBottle({ brand: 'Beefeater', name: 'Beefeater Gin', kind: 'Gin' }, catalog, 'bar-1')), 'venue-bee');
assert.equal(id(matchBottle({ brand: 'Beefeater', name: 'Beefeater Gin', kind: 'Gin' }, catalog, null)), 'bee');
assert.equal(id(matchBottle({ brand: 'Pocket Fox', name: 'Pocket Fox Brandy', kind: 'Brandy' }, catalog, 'bar-1')), 'none:');

// Not in the catalog: the plain kind, the most specific one inside the words.
assert.equal(id(matchBottle({ brand: 'Sipsmith', name: 'Sipsmith London Dry Gin', kind: 'London dry gin' }, catalog, null)), 'none:ldg');
assert.equal(id(matchBottle({ brand: 'Sipsmith', name: 'Sipsmith VJOP', kind: 'Navy strength gin' }, catalog, null)), 'none:gin');
assert.equal(id(matchBottle({ brand: null, name: 'Something Unreadable', kind: null }, catalog, null)), 'none:');

assert.equal(kindForCopy(item('a', 'Beefeater Gin', 'gin')), 'gin');
assert.equal(kindForCopy(item('campari', 'Campari')), 'campari');

console.log('bottleMatch: ok');
