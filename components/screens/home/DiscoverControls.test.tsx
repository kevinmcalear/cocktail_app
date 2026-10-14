import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithTamagui } from '@/jest.setup';

import { SearchPill } from './DiscoverControls';
import { scrollAwayStep } from './DiscoverHeader';
import { FiltersSheet, OptionsSheet } from './DiscoverSheet';

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

test('options: list or map closes the sheet; where and filters keep it open', async () => {
  const onClose = jest.fn();
  const onView = jest.fn();
  const onArea = jest.fn();
  const onChange = jest.fn();
  const where = { area: { kind: 'anywhere' } as const, near: { status: 'idle' } as const, access: null, preferNear: false, onArea, onNearMe: jest.fn(), onThisArea: jest.fn() };
  await renderWithTamagui(<OptionsSheet kinds={[]} onChange={onChange} bars={3} closed={{ count: 0, shown: false, onShow: jest.fn() }} past={{ shown: false, onShow: jest.fn() }} onClose={onClose} where={where} view={{ showing: 'list', onChange: onView }} />);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Gin' }));
  expect(onChange).toHaveBeenLastCalledWith(['gin']);
  await fireEvent.press(screen.getByRole('radio', { name: 'Anywhere' }));
  expect(onArea).toHaveBeenCalledWith({ kind: 'anywhere' });
  expect(onClose).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('tab', { name: 'Map' }));
  expect(onView).toHaveBeenCalledWith('map');
  expect(onClose).toHaveBeenCalled();
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
