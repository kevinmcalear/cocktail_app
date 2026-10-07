import { fireEvent, screen, within } from '@testing-library/react-native';

import { BackbarTheme, SpecRow } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';

const label = (el: { props: { accessibilityLabel?: string; 'aria-label'?: string } }) => el.props.accessibilityLabel ?? el.props['aria-label'];

test('an amount with its own action and a linked ingredient are two sibling buttons, not nested', async () => {
  const onPress = jest.fn();
  const onPressAmount = jest.fn();
  await renderWithTamagui(
    <BackbarTheme>
      <SpecRow amount="128 oz" ingredient="Dry Gin" detail="3.78 L" optional onPress={onPress} onPressAmount={onPressAmount} />
    </BackbarTheme>
  );

  const buttons = screen.getAllByRole('button');
  expect(buttons.map(label)).toEqual(['128 oz, read in other units', 'Dry Gin, 3.78 L, optional']);
  for (const b of buttons) expect(within(b).queryAllByRole('button')).toHaveLength(0);

  await fireEvent.press(buttons[0]);
  expect(onPressAmount).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
  await fireEvent.press(buttons[1]);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('without an amount action the whole line is one button that reads the amount too', async () => {
  const onPress = jest.fn();
  await renderWithTamagui(
    <BackbarTheme>
      <SpecRow amount="2 oz" ingredient="Rye" onPress={onPress} />
    </BackbarTheme>
  );

  expect(screen.getAllByRole('button').map(label)).toEqual(['2 oz, Rye']);
});
