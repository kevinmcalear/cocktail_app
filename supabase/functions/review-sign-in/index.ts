import { createClient } from "npm:@supabase/supabase-js@2";

import { HttpError, serveJson } from "../_shared/http.ts";
import { isLocalStack, LOCAL_REVIEW_CODE, LOCAL_REVIEW_EMAIL } from "../_shared/localStack.ts";

const WRONG = "That code doesn't match.";
const LOCKED = "Too many tries. Wait 15 minutes, then try again.";

/**
 * App Review (Apple and Google) can't receive our sign-in emails, so its one
 * account signs in with a fixed code we give the reviewers. The app tries
 * this only after the emailed code fails. Anything but the review email gets
 * the same answer as a wrong code. Both values are secrets
 * (`supabase secrets set REVIEW_EMAIL=... REVIEW_CODE=...`); with either
 * unset the function is off.
 *
 * Returns a one-time link token for that account (a sign-up one if it just
 * made the account), which the app swaps for a session with verifyOtp,
 * exactly as an emailed link would.
 */
serveJson("review-sign-in", async (req) => {
  const reviewEmail = (Deno.env.get("REVIEW_EMAIL") ?? (isLocalStack() ? LOCAL_REVIEW_EMAIL : "")).trim().toLowerCase();
  const reviewCode = Deno.env.get("REVIEW_CODE") ?? (isLocalStack() ? LOCAL_REVIEW_CODE : "");
  if (!reviewEmail || !reviewCode) throw new HttpError(404, "Not found.");
  if (req.method !== "POST") throw new HttpError(405, "Use POST.");

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code : "";
  if (email !== reviewEmail) throw new HttpError(401, WRONG);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false },
  });
  // Every try is taken under a lock in the database before the code is
  // compared, so many requests at once can't each get a guess: 5 per 15
  // minutes (take_review_code_try), which makes the six digits take years.
  const { data: tryId, error: tryError } = await admin.rpc("take_review_code_try");
  if (tryError) throw tryError;
  if (tryId === null) throw new HttpError(429, LOCKED);
  if (!sameCode(code, reviewCode)) throw new HttpError(401, WRONG);

  const { error: backError } = await admin.rpc("give_back_review_code_try", { p_id: tryId });
  if (backError) throw backError;
  // Makes the account if it doesn't exist yet; setup and the age check still
  // run, as for anyone new.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: reviewEmail,
    options: { data: { onboarded: false } },
  });
  if (error) throw error;
  return { token_hash: data.properties.hashed_token };
});

/** Compares in time that doesn't depend on where the codes differ. */
function sameCode(typed: string, expected: string): boolean {
  const a = new TextEncoder().encode(typed);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}
