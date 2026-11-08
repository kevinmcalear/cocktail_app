import assert from 'node:assert/strict';

import { beerWineBar, beerWinePlace, EMPTY_BEER_WINE, isBeerWineSlot, type BeerWineDraft, type BeerWineStep } from './beerWineDraft';
import { EMPTY_DRAFT } from './drinkWizard';
import { BEER_WINE_DRAFTS, DRINK_DRAFTS, forAccount, mergeDrafts, type KeptDraft } from './draftSync';

const k = (name: string, updatedAt: number, extra: Partial<KeptDraft['draft']> = {}): KeptDraft => ({ draft: { ...EMPTY_DRAFT, name, ...extra }, step: 'ingredients', updatedAt });

// Photos are files on the device: never sent.
assert.equal('photos' in forAccount(k('Salty Boy', 1, { photos: { side: 'file:///x.jpg' } }), DRINK_DRAFTS).draft, false);

{
  const device = { home: k('Here newer', 20), 'home|name:a': k('Only here', 5), 'home|name:gone': k('Saved elsewhere', 5) };
  const account = { home: k('There older', 10), 'home|name:b': k('Only there', 7), 'home|name:cleared': k('Cleared here', 7) };
  const m = mergeDrafts(device, account, { seen: ['home|name:gone'], cleared: [{ place: 'home|name:cleared', at: 7 }] }, DRINK_DRAFTS);
  assert.equal(m.kept.home.draft.name, 'Here newer', 'the newer wins');
  assert.equal(m.kept['home|name:a'].draft.name, 'Only here', 'new on this device stays');
  assert.equal(m.kept['home|name:b'].draft.name, 'Only there', 'started on another device arrives');
  assert.equal(m.kept['home|name:gone'], undefined, 'saved or started over elsewhere goes');
  assert.equal(m.kept['home|name:cleared'], undefined, 'cleared here stays gone');
  assert.deepEqual(m.push.sort(), ['home', 'home|name:a']);
  assert.deepEqual(m.seen.sort(), ['home', 'home|name:b']);
}

// A draft started again elsewhere in a slot cleared here comes back; one sent since the read began isn't taken for gone.
{
  const m = mergeDrafts({ 'home|name:x': k('Sent just now', 9) }, { home: k('Started on the web', 30) }, { seen: ['home|name:x'], cleared: [{ place: 'home', at: 20 }], sentSince: ['home|name:x'] }, DRINK_DRAFTS);
  assert.equal(m.kept.home.draft.name, 'Started on the web');
  assert.equal(m.kept['home|name:x'].draft.name, 'Sent just now');
}

// The account's newer one keeps this device's photos.
{
  const m = mergeDrafts({ home: k('Old', 1, { photos: { side: 'file:///x.jpg' } }) }, { home: k('New', 2) }, { seen: [], cleared: [] }, DRINK_DRAFTS);
  assert.equal(m.kept.home.draft.name, 'New');
  assert.deepEqual(m.kept.home.draft.photos, { side: 'file:///x.jpg' });
  assert.deepEqual(m.push, []);
}

// An empty draft on the device isn't sent.
assert.deepEqual(mergeDrafts({ home: k('', 3) }, {}, { seen: [], cleared: [] }, DRINK_DRAFTS).push, []);

// --- beer and wine (Kevin, 8 Nov: "Sync them too") ---
const b = (name: string, updatedAt: number, extra: Partial<BeerWineDraft> = {}): KeptDraft<BeerWineDraft, BeerWineStep> => ({ draft: { ...EMPTY_BEER_WINE, name, ...extra }, step: 'style', updatedAt });

// Their slots sit beside a drink's in the same rows, never in the way of one.
assert.equal(beerWinePlace('beer', null), 'beer:home');
assert.equal(beerWinePlace('wine', 'bar-1'), 'wine:bar-1');
assert.ok(isBeerWineSlot('beer:home') && isBeerWineSlot('wine:bar-1'));
assert.ok(!isBeerWineSlot('home') && !isBeerWineSlot('bar-1|name:beer:home') && !isBeerWineSlot('home|name:wine: a spritz'));
assert.equal(beerWineBar('beer:home'), null);
assert.equal(beerWineBar('wine:bar-1'), 'bar-1');

// A beer kept on this phone only (before syncing began) goes up on the first read: nothing is lost.
{
  const m = mergeDrafts({ 'beer:home': b('Pils', 4) }, {}, { seen: [], cleared: [] }, BEER_WINE_DRAFTS);
  assert.equal(m.kept['beer:home'].draft.name, 'Pils');
  assert.deepEqual(m.push, ['beer:home']);
}

// Its photo is a file on this phone: never sent, and kept here when the account's newer copy arrives.
{
  const photo = { uri: 'file:///label.jpg', mimeType: 'image/jpeg' };
  assert.equal('photo' in forAccount(b('Pils', 1, { photo }), BEER_WINE_DRAFTS).draft, false);
  const m = mergeDrafts({ 'beer:home': b('Pils', 1, { photo }) }, { 'beer:home': b('Pilsner Urquell', 2) }, { seen: [], cleared: [] }, BEER_WINE_DRAFTS);
  assert.equal(m.kept['beer:home'].draft.name, 'Pilsner Urquell');
  assert.deepEqual(m.kept['beer:home'].draft.photo, photo);
}

// A different beer started in its place elsewhere doesn't take this phone's photo.
{
  const photo = { uri: 'file:///pils.jpg', mimeType: 'image/jpeg' };
  const m = mergeDrafts({ 'beer:home': b('Pils', 1, { id: 'a', photo }) }, { 'beer:home': b('Guinness', 2, { id: 'b' }) }, { seen: ['beer:home'], cleared: [] }, BEER_WINE_DRAFTS);
  assert.equal(m.kept['beer:home'].draft.name, 'Guinness');
  assert.equal(m.kept['beer:home'].draft.photo, null);
}

// Started on the web, it arrives; saved or dropped elsewhere (Don't keep it), it goes.
{
  const m = mergeDrafts({ 'wine:bar-1': b('Gone', 3) }, { 'beer:home': b('From the web', 5) }, { seen: ['wine:bar-1'], cleared: [] }, BEER_WINE_DRAFTS);
  assert.equal(m.kept['beer:home'].draft.name, 'From the web');
  assert.equal(m.kept['wine:bar-1'], undefined);
}

// An empty one isn't sent; one kept by an older version, with a field missing, still counts when filled.
assert.deepEqual(mergeDrafts({ 'beer:home': b('', 3) }, {}, { seen: [], cleared: [] }, BEER_WINE_DRAFTS).push, []);
assert.ok(BEER_WINE_DRAFTS.filled({ name: 'Old shape' } as BeerWineDraft));
console.log('draftSync checks passed');
