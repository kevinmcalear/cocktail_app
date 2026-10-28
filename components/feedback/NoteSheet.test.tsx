import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useNoteDrafts } from '@/store/useNoteDrafts';

import { photoType, sendFailure } from '@/hooks/useSendNote';

import { NoteSheet } from './NoteSheet';

jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'me' }));
jest.mock('expo-image-picker', () => ({}));
const mockInsert = jest.fn();
const mockUpload = jest.fn(async (_path: string, _body: unknown, _opts: object) => ({ error: null }));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (row: object) => ({ select: () => ({ single: () => mockInsert(row) }) }) }),
    storage: { from: () => ({ upload: (path: string, body: unknown, opts: object) => mockUpload(path, body, opts) }) },
  },
}));
jest.mock('@/lib/imageBase64', () => ({ imageExtFromUri: () => 'jpg', uriToBase64: async () => 'AAAA' }));
const mockReportFeedback = jest.fn();
jest.mock('@/lib/monitoring', () => ({ reportFeedback: (...args: unknown[]) => mockReportFeedback(...args) }));

const about = { screen: 'Adding a drink › Ice', drinkName: 'Ash Garden', draftId: 'd1', barId: 'rye', barName: 'Little Rye' };
const KEY = 'me:Adding a drink › Ice:rye:d1';
const sheet = (report?: { onEmail: (kind: string, body: string) => Promise<string | null> }) =>
  renderWithTamagui(
    <QueryClientProvider client={new QueryClient()}>
      <NoteSheet visible onClose={() => {}} about={report ? { screen: 'Settings › Report a problem' } : about} report={report} />
    </QueryClientProvider>
  );

beforeEach(() => {
  useNoteDrafts.setState({ drafts: {} });
  mockInsert.mockReset();
  mockReportFeedback.mockReset();
  mockUpload.mockClear();
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
  expect(useNoteDrafts.getState().drafts[KEY]?.body).toBe('We cut graduated blocks that stack in a column.');

  mockInsert.mockResolvedValueOnce({ data: { id: 'n1' }, error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Thanks. It’s with us.')).toBeTruthy();
  expect(mockInsert).toHaveBeenLastCalledWith(
    expect.objectContaining({ user_id: 'me', kind: 'tell_us', screen: 'Adding a drink › Ice', drink_name: 'Ash Garden', bar_id: 'rye', body: 'We cut graduated blocks that stack in a column.', photo_path: null })
  );
  // Sentry gets the note's id, kind and screen (not its words), once, for the send that landed.
  expect(mockReportFeedback).toHaveBeenCalledTimes(1);
  expect(mockReportFeedback).toHaveBeenCalledWith('n1', { kind: 'tell_us', screen: 'Adding a drink › Ice' });
  expect(useNoteDrafts.getState().drafts[KEY]).toBeUndefined();
});

test('Report a problem sends the kind picked, words optional; Email us instead still writes the email', async () => {
  const onEmail = jest.fn(async () => 'No email app opened.');
  await sheet({ onEmail });
  expect(screen.getByText('Sent with: Settings › Report a problem · app version and device')).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Something’s broken', checked: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('radio', { name: 'It’s slow' }));
  // While a report is sending, it can't also be emailed.
  let land: (v: { data: { id: 'n1' }, error: null }) => void = () => {};
  mockInsert.mockReturnValueOnce(new Promise((resolve) => (land = resolve)));
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(screen.getByRole('button', { name: 'Email us instead' })).toBeDisabled();
  await act(async () => land({ data: { id: 'n1' }, error: null }));
  expect(await screen.findByText('Thanks for telling us.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onEmail).not.toHaveBeenCalled();
});

test('Email us instead writes the email with what is picked, and says so when no email app opens', async () => {
  const onEmail = jest.fn(async () => 'No email app opened.');
  await sheet({ onEmail });
  await fireEvent.press(screen.getByRole('radio', { name: 'It’s slow' }));
  await fireEvent.press(screen.getByText('Email us instead'));
  expect(onEmail).toHaveBeenCalledWith('slow', '');
  // No email app: it says so, and the report is still here to send.
  expect(await screen.findByText('No email app opened.')).toBeTruthy();

  mockInsert.mockResolvedValueOnce({ data: { id: 'n1' }, error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Thanks for telling us.')).toBeTruthy();
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'slow', screen: 'Settings › Report a problem', body: '', bar_id: null }));
});

test('a note that lands after the sheet has gone still clears the kept words', async () => {
  let land: (v: { data: { id: 'n1' }, error: null }) => void = () => {};
  mockInsert.mockReturnValueOnce(new Promise((resolve) => (land = resolve)));
  const { unmount } = await sheet();
  await fireEvent.changeText(screen.getByLabelText('What you do'), 'Graduated blocks.');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  await unmount();
  await act(async () => land({ data: { id: 'n1' }, error: null }));
  expect(useNoteDrafts.getState().drafts[KEY]).toBeUndefined();
});

test('only the daily limit says "a lot of notes"; other refusals and offline say something else', () => {
  expect(sendFailure({ code: 'P0001', hint: 'notes_daily_limit', message: 'That’s a lot of notes for one day.' })).toMatch(/a lot of notes for one day/);
  expect(sendFailure({ code: '42501', message: 'new row violates row-level security policy' })).not.toMatch(/a lot of notes/);
  expect(sendFailure({ code: '42501', message: 'new row violates row-level security policy' })).toMatch(/Report a problem/);
  expect(sendFailure(new Error('Network request failed'))).toMatch(/when you’re online/);
  expect(sendFailure({ code: 'photo_refused', message: 'The object exceeded the maximum allowed size' })).toMatch(/That photo couldn’t be sent/);
});

test('a HEIC photo stays HEIC; an unknown one goes as a JPEG', () => {
  expect(photoType({ uri: 'file:///p/IMG_1.HEIC', type: null })).toEqual({ ext: 'heic', contentType: 'image/heic' });
  expect(photoType({ uri: 'blob:x', type: 'image/heif' })).toEqual({ ext: 'heif', contentType: 'image/heif' });
  expect(photoType({ uri: 'file:///p/a.jpeg', type: null })).toEqual({ ext: 'jpg', contentType: 'image/jpeg' });
  expect(photoType({ uri: 'blob:x', type: null })).toEqual({ ext: 'jpg', contentType: 'image/jpeg' });
});

test('the thanks stays while the sheet closes; opened again, it is a fresh sheet', async () => {
  const onClose = jest.fn();
  const view = (visible: boolean) => (
    <QueryClientProvider client={client}>
      <NoteSheet visible={visible} onClose={onClose} about={about} />
    </QueryClientProvider>
  );
  const client = new QueryClient();
  const { rerender } = await renderWithTamagui(view(true));
  await fireEvent.changeText(screen.getByLabelText('What you do'), 'Graduated blocks.');
  mockInsert.mockResolvedValueOnce({ data: { id: 'n1' }, error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalled();
  // Still the thanks while it slides away.
  expect(screen.getByText('Thanks. It’s with us.')).toBeTruthy();
  await rerender(view(false));
  await rerender(view(true));
  expect(screen.getByText('What do you do differently?')).toBeTruthy();
  expect(screen.getByLabelText('What you do').props.value).toBe('');
});

test('a report from a screenshot opens with it attached and sends it; Remove sends the words alone', async () => {
  const shot = { uri: 'file:///tmp/shot.jpg', id: 'shot1', type: 'image/jpeg' };
  const about = { screen: '/cocktail/abc', label: 'your screenshot' };
  const view = (
    <QueryClientProvider client={new QueryClient()}>
      <NoteSheet visible onClose={() => {}} about={about} report={{}} photo={shot} />
    </QueryClientProvider>
  );
  await renderWithTamagui(view);
  expect(screen.getByText('Screenshot added')).toBeTruthy();
  expect(screen.getByText('Sent with: your screenshot · app version and device')).toBeTruthy();
  // No email app can carry the screenshot, so there's no Email us instead here.
  expect(screen.queryByText('Email us instead')).toBeNull();

  mockInsert.mockResolvedValueOnce({ data: { id: 'n2' }, error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Thanks for telling us.')).toBeTruthy();
  expect(mockUpload).toHaveBeenCalledWith('me/shot1.jpg', expect.anything(), { contentType: 'image/jpeg', upsert: false });
  expect(mockInsert).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'broken', screen: '/cocktail/abc', photo_path: 'me/shot1.jpg' }));
});

test('Remove takes the screenshot off a report before it goes', async () => {
  const shot = { uri: 'file:///tmp/shot.jpg', id: 'shot2', type: 'image/jpeg' };
  await renderWithTamagui(
    <QueryClientProvider client={new QueryClient()}>
      <NoteSheet visible onClose={() => {}} about={{ screen: '/menus' }} report={{}} photo={shot} />
    </QueryClientProvider>
  );
  await fireEvent.press(screen.getByText('Remove'));
  expect(screen.getByRole('button', { name: 'Add a photo (optional)' })).toBeTruthy();
  mockInsert.mockResolvedValueOnce({ data: { id: 'n3' }, error: null });
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Thanks for telling us.')).toBeTruthy();
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockInsert).toHaveBeenLastCalledWith(expect.objectContaining({ photo_path: null }));
});
