import assert from 'node:assert/strict';

import { deliverBringIn, listenBringIn, stageBringInFiles } from './bringInHandoff';

void (async () => {
  // Files dropped before Bring in opened reach it once it listens, even when it
  // mounts, unmounts and mounts again before they're delivered.
  const got: string[] = [];
  const file = { uri: 'blob:a', mimeType: 'application/pdf' };
  stageBringInFiles([file]);
  const first = listenBringIn(() => got.push('first'));
  first();
  const second = listenBringIn((d) => got.push('files' in d ? `second:${d.files.length}` : 'text'));
  await Promise.resolve();
  assert.deepEqual(got, ['second:1']);

  // While it's open, drops and pastes go straight to it; once it's gone, nobody takes them.
  assert.equal(deliverBringIn({ text: 'Negroni\n30 ml Gin' }), true);
  assert.deepEqual(got, ['second:1', 'text']);
  second();
  assert.equal(deliverBringIn({ text: 'x' }), false);

  // Staged with nobody listening yet, and the listener leaves before delivery: kept for the next one.
  stageBringInFiles([file]);
  listenBringIn(() => got.push('gone'))();
  await Promise.resolve();
  const third = listenBringIn((d) => got.push('files' in d ? 'third' : 'text'));
  await Promise.resolve();
  assert.deepEqual(got.slice(-1), ['third']);
  third();

  console.log('bringInHandoff: ok');
})();
