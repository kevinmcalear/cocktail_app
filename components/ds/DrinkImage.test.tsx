import { act, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';

import { DrinkImage } from './DrinkImage';

// expo-image as a plain element that keeps its props, so the test can read the source and fail it.
const mockView = View;
jest.mock('expo-image', () => ({ Image: (props: object) => <mockView testID="photo" {...props} /> }));

const photo = 'https://x.supabase.co/storage/v1/object/public/drinks/cocktails/abc/1791417617256.png';
const thumb = 'https://x.supabase.co/storage/v1/object/public/drinks/thumbs/cocktails/abc/1791417617256.jpg';

test('a list-sized picture loads the thumbnail, then the original if the thumbnail is missing', async () => {
  await renderWithTamagui(<DrinkImage source={photo} accessibilityLabel="Martini" thumb />);
  const image = () => screen.getByTestId('photo').props as { source: { uri: string }; onError?: () => void };
  expect(image().source.uri).toBe(thumb);
  await act(async () => image().onError?.());
  expect(image().source.uri).toBe(photo);
});

test('a full-size picture loads the original', async () => {
  await renderWithTamagui(<DrinkImage source={photo} accessibilityLabel="Martini" />);
  expect((screen.getByTestId('photo').props as { source: { uri: string } }).source.uri).toBe(photo);
});
