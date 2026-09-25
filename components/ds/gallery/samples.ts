import type { SpecRowProps } from '../SpecRow';

// Example content for the gallery. Classic specs; not anyone's real data.

export const PENICILLIN: SpecRowProps[] = [
  { amount: '60 ml', ingredient: 'Blended Scotch' },
  { amount: '22.5 ml', ingredient: 'Lemon juice' },
  { amount: '22.5 ml', ingredient: 'Honey-ginger syrup', houseMade: true },
  { amount: '7.5 ml', ingredient: 'Islay Scotch', note: 'Floated off a bar spoon' },
  { amount: '1', ingredient: 'Candied ginger', optional: true },
];

export const IMAGES = {
  photo: require('@/assets/images/cocktails/house_martini.jpg') as number,
  sketch: require('@/assets/images/beers/hazy_ipa.jpg') as number,
};
