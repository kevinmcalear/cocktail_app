import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { SnapScreen } from './SnapScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/hooks/useBringInPlace', () => ({ useBringInPlace: () => ({ barId: 'bar', venueName: 'Pale Moth', heldBack: null, loading: false }) }));
const mockStart = jest.fn();
jest.mock('@/components/screens/bringin/useStartBringIn', () => ({ useStartBringIn: () => mockStart }));
const mockClip = jest.fn();
jest.mock('@/lib/clipboardPeek', () => ({ UNREAD_CLIP: '\u0000unread', readClipboardAny: () => mockClip(), peekClipboard: async () => null }));
jest.mock('@/hooks/useDictation', () => ({ useDictation: () => ({ available: true, listening: false, error: null, start: jest.fn(), stop: jest.fn() }) }));
let mockCamera: 'live' | 'off' = 'live';
jest.mock('./LiveCamera', () => ({
  hasLiveCamera: async () => true,
  LiveCamera: ({ ref, onState }: { ref: React.Ref<unknown>; onState: (s: string, torch: boolean) => void }) => {
    const { useEffect, useImperativeHandle } = jest.requireActual<typeof import('react')>('react');
    useImperativeHandle(ref, () => ({ snap: async () => ({ uri: 'file:///menu.jpg', mimeType: 'image/jpeg' }) }));
    useEffect(() => onState(mockCamera, true), [onState]);
    return null;
  },
}));

beforeEach(() => {
  mockStart.mockReset();
  mockReplace.mockReset();
  mockClip.mockReset();
  mockCamera = 'live';
});

test('the shutter takes the photo and Bring in reads it in place of the viewfinder', async () => {
  await renderWithProviders(<SnapScreen />);
  expect(screen.getByText('Point at a menu, a bottle or a recipe')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Take the photo' }));
  expect(mockStart).toHaveBeenLastCalledWith([{ files: [{ uri: 'file:///menu.jpg', mimeType: 'image/jpeg' }], text: null, url: null, name: null }], { barId: 'bar', replace: true });
});

test('Paste reads a copied picture or copied text', async () => {
  mockClip.mockResolvedValueOnce({ image: { uri: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' } }).mockResolvedValueOnce({ text: 'a negroni but with mezcal' });
  await renderWithProviders(<SnapScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Paste' }));
  expect(mockStart).toHaveBeenLastCalledWith([{ files: [{ uri: 'data:image/jpeg;base64,AAAA', mimeType: 'image/jpeg' }], text: null, url: null, name: null }], { barId: 'bar', replace: true });
  await fireEvent.press(screen.getByRole('button', { name: 'Paste' }));
  expect(mockStart).toHaveBeenLastCalledWith([{ files: [], text: 'a negroni but with mezcal', url: null }], { barId: 'bar', replace: true });
});

test('with the camera off it says so and offers a photo instead, and the shutter waits', async () => {
  mockCamera = 'off';
  await renderWithProviders(<SnapScreen />);
  expect(screen.getByText('Camera access is off. Turn it on in Settings, or choose a photo.')).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Choose a photo' })).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Take the photo' })).toBeDisabled();
});
