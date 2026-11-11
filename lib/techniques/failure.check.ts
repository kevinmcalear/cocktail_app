// A failed library load (offline, a chunk an old deploy removed) rejects and is
// tried again on the next call; a good load installs the data.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { allTechniques, loadTechniquesFrom, looksLikeMissingChunk, techniquesLoaded } from './index';
import * as library from './library';

const fail = (message: string) => () => Promise.reject(new Error(message));

assert.ok(looksLikeMissingChunk(new Error('Loading chunk 123 failed')));
assert.ok(looksLikeMissingChunk(new Error('Failed to fetch dynamically imported module: x')));
assert.ok(!looksLikeMissingChunk(new Error('Network request failed')));

loadTechniquesFrom(fail('Loading chunk 123 failed'))
  .then(
    () => assert.fail('the load should have failed'),
    (e: Error) => assert.match(e.message, /chunk/),
  )
  .then(() => {
    assert.equal(techniquesLoaded(), false);
    // a failed load leaves no stuck promise: the next call tries again, and fails again
    return loadTechniquesFrom(fail('Network request failed')).then(
      () => assert.fail('the retry should have failed'),
      (e: Error) => assert.match(e.message, /Network/),
    );
  })
  .then(() => loadTechniquesFrom(() => Promise.resolve(library)))
  .then(() => {
    assert.equal(techniquesLoaded(), true);
    assert.equal(allTechniques().length, library.TECHNIQUES.length);
    console.log('technique library failure check passed');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
