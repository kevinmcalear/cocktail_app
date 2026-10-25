// How a bar, or a person, proves a page is theirs before claiming it. The
// database has the final say (start_bar_claim in
// 20261007220000_bar_claim_verification, start_person_claim in
// 20261030100000_person_claim_merge);
// these mirror its rules so the claim screen can say up front which ways
// will work, and hold the words for each.

export type ClaimMethod = 'note' | 'email' | 'instagram' | 'phone';
export type BarClaimMethod = Exclude<ClaimMethod, 'note'>;
/** In the order they're offered: a message from the bar's Instagram first (b19), then a work email, then a call. */
export const BAR_CLAIM_METHODS: BarClaimMethod[] = ['instagram', 'email', 'phone'];
/** A person proves it with a message from the page's Instagram, or a note ("Something else"). */
export type PersonClaimMethod = Extract<ClaimMethod, 'instagram' | 'note'>;

/** The ways a person can claim this page, in the order offered: Instagram only when the page has one. */
export const personClaimMethods = (page: Parameters<typeof pageInstagram>[0]): PersonClaimMethod[] =>
  pageInstagram(page) ? ['instagram', 'note'] : ['note'];

/** What a claim recorded about the page and the claimant when it was made. */
export interface ClaimEvidence {
  website?: string | null;
  instagram?: string | null;
  is_closed?: boolean;
  email_domain?: string | null;
  site_host?: string | null;
  matches?: boolean;
  auto?: boolean;
  review_reason?: ReviewReason | null;
  /** An Instagram claim checked by a message from the bar's account, not its bio (20261014900000). */
  instagram_dm?: boolean;
  /** What the claimant typed because the page had none (20261031200000). A person checks it. */
  typed?: TypedDetails;
}

export type ReviewReason = 'shared_site' | 'page_on_larger_site' | 'closed_bar' | 'site_typed';

/** The bar's Instagram, website or phone, typed into a claim when its page has none. */
export interface TypedDetails {
  instagram?: string;
  website?: string;
  phone?: string;
}

const TYPED_HANDLE = /^[a-z0-9._]{1,30}$/;

/** '@Harbour', ' harbour ' or 'instagram.com/harbour' -> 'harbour'; null when it isn't a handle. Same as start_bar_claim. */
export function typedHandle(typed: string | null | undefined): string | null {
  const t = typed?.trim() ?? '';
  const handle = (t.match(INSTAGRAM)?.[1] ?? t.replace(/^@+/, '')).toLowerCase();
  return TYPED_HANDLE.test(handle) ? handle : null;
}

/** 'harbourroom.com' -> 'https://harbourroom.com'; null when it isn't a website. Same as start_bar_claim. */
export function typedWebsite(typed: string | null | undefined): string | null {
  const t = typed?.trim() ?? '';
  if (t.length > 300 || !/^(https?:\/\/)?[^\s/]+\.[^\s]+$/i.test(t)) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** A phone number the way profiles_phone_shape takes it, or null. */
export function typedPhone(typed: string | null | undefined): string | null {
  const t = typed?.trim() ?? '';
  return /^\+?[0-9 ().-]{5,29}$/.test(t) && t.replace(/\D/g, '').length >= 6 ? t : null;
}

/** Hosts where anyone can have a page. Same list as private.is_shared_host. */
export const SHARED_HOSTS = [
  'instagram.com', 'facebook.com', 'tiktok.com', 'x.com', 'twitter.com', 'threads.net', 'youtube.com',
  'linktr.ee', 'linkin.bio', 'lnk.bio', 'bento.me', 'beacons.ai', 'taplink.cc', 'carrd.co',
  'google.com', 'business.site', 'wixsite.com', 'wix.com', 'squarespace.com', 'square.site', 'godaddysites.com',
  'weebly.com', 'wordpress.com', 'blogspot.com', 'webflow.io', 'notion.site', 'jimdosite.com', 'strikingly.com',
  'resy.com', 'opentable.com', 'sevenrooms.com', 'exploretock.com', 'toasttab.com', 'yelp.com', 'tripadvisor.com',
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com',
  'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'gmx.de', 'web.de', 'qq.com', '163.com', 'naver.com',
];

const HOST = /^(?:[a-z][a-z0-9+.-]*:\/\/)?([^/:?#@\s]+)/i;
const PATH = /^(?:[a-z][a-z0-9+.-]*:\/\/)?[^/?#]+(\/[^?#]*)?/i;

/** 'https://www.palemoth.com/en' -> 'palemoth.com'. */
export function siteHost(url: string | null | undefined): string | null {
  const host = url?.trim().match(HOST)?.[1]?.toLowerCase().replace(/^www\./, '');
  return host || null;
}

/** A site's home page, not a page on it. */
export const siteIsRoot = (url: string) => /^\/?$/.test(url.trim().match(PATH)?.[1] ?? '/');

export const isSharedHost = (host: string) => SHARED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

const INSTAGRAM = /instagram\.com\/([a-z0-9._]+)/i;

/** The page's Instagram handle: the column, else an instagram.com website or social link. */
export function pageInstagram(p: { instagram: string | null; website: string | null; social_links?: string[] | null }): string | null {
  const handle = p.instagram?.trim() || p.website?.match(INSTAGRAM)?.[1] || p.social_links?.map((u) => u.match(INSTAGRAM)?.[1]).find(Boolean);
  return handle ? handle.toLowerCase() : null;
}

export type EmailCheck =
  | { ok: 'instant'; domain: string }
  | { ok: 'review'; domain: string; reason: ReviewReason }
  | { ok: false; why: 'no-site' | 'shared-site' | 'other-domain'; host: string | null; domain: string | null };

/**
 * Whether the claimant's confirmed sign-in email proves they work at the bar:
 * its domain has to be the page's website's. A strong match (the bar's own
 * site, its home page, still open) is approved on the spot.
 */
export function emailCheck(email: string | null | undefined, website: string | null, isClosed: boolean): EmailCheck {
  const domain = email?.split('@')[1]?.trim().toLowerCase() || null;
  const host = siteHost(website);
  if (!host) return { ok: false, why: 'no-site', host, domain };
  if (domain !== host) return { ok: false, why: isSharedHost(host) ? 'shared-site' : 'other-domain', host, domain };
  if (isSharedHost(host)) return { ok: 'review', domain, reason: 'shared_site' };
  if (!siteIsRoot(website!)) return { ok: 'review', domain, reason: 'page_on_larger_site' };
  if (isClosed) return { ok: 'review', domain, reason: 'closed_bar' };
  return { ok: 'instant', domain };
}

/** Why an email match still waits for a moderator, from either side of the screen. */
export const REVIEW_REASON: Record<ReviewReason, string> = {
  shared_site: 'the page’s website is on a shared host, so an address there doesn’t prove much',
  page_on_larger_site: 'the page’s website is a page on a bigger site, like a hotel group’s',
  closed_bar: 'the bar is marked closed, and an old domain can change hands',
  site_typed: 'the website was typed in with the claim, not already on the page',
};

/** The method picker's short words (a moderator's tag). */
export const METHOD_COPY: Record<BarClaimMethod, { short: string }> = {
  email: { short: 'Email' },
  instagram: { short: 'Instagram' },
  phone: { short: 'Phone' },
};

/** The method picker's words for a page of this kind: the bar's, or the company's for a maker or supplier. */
export function methodLabel(method: BarClaimMethod, kind: string | null | undefined): string {
  const place = claimPlace(kind);
  if (method === 'email') return 'Work email';
  return method === 'instagram' ? `Send us a message from the ${place}’s Instagram` : `A call to the ${place}`;
}

/**
 * Our own Instagram account, where bars message their claim code (b19).
 * ponytail: not named yet; until it is, the copy says "us" and Open
 * Instagram opens the inbox. Set it here (and check those messages) before launch.
 */
export const OUR_INSTAGRAM: string | null = null;

/** Why the email route won't work, in words. */
export function emailUnavailable(check: Extract<EmailCheck, { ok: false }>): string {
  if (check.why === 'no-site') return 'This page has no website to match an email against.';
  if (check.why === 'shared-site') return `Its website is on ${check.host}, not a domain of its own.`;
  return check.domain
    ? `You signed in with an address at ${check.domain}, not ${check.host}. Sign in with your ${check.host} address to use this.`
    : `Sign in with your ${check.host} address to use this.`;
}

/** '482913' -> '482 913', easier to read out. */
/**
 * Six digits for an Instagram message or a call, made before sending so the
 * claim screen can show it first. start_bar_claim stores it (p_code); the
 * code only has to tie the message to this claim, not stay secret from its
 * sender. ponytail: crypto where the platform has it, Math.random on Hermes.
 */
export function newClaimCode(random: () => number = defaultRandom): string {
  return String(Math.floor(random() * 1_000_000)).padStart(6, '0');
}

function defaultRandom(): number {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
  return Math.random();
}

export const spacedCode = (code: string) => code.replace(/^(\d{3})(\d{3})$/, '$1 $2');

/** What a claim calls the place behind the page: a bar, or a maker's or supplier's company. */
export const claimPlace = (kind: string | null | undefined) => (kind === 'maker' || kind === 'supplier' ? 'company' : 'bar');

/** Errors from starting or reviewing a claim, in words. The database's own messages (P0001) are written for people. */
export function claimProblem(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23505') return e.message?.startsWith('You already have a claim') ? e.message : 'You already have a claim waiting on this bar.';
  if ((e?.code === 'P0001' || e?.code === '42501' || e?.code === '22023' || e instanceof Error) && e?.message) return e.message;
  return "Couldn't send that. Check your connection and try again.";
}
