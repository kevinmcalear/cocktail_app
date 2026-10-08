import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { SearchPill } from './DiscoverControls';
import { FiltersSheet } from './DiscoverSheet';

jest.mock('@/hooks/useDiscover', () => ({ useBarCities: () => ({ data: [] }) }));

test('the search pill clears only once there is a query', async () => {
  const onClear = jest.fn();
  const { rerender } = await renderWithTamagui(<SearchPill query="" placeholder="Search bars and drinks" onOpen={() => {}} onClear={onClear} />);
  expect(screen.queryByRole('button', { name: 'Clear the search' })).toBeNull();

  await rerender(<SearchPill query="negroni" placeholder="Search bars and drinks" onOpen={() => {}} onClear={onClear} />);
  expect(screen.getByText('negroni')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Clear the search' }));
  expect(onClear).toHaveBeenCalled();
});

test('filters pick several at once and clear together', async () => {
  const onChange = jest.fn();
  const onShow = jest.fn();
  await renderWithTamagui(<FiltersSheet kinds={['martini']} onChange={onChange} bars={3} closed={{ count: 4, shown: false, onShow }} onClose={() => {}} />);
  expect(screen.getByRole('checkbox', { name: 'Martinis', checked: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Gin' }));
  expect(onChange).toHaveBeenLastCalledWith(['martini', 'gin']);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Martinis' }));
  expect(onChange).toHaveBeenLastCalledWith([]);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Closed bars · 4', checked: false }));
  expect(onShow).toHaveBeenLastCalledWith(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
  expect(onChange).toHaveBeenLastCalledWith([]);
  expect(onShow).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Show 3 bars' })).toBeTruthy();
});
