import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { Profile } from '@/hooks/useProfiles';

import { PersonClaimSheet } from './PersonClaimSheet';

const mockClaim = jest.fn();
const mockDismissTo = jest.fn();
let mockMeta: { onboarded?: boolean } = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ dismissTo: mockDismissTo }) }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', user_metadata: mockMeta } }) }));
jest.mock('./useShareLink', () => ({ useShareLink: () => jest.fn() }));
jest.mock('@/hooks/useProfiles', () => ({ useClaimProfile: () => ({ mutateAsync: mockClaim, isPending: false, error: null }) }));

const ash = { id: 'ash', kind: 'person', handle: 'ash.okafor', display_name: 'Ash Okafor', instagram: 'ash.okafor', website: null, social_links: null } as unknown as Profile;

beforeEach(() => {
  mockClaim.mockReset().mockResolvedValue({});
  mockDismissTo.mockReset();
  mockMeta = {};
});

test('one sheet: the Instagram code comes first, the bar waits, and Setup gets it back', async () => {
  const onClose = jest.fn();
  mockMeta = { onboarded: false };
  await renderWithTamagui(<PersonClaimSheet profile={ash} bar="Pale Moth" stats={{ drinks: 5, menus: 2 }} visible onClose={onClose} />);
  expect(screen.getByText('Your 5 drinks, 2 menus and where you have worked move to your account. Nothing new goes public.')).toBeTruthy();
  expect(screen.getByRole('radio', { name: /^A message from your Instagram/ })).toBeChecked();
  expect(screen.getByRole('radio', { name: /^Pale Moth confirms you/ })).toBeDisabled();
  const code = screen.getByLabelText(/^Your code: /).props.accessibilityLabel.replace(/\D/g, '');
  expect(code).toMatch(/^\d{6}$/);

  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockClaim).toHaveBeenCalledWith({ profile_id: 'ash', message: '', method: 'instagram', code });
  await waitFor(() => expect(mockDismissTo).toHaveBeenCalledWith('/onboarding'));
  expect(onClose).toHaveBeenCalled();
});

test('Something else sends a note, and is the only way when the page has no Instagram', async () => {
  await renderWithTamagui(<PersonClaimSheet profile={ash} bar={null} stats={{ drinks: 1, menus: 0 }} visible onClose={jest.fn()} />);
  await fireEvent.press(screen.getByRole('radio', { name: /^Something else/ }));
  expect(screen.getByRole('button', { name: 'Send claim' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('The link, or how we can check'), 'https://palemoth.example/team');
  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockClaim).toHaveBeenCalledWith({ profile_id: 'ash', message: 'https://palemoth.example/team', method: 'note', code: null });

  const noGram = { ...ash, instagram: null } as unknown as Profile;
  await renderWithTamagui(<PersonClaimSheet profile={noGram} bar={null} stats={{ drinks: 1, menus: 0 }} visible onClose={jest.fn()} />);
  expect(screen.getAllByRole('radio', { name: /^A message from your Instagram/ }).at(-1)).toBeDisabled();
  expect(screen.getAllByRole('radio', { name: /^Something else/ }).at(-1)).toBeChecked();
});

test('past Setup, a sent claim stays on the page', async () => {
  await renderWithTamagui(<PersonClaimSheet profile={ash} bar={null} stats={{ drinks: 1, menus: 0 }} visible onClose={jest.fn()} />);
  expect(screen.getByText('Your 1 drink and where you have worked move to your account. Nothing new goes public.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockDismissTo).not.toHaveBeenCalled();
});

test('on a phone that isn’t theirs, the claim opens on their own phone from a QR code', async () => {
  await renderWithTamagui(<PersonClaimSheet profile={ash} bar={null} stats={{ drinks: 0, menus: 0 }} visible onClose={jest.fn()} />);
  expect(screen.getByText('Where you have worked moves to your account. Nothing new goes public.')).toBeTruthy();
  expect(screen.queryByLabelText('QR code that opens Ash Okafor’s claim on your phone')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Not your phone? Claim it on yours' }));
  expect(screen.getByLabelText('QR code that opens Ash Okafor’s claim on your phone')).toBeTruthy();
  expect(screen.getByText('Scan with your phone. It opens this claim there, after you sign in with your own email.')).toBeTruthy();
});

test('once the bar is claimed, it can confirm you', async () => {
  await renderWithTamagui(<PersonClaimSheet profile={ash} bar="Pale Moth" confirmBar="moth-page" stats={{ drinks: 1, menus: 0 }} visible onClose={jest.fn()} />);
  const option = screen.getByRole('radio', { name: /^Pale Moth confirms you/ });
  expect(option).not.toBeDisabled();
  await fireEvent.press(option);
  await fireEvent.press(screen.getByRole('button', { name: 'Send claim' }));
  expect(mockClaim).toHaveBeenCalledWith({ profile_id: 'ash', message: '', method: 'note', confirm_bar: 'moth-page' });
});
