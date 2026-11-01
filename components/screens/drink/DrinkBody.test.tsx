import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/jest.setup';

import { DrinkBody } from './DrinkBody';
import type { DrinkSections } from './DrinkSections';

// Each block as its own name, so the test reads the order the page draws.
const KEYS = ['title', 'lead', 'spec', 'action', 'notes', 'bar', 'menus', 'story'] as const;
const sections = Object.fromEntries(KEYS.map((k) => [k, <Text key={k}>{k}</Text>])) as unknown as DrinkSections;

const order = () => screen.getAllByText(/./).map((t) => t.props.children as string);

test("the board's fixed order: name, what a guest reads first, the spec, the one action, then the bar's rows and the story", async () => {
  await renderWithProviders(<DrinkBody sections={sections} />);
  expect(order()).toEqual([...KEYS]);
});

test('beside a desktop column the name stays in that column', async () => {
  await renderWithProviders(<DrinkBody sections={sections} title={false} />);
  expect(order()).not.toContain('title');
});
