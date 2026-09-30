// Reporting, blocking and the age check: the words and the small rules the
// safety screens share. The server has the final say on all of it (RLS and
// the RPCs in the publishing and moderation migrations).

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'sexual'
  | 'violence'
  | 'self_harm'
  | 'under_age'
  | 'impersonation'
  | 'misleading'
  | 'fake_rankings'
  | 'other';

export type ReportKind = 'profile' | 'item' | 'release' | 'ranking' | 'comment';

/** What a report is about: exactly the columns the reports table checks for its kind. */
export type ReportTarget =
  | { kind: 'profile'; profileId: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'release'; releaseId: string }
  | { kind: 'comment'; commentId: string }
  /** A bar's place on a list: itemId is the list ("Martini"), profileId the bar. */
  | { kind: 'ranking'; itemId: string; profileId: string };

export const REPORT_REASONS: { value: ReportReason; label: string; detail: string }[] = [
  { value: 'spam', label: 'Spam or a scam', detail: 'Ads, junk, or trying to get money or details' },
  { value: 'harassment', label: 'Bullying or harassment', detail: 'Picking on, threatening or shaming someone' },
  { value: 'hate', label: 'Hate', detail: 'Attacks on people for who they are' },
  { value: 'sexual', label: 'Nudity or sexual content', detail: 'Explicit pictures or words' },
  { value: 'violence', label: 'Violence or threats', detail: 'Threats, or showing someone being hurt' },
  { value: 'self_harm', label: 'Self-harm or suicide', detail: 'Someone may be at risk' },
  { value: 'under_age', label: 'Someone under drinking age', detail: 'A person who looks too young to drink' },
  { value: 'impersonation', label: 'Pretending to be someone else', detail: 'A fake bar, bartender or brand' },
  { value: 'misleading', label: 'False or misleading', detail: 'Wrong credit, a stolen recipe or made-up facts' },
  { value: 'fake_rankings', label: 'Fake rankings', detail: 'Paid, bought or made-up scores' },
  { value: 'other', label: 'Something else', detail: 'Tell us in the details' },
];

export const reasonLabel = (reason: ReportReason): string => REPORT_REASONS.find((r) => r.value === reason)?.label ?? 'Something else';

export interface ReportRow {
  target_kind: ReportKind;
  reason: ReportReason;
  details: string | null;
  profile_id?: string;
  item_id?: string;
  release_id?: string;
  comment_id?: string;
}

/** Insert columns for a report. */
export function reportRow(target: ReportTarget, reason: ReportReason, details: string): ReportRow {
  const text = details.trim().slice(0, 1000) || null;
  const base = { target_kind: target.kind, reason, details: text };
  switch (target.kind) {
    case 'profile':
      return { ...base, profile_id: target.profileId };
    case 'item':
      return { ...base, item_id: target.itemId };
    case 'release':
      return { ...base, release_id: target.releaseId };
    case 'ranking':
      return { ...base, item_id: target.itemId, profile_id: target.profileId };
    case 'comment':
      return { ...base, comment_id: target.commentId };
  }
}

export type ReportStatus = 'open' | 'actioned' | 'dismissed';

/** A report's outcome, in words, for the person who sent it. */
export function reportOutcome(status: ReportStatus): { label: string; detail: string } {
  switch (status) {
    case 'actioned':
      return { label: 'Action taken', detail: 'A moderator agreed and acted on it.' };
    case 'dismissed':
      return { label: 'No action taken', detail: 'A moderator looked and found it didn’t break the rules.' };
    default:
      return { label: 'Waiting', detail: 'A moderator hasn’t looked at it yet.' };
  }
}

export const REPORT_KIND_LABEL: Record<ReportKind | 'comment', string> = {
  profile: 'Profile',
  item: 'Drink',
  release: 'Release',
  ranking: 'Ranking',
  comment: 'Comment',
};

/**
 * What a report was about, from the names the reporter can still read.
 * Hidden or deleted things come back as null.
 */
export function reportSubject(
  kind: ReportKind | 'comment',
  names: { profile: string | null; item: string | null; release: string | null }
): string | null {
  switch (kind) {
    case 'profile':
      return names.profile;
    case 'item':
      return names.item;
    case 'release':
      return names.release;
    case 'ranking':
      return names.profile && names.item ? `${names.profile}’s ${names.item}` : null;
    default:
      return null;
  }
}

export const DAILY_REPORT_LIMIT = 20;

/**
 * Why a report didn't go through, in words. `reportsToday` is how many the
 * person filed in the last day (the insert policy refuses the 21st with the
 * same error as a target they can't see).
 */
export function reportErrorMessage(error: { code?: string; message?: string } | null | undefined, reportsToday: number | null): string {
  if (error?.code === '23505') return "You've already reported this. A moderator will look at it; there's no need to report it again.";
  if (error?.code === '42501') {
    if (reportsToday != null && reportsToday >= DAILY_REPORT_LIMIT) {
      return `You've sent ${DAILY_REPORT_LIMIT} reports today, which is the most we take from one person in a day. Try again tomorrow.`;
    }
    return "This can't be reported any more. It may have been removed already.";
  }
  return "Couldn't send your report. Check your connection and try again.";
}

// --- Age check ---

export type AgeCheck = 'confirmed' | 'under_age' | 'unknown';

/** A real calendar date from the three fields, as YYYY-MM-DD, or why not. */
export function parseBirthDate(day: string, month: string, year: string, today = new Date()): { date: string } | { error: string } {
  const [d, m, y] = [day, month, year].map((s) => s.trim());
  if (!d || !m || !y) return { error: 'Enter the day, month and year you were born.' };
  if (![d, m, y].every((s) => /^\d+$/.test(s))) return { error: 'Use numbers only, like 7, 4 and 1990.' };
  const [dn, mn, yn] = [Number(d), Number(m), Number(y)];
  if (y.length !== 4) return { error: 'Enter the year with four digits, like 1990.' };
  const date = new Date(Date.UTC(yn, mn - 1, dn));
  if (mn < 1 || mn > 12 || date.getUTCDate() !== dn || date.getUTCMonth() !== mn - 1) return { error: "That date doesn't exist. Check the day and month." };
  const iso = `${y}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (yn < 1900 || iso > todayIso) return { error: 'Enter your real date of birth.' };
  return { date: iso };
}

/** The device's country, as a two-letter code, when it has one. */
export function localeCountry(locales: { regionCode?: string | null }[]): string | null {
  const code = locales.find((l) => l.regionCode)?.regionCode?.toUpperCase();
  return code && /^[A-Z]{2}$/.test(code) ? code : null;
}
