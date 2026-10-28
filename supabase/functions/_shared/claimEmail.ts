// Emails about claims on a person's or a bar's page (claim-email function,
// 20261128400000_claim_emails). Pure (no Deno or Node APIs), so the app's
// unit checks can run it (lib/claimEmail.check.ts). Sending is resend.ts.
import { barEmail, type BarLook, type EmailContent } from "./barEmail.ts";

/** Cocktail's own look, for an email no bar sends: the default accent and face. */
export const COCKTAIL_LOOK: BarLook = { name: "Cocktail", logoUrl: null, color: null, face: null };

/** "Cocktail" <address>: the sender when no bar sends it. */
export const cocktailSender = (address: string) => `"Cocktail" <${address}>`;

/** What the trigger sends about the claim (private.request_claim_email). */
export interface ClaimFacts {
  page: { kind: string; name: string; handle: string | null; id: string };
  /** Who is claiming, by the name on their account or person page. */
  claimant: string | null;
  method: string;
  /** The Instagram the code comes from, when the method is instagram. */
  instagram: string | null;
  note: string | null;
  /** The bar page they asked to confirm them (a person claim), by name. */
  confirmBar: string | null;
  /** The bar confirmed it (approved through confirm_person_claim). */
  confirmedByBar: boolean;
  declineReason: string | null;
  /** Turned down because someone else's claim on the page was approved. */
  rival: boolean;
}

const nounOf = (kind: string) => (kind === "person" ? "person" : kind === "maker" ? "maker" : kind === "supplier" ? "supplier" : "bar");

/** How the claimant offered to prove it, in a line. */
export function methodLine(c: ClaimFacts): string {
  const noun = nounOf(c.page.kind);
  if (c.confirmBar) return `Asked ${c.confirmBar} to confirm them.`;
  switch (c.method) {
    case "instagram":
      return c.instagram ? `A code sent from @${c.instagram} on Instagram.` : `A code sent from the ${noun}'s Instagram.`;
    case "email":
      return `A work email at the ${noun}'s website.`;
    case "phone":
      return `A call to the ${noun} with a code.`;
    default:
      return "A note.";
  }
}

const pageUrl = (site: string, c: ClaimFacts) => `${site}/p/${encodeURIComponent(c.page.handle ?? c.page.id)}`;

/** To the moderators: a claim is waiting. */
export function claimArrivedEmail(c: ClaimFacts, site: string): EmailContent {
  const who = c.claimant ?? "Someone";
  const person = c.page.kind === "person";
  return barEmail(COCKTAIL_LOOK, `${who} claims ${c.page.name}`, {
    preheader: methodLine(c),
    title: person ? `${who} says they're ${c.page.name}` : `${who} says ${c.page.name} is theirs`,
    lead: `How we check: ${methodLine(c)}${c.confirmBar ? ` ${c.confirmBar} can't confirm it just now, so a moderator decides.` : ""}`,
    note: c.note ? { label: "Their note", text: c.note } : null,
    button: { label: "Review claims", url: `${site}/p/review-claims` },
    small: `The page: ${pageUrl(site, c)}`,
    foot: "Sent with Cocktail to its moderators.",
  });
}

/** To the Admins of the bar a person asked to confirm them. */
export function claimToConfirmEmail(c: ClaimFacts, bar: BarLook, site: string): EmailContent {
  const who = c.claimant ?? "Someone";
  return barEmail(bar, `${who} says they're ${c.page.name}`, {
    preheader: `They asked ${bar.name} to confirm it.`,
    title: `Is this ${c.page.name}?`,
    lead: `${who} says they're ${c.page.name}, whose page lists ${bar.name}, and asked you to confirm it. Confirm only if you know it's them: the page and its drinks become theirs, and if they still work here they join the team as a Bartender.`,
    note: c.note ? { label: "Their note", text: c.note } : null,
    button: { label: "Open My team", url: `${site}/team` },
    small: `Confirm is on My team, under Confirm who they are. If it opens on another venue, switch to ${bar.name} first. Not sure? Leave it and a person checks.`,
    foot: `Sent with Cocktail to ${bar.name}'s Admins.`,
  });
}

/** To the claimant: it's theirs. A bar's email wears the bar's look. */
export function claimApprovedEmail(c: ClaimFacts, site: string, bar: BarLook | null): EmailContent {
  if (c.page.kind === "person") {
    return barEmail(COCKTAIL_LOOK, `${c.page.name}'s page is yours now`, {
      preheader: `${c.page.name}'s page is yours.`,
      title: "It's you",
      lead: `${c.confirmedByBar && c.confirmBar ? `${c.confirmBar} confirmed it` : "We checked"}, and ${c.page.name}'s page is yours now. Its jobs and drinks are on your profile.`,
      button: { label: "Open You", url: `${site}/profile` },
      foot: "Sent with Cocktail because you claimed this page.",
    });
  }
  return barEmail(bar ?? { ...COCKTAIL_LOOK, name: c.page.name }, `${c.page.name} is yours now`, {
    preheader: `${c.page.name}'s page is yours.`,
    title: `${c.page.name} is yours`,
    lead: `We checked, and ${c.page.name}'s page belongs to your venue now. What you change there, people see.`,
    button: { label: `Open ${c.page.name}`, url: pageUrl(site, c) },
    foot: "Sent with Cocktail because you claimed this page.",
  });
}

/** To the claimant: turned down, why, and how to try again. */
export function claimDeclinedEmail(c: ClaimFacts, site: string): EmailContent {
  const subject = `Your claim on ${c.page.name}`;
  const foot = "Sent with Cocktail because you claimed this page.";
  if (c.rival) {
    return barEmail(COCKTAIL_LOOK, subject, {
      preheader: `Someone else claimed ${c.page.name} first.`,
      title: `Someone else claimed ${c.page.name} first`,
      lead: "Their claim was approved, so yours was closed.",
      button: { label: "Get help", url: `${site}/support` },
      small: "If the page is really yours, write to us and a person will look.",
      foot,
    });
  }
  const person = c.page.kind === "person";
  return barEmail(COCKTAIL_LOOK, subject, {
    preheader: c.declineReason ?? "Your claim was turned down.",
    title: person ? "We couldn't confirm it's you" : `We couldn't confirm ${c.page.name} is yours`,
    lead: `Your claim on ${c.page.name}'s page was turned down.`,
    note: c.declineReason ? { label: "Why", text: c.declineReason } : null,
    button: { label: "Try again", url: pageUrl(site, c) },
    small: `Open the page to claim it again another way. Questions? ${site}/support`,
    foot,
  });
}
