import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { BackPill, FiltersButton, SearchPill } from './DiscoverControls';
import { scrollAwayStep } from './DiscoverHeader';
import { placeSections } from './DiscoverPlace';
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

test("with a bar open on the phone map, the pill is its back arrow and name; the name opens search", async () => {
  const onBack = jest.fn();
  const onOpen = jest.fn();
  await renderWithTamagui(<BackPill name="Grey Lady" onBack={onBack} onOpen={onOpen} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Back to the results' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Grey Lady. Search' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('filters pick several at once and clear together', async () => {
  const onChange = jest.fn();
  const onShow = jest.fn();
  const onPast = jest.fn();
  await renderWithTamagui(<FiltersSheet kinds={['martini']} onChange={onChange} bars={3} closed={{ count: 4, shown: false, onShow }} past={{ shown: false, onShow: onPast }} onClose={() => {}} />);
  expect(screen.getByRole('checkbox', { name: 'Martinis', checked: true })).toBeTruthy();

  await fireEvent.press(screen.getByRole('checkbox', { name: 'Gin' }));
  expect(onChange).toHaveBeenLastCalledWith(['martini', 'gin']);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Martinis' }));
  expect(onChange).toHaveBeenLastCalledWith([]);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Closed bars · 4', checked: false }));
  expect(onShow).toHaveBeenLastCalledWith(true);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Past menus', checked: false }));
  expect(onPast).toHaveBeenLastCalledWith(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
  expect(onChange).toHaveBeenLastCalledWith([]);
  expect(onShow).toHaveBeenLastCalledWith(false);
  expect(onPast).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Show 3 bars' })).toBeTruthy();
});

test('"Not had yet" shows only when signed in, and clears with the rest', async () => {
  const props = { kinds: [], onChange: jest.fn(), bars: 3, closed: { count: 0, shown: false, onShow: jest.fn() }, past: { shown: false, onShow: jest.fn() }, onClose: () => {} };
  const { rerender } = await renderWithTamagui(<FiltersSheet {...props} />);
  expect(screen.queryByRole('checkbox', { name: 'Not had yet' })).toBeNull();

  const onNotHad = jest.fn();
  await rerender(<FiltersSheet {...props} notHad={{ shown: false, onShow: onNotHad }} />);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Not had yet', checked: false }));
  expect(onNotHad).toHaveBeenLastCalledWith(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Clear' }));
  expect(onNotHad).toHaveBeenLastCalledWith(false);
});

test('the place menu: near me, this area, anywhere, then the cities; the one in use is checked', () => {
  const onArea = jest.fn();
  const onThisArea = jest.fn();
  const cities = [{ city: 'New York', country_code: 'US', label: 'New York' }];
  const where = { area: { kind: 'city', city: 'New York', country_code: 'US', label: 'New York' } as const, preferNear: false, onArea, onNearMe: jest.fn(), onThisArea };
  const [places, inCities] = placeSections(where, cities);
  expect(places.items.map((i) => i.label)).toEqual(['Near me', 'This area', 'Anywhere']);
  expect(places.items.some((i) => i.checked)).toBe(false);
  expect(inCities.title).toBe('Cities');
  expect(inCities.items[0].checked).toBe(true);
  places.items[1].onPress();
  expect(onThisArea).toHaveBeenCalled();
  places.items[2].onPress();
  expect(onArea).toHaveBeenCalledWith({ kind: 'anywhere' });
  // No cities with bars yet: no Cities heading.
  expect(placeSections({ ...where, area: { kind: 'anywhere' } }, [])).toHaveLength(1);
});

test('Filters says how many are on', async () => {
  await renderWithTamagui(<FiltersButton filters={2} onPress={() => {}} />);
  expect(screen.getByRole('button', { name: 'Filters, 2 on' })).toBeTruthy();
});

test('the header goes after a scroll down and comes back after a small scroll up', () => {
  let s = { travel: 0, away: 0 };
  const scroll = (y: number, dy: number) => (s = scrollAwayStep(y, dy, s.travel, s.away));
  scroll(10, 10);
  expect(s.away).toBe(0);
  scroll(200, 190);
  expect(s.away).toBe(1);
  scroll(196, -4);
  expect(s.away).toBe(1);
  scroll(186, -10);
  expect(s.away).toBe(0);
  scroll(300, 114);
  expect(s.away).toBe(1);
  // Back near the top, it always shows.
  scroll(20, -280);
  expect(s.away).toBe(0);
});
