// Checks that the local database has exactly this checkout's migrations.
//
// Every worktree shares one local stack, so another branch's
// `supabase db reset` can leave its migrations applied here. The app and the
// security tests then run against a schema this checkout never wrote, and fail
// in ways that look like real bugs (for example PGRST200 on an embed whose
// foreign key another branch's migration removed).
//
//   npm run db:check
//
// Honours SUPABASE_WORKDIR, like the rest of the Supabase CLI.
import { execFileSync } from 'node:child_process';

let listed;
try {
  const out = execFileSync('supabase', ['migration', 'list', '--local', '--output-format', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  listed = JSON.parse(out).migrations;
} catch (error) {
  // The CLI reports its own errors as JSON on stdout.
  let detail = String(error.stdout || error.stderr || error.message).trim();
  try {
    detail = JSON.parse(detail).error.message;
  } catch {}
  console.error('Could not list the local database\'s migrations. Is the local stack running (`supabase start`)?');
  console.error(`  ${detail}`);
  process.exit(1);
}

const notInCheckout = listed.filter((m) => !m.local).map((m) => m.remote);
const notApplied = listed.filter((m) => !m.remote).map((m) => m.local);

if (notInCheckout.length || notApplied.length) {
  console.error('The local database does not match supabase/migrations in this checkout.');
  if (notInCheckout.length) {
    console.error(`  Applied, but not in this checkout (another branch's?): ${notInCheckout.join(', ')}`);
  }
  if (notApplied.length) console.error(`  In this checkout, but not applied: ${notApplied.join(', ')}`);
  console.error('Run `supabase db reset` from this checkout, or use a stack of your own (a separate project_id and ports).');
  process.exit(1);
}

console.log(`Local database matches this checkout's ${listed.length} migrations.`);
