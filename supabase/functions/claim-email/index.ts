import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";

import { barSender, type BarLook } from "../_shared/barEmail.ts";
import {
  claimApprovedEmail,
  claimArrivedEmail,
  claimDeclinedEmail,
  claimToConfirmEmail,
  cocktailSender,
  type ClaimFacts,
} from "../_shared/claimEmail.ts";
import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { isLocalStack, LOCAL_CLAIM_EMAIL_SECRET } from "../_shared/localStack.ts";
import { fromAddress, sendEmail } from "../_shared/resend.ts";
import { DEFAULT_SITE } from "../_shared/site.ts";

/**
 * Emails people about a claim on a person's or a bar's page
 * (20261128800000_claim_emails). Called by the database (a trigger on
 * profile_claims, through pg_net) with a shared secret, never by the app:
 *   arrived   a claim is waiting: the moderators, or the Admins of the bar a
 *             person asked to confirm them
 *   approved  the claimant: the page is theirs
 *   rejected  the claimant: turned down, why, and how to try again
 * The trigger says who to email (user ids) and what the claim was, as it was
 * when it changed: approving a person can merge the page away. Addresses are
 * read here, one email each, so nobody sees the others'. Best effort: the
 * claim is already saved, and a failed email is only logged.
 */

function authorized(req: Request): boolean {
  const expected = Deno.env.get("CLAIM_EMAIL_SECRET") || (isLocalStack() ? LOCAL_CLAIM_EMAIL_SECRET : "");
  const given = req.headers.get("x-claim-email-secret") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);

serveJson("claim-email", async (req) => {
  if (!authorized(req)) throw new HttpError(401, "Not allowed.");
  const body = await req.json().catch(() => ({}));
  const event = body?.event;
  if (event !== "arrived" && event !== "approved" && event !== "rejected") throw new HttpError(400, "event is required.");
  const to: string[] = Array.isArray(body?.to) ? body.to.map((id: unknown) => requireUuid(id, "to")) : [];
  if (!to.length) return { sent: 0 };
  const page = body?.page ?? {};
  const facts: ClaimFacts = {
    page: { id: requireUuid(page.id, "page.id"), kind: text(page.kind) ?? "bar", name: text(page.name) ?? "This page", handle: text(page.handle) },
    claimant: text(body.claimant),
    method: text(body.method) ?? "note",
    instagram: text(body.instagram),
    note: text(body.note),
    confirmBar: text(body.confirm_bar?.name),
    confirmedByBar: body.confirmed_by_bar === true,
    declineReason: text(body.decline_reason),
    rival: body.rival === true,
  };
  const site = new URL(Deno.env.get("SITE_URL") || DEFAULT_SITE).origin;
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // A venue's look, for an email the bar sends or one about the bar.
  const lookOf = async (venueId: unknown): Promise<BarLook | null> => {
    if (typeof venueId !== "string") return null;
    const { data } = await admin.from("bars").select("name, logo_url, primary_color, display_face, ground_tint").eq("id", requireUuid(venueId, "venue_id")).maybeSingle();
    return data ? { name: data.name, logoUrl: data.logo_url, color: data.primary_color, face: data.display_face, groundTint: data.ground_tint } : null;
  };

  let content;
  let from = cocktailSender(fromAddress());
  if (event === "arrived" && body.to_bar === true) {
    const bar = await lookOf(body.confirm_bar?.venue_id);
    if (!bar) return { sent: 0 };
    content = claimToConfirmEmail(facts, bar, site);
    from = barSender(bar.name, fromAddress());
  } else if (event === "arrived") {
    content = claimArrivedEmail(facts, site);
  } else if (event === "approved") {
    const bar = facts.page.kind === "person" ? null : await lookOf(page.venue_id);
    content = claimApprovedEmail(facts, site, bar);
    if (bar) from = barSender(bar.name, fromAddress());
  } else {
    content = claimDeclinedEmail(facts, site);
  }

  // One bad address doesn't stop the rest.
  const results = await Promise.allSettled(
    to.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (!data.user?.email) throw new Error("no email");
      await sendEmail({ from, to: data.user.email, ...content });
    }),
  );
  for (const r of results) if (r.status === "rejected") console.error(`claim-email: one ${event} email failed:`, r.reason);
  return { sent: results.filter((r) => r.status === "fulfilled").length };
});
