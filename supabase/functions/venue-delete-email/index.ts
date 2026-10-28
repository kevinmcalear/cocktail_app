import { callerName, requireUser } from "../_shared/auth.ts";
import { barSender, venueDeleteEmail } from "../_shared/barEmail.ts";
import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { isLocalStack } from "../_shared/localStack.ts";
import { fromAddress, sendEmail } from "../_shared/resend.ts";
import { DEFAULT_SITE, siteOrigin } from "../_shared/site.ts";

/**
 * Emails a venue's other Admins when one asks to delete it
 * (20261121400000_delete_a_venue: 7 days, then it goes, unless an Admin
 * undoes it). The app calls this right after delete_venue; the in-app banner
 * stays the notice of record. Only the Admin who asked can call it, and each
 * request is emailed once (emailed_at), however often it's called. One email
 * per Admin, so nobody sees the others' addresses.
 */
serveJson("venue-delete-email", async (req) => {
  const caller = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const barId = requireUuid(body?.bar_id, "bar_id");
  const site = siteOrigin(body?.site, Deno.env.get("SITE_URL") || DEFAULT_SITE, isLocalStack());

  // RLS shows the request to the venue's members; only the one who asked sends it.
  const { data: request, error: requestError } = await caller.userClient
    .from("venue_delete_requests")
    .select("requested_by, deletes_at")
    .eq("bar_id", barId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request || request.requested_by !== caller.user.id) throw new HttpError(404, "You haven't asked to delete that venue.");

  // Claim it before sending: a second call finds it taken and sends nothing.
  const { data: claimed, error: claimError } = await caller.admin
    .from("venue_delete_requests")
    .update({ emailed_at: new Date().toISOString() })
    .eq("bar_id", barId)
    .eq("requested_by", caller.user.id)
    .is("emailed_at", null)
    .select("bar_id");
  if (claimError) throw claimError;
  if (!claimed?.length) return { sent: 0 };

  const [{ data: bar, error: barError }, { data: members, error: membersError }] = await Promise.all([
    caller.admin.from("bars").select("name, logo_url, primary_color, display_face, ground_tint").eq("id", barId).single(),
    caller.admin.from("user_bars").select("user_id, venue_roles(ends_at)").eq("bar_id", barId).gte("role_level", 40).neq("user_id", caller.user.id),
  ]);
  if (barError) throw barError;
  if (membersError) throw membersError;
  // A takeover Admin whose role has ended can't undo it, so isn't told.
  const now = Date.now();
  const admins = members.filter((m) => {
    // A many-to-one embed: one row or null, though the untyped client calls it an array.
    const role = m.venue_roles as unknown as { ends_at: string | null } | null;
    return !role?.ends_at || Date.parse(role.ends_at) > now;
  });
  if (!admins.length) return { sent: 0 };

  const content = venueDeleteEmail({
    bar: { name: bar.name, logoUrl: bar.logo_url, color: bar.primary_color, face: bar.display_face, groundTint: bar.ground_tint },
    askedBy: await callerName(caller),
    deletesAt: request.deletes_at,
    undoUrl: `${site}/settings/bar/${barId}`,
  });
  const from = barSender(bar.name, fromAddress());
  // One Admin's bad address doesn't stop the rest.
  const results = await Promise.allSettled(
    admins.map(async ({ user_id }) => {
      const { data } = await caller.admin.auth.admin.getUserById(user_id);
      if (!data.user?.email) throw new Error("no email");
      await sendEmail({ from, to: data.user.email, ...content });
    }),
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  for (const r of results) if (r.status === "rejected") console.error("venue-delete-email: one Admin's email failed:", r.reason);
  // Nobody reached (Resend down, no key yet): hand the claim back so the next call tries again.
  if (!sent) {
    await caller.admin.from("venue_delete_requests").update({ emailed_at: null }).eq("bar_id", barId).eq("requested_by", caller.user.id);
  }
  return { sent };
});
