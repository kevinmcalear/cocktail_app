/** Pull auth params from query string and/or hash fragment. */
export function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.indexOf('?');
  const h = url.indexOf('#');
  const query = q >= 0 ? url.slice(q + 1, h >= 0 && h > q ? h : undefined) : '';
  const hash = h >= 0 ? url.slice(h + 1) : '';
  for (const part of [query, hash]) {
    if (!part) continue;
    new URLSearchParams(part).forEach((v, k) => {
      out[k] = v;
    });
  }
  return out;
}

// ponytail: self-check — `npx tsx lib/parseAuthParams.ts`
if (typeof require !== 'undefined' && require.main === module) {
  const a = parseAuthParams('cocktailapp://auth/reset-password?code=abc&type=recovery');
  console.assert(a.code === 'abc' && a.type === 'recovery', 'query');
  const b = parseAuthParams('https://x.app/auth/callback#access_token=tok&refresh_token=ref');
  console.assert(b.access_token === 'tok' && b.refresh_token === 'ref', 'hash');
  const c = parseAuthParams('https://x.app/auth?token_hash=th&type=email#error=denied');
  console.assert(c.token_hash === 'th' && c.type === 'email' && c.error === 'denied', 'both');
  console.log('parseAuthParams ok');
}
