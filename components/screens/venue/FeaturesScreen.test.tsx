import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { FeaturesScreen } from './FeaturesScreen';

// The switches are tested in components/bar/VenueFeatures.test.tsx; here, only who gets them.
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));
jest.mock('@/components/bar/VenueFeatures', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { VenueFeatures: () => <Text>the switches</Text> };
});
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [{ id: 'rye', name: 'Little Rye' }] }) }));
let mockRole = 40;
jest.mock('@/hooks/useViewAs', () => ({ useEffectiveRole: () => mockRole }));

test('an Admin gets the switches', async () => {
  mockRole = 40;
  await renderWithTamagui(<FeaturesScreen barId="rye" />);
  expect(screen.getByText('the switches')).toBeTruthy();
});

test('anyone else is told only Admins switch them', async () => {
  mockRole = 30;
  await renderWithTamagui(<FeaturesScreen barId="rye" />);
  expect(screen.queryByText('the switches')).toBeNull();
  expect(screen.getByText('Only Admins can switch features on and off.')).toBeTruthy();
});
