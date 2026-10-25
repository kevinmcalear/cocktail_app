import { createClient } from "npm:@supabase/supabase-js@2";

import { HttpError, serveJson } from "../_shared/http.ts";
import { isLocalStack, LOCAL_REVIEW_CODE, LOCAL_REVIEW_EMAIL } from "../_shared/localStack.ts";

/** Wrong codes allowed per window before the account stops taking any. */
const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const WRONG = "That code doesn't match.";

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
  // Makes the account if it doesn't exist yet; setup and the age check still
  // run, as for anyone new. The token only leaves here with the right code.
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: reviewEmail,
    options: { data: { onboarded: false } },
  });
  if (error) throw error;

  // Wrong tries are counted on the account itself, so guessing the six
  // digits takes years: MAX_FAILS per window, then nothing until it ends.
  const meta = data.user.app_metadata ?? {};
  const since = Date.parse(meta.review_code_since ?? "");
  const inWindow = Number.isFinite(since) && Date.now() - since < WINDOW_MS;
  const fails = inWindow ? Number(meta.review_code_fails) || 0 : 0;
  if (fails >= MAX_FAILS) throw new HttpError(429, "Too many tries. Wait 15 minutes, then try again.");

  if (!sameCode(code, reviewCode)) {
    const { error: countError } = await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: {
        review_code_fails: fails + 1,
        review_code_since: inWindow ? meta.review_code_since : new Date().toISOString(),
      },
    });
    if (countError) throw countError;
    throw new HttpError(401, WRONG);
  }

  if (fails > 0) {
    const { error: resetError } = await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { review_code_fails: 0, review_code_since: null },
    });
    if (resetError) throw resetError;
  }
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
