// Checks for lib/folderMatch.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { isBackLabel, matchName, nameFromFile, shortName, trayRows, traySummary, type TrayPhoto } from './folderMatch';

// What a file name says, as the board's folder names them.
assert.equal(nameFromFile('HL_DryGin_700_front.png'), 'dry gin');
assert.equal(nameFromFile('HL_Rosso_front.png'), 'rosso');
assert.equal(nameFromFile('saltbush-absinthe.jpg'), 'saltbush absinthe');
assert.equal(nameFromFile('Harbour Lane Navy Strength 70cl.jpeg'), 'harbour lane navy strength');
assert.equal(nameFromFile('IMG_2231.jpg'), '');
assert.equal(nameFromFile('DSC01234.JPG'), '');
assert.equal(isBackLabel('HL_Rosso_back.png'), true);
assert.equal(isBackLabel('backbar-gin.png'), false);

const bottles = [
  { id: 'dry', name: 'Harbour Lane Dry Gin' },
  { id: 'navy', name: 'Harbour Lane Navy Strength Gin' },
  { id: 'rosso', name: 'Wharf Rosso' },
  { id: 'abs', name: 'Saltbush Absinthe' },
];

// One closest bottle is sure; a tie asks; nothing close is null.
assert.deepEqual(matchName('dry gin', bottles), { sure: 'dry' });
assert.deepEqual(matchName('rosso', bottles), { sure: 'rosso' });
assert.deepEqual(matchName('saltbush absinth', bottles), { sure: 'abs' });
assert.deepEqual(matchName('navy strenght', bottles), { sure: 'navy' });
assert.deepEqual(matchName('harbour lane gin', bottles), { ask: ['dry', 'navy'] });
assert.equal(matchName('campari', bottles), null);
assert.equal(matchName('', bottles), null);

// The board's six photos: three ready, two to check, one left out.
const photo = (key: string, fileName: string, bottleId: string | null, back = false): TrayPhoto => ({ key, fileName, bottleId, ask: [], back });
const six = [
  photo('a', 'HL_DryGin_700_side.png', 'dry'),
  photo('b', 'HL_DryGin_700_front.png', 'dry'),
  photo('c', 'HL_Rosso_front.png', 'rosso'),
  photo('d', 'saltbush-absinthe.jpg', 'abs'),
  photo('e', 'IMG_2231.jpg', null),
  photo('f', 'HL_Rosso_back.png', null, true),
];
const rows = trayRows(six);
assert.deepEqual(rows.map((r) => `${r.kind} ${r.photo.key}`), ['ready b', 'ready c', 'ready d', 'which e', 'another a', 'back f']);
assert.equal(traySummary(rows), '3 ready · 2 to check · 1 left out');

// Use this one swaps which photo a bottle keeps.
assert.deepEqual(trayRows(six, { dry: 'a' }).map((r) => `${r.kind} ${r.photo.key}`).slice(0, 1), ['ready a']);
assert.equal(trayRows(six, { dry: 'a' }).find((r) => r.photo.key === 'b')?.kind, 'another');
// Picking a bottle for the unread photo makes it ready.
assert.equal(trayRows(six.map((p) => (p.key === 'e' ? { ...p, bottleId: 'navy' } : p))).find((r) => r.photo.key === 'e')?.kind, 'ready');
assert.equal(traySummary(trayRows([photo('x', 'a.png', 'dry')])), '1 ready');

assert.equal(shortName('Harbour Lane Dry Gin', 'Harbour Lane Distillery'), 'Dry Gin');
assert.equal(shortName('Wharf Rosso', 'Harbour Lane Distillery'), 'Wharf Rosso');
assert.equal(shortName('Harbour', 'Harbour Lane'), 'Harbour');
