import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';
import { takeBringIn } from '@/lib/bringInHandoff';
import { stageMenuPhotos } from '@/lib/menuPhotoHandoff';
import type { MenuDrink } from '@/types/menus';

import { MenuFromPhotoScreen } from './MenuFromPhotoScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRead = jest.fn();
const mockCreate = jest.fn();
const mockCover = jest.fn();
const mockPrices = jest.fn();

const negroni: MenuDrink = { id: 'n1', name: 'Negroni', kind: 'cocktail', line: 'Gin, Campari', price: null, imageUrl: null, isSketch: false, glass: null };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }) }));
jest.mock('@/hooks/useBulk', () => ({ useSetMissingPrices: () => ({ mutateAsync: mockPrices, isPending: false }) }));
jest.mock('@/hooks/useMenuMutations', () => ({
  useReadMenu: () => ({ mutateAsync: mockRead, isPending: false }),
  useUploadMenuCover: () => ({ mutateAsync: mockCover, isPending: false }),
  useCreateMenu: () => ({ mutateAsync: mockCreate, isPending: false }),
  useMenuLibrary: () => ({ data: [negroni] }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRead.mockResolvedValue({
    title: 'Spring Menu',
    sections: [
      { name: 'Signatures', lines: [{ name: 'Paper Plane', price: '18', ingredients: ['Bourbon', 'Aperol'] }] },
      { name: 'Classics', lines: [{ name: 'Negroni', price: '16', ingredients: ['Gin', 'Campari'] }] },
    ],
  });
  mockCover.mockResolvedValue('https://example.test/cover.jpg');
  mockCreate.mockResolvedValue('menu-1');
  stageMenuPhotos({ photos: [{ uri: 'file:///page1.jpg', mimeType: 'image/jpeg' }], barId: 'bar-1', name: '' });
});

describe('MenuFromPhotoScreen', () => {
  test('reads the photo once and shows matched and new drinks by section', async () => {
    await renderWithTamagui(<MenuFromPhotoScreen />);
    expect(await screen.findByText('Read from your photo: 2 drinks in 2 sections')).toBeTruthy();
    expect(mockRead).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Spring Menu')).toBeTruthy();
    expect(screen.getByText('SIGNATURES')).toBeTruthy();
    expect(screen.getByText('New · Bourbon, Aperol')).toBeTruthy();
    expect(screen.getByText('Matched in your library · Price 16')).toBeTruthy();
  });

  test('Finish takes a new drink to Bring in with its ingredients', async () => {
    await renderWithTamagui(<MenuFromPhotoScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Finish' }));
    expect(takeBringIn()).toBe('Paper Plane\n- Bourbon\n- Aperol');
    expect(mockPush).toHaveBeenCalledWith('/bring-in');
  });

  test('a reading handed over by Bring in is shown as is, not read again, and makes a menu without a cover', async () => {
    stageMenuPhotos({ photos: [{ uri: 'blob:specs', mimeType: 'application/pdf' }], barId: 'bar-1', name: '', reading: { title: 'From Bring in', sections: [{ name: null, lines: [{ name: 'Negroni', price: null, ingredients: [] }] }] } });
    await renderWithTamagui(<MenuFromPhotoScreen />);
    expect(await screen.findByText('Read: 1 drink in 1 section')).toBeTruthy();
    expect(mockRead).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Make the menu' }));
    expect(mockCover).not.toHaveBeenCalled();
    expect(mockCreate.mock.calls[0][0].layout.coverUrl).toBeNull();
  });

  test('Make the menu saves the matched drinks under their sections, with the photo as cover', async () => {
    await renderWithTamagui(<MenuFromPhotoScreen />);
    await screen.findByText('Read from your photo: 2 drinks in 2 sections');
    await fireEvent.press(screen.getByRole('button', { name: 'Make the menu' }));
    expect(mockPrices).toHaveBeenCalledWith([{ id: 'n1', price: '16' }]);
    expect(mockCover).toHaveBeenCalledWith('file:///page1.jpg');
    const { barId, layout } = mockCreate.mock.calls[0][0];
    expect(barId).toBe('bar-1');
    expect(layout.name).toBe('Spring Menu');
    expect(layout.coverUrl).toBe('https://example.test/cover.jpg');
    expect(layout.sections.map((s: { name: string; drinks: MenuDrink[] }) => [s.name, s.drinks.map((d) => d.id)])).toEqual([['Classics', ['n1']]]);
    expect(mockReplace).toHaveBeenCalledWith('/menus/menu-1/edit');
  });
});
