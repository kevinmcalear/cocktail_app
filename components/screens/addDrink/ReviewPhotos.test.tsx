import { fireEvent, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';
import { EMPTY_DRAFT, type WizardDraft } from '@/lib/drinkWizard';
import type { AnglePhotos } from '@/lib/photoAngles';

import { StartPhotos } from './ReviewPhotos';
import { ReviewStep } from './ReviewStep';

const mockPick = jest.fn();
jest.mock('@/components/drink/drinkImages', () => ({ pickDrinkPhotos: (o: unknown) => mockPick(o) }));
jest.mock('@/components/drink/CutoutOfferHost', () => ({ CutoutOfferHost: () => null }));
jest.mock('@/components/ds/SketchDrawing', () => ({ SketchDrawing: () => null }));
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ data: ['photos'] }) }));
jest.mock('@/hooks/usePublishing', () => ({ useBarPublishing: () => ({ data: undefined }) }));
jest.mock('@/hooks/useMyProfile', () => ({ useMyProfile: () => ({ data: null }) }));
jest.mock('@/hooks/useDiscover', () => ({ useDrinkLists: () => ({ data: [] }) }));

let latest: AnglePhotos = {};
function Start() {
  const [photos, setPhotos] = useState<AnglePhotos>({});
  const onChange = (next: AnglePhotos) => {
    latest = next;
    setPhotos(next);
  };
  return <StartPhotos photos={photos} onChange={onChange} barId="little-rye" />;
}

describe('StartPhotos (E26)', () => {
  beforeEach(() => (latest = {}));

  test('Add photos picks several at once, then Which is which? gives each its angle', async () => {
    mockPick.mockResolvedValueOnce(['a.jpg', 'b.jpg', 'c.jpg']);
    await renderWithTamagui(<Start />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add photos, several at once' }));
    expect(mockPick).toHaveBeenLastCalledWith({ cutout: true, several: 5 });
    // The first picked starts as the Hero.
    expect(latest).toEqual({ hero: 'a.jpg', side: 'b.jpg', top: 'c.jpg' });
    expect(await screen.findByText('3 photos picked. Give each its angle; the Hero leads the drink’s page.')).toBeTruthy();

    // Making photo 3 the Hero swaps it with photo 1: one angle each.
    const third = screen.getByLabelText('Which angle is photo 3');
    await fireEvent.press(within(third).getByRole('radio', { name: 'Hero' }));
    expect(latest).toEqual({ hero: 'c.jpg', side: 'b.jpg', top: 'a.jpg' });
    // A free angle just moves it.
    await fireEvent.press(within(screen.getByLabelText('Which angle is photo 2')).getByRole('radio', { name: 'Close up' }));
    expect(latest).toEqual({ hero: 'c.jpg', garnish: 'b.jpg', top: 'a.jpg' });

    // Add more asks only for the angles left.
    mockPick.mockResolvedValueOnce(['d.jpg']);
    await fireEvent.press(screen.getByRole('button', { name: 'Add more' }));
    expect(mockPick).toHaveBeenLastCalledWith({ cutout: true, several: 2 });
    expect(latest.side).toBe('d.jpg');
    expect(screen.getByLabelText('Which angle is photo 4')).toBeTruthy();
  });

  test('one photo is the Hero, with no question', async () => {
    mockPick.mockResolvedValueOnce(['a.jpg']);
    await renderWithTamagui(<Start />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add photos, several at once' }));
    expect(latest).toEqual({ hero: 'a.jpg' });
    expect(screen.queryByText(/photos? picked/)).toBeNull();
    expect(screen.getByText('PHOTOS · 1')).toBeTruthy();
  });
});

describe('ReviewStep (E25, Q15)', () => {
  const draft: WizardDraft = { ...EMPTY_DRAFT, name: 'Ash Garden' };
  const review = (barId: string | null) => (
    <ReviewStep draft={draft} set={jest.fn()} onJump={jest.fn()} barId={barId} venueName="Little Rye" hasProfile barVariants={[]} cost={barId ? <Text>COST CARD</Text> : undefined} />
  );

  test('at a venue the cost comes last, after every answer', async () => {
    await renderWithTamagui(review('little-rye'));
    const page = JSON.stringify(screen.toJSON());
    const cost = page.indexOf('COST CARD');
    expect(cost).toBeGreaterThan(page.indexOf('Who sees it'));
    expect(cost).toBeLessThan(page.indexOf('You can change any of it on the drink’s page.'));
    expect(screen.getByRole('button', { name: 'Add a side photo' })).toBeTruthy();
  });

  test('at home one photo, the one that leads the page', async () => {
    await renderWithTamagui(review(null));
    expect(screen.getByRole('button', { name: 'Add a photo: it leads the drink page' })).toBeTruthy();
    expect(screen.getByText('It leads the drink’s page. Add more angles there.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a side photo' })).toBeNull();
  });
});
