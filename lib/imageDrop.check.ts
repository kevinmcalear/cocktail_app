import assert from 'node:assert/strict';
import { imageUrisFromDataTransfer } from './imageDrop';

assert.deepEqual(imageUrisFromDataTransfer(null), []);
assert.deepEqual(imageUrisFromDataTransfer(undefined), []);

const fakeUrl = 'blob:fake';
const orig = URL.createObjectURL;
(URL as any).createObjectURL = () => fakeUrl;
try {
    const files = {
        length: 2,
        0: { type: 'image/png', name: 'a.png' },
        1: { type: 'text/plain', name: 'b.txt' },
    };
    assert.deepEqual(imageUrisFromDataTransfer({ files } as any), [fakeUrl]);
} finally {
    URL.createObjectURL = orig;
}

console.log('imageDrop.check: ok');
