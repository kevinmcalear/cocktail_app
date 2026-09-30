/**
 * Each awards body's logo, keyed by profile_awards.award. Dark artwork on a
 * transparent square, shown on a paper tile so it reads in both themes.
 * ponytail: bundled, so a new awards body needs its logo added here (rows
 * without one show the body's initials). If bodies start arriving from an admin
 * screen, move these to storage with an awards table that holds the URL.
 * James Beard is left out on purpose: its seal is for honorees' own use.
 */
const the50 = require('@/assets/images/awards/the-50.png') as number;

export const AWARD_LOGOS: Record<string, number> = {
  "The World's 50 Best Bars": the50,
  "Asia's 50 Best Bars": the50,
  "North America's 50 Best Bars": the50,
  "Europe's 50 Best Bars": the50,
  'Australian Bar Awards': require('@/assets/images/awards/australian-bar-awards.png') as number,
  'Tales of the Cocktail Spirited Awards': require('@/assets/images/awards/spirited-awards.png') as number,
  'CLASS Bar Awards': require('@/assets/images/awards/class-bar-awards.png') as number,
};
