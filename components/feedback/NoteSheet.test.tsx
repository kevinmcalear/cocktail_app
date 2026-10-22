import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useNoteDrafts } from '@/store/useNoteDrafts';

import { NoteSheet } from './NoteSheet';

jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'me' }));
jest.mock('expo-image-picker', () => ({}));
const mockInsert = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: () => ({ insert: (row: object) => mockInsert(row) }) } }));

const about = { screen: 'Adding a drink › Ice', drinkName: 'Ash Garden', barId: 'rye', barName: 'Little Rye' };
const sheet = (report?: { onEmail: jest.Mock }) =>
  renderWithTamagui(
    <QueryClientProvider client={new QueryClient()}>
      <NoteSheet visible onClose={() => {}} about={report ? { screen: 'Settings › Report a problem' } : about} report={report} />
    </QueryClientProvider>
  );

beforeEach(() => {
  useNoteDrafts.setState({ drafts: {} });
  mockInsert.mockReset();
});

test('Tell us shows what it is sent with, keeps the words when sending fails, and thanks them once it goes', async () => {
  await sheet();
  expect(screen.getByText('Sent with: Adding a drink › Ice · Ash Garden · Little Rye')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

  await fireEvent.changeText(screen.getByLabelText('What you do'), 'We cut graduated blocks that stack in a column.');
  mockInsert.mockResolvedValueOnce({ error: new Error('Network request failed') });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText(/Couldn’t send it. What you wrote is kept here/)).toBeTruthy();
  expect(screen.getByLabelText('What you do').props.value).toBe('We cut graduated blocks that stack in a column.');
  expect(useNoteDrafts.getState().drafts['me:Adding a drink › Ice']?.body).toBe('We cut graduated blocks that stack in a column.');

  mockInsert.mockResolvedValueOnce({ error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Thanks. It’s with us.')).toBeTruthy();
  expect(mockInsert).toHaveBeenLastCalledWith(
    expect.objectContaining({ user_id: 'me', kind: 'tell_us', screen: 'Adding a drink › Ice', drink_name: 'Ash Garden', bar_id: 'rye', body: 'We cut graduated blocks that stack in a column.', photo_path: null })
  );
  expect(useNoteDrafts.getState().drafts['me:Adding a drink › Ice']).toBeUndefined();
});

test('Report a problem sends the kind picked, words optional; Email us instead still writes the email', async () => {
  const onEmail = jest.fn();
  await sheet({ onEmail });
  expect(screen.getByText('Sent with: Settings › Report a problem · app version and device')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Something’s broken', checked: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'It’s slow' }));
  await fireEvent.press(screen.getByText('Email us instead'));
  expect(onEmail).toHaveBeenCalledWith('slow', '');

  mockInsert.mockResolvedValueOnce({ error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Thanks for telling us.')).toBeTruthy();
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'slow', screen: 'Settings › Report a problem', body: '', bar_id: null }));
});
