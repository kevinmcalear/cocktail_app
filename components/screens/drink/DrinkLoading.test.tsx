import { act, screen } from '@testing-library/react-native';
import 'react-native-gesture-handler/jestSetup';

import { renderWithProviders } from '@/jest.setup';
import { drinkSeed, seedDrink } from '@/lib/drinkSeeds';

import { DrinkLoading } from './DrinkLoading';
import { ItemLoading } from './LoadingBar';

const mockOptions: { headerShown?: boolean; headerLeft?: () => unknown } = {};
jest.mock('expo-router', () => ({
  useNavigation: () => ({ setOptions: (o: object) => Object.assign(mockOptions, o), canGoBack: () => false }),
  useSegments: () => [],
  router: { replace: jest.fn() },
}));

// The pager draws its pages once it knows its width.
const layOut = () =>
  act(() => {
    for (const node of screen.container.queryAll((n) => typeof n.props.onLayout === 'function')) {
      node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } } });
    }
  });

test('a tapped row paints its picture and name while the drink loads', async () => {
  seedDrink({ id: 'd1', name: 'Martinez', imageUrl: 'https://x/martinez.jpg' });
  await renderWithProviders(<DrinkLoading seed={drinkSeed('d1')} />);
  await layOut();
  expect(screen.getByLabelText('Loading Martinez')).toBeTruthy();
  expect(screen.getByText('Martinez')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Martinez, photo. Open full screen' })).toBeTruthy();
});

test('with no row, just the page ground', async () => {
  await renderWithProviders(<DrinkLoading seed={null} />);
  expect(screen.getByLabelText('Loading drink')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('Back shows while it loads (Kevin, 3 Nov)', async () => {
  await renderWithProviders(<ItemLoading seed={null} />);
  expect(mockOptions.headerShown).toBe(true);
  expect(mockOptions.headerLeft).toBeDefined();
});
