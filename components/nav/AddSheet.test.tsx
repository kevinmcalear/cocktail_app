import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { EMPTY_DRAFT } from '@/lib/drinkWizard';
import { startReview } from '@/lib/importReview';
import { useBringIn } from '@/store/useBringIn';
import { useDrinkWizardStore } from '@/store/useDrinkWizardStore';

import { AddSheet } from './AddSheet';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/useDrafts', () => ({ useDrafts: () => ({ drafts: [] }) }));
jest.mock('@/hooks/useBringInPlace', () => ({ useBringInPlace: () => ({ barId: 'bar', venueName: 'Pale Moth', heldBack: null, loading: false }) }));
const mockStart = jest.fn();
jest.mock('@/components/screens/bringin/useStartBringIn', () => ({ useStartBringIn: () => mockStart }));
jest.mock('@/lib/clipboardPeek', () => ({ UNREAD_CLIP: '\u0000unread', peekClipboard: async () => 'https://www.instagram.com/reel/C9xAbcdefghijk', readClipboard: async () => 'https://www.instagram.com/reel/C9xAbcdefghijk' }));
jest.mock('@/ctx/AuthContext', () => ({ useAuth: () => ({ session: null }), useUserId: () => 'me' }));
jest.mock('@/hooks/useDrinkDesk', () => ({ useMenuSectionPlace: () => ({ data: undefined }) }));

const field = () => screen.getByLabelText('Name a drink, paste a link, or describe it');

beforeEach(() => {
  mockPush.mockReset();
  mockStart.mockReset();
});

test('a name opens a draft of that drink, where Bring in puts things', async () => {
  const onClose = jest.fn();
  await renderWithProviders(<AddSheet visible onClose={onClose} onMore={jest.fn()} />);
  await fireEvent.changeText(field(), 'smoke signal');
  await fireEvent.press(screen.getByRole('button', { name: 'Start a drink called smoke signal' }));
  expect(onClose).toHaveBeenCalled();
  expect(mockPush).toHaveBeenLastCalledWith('/add-cocktail?name=Smoke%20signal&barId=bar');
  expect(mockStart).not.toHaveBeenCalled();
});

test('a description is read by Bring in', async () => {
  await renderWithProviders(<AddSheet visible onClose={jest.fn()} onMore={jest.fn()} />);
  await fireEvent.changeText(field(), 'a negroni but with mezcal');
  await fireEvent.press(screen.getByRole('button', { name: 'Read it' }));
  expect(mockStart).toHaveBeenLastCalledWith([{ files: [], text: 'a negroni but with mezcal', url: null }], { barId: 'bar' });
});

test('the link you copied is one tap', async () => {
  await renderWithProviders(<AddSheet visible onClose={jest.fn()} onMore={jest.fn()} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Use the link you copied: instagram.com/reel/C9xAbcde…. Paste' }));
  expect(mockStart).toHaveBeenLastCalledWith([{ files: [], text: 'https://www.instagram.com/reel/C9xAbcdefghijk', url: null }], { barId: 'bar' });
});

// Eddie, 29 Oct: New drink kept taking him back to a PDF import he hadn't finished.
test('an unfinished import waits at the bottom, apart from drinks being checked in it', async () => {
  const recipe = { name: 'Feijoa Smash', lines: [] } as never;
  const review = startReview({ id: 'r1', userId: 'me', barId: 'bar', name: 'Spec book.pdf', source: 'From a PDF', recipes: [recipe, recipe], files: [], choices: [{ name: 'Feijoa Smash' }, { name: 'Feijoa Smash' }] as never, summary: {} as never, now: '2026-10-29T12:00:00Z' });
  useBringIn.setState({ reviews: { r1: review }, reviewing: null });
  useDrinkWizardStore.getState().begin('bar|review:r1#0', { ...EMPTY_DRAFT, name: 'Feijoa Smash' });
  await renderWithProviders(<AddSheet visible onClose={jest.fn()} onMore={jest.fn()} />);
  expect(screen.getByText('Pick up where you left off')).toBeTruthy();
  expect(screen.queryByText('Feijoa Smash')).toBeNull();
  await fireEvent.press(screen.getByRole('link', { name: /^Spec book\. 0 of 2 checked/ }));
  expect(useBringIn.getState().reviewing).toBe('r1');
  expect(mockPush).toHaveBeenLastCalledWith('/bring-in');
  useBringIn.setState({ reviews: {}, reviewing: null });
  useDrinkWizardStore.setState({ kept: {} });
});
