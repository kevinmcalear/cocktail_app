import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { ShareMenuSheet } from './ShareMenuSheet';

const mockPush = jest.fn();
const mockShare = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/hooks/useMenuMutations', () => ({ useShareMenu: () => ({ mutateAsync: mockShare, isPending: false }) }));

const menu = { id: 'm1', name: 'Saturday at home', sharedAt: null };

beforeEach(() => {
  mockPush.mockClear();
  mockShare.mockReset();
});

describe('ShareMenuSheet', () => {
  test('with no public profile, the refusal comes with a way to make one', async () => {
    mockShare.mockRejectedValue(new Error('You need a public profile before you can share a menu.'));
    const onClose = jest.fn();
    await renderWithTamagui(<ShareMenuSheet menu={menu} onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Share a link' }));
    expect(mockShare).toHaveBeenCalledWith({ menuId: 'm1', shared: true });
    expect(await screen.findByText(/You need a public profile/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Set up your public profile' }));
    expect(onClose).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/settings/profile');
  });

  test('any other failure just says so', async () => {
    mockShare.mockRejectedValue(new Error('That didn’t work. Try again.'));
    await renderWithTamagui(<ShareMenuSheet menu={menu} onClose={() => {}} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Share a link' }));
    expect(await screen.findByText('That didn’t work. Try again.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set up your public profile' })).toBeNull();
  });
});
