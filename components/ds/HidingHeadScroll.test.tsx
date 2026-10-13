import { fireEvent, screen } from '@testing-library/react-native';
import { Keyboard, Text } from 'react-native';

import { renderWithTamagui } from '@/jest.setup';

import { HidingHeadScroll } from './HidingHeadScroll';

// jest-expo runs as iOS: the keyboard follows a pull down, and reading on puts it away.
const at = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: 2000 }, layoutMeasurement: { width: 390, height: 800 } } });

async function list() {
  await renderWithTamagui(
    <HidingHeadScroll testID="results" head={<Text>Field</Text>}>
      <Text>Rows</Text>
    </HidingHeadScroll>,
  );
  return screen.getByTestId('results');
}

describe('HidingHeadScroll', () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  beforeEach(() => dismiss.mockClear());

  it('lets the keyboard follow the finger and keeps taps on rows', async () => {
    const scroll = await list();
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(screen.getByText('Field')).toBeTruthy();
  });

  it('puts the keyboard away once a drag reads down the results', async () => {
    const scroll = await list();
    await fireEvent(scroll, 'scrollBeginDrag', at(100));
    await fireEvent.scroll(scroll, at(105));
    expect(dismiss).not.toHaveBeenCalled();
    await fireEvent.scroll(scroll, at(130));
    await fireEvent.scroll(scroll, at(160));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves it to the finger on a pull down, and to nothing once the drag ends', async () => {
    const scroll = await list();
    await fireEvent(scroll, 'scrollBeginDrag', at(300));
    await fireEvent.scroll(scroll, at(200));
    await fireEvent(scroll, 'scrollEndDrag', at(200));
    // Momentum carrying on after the finger lifts isn't a drag.
    await fireEvent.scroll(scroll, at(400));
    expect(dismiss).not.toHaveBeenCalled();
  });
});
