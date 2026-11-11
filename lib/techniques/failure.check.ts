// A failed library load (offline, a chunk an old deploy removed) flips the failed
// state; a retry clears it, and a good load installs the data.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { allTechniques, loadTechniques, looksLikeMissingChunk, retryTechniques, techniquesFailure, techniquesLoaded } from './index';
import * as library from './library';

assert.equal(techniquesFailure(), null);

loadTechniques(() => Promise.reject(new Error('Loading chunk 123 failed')))
  .then(
    () => assert.fail('the load should have failed'),
    (e: Error) => assert.match(e.message, /chunk/),
  )
  .then(() => {
    assert.equal(techniquesLoaded(), false);
    assert.ok(looksLikeMissingChunk(techniquesFailure()));
    assert.ok(!looksLikeMissingChunk(new Error('Network request failed')));
    const retry = retryTechniques(() => Promise.resolve(library));
    assert.equal(techniquesFailure(), null, 'a retry clears the failed state at once');
    return retry;
  })
  .then(() => {
    assert.equal(techniquesLoaded(), true);
    assert.equal(allTechniques().length, library.TECHNIQUES.length);
    console.log('technique library failure check passed');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
