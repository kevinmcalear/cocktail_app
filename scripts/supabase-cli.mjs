// Runs the Supabase CLI with JSON output. The CLI may log lines (such as
// "Connecting to local database...") before its JSON, and on failure it
// writes its own error to stdout as {"error":{"message":...}}.
import { execFileSync } from 'node:child_process';

/** The JSON object in the CLI's output, after any log lines. */
export function parseCliJson(stdout) {
  const start = stdout.indexOf('{');
  if (start === -1) throw new Error(`No JSON in supabase output: ${stdout.slice(0, 200)}`);
  return JSON.parse(stdout.slice(start));
}

/** The CLI's own error message from a failed execFileSync, or what it printed. */
export function cliErrorMessage(error) {
  const raw = String(error.stdout || error.stderr || error.message).trim();
  try {
    return parseCliJson(raw).error.message;
  } catch {
    return raw.slice(0, 500);
  }
}

/** Runs `supabase <args>` and returns its JSON; throws with the CLI's error message. */
export function supabaseJson(args) {
  let out;
  try {
    out = execFileSync('supabase', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new Error(cliErrorMessage(error));
  }
  return parseCliJson(out);
}

/**
 * `supabase migration list` as [{ local, remote }]: `local` is a version in
 * the workdir's supabase/migrations, `remote` one applied to the database
 * (an empty string when missing). `target` is '--local' or '--linked'.
 */
export function listMigrations(target, extra = []) {
  return supabaseJson(['migration', 'list', target, ...extra, '--output-format', 'json']).migrations;
}
