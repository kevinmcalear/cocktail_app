import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { BuyLink } from '@/lib/techniques';

import { BuyList } from './bits';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const links: BuyLink[] = [
  { name: 'Small tub', url: 'https://example.com/small', audience: 'home' },
  { name: 'Big sack', url: 'https://example.com/big', audience: 'bar' },
  { name: 'Either', url: 'https://example.com/either' },
];

test('the mode picks home or bar links as plain rows; links for both always show', async () => {
  await renderWithTamagui(<BuyList links={links} />);
  // The app's mode isn't known yet, so it shows the bar picks.
  expect(screen.getByText('Big sack')).toBeTruthy();
  expect(screen.queryByText('Small tub')).toBeNull();
  expect(screen.getByText('Either')).toBeTruthy();
  expect(screen.queryByLabelText('For home')).toBeNull();
});

test('every link shows when they all suit both', async () => {
  await renderWithTamagui(<BuyList links={[links[2]]} />);
  expect(screen.getByText('Either')).toBeTruthy();
});
