import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { FindStep } from './FindStep';

const mockPush = jest.fn();
const ash = { id: 'ash', handle: 'ash.okafor', display_name: 'Ash Okafor', city: 'Melbourne', is_claimed: false, current_bar: 'Pale Moth', job: null, worked: 'Pale Moth · Little Rye' };
const paleMoth = { id: 'pm', handle: 'palemoth', display_name: 'Pale Moth', bar_type: 'Cocktail bar', is_claimed: false, locality: 'Collingwood', postcode: null, city: 'Melbourne', country_code: 'AU' };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/components/screens/home/BarMark', () => ({ BarMark: () => null }));
jest.mock('@/hooks/useRankings', () => ({ usePublicBars: (term: string) => ({ data: term.trim().length >= 2 ? [paleMoth] : [] }) }));
jest.mock('@/hooks/useProfiles', () => ({
  usePublicPeople: (term: string) => ({ data: term.trim().length >= 2 ? [ash] : [] }),
  useWaiting: () => ({ data: { pm: { drinks: 12, people: 4, claimed: false }, ash: { drinks: 5, people: 0, claimed: false } } }),
  useMyPersonClaim: () => ({ data: null }),
}));

test('one field finds bars and people, each saying what is waiting, and each opens its page', async () => {
  await renderWithTamagui(<FindStep name="pale" pending={false} onClaimed={jest.fn()} onNew={jest.fn()} onSkip={jest.fn()} />);
  expect(screen.getByLabelText('Search bars and people')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Pale Moth. Not claimed yet. Cocktail bar · Collingwood. 12 drinks · 4 people' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('link', { name: /^Pale Moth/ }));
  expect(mockPush).toHaveBeenCalledWith('/p/palemoth');
  // A person opens their page, where "This is me" claims it.
  await fireEvent.press(screen.getByRole('link', { name: 'Ash Okafor. Not claimed yet. Pale Moth · Little Rye. 5 drinks credited' }));
  expect(mockPush).toHaveBeenCalledWith('/p/ash.okafor');
});
