import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { SheetSearchPanel } from './SheetSearchPanel';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));

// The results are the one search's own (SearchPanel's tests); here only what the sheet does with the field.
jest.mock('@/components/search/SearchPanel', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    SearchBody: ({ query, onShowOnMap }: { query: string; onShowOnMap?: () => void }) => (
      <Pressable role="button" accessibilityLabel="Show on the map" onPress={onShowOnMap}>
        <Text>{`Results for ${query}`}</Text>
      </Pressable>
    ),
  };
});

const mine = { venueId: null, label: 'Your drinks', contextIds: [], defaultScope: 'everywhere' } as never;
const area = { label: 'This area', area: { kind: 'anywhere' }, kinds: [], onKind: () => {}, onPlace: () => {} } as never;

async function open(query = '') {
  const onApply = jest.fn();
  const onClose = jest.fn();
  await renderWithTamagui(<SheetSearchPanel query={query} placeholder="Search near you" top={120} scope="area" onScope={() => {}} mine={mine} area={area} onApply={onApply} onClose={onClose} />);
  return { onApply, onClose, field: screen.getByPlaceholderText('Search near you') };
}

test('the field starts with the search on the map and says the place', async () => {
  const { field } = await open('martini');
  expect(field.props.value).toBe('martini');
  expect(field.props.placeholder).toBe('Search near you');
});

test('Cancel and a tap on the map leave the search as it was', async () => {
  const { onApply, onClose, field } = await open('martini');
  await fireEvent.changeText(field, 'negroni');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await fireEvent.press(screen.getByLabelText('Close the search'));
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(onApply).not.toHaveBeenCalled();
});

test('Return and Show on the map put the typed search on the map', async () => {
  const { onApply, field } = await open();
  await fireEvent.changeText(field, 'gimlet');
  await fireEvent(field, 'submitEditing');
  expect(onApply).toHaveBeenLastCalledWith('gimlet');
  await fireEvent.press(screen.getByRole('button', { name: 'Show on the map' }));
  expect(onApply).toHaveBeenCalledTimes(2);
});
