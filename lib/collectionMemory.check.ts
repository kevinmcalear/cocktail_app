import assert from 'node:assert/strict';

import { memoryNow } from './collectionMemory';

const kept = { name: 'Old Fashioned', barName: 'Little Rye', imageUrl: 'https://x/old.png' };

// Readable now: its own name, bar and picture.
assert.deepEqual(memoryNow(kept, { name: 'Rye Old Fashioned', barName: 'Little Rye Bar', imageUrl: 'https://x/new.png' }), {
  name: 'Rye Old Fashioned',
  barName: 'Little Rye Bar',
  imageUrl: 'https://x/new.png',
});
// Gone private or deleted: the memory.
assert.deepEqual(memoryNow(kept, null), kept);
// Readable, but no public bar or picture: those stay as remembered.
assert.deepEqual(memoryNow(kept, { name: 'Rye Old Fashioned', barName: null, imageUrl: null }), { ...kept, name: 'Rye Old Fashioned' });

console.log('collection memory: ok');
