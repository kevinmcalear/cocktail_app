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
