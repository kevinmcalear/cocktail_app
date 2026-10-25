import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import type { GlassPhoto } from '@/lib/glassPhoto';

import { KitAddSheet } from '../KitAddSheet';
import { useDrawGlass, type DrawnGlass } from './useDrawGlass';

// The camera is mocked with a photo drawn here; the tracer is the real one (no AI, nothing paid).
const mockPick = jest.fn();
jest.mock('@/lib/glassPhoto', () => ({ pickGlassPhoto: () => mockPick(), readGlassPhoto: jest.fn() }));
jest.mock('@/components/glass/GlassModelPicker', () => ({ GlassThumb: () => null, FIRST_TYPES: ['coupe', 'nick', 'martini', 'rocks', 'highball'], MORE_TYPES: ['tiki'] }));
jest.mock('@/hooks/useIsWideWeb', () => ({ useIsWideWeb: () => false }));

/** A plain wall, and a 90 mm rocks glass (80 mm across) when `glass`: dark at its walls, rim and base. */
function photo(glass: boolean): GlassPhoto {
  const W = 300;
  const H = 400;
  const data = new Uint8ClampedArray(W * H * 4).fill(200);
  if (glass) {
    const px = 2.5;
    for (let y = 100; y < 100 + 90 * px; y++) {
      for (let x = 150 - 40 * px; x <= 150 + 40 * px; x++) {
        const edge = x - (150 - 40 * px) < 3 || 150 + 40 * px - x < 3 || y - 100 < 3 || 100 + 90 * px - y <= 3;
        data.fill(edge ? 120 : 195, (y * W + x) * 4, (y * W + x) * 4 + 3);
      }
    }
  }
  return { uri: 'file:///glass.jpg', width: W, height: H, pixels: { width: W, height: H, data }, jpeg: new ArrayBuffer(8) };
}

function Harness({ onDone }: { onDone: (g: DrawnGlass) => void }) {
  const { question } = useDrawGlass({ first: { start: 'photo', initial: { glass: 'rocks', name: '', maker: '' } }, home: false, onBack: () => {}, onDone });
  return <KitAddSheet visible onClose={() => {}} label="Add a glass" step={0} total={3} question={question} onNext={() => {}} />;
}

beforeEach(() => mockPick.mockReset());

test('a photo and its height draw the glass; Looks right hands back the traced outline', async () => {
  mockPick.mockResolvedValue(photo(true));
  const onDone = jest.fn();
  await renderWithTamagui(<Harness onDone={onDone} />);
  expect(screen.getByText('1 of 3 · Draw my glass')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
  await screen.findByText('One number sets its size');
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Butcher rocks');
  await fireEvent.changeText(screen.getByLabelText('How tall is it?'), '90');
  expect(screen.getByText(/3\.5 in\./)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Draw it' }));
  expect(screen.getByText('Drawing your glass')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('Does it look like your glass?')).toBeTruthy(), { timeout: 3000 });
  expect(screen.getByText('90 mm')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Looks right' }));
  const drawn = onDone.mock.calls[0][0] as DrawnGlass;
  expect(drawn).toMatchObject({ glass: 'rocks', name: 'Butcher rocks', capacity_ml: null });
  expect(drawn.outline.height_mm).toBe(90);
  expect(Math.abs(drawn.outline.rim_mm - 80)).toBeLessThan(4);
  expect(drawn.photo?.uri).toBe('file:///glass.jpg');
});

test('it stops and says why when it can’t see a glass', async () => {
  mockPick.mockResolvedValue(photo(false));
  await renderWithTamagui(<Harness onDone={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
  await screen.findByText('One number sets its size');
  await fireEvent.press(screen.getByRole('radio', { name: 'Capacity' }));
  await fireEvent.changeText(screen.getByLabelText('How much does it hold, to the brim?'), '300');
  await fireEvent.press(screen.getByRole('button', { name: 'Draw it' }));
  await waitFor(() => expect(screen.getByText('We couldn’t find its edge')).toBeTruthy(), { timeout: 3000 });
  expect(screen.getByRole('button', { name: 'Retake the photo' })).toBeTruthy();
});
