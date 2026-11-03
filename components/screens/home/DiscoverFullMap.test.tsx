import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { MapBar } from '@/hooks/useDiscoverHome';
import type { Area } from '@/lib/nearMe';

import { DiscoverFullMap } from './DiscoverFullMap';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/components/nav/WebTabBar', () => ({ useTabBarInset: () => 0 }));
jest.mock('@/components/screens/home/SelectedBar', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SelectedBar: ({ pin }: { pin: { name: string } }) => <Text>{`card ${pin.name}`}</Text> };
});
// The map: a button per pin, one that moves the map far from where it opened, and the camera it opened on.
let mockCamera: unknown = null;
jest.mock('./DiscoverMap', () => {
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    mapAvailable: true,
    DiscoverMap: ({ pins, onSelect, onViewportChange, camera }: { pins: { id: string; name: string }[]; onSelect: (id: string) => void; onViewportChange: (v: object) => void; camera: unknown }) => (
      <>
        {(mockCamera = camera) && null}
        {pins.map((p) => (
          <Pressable key={p.id} role="button" accessibilityLabel={`pin ${p.name}`} onPress={() => onSelect(p.id)} />
        ))}
        <Pressable role="button" accessibilityLabel="move" onPress={() => onViewportChange({ latitude: 40.75, longitude: -73.98, latitudeDelta: 0.06, longitudeDelta: 0.04, zoom: 13 })} />
      </>
    ),
  };
});

const area: Area = { kind: 'point', latitude: 40.73, longitude: -74.0, radiusKm: 2, source: 'me' };
const bar: MapBar = {
  id: 'b1', handle: 'rye', name: 'Little Rye', logo: null, locality: 'West Village', city: 'New York', countryCode: 'US',
  latitude: 40.734, longitude: -74.003, closed: false, closedYear: null, drinks: 3, open: true, late: false,
};

async function show(start: { latitude: number; longitude: number; zoom: number } | null = null) {
  const onArea = jest.fn();
  const onClose = jest.fn();
  await renderWithProviders(<DiscoverFullMap bars={[bar]} named={[]} area={area} me={null} title="West Village" caption="1 bar open near you" start={start} onArea={onArea} onClose={onClose} />);
  return { onArea, onClose };
}

it('pins each bar, and a pin opens its sheet', async () => {
  await show();
  expect(screen.getByRole('heading', { name: 'West Village' })).toBeTruthy();
  expect(screen.queryByText('card Little Rye')).toBeNull();
  await fireEvent.press(screen.getByLabelText('pin Little Rye'));
  expect(screen.getByText('card Little Rye')).toBeTruthy();
});

it('offers Search this area once the map moves, and moves Discover there', async () => {
  const { onArea } = await show();
  expect(screen.queryByLabelText('Search this area')).toBeNull();
  await fireEvent.press(screen.getByLabelText('move'));
  await fireEvent.press(screen.getByLabelText('Search this area'));
  expect(onArea).toHaveBeenCalledWith(expect.objectContaining({ kind: 'point', source: 'map', latitude: 40.75 }), { latitude: 40.75, longitude: -73.98, zoom: 13 });
  expect(screen.queryByLabelText('Search this area')).toBeNull();
});

it('opens on the near-me neighbourhood', async () => {
  await show();
  expect(mockCamera).toEqual({ latitude: 40.73, longitude: -74.0, zoom: 13.5 });
});

it('opens where the area was searched from the map', async () => {
  await show({ latitude: 40.75, longitude: -73.98, zoom: 13 });
  expect(mockCamera).toEqual({ latitude: 40.75, longitude: -73.98, zoom: 13 });
});

it('goes back to the list', async () => {
  const { onClose } = await show();
  await fireEvent.press(screen.getByLabelText('Show the list'));
  await fireEvent.press(screen.getByLabelText('Back to the list'));
  expect(onClose).toHaveBeenCalledTimes(2);
});
