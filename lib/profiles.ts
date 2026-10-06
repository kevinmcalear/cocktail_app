/**
 * Pure helpers for public profiles (people and bars). Queries are in
 * hooks/useProfiles.ts; checked by lib/profiles.check.ts.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Same rule as the profiles.handle CHECK in the migration.
const HANDLE = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

/**
 * A /p/<ref> link names a profile by id or by handle ("@juniper.jo" or
 * "juniper.jo"). Anything else is null, so it never reaches a query.
 */
export function parseProfileRef(ref: string | string[] | null | undefined): { id: string } | { handle: string } | null {
  const raw = (Array.isArray(ref) ? ref[0] : ref)?.trim();
  if (!raw) return null;
  if (UUID.test(raw)) return { id: raw.toLowerCase() };
  const handle = raw.replace(/^@/, '').toLowerCase();
  return HANDLE.test(handle) ? { handle } : null;
}

export interface MenuDrinkRow {
  item_id: string;
  menu: { id: string; name: string; is_active: boolean | null; bar_id: string | null; bar: { name: string } | null } | null;
}

export interface MenuCredit {
  menuId: string;
  menuName: string;
  barId: string | null;
  barName: string | null;
  /** On the bar's current menu, not a past one. */
  current: boolean;
  itemIds: string[];
}

/**
 * Menus that carry any of a profile's drinks, one entry per menu with its
 * drinks. Current menus first, then by bar and menu name.
 */
export function groupMenuCredits(rows: MenuDrinkRow[]): MenuCredit[] {
  const byMenu = new Map<string, MenuCredit>();
  for (const row of rows) {
    const menu = row.menu;
    if (!menu) continue;
    let credit = byMenu.get(menu.id);
    if (!credit) {
      credit = { menuId: menu.id, menuName: menu.name, barId: menu.bar_id, barName: menu.bar?.name ?? null, current: !!menu.is_active, itemIds: [] };
      byMenu.set(menu.id, credit);
    }
    if (!credit.itemIds.includes(row.item_id)) credit.itemIds.push(row.item_id);
  }
  return [...byMenu.values()].sort(
    (a, b) =>
      Number(b.current) - Number(a.current) ||
      (a.barName ?? '').localeCompare(b.barName ?? '') ||
      a.menuName.localeCompare(b.menuName)
  );
}

/** "Credited on 2 bar menus": the number of bars with a current menu carrying their drinks. */
export function barsCrediting(credits: MenuCredit[]): number {
  return new Set(credits.filter((c) => c.current && c.barId).map((c) => c.barId)).size;
}

/** What a person types for their own profile. */
export interface ProfileDraft {
  name: string;
  handle: string;
  bio: string;
  /** What they typed: @name, a bare name, or an instagram.com link. */
  instagram: string;
  isPublic: boolean;
  /** Show the drinks you've had, with your scores, on the public profile. */
  sharesRankings: boolean;
}

const INSTAGRAM = /^[a-z0-9._]+$/;
const INSTAGRAM_DOTS = /^\.|\.$|\.\./;

/**
 * "@Foo.Bar ", "https://www.instagram.com/Foo.Bar/?hl=en" → "foo.bar".
 * Empty when they left it blank. Same shape as profiles.instagram.
 */
export function normalizeInstagram(raw: string): string {
  const s = raw.trim().toLowerCase();
  const fromUrl = s.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-z0-9._]+)/);
  if (fromUrl?.[1]) return fromUrl[1].replace(/\.+$/, '');
  return s.replace(/^@/, '').split(/[/?#]/)[0] ?? '';
}

/** What's wrong with an Instagram name, or nothing when it's blank or fine. Matches profiles_instagram_format. */
export function instagramProblem(raw: string): string | undefined {
  const handle = normalizeInstagram(raw);
  if (!handle) return undefined;
  if (handle.length > 30 || !INSTAGRAM.test(handle) || INSTAGRAM_DOTS.test(handle)) {
    return 'Use up to 30 letters, numbers, dots or underscores. Dots can’t sit at the start, the end, or next to each other.';
  }
}

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`;

export type LinkNetwork = 'instagram' | 'tiktok' | 'facebook' | 'x' | 'youtube' | 'threads' | 'website';

/** The other networks a profile can link, in the order they show. Matches profiles_social_links_format. */
const SOCIAL: [LinkNetwork, RegExp][] = [
  ['tiktok', /^https:\/\/www\.tiktok\.com\/@[A-Za-z0-9._]+$/],
  ['facebook', /^https:\/\/www\.facebook\.com\/(p\/)?[A-Za-z0-9.-]+\/$/],
  ['x', /^https:\/\/x\.com\/[A-Za-z0-9_]+$/],
  ['youtube', /^https:\/\/www\.youtube\.com\/(@|channel\/)[A-Za-z0-9._-]+$/],
  ['threads', /^https:\/\/www\.threads\.com\/@[A-Za-z0-9._]+$/],
];

/**
 * Links under the name: Instagram, the other networks, then a real website.
 * An instagram.com website isn't shown twice, and a link to a network we don't know is dropped.
 */
export function profileLinks(p: { instagram: string | null; website: string | null; social_links?: string[] | null }): { href: string; network: LinkNetwork }[] {
  const links: { href: string; network: LinkNetwork }[] = [];
  if (p.instagram) links.push({ href: instagramUrl(p.instagram), network: 'instagram' });
  for (const [network, rule] of SOCIAL) {
    const href = p.social_links?.find((url) => rule.test(url));
    if (href) links.push({ href, network });
  }
  const site = p.website?.trim() ?? '';
  if (/^https?:\/\//i.test(site) && !(p.instagram && /instagram\.com\//i.test(site))) {
    links.push({ href: site, network: /instagram\.com\//i.test(site) ? 'instagram' : 'website' });
  }
  return links;
}

/** "@Juniper.Jo " → "juniper.jo": what gets saved, and what the HANDLE rule checks. */
export const normalizeHandle = (raw: string): string => raw.trim().replace(/^@/, '').toLowerCase();

/** A starting handle from a name: "Jo Juniper" → "jo.juniper". Empty when nothing usable is left. */
export function handleFromName(name: string): string {
  const handle = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .slice(0, 30)
    .replace(/^[._]+|[._]+$/g, '');
  return HANDLE.test(handle) ? handle : '';
}

/**
 * What's wrong with a draft, field by field, in the same limits as the
 * profiles table's CHECKs. An empty object means it can be saved.
 */
export function profileDraftErrors(d: ProfileDraft): { name?: string; handle?: string; bio?: string; instagram?: string } {
  const errors: { name?: string; handle?: string; bio?: string; instagram?: string } = {};
  const name = d.name.trim();
  if (!name) errors.name = 'Add the name people will see.';
  else if (name.length > 80) errors.name = 'Keep your name to 80 characters.';
  if (!HANDLE.test(normalizeHandle(d.handle))) {
    errors.handle = 'Use 3 to 30 letters, numbers, dots or underscores, starting and ending with a letter or number.';
  }
  if (d.bio.trim().length > 500) errors.bio = 'Keep your bio to 500 characters.';
  const instagram = instagramProblem(d.instagram);
  if (instagram) errors.instagram = instagram;
  return errors;
}
