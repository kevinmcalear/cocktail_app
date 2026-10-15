import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useFirstOpen } from '@/store/useFirstOpen';

import { FirstOpenSheet } from './FirstOpenSheet';

jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'me' }));
let mockMode: 'home' | 'venue' = 'home';
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode }) }));
let mockLoved: object[] | undefined = [];
let mockHidden: object[] | undefined = [];
const mockLove = jest.fn(() => Promise.resolve());
const mockHide = jest.fn(() => Promise.resolve());
jest.mock('@/hooks/useKept', () => ({ useLovedBars: () => ({ data: mockLoved }), useLoveBar: () => ({ mutateAsync: mockLove }) }));
jest.mock('@/hooks/useHiddenBars', () => ({ useHiddenBars: () => ({ data: mockHidden }), useHideBar: () => ({ mutateAsync: mockHide }) }));
jest.mock('@/components/screens/safety/AgeGate', () => ({ useAgeGate: () => ({ gate: (run: () => void) => run(), sheet: null }) }));
jest.mock('@/components/screens/home/BarMark', () => ({ BarMark: () => null }));
const bar = (id: string, name: string) => ({ venue_profile_id: id, display_name: name, handle: id, locality: 'Fitzroy', city: 'Melbourne', distance_km: null, position: null, score: null, rankers: 0, is_early: true, latitude: null, longitude: null });
let mockBars = [bar('rye', 'Little Rye'), bar('gold', 'The Gold Room'), bar('1806', '1806'), bar('moth', 'Pale Moth')];
jest.mock('@/hooks/useDiscover', () => ({ useTopBars: (_area: unknown, enabled: boolean) => ({ data: enabled ? { ranked: [], early: mockBars } : undefined }) }));

const area = { kind: 'anywhere' } as const;

// The sheet waits a moment after mount (another sheet may still be closing on iOS).
const settle = () => act(() => jest.advanceTimersByTime(1000));

beforeEach(() => {
  jest.useFakeTimers();
  mockMode = 'home';
  mockLoved = [];
  mockHidden = [];
  mockBars = [bar('rye', 'Little Rye'), bar('gold', 'The Gold Room'), bar('1806', '1806'), bar('moth', 'Pale Moth')];
  useFirstOpen.setState({ asked: [] });
  jest.clearAllMocks();
});

test('asks once, at home, before any bar is loved or hidden; Done saves the picks', async () => {
  await renderWithTamagui(<FirstOpenSheet area={area} />);
  expect(screen.queryByText('Any favourites?')).toBeNull();
  await settle();
  expect(screen.getByText('Any favourites?')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Love Little Rye'));
  await fireEvent.press(screen.getByLabelText('Hide 1806 from Discover'));
  expect(screen.getByText('1 loved · 1 hidden')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(mockLove).toHaveBeenCalledWith({ profileId: 'rye', love: true });
  expect(mockHide).toHaveBeenCalledWith({ profileId: '1806', hide: true });
  expect(useFirstOpen.getState().asked).toEqual(['me']);
});

test('a second tap undoes a pick; Skip asks nothing again and saves nothing', async () => {
  await renderWithTamagui(<FirstOpenSheet area={area} />);
  await settle();
  await fireEvent.press(screen.getByLabelText('Love Pale Moth'));
  await fireEvent.press(screen.getByLabelText('You love Pale Moth: undo'));
  expect(screen.getByText('Nothing picked yet')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Skip for now' })[0]);
  expect(mockLove).not.toHaveBeenCalled();
  expect(useFirstOpen.getState().asked).toEqual(['me']);
});

test('a pick that fails to save stays on screen with a note, and nothing is marked asked', async () => {
  mockLove.mockImplementationOnce(() => Promise.reject(new Error('offline')));
  await renderWithTamagui(<FirstOpenSheet area={area} />);
  await settle();
  await fireEvent.press(screen.getByLabelText('Love Little Rye'));
  await fireEvent.press(screen.getByLabelText('Hide 1806 from Discover'));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(await screen.findByText('Couldn’t save 1 loved. Check your connection and try again.')).toBeTruthy();
  expect(screen.getByLabelText('You love Little Rye: undo')).toBeTruthy();
  expect(useFirstOpen.getState().asked).toEqual([]);
});

test('says nothing once asked, at a venue, with a bar already loved, or with too few bars', async () => {
  for (const setup of [
    () => useFirstOpen.setState({ asked: ['me'] }),
    () => (mockMode = 'venue'),
    () => (mockLoved = [{ id: 'rye' }]),
    () => (mockHidden = undefined),
    () => (mockBars = mockBars.slice(0, 2)),
  ]) {
    setup();
    const view = await renderWithTamagui(<FirstOpenSheet area={area} />);
    await settle();
    expect(screen.queryByText('Any favourites?')).toBeNull();
    await view.unmount();
    mockMode = 'home';
    mockLoved = [];
    mockHidden = [];
    mockBars = [bar('rye', 'Little Rye'), bar('gold', 'The Gold Room'), bar('1806', '1806'), bar('moth', 'Pale Moth')];
    useFirstOpen.setState({ asked: [] });
  }
});
