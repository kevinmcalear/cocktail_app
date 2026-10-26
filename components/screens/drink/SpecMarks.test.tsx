import { fireEvent, screen } from '@testing-library/react-native';

import { BackbarTheme } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';

import { SpecMarks } from './SpecMarks';

test('the glass is a button that opens its sheet; the method is a labelled picture', async () => {
  const openGlass = jest.fn();
  await renderWithTamagui(
    <BackbarTheme>
      <SpecMarks
        marks={[
          { key: 'method-Shake', label: 'Method: Shake', icon: 'Shaken' },
          { key: 'glass', label: 'Glass: Rocks', icon: 'Rocks', onPress: openGlass },
        ]}
      />
    </BackbarTheme>
  );
  expect(screen.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Glass: Rocks']);
  expect(screen.getByLabelText('Method: Shake')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button'));
  expect(openGlass).toHaveBeenCalledTimes(1);
});
