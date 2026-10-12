import assert from 'node:assert/strict';

import { byYear, historyFor, leadRecord, readUrl, sourceByline, thenAndNow, throughTheYears, type PrintedRecipe, type Source } from './drinkHistory';

const source = (key: string, year: number | null, extra: Partial<Source> = {}): Source => ({
  id: key,
  key,
  kind: 'book',
  title: key,
  author: null,
  year,
  edition: null,
  city: null,
  rights: 'public_domain',
  euvs_url: null,
  archive_url: null,
  url: null,
  ...extra,
});
const rec = (id: string, itemId: string, relation: PrintedRecipe['relation'], src: Source, extra: Partial<PrintedRecipe> = {}): PrintedRecipe => ({
  id,
  item_id: itemId,
  printed_name: null,
  page_label: null,
  page_url: null,
  relation,
  method: null,
  quote: null,
  notes: null,
  source: src,
  lines: [],
  ...extra,
});

const savoy = rec('savoy', 'aviation', 'version', source('savoy', 1930, { rights: 'facts_only' }));
const ensslin = rec('ensslin', 'aviation', 'first_print', source('ensslin', 1917, { euvs_url: 'https://euvs/ensslin' }));
const thomas = rec('thomas', 'old-fashioned', 'ancestor', source('thomas', 1862));

// Oldest first, and the first printing leads.
assert.deepEqual(
  byYear([savoy, ensslin]).map((r) => r.id),
  ['ensslin', 'savoy']
);
assert.equal(leadRecord(byYear([savoy, ensslin]))?.id, 'ensslin');
assert.equal(leadRecord([savoy])?.id, 'savoy', 'with no first printing, the oldest leads');
assert.equal(leadRecord([]), null);

// A drink with none of its own borrows its nearest family member's.
const all = [savoy, ensslin, thomas];
assert.equal(historyFor(all, ['aviation'])?.itemId, 'aviation');
assert.equal(historyFor(all, ['bar-riff', 'aviation'])?.itemId, 'aviation');
assert.equal(historyFor(all, ['bar-riff'])?.records.length ?? 0, 0);
assert.equal(historyFor(all, ['bar-riff']), null);

// Where to read it: the exact page first, then the book.
assert.equal(readUrl({ ...ensslin, page_url: 'https://euvs/ensslin/7/' }), 'https://euvs/ensslin/7/');
assert.equal(readUrl(ensslin), 'https://euvs/ensslin');
assert.equal(readUrl(savoy), null);

assert.equal(sourceByline({ author: 'Jerry Thomas', city: 'New York', edition: '1st' }), 'Jerry Thomas, New York, 1st edition');
assert.equal(sourceByline({ author: 'Harry MacElhone', city: 'London', edition: '2nd impression' }), 'Harry MacElhone, London, 2nd impression');

console.log('drinkHistory checks passed');

// Then and now: printed lines meet today's spec on a shared word, accents aside.
assert.deepEqual(
  thenAndNow(
    [
      { ingredient_text: 'El Bart Gin', amount_text: '2/3' },
      { ingredient_text: 'Lemon Juice', amount_text: '1/3' },
      { ingredient_text: 'Creme de Violette', amount_text: '2 dashes' },
    ],
    [
      { ingredient: 'Gin', amount: '60 ml' },
      { ingredient: 'Lemon juice', amount: '22.5 ml' },
      { ingredient: 'Maraschino', amount: '15 ml' },
      { ingredient: 'Crème de violette', amount: '7.5 ml' },
    ],
  ),
  [
    { name: 'Gin', then: '2/3', now: '60 ml' },
    { name: 'Lemon juice', then: '1/3', now: '22.5 ml' },
    { name: 'Crème de violette', then: '2 dashes', now: '7.5 ml' },
    { name: 'Maraschino', then: null, now: '15 ml' },
  ],
);
assert.deepEqual(thenAndNow([{ ingredient_text: 'Rum', amount_text: '1 jigger' }], []), [{ name: 'Rum', then: '1 jigger', now: null }]);

// Through the years: the first printing by its author, later ones by their notes.
const years = throughTheYears([
  { ...savoy, notes: 'The Savoy drops the violette.' },
  { ...ensslin, notes: 'Sourcing notes that are not a change.', source: { ...ensslin.source, author: 'Hugo Ensslin' } },
  { ...savoy, id: 'long', source: { ...savoy.source, year: 1931, title: 'Long' }, notes: 'x'.repeat(140) },
]);
assert.deepEqual(years.map((y) => [y.year, y.line]), [
  ['1917', 'Ensslin prints it.'],
  ['1930', 'The Savoy drops the violette.'],
  ['1931', 'A later version in Long.'],
]);
