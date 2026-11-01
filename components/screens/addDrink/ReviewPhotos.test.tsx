import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';
import type { SketchInputs } from '@/lib/sketch/types';

import { DraftPhotos, DrawingChoice } from './ReviewPhotos';

let mockCaps: string[] = ['photos'];
jest.mock('@/components/drink/drinkImages', () => ({ pickDrinkPhotos: jest.fn() }));
jest.mock('@/components/drink/CutoutOfferHost', () => ({ CutoutOfferHost: () => null }));
jest.mock('@/components/ds/SketchDrawing', () => ({ SketchDrawing: () => null }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: mockCaps }) }));

const photos = (barId: string | null) => <DraftPhotos barId={barId} photos={{}} onChange={jest.fn()} sketch={{} as SketchInputs} seed="new-drink" />;

describe('the draft page’s photos (E25, Q15)', () => {
  test('at a venue, the slots for those who may add photos', async () => {
    mockCaps = ['photos'];
    await renderWithProviders(photos('little-rye'));
    expect(screen.getByRole('button', { name: 'Add a side photo' })).toBeTruthy();
  });

  test('at a venue, nothing for anyone else', async () => {
    mockCaps = [];
    await renderWithProviders(photos('little-rye'));
    expect(screen.queryByText('PHOTOS')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a side photo' })).toBeNull();
  });

  test('at home one photo, the one that leads the page', async () => {
    await renderWithProviders(photos(null));
    expect(screen.getByRole('button', { name: 'Add a photo: it leads the drink page' })).toBeTruthy();
    expect(screen.getByText('It leads the drink’s page. Add more angles there.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a side photo' })).toBeNull();
  });
});

test('with a hero photo the drawing is removed to start, Keep it in one tap (call B, 26 Oct)', async () => {
  const onChange = jest.fn();
  await renderWithProviders(<DrawingChoice kept={false} onChange={onChange} />);
  expect(screen.getByText('Drawing removed')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Keep the drawing, after the photos' }));
  expect(onChange).toHaveBeenCalledWith(true);
});
