/** A list place or a titled award on a profile (public.profile_awards). */
export interface Award {
  id: string;
  award: string;
  year: number;
  position: number | null;
  title: string | null;
  source_url: string | null;
}

/** "No. 6" over "The World's 50 Best Bars 2025", or the title over the awards body and year. */
export function awardLines(a: Pick<Award, 'award' | 'year' | 'position' | 'title'>): { headline: string; detail: string } {
  return {
    headline: a.title ?? `No. ${a.position}`,
    detail: `${a.award} ${a.year}`,
  };
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
