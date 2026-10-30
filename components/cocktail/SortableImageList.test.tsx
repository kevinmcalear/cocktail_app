import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { SortableImageList, type ImageItem } from './SortableImageList';

// The drag list renders its rows in a plain column here (its gestures don't run in Jest).
jest.mock('react-native-draggable-flatlist', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const List = ({ data, renderItem }: { data: unknown[]; renderItem: (p: { item: unknown; drag: () => void; isActive: boolean; getIndex: () => number }) => React.ReactNode }) => <View>{data.map((item, i) => <View key={i}>{renderItem({ item, drag: () => undefined, isActive: false, getIndex: () => i })}</View>)}</View>;
  return { __esModule: true, default: List, ScaleDecorator: ({ children }: { children: React.ReactNode }) => children };
});
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
  await renderWithTamagui(<SortableImageList images={PHOTOS} onReorder={onReorder} onRemove={jest.fn()} onAdd={jest.fn()} />);
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
