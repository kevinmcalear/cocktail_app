import { screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';

import { ReviewStep } from './ReviewStep';

jest.mock('./ReviewPhotos', () => ({ ReviewPhotos: () => null, HomePhoto: () => null }));
jest.mock('@/hooks/usePublishing', () => ({ useBarPublishing: () => ({ data: null }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: [] }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: { id: 'p-jo', displayName: 'Jo Park' } }) }));

const review = (coCreators: { id: string; name: string }[]) => (
  <ReviewStep draft={{ ...EMPTY_DRAFT, name: 'Ash Garden', coCreators }} set={() => {}} onJump={() => {}} barId={null} venueName="the venue" hasProfile barVariants={[]} />
);

test('Credits says who is asked first, so Save drink is no surprise (board w3-credits-to-check)', async () => {
  await renderWithTamagui(review([{ id: 'p-sam', name: 'Sam Ortiz' }]));
  expect(screen.getByText('By you with Sam Ortiz')).toBeTruthy();
  expect(screen.getByText('We’ll ask Sam first.')).toBeTruthy();
});

test('nobody else named, nothing to ask', async () => {
  await renderWithTamagui(review([]));
  expect(screen.queryByText(/^We’ll ask/)).toBeNull();
});
