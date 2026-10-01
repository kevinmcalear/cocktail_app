import assert from 'node:assert/strict';

import {
  commonsFilePage,
  formatCredit,
  licenseOk,
  productTokens,
  stripHtml,
  titleMatchesProduct,
} from './catalog-photos.mjs';

assert.equal(licenseOk('CC BY-SA 4.0'), true);
assert.equal(licenseOk('CC BY 2.0'), true);
assert.equal(licenseOk('CC0'), true);
assert.equal(licenseOk('Public domain'), true);
assert.equal(licenseOk('CC BY-NC 4.0'), false);
assert.equal(licenseOk('Fair use'), false);
assert.equal(licenseOk(''), false);

assert.equal(stripHtml('André <a href="x">Karwath</a>'), 'André Karwath');
assert.equal(formatCredit('André Karwath', 'CC BY-SA 2.5'), 'André Karwath / CC BY-SA 2.5');
assert.ok(formatCredit('A'.repeat(200), 'CC BY-SA 4.0').length <= 120);

assert.ok(productTokens('Tanqueray London Dry Gin', 'Tanqueray').includes('tanqueray'));
assert.equal(titleMatchesProduct('File:Bottles of Tanqueray London Dry Gin.JPG', 'Tanqueray London Dry Gin', 'Tanqueray'), true);
assert.equal(titleMatchesProduct('File:Random supermarket shelf.jpg', 'Tanqueray London Dry Gin', 'Tanqueray'), false);
assert.equal(titleMatchesProduct('File:Guinness Draught.jpg', 'Guinness Draught', 'Guinness'), true);

assert.match(commonsFilePage('File:Lemon.jpg'), /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);

console.log('catalog-photos.check.ts: ok');
