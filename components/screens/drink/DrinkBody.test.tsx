import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';

import { DrinkBody } from './DrinkBody';
import type { DrinkSections } from './DrinkSections';

// Each section as its own name, so the test reads the order the page draws.
const KEYS = [
  'header', 'spec', 'intro', 'journey', 'floor', 'moreHeading', 'standing', 'banner', 'description', 'facts', 'allergens',
  'flavor', 'servedAt', 'menus', 'photos', 'service', 'history', 'cost', 'backstory', 'classicLink', 'publish',
] as const;
const sections = Object.fromEntries(KEYS.map((k) => [k, <Text key={k}>{k}</Text>])) as unknown as DrinkSections;

const order = () => screen.getAllByText(/./).map((t) => t.props.children as string);

test('the first screen is the make-it part: name, spec, then the rest under More', async () => {
  await renderWithTamagui(<DrinkBody sections={sections} home={false} />);
  const shown = order();
  expect(shown.slice(0, 6)).toEqual(['header', 'spec', 'intro', 'journey', 'floor', 'moreHeading']);
  // Strength, allergens and flavor are no longer above the spec.
  for (const later of ['standing', 'banner', 'facts', 'allergens', 'flavor', 'menus', 'backstory', 'publish']) {
    expect(shown.indexOf(later)).toBeGreaterThan(shown.indexOf('moreHeading'));
  }
  // At a venue, the photos come before the staff rows.
  expect(shown.indexOf('photos')).toBeLessThan(shown.indexOf('service'));
});

test('at home the photos come last, after the backstory', async () => {
  await renderWithTamagui(<DrinkBody sections={sections} home />);
  const shown = order();
  expect(shown.indexOf('spec')).toBeLessThan(shown.indexOf('moreHeading'));
  expect(shown.indexOf('photos')).toBeGreaterThan(shown.indexOf('backstory'));
});
