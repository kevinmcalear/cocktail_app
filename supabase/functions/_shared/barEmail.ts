// Emails sent in a bar's own look: its logo, colour and font
// (invite-team-last, step 4). Pure (no Deno or Node APIs), so the app's unit
// checks can run it (lib/barEmail.check.ts). Sending is resend.ts.

/** What an email needs to know about the bar. */
export interface BarLook {
  name: string;
  logoUrl: string | null;
  /** The accent, "#RRGGBB"; anything else falls back to Cocktail's. */
  color: string | null;
  /** A venue_display_face value. */
  face: string | null;
  /** The dark ground tint, "#RRGGBB"; one text wouldn't read on is ignored, as in the app. */
  groundTint?: string | null;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// Cocktail's own accent, for a bar that hasn't picked one.
const DEFAULT_ACCENT = "#E4B062";
// The app's dark Back Bar colours, as the board draws the email (InvitePreview draws the same).
const PAGE = "#0E0D0C";
const CARD = "#1A1816";
const INK = "#F3EEE6";
const MUTED = "#A59C90";
const LINE = "#2F2D2B";
const NOTE = "#2A2623";
const DARK = "#0E0D0C";
const BODY_FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// venue_display_face values and their Google font families, as the app loads them
// (constants/tokens displayFaces; functions can't import app code, so keep in step).
// Apple Mail and iOS Mail load the Google font; Gmail and Outlook show the fallback.
// `italic`: the app has an italic for it; the others stay upright, as the app draws them.
const FACES: Record<string, { family: string; fallback: string; italic: boolean }> = {
  instrument_serif: { family: "Instrument Serif", fallback: "Georgia,'Times New Roman',serif", italic: true },
  fraunces: { family: "Fraunces", fallback: "Georgia,'Times New Roman',serif", italic: true },
  playfair_display: { family: "Playfair Display", fallback: "Georgia,'Times New Roman',serif", italic: true },
  bricolage_grotesque: { family: "Bricolage Grotesque", fallback: "Helvetica,Arial,sans-serif", italic: false },
  josefin_sans: { family: "Josefin Sans", fallback: "Helvetica,Arial,sans-serif", italic: false },
  tenor_sans: { family: "Tenor Sans", fallback: "Helvetica,Arial,sans-serif", italic: false },
};

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Text as HTML, its line breaks kept. */
const html = (value: string) => escapeHtml(value).replace(/\r?\n/g, "<br>");

/** The accent when it's a real colour, else Cocktail's. */
export function accentOf(color: string | null): string {
  return isHex(color) ? color : DEFAULT_ACCENT;
}

const isHex = (color: string | null | undefined): color is string => !!color && /^#[0-9a-f]{6}$/i.test(color);

/** WCAG relative luminance of "#RRGGBB". */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Dark or cream text, whichever reads on the accent. */
export function textOn(accent: string): string {
  const l = luminance(accent);
  return (l + 0.05) / 0.05 > 1.05 / (l + 0.05) ? DARK : INK;
}

/** The ground tint when the app would use it (lib/brand usableGroundTint: ink reads at 7:1), else null. */
export function groundOf(tint: string | null | undefined): string | null {
  return isHex(tint) && (luminance(INK) + 0.05) / (luminance(tint) + 0.05) >= 7 ? tint : null;
}

/** "#RRGGBB" toward black by `amount` (0 to 1). */
function darken(hex: string, amount: number): string {
  return "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** "Little Rye via Cocktail <invites@babyvom.it>": the bar's name, safe for a header. */
export function barSender(barName: string, address: string): string {
  const name = barName.replace(/[\r\n]+/g, " ").replace(/["\\<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "A bar";
  return `"${name} via Cocktail" <${address}>`;
}

/** "L" for Little Rye: the mark when the bar has no logo, as the app's VenueMark draws it. */
export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export interface BarEmailBody {
  /** The line inbox lists show after the subject. */
  preheader: string;
  title: string;
  lead: string;
  /** A message from the bar, signed (the welcome message). */
  message?: { text: string; signedBy: string | null } | null;
  /** A boxed line just for this reader (a per-person note). */
  note?: { label: string; text: string } | null;
  button?: { label: string; url: string } | null;
  /** Small print under the button. */
  small?: string;
  /** The foot: why this came and what to do if it's not for them. */
  foot: string;
}

/**
 * An email in the bar's look. Table layout and inline styles, which every
 * mail client draws; the font is a Google font link Apple Mail loads, with
 * a plain serif or sans for the rest. The text part says the same.
 */
export function barEmail(bar: BarLook, subject: string, body: BarEmailBody): EmailContent {
  const accent = accentOf(bar.color);
  const face = FACES[bar.face ?? ""] ?? FACES.instrument_serif;
  const display = `'${face.family}',${face.fallback}`;
  const slant = face.italic ? "font-style:italic;" : "";
  // A tinted bar: the card is its ground, as the app's screens are, on a deeper shade of it.
  const ground = groundOf(bar.groundTint);
  const card = ground ?? CARD;
  const page = ground ? darken(ground, 0.4) : PAGE;
  const fontHref = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(face.family).replace(/%20/g, "+")}&amp;display=swap`;
  const name = escapeHtml(bar.name);
  const mark = bar.logoUrl && /^https:\/\//.test(bar.logoUrl)
    ? `<img src="${escapeHtml(bar.logoUrl)}" width="48" height="48" alt="${name}" style="display:block;border:0;border-radius:14px;width:48px;height:48px;">`
    : `<div style="width:48px;height:48px;border-radius:13px;background-color:${accent};text-align:center;line-height:48px;font-family:${display};${slant}font-size:29px;color:${textOn(accent)};">${escapeHtml(initial(bar.name))}</div>`;
  const p = (text: string, style: string) => `<p style="margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:24px;${style}">${text}</p>`;
  const rows = [
    `<tr><td style="padding-bottom:20px;">${mark}</td></tr>`,
    `<tr><td style="padding-bottom:8px;font-family:${BODY_FONT};font-size:13px;line-height:18px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${accent};">${name}</td></tr>`,
    `<tr><td style="padding-bottom:8px;font-family:${display};font-size:32px;line-height:38px;color:${INK};">${html(body.title)}</td></tr>`,
    `<tr><td>${p(html(body.lead), `color:${MUTED};`)}</td></tr>`,
  ];
  if (body.message?.text.trim()) {
    rows.push(`<tr><td>${p(html(body.message.text.trim()), `color:${INK};`)}${body.message.signedBy ? `<p style="margin:0 0 20px;font-family:${display};${slant}font-size:18px;line-height:24px;color:${MUTED};">${html(body.message.signedBy)}</p>` : ""}</td></tr>`);
  }
  if (body.note?.text.trim()) {
    rows.push(
      `<tr><td style="padding-bottom:20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="${NOTE}" style="background-color:${NOTE};border-radius:14px;padding:16px 20px;">` +
        `<p style="margin:0 0 4px;font-family:${BODY_FONT};font-size:13px;line-height:18px;font-weight:600;color:${accent};">${html(body.note.label)}</p>` +
        `<p style="margin:0;font-family:${BODY_FONT};font-size:16px;line-height:24px;color:${INK};">${html(body.note.text.trim())}</p></td></tr></table></td></tr>`,
    );
  }
  if (body.button) {
    rows.push(
      `<tr><td style="padding:4px 0 16px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${accent}" style="background-color:${accent};border-radius:999px;">` +
        `<a href="${escapeHtml(body.button.url)}" style="display:inline-block;padding:13px 28px;font-family:${BODY_FONT};font-size:16px;line-height:20px;font-weight:600;color:${textOn(accent)};text-decoration:none;">${html(body.button.label)}</a></td></tr></table></td></tr>`,
    );
  }
  if (body.small) rows.push(`<tr><td style="font-family:${BODY_FONT};font-size:13px;line-height:19px;color:${MUTED};padding-bottom:20px;">${html(body.small)}</td></tr>`);
  rows.push(`<tr><td style="border-top:1px solid ${LINE};padding-top:16px;font-family:${BODY_FONT};font-size:13px;line-height:19px;color:${MUTED};">${html(body.foot)}</td></tr>`);

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
<link href="${fontHref}" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:${page};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(body.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${page}" style="background-color:${page};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td bgcolor="${card}" style="background-color:${card};border-radius:22px;padding:32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${rows.join("\n")}
</table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    bar.name,
    "",
    body.title,
    body.lead,
    ...(body.message?.text.trim() ? ["", body.message.text.trim(), ...(body.message.signedBy ? [body.message.signedBy] : [])] : []),
    ...(body.note?.text.trim() ? ["", `${body.note.label}: ${body.note.text.trim()}`] : []),
    ...(body.button ? ["", `${body.button.label}: ${body.button.url}`] : []),
    ...(body.small ? ["", body.small] : []),
    "",
    body.foot,
  ].join("\n");
  return { subject, html: doc, text };
}

/** "Rob" from "Rob Hale". */
const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? "";

const article = (word: string) => `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;

/**
 * The invite (invite-team-last, step 4): one email, account or not, with the
 * bar's welcome message signed by the sender, then the person's own note.
 * The app's InvitePreview draws the same; keep the two in step.
 */
export function inviteEmail(input: {
  bar: BarLook;
  role: string;
  /** Who sends it, by the name they go by. */
  sender: string | null;
  welcome: string | null;
  note: string | null;
  joinUrl: string;
}): EmailContent {
  const { bar, sender } = input;
  const subject = sender ? `${firstWord(sender)} invited you to ${bar.name}` : `You're invited to ${bar.name}`;
  return barEmail(bar, subject, {
    preheader: input.welcome?.trim() || `Join ${bar.name} as ${article(input.role)}.`,
    title: `Join ${bar.name} as ${article(input.role)}`,
    lead: `${sender ?? bar.name} added you to the team.`,
    message: input.welcome ? { text: input.welcome, signedBy: sender } : null,
    note: input.note ? { label: "A note for you", text: input.note } : null,
    button: { label: `Join ${bar.name}`, url: input.joinUrl },
    small: "Open it on the phone or computer you'll use. The button signs you in for an hour; after that it asks for your email and sends a code.",
    foot: `Sent with Cocktail for ${bar.name}. Not you? Ignore it: nobody joins without your email.`,
  });
}

/** "Tue 3 Nov", as the app's banner says it (lib/venueDelete deleteDay), in UTC. */
export function deleteDay(iso: string): string {
  // From the parts: Deno's ICU puts a comma after the weekday, Node's doesn't.
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")}`;
}

/**
 * To a venue's other Admins when one asks to delete it (7 days, with Undo):
 * who asked, the day it goes, what stays and goes, and where to undo it.
 * Same sender and look as the invite.
 */
export function venueDeleteEmail(input: { bar: BarLook; askedBy: string | null; deletesAt: string; undoUrl: string }): EmailContent {
  const { bar } = input;
  const who = input.askedBy ?? "An Admin";
  const day = deleteDay(input.deletesAt);
  return barEmail(bar, `${input.askedBy ? firstWord(input.askedBy) : who} asked to delete ${bar.name}`, {
    preheader: `It goes on ${day} unless an Admin undoes it.`,
    title: `${bar.name} goes on ${day}`,
    lead: `${who} asked to delete ${bar.name}. Until ${day} everything works as normal, and any Admin can undo it.`,
    message: {
      text: `Drinks the public could see stay on ${bar.name}'s page, which goes back to unclaimed. Everything else goes: the team, menus, recipes, kit and settings.`,
      signedBy: null,
    },
    button: { label: `Undo, keep ${bar.name}`, url: input.undoUrl },
    small: "The button opens the venue's settings, where Undo is.",
    foot: `Sent with Cocktail to ${bar.name}'s Admins. If you meant this, there's nothing to do.`,
  });
}
