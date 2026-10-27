import { requireUser, type Caller } from "../_shared/auth.ts";
import { barSender, inviteEmail } from "../_shared/barEmail.ts";
import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { isLocalStack } from "../_shared/localStack.ts";
import { fromAddress, sendEmail } from "../_shared/resend.ts";
import { DEFAULT_SITE, siteOrigin } from "../_shared/site.ts";

// ponytail: copied from lib/roles.ts (functions can't import app code); keep in step.
const ROLE_LABELS: Record<number, string> = { 10: "Guest", 20: "Employee", 30: "Bartender", 35: "Drink Creator", 40: "Admin" };

/**
 * Emails someone their invite to a venue, in the venue's look
 * (invite-team-last, step 4). The invite itself is made first by
 * add_user_to_bar_by_email; this makes the sign-in link with Auth's
 * generateLink (which sends nothing) and sends one email through Resend,
 * account or not:
 *   * no account yet: an invite link. It makes the account (not set up yet,
 *     so onboarding runs) and lands on /auth/callback.
 *   * an account already: a sign-in link to the venue's staff link, where
 *     the invite waits.
 * The email carries the venue's welcome message, signed by the sender, and
 * the person's note. The reply is the same either way, like
 * add_user_to_bar_by_email's.
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
    .select("role_level, name, note")
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

  const { data: bar, error: barError } = await caller.admin
    .from("bars")
    .select("name, slug, logo_url, primary_color, display_face, welcome_message")
    .eq("id", barId)
    .single();
  if (barError) throw barError;

  const role = ROLE_LABELS[invite.role_level] ?? "a member";
  const joinUrl = await joinLink(caller, email, site, bar, { invite_bar: bar.name, invite_role: role, invite_name: invite.name ?? "" });
  const sender = await senderName(caller);
  const content = inviteEmail({
    bar: { name: bar.name, logoUrl: bar.logo_url, color: bar.primary_color, face: bar.display_face },
    role,
    sender,
    welcome: bar.welcome_message?.trim() || null,
    note: invite.note,
    joinUrl,
  });
  await sendEmail({ from: barSender(bar.name, fromAddress()), to: email, ...content });
  return { sent: true };
});

/**
 * The Join button's link: a token_hash the app exchanges on any device (no
 * PKCE code tied to this one), good for an hour. An invite link for a new
 * account; a sign-in link to the staff link for an existing one.
 */
async function joinLink(caller: Caller, email: string, site: string, bar: { slug: string | null }, data: Record<string, string>): Promise<string> {
  const callback = `${site}/auth/callback`;
  const { data: invited, error } = await caller.admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo: callback, data: { onboarded: false, ...data } },
  });
  if (!error) return `${callback}?token_hash=${encodeURIComponent(invited.properties.hashed_token)}&type=invite`;
  if (error.code !== "email_exists") throw error;

  const staff = bar.slug ? `${site}/v/${bar.slug}` : callback;
  const { data: link, error: linkError } = await caller.admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: staff } });
  if (linkError) throw linkError;
  return `${staff}?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=email`;
}

/** The sender as the invitee will know them: their profile's name, else the name they signed up with. */
async function senderName(caller: Caller): Promise<string | null> {
  const { data } = await caller.admin.from("profiles").select("display_name").eq("user_id", caller.user.id).eq("kind", "person").maybeSingle();
  const meta = caller.user.user_metadata?.full_name;
  return data?.display_name?.trim() || (typeof meta === "string" ? meta.trim() : "") || null;
}
