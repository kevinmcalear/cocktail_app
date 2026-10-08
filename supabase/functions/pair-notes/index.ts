import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";

import { askJson, pairNotesModel } from "../_shared/gemini.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { isLocalStack, LOCAL_PAIR_NOTES_SECRET } from "../_shared/localStack.ts";
import { notesPrompt, notesSchema, parseNotes, type PairToNote } from "../_shared/pairNotes.ts";

/**
 * Writes "why it works" notes for the strongest pairings that have none
 * (supabase/migrations/20261008130000_pair_notes.sql).
 *
 * POST with the shared secret and an optional {"limit": n} (default 100, at
 * most 200): takes that many pairs from next_pair_notes, asks the model in
 * batches of 25 with what we know about each (taste words from the flavor
 * rules, drinks behind it), checks every sentence (_shared/pairNotes.ts) and
 * saves the good ones. Nothing is scheduled: an admin runs it after deploy.
 * GET returns which model it would use. The model is mocked on a local stack
 * and off in production until PAIR_NOTES_MODEL=live is set.
 */

const FN = "pair-notes";
const BATCH = 25;

function authorized(req: Request): boolean {
  const expected = Deno.env.get("PAIR_NOTES_SECRET") || (isLocalStack() ? LOCAL_PAIR_NOTES_SECRET : "");
  const given = req.headers.get("x-pair-notes-secret") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** The local stand-in: a plain sentence per pair, so tests never spend real quota. */
function mockAnswer(pairs: readonly PairToNote[]): string {
  return JSON.stringify({
    notes: pairs.map((p) => ({ id: `${p.a_id}|${p.b_id}`, note: `${p.b_name} gives ${p.a_name} something to lean on in the glass.` })),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!authorized(req)) return json({ error: "Not allowed." }, 401);
  const model = pairNotesModel();
  if (req.method === "GET") return json({ model });
  if (model === "off") return json({ model, saved: 0, note: "Set PAIR_NOTES_MODEL=live to write notes." });

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 100, 1), 200);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.rpc("next_pair_notes", { p_limit: limit });
  if (error) {
    console.error(`${FN}: next_pair_notes failed:`, error);
    return json({ error: "Couldn't read the pairs." }, 500);
  }
  const pairs = (data ?? []) as PairToNote[];
  let saved = 0;
  let refused = 0;
  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    try {
      const text = model === "mock" ? mockAnswer(batch) : await askJson(notesPrompt(batch), notesSchema);
      const notes = parseNotes(text, batch);
      refused += batch.length - notes.length;
      if (!notes.length) continue;
      const { data: n, error: saveError } = await admin.rpc("save_pair_notes", { p_notes: notes });
      if (saveError) throw saveError;
      saved += Number(n) || 0;
    } catch (err) {
      console.error(`${FN}: batch ${i / BATCH + 1} failed:`, err);
      refused += batch.length;
    }
  }
  return json({ model, asked: pairs.length, saved, refused });
});
