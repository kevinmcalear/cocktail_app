import assert from 'node:assert/strict';

import { EMPTY_DRAFT } from './drinkWizard';
import { forAccount, mergeDrafts, type KeptDraft } from './draftSync';

const k = (name: string, updatedAt: number, extra: Partial<KeptDraft['draft']> = {}): KeptDraft => ({ draft: { ...EMPTY_DRAFT, name, ...extra }, step: 'ingredients', updatedAt });

// Photos are files on the device: never sent.
assert.equal('photos' in forAccount(k('Salty Boy', 1, { photos: { side: 'file:///x.jpg' } })).draft, false);

{
  const device = { home: k('Here newer', 20), 'home|name:a': k('Only here', 5), 'home|name:gone': k('Saved elsewhere', 5) };
  const account = { home: k('There older', 10), 'home|name:b': k('Only there', 7), 'home|name:cleared': k('Cleared here', 7) };
  const m = mergeDrafts(device, account, { seen: ['home|name:gone'], cleared: ['home|name:cleared'] });
  assert.equal(m.kept.home.draft.name, 'Here newer', 'the newer wins');
  assert.equal(m.kept['home|name:a'].draft.name, 'Only here', 'new on this device stays');
  assert.equal(m.kept['home|name:b'].draft.name, 'Only there', 'started on another device arrives');
  assert.equal(m.kept['home|name:gone'], undefined, 'saved or started over elsewhere goes');
  assert.equal(m.kept['home|name:cleared'], undefined, 'cleared here stays gone');
  assert.deepEqual(m.push.sort(), ['home', 'home|name:a']);
  assert.deepEqual(m.seen.sort(), ['home', 'home|name:b']);
}

// The account's newer one keeps this device's photos.
{
  const m = mergeDrafts({ home: k('Old', 1, { photos: { side: 'file:///x.jpg' } }) }, { home: k('New', 2) }, { seen: [], cleared: [] });
  assert.equal(m.kept.home.draft.name, 'New');
  assert.deepEqual(m.kept.home.draft.photos, { side: 'file:///x.jpg' });
  assert.deepEqual(m.push, []);
}

// An empty draft on the device isn't sent.
assert.deepEqual(mergeDrafts({ home: k('', 3) }, {}, { seen: [], cleared: [] }).push, []);
console.log('draftSync checks passed');
