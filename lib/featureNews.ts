import type { IconName } from '@/components/ds';
import { VENUE_FEATURES, type VenueFeatureKey, type VenueTab } from './venueFeatures';

/**
 * "New at <venue>": when a venue's Admin switches a feature on, everyone else
 * there sees one line at the top of the Library until they dismiss it, and a
 * dot on the new tab until they open it (whole-app canvas, Onboarding, "Staff:
 * something new at the venue"). The switches are recorded by the database
 * (public.venue_feature_events, 20261027100000); what each person has seen is
 * in their account's metadata (`feature_news`), so it follows them to every
 * device.
 */

/** A switch that changed, as public.venue_feature_events stores it. */
export interface FeatureEvent {
  id: string;
  feature: string;
  enabled: boolean;
  by_user: string | null;
  at: string;
}

/** What you've seen, per venue and feature: the time of the newest switch you dismissed (line) or opened the tab for (tab). */
export type FeatureNewsSeen = Record<string, Record<string, { line?: string; tab?: string }>>;

/** News older than this isn't new: it's how far back the app asks, and how long seen marks are kept. */
export const NEWS_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const TABS: Partial<Record<VenueFeatureKey, VenueTab>> = { tonight: 'index', prep: 'prep', study: 'test' };

/** The tab a feature adds, by route name, or null for one that adds a place (Back bar, History...). */
export function featureTab(feature: string): VenueTab | null {
  return TABS[feature as VenueFeatureKey] ?? null;
}

const ICONS: Record<VenueFeatureKey, IconName> = {
  tonight: 'calendar',
  prep: 'flask',
  study: 'rectangle.stack',
  backBar: 'map.fill',
  history: 'clock.arrow.circlepath',
  flavorMap: 'target',
  techniques: 'flask',
  libraryExtras: 'line.3.horizontal.decrease',
};

/** The icon of the tab or place a feature adds. 'calendar' is Tonight's dated page (TabIcon). */
export function featureIcon(feature: string): IconName {
  return ICONS[feature as VenueFeatureKey] ?? 'sparkles';
}

export function featureLabel(feature: string): string {
  return VENUE_FEATURES.find((f) => f.key === feature)?.label ?? feature;
}

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

/**
 * The features someone else switched on that are news to you, newest first:
 * the latest switch of each feature, if it turned it on, it's still on, it
 * wasn't you, it came after you joined, and it's under NEWS_DAYS old.
 */
export function pendingNews(events: readonly FeatureEvent[], o: { me: string | null; on: readonly string[]; joinedAt?: string | null; now: number }): FeatureEvent[] {
  const latest = new Map<string, FeatureEvent>();
  for (const e of events) {
    const had = latest.get(e.feature);
    if (!had || time(e.at) > time(had.at)) latest.set(e.feature, e);
  }
  const joined = time(o.joinedAt);
  return [...latest.values()]
    .filter((e) => e.enabled && o.on.includes(e.feature) && e.by_user !== o.me)
    .filter((e) => o.now - time(e.at) < NEWS_DAYS * DAY_MS && !(time(e.at) < joined))
    .sort((a, b) => time(b.at) - time(a.at));
}

const seenAt = (seen: FeatureNewsSeen, barId: string, e: FeatureEvent, kind: 'line' | 'tab') => time(seen[barId]?.[e.feature]?.[kind]);

/** The line to show: the newest news not dismissed. The rest follow, one at a time. */
export function lineNews(pending: readonly FeatureEvent[], seen: FeatureNewsSeen, barId: string): FeatureEvent | null {
  return pending.find((e) => !(seenAt(seen, barId, e, 'line') >= time(e.at))) ?? null;
}

/** The tabs that get a dot: new ones not opened since they were switched on. */
export function dotTabs(pending: readonly FeatureEvent[], seen: FeatureNewsSeen, barId: string): { tab: VenueTab; event: FeatureEvent }[] {
  return pending.flatMap((e) => {
    const tab = featureTab(e.feature);
    return tab && !(seenAt(seen, barId, e, 'tab') >= time(e.at)) ? [{ tab, event: e }] : [];
  });
}

/** What's in the account's metadata, keeping only well-formed marks. */
export function parseSeen(meta: unknown): FeatureNewsSeen {
  const raw = (meta as { feature_news?: unknown } | null | undefined)?.feature_news;
  const out: FeatureNewsSeen = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [bar, features] of Object.entries(raw)) {
    if (!features || typeof features !== 'object') continue;
    for (const [feature, marks] of Object.entries(features as Record<string, unknown>)) {
      const m = marks as { line?: unknown; tab?: unknown } | null;
      const line = typeof m?.line === 'string' ? m.line : undefined;
      const tab = typeof m?.tab === 'string' ? m.tab : undefined;
      if (line || tab) (out[bar] ??= {})[feature] = { ...(line ? { line } : {}), ...(tab ? { tab } : {}) };
    }
  }
  return out;
}

/**
 * The marks with one more seen, ready to save. Marks older than NEWS_DAYS are
 * dropped: news that old never shows, and the metadata rides in every token.
 */
export function withSeen(seen: FeatureNewsSeen, barId: string, e: FeatureEvent, kind: 'line' | 'tab', now: number): FeatureNewsSeen {
  const next: FeatureNewsSeen = {};
  const fresh = (iso?: string) => (iso && now - time(iso) < NEWS_DAYS * DAY_MS ? iso : undefined);
  const all = { ...seen, [barId]: { ...seen[barId], [e.feature]: { ...seen[barId]?.[e.feature], [kind]: e.at } } };
  for (const [bar, features] of Object.entries(all)) {
    for (const [feature, marks] of Object.entries(features)) {
      const line = fresh(marks.line);
      const tab = fresh(marks.tab);
      if (line || tab) (next[bar] ??= {})[feature] = { ...(line ? { line } : {}), ...(tab ? { tab } : {}) };
    }
  }
  return next;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today", "yesterday" or "3 Oct", on this device's calendar. */
export function dayWord(iso: string, now: number): string {
  const d = new Date(iso);
  const startOf = (t: Date) => new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const days = Math.round((startOf(new Date(now)) - startOf(d)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** A person's first name from their team name ("Sam Rye" is Sam). */
export function firstName(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

/** The line's second row: "Sam turned it on today. Look for this tab." */
export function newsDetail(e: FeatureEvent, who: string | null, now: number, hasTab: boolean): string {
  const when = dayWord(e.at, now);
  const said = who ? `${who} turned it on ${when}.` : `Turned on ${when}.`;
  return hasTab ? `${said} Look for this tab.` : said;
}
