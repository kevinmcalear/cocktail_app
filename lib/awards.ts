/** A list place or a titled award on a profile (public.profile_awards). */
export interface Award {
  id: string;
  award: string;
  year: number;
  position: number | null;
  title: string | null;
  source_url: string | null;
  /** 'pending' while a moderator checks one a person sent ("Not confirmed yet"); others only ever read confirmed ones. */
  status?: 'confirmed' | 'pending' | 'declined';
  /** "Finalist" rather than a win. */
  is_finalist?: boolean;
  /** The person's show/hide pick, or null to follow their awards mode. */
  on_profile?: boolean | null;
  /** Who sent it; null for one we researched. */
  added_by?: string | null;
  /** The bar they were at: "at Little Rye". */
  bar?: { id: string; handle: string; display_name: string } | null;
}

/**
 * "No. 6" over "The World's 50 Best Bars 2025", or the title over the awards
 * body and year. A place on one of a body's several lists keeps the place up
 * top and names the list after the year: "No. 3" over "Food & Wine Global
 * Tastemakers 2025 · Top U.S. Bars".
 */
export function awardLines(a: Pick<Award, 'award' | 'year' | 'position' | 'title'>): { headline: string; detail: string } {
  const body = `${a.award} ${a.year}`;
  if (a.position !== null && a.title !== null) return { headline: `No. ${a.position}`, detail: `${body} · ${a.title}` };
  return { headline: a.title ?? `No. ${a.position}`, detail: body };
}

/** "James Beard Awards" to "JBA", for an awards body without a logo: capitalised words, "The" left out, three at most. */
export function awardInitials(award: string): string {
  return award
    .split(/\s+/)
    .filter((w) => /^[A-Z0-9]/.test(w) && w !== 'The')
    .map((w) => w[0])
    .join('')
    .slice(0, 3);
}

// The lists that carry the most weight first; anything else after them.
const PRESTIGE = [
  "The World's 50 Best Bars",
  'Tales of the Cocktail Spirited Awards',
  "Asia's 50 Best Bars",
  "North America's 50 Best Bars",
  "Europe's 50 Best Bars",
  'Australian Bar Awards',
];
const prestige = (award: string) => {
  const i = PRESTIGE.indexOf(award);
  return i === -1 ? PRESTIGE.length : i;
};

/** Newest year first; within a year, the weightier list first, then its titles, then the higher place. */
export function sortAwards<T extends Pick<Award, 'year' | 'position' | 'title' | 'award'>>(awards: T[]): T[] {
  return [...awards].sort(
    (a, b) =>
      b.year - a.year ||
      prestige(a.award) - prestige(b.award) ||
      a.award.localeCompare(b.award) ||
      Number(a.title === null) - Number(b.title === null) ||
      (a.position ?? 0) - (b.position ?? 0),
  );
}

export interface AwardGroup {
  award: string;
  /** Newest first. */
  places: Award[];
  titles: Award[];
  /** The best place ever reached on this list, if it's a ranked list. */
  best: number | null;
}

/**
 * One group per list or awards body, so twenty years on The World's 50 Best
 * read as one row: the weightier lists first, then the longer runs.
 */
export function groupAwards(awards: Award[]): AwardGroup[] {
  const groups = new Map<string, AwardGroup>();
  for (const a of sortAwards(awards)) {
    const g = groups.get(a.award) ?? { award: a.award, places: [], titles: [], best: null };
    if (a.position !== null) {
      g.places.push(a);
      g.best = Math.min(g.best ?? a.position, a.position);
    }
    if (a.title !== null) g.titles.push(a);
    groups.set(a.award, g);
  }
  const size = (g: AwardGroup) => g.places.length + g.titles.length;
  return [...groups.values()].sort((a, b) => prestige(a.award) - prestige(b.award) || size(b) - size(a) || a.award.localeCompare(b.award));
}

/**
 * What's wrong with an award someone is adding (AddAwardSheet), or null.
 * Matches profile_awards: a name and title up to 80 characters, a year from
 * 1990, and an https link to where it was published.
 */
export function awardDraftProblem(d: { award: string; title: string; year: string; source: string }, thisYear = new Date().getFullYear()): string | null {
  if (!d.award.trim()) return 'Say who gave it.';
  if (!d.title.trim()) return 'Add the title, as the award writes it.';
  const year = Number(d.year);
  if (!Number.isInteger(year) || year < 1990 || year > thisYear + 1) return `Use a year from 1990 to ${thisYear + 1}.`;
  const source = d.source.trim();
  if (!/^https:\/\/[^\s/]+\.[^\s]+$/.test(source)) return 'Add the link to where it was announced, starting https://';
  return null;
}
