import assert from 'node:assert/strict';

import { EMPTY_DRAFT } from './drinkWizard';
import { addMaker, askLines, askShort, asked, BY_NAME, creditWrites, makers, namedOnly, removeMaker, savedCredits } from './whoMadeIt';

const ME = { id: 'p-jo', name: 'Jo Park' };
const SAM = { id: 'p-sam', name: 'Sam Ortiz', sub: '@sam.ortiz · Little Rye', claimed: true };
const CW = { id: 'p-cw', name: 'Christine Williams', sub: '@christine.williams', claimed: false };
let d = { creator: EMPTY_DRAFT.creator, coCreators: EMPTY_DRAFT.coCreators };
const apply = (change: object) => (d = { ...d, ...change });

// You're on it to start; adding Sam saves him as made with, and he's asked first.
assert.deepEqual(makers(d, ME).map((m) => m.name), ['Jo Park']);
apply(addMaker(d, ME, SAM));
assert.deepEqual(makers(d, ME).map((m) => m.id), ['p-jo', 'p-sam']);
assert.deepEqual(d.coCreators, [SAM]);
assert.deepEqual(askLines(asked(d, ME)), ['We’ll ask Sam first. Sam’s name shows on the drink once Sam says yes.']);
// Twice is once.
assert.deepEqual(addMaker(d, ME, SAM), {});

// An unclaimed page says it waits there.
apply(addMaker(d, ME, CW));
assert.deepEqual(askLines(asked(d, ME)), ['We’ll ask Sam first. Sam’s name shows on the drink once Sam says yes.', 'Christine’s page isn’t claimed yet. The credit waits there until Christine claims it and says yes.']);

// Take yourself off: Sam becomes the maker, Christine stays made with.
apply(removeMaker(d, ME, makers(d, ME)[0]));
assert.deepEqual(d.creator, SAM);
assert.deepEqual(d.coCreators, [CW]);
assert.deepEqual(asked(d, ME).map((m) => m.id), ['p-cw']);

// Add yourself back: you're the maker again and Sam goes back to made with.
apply(addMaker(d, ME, ME));
assert.equal(d.creator, 'me');
assert.deepEqual(d.coCreators.map((c) => c.id), ['p-sam', 'p-cw']);

// Everyone off saves as Not sure.
for (const m of makers(d, ME)) apply(removeMaker(d, ME, m));
assert.equal(d.creator, 'nobody');
assert.deepEqual(makers(d, ME), []);
// The first one added to an empty list is the maker.
apply(addMaker(d, ME, SAM));
assert.deepEqual(d.creator, SAM);
assert.deepEqual(asked(d, ME), []);

// Two asked: one line naming both.
assert.deepEqual(askLines([{ ...SAM, me: false }, { id: 'p-a', name: 'Ash Lee', me: false }]), ['We’ll ask Sam and Ash first. Each name shows on the drink once they say yes.']);
// No profile of your own: nobody is you.
assert.deepEqual(makers({ creator: null, coCreators: [] }, null), []);

// Review says it in one line.
assert.equal(askShort([{ ...SAM, me: false }]), 'We’ll ask Sam first.');
assert.equal(askShort([{ ...SAM, me: false }, { ...CW, me: false }]), 'We’ll ask Sam and Christine first.');
assert.equal(askShort([]), null);

// Someone with no page, typed by name (tf-063): on the list, never asked, saved as a name.
{
  let n = { creator: EMPTY_DRAFT.creator, coCreators: EMPTY_DRAFT.coCreators };
  n = { ...n, ...addMaker(n, ME, { id: null, name: 'Harry Craddock' }) };
  assert.deepEqual(makers(n, ME).map((m) => m.name), ['Jo Park', 'Harry Craddock']);
  assert.deepEqual(asked(n, ME), []);
  assert.deepEqual(namedOnly(n), ['Harry Craddock']);
  // Take yourself off: Harry is the maker, still by name, with no profile.
  n = { ...n, ...removeMaker(n, ME, { id: ME.id, name: ME.name }) };
  assert.deepEqual(n.creator, { id: null, name: 'Harry Craddock' });
  assert.deepEqual(namedOnly(n), ['Harry Craddock']);
  assert.deepEqual(namedOnly({ creator: 'nobody', coCreators: [] }), []);
}

// The drink editor (tf-063): a saved credit reads as the list, and a change writes only what changed.
{
  const sam = { id: 'p-sam', kind: 'person' as const, handle: 'sam', display_name: 'Sam Ortiz', avatar_url: null, locality: null };
  const kit = { ...sam, id: 'p-kit', display_name: 'Kit Lee' };
  const gone = { ...sam, id: 'p-no', display_name: 'No Body' };
  const saved = { creator: sam, co_creators: [{ status: 'accepted' as const, profile: kit }, { status: 'declined' as const, profile: gone }], creator_names: ['Harry Craddock'] };
  const c = savedCredits(saved);
  assert.deepEqual(makers(c, null).map((m) => m.name), ['Sam Ortiz', 'Kit Lee', 'Harry Craddock'], 'declined ones are left off');
  assert.deepEqual(savedCredits({ creator: null, co_creators: [], creator_names: null }), { creator: 'nobody', coCreators: [] });
  assert.deepEqual(savedCredits({ creator: null, co_creators: [], creator_names: ['Harry Craddock'] }).creator, { id: null, name: 'Harry Craddock', sub: BY_NAME });
  // Take Sam off: Kit is the creator, his made-with row goes, Harry stays by name; the declined row is never touched.
  const next = { ...c, ...removeMaker(c, null, { id: 'p-sam', name: 'Sam Ortiz' }) };
  assert.deepEqual(creditWrites(saved, next, null), { item: { creator_profile_id: 'p-kit', creator_names: ['Harry Craddock'] }, add: [], remove: ['p-kit'] });
  // Add someone with a page: a made-with row for them only.
  const more = { ...c, ...addMaker(c, null, { id: 'p-jo', name: 'Jo Park' }) };
  assert.deepEqual(creditWrites(saved, more, null), { item: { creator_profile_id: 'p-sam', creator_names: ['Harry Craddock'] }, add: ['p-jo'], remove: [] });
  assert.deepEqual(creditWrites({ co_creators: [] }, { creator: 'nobody', coCreators: [] }, 'p-jo'), { item: { creator_profile_id: null, creator_names: null }, add: [], remove: [] });
}
