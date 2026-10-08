import { fireEvent, screen } from '@testing-library/react-native';

import { BackbarTheme, ReviewRow } from '@/components/ds';
import { renderWithTamagui } from '@/jest.setup';

test('a pick shows its choices as a named radio group and reports the one chosen', async () => {
  const onChoose = jest.fn();
  await renderWithTamagui(
    <BackbarTheme>
      <ReviewRow state="pick" amount="15 ml" title="Pear liqueur" detail="Which one?" choices={[{ id: 'a', label: 'Rothman & Winter' }, { id: 'b', label: 'Belle de Brillet', detail: 'Pear cognac' }]} chosen="a" onChoose={onChoose} />
    </BackbarTheme>
  );
  expect(screen.getByText('15 ml')).toBeTruthy();
  expect(screen.getByText('Which one?')).toBeTruthy();
  expect(screen.getByLabelText('Which Pear liqueur').props.role).toBe('radiogroup');
  expect(screen.getByRole('radio', { name: 'Rothman & Winter', checked: true })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Belle de Brillet · Pear cognac', checked: false })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: 'Belle de Brillet · Pear cognac' }));
  expect(onChoose).toHaveBeenCalledWith('b');
});

test('the action is a button at the end of the row; no choices, no radio group', async () => {
  const onPress = jest.fn();
  await renderWithTamagui(
    <BackbarTheme>
      <ReviewRow state="new" title="Paper Plane" detail="New · Bourbon, Aperol" action={{ label: 'Finish', onPress }} />
    </BackbarTheme>
  );
  expect(screen.queryAllByRole('radio')).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Finish' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
