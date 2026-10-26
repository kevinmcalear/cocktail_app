import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useFirstOpen } from '@/store/useFirstOpen';

import type { NearMe } from '@/hooks/useNearMe';
import type { LocationAccess } from '@/lib/deviceLocation';
import type { Area } from '@/lib/nearMe';

import { FirstCards } from './FirstCards';

jest.mock('@/ctx/AuthContext', () => ({ useUserId: () => 'me' }));
let mockMode: 'home' | 'venue' = 'home';
jest.mock('@/hooks/useMode', () => ({ useMode: () => ({ mode: mockMode }) }));
let mockLoved: object[] | undefined = [];
let mockHidden: object[] | undefined = [];
const mockLove = jest.fn(() => Promise.resolve());
const mockHide = jest.fn(() => Promise.resolve());
jest.mock('@/hooks/useKept', () => ({ useLovedBars: () => ({ data: mockLoved }), useLoveBar: () => ({ mutateAsync: mockLove, reset: jest.fn() }) }));
jest.mock('@/hooks/useGoogleImport', () => ({ useMatchSavedPlaces: () => ({ reset: jest.fn(), mutate: jest.fn() }) }));
jest.mock('@/lib/toast', () => ({ toastDone: jest.fn() }));
jest.mock('@/hooks/useHiddenBars', () => ({ useHiddenBars: () => ({ data: mockHidden }), useHideBar: () => ({ mutateAsync: mockHide }) }));
jest.mock('@/components/screens/safety/AgeGate', () => ({ useAgeGate: () => ({ gate: (run: () => void) => run(), sheet: null }) }));
jest.mock('@/components/screens/home/BarMark', () => ({ BarMark: () => null }));
const bar = (id: string, name: string) => ({ venue_profile_id: id, display_name: name, handle: id, locality: 'Fitzroy', city: 'Melbourne', distance_km: null, position: null, score: null, rankers: 0, is_early: true, latitude: null, longitude: null });
let mockBars = [bar('rye', 'Little Rye'), bar('gold', 'The Gold Room'), bar('1806', '1806'), bar('moth', 'Pale Moth')];
jest.mock('@/hooks/useDiscover', () => ({ useTopBars: (_area: unknown, enabled: boolean) => ({ data: enabled ? { ranked: [], early: mockBars } : undefined }), useBarCities: () => ({ data: [] }) }));

const nearYou: Area = { kind: 'point', latitude: -37.8, longitude: 144.98, radiusKm: 10, source: 'me' };
const ready: NearMe = { status: 'ready', latitude: -37.8, longitude: 144.98 };
const idle: NearMe = { status: 'idle' };
const onNearMe = jest.fn();

/** Discover's cards as the screen passes them: allowed and near you unless a test says otherwise. */
function Cards({ area = nearYou, near = ready, access = 'granted' }: { area?: Area; near?: NearMe; access?: LocationAccess | null }) {
  const where = { area, preferNear: true, onArea: jest.fn(), onNearMe, onThisArea: jest.fn() };
  return <FirstCards near={near} access={access} where={where} onNearMe={onNearMe} onGlass={false} />;
}

/** The favourites card's button opens the sheet; nothing opens by itself (Q3). */
const openSheet = async () => {
  expect(screen.queryByText('Top bars near you, best first')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Pick favourites' }));
};

beforeEach(() => {
  mockMode = 'home';
  mockLoved = [];
  mockHidden = [];
  mockBars = [bar('rye', 'Little Rye'), bar('gold', 'The Gold Room'), bar('1806', '1806'), bar('moth', 'Pale Moth')];
  useFirstOpen.setState({ asked: [], cityPicked: false });
  jest.clearAllMocks();
});

test('location not yet asked: the location card comes first, and Use my location asks', async () => {
  await renderWithTamagui(<Cards area={{ kind: 'anywhere' }} near={idle} access="ask" />);
  expect(screen.getByText('See what’s being poured near you')).toBeTruthy();
  expect(screen.queryByText('Any favourites near you?')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Use my location' }));
  expect(onNearMe).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(screen.queryByText('See what’s being poured near you')).toBeNull();
});

test('blocked: the card says so and offers Settings; a city picked before keeps it away', async () => {
  const view = await renderWithTamagui(<Cards area={{ kind: 'anywhere' }} near={idle} access="blocked" />);
  expect(screen.getByText('Location is off for Cocktail')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Open Settings' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Pick a city' })).toBeTruthy();
  await view.unmount();
  useFirstOpen.setState({ cityPicked: true });
  await renderWithTamagui(<Cards area={{ kind: 'city', city: 'Melbourne', country_code: 'AU', label: 'Melbourne' }} near={idle} access="ask" />);
  expect(screen.queryByText('See what’s being poured near you')).toBeNull();
  expect(screen.getByText('Any favourites in Melbourne?')).toBeTruthy();
});

test('asks once, at home, before any bar is loved or hidden; Done saves the picks', async () => {
  await renderWithTamagui(<Cards />);
  await openSheet();
  expect(screen.getAllByText('Any favourites near you?').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByLabelText('Love Little Rye'));
  await fireEvent.press(screen.getByLabelText('Hide 1806 from Discover'));
  expect(screen.getByText('1 loved · 1 hidden')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(mockLove).toHaveBeenCalledWith({ profileId: 'rye', love: true });
  expect(mockHide).toHaveBeenCalledWith({ profileId: '1806', hide: true });
  expect(useFirstOpen.getState().asked).toEqual(['me']);
});

test('the card’s X is Skip: it asks nothing again', async () => {
  await renderWithTamagui(<Cards />);
  await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
  expect(useFirstOpen.getState().asked).toEqual(['me']);
  expect(screen.queryByText('Any favourites near you?')).toBeNull();
});

test('From Google Maps swaps the sheet for the import, and Cancel comes back', async () => {
  await renderWithTamagui(<Cards />);
  await openSheet();
  await fireEvent.press(screen.getByLabelText('From Google Maps. Love the bars you saved there'));
  expect(screen.getAllByText('Your Google Maps places').length).toBeGreaterThan(0);
  expect(screen.getByText('Download your places')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getAllByText('Any favourites near you?').length).toBeGreaterThan(0);
  expect(useFirstOpen.getState().asked).toEqual([]);
});

test('a second tap undoes a pick; Skip asks nothing again and saves nothing', async () => {
  await renderWithTamagui(<Cards />);
  await openSheet();
  await fireEvent.press(screen.getByLabelText('Love Pale Moth'));
  await fireEvent.press(screen.getByLabelText('You love Pale Moth: undo'));
  expect(screen.getByText('Nothing picked yet')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('button', { name: 'Skip for now' })[0]);
  expect(mockLove).not.toHaveBeenCalled();
  expect(useFirstOpen.getState().asked).toEqual(['me']);
});

test('a pick that fails to save stays on screen with a note, and nothing is marked asked', async () => {
  mockLove.mockImplementationOnce(() => Promise.reject(new Error('offline')));
  await renderWithTamagui(<Cards />);
  await openSheet();
  await fireEvent.press(screen.getByLabelText('Love Little Rye'));
  await fireEvent.press(screen.getByLabelText('Hide 1806 from Discover'));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(await screen.findByText('Couldn’t save 1 loved. Check your connection and try again.')).toBeTruthy();
  expect(screen.getByLabelText('You love Little Rye: undo')).toBeTruthy();
  expect(useFirstOpen.getState().asked).toEqual([]);
});

test('no favourites card once asked, at a venue, with a bar already loved, with too few bars, or anywhere', async () => {
  for (const setup of [
    () => useFirstOpen.setState({ asked: ['me'] }),
    () => (mockMode = 'venue'),
    () => (mockLoved = [{ id: 'rye' }]),
    () => (mockHidden = undefined),
    () => (mockBars = mockBars.slice(0, 2)),
  ]) {
    setup();
    const view = await renderWithTamagui(<Cards />);
    expect(screen.queryByText('Any favourites near you?')).toBeNull();
    await view.unmount();
    mockMode = 'home';
    mockLoved = [];
    mockHidden = [];
    mockBars = [bar('rye', 'Little Rye'), bar('gold', 'The Gold Room'), bar('1806', '1806'), bar('moth', 'Pale Moth')];
    useFirstOpen.setState({ asked: [] });
  }
  await renderWithTamagui(<Cards area={{ kind: 'anywhere' }} />);
  expect(screen.queryByText('Any favourites anywhere?')).toBeNull();
});
