import { createClient } from "npm:@supabase/supabase-js@2";

import { requireUser } from "../_shared/auth.ts";
import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { isLocalStack } from "../_shared/localStack.ts";
import { DEFAULT_SITE, siteOrigin } from "../_shared/site.ts";

// ponytail: copied from lib/roles.ts (functions can't import app code); keep in step.
const ROLE_LABELS: Record<number, string> = { 10: "Guest", 20: "Employee", 30: "Bartender", 35: "Drink Creator", 40: "Admin" };

/**
 * Emails someone their invite to a venue. The invite itself is made first by
 * add_user_to_bar_by_email; this only sends the email, with Supabase Auth's
 * own mailer (no other provider):
 *   * no account yet: Auth's invite email. It makes the account (not set up
 *     yet, so onboarding runs) and links to /auth/callback.
 *   * an account already: a sign-in link to the venue's staff link, where
 *     the invite waits.
 * The reply is the same either way, like add_user_to_bar_by_email's.
 */
serveJson("send-bar-invite", async (req) => {
  const caller = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const barId = requireUuid(body?.bar_id, "bar_id");
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const site = siteOrigin(body?.site, Deno.env.get("SITE_URL") || DEFAULT_SITE, isLocalStack());
  if (!email) throw new HttpError(400, "email is required.");

  // bar_invites RLS shows a venue's invites to its Admins and an invite to
  // its own invitee. Ruling out the caller's own email leaves the Admins.
  if (email === caller.user.email?.toLowerCase()) throw new HttpError(403, "Only the venue's Admins can send invites.");
  const { data: invite, error: inviteError } = await caller.userClient
    .from("bar_invites")
    .select("role_level, name")
    .eq("bar_id", barId)
    .eq("email", email)
    .maybeSingle();
  if (inviteError) throw inviteError;
  if (!invite) throw new HttpError(404, "There's no invite for that email. Invite them first.");

  // Each email takes one of today's: a few per invite, a few dozen per Admin.
  // ponytail: a send that then fails still uses its slot; hand it back if
  // mailer outages ever make that matter.
  const { data: slot, error: slotError } = await caller.admin.rpc("take_invite_email_slot", {
    p_sender: caller.user.id,
    p_bar_id: barId,
    p_email: email,
  });
  if (slotError) throw slotError;
  if (slot === "invite") throw new HttpError(429, "That invite has been emailed enough today. Try again tomorrow.");
  if (slot !== "ok") throw new HttpError(429, "You've sent enough invite emails today. Try again tomorrow.");

  const { data: bar, error: barError } = await caller.admin.from("bars").select("name, slug").eq("id", barId).single();
  if (barError) throw barError;

  const { error } = await caller.admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${site}/auth/callback`,
    data: {
      onboarded: false,
      invite_bar: bar.name,
      invite_role: ROLE_LABELS[invite.role_level] ?? "a member",
      invite_name: invite.name ?? "",
    },
  });
  if (!error) return { sent: true };
  if (error.status === 429) throw new HttpError(429, "That email was just sent. Try again in a minute.");
  if (error.code !== "email_exists") throw error;

  // An existing account. A plain client (implicit flow) so the link carries a
  // token_hash any device can use, not a PKCE code tied to this one.
  const auth = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  }).auth;
  const { error: linkError } = await auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: bar.slug ? `${site}/v/${bar.slug}` : `${site}/auth/callback` },
  });
  if (linkError?.status === 429) throw new HttpError(429, "That email was just sent. Try again in a minute.");
  if (linkError) throw linkError;
  return { sent: true };
});
