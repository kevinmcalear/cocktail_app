import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { BringInJob } from '@/store/useBringIn';

import { FirstMenu } from './FirstMenu';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
// No camera here: the viewfinder says so and offers Photos.
jest.mock('@/components/screens/snap/LiveCamera', () => {
  const { useEffect } = jest.requireActual('react');
  return { LiveCamera: ({ onState }: { onState: (s: string, t: boolean) => void }) => (useEffect(() => onState('failed', false), [onState]), null) };
});
jest.mock('./BringInChooser', () => {
  const { Text } = jest.requireActual('react-native');
  return { BringInChooser: ({ paste }: { paste?: boolean }) => <Text>{paste ? 'Paste box' : 'Chooser'}</Text> };
});
jest.mock('@/components/screens/venueSetup/MenuStep', () => {
  const { Text } = jest.requireActual('react-native');
  return { MenuStep: () => <Text>Start our own menu</Text> };
});

const props = { step: 'Set up Little Rye · Tonight’s menu', barId: 'b1', data: null, onClose: jest.fn(), onReady: jest.fn() };

test('opens on the camera, titled Tonight’s menu, with Photos, Paste and Type', async () => {
  await renderWithProviders(<FirstMenu {...props} job={null} />);
  expect(screen.getByText('Tonight’s menu')).toBeTruthy();
  expect(screen.getByText('Last step: your menu')).toBeTruthy();
  expect(screen.getByText('Choose a photo')).toBeTruthy();
  for (const way of ['Choose photos of your menu', 'Paste your menu', 'Type your menu']) expect(screen.getByRole('button', { name: way })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Paste your menu' }));
  expect(screen.getByText('Paste box')).toBeTruthy();
});

test('Type starts the menu yourself', async () => {
  await renderWithProviders(<FirstMenu {...props} job={null} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Type your menu' }));
  expect(screen.getByText('Start our own menu')).toBeTruthy();
});

test('a photo being read says so in the viewfinder, with no shutter', async () => {
  const job = { id: 1, status: 'reading', reading: null, source: { files: [{ uri: 'file:///menu.jpg', mimeType: 'image/jpeg' }], text: null, url: null } } as unknown as BringInJob;
  await renderWithProviders(<FirstMenu {...props} job={job} />);
  expect(screen.getByText('Reading your menu')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Take the photo' })).toBeNull();
});
