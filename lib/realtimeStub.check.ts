// The web bundle swaps @supabase/realtime-js for lib/realtimeStub.ts
// (metro.config.js). That holds only while the app opens no Realtime channel:
// this fails when code starts to, so the alias goes with it.
// Run: npm run test:unit
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { RealtimeClient } from './realtimeStub';

const found = spawnSync('git', ['grep', '-lE', String.raw`\.(channel|removeChannel|removeAllChannels|getChannels)\(|REALTIME_|@supabase/realtime-js`, '--', 'app', 'components', 'hooks', 'lib', 'ctx', 'store', ':!lib/realtimeStub*'], { encoding: 'utf8' });
assert.equal(found.status, 1, `Realtime is used here, but the web bundle stubs it (metro.config.js, lib/realtimeStub.ts):\n${found.stdout}${found.stderr}`);

// What supabase-js calls on its Realtime client without a channel: building it and handing it tokens.
const client = new RealtimeClient();
void client.setAuth('token');
void client.setAuth();
assert.deepEqual(client.getChannels(), []);
assert.throws(() => client.channel('x'), /not in the web bundle/);

// The alias is web-only and points at the stub.
const config = createRequire(__filename)('../metro.config.js') as { resolver: { resolveRequest: (c: unknown, m: string, p: string) => { filePath?: string } } };
const web = config.resolver.resolveRequest({ resolveRequest: () => ({}) }, '@supabase/realtime-js', 'web');
assert.ok(web.filePath?.endsWith('lib/realtimeStub.ts'), 'metro.config.js sends @supabase/realtime-js to the stub on the web');

console.log('realtimeStub.check: ok');
