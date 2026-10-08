/**
 * Each awards body's logo, keyed by profile_awards.award. Dark artwork on a
 * transparent square, shown on a paper tile so it reads in both themes.
 * ponytail: bundled, so a new awards body needs its logo added here (rows
 * without one show the body's initials). If bodies start arriving from an admin
 * screen, move these to storage with an awards table that holds the URL.
 * James Beard is left out on purpose: its seal is for honorees' own use.
 * Bodies without an official logo we could use (Bangkok Bar Show, What's On,
 * and others) show initials too. Tatler Dining rebranded as Tatler Best.
 */
const the50 = require('@/assets/images/awards/the-50.png') as number;
const tatlerBest = require('@/assets/images/awards/tatler-best.png') as number;
const timeOut = require('@/assets/images/awards/time-out.png') as number;

export const AWARD_LOGOS: Record<string, number> = {
  "The World's 50 Best Bars": the50,
  "Asia's 50 Best Bars": the50,
  "North America's 50 Best Bars": the50,
  "Europe's 50 Best Bars": the50,
  'Australian Bar Awards': require('@/assets/images/awards/australian-bar-awards.png') as number,
  'Tales of the Cocktail Spirited Awards': require('@/assets/images/awards/spirited-awards.png') as number,
  'CLASS Bar Awards': require('@/assets/images/awards/class-bar-awards.png') as number,
  'Top 50 Cocktail Bars': require('@/assets/images/awards/top-50-cocktail-bars.png') as number,
  'Time Out Sydney Food & Drink Awards': timeOut,
  'Time Out Melbourne Food & Drink Awards': timeOut,
  'Time Out Hong Kong Bar Awards': timeOut,
  'Time Out Paris Food & Drink Awards': timeOut,
  'Shaker Awards': require('@/assets/images/awards/shaker-awards.png') as number,
  'BAD Awards': require('@/assets/images/awards/bad-awards.png') as number,
  'Tatler Best': tatlerBest,
  'Tatler Dining Bar Awards': tatlerBest,
  'Good Food Guide': require('@/assets/images/awards/good-food-guide.png') as number,
  '30 Best Bars India': require('@/assets/images/awards/30-best-bars-india.png') as number,
  'Top Cocktail Bars': require('@/assets/images/awards/top-cocktail-bars.png') as number,
  "Bartenders' Choice Awards": require('@/assets/images/awards/bartenders-choice-awards.png') as number,
  Barawards: require('@/assets/images/awards/barawards.png') as number,
  'Premios Summum': require('@/assets/images/awards/premios-summum.png') as number,
  'DRiNK Awards': require('@/assets/images/awards/drink-awards.png') as number,
  'Food & Wine Global Tastemakers': require('@/assets/images/awards/food-and-wine.png') as number,
};
