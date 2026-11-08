import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/jest.setup';

import { SortableImageList, type ImageItem } from './SortableImageList';

jest.mock('@/components/drink/drinkImages', () => ({ canCropPhotos: () => true, cropPhoto: jest.fn() }));
jest.mock('./CropPhoto', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return { CropPhoto: ({ uri }: { uri: string | null }) => (uri ? <Text>{`Cropping ${uri}`}</Text> : null) };
});

const PHOTOS: ImageItem[] = [
  { id: 'a', url: 'https://x.test/a.jpg' },
  { id: 'b', url: 'https://x.test/b.jpg' },
  { id: 'c', url: 'https://x.test/c.jpg', credit: 'Someone else' },
];

async function list(onReorder = jest.fn()) {
  await renderWithProviders(<SortableImageList images={PHOTOS} onReorder={onReorder} onRemove={jest.fn()} onAdd={jest.fn()} />);
  return onReorder;
}

it('marks the first photo as the main one', async () => {
  await list();
  expect(screen.getByText('Main')).toBeTruthy();
  expect(screen.getAllByLabelText('Make this the main photo')).toHaveLength(2);
});

it('makes another photo the main one by moving it first', async () => {
  const onReorder = await list();
  await fireEvent.press(screen.getAllByLabelText('Make this the main photo')[1]);
  expect(onReorder).toHaveBeenCalledWith([PHOTOS[2], PHOTOS[0], PHOTOS[1]]);
});

it('crops our own photos, never a borrowed one (a crop would lose its credit)', async () => {
  await list();
  expect(screen.getByLabelText('Crop main photo')).toBeTruthy();
  expect(screen.getAllByLabelText('Crop photo')).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText('Crop photo'));
  expect(screen.getByText('Cropping https://x.test/b.jpg')).toBeTruthy();
});
