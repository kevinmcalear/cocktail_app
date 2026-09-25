import { fireEvent, screen } from '@testing-library/react-native';

import { SpecBadge } from '@/components/cocktail/SpecBadge';
import { renderWithTamagui } from '@/jest.setup';

test('a read-only badge reads as category and value, and is not a button', async () => {
  await renderWithTamagui(<SpecBadge label="Glassware" value="Coupe" />);

  expect(screen.getByRole('group', { name: 'Glassware: Coupe' })).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

test('editing without a handler stays read-only', async () => {
  await renderWithTamagui(<SpecBadge label="Method" value="Shaken" isEditing />);

  expect(screen.getByRole('group', { name: 'Method: Shaken' })).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

test('an editable badge is a button named by category and value', async () => {
  const onPress = jest.fn();
  await renderWithTamagui(<SpecBadge label="Glassware" value="Coupe" isEditing onPress={onPress} />);

  const button = screen.getByRole('button', { name: 'Glassware: Coupe' });
  expect(screen.queryAllByRole('group')).toHaveLength(0);
  expect(button.props.accessibilityHint).toBe('Choose glassware');
  await fireEvent.press(button);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('an empty editable badge says it is not set', async () => {
  await renderWithTamagui(<SpecBadge label="Ice" emptyLabel="Ice" isEditing onPress={jest.fn()} />);

  expect(screen.getByRole('button', { name: 'Ice, not set' })).toBeTruthy();
});
