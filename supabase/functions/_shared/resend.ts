import { HttpError } from "./http.ts";
import { isLocalStack } from "./localStack.ts";

/**
 * Who bar emails come from: "<Bar> via Cocktail" at this address (call 5:
 * the sign-in emails' domain, already verified in Resend). It moves with
 * them when the real domain lands: set the EMAIL_FROM_ADDRESS secret.
 */
export const fromAddress = () => Deno.env.get("EMAIL_FROM_ADDRESS") || "invites@babyvom.it";

export interface OutgoingEmail {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends one email through Resend's API (RESEND_API_KEY secret). Every
 * function that emails people goes through here. A local stack may point
 * RESEND_API_URL at a mock, so tests never send real mail; production
 * always talks to Resend.
 */
export async function sendEmail(email: OutgoingEmail): Promise<{ id: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new HttpError(503, "Email isn't set up yet.");
  const base = (isLocalStack() && Deno.env.get("RESEND_API_URL")) || "https://api.resend.com";
  const res = await fetch(`${base}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(email),
  });
  if (res.status === 429) throw new HttpError(429, "Too many emails just now. Try again in a minute.");
  if (!res.ok) {
    // Resend's message (a bad address, an unverified domain) stays in the logs.
    console.error("resend:", res.status, await res.text().catch(() => ""));
    if (res.status === 422) throw new HttpError(422, "That email address can't take mail. Check it and try again.");
    throw new Error(`Resend answered ${res.status}`);
  }
  return (await res.json()) as { id: string };
}
