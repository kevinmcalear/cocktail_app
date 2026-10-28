import { escapeHtml, type EmailContent } from "./barEmail.ts";

/** A note from feedback_notes, with the names the email shows. */
export interface NoteForEmail {
  id: string;
  kind: string;
  screen: string;
  body: string;
  drinkName: string | null;
  barName: string | null;
  appVersion: string | null;
  device: string | null;
  createdAt: string;
  senderId: string;
  senderName: string | null;
  /** A signed link to the photo, when there is one. */
  photoUrl: string | null;
}

/** As the app's sheet names them (components/feedback/NoteSheet.tsx REPORT_KINDS); keep the two in step. */
const KIND_LABELS: Record<string, string> = {
  tell_us: "Tell us",
  broken: "Something’s broken",
  wrong: "Looks wrong",
  slow: "It’s slow",
  data: "Wrong information",
  other: "Something else",
};

/** Sentry's User Feedback, searched for the note's id (lib/monitoring reportFeedback tags it). */
export const sentryFeedbackUrl = (noteId: string) => `https://cocktail-z3.sentry.io/feedback/?query=${encodeURIComponent(`note_id:${noteId}`)}`;

/** "28 Oct 2026, 9:14 PM" in New York, where the team is. */
export function sentAt(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/**
 * The email the Cocktail team gets for each note sent from the app: what kind,
 * the words, the photo, where it came from, who sent it, and the way to its
 * session in Sentry. Plain on purpose: it's for us, not a bar.
 */
export function noteEmail(note: NoteForEmail): EmailContent {
  const kind = KIND_LABELS[note.kind] ?? note.kind;
  const where = [note.screen, note.drinkName?.trim(), note.barName].filter(Boolean).join(" · ");
  const subject = `${kind}: ${where}`.slice(0, 200);
  const words = note.body.trim() || "(No words)";
  const from = note.senderName ? `${note.senderName} (${note.senderId})` : note.senderId;
  const rows: [string, string][] = [
    ["From", from],
    ["Screen", note.screen],
    ...(note.drinkName?.trim() ? [["Drink", note.drinkName.trim()] as [string, string]] : []),
    ...(note.barName ? [["Bar", note.barName] as [string, string]] : []),
    ["App", note.appVersion ?? "unknown"],
    ["Device", note.device ?? "unknown"],
    ["Sent", sentAt(note.createdAt)],
    ["Note", note.id],
  ];
  const sentry = sentryFeedbackUrl(note.id);

  const text = [
    kind,
    "",
    words,
    "",
    ...(note.photoUrl ? [`Photo (link works for 7 days): ${note.photoUrl}`, ""] : []),
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Steps and errors before it, in Sentry: ${sentry}`,
  ].join("\n");

  const cell = "padding:4px 12px 4px 0;vertical-align:top;font:14px/1.4 Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;color:#1a1a1a">
<div style="max-width:560px">
<p style="margin:0 0 4px;font:600 12px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6b6b6b">A note from the app</p>
<h1 style="margin:0 0 16px;font:600 22px/1.3 Helvetica,Arial,sans-serif">${escapeHtml(kind)}</h1>
<p style="margin:0 0 20px;font:16px/1.5 Helvetica,Arial,sans-serif;white-space:pre-wrap">${escapeHtml(words)}</p>
${note.photoUrl ? `<p style="margin:0 0 20px"><a href="${escapeHtml(note.photoUrl)}"><img src="${escapeHtml(note.photoUrl)}" alt="The photo sent with the note" width="280" style="max-width:100%;border-radius:8px;border:1px solid #e5e5e5"></a><br><span style="font:12px/1.4 Helvetica,Arial,sans-serif;color:#6b6b6b">The link works for 7 days.</span></p>` : ""}
<table role="presentation" style="border-collapse:collapse;margin:0 0 20px">${rows
    .map(([k, v]) => `<tr><td style="${cell};color:#6b6b6b">${escapeHtml(k)}</td><td style="${cell}">${escapeHtml(v)}</td></tr>`)
    .join("")}</table>
<p style="margin:0;font:14px/1.4 Helvetica,Arial,sans-serif"><a href="${escapeHtml(sentry)}" style="color:#1a1a1a">Steps and errors before it, in Sentry</a></p>
</div></body></html>`;

  return { subject, html, text };
}
