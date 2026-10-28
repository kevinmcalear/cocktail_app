// Emails the Cocktail team each note sent from the app (feedback_notes): the
// kind, the words, the photo, where it came from, who sent it, and a link to
// that session in Sentry (supabase/functions/_shared/noteEmail.ts).
//
// Called by the database (a trigger on feedback_notes insert, through pg_net;
// 20261128500000_feedback_note_email.sql), never by the app. It sends the
// shared FEEDBACK_EMAIL_SECRET instead of a user session; a local stack falls
// back to a fixed local secret. FEEDBACK_EMAIL_TO is who gets them (one
// address, or several split by commas). Without it, nothing is sent.
//
// POST { note_id } -> { sent }
import { createClient } from "npm:@supabase/supabase-js@2";

import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { isLocalStack, LOCAL_FEEDBACK_EMAIL_SECRET } from "../_shared/localStack.ts";
import { noteEmail } from "../_shared/noteEmail.ts";
import { fromAddress, sendEmail } from "../_shared/resend.ts";

/** How long the photo link in the email works. */
const PHOTO_LINK_SECONDS = 7 * 24 * 60 * 60;

serveJson("feedback-email", async (req) => {
  const secret = Deno.env.get("FEEDBACK_EMAIL_SECRET") || (isLocalStack() ? LOCAL_FEEDBACK_EMAIL_SECRET : "");
  if (!secret || !timingSafeEqual(req.headers.get("x-feedback-email-secret") ?? "", secret)) {
    throw new HttpError(401, "Not allowed.");
  }
  const to = (Deno.env.get("FEEDBACK_EMAIL_TO") ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  if (!to.length) return { sent: false, reason: "FEEDBACK_EMAIL_TO isn't set." };

  const body = await req.json().catch(() => ({}));
  const noteId = requireUuid(body?.note_id, "note_id");

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: note, error } = await admin
    .from("feedback_notes")
    .select("id, user_id, kind, screen, body, drink_name, photo_path, app_version, device, created_at, bars(name)")
    .eq("id", noteId)
    .maybeSingle();
  if (error) throw error;
  if (!note) throw new HttpError(404, "No such note.");

  const [{ data: profile }, photo] = await Promise.all([
    admin.from("profiles").select("display_name").eq("user_id", note.user_id).eq("kind", "person").maybeSingle(),
    // The note still goes without its photo if the link can't be made.
    note.photo_path ? admin.storage.from("feedback").createSignedUrl(note.photo_path, PHOTO_LINK_SECONDS) : Promise.resolve(null),
  ]);
  // A many-to-one embed: one row or null, though the untyped client calls it an array.
  const bar = note.bars as unknown as { name: string } | null;

  const content = noteEmail({
    id: note.id,
    kind: note.kind,
    screen: note.screen,
    body: note.body,
    drinkName: note.drink_name,
    barName: bar?.name ?? null,
    appVersion: note.app_version,
    device: note.device,
    createdAt: note.created_at,
    senderId: note.user_id,
    senderName: profile?.display_name?.trim() || null,
    photoUrl: photo?.data?.signedUrl ?? null,
  });
  await sendEmail({ from: `Cocktail notes <${fromAddress()}>`, to, ...content });
  return { sent: true };
});

function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}
