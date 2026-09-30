import assert from 'node:assert/strict';
import { inspectAuthUrl, parseAuthParams } from './parseAuthParams';

// --- parsing: query, hash, both ---
const a = parseAuthParams('cocktailapp://auth/reset-password?code=abc&type=recovery');
assert.equal(a.code, 'abc');
assert.equal(a.type, 'recovery');
const b = parseAuthParams('https://x.app/auth/callback#access_token=tok&refresh_token=ref');
assert.equal(b.access_token, 'tok');
assert.equal(b.refresh_token, 'ref');
const c = parseAuthParams('https://x.app/auth?token_hash=th&type=email#error=denied');
assert.equal(c.token_hash, 'th');
assert.equal(c.type, 'email');
assert.equal(c.error, 'denied');

// --- a whole link is a credential ---
assert.deepEqual(inspectAuthUrl('cocktailapp-dev://auth/callback?token_hash=th&type=magiclink'), {
  url: 'cocktailapp-dev://auth/callback?token_hash=th&type=magiclink',
  error: null,
  hasCredential: true,
});
assert.equal(inspectAuthUrl('https://x.app/auth/callback?code=abc').hasCredential, true, 'pkce code');
assert.deepEqual(inspectAuthUrl(null), { url: null, error: null, hasCredential: false });
assert.equal(inspectAuthUrl('cocktailapp-dev://auth/callback').hasCredential, false, 'no params');

// --- a token_hash that lost its type is a broken link, not a credential ---
// (an unquoted & in `adb shell am start -d` cut the URL there; the tap then exchanged nothing)
const cut = inspectAuthUrl('cocktailapp-dev://auth/callback?token_hash=th');
assert.equal(cut.hasCredential, false);
assert.match(cut.error ?? '', /incomplete/);

// --- server errors read as plain language ---
const expired = inspectAuthUrl(
  'https://x.app/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
);
assert.equal(expired.hasCredential, false);
assert.match(expired.error ?? '', /already been used/);
assert.equal(inspectAuthUrl('https://x.app/auth/callback?error=server_error&error_description=Something%20odd').error, 'Something odd');

console.log('parseAuthParams ok');
