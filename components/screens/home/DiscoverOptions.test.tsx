import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { OptionChips, sortOptions } from './DiscoverOptions';

const labels = (o: { label: string }[]) => o.map((x) => x.label);

test('a style offers Best first, and Nearest once there is somewhere to count from', () => {
  expect(labels(sortOptions({ searching: false, best: false, nearest: false }))).toEqual(['Best first']);
  expect(labels(sortOptions({ searching: false, best: true, nearest: true }))).toEqual(['Best first', 'Nearest']);
});

test('a search offers Best match, Top rated when it names a drink, and Nearest', () => {
  expect(labels(sortOptions({ searching: true, best: false, nearest: false }))).toEqual(['Best match']);
  expect(labels(sortOptions({ searching: true, best: true, nearest: true }))).toEqual(['Best match', 'Top rated', 'Nearest']);
});

test('the order is a menu button; the toggles switch; one order alone shows no button', async () => {
  const onSort = jest.fn();
  const onPast = jest.fn();
  const options = sortOptions({ searching: false, best: true, nearest: true });
  await renderWithTamagui(<OptionChips onGlass sort={{ value: 'best', options, onChange: onSort }} past={{ on: false, onChange: onPast }} />);
  expect(screen.queryByRole('checkbox', { name: 'Not had yet' })).toBeNull(); // signed out
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Past menus' }));
  expect(onPast).toHaveBeenCalledWith(true);
  // The menu itself is PopoverMenu's (it places itself once the chip is measured).
  expect(screen.getByRole('button', { name: 'Order: Best first. Change' })).toBeTruthy();

  await renderWithTamagui(<OptionChips sort={{ value: 'best', options: options.slice(0, 1), onChange: onSort }} past={{ on: false, onChange: onPast }} />);
  expect(screen.queryByRole('button', { name: /^Order:/ })).toBeNull();
});
