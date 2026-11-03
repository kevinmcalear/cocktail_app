// The web bundle swaps @supabase/realtime-js for lib/realtimeStub.ts
// (metro.config.js). That holds only while the app opens no Realtime channel,
// and while supabase-js asks its Realtime client for nothing the stand-in
// lacks. This fails when either stops being true.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import Module, { createRequire } from 'node:module';
import { join } from 'node:path';

import * as stub from './realtimeStub';

// 1. No app code uses Realtime: no channel calls, and no Realtime value from supabase-js (on the web those are the stub's, or undefined).
const found = spawnSync('git', ['grep', '-lE', String.raw`\.(channel|removeChannel|removeAllChannels|getChannels)\(|REALTIME_|\bRealtime(Channel|Client|Presence)\b|realtime-js`, '--', 'app', 'components', 'hooks', 'lib', 'ctx', 'store', ':!lib/realtimeStub*'], { encoding: 'utf8' });
assert.ok(found.status === 0 || found.status === 1, `git grep failed: ${found.stderr}`);
assert.equal(found.stdout, '', `Realtime is used here, but the web bundle stubs it (metro.config.js, lib/realtimeStub.ts):\n${found.stdout}`);

// 2. supabase-js runs on the stand-in: building the client and handing it tokens on auth changes.
const ModuleWithResolve = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolve = ModuleWithResolve._resolveFilename;
ModuleWithResolve._resolveFilename = (request, ...rest) => (request === '@supabase/realtime-js' ? 'realtime-stub' : resolve(request, ...rest));
const cache = createRequire(__filename).cache as Record<string, unknown>;
cache['realtime-stub'] = { id: 'realtime-stub', filename: 'realtime-stub', loaded: true, exports: stub };
const { createClient } = createRequire(join(process.cwd(), 'package.json'))('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
ModuleWithResolve._resolveFilename = resolve;
const client = createClient('http://127.0.0.1:1', 'anon', { auth: { persistSession: false, autoRefreshToken: false } });
assert.ok(client.realtime instanceof stub.RealtimeClient, 'supabase-js built its Realtime client from the stand-in');
const handle = (client as unknown as { _handleTokenChanged: (event: string, source: string, token?: string) => void })._handleTokenChanged.bind(client);
handle('SIGNED_IN', 'CLIENT', 'token');
handle('TOKEN_REFRESHED', 'CLIENT', 'token2');
handle('SIGNED_OUT', 'CLIENT');
assert.deepEqual(client.getChannels(), []);
assert.throws(() => client.channel('x'), /not in the web bundle/);

// 3. The alias is web-only and points at the stand-in.
const config = createRequire(__filename)('../metro.config.js') as { resolver: { resolveRequest: (c: unknown, m: string, p: string) => { filePath?: string } } };
assert.ok(config.resolver.resolveRequest({ resolveRequest: () => ({}) }, '@supabase/realtime-js', 'web').filePath?.endsWith('lib/realtimeStub.ts'), 'metro.config.js sends @supabase/realtime-js to the stand-in on the web');

console.log('realtimeStub.check: ok');
