// Checks that the local storage service can write to the storage schema it
// runs on.
//
// Storage releases before 1.77 save an upload with
// `ON CONFLICT (name, bucket_id)`, which needs the `storage.bucketid_objname`
// unique index. Storage 1.77 and later drop that index (their migration
// `drop-bucketid-objname-index`). So when a newer Supabase CLI (for example
// `npx supabase@latest`) has migrated the shared stack's storage schema and
// the stack then runs with this project's pinned CLI, every upload fails with
// a 500 from Postgres (42P10, "no unique or exclusion constraint matching the
// ON CONFLICT specification") and the upload security tests fail.
import pg from 'pg';

import { supabaseJson } from './supabase-cli.mjs';

/** True when a storage-api of this version ("1.61.10") needs bucketid_objname. */
export function uploadNeedsObjnameIndex(version) {
  const [major, minor] = String(version).trim().replace(/^v/, '').split('.').map(Number);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  return major < 1 || (major === 1 && minor < 77);
}

/** A message saying what is wrong and how to fix it, or null when uploads work. */
export async function localStorageProblem(workdir = []) {
  const status = supabaseJson(['status', '-o', 'json', ...workdir]);
  const res = await fetch(`${status.API_URL}/storage/v1/version`);
  if (!res.ok) return `The local storage service did not answer (${res.status}). Is it running?`;
  const version = (await res.text()).trim();
  if (!uploadNeedsObjnameIndex(version)) return null;
  const db = new pg.Client({ connectionString: status.DB_URL });
  await db.connect();
  try {
    const { rowCount } = await db.query("select 1 from pg_indexes where schemaname = 'storage' and indexname = 'bucketid_objname'");
    if (rowCount) return null;
  } finally {
    await db.end();
  }
  return [
    `The local storage service (${version}) needs the storage.bucketid_objname index, which a newer`,
    'Supabase CLI\'s storage migrations dropped. Every upload fails with 42P10 until it is back.',
    'Put it back (local stack only):',
    '  docker exec supabase_db_cocktail_app psql -U supabase_admin -d postgres -c \\',
    '    "create unique index bucketid_objname on storage.objects (bucket_id, name)"',
    'and run the Supabase CLI pinned in .github/workflows/ci.yml (SUPABASE_CLI), not npx supabase@latest.',
  ].join('\n');
}
