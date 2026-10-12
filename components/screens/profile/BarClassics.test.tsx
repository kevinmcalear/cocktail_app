import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { BarClassics } from './BarClassics';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useStaffList', () => ({
  usePublicClassics: () => ({
    data: [
      { rank: 1, name: 'Martini', classicName: null, openId: null },
      { rank: 12, name: 'House Daiquiri', classicName: 'Daiquiri', openId: null },
      { rank: null, name: 'Negroni', classicName: null, openId: null },
    ],
    isLoading: false,
    error: null,
  }),
}));

test('a bar page starts at the top 10, then shows the rest of the top 50 and the other classics', async () => {
  await renderWithTamagui(<BarClassics barId="bar" />);
  expect(screen.getByText('Classics they pour · Top 10')).toBeTruthy();
  expect(screen.queryByText('House Daiquiri')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'All 3 classics' }));
  expect(screen.getByText('Top 10')).toBeTruthy();
  expect(screen.getByText('The rest of the top 50')).toBeTruthy();
  expect(screen.getByText('We also make')).toBeTruthy();
  expect(screen.getByText('House Daiquiri')).toBeTruthy();
  expect(screen.getByText('Daiquiri')).toBeTruthy();
});

test('no bar means no list', async () => {
  await renderWithTamagui(<BarClassics barId={null} />);
  expect(screen.queryByText(/Top 10/)).toBeNull();
});
