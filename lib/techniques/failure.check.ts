// A failed library load (offline, a chunk an old deploy removed) flips the failed
// state and keeps it through a failed retry; a good load installs the data and clears it.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { allTechniques, loadTechniquesFrom, looksLikeMissingChunk, techniquesFailure, techniquesLoaded } from './index';
import * as library from './library';

const fail = (message: string) => () => Promise.reject(new Error(message));

assert.equal(techniquesFailure(), null);

loadTechniquesFrom(fail('Loading chunk 123 failed'))
  .then(
    () => assert.fail('the load should have failed'),
    (e: Error) => assert.match(e.message, /chunk/),
  )
  .then(() => {
    assert.equal(techniquesLoaded(), false);
    assert.ok(looksLikeMissingChunk(techniquesFailure()));
    assert.ok(!looksLikeMissingChunk(new Error('Network request failed')));
    // a retry that fails again keeps the message up
    return loadTechniquesFrom(fail('Network request failed')).catch(() => {});
  })
  .then(() => {
    assert.equal(techniquesFailure()?.message, 'Network request failed');
    return loadTechniquesFrom(() => Promise.resolve(library));
  })
  .then(() => {
    assert.equal(techniquesLoaded(), true);
    assert.equal(techniquesFailure(), null, 'a good load clears the failed state');
    assert.equal(allTechniques().length, library.TECHNIQUES.length);
    console.log('technique library failure check passed');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
