import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { Positions } from './Positions';

const bar = (name: string) => ({ id: name, handle: name.toLowerCase(), display_name: name, avatar_url: null });
const jo = { id: 'jo', handle: 'jo', display_name: 'Jo Juniper', avatar_url: null };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useProfiles', () => ({
  useProfilePositions: () => ({
    data: [
      { id: '1', title: 'Head bartender', is_current: true, person: jo, bar: bar('Attaboy') },
      { id: '2', title: 'Bar manager', is_current: false, person: jo, bar: bar('Milk & Honey') },
    ],
  }),
}));

test('a person shows where they work now, not where they used to', async () => {
  await renderWithTamagui(<Positions profile={{ id: 'jo', kind: 'person' }} />);
  expect(screen.getByText('Attaboy')).toBeTruthy();
  expect(screen.queryByText('Milk & Honey')).toBeNull();
  expect(screen.queryByText(/Formerly/)).toBeNull();
});
