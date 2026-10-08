import assert from 'node:assert/strict';

import { byYear, historyFor, leadRecord, readUrl, sourceByline, type PrintedRecipe, type Source } from './drinkHistory';

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
