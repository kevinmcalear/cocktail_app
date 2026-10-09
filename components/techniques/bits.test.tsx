import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { BuyLink } from '@/lib/techniques';

import { BuyList } from './bits';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

const links: BuyLink[] = [
  { name: 'Small tub', url: 'https://example.com/small', audience: 'home' },
  { name: 'Big sack', url: 'https://example.com/big', audience: 'bar' },
  { name: 'Either', url: 'https://example.com/either' },
];

test('home and bar picks sit behind tabs; links for both show on each', async () => {
  await renderWithTamagui(<BuyList links={links} />);
  // The app's mode isn't known yet, so it starts on the bar picks.
  expect(screen.getByText('Big sack')).toBeTruthy();
  expect(screen.queryByText('Small tub')).toBeNull();
  expect(screen.getByText('Either')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('For home'));
  expect(screen.getByText('Small tub')).toBeTruthy();
  expect(screen.queryByText('Big sack')).toBeNull();
  expect(screen.getByText('Either')).toBeTruthy();
});

test('no tabs when every link suits both', async () => {
  await renderWithTamagui(<BuyList links={[links[2]]} />);
  expect(screen.queryByLabelText('For home')).toBeNull();
  expect(screen.getByText('Either')).toBeTruthy();
});
