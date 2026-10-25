import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { useSettingsStore } from '@/store/useSettingsStore';

import { IcePrompt } from './IcePrompt';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: ['prep'] }) }));
jest.mock('@/hooks/useActiveVenue', () => ({ useActiveVenue: () => ({ venues: [{ id: 'bar-1', name: 'Little Rye' }] }) }));
jest.mock('@/hooks/useVenueIce', () => ({
  useVenueIce: () => ({ data: [{ id: 'c', name: 'Clear cube · 50 mm', shape: 'large', draw_as: null }, { id: 'b', name: 'Block', shape: 'block', draw_as: null }] }),
}));
// Add opens Kit's Add ice sheet (IceSheet.test.tsx): what it's opened with is under test.
const mockSheet = jest.fn();
jest.mock('./IceSheet', () => ({ IceSheet: (props: unknown) => (mockSheet(props), null) }));

beforeEach(() => {
  mockSheet.mockReset();
  useSettingsStore.setState({ glassesNotNow: [] });
});

test('an ice the venue pours nothing like asks, and Add opens the sheet at where it comes from', async () => {
  await renderWithTamagui(<IcePrompt barId="bar-1" ice="Sphere" drink="Old Fashioned" />);
  expect(screen.getByText('Sphere isn’t in Little Rye’s ice.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Add to our ice' }));
  expect(mockSheet.mock.calls.at(-1)[0]).toMatchObject({ visible: true, initial: { name: 'Sphere', shape: 'sphere' }, startAt: 1, from: 'From the Old Fashioned' });
});

test('an ice drawn like one the venue pours asks nothing; Not now is kept for that kind', async () => {
  await renderWithTamagui(<IcePrompt barId="bar-1" ice="Large cube" />);
  expect(screen.queryByText(/isn’t in Little Rye’s ice/)).toBeNull();

  await renderWithTamagui(<IcePrompt barId="bar-1" ice="Crushed" />);
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(useSettingsStore.getState().glassesNotNow).toEqual(['ice:bar-1:crushed']);
  expect(screen.queryByText(/isn’t in Little Rye’s ice/)).toBeNull();
});
