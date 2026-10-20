import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { Profile } from '@/hooks/useProfiles';

import { PersonClaimSheet } from './PersonClaimSheet';

const mockClaim = jest.fn();
const mockDismissTo = jest.fn();
let mockMeta: { onboarded?: boolean } = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ dismissTo: mockDismissTo }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: mockMeta } }) }));
jest.mock('@/hooks/useProfiles', () => ({ useClaimProfile: () => ({ mutate: mockClaim, isPending: false, error: null }) }));

const ash = { id: 'ash', kind: 'person', handle: 'ash.okafor', display_name: 'Ash Okafor', instagram: 'ash.okafor', website: null, social_links: null } as unknown as Profile;

beforeEach(() => {
  mockClaim.mockReset().mockImplementation((_claim, opts) => opts?.onSuccess?.());
  mockDismissTo.mockReset();
  mockMeta = {};
});

test('one sheet: Instagram and the bar wait, Something else sends a note, and Setup gets it back', async () => {
  const onClose = jest.fn();
  mockMeta = { onboarded: false };
  await renderWithTamagui(<PersonClaimSheet profile={ash} bar="Pale Moth" stats={{ drinks: 5, menus: 2 }} visible onClose={onClose} />);
  expect(screen.getByText('Your 5 drinks, 2 menus and where you have worked move to your account. Nothing new goes public.')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /^A message from your Instagram/ })).toBeDisabled();
  expect(screen.getByRole('radio', { name: /^Pale Moth confirms you/ })).toBeDisabled();
  expect(screen.getByRole('radio', { name: /^Something else/ })).toBeChecked();

  await fireEvent.changeText(screen.getByLabelText('The link, or how we can check'), 'https://palemoth.example/team');
  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockClaim).toHaveBeenCalledWith({ profile_id: 'ash', message: 'https://palemoth.example/team', bar_id: null }, expect.anything());
  expect(onClose).toHaveBeenCalled();
  expect(mockDismissTo).toHaveBeenCalledWith('/onboarding');
});

test('past Setup, a sent claim stays on the page', async () => {
  await renderWithTamagui(<PersonClaimSheet profile={ash} bar={null} stats={{ drinks: 1, menus: 0 }} visible onClose={jest.fn()} />);
  expect(screen.getByText('Your 1 drink and where you have worked move to your account. Nothing new goes public.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockDismissTo).not.toHaveBeenCalled();
});
