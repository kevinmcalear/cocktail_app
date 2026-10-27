import assert from 'node:assert/strict';
import { test } from 'node:test';

import { uploadNeedsObjnameIndex } from '../local-storage.mjs';

test('storage before 1.77 needs bucketid_objname; 1.77 and later do not', () => {
  assert.equal(uploadNeedsObjnameIndex('1.61.10'), true);
  assert.equal(uploadNeedsObjnameIndex('v1.68.8\n'), true);
  assert.equal(uploadNeedsObjnameIndex('1.77.0'), false);
  assert.equal(uploadNeedsObjnameIndex('1.84.19'), false);
  assert.equal(uploadNeedsObjnameIndex('2.0.0'), false);
  assert.equal(uploadNeedsObjnameIndex('unknown'), false);
});
