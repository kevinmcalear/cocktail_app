// A signed-in test user for LOCAL screen checks, without typing a password.
// Creates (or reuses) demo@example.test on the local Supabase stack, makes them
// Admin at Little Rye and Bartender at Pale Moth (from supabase/seed_demo.sql),
// signs in, and writes the session to .expo/dev-session.json.
//
//   node scripts/dev-user.mjs
//
// Web: put the file's contents in localStorage under its `storageKey`, then
// reload. Refuses to run against anything but a local stack.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
const url = status.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
  console.error(`Refusing to run against ${url}: local stack only.`);
  process.exit(1);
}

const EMAIL = 'demo@example.test';
const password = randomBytes(18).toString('base64url');
const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: list, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw listError;
let user = list.users.find((u) => u.email === EMAIL);
if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Demo Bartender' },
  });
  if (error) throw error;
  user = data.user;
}

const memberships = [
  { user_id: user.id, bar_id: '00000000-0000-4000-a000-000000000001', role_level: 40 },
  { user_id: user.id, bar_id: '00000000-0000-4000-a000-000000000002', role_level: 30 },
];
for (const m of memberships) {
  const { data: existing } = await admin.from('user_bars').select('id').eq('user_id', m.user_id).eq('bar_id', m.bar_id).maybeSingle();
  if (!existing) {
    const { error } = await admin.from('user_bars').insert(m);
    if (error) throw error;
  }
}

const client = createClient(url, status.ANON_KEY, { auth: { persistSession: false } });
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email: EMAIL, password });
if (signInError) throw signInError;

const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
mkdirSync('.expo', { recursive: true });
writeFileSync('.expo/dev-session.json', JSON.stringify({ storageKey, session: signIn.session }));
console.log(`Signed in ${EMAIL} (Admin at Little Rye, Bartender at Pale Moth). Session written to .expo/dev-session.json.`);
