// Drink-field palettes (images.palette):
//   * the column only holds hex colours, and only the service role sets it;
//   * the image-palette function only answers the database and the backfill
//     script;
//   * the trigger fills the palette on its own for a new picture, a new url,
//     or a palette reset to null.
//
// The function tests need the edge runtime (don't exclude edge-runtime when
// starting the stack) and the Vault secrets from supabase/seed.sql:
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, describe, test } from 'node:test';
import { crc32, deflateSync } from 'node:zlib';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run palette tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const FUNCTION_URL = `${status.API_URL}/functions/v1/image-palette`;
const SECRET = 'local-image-palette-secret';

const imageIds = [];
const paths = [];
const userIds = [];

after(async () => {
  if (imageIds.length) await service.from('images').delete().in('id', imageIds);
  if (paths.length) await service.storage.from('drinks').remove(paths);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
});

/** A signed-in client for a throwaway local user. */
async function signedIn() {
  const email = `palette-${run}-${userIds.length}@security-test.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

function callFunction(body, headers = { 'x-image-palette-secret': SECRET }) {
  return fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const served = await callFunction({}, {})
  .then((res) => res.status === 401)
  .catch(() => false);
const functionSkip = served ? false : 'image-palette is not served (start the stack with edge-runtime)';

/** A 64x64 RGBA PNG: the top `share` of rows in `fg`, the rest in `bg`. */
function png(fg, bg, share) {
  const size = 64;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const [r, g, b] = y < size * share ? fg : bg;
    for (let x = 0; x < size; x++) raw.set([r, g, b, 255], y * (size * 4 + 1) + 1 + x * 4);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function uploadPicture(name, bytes, type = 'png') {
  const path = `palette-tests/${run}/${name}.${type}`;
  const { error } = await service.storage.from('drinks').upload(path, bytes, { contentType: `image/${type}` });
  if (error) throw new Error(`upload failed: ${error.message}`);
  paths.push(path);
  return service.storage.from('drinks').getPublicUrl(path).data.publicUrl;
}

async function insertImage(fields) {
  const { data, error } = await service.from('images').insert(fields).select('id').single();
  if (error) throw error;
  imageIds.push(data.id);
  return data.id;
}

async function paletteOf(id) {
  const { data, error } = await service.from('images').select('palette').eq('id', id).single();
  if (error) throw error;
  return data.palette;
}

/** Polls for up to 20 seconds while the trigger's request runs. */
async function waitForPalette(id) {
  for (let i = 0; i < 40; i++) {
    const palette = await paletteOf(id);
    if (palette !== null) return palette;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

describe('images.palette', () => {
  test('holds up to three lowercase #rrggbb colours, [] or null', async () => {
    const id = await insertImage({ url: `https://example.test/${run}.png`, palette: [] });
    for (const palette of [['#b02828', '#3a0c0c', '#f5dcdc'], ['#123abc'], [], null]) {
      const { error } = await service.from('images').update({ palette }).eq('id', id);
      assert.equal(error, null, `${JSON.stringify(palette)} should be allowed`);
    }
  });

  test('rejects anything else', async () => {
    const id = await insertImage({ url: `https://example.test/${run}-bad.png`, palette: [] });
    const bad = [
      '#b02828',
      { dominant: '#b02828' },
      ['#B02828'],
      ['#b028'],
      ['red'],
      [11546664],
      ['#111111', '#222222', '#333333', '#444444'],
    ];
    for (const palette of bad) {
      const { error } = await service.from('images').update({ palette }).eq('id', id);
      assert.ok(error, `${JSON.stringify(palette)} should be rejected`);
      assert.match(error.message, /images_palette_hex_colours/);
    }
  });
});

describe('who sets images.palette', () => {
  test('signed-in users can add pictures, but not with a palette', async () => {
    const user = await signedIn();

    const { data, error } = await user.from('images').insert({ url: `https://example.test/${run}-user.png` }).select('id, palette').single();
    assert.equal(error, null);
    imageIds.push(data.id);
    assert.equal(data.palette, null);

    const forged = await user.from('images').insert({ url: `https://example.test/${run}-forged.png`, palette: ['#ff00ff'] });
    assert.equal(forged.error?.code, '42501');
    assert.match(forged.error.message, /Only the server sets images\.palette/);
  });

  test("signed-in users can't change a palette", async () => {
    const user = await signedIn();
    const palette = ['#b02828', '#3a0c0c', '#f5dcdc'];
    const id = await insertImage({ url: `https://example.test/${run}-keep.png`, palette });
    await user.from('images').update({ palette: ['#ff00ff'] }).eq('id', id);
    await user.from('images').update({ palette: null }).eq('id', id);
    assert.deepEqual(await paletteOf(id), palette);
  });

  test('the guard holds even if a future policy lets users update images', async () => {
    // Today no UPDATE policy exists, so RLS stops users first. Add one inside a
    // transaction that is rolled back, to check the trigger on its own.
    const palette = ['#b02828', '#3a0c0c', '#f5dcdc'];
    const id = await insertImage({ url: `https://example.test/${run}-policy.png`, palette });
    const db = new pg.Client({ connectionString: status.DB_URL });
    await db.connect();
    try {
      await db.query('BEGIN');
      await db.query(`CREATE POLICY "palette_test_update" ON public.images FOR UPDATE TO authenticated USING (true)`);
      await db.query('SET LOCAL ROLE authenticated');
      await assert.rejects(db.query(`UPDATE public.images SET palette = '["#ff00ff"]' WHERE id = $1`, [id]), {
        code: '42501',
        message: /Only the server sets images\.palette/,
      });
    } finally {
      await db.query('ROLLBACK').catch(() => {});
      await db.end();
    }
    assert.deepEqual(await paletteOf(id), palette);
  });

  test('the service role can', async () => {
    const id = await insertImage({ url: `https://example.test/${run}-service.png`, palette: ['#123abc'] });
    const { error } = await service.from('images').update({ palette: ['#abc123'] }).eq('id', id);
    assert.equal(error, null);
    assert.deepEqual(await paletteOf(id), ['#abc123']);
  });
});

describe('image-palette function', { skip: functionSkip }, () => {
  test('refuses callers without the shared secret', async () => {
    const id = await insertImage({ url: `https://example.test/${run}-secret.png`, palette: [] });
    for (const headers of [{}, { 'x-image-palette-secret': 'nope' }, { Authorization: `Bearer ${status.SERVICE_ROLE_KEY}` }]) {
      const res = await callFunction({ image_id: id, force: true }, headers);
      assert.equal(res.status, 401);
    }
  });

  test('a new picture gets its palette from the insert trigger', async () => {
    const url = await uploadPicture('negroni', png([176, 40, 40], [20, 18, 16], 0.4));
    const id = await insertImage({ url });

    const palette = await waitForPalette(id);
    assert.ok(palette, 'the trigger should have filled the palette within 20 seconds');
    assert.equal(palette.length, 3);
    assert.equal(palette[0], '#b02828');

    // Asking again without force leaves it alone.
    const res = await callFunction({ image_id: id });
    assert.deepEqual(await res.json(), { palette, skipped: true });
  });

  test('setting the palette back to null recomputes it', async () => {
    const url = await uploadPicture('midori', png([60, 200, 60], [20, 18, 16], 0.4));
    const id = await insertImage({ url, palette: ['#000000'] });

    const { error } = await service.from('images').update({ palette: null }).eq('id', id);
    assert.equal(error, null);
    const palette = await waitForPalette(id);
    assert.ok(palette, 'the trigger should have refilled the palette within 20 seconds');
    assert.equal(palette[0], '#3cc83c');
  });

  test('a new url clears the old palette and computes the new one', async () => {
    const url = await uploadPicture('before', png([176, 40, 40], [20, 18, 16], 0.4));
    const id = await insertImage({ url, palette: ['#b02828', '#3a0c0c', '#f5dcdc'] });
    const newUrl = await uploadPicture('after', png([40, 90, 200], [20, 18, 16], 0.4));

    const { data, error } = await service.from('images').update({ url: newUrl }).eq('id', id).select('palette').single();
    assert.equal(error, null);
    assert.equal(data.palette, null, 'the old palette is cleared in the same write');
    const palette = await waitForPalette(id);
    assert.ok(palette, 'the trigger should have filled the new palette within 20 seconds');
    assert.equal(palette[0], '#285ac8');
  });

  test("a palette for a picture that was replaced meanwhile isn't saved", async () => {
    const url = await uploadPicture('old', png([176, 40, 40], [20, 18, 16], 0.4));
    const id = await insertImage({ url, palette: ['#b02828', '#3a0c0c', '#f5dcdc'] });
    const newUrl = await uploadPicture('new', png([40, 90, 200], [20, 18, 16], 0.4));

    // Swap the picture in a transaction that holds the row: the function reads
    // the old url, draws the old palette, then waits on the row lock.
    const db = new pg.Client({ connectionString: status.DB_URL });
    await db.connect();
    try {
      await db.query('BEGIN');
      await db.query('UPDATE public.images SET url = $1 WHERE id = $2', [newUrl, id]);
      const pending = callFunction({ image_id: id, force: true });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await db.query('COMMIT');
      assert.deepEqual(await (await pending).json(), { palette: null, stale: true });
    } finally {
      await db.end();
    }
    const palette = await waitForPalette(id);
    assert.equal(palette?.[0], '#285ac8', "the new picture's palette wins");
  });

  test('an update that keeps the url keeps the palette', async () => {
    const url = await uploadPicture('same', png([176, 40, 40], [20, 18, 16], 0.4));
    const palette = ['#b02828', '#3a0c0c', '#f5dcdc'];
    const id = await insertImage({ url, palette });
    const { error } = await service.from('images').update({ url }).eq('id', id);
    assert.equal(error, null);
    assert.deepEqual(await paletteOf(id), palette);
  });

  test('WebP pictures are decoded too', async () => {
    // 64x64 lossless WebP: the same green drink on a dark bar as the PNG tests.
    const bytes = readFileSync(new URL('./fixtures/green-drink.webp', import.meta.url));
    const url = await uploadPicture('green', bytes, 'webp');
    const id = await insertImage({ url });
    const palette = await waitForPalette(id);
    assert.ok(palette, 'the trigger should have filled the palette within 20 seconds');
    assert.equal(palette[0], '#3cc83c');
  });

  test('a greyscale picture gets [] so it is not retried', async () => {
    const url = await uploadPicture('pencil', png([90, 90, 90], [245, 245, 245], 0.3));
    const id = await insertImage({ url, palette: ['#000000'] });
    const res = await callFunction({ image_id: id, force: true });
    assert.equal(res.status, 200);
    assert.deepEqual(await paletteOf(id), []);
  });

  test('only reads pictures from the drinks bucket', async () => {
    const id = await insertImage({ url: 'https://example.test/elsewhere.png', palette: null });
    const res = await callFunction({ image_id: id });
    assert.equal(res.status, 422);
    assert.equal(await paletteOf(id), null);
  });
});
